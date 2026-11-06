import { FeedbackEntry, RevisionFlag } from './model.js';
import { WorkItem } from '../workItems/model.js';
import { Person } from '../people/model.js';
import { logActivity } from '../activity/service.js';
import { createNotification } from '../notifications/service.js';
import { calculateMemberWorkloadMetrics } from '../assignment/service.js';
import { resolveScope } from '../../lib/scope.js';
import { REVISION_ROOT_CAUSES, normalizeRole } from '@mmp/shared';
import { isTeamMember, requireParticipant } from '../workItems/access.js';
import {
  assertDecisionAllowed,
  claimSubmission,
  releaseSubmission,
  afterDecision,
} from '../submissions/reviewDecision.js';

/**
 * Get full feedback thread and revision flag status for a work item
 */
export async function getFeedbackForWorkItem(workItemId, user) {
  const workItem = await WorkItem.findById(workItemId)
    .populate('departmentId', 'name code')
    .populate('ownerId', 'name email role jobRole');

  if (!workItem) {
    const error = new Error('Work item not found');
    error.statusCode = 404;
    throw error;
  }

  // Feedback is private to the step owner and leadership. Executives see the item, not the notes.
  const userId = (user._id || user.id || user.userId)?.toString();
  if (isTeamMember(user) && workItem.ownerId?._id?.toString() !== userId) {
    const error = new Error('You do not have access to this work item feedback');
    error.statusCode = 403;
    throw error;
  }
  if (normalizeRole(user.role) === 'executive') {
    const flagForExecutive = await RevisionFlag.findOne({ workItemId })
      .populate('ownerId', 'name role jobRole')
      .populate('classifiedBy', 'name role');
    return {
      workItem,
      entries: [],
      rounds: [],
      flag: flagForExecutive ? { ...flagForExecutive.toObject(), isOver48HoursUnclassified: flagForExecutive.isOver48HoursUnclassified } : null,
    };
  }

  // Fetch entries sorted chronologically
  const entries = await FeedbackEntry.find({ workItemId })
    .populate('fromPersonId', 'name email role jobRole')
    .sort({ round: 1, isResponse: 1, createdAt: 1 });

  // Group into structured rounds
  const roundsMap = new Map();
  for (const entry of entries) {
    const roundNum = entry.round;
    if (!roundsMap.has(roundNum)) {
      roundsMap.set(roundNum, {
        roundNumber: roundNum,
        reviewerFeedback: null,
        ownerResponse: null,
        status: 'In Progress',
        createdAt: entry.createdAt,
      });
    }
    const roundData = roundsMap.get(roundNum);
    if (!entry.isResponse) {
      roundData.reviewerFeedback = entry;
      roundData.status = entry.roundStatus;
    } else {
      roundData.ownerResponse = entry;
    }
  }

  const rounds = Array.from(roundsMap.values());

  // Check for revision flag
  const flag = await RevisionFlag.findOne({ workItemId })
    .populate('ownerId', 'name email role jobRole')
    .populate('classifiedBy', 'name email role');

  return {
    workItem,
    entries,
    rounds,
    flag: flag
      ? {
          ...flag.toObject(),
          isOver48HoursUnclassified: flag.isOver48HoursUnclassified,
        }
      : null,
  };
}

/**
 * Submit a feedback entry (reviewer feedback or owner response)
 */
export async function createFeedbackEntry(data, user) {
  const { workItemId, text, attachments = [] } = data;
  if (isTeamMember(user)) await requireParticipant(workItemId, user);
  let { round, roundStatus = 'Revision Required', isResponse = false } = data;

  const workItem = await WorkItem.findById(workItemId)
    .populate('ownerId', 'name email role jobRole');

  if (!workItem) {
    const error = new Error('Work item not found');
    error.statusCode = 404;
    throw error;
  }

  // Resolve sender person
  const userId = (user._id || user.id || user.userId)?.toString();
  const fromPerson = await Person.findOne({
    $or: [{ userId }, { _id: userId }],
  });

  if (!fromPerson) {
    const error = new Error('Authenticated person record not found');
    error.statusCode = 400;
    throw error;
  }

  const ownerIdStr = workItem.ownerId?._id?.toString() || workItem.ownerId?.toString();
  const userRole = normalizeRole(user.role);
  const isAdminOrHead = userRole === 'admin' || userRole === 'creative_head';

  // Determine round if not explicitly supplied
  const existingEntries = await FeedbackEntry.find({ workItemId }).sort({ round: -1, createdAt: -1 });
  let submissionToDecide = null;
  const latestRound = existingEntries.length > 0 ? existingEntries[0].round : 0;

  if (isResponse) {
    // Owner response logic
    if (user.role === 'team_member' && ownerIdStr !== fromPerson._id.toString()) {
      const error = new Error('Only the assigned owner can respond to review feedback');
      error.statusCode = 403;
      throw error;
    }

    if (!round) {
      round = latestRound || 1;
    }

    // Verify a reviewer entry exists for this round
    const reviewerEntry = await FeedbackEntry.findOne({
      workItemId,
      round,
      isResponse: false,
    });

    if (!reviewerEntry) {
      const error = new Error(`Cannot submit owner response for Round ${round} without reviewer feedback`);
      error.statusCode = 400;
      throw error;
    }
  } else {
    // Reviewer feedback logic. This route cannot approve: approval needs a rating, through the review flow.
    if (roundStatus === 'Approved') {
      const error = new Error('Approve this step through the review flow, where a rating is required.');
      error.statusCode = 409;
      error.code = 'USE_REVIEW_FLOW';
      throw error;
    }

    // Everything is checked before the first write.
    submissionToDecide = await assertDecisionAllowed({ user, workItem, decision: 'revision' });

    // Auto-advance round if latest round has already been reviewed
    if (!round) {
      const hasReviewerInLatest = existingEntries.some(
        (e) => e.round === latestRound && !e.isResponse
      );
      round = hasReviewerInLatest ? latestRound + 1 : Math.max(1, latestRound);
    }
  }

  // A reviewer's entry is a decision: claim the latest version first, so only one decision can win.
  if (submissionToDecide) {
    await claimSubmission(submissionToDecide, 'changes_requested', user);
  }

  // Create feedback entry
  let entry;
  const fromStatus = workItem.status;
  try {
    entry = await FeedbackEntry.create({
      workItemId,
      round,
      fromPersonId: fromPerson._id,
      roundStatus,
      text,
      isResponse,
      attachments,
    });

    // Update WorkItem state based on entry
    if (!isResponse) {
      const decidedAt = new Date();
      workItem.status = 'Feedback';
      workItem.revisions = (workItem.revisions || 0) + 1;
      workItem.changesRequestedAt = decidedAt;
      workItem.decisionAt = decidedAt;
      if (workItem.rounds && workItem.rounds.length > 0) {
        const curRound = workItem.rounds[workItem.rounds.length - 1];
        curRound.decisionAt = decidedAt;
        curRound.decision = 'changes_requested';
      }
      await workItem.save();
    }
  } catch (error) {
    if (entry) await FeedbackEntry.deleteOne({ _id: entry._id });
    if (submissionToDecide) await releaseSubmission(submissionToDecide);
    throw error;
  }

  if (!isResponse) {
    // The decision is saved. What follows must not fail it.
    await afterDecision('the feedback event', () =>
      logActivity({
        entityType: 'work_item',
        entityId: workItem._id,
        actor: user,
        action: 'work_item.feedback_submitted',
        fromStatus,
        toStatus: workItem.status,
        metadata: {
          round,
          roundStatus,
          text,
          revisions: workItem.revisions,
        },
      })
    );

    // Notify WorkItem Owner
    if (workItem.ownerId?._id && workItem.ownerId._id.toString() !== fromPerson._id.toString()) {
      await afterDecision('the feedback notification', () =>
        createNotification({
          recipient: workItem.ownerId._id,
          type: 'work_item.feedback',
          title: `Feedback on Round ${round}: ${workItem.title}`,
          message: `${fromPerson.name} marked "${workItem.title}" as ${roundStatus}.`,
          link: `/work/${workItem._id}`,
          metadata: { workItemId: workItem._id, round, roundStatus },
        })
      );
    }

    // CHECK REVISION FLAG INVARIANT:
    // Trigger automatically when revisions >= 4 OR revisions > (ownerBaselineAvg + 1)
    await afterDecision('the revision flag check', () => checkAndCreateRevisionFlag(workItem, user));
  } else {
    // Owner responded
    await logActivity({
      entityType: 'work_item',
      entityId: workItem._id,
      actor: user,
      action: 'work_item.feedback_response',
      metadata: {
        round,
        text,
      },
    });
  }

  return FeedbackEntry.findById(entry._id).populate('fromPersonId', 'name email role jobRole');
}

/**
 * Check and auto-flag revision flag if threshold exceeded
 */
export async function checkAndCreateRevisionFlag(workItem, actor = null) {
  const currentRevisions = workItem.revisions || 0;
  const ownerId = workItem.ownerId?._id || workItem.ownerId;

  if (!ownerId) return null;

  // Check if already flagged
  let flag = await RevisionFlag.findOne({ workItemId: workItem._id });
  if (flag) {
    flag.revisionsCount = currentRevisions;
    await flag.save();
    return flag;
  }

  // Get owner baseline revisions
  let baselineAvg = 1.0;
  try {
    const metrics = await calculateMemberWorkloadMetrics(ownerId);
    baselineAvg = metrics.avgRevisions || 1.0;
  } catch (err) {
    baselineAvg = 1.0;
  }

  const shouldFlag = currentRevisions >= 4 || currentRevisions > baselineAvg + 1;

  if (shouldFlag) {
    flag = await RevisionFlag.create({
      workItemId: workItem._id,
      ownerId,
      revisionsCount: currentRevisions,
      baselineAvg,
      isFlagged: true,
      flaggedAt: new Date(),
    });

    const actorObj =
      actor && (actor._id || actor.id || actor.userId)
        ? actor
        : { _id: ownerId, role: 'system', name: 'Revision Engine' };

    // Log ActivityEvent
    await logActivity({
      entityType: 'work_item',
      entityId: workItem._id,
      actor: actorObj,
      action: 'revision.flagged',
      metadata: {
        revisionsCount: currentRevisions,
        baselineAvg,
        reason:
          currentRevisions >= 4
            ? `Revisions reached ${currentRevisions} (>= 4 ceiling)`
            : `Revisions (${currentRevisions}) exceeded baseline (${baselineAvg}) + 1`,
      },
    });

    // Alert Creative Heads and SM Managers
    const alertPersons = await Person.find({
      $or: [
        { role: 'creative_head', status: 'active' },
        { role: 'sm_manager', departmentId: workItem.departmentId, status: 'active' },
      ],
    });

    for (const recipient of alertPersons) {
      await createNotification({
        recipient: recipient._id,
        type: 'revision.flagged',
        title: `Revision Flag Triggered: ${workItem.title}`,
        message: `Deliverable "${workItem.title}" reached ${currentRevisions} revisions (baseline: ${baselineAvg}). Root cause classification required.`,
        link: `/feedback`,
        metadata: { workItemId: workItem._id, revisionsCount: currentRevisions, baselineAvg },
      });
    }

    return flag;
  }

  return null;
}

/**
 * Classify root cause for a revision flag (SM Manager, Creative Head or Admin)
 */
export async function classifyRevisionFlag(flagId, { rootCause, rootCauseNotes }, user) {
  if (user.role === 'team_member') {
    const error = new Error('Only an SM Manager, Creative Head, or Admin can classify revision root causes');
    error.statusCode = 403;
    throw error;
  }

  if (!REVISION_ROOT_CAUSES.includes(rootCause)) {
    const error = new Error(
      `Invalid root cause: "${rootCause}". Must be one of: ${REVISION_ROOT_CAUSES.join(', ')}`
    );
    error.statusCode = 400;
    throw error;
  }

  const flag = await RevisionFlag.findById(flagId)
    .populate('workItemId', 'title departmentId')
    .populate('ownerId', 'name email role');

  if (!flag) {
    const error = new Error('Revision flag not found');
    error.statusCode = 404;
    throw error;
  }

  const userId = (user._id || user.id || user.userId)?.toString();
  const classifierPerson = await Person.findOne({
    $or: [{ userId }, { _id: userId }],
  });

  flag.rootCause = rootCause;
  flag.rootCauseNotes = rootCauseNotes?.trim() || '';
  flag.classifiedBy = classifierPerson?._id || null;
  flag.classifiedAt = new Date();
  await flag.save();

  // Log ActivityEvent
  await logActivity({
    entityType: 'work_item',
    entityId: flag.workItemId._id,
    actor: user,
    action: 'revision.classified',
    metadata: {
      flagId: flag._id,
      rootCause,
      rootCauseNotes: flag.rootCauseNotes,
      classifiedBy: classifierPerson?.name,
    },
  });

  return RevisionFlag.findById(flag._id)
    .populate('workItemId', 'title workType status deadline')
    .populate('ownerId', 'name email role jobRole')
    .populate('classifiedBy', 'name email role');
}

/**
 * List revision flags with status filter and escalation evaluation
 */
export async function listRevisionFlags(filters = {}, user) {
  const query = {};

  if (filters.status === 'unclassified') {
    query.rootCause = null;
  } else if (filters.status === 'classified') {
    query.rootCause = { $ne: null };
  }

  if (filters.ownerId) {
    query.ownerId = filters.ownerId;
  }

  const flags = await RevisionFlag.find(query)
    .populate({
      path: 'workItemId',
      select: 'title workType status deadline departmentId revisions',
      populate: [
        { path: 'departmentId', select: 'name code' },
      ],
    })
    .populate('ownerId', 'name email role jobRole departmentId')
    .populate('classifiedBy', 'name email role')
    .sort({ flaggedAt: -1 });

  // Map and compute escalation status
  const mapped = flags.map((f) => {
    const obj = f.toObject();
    const isEscalated =
      f.isEscalated || (!f.rootCause && Date.now() - new Date(f.flaggedAt).getTime() > 48 * 3600 * 1000);
    return {
      ...obj,
      isEscalated,
      isOver48HoursUnclassified: isEscalated,
    };
  });

  if (filters.status === 'escalated') {
    return mapped.filter((f) => f.isEscalated);
  }

  return mapped;
}

/**
 * List all active feedback threads across deliverables
 */
export async function listFeedbackThreads(filters = {}, user) {
  const scope = resolveScope(user, filters);

  const workItemsQuery = {
    ...scope,
    $or: [{ status: 'Feedback' }, { status: 'Pending' }, { revisions: { $gt: 0 } }],
  };

  if (filters.departmentId) {
    workItemsQuery.departmentId = filters.departmentId;
  }

  const workItems = await WorkItem.find(workItemsQuery)
    .populate('departmentId', 'name code')
    .populate('ownerId', 'name email role jobRole')
    .sort({ updatedAt: -1 })
    .limit(filters.limit ? Number(filters.limit) : 50);

  // For each work item, fetch latest feedback round and check if flagged
  const results = await Promise.all(
    workItems.map(async (item) => {
      const latestEntry = await FeedbackEntry.findOne({ workItemId: item._id })
        .populate('fromPersonId', 'name email role')
        .sort({ round: -1, createdAt: -1 });

      const totalEntries = await FeedbackEntry.countDocuments({ workItemId: item._id });
      const flag = await RevisionFlag.findOne({ workItemId: item._id });

      return {
        workItem: item,
        latestEntry: normalizeRole(user.role) === 'executive' ? null : latestEntry,
        totalEntries,
        revisions: item.revisions || 0,
        flag: flag
          ? {
              ...flag.toObject(),
              isOver48HoursUnclassified: flag.isOver48HoursUnclassified,
            }
          : null,
      };
    })
  );

  return results;
}
