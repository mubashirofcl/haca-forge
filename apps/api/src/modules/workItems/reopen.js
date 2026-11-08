import { REVIEW_STAGES, normalizeRole } from '@mmp/shared';
import { WorkItem } from './model.js';
import { isFinished } from './access.js';
import { isHandoverStep } from './handoff.js';

/**
 * Reopening a finished review step (Phase 6). Later steps that are not finished pause:
 * they are locked, keep their exact status, start date and rounds, and their work time
 * stops (a "paused" interval, subtracted like a blocked one). A step paused by several
 * reopened steps resumes only when every one of them is approved again.
 */

const ACTIVE_STATUSES = ['In Progress', 'Feedback', 'Pending', 'Blocked'];

function fail(statusCode, code, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

/** The deliverable has gone out: its Post step is posted, or a non-postable design is handed over. */
export function isDelivered(steps, workType) {
  return (steps || []).some(
    (s) => (s.stageKey === 'Post' && s.status === 'Published') || (isHandoverStep({ ...s, workType: s.workType || workType }) && isFinished(s))
  );
}

const isReviewStep = (step) => step.reviewRequired !== false && REVIEW_STAGES.includes(step.stageKey);

/** Checked before anything is written. */
export async function assertCanReopen(workItem) {
  if (!isReviewStep(workItem)) {
    throw fail(400, 'REOPEN_NOT_REVIEW_STEP', 'Only a finished review step can be reopened.');
  }
  if (workItem.contentPieceId) {
    const steps = await WorkItem.find({ contentPieceId: workItem.contentPieceId }).select('stageKey status workType isSkipped').lean();
    if (isDelivered(steps, workItem.workType)) {
      throw fail(409, 'DELIVERABLE_DELIVERED', 'This deliverable has been posted or handed over, so its steps can no longer be reopened.');
    }
  }
}

/** For Work Detail: may this user reopen this step now? */
export function canReopen(user, item, siblingStages) {
  const role = normalizeRole(user?.role);
  if (role !== 'creative_head' && role !== 'admin') return false;
  const userId = String(user?._id || user?.id || user?.userId || '');
  const ownerId = String(item.ownerId?._id || item.ownerId || '');
  if (userId && userId === ownerId) return false;
  if (item.status !== 'Approved' || !isReviewStep(item)) return false;
  return !isDelivered(siblingStages || [], item.workType);
}

/** A step that may not be worked on or decided while an earlier step is being redone. */
export const isPaused = (step) => Array.isArray(step?.pausedBy) && step.pausedBy.length > 0;

export function assertNotPaused(step) {
  if (isPaused(step)) {
    throw fail(409, 'STEP_PAUSED', 'This step is paused while an earlier step is being redone. It resumes when that step is approved again.');
  }
}

function addPausedInterval(step, now) {
  const interval = { kind: 'paused', startedAt: now, endedAt: null };
  if (!Array.isArray(step.intervals)) step.intervals = [];
  if (!step.intervals.some((iv) => iv.kind === 'paused' && !iv.endedAt)) step.intervals.push(interval);
  const round = step.rounds?.length ? step.rounds[step.rounds.length - 1] : null;
  if (round) {
    if (!Array.isArray(round.intervals)) round.intervals = [];
    if (!round.intervals.some((iv) => iv.kind === 'paused' && !iv.endedAt)) round.intervals.push({ ...interval });
  }
}

function closePausedIntervals(step, now) {
  const close = (list) => (Array.isArray(list) ? list : []).forEach((iv) => { if (iv.kind === 'paused' && !iv.endedAt) iv.endedAt = now; });
  close(step.intervals);
  const round = step.rounds?.length ? step.rounds[step.rounds.length - 1] : null;
  if (round) close(round.intervals);
}

async function notify(step, type, title, message) {
  if (!step.ownerId) return;
  const { createNotification } = await import('../notifications/service.js');
  await createNotification({ recipient: step.ownerId, type, title, message, link: `/work/${step._id}`, metadata: { workItemId: step._id } });
}

/** After a reopen is saved: pause every unfinished later step. */
export async function pauseLaterSteps(reopened) {
  if (!reopened.contentPieceId) return [];
  const now = new Date();
  const later = await WorkItem.find({
    contentPieceId: reopened.contentPieceId,
    stageOrder: { $gt: reopened.stageOrder || 0 },
    isSkipped: { $ne: true },
    status: { $nin: ['Approved', 'Published'] },
  });
  for (const step of later) {
    const already = (step.pausedBy || []).some((id) => String(id) === String(reopened._id));
    if (already) continue;
    const firstPause = !isPaused(step);
    step.pausedBy = [...(step.pausedBy || []), reopened._id];
    step.isLocked = true;
    if (firstPause && step.startedAt && ACTIVE_STATUSES.includes(step.status)) addPausedInterval(step, now);
    await step.save();
    if (firstPause) {
      await notify(step, 'step_paused', 'Step paused', `"${step.title}" is paused while the ${reopened.stageKey} step is being redone.`);
    }
  }
  return later;
}

/** After a step is approved: resume the steps it paused, once nothing else holds them. */
export async function resumePausedSteps(approved) {
  if (!approved.contentPieceId) return [];
  const now = new Date();
  const held = await WorkItem.find({ contentPieceId: approved.contentPieceId, pausedBy: approved._id });
  const resumed = [];
  for (const step of held) {
    step.pausedBy = (step.pausedBy || []).filter((id) => String(id) !== String(approved._id));
    if (!isPaused(step)) {
      // Back exactly as it was: same status, start date and rounds; only the pause ends.
      closePausedIntervals(step, now);
      resumed.push(step);
    }
    await step.save();
  }
  if (held.length) {
    const { reconcileContentPieceStageLocks } = await import('./transition.service.js');
    await reconcileContentPieceStageLocks(approved.contentPieceId);
  }
  for (const step of resumed) {
    await notify(step, 'step_resumed', 'Step resumed', `"${step.title}" can continue: the ${approved.stageKey} step is approved again.`);
  }
  return resumed;
}
