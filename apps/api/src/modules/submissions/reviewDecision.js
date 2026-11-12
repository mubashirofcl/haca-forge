import { normalizeRole } from '@mmp/shared';
import { Submission, Rating } from './model.js';
import { MediaItem } from '../media/model.js';
import { logActivity } from '../activity/service.js';
import { createNotification } from '../notifications/service.js';
import { logger } from '../../lib/logger.js';
import { assertNotPaused } from '../workItems/reopen.js';

/**
 * The one set of rules for a review decision: approve, request revision, shoot review
 * and Feedback "Revision Required" all go through here before they write anything.
 *
 * MongoDB runs standalone here, so multi-document transactions are not available.
 * Partial writes are prevented by:
 * 1. Checking everything before the first write.
 * 2. Claiming the submission with one atomic update that only matches while it is
 *    still `submitted`, so only one request can ever decide a version.
 * 3. Undoing the claim and anything written after it if a later required write fails.
 * The decision is complete once the step is saved. Events and notifications run after
 * that and cannot fail it. A process crash between writes is not covered.
 */

const AWAITING_STATUSES = ['Pending', 'Feedback'];

export const STALE_DECISION_CODES = ['STALE_SUBMISSION', 'ALREADY_DECIDED', 'STEP_NOT_AWAITING_REVIEW', 'NO_SUBMISSION'];

function decisionError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

const idOf = (value) => (value?._id || value)?.toString();

/** Latest moment this step was decided, or null. */
function lastDecisionAt(workItem) {
  const times = [workItem.decisionAt, workItem.approvedAt, workItem.changesRequestedAt].filter(Boolean).map((t) => new Date(t).getTime());
  return times.length ? Math.max(...times) : null;
}

/** True when this submission is waiting on a reviewer: submitted, and sent after the step's last decision. */
export function isAwaitingDecision(workItem, submission) {
  if (!workItem || !submission) return false;
  if (!AWAITING_STATUSES.includes(workItem.status)) return false;
  if (submission.version <= 0 || submission.status !== 'submitted') return false;
  const decided = lastDecisionAt(workItem);
  return !decided || !submission.submittedAt || new Date(submission.submittedAt).getTime() > decided;
}

/**
 * An owner cannot take a step out of review while its latest version waits on a reviewer:
 * not by pulling it back, marking it blocked, or any other move. Writes nothing.
 */
export async function assertOwnerCanLeaveReview(workItem) {
  if (!workItem.reviewRequired || !AWAITING_STATUSES.includes(workItem.status)) return;
  const latest = await latestRealSubmission(workItem._id);
  if (isAwaitingDecision(workItem, latest)) {
    throw decisionError(409, 'SUBMISSION_AWAITING_REVIEW', 'This step is waiting for review, so it cannot be changed until a reviewer has decided.');
  }
}

/**
 * The one end state of "changes requested", whichever screen asked for it: the step waits in
 * 'Feedback' with its latest version changes_requested, one revision counted, the reviewed
 * round decided, and no round running. The next round starts when the owner clicks Start rework.
 * The caller saves the step.
 */
export function applyChangesRequested(workItem, decidedAt = new Date()) {
  workItem.status = 'Feedback';
  workItem.revisions = (workItem.revisions || 0) + 1;
  workItem.changesRequestedAt = decidedAt;
  workItem.decisionAt = decidedAt;
  if (workItem.rounds && workItem.rounds.length > 0) {
    const curRound = workItem.rounds[workItem.rounds.length - 1];
    curRound.decisionAt = decidedAt;
    curRound.decision = 'changes_requested';
  }
}

/** True when the step was sent back and the owner has not started the rework yet. */
export function isChangesRequested(workItem, latestSubmission) {
  return workItem?.status === 'Feedback' && latestSubmission?.status === 'changes_requested';
}

/** A sent-back step is resubmitted only after Start rework, so its rework round has a real start. */
export function assertReworkStarted(workItem, latestSubmission) {
  if (isChangesRequested(workItem, latestSubmission)) {
    throw decisionError(409, 'REWORK_NOT_STARTED', 'Changes were requested on this step. Click Start rework before you resubmit.');
  }
}

/** creative_head and admin decide; nobody decides on their own work. */
export function assertReviewer(user, workItem, decision = 'approve') {
  const role = normalizeRole(user.role);
  if (role !== 'creative_head' && role !== 'admin') {
    throw decisionError(
      403,
      decision === 'approve' ? 'FORBIDDEN_APPROVAL' : 'FORBIDDEN_ACTION',
      decision === 'approve' ? 'Only Creative Head or Admin can approve deliverables' : 'Only Creative Head or Admin can request revisions'
    );
  }
  const userId = (user._id || user.id || user.userId)?.toString();
  if (userId && idOf(workItem.ownerId) === userId) {
    throw decisionError(403, 'FORBIDDEN_SELF_APPROVAL', 'You cannot review your own work');
  }
}

export function assertValidRating(score) {
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    throw decisionError(400, 'RATING_REQUIRED', 'A quality rating score between 1 and 5 is strictly required on approval');
  }
}

export const latestRealSubmission = (workItemId) =>
  Submission.findOne({ workItemId, version: { $gt: 0 } }).sort({ version: -1 });

/**
 * Does clip review apply to this version? Only on a Shoot step that has clips, and never
 * for a version submitted with links (kind 'link'): that one is reviewed like any other step.
 */
export async function clipReviewApplies(workItem, submission) {
  if (workItem?.stageKey !== 'Shoot' || submission?.kind === 'link') return false;
  return (await MediaItem.countDocuments({ stageItemId: workItem._id })) > 0;
}

/**
 * Clip state for a Shoot step. A clip replaced by a newer one no longer counts;
 * every other clip is required.
 */
export async function getRequiredClips(workItemId) {
  const allClips = await MediaItem.find({ stageItemId: workItemId });
  const replacedIds = new Set(allClips.filter((c) => c.replacesId).map((c) => c.replacesId.toString()));
  const required = allClips.filter((c) => !replacedIds.has(c._id.toString()));
  return {
    required,
    flagged: required.filter((c) => c.status === 'reshoot_needed'),
    undecided: required.filter((c) => c.status !== 'approved' && c.status !== 'reshoot_needed'),
  };
}

/**
 * The shared check. Writes nothing. Returns the latest submission when a decision is allowed.
 * Pass submissionId to require that exact version to be the latest.
 */
export async function assertDecisionAllowed({ user, workItem, submissionId = null, decision = 'approve' }) {
  assertReviewer(user, workItem, decision);
  // Paused while an earlier step is redone: no decision until it resumes.
  assertNotPaused(workItem);

  if (['Approved', 'Published'].includes(workItem.status)) {
    throw decisionError(409, 'ALREADY_DECIDED', 'This step has already been approved. No further decision is needed.');
  }
  if (!AWAITING_STATUSES.includes(workItem.status)) {
    throw decisionError(409, 'STEP_NOT_AWAITING_REVIEW', 'This step is not waiting for review.');
  }

  const latest = await latestRealSubmission(workItem._id);
  if (!latest) {
    throw decisionError(409, 'NO_SUBMISSION', 'This step has no submission to review yet.');
  }
  if (submissionId && latest._id.toString() !== submissionId.toString()) {
    throw decisionError(409, 'STALE_SUBMISSION', `This version is out of date. Version ${latest.version} is the latest.`);
  }
  if (!isAwaitingDecision(workItem, latest)) {
    throw decisionError(409, 'ALREADY_DECIDED', 'This version has already been decided.');
  }
  // The clip rule is for versions that contain clips. A Shoot submitted with a link is
  // reviewed like any other step.
  if (decision === 'approve' && (await clipReviewApplies(workItem, latest))) {
    const { required, flagged, undecided } = await getRequiredClips(workItem._id);
    if (required.length === 0 || flagged.length > 0 || undecided.length > 0) {
      throw decisionError(400, 'CLIPS_WAITING_REVIEW', 'Every clip must be approved before this Shoot step can be approved.');
    }
  }
  return latest;
}

/** Atomic: only one request can move a version out of `submitted`. */
export async function claimSubmission(submission, toStatus, user) {
  const userId = (user._id || user.id || user.userId)?.toString();
  const claimed = await Submission.findOneAndUpdate(
    { _id: submission._id, status: 'submitted' },
    { $set: { status: toStatus, reviewedById: userId, reviewedAt: new Date() } },
    { new: true }
  );
  if (!claimed) {
    throw decisionError(409, 'ALREADY_DECIDED', 'This version has already been decided.');
  }
  // A newer version may have arrived between the check and the claim.
  const latest = await latestRealSubmission(submission.workItemId);
  if (latest && latest._id.toString() !== submission._id.toString()) {
    await releaseSubmission(submission);
    throw decisionError(409, 'STALE_SUBMISSION', `This version is out of date. Version ${latest.version} is the latest.`);
  }
  return claimed;
}

/** Undo a claim, restoring the review fields it replaced. */
export async function releaseSubmission(original) {
  await Submission.updateOne(
    { _id: original._id },
    { $set: { status: 'submitted', reviewedById: original.reviewedById ?? null, reviewedAt: original.reviewedAt ?? null } }
  );
}

/** Work done after the decision is saved. It must not fail a decision that is already complete. */
export async function afterDecision(label, work) {
  try {
    await work();
  } catch (error) {
    logger.error({ err: error?.message }, `Review decision saved, but ${label} failed`);
  }
}

/**
 * Approve the step on its latest submission with a rating: the single approval path.
 * Call assertDecisionAllowed and assertValidRating first.
 */
export async function approveSubmission({ submission, workItem, score, feedback = '', tags = [], user }) {
  const userId = (user._id || user.id || user.userId)?.toString();
  const ownerId = idOf(workItem.ownerId);
  const claimed = await claimSubmission(submission, 'approved', user);

  let rating;
  try {
    rating = await Rating.create({
      submissionId: submission._id,
      workItemId: workItem._id,
      contentPieceId: workItem.contentPieceId || null,
      stageKey: workItem.stageKey,
      workerId: ownerId,
      raterId: userId,
      score,
      feedback: (feedback || '').trim(),
      tags: tags || [],
    });
  } catch (error) {
    await releaseSubmission(submission);
    if (error?.code === 11000) {
      throw decisionError(409, 'ALREADY_DECIDED', 'This version has already been rated.');
    }
    throw error;
  }

  let updatedWorkItem;
  try {
    const { transitionWorkItem } = await import('../workItems/transition.service.js');
    updatedWorkItem = await transitionWorkItem(workItem._id, { toStatus: 'Approved', comment: feedback }, user, { reviewDecision: true });
  } catch (error) {
    await Rating.deleteOne({ _id: rating._id });
    await releaseSubmission(submission);
    throw error;
  }

  await afterDecision('the approval events', async () => {
    await logActivity({
      entityType: 'submission',
      entityId: submission._id,
      actor: user,
      action: 'submission.approved',
      toStatus: 'approved',
      metadata: { workItemId: workItem._id, version: submission.version, score },
    });
    await logActivity({
      entityType: 'rating',
      entityId: rating._id,
      actor: user,
      action: 'rating.given',
      metadata: { submissionId: submission._id, workerId: ownerId, score, tags },
    });
  });
  if (ownerId) {
    await afterDecision('the approval notification', () =>
      createNotification({
        recipient: ownerId,
        type: 'submission_approved',
        title: 'Stage Approved with Rating',
        message: `Your ${workItem.stageKey} for "${workItem.title}" was approved with a ${score}★ rating.`,
        link: `/my-work?id=${workItem._id}`,
        metadata: { workItemId: workItem._id, ratingId: rating._id, score },
      })
    );
  }

  return { submission: claimed, rating, workItem: updatedWorkItem };
}
