import {
  getPipelineForContent,
  calculateStageDueDate,
  DEFAULT_STAGE_HOURS,
  isPostableWorkType,
  normalizeWorkType,
} from '@mmp/shared';
import { Person } from '../people/model.js';
import { WorkItem } from '../workItems/model.js';
import { FeedbackEntry } from '../feedback/model.js';

/**
 * Suggest stage owners and deadlines for a row before saving
 *
 * @param {Object} input
 * @param {string} input.type Deliverable type (Reel, Static Post, etc.)
 * @param {Date|string} input.postingDate Final posting date (F)
 * @param {boolean} [input.needsScript=false]
 * @param {boolean} [input.needsShoot=false]
 * @param {Array} [input.currentPlanRows=[]] Other rows in the same plan to include in draft load
 * @returns {Promise<{ pipeline: string, hasPostStage: boolean, stages: Array, suggestedPostingOwner: Object|null }>}
 */
export async function autofillRowPlan({
  type,
  postingDate,
  needsScript = false,
  needsShoot = false,
  currentPlanRows = [],
}) {
  const normType = normalizeWorkType(type || 'Static Post');
  const finalDate = postingDate ? new Date(postingDate) : new Date();

  const pipelineInfo = getPipelineForContent({
    contentType: normType,
    needsScript: Boolean(needsScript),
    needsShoot: Boolean(needsShoot),
  });

  // Calculate draft hours per person from other rows in current plan
  const draftHoursPerPerson = new Map();
  for (const r of currentPlanRows) {
    const rStages = Array.isArray(r.stagePlan) ? r.stagePlan : [];
    for (const st of rStages) {
      if (st.ownerId) {
        const idStr = String(st.ownerId);
        const hrs = DEFAULT_STAGE_HOURS[st.stageKey] || 4;
        draftHoursPerPerson.set(idStr, (draftHoursPerPerson.get(idStr) || 0) + hrs);
      }
    }
  }

  // Fetch all active team_members (strictly exclude admin, creative_head, sm_manager, executive)
  const activeMembers = await Person.find({
    role: 'team_member',
    status: 'active',
  }).lean();

  // Pre-calculate workload & 90-day revisions for each candidate
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000);
  const candidatesData = [];

  for (const member of activeMembers) {
    const capacity = member.weeklyCapacityHours || 40;

    // Open work items
    const openItems = await WorkItem.find({
      ownerId: member._id,
      status: { $in: ['Not Started', 'In Progress', 'Feedback'] },
    }).select('estimatedEffortHrs').lean();

    const existingHours = openItems.reduce((acc, it) => acc + (it.estimatedEffortHrs || 4), 0);
    const draftHours = draftHoursPerPerson.get(member._id.toString()) || 0;
    const totalHours = existingHours + draftHours;
    const workloadPct = capacity > 0 ? Math.round((totalHours / capacity) * 100) : 0;

    // 90-day revisions
    const revEntries = await FeedbackEntry.countDocuments({
      'attachments.fromPersonId': member._id,
      createdAt: { $gte: ninetyDaysAgo },
    }).catch(() => 0);

    candidatesData.push({
      member,
      workPreferences: member.workPreferences || [],
      capacity,
      workloadPct,
      revisionsCount: member.avgRevisions || revEntries || 0,
    });
  }

  // Helper to pick best candidate for a stageKey
  function pickBestCandidate(stageKey) {
    // 1. Must hold workPreference
    const eligible = candidatesData.filter(
      (c) => c.workPreferences.includes(stageKey) && c.workloadPct < 85
    );

    if (eligible.length === 0) {
      return null;
    }

    // 2. Rank: lowest workload % -> fewest 90d revisions
    eligible.sort((a, b) => {
      if (a.workloadPct !== b.workloadPct) {
        return a.workloadPct - b.workloadPct;
      }
      return a.revisionsCount - b.revisionsCount;
    });

    return eligible[0];
  }

  const stages = [];
  for (const stageKey of pipelineInfo.stages) {
    const dueDate = calculateStageDueDate(
      finalDate,
      pipelineInfo.pipeline,
      stageKey,
      pipelineInfo.hasPostStage
    );

    const best = pickBestCandidate(stageKey);

    if (best) {
      stages.push({
        stageKey,
        ownerId: best.member._id.toString(),
        ownerName: best.member.name,
        dueDate,
        ownerSource: 'suggested',
        dueDateSource: 'auto',
        reason: `Lowest workload (${best.workloadPct}%), ${best.revisionsCount} avg rev`,
      });
      // Increment candidate's draft hours so they aren't double-assigned within the same row
      const stageHours = DEFAULT_STAGE_HOURS[stageKey] || 4;
      best.workloadPct += Math.round((stageHours / best.capacity) * 100);
    } else {
      stages.push({
        stageKey,
        ownerId: null,
        ownerName: null,
        dueDate,
        ownerSource: 'suggested',
        dueDateSource: 'auto',
        reason: 'No available person with this role',
      });
    }
  }

  // If postable, also suggest posting owner
  let suggestedPostingOwner = null;
  if (isPostableWorkType(normType)) {
    const postCandidate = pickBestCandidate('Post');
    if (postCandidate) {
      suggestedPostingOwner = {
        _id: postCandidate.member._id.toString(),
        name: postCandidate.member.name,
        email: postCandidate.member.email,
        reason: `Lowest workload (${postCandidate.workloadPct}%)`,
      };
    }
  }

  return {
    pipeline: pipelineInfo.pipeline,
    hasPostStage: pipelineInfo.hasPostStage,
    stages,
    suggestedPostingOwner,
  };
}
