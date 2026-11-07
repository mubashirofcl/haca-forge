import mongoose from 'mongoose';
import { normalizeRole } from '@mmp/shared';
import { WorkItem } from './model.js';
import { Submission, SubmissionComment, Rating } from '../submissions/model.js';
import { MediaItem } from '../media/model.js';
import { Blocker } from '../blockers/model.js';

/**
 * Who can reach a work item, and what they see on it.
 *
 * A team_member reaches an item only as a participant: they own a step in its content
 * piece. Anyone else gets one identical 404, for an item that exists, one that does not,
 * and an invalid id, so a response never confirms that something exists. Other roles are
 * not affected here and keep their existing behaviour.
 *
 * These checks run after authentication (router.use(authenticate) comes first on every
 * router) and before validation, so a blocked user learns nothing from validation errors.
 */

export const isTeamMember = (user) => normalizeRole(user?.role) === 'team_member';
export const userIdOf = (user) => (user?._id || user?.id || user?.userId)?.toString();
const idOf = (value) => (value?._id || value)?.toString();
export const isFinished = (step) => step.status === 'Approved' || step.status === 'Published';

export function notFound() {
  const error = new Error('Not found');
  error.statusCode = 404;
  error.code = 'NOT_FOUND';
  return error;
}

function forbidden(message, code = 'FORBIDDEN_ACTION') {
  const error = new Error(message);
  error.statusCode = 403;
  error.code = code;
  return error;
}

/** Revision notes, rating feedback and clip threads: the step owner, admin, creative_head, sm_manager. */
export function canSeePrivateReview(user, workItem) {
  const role = normalizeRole(user?.role);
  if (role === 'admin' || role === 'creative_head' || role === 'sm_manager') return true;
  return Boolean(userIdOf(user) && idOf(workItem?.ownerId) === userIdOf(user));
}

/** The viewer's stake in a piece: which step they own furthest along it. */
export async function getParticipation(workItem, user) {
  const userId = userIdOf(user);
  const isOwner = Boolean(userId && idOf(workItem.ownerId) === userId);
  const owned = workItem.contentPieceId && userId
    ? await WorkItem.find({ contentPieceId: idOf(workItem.contentPieceId), ownerId: userId }).select('stageOrder').lean()
    : [];
  const orders = owned.map((s) => s.stageOrder || 0);
  return {
    userId,
    isOwner,
    isParticipant: isOwner || owned.length > 0,
    latestOwnedOrder: orders.length ? Math.max(...orders) : null,
  };
}

/** A participant sees their own step's outputs, and approved outputs from earlier steps only. */
export function canSeeStepOutput(step, participation) {
  if (idOf(step.ownerId) === participation.userId) return true;
  return participation.latestOwnedOrder !== null && (step.stageOrder || 0) < participation.latestOwnedOrder && isFinished(step);
}

/**
 * The version that is a finished step's approved output. Steps approved before versions
 * were marked have none marked, so their latest version stands in.
 */
export async function approvedOutputOf(step) {
  if (!isFinished(step)) return null;
  const approved = await Submission.findOne({ workItemId: step._id, version: { $gt: 0 }, status: 'approved' }).sort({ version: -1 });
  if (approved) return approved;
  const anyApproved = await Submission.exists({ workItemId: step._id, status: 'approved' });
  if (anyApproved) return null;
  return Submission.findOne({ workItemId: step._id, version: { $gt: 0 } }).sort({ version: -1 });
}

/** team_member only: the item and their participation, or the one identical 404. */
export async function requireParticipant(id, user) {
  if (!id || !mongoose.isValidObjectId(id)) throw notFound();
  const workItem = await WorkItem.findById(id).select('ownerId contentPieceId stageOrder status').lean();
  if (!workItem) throw notFound();
  const participation = await getParticipation(workItem, user);
  if (!participation.isParticipant) throw notFound();
  return { workItem, participation };
}

/** For routes that take the work item id in the body: runs before validation, like the others. */
export const requireBodyWorkItemAccess = async (req, _res, next) => {
  try {
    if (isTeamMember(req.user)) await requireParticipant(req.body?.workItemId, req.user);
    next();
  } catch (error) {
    next(error);
  }
};

/** The work item ids a team_member participates in. */
export async function participantWorkItemIds(user) {
  const userId = userIdOf(user);
  const owned = await WorkItem.find({ ownerId: userId }).select('_id contentPieceId').lean();
  const pieces = owned.map((s) => s.contentPieceId).filter(Boolean);
  const siblings = pieces.length ? await WorkItem.find({ contentPieceId: { $in: pieces } }).select('_id').lean() : [];
  return [...new Set([...owned, ...siblings].map((s) => String(s._id)))];
}

const guard = (check) => async (req, _res, next, value) => {
  try {
    if (isTeamMember(req.user)) await check(value, req.user);
    next();
  } catch (error) {
    next(error);
  }
};

// router.param callbacks: (req, res, next, value).
export const workItemParam = guard((id, user) => requireParticipant(id, user));

async function checkClip(id, user) {
  if (!mongoose.isValidObjectId(id)) throw notFound();
  const clip = await MediaItem.findById(id).select('stageItemId').lean();
  if (!clip) throw notFound();
  await requireParticipant(clip.stageItemId, user);
}
export const clipParam = guard(checkClip);

async function checkSubmission(id, user) {
  if (!mongoose.isValidObjectId(id)) throw notFound();
  const submission = await Submission.findById(id).select('workItemId').lean();
  if (!submission) throw notFound();
  await requireParticipant(submission.workItemId, user);
}

async function checkComment(id, user) {
  if (!mongoose.isValidObjectId(id)) throw notFound();
  const comment = await SubmissionComment.findById(id).select('workItemId submissionId').lean();
  if (!comment) throw notFound();
  if (comment.workItemId) {
    await requireParticipant(comment.workItemId, user);
  } else {
    await checkSubmission(comment.submissionId, user);
  }
}

async function checkRating(id, user) {
  if (!mongoose.isValidObjectId(id)) throw notFound();
  const rating = await Rating.findById(id).select('workerId').lean();
  if (!rating || String(rating.workerId) !== userIdOf(user)) throw notFound();
}

// Route middleware, for routers whose :id means different objects on different routes.
const onParamId = (check) => (req, _res, next) => guard(check)(req, _res, next, req.params.id);
export const requireSubmissionAccess = onParamId(checkSubmission);
export const requireCommentAccess = onParamId(checkComment);
export const requireRatingAccess = onParamId(checkRating);

/**
 * Resolving a blocker or reminding its dependency owner: the step owner, sm_manager or admin.
 * A team_member elsewhere on the piece gets 403; anyone else on the team gets the 404.
 */
export const requireBlockerAccess = async (req, _res, next) => {
  try {
    const role = normalizeRole(req.user?.role);
    if (role === 'admin' || role === 'sm_manager') return next();
    if (!isTeamMember(req.user)) throw forbidden('Only the step owner, an SM Manager or an Admin can act on this blocker');
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) throw notFound();
    const blocker = await Blocker.findById(id).select('workItemId').lean();
    if (!blocker) throw notFound();
    const { participation } = await requireParticipant(blocker.workItemId, req.user);
    if (!participation.isOwner) throw forbidden('Only the step owner, an SM Manager or an Admin can act on this blocker');
    return next();
  } catch (error) {
    return next(error);
  }
};

/** Holding the editor lock is editing: the step owner, or an admin. */
export async function assertCanHoldEditorLock(workItemId, user) {
  const workItem = await WorkItem.findById(workItemId).select('ownerId').lean();
  if (!workItem) throw notFound();
  if (normalizeRole(user?.role) === 'admin' || idOf(workItem.ownerId) === userIdOf(user)) return;
  throw forbidden('Only the step owner can hold the editor lock');
}
