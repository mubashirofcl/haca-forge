import { WorkItem } from './model.js';
import { logActivity } from '../activity/service.js';
import { BLOCKER_REASONS, normalizeRole, getAvailableActions, getWorkspaceMode } from '@mmp/shared';
import { resolveScope } from '../../lib/scope.js';
import { Person } from '../people/model.js';
import { logger } from '../../lib/logger.js';
import { recordRoundSubmission } from './rounds.js';

export const ALLOWED_TRANSITIONS = {
  'Not Started': ['In Progress', 'Blocked'],
  'In Progress': ['Feedback', 'Pending', 'Blocked', 'Approved', 'Published'],
  'Feedback': ['In Progress', 'Pending', 'Approved', 'Blocked'],
  'Pending': ['Approved', 'Feedback', 'In Progress', 'Blocked', 'Published'],
  'Blocked': ['In Progress', 'Not Started'],
  'Approved': ['Published', 'Feedback', 'In Progress'],
  'Published': ['Feedback', 'In Progress'],
};

/**
 * @param options.reviewDecision Set only by the review decision code (submissions/reviewDecision.js),
 *   never from a request. It alone may apply a review decision to a step that requires review.
 * @param options.ownerSubmission Set only by submit-clips, never from a request. The owner has just
 *   sent a new version, so this move is the submission itself, not a withdrawal.
 */
export async function transitionWorkItem(id, transitionData, user, options = {}) {
  const { toStatus, blockerReason, blockerNote, deliverableUrl, publishedUrl, comment } =
    transitionData;

  const workItem = await WorkItem.findById(id);
  if (!workItem) {
    const error = new Error('Work item not found');
    error.statusCode = 404;
    throw error;
  }

  const fromStatus = workItem.status;

  // 1. Check if same status
  if (fromStatus === toStatus) {
    return workItem;
  }

  // 2. Validate allowed state transition
  const validTargets = ALLOWED_TRANSITIONS[fromStatus] || [];
  if (!validTargets.includes(toStatus)) {
    const error = new Error(
      `Invalid transition from "${fromStatus}" to "${toStatus}". Allowed transitions: ${validTargets.join(', ')}`
    );
    error.statusCode = 400;
    error.code = 'INVALID_TRANSITION';
    throw error;
  }

  // 3. Central Role & Ownership Authorization Guard
  const userId = (user._id || user.id || user.userId)?.toString();
  const ownerIdStr = (workItem.ownerId?._id || workItem.ownerId)?.toString();
  const userRole = normalizeRole(user.role);
  const { actions, isOwner } = getAvailableActions(user, workItem);

  if (userRole === 'executive') {
    const error = new Error('Executives cannot perform status transitions');
    error.statusCode = 403;
    error.code = 'FORBIDDEN_ACTION';
    throw error;
  }

  if (userRole === 'team_member' && ownerIdStr !== userId) {
    const error = new Error('You can only update status for work items assigned to you');
    error.statusCode = 403;
    error.code = 'FORBIDDEN_OWNERSHIP';
    throw error;
  }

  let requiredAction = null;
  if (fromStatus === 'Not Started' && toStatus === 'In Progress') {
    requiredAction = 'start';
  } else if (toStatus === 'Pending') {
    requiredAction = 'submit_for_approval';
  } else if (toStatus === 'Published') {
    requiredAction = 'mark_as_posted';
  } else if (toStatus === 'Blocked') {
    requiredAction = 'mark_blocked';
  } else if (fromStatus === 'Pending' && toStatus === 'Approved') {
    requiredAction = 'approve';
  } else if (fromStatus === 'Pending' && toStatus === 'Feedback') {
    requiredAction = 'request_revision';
  } else if (fromStatus === 'Blocked' && toStatus === 'In Progress') {
    requiredAction = 'resolve_blocker';
  } else if (fromStatus === 'Feedback' && toStatus === 'In Progress') {
    requiredAction = 'start';
  }

  // Self-approval guard
  if (toStatus === 'Approved') {
    if (ownerIdStr === userId) {
      const error = new Error('The owner can never approve their own stage');
      error.statusCode = 403;
      error.code = 'FORBIDDEN_SELF_APPROVAL';
      throw error;
    }
    if (userRole !== 'creative_head' && userRole !== 'admin') {
      const error = new Error(
        'Review stages can be approved only by Creative Head and Admin. SM Manager and the owner cannot approve.'
      );
      error.statusCode = 403;
      error.code = 'FORBIDDEN_APPROVAL';
      throw error;
    }
  }

  const isFinishedStep = fromStatus === 'Approved' || fromStatus === 'Published';
  const isReopen = isFinishedStep && (toStatus === 'Feedback' || toStatus === 'In Progress');
  const isReviewerRevision = fromStatus === 'Pending' && toStatus === 'Feedback';

  // Reopening a finished step: creative_head and admin only, and never your own work.
  if (isReopen && ((userRole !== 'creative_head' && userRole !== 'admin') || ownerIdStr === userId)) {
    const error = new Error('Only a Creative Head or Admin who does not own this step can reopen it');
    error.statusCode = 403;
    error.code = 'FORBIDDEN_REOPEN';
    throw error;
  }

  // Requesting a revision follows the same reviewer rule as every other decision path.
  if (isReviewerRevision && !options.reviewDecision) {
    if (userRole !== 'creative_head' && userRole !== 'admin') {
      const error = new Error('Only Creative Head or Admin can request revisions');
      error.statusCode = 403;
      error.code = 'FORBIDDEN_ACTION';
      throw error;
    }
    if (ownerIdStr === userId) {
      const error = new Error('You cannot review your own work');
      error.statusCode = 403;
      error.code = 'FORBIDDEN_SELF_APPROVAL';
      throw error;
    }
  }

  // An owner cannot take a step out of review while its latest version waits on a reviewer.
  if (isOwner && !options.reviewDecision && !options.ownerSubmission) {
    const { assertOwnerCanLeaveReview } = await import('../submissions/reviewDecision.js');
    await assertOwnerCanLeaveReview(workItem);
  }

  // A step that requires review is decided through the review flow, which needs a rating.
  if (workItem.reviewRequired && !options.reviewDecision) {
    let bypassesReview = toStatus === 'Approved' || isReviewerRevision;
    if (fromStatus === 'Feedback' && toStatus === 'In Progress' && !isOwner) {
      const { Submission } = await import('../submissions/model.js');
      const latest = await Submission.findOne({ workItemId: workItem._id, version: { $gt: 0 } }).sort({ version: -1 });
      bypassesReview = latest?.status === 'submitted';
    }
    if (bypassesReview) {
      const error = new Error('This step requires review. Use the review flow to approve it or request changes.');
      error.statusCode = 409;
      error.code = 'USE_REVIEW_FLOW';
      throw error;
    }
  }

  // Worker actions guard: A user never gets worker actions on a task they do not own
  // Note: On legacy standalone work items (no stageKey), sm_manager can publish and head can request rework.
  let isWorkerAction = ['start', 'submit_for_approval', 'mark_as_posted', 'mark_blocked'].includes(requiredAction);
  if (fromStatus === 'Feedback' && toStatus === 'In Progress' && (userRole === 'creative_head' || userRole === 'admin')) {
    isWorkerAction = false;
  }
  if (toStatus === 'Published' && !workItem.stageKey && (userRole === 'sm_manager' || userRole === 'admin')) {
    isWorkerAction = false;
  }

  if (isWorkerAction && !isOwner) {
    const error = new Error(
      `Action not permitted for your role: ${requiredAction || toStatus}. You must hold the appropriate role or stage ownership.`
    );
    error.statusCode = 403;
    error.code = 'FORBIDDEN_ACTION';
    throw error;
  }

  // Workspace mode guard: submit_for_approval requires edit mode
  if (requiredAction === 'submit_for_approval' && isOwner) {
    const mode = getWorkspaceMode(user, workItem);
    if (mode !== 'edit') {
      const error = new Error('Action not permitted: Workspace is not in edit mode.');
      error.statusCode = 403;
      error.code = 'FORBIDDEN_ACTION';
      throw error;
    }
  }

  // Precondition: Worker cannot submit without having started
  if (toStatus === 'Pending' || toStatus === 'Feedback') {
    if (fromStatus === 'Not Started') {
      const error = new Error('You must start this work item before submitting deliverables');
      error.statusCode = 400;
      error.code = 'MUST_START_BEFORE_SUBMIT';
      throw error;
    }
    if (!workItem.startedAt) {
      workItem.startedAt = workItem.createdAt || new Date();
    }
  }

  // Blocker resolution guard: Owner, SM Manager, or Admin only
  if (fromStatus === 'Blocked' && toStatus === 'In Progress') {
    if (!isOwner && userRole !== 'sm_manager' && userRole !== 'admin') {
      const error = new Error(
        'Action not permitted for your role: resolve_blocker. You must hold the appropriate role or stage ownership.'
      );
      error.statusCode = 403;
      error.code = 'FORBIDDEN_ACTION';
      throw error;
    }
  }

  const now = new Date();

  // 5. Blocker Reason Guard & Interval Tracking: mandatory when toStatus is Blocked
  if (toStatus === 'Blocked') {
    if (!blockerReason || !BLOCKER_REASONS.includes(blockerReason)) {
      const error = new Error(
        'A valid blockerReason is strictly required when transitioning a work item to Blocked'
      );
      error.statusCode = 400;
      error.code = 'BLOCKER_REASON_REQUIRED';
      throw error;
    }
    workItem.blockerReason = blockerReason;
    workItem.blockerNote = blockerNote || '';

    if (!workItem.intervals) workItem.intervals = [];
    const blockedInterval = {
      kind: 'blocked',
      startedAt: now,
      endedAt: null,
      reason: blockerReason || null,
      note: blockerNote || '',
    };
    workItem.intervals.push(blockedInterval);

    if (workItem.rounds && workItem.rounds.length > 0) {
      const curRound = workItem.rounds[workItem.rounds.length - 1];
      if (!curRound.intervals) curRound.intervals = [];
      curRound.intervals.push(blockedInterval);
    }
  } else if (fromStatus === 'Blocked') {
    // Clear blocker reason once unblocked and close open intervals
    workItem.blockerReason = null;
    workItem.blockerNote = '';
    if (Array.isArray(workItem.intervals)) {
      for (const iv of workItem.intervals) {
        if (!iv.endedAt) iv.endedAt = now;
      }
    }
    if (workItem.rounds && workItem.rounds.length > 0) {
      const curRound = workItem.rounds[workItem.rounds.length - 1];
      if (Array.isArray(curRound?.intervals)) {
        for (const iv of curRound.intervals) {
          if (!iv.endedAt) iv.endedAt = now;
        }
      }
    }
  }

  // A decision belongs to the round that was reviewed, not the new round started below.
  const roundBeingDecided = workItem.rounds?.length ? workItem.rounds[workItem.rounds.length - 1] : null;

  // 6. Starting work and round tracking
  if (toStatus === 'In Progress') {
    if (!workItem.startedAt) {
      workItem.startedAt = now;
    }
    // Close any lingering open interval
    if (Array.isArray(workItem.intervals)) {
      for (const iv of workItem.intervals) {
        if (!iv.endedAt) iv.endedAt = now;
      }
    }
    if (!workItem.rounds || workItem.rounds.length === 0) {
      workItem.rounds = [
        {
          roundNumber: 1,
          startedAt: workItem.startedAt || now,
          intervals: [],
        },
      ];
    } else {
      const curRound = workItem.rounds[workItem.rounds.length - 1];
      if (curRound && (curRound.decision || curRound.submittedAt)) {
        workItem.rounds.push({
          roundNumber: workItem.rounds.length + 1,
          startedAt: now,
          intervals: [],
        });
      } else if (curRound && Array.isArray(curRound.intervals)) {
        for (const iv of curRound.intervals) {
          if (!iv.endedAt) iv.endedAt = now;
        }
      }
    }
  }

  // 7. Revision Counter: increment on revision request or when restarting work after feedback & notify owner
  if (
    ((fromStatus === 'Feedback' || fromStatus === 'Pending') && toStatus === 'In Progress') ||
    (fromStatus === 'Pending' && toStatus === 'Feedback')
  ) {
    workItem.revisions = (workItem.revisions || 0) + 1;
    workItem.changesRequestedAt = now;
    workItem.decisionAt = now;
    if (roundBeingDecided) {
      if (!roundBeingDecided.decisionAt) roundBeingDecided.decisionAt = now;
      if (!roundBeingDecided.decision) roundBeingDecided.decision = 'changes_requested';
    }
    if (workItem.ownerId) {
      const { createNotification } = await import('../notifications/service.js');
      await createNotification({
        recipient: workItem.ownerId?._id || workItem.ownerId,
        type: 'revision_requested',
        title: 'Revision Requested on Stage Deliverable',
        message: `Creative Head requested a revision on ${workItem.title}. Note: ${comment || 'Please update and resubmit.'}`,
        link: `/my-work?id=${workItem._id}`,
        metadata: { workItemId: workItem._id, comment },
      });
    }
  }

  // 8. Deliverable / Published URLs update if provided
  if (deliverableUrl) {
    workItem.deliverableUrl = deliverableUrl.trim();
  }
  if (publishedUrl) {
    workItem.publishedUrl = publishedUrl.trim();
  }

  // 9. Submissions, Approvals and Publishing
  // A reviewer's decision or a reopen is not a submission, so it records no submit time.
  const isNewSubmission = (toStatus === 'Pending' || toStatus === 'Feedback') && !isReopen && !isReviewerRevision;
  if (isReopen && toStatus === 'Feedback') {
    // The reopened work is a new round; the next submit must not overwrite the decided one.
    if (!workItem.rounds) workItem.rounds = [];
    workItem.rounds.push({ roundNumber: workItem.rounds.length + 1, startedAt: now, intervals: [] });
  }
  if (isNewSubmission) {
    if (!workItem.submittedAt) {
      workItem.submittedAt = now;
    } else {
      workItem.resubmittedAt = now;
    }
    recordRoundSubmission(workItem, now);
  }

  if (toStatus === 'Approved') {
    workItem.approvedAt = now;
    workItem.decisionAt = now;
    if (Array.isArray(workItem.intervals)) {
      for (const iv of workItem.intervals) {
        if (!iv.endedAt) iv.endedAt = now;
      }
    }
    if (workItem.rounds && workItem.rounds.length > 0) {
      const curRound = workItem.rounds[workItem.rounds.length - 1];
      curRound.decisionAt = now;
      curRound.decision = 'approved';
      if (Array.isArray(curRound?.intervals)) {
        for (const iv of curRound.intervals) {
          if (!iv.endedAt) iv.endedAt = now;
        }
      }
    }
  }

  if (toStatus === 'Published') {
    workItem.postedAt = now;
    if (!workItem.approvedAt) workItem.approvedAt = now;
    if (Array.isArray(workItem.intervals)) {
      for (const iv of workItem.intervals) {
        if (!iv.endedAt) iv.endedAt = now;
      }
    }
    if (workItem.rounds && workItem.rounds.length > 0) {
      const curRound = workItem.rounds[workItem.rounds.length - 1];
      if (!curRound.decisionAt) curRound.decisionAt = now;
      if (!curRound.decision) curRound.decision = 'approved';
    }
  }

  workItem.status = toStatus;
  await workItem.save();

  // The status is saved. For a review decision, nothing after this point can fail it:
  // the decision stands, and a failure here is logged. A missed unlock is repaired by
  // reconcileContentPieceStageLocks the next time the step is opened.
  const afterStatusSaved = async () => {
  // A worker's submission must end up with a real version for the reviewer to decide.
  if (isNewSubmission && (workItem.contentPieceId || workItem.reviewRequired)) {
    try {
      const { Submission } = await import('../submissions/model.js');
      const latestSub = await Submission.findOne({
        workItemId: workItem._id,
        version: { $gt: 0 },
      }).sort({ version: -1 });
      // A reopened step never reuses a version from before its last decision.
      const lastDecision = Math.max(...[workItem.decisionAt, workItem.approvedAt, workItem.changesRequestedAt].filter(Boolean).map((d) => new Date(d).getTime()), 0);
      const stillAwaiting =
        latestSub?.status === 'submitted' && (!latestSub.submittedAt || new Date(latestSub.submittedAt).getTime() > lastDecision);
      if (!stillAwaiting) {
        const nextVersion = (latestSub?.version || 0) + 1;
        const kind =
          workItem.stageKey === 'Shoot' || workItem.stageKey === 'Edit' ? 'video' : 'document';
        const url = deliverableUrl || workItem.deliverableUrl || '';
        await Submission.create({
          workItemId: workItem._id,
          contentPieceId: workItem.contentPieceId || null,
          stageKey: workItem.stageKey,
          version: nextVersion,
          kind,
          linkUrl: url,
          notes: comment || '',
          files: url ? [{ name: 'deliverable', url }] : [],
          submittedById: userId,
          submittedAt: new Date(),
          status: 'submitted',
          versionToken: (await import('crypto')).randomUUID(),
        });
      }
    } catch (subErr) {
      // Non-blocking
    }
  }

  // 8. Scope Reset R3: Content Flow Hand-offs & Stage Unlocking
  if (workItem.contentPieceId) {
    const { ContentPiece } = await import('../calendar/contentPiece.model.js');
    const { createNotification } = await import('../notifications/service.js');

    // If stage approved / completed, unlock next unskipped stage
    if (toStatus === 'Approved' || toStatus === 'Published') {
      await unlockNextStage(workItem);
    }

    // If stage published, update parent ContentPiece & turnaround days
    if (toStatus === 'Published') {
      const piece = await ContentPiece.findById(workItem.contentPieceId);
      if (piece) {
        const now = new Date();
        piece.publishedAt = now;
        piece.liveUrl = workItem.publishedUrl || piece.liveUrl;

        const firstStage = await WorkItem.findOne({
          contentPieceId: piece._id,
        }).sort({ stageOrder: 1 });

        const startTimestamp = firstStage?.createdAt || piece.createdAt || now;
        const diffMs = now.getTime() - new Date(startTimestamp).getTime();
        const turnaroundDays = Math.max(0, Math.round(diffMs / (1000 * 3600 * 24)));

        piece.turnaroundDays = turnaroundDays;
        await piece.save();
      }
    }

    // If review requested (moved to Feedback or Pending), notify Creative Heads
    if (isNewSubmission) {
      const creativeHeads = await Person.find({ role: 'creative_head', status: 'active' });
      for (const ch of creativeHeads) {
        await createNotification({
          recipient: ch._id,
          type: 'approval_requested',
          title: 'Deliverable Review Requested',
          message: `${workItem.title} (${workItem.stageKey || 'Stage'}) submitted by ${user.name || 'Worker'} for approval.`,
          link: `/feedback?tab=stages&workItemId=${workItem._id}`,
          metadata: { workItemId: workItem._id, contentPieceId: workItem.contentPieceId },
        });
      }
    }
  }

  // 9. Emit immutable ActivityEvent
  await logActivity({
    entityType: 'work_item',
    entityId: workItem._id,
    actor: user,
    action: 'work_item.status_changed',
    fromStatus,
    toStatus,
    metadata: {
      title: workItem.title,
      blockerReason: workItem.blockerReason,
      blockerNote: workItem.blockerNote,
      deliverableUrl: workItem.deliverableUrl,
      publishedUrl: workItem.publishedUrl,
      revisions: workItem.revisions,
      comment,
    },
  });
  };

  if (options.reviewDecision) {
    try {
      await afterStatusSaved();
    } catch (error) {
      logger.error({ err: error?.message, workItemId: String(workItem._id) }, 'Review decision saved, but a follow-up step failed');
    }
  } else {
    await afterStatusSaved();
  }

  return WorkItem.findById(workItem._id)
    .populate('departmentId', 'name code')
    .populate('ownerId', 'name email role jobRole');
}

export async function unlockNextStage(workItem) {
  if (!workItem || !workItem.contentPieceId) return null;

  const nextStage = await WorkItem.findOne({
    contentPieceId: workItem.contentPieceId,
    stageOrder: { $gt: workItem.stageOrder },
    isSkipped: false,
  }).sort({ stageOrder: 1 });

  if (nextStage && nextStage.isLocked) {
    nextStage.isLocked = false;
    nextStage.unlockedAt = new Date();
    await nextStage.save();

    const { createNotification } = await import('../notifications/service.js');
    const { Person } = await import('../people/model.js');

    if (nextStage.ownerId) {
      await createNotification({
        recipient: nextStage.ownerId,
        type: 'stage_unlocked',
        title: 'Stage Unlocked',
        message: `Stage ${nextStage.stageKey} for "${workItem.title}" is now unlocked.`,
        link: `/my-work?id=${nextStage._id}`,
      });
    } else {
      const smManagers = await Person.find({ role: 'sm_manager', status: 'active' });
      for (const sm of smManagers) {
        await createNotification({
          recipient: sm._id,
          type: 'needs_owner',
          title: 'Stage Unlocked - Needs Owner',
          message: `Stage ${nextStage.stageKey} for "${workItem.title}" is unlocked and needs an owner.`,
          link: `/calendar?tab=tracker`,
        });
      }
    }
    return nextStage;
  }
  return null;
}

export async function reconcileContentPieceStageLocks(contentPieceId) {
  if (!contentPieceId) return;
  const stages = await WorkItem.find({ contentPieceId }).sort({ stageOrder: 1 });
  let precedingComplete = true;

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    if (i === 0) {
      if (stage.isLocked) {
        stage.isLocked = false;
        await stage.save();
      }
    } else {
      if (precedingComplete) {
        if (stage.isLocked) {
          stage.isLocked = false;
          stage.unlockedAt = stage.unlockedAt || new Date();
          await stage.save();
        }
      }
    }

    if (!stage.isSkipped) {
      if (stage.status !== 'Approved' && stage.status !== 'Published') {
        precedingComplete = false;
      }
    }
  }
}


