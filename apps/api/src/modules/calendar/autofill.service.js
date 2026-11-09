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

const OPEN_STATUSES = ['Not Started', 'In Progress', 'Feedback'];

/**
 * Load everything autofill reads from the database, once.
 * Three queries in total, however many rows are being filled:
 * active team members, their open work items, and 90-day revision entries.
 *
 * The rules are the same as the per-row version: open hours use
 * `estimatedEffortHrs || 4`, revisions use `avgRevisions || 90-day entries || 0`.
 */
export async function buildAutofillContext() {
  // Strictly team members (exclude admin, creative_head, sm_manager, executive)
  const members = await Person.find({ role: 'team_member', status: 'active' }).lean();
  const ids = members.map((m) => m._id);

  const openItems = await WorkItem.find({ ownerId: { $in: ids }, status: { $in: OPEN_STATUSES } })
    .select('ownerId estimatedEffortHrs')
    .lean();
  const openHours = new Map();
  for (const it of openItems) {
    const k = String(it.ownerId);
    openHours.set(k, (openHours.get(k) || 0) + (it.estimatedEffortHrs || 4));
  }

  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000);
  const revisions = new Map();
  try {
    const entries = await FeedbackEntry.find({
      'attachments.fromPersonId': { $in: ids },
      createdAt: { $gte: ninetyDaysAgo },
    })
      .select('attachments.fromPersonId')
      .lean();
    for (const e of entries) {
      // Same as countDocuments per person: an entry counts once for each person it names.
      const named = new Set((e.attachments || []).map((a) => String(a.fromPersonId)));
      for (const k of named) revisions.set(k, (revisions.get(k) || 0) + 1);
    }
  } catch {
    // Same fallback as before: no revision data counts as 0.
  }

  return {
    candidates: members.map((member) => {
      const k = String(member._id);
      return {
        member,
        workPreferences: member.workPreferences || [],
        capacity: member.weeklyCapacityHours || 40,
        existingHours: openHours.get(k) || 0,
        revisionsCount: member.avgRevisions || revisions.get(k) || 0,
      };
    }),
  };
}

/**
 * Suggest stage owners and deadlines for a row before saving
 *
 * @param {Object} input
 * @param {string} input.type Deliverable type (Reel, Static Post, etc.)
 * @param {Date|string} input.postingDate Final posting date (F)
 * @param {boolean} [input.needsScript=false]
 * @param {boolean} [input.needsShoot=false]
 * @param {Array} [input.currentPlanRows=[]] Other rows in the same plan to include in draft load
 * @param {Object} [input.context] From buildAutofillContext(); pass it when filling many rows
 * @returns {Promise<{ pipeline: string, hasPostStage: boolean, stages: Array, suggestedPostingOwner: Object|null }>}
 */
export async function autofillRowPlan({
  type,
  postingDate,
  needsScript = false,
  needsShoot = false,
  needsContent = true,
  currentPlanRows = [],
  context = null,
}) {
  const ctx = context || (await buildAutofillContext());
  const normType = normalizeWorkType(type || 'Static Post');
  const finalDate = postingDate ? new Date(postingDate) : new Date();

  const pipelineInfo = getPipelineForContent({
    contentType: normType,
    needsScript: Boolean(needsScript),
    needsShoot: Boolean(needsShoot),
    needsContent: needsContent !== false,
  });

  // Calculate draft hours per person from other rows in current plan (in row order)
  const draftHoursPerPerson = new Map();
  for (const r of currentPlanRows) {
    const rStages = Array.isArray(r.stagePlan) ? r.stagePlan : [];
    for (const st of rStages) {
      if (st.ownerId) {
        const idStr = String(st.ownerId._id || st.ownerId);
        const hrs = DEFAULT_STAGE_HOURS[st.stageKey] || 4;
        draftHoursPerPerson.set(idStr, (draftHoursPerPerson.get(idStr) || 0) + hrs);
      }
    }
  }

  // Fresh per-row copy: the within-row increment below must not leak to the next row.
  const candidatesData = ctx.candidates.map((c) => {
    const draftHours = draftHoursPerPerson.get(c.member._id.toString()) || 0;
    const totalHours = c.existingHours + draftHours;
    return {
      member: c.member,
      workPreferences: c.workPreferences,
      capacity: c.capacity,
      workloadPct: c.capacity > 0 ? Math.round((totalHours / c.capacity) * 100) : 0,
      revisionsCount: c.revisionsCount,
    };
  });

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
