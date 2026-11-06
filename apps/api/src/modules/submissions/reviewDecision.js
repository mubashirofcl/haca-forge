import { normalizeRole } from '@mmp/shared';
import { Submission, Rating } from './model.js';
import { MediaItem } from '../media/model.js';
import { logActivity } from '../activity/service.js';
import { createNotification } from '../notifications/service.js';
import { logger } from '../../lib/logger.js';

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
  if (decision === 'approve' && workItem.stageKey === 'Shoot') {
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
