import { Blocker } from './model.js';

/**
 * One blocker lifecycle for both ways a step gets blocked (the blockers API and a
 * transition to Blocked): a blocker record that remembers the status before, a paused
 * interval while blocked, and on resolution the record closed and the step returned to
 * that status.
 */

/** Statuses a step can return to when its blocker is resolved. */
export const RESUMABLE_STATUSES = ['Not Started', 'In Progress', 'Feedback', 'Pending'];

/** The status a resolved step goes back to: the one it had before it was blocked. */
export function statusAfterBlocker(blocker, requested) {
  if (requested && RESUMABLE_STATUSES.includes(requested)) return requested;
  if (blocker?.statusBefore && RESUMABLE_STATUSES.includes(blocker.statusBefore)) return blocker.statusBefore;
  return 'In Progress';
}

/** Start a blocked interval on the step (and its current round). */
export function openBlockedInterval(workItem, { reason = null, note = '' } = {}, now = new Date()) {
  const interval = { kind: 'blocked', startedAt: now, endedAt: null, reason, note };
  if (!Array.isArray(workItem.intervals)) workItem.intervals = [];
  if (!workItem.intervals.some((iv) => iv.kind === 'blocked' && !iv.endedAt)) workItem.intervals.push(interval);
  const round = workItem.rounds?.length ? workItem.rounds[workItem.rounds.length - 1] : null;
  if (round) {
    if (!Array.isArray(round.intervals)) round.intervals = [];
    if (!round.intervals.some((iv) => iv.kind === 'blocked' && !iv.endedAt)) round.intervals.push({ ...interval });
  }
}

/** End every open interval of these kinds on the step and its current round. */
export function closeIntervals(workItem, kinds, now = new Date()) {
  const close = (list) => {
    for (const iv of Array.isArray(list) ? list : []) {
      if (!iv.endedAt && kinds.includes(iv.kind)) iv.endedAt = now;
    }
  };
  close(workItem.intervals);
  const round = workItem.rounds?.length ? workItem.rounds[workItem.rounds.length - 1] : null;
  if (round) close(round.intervals);
}

/**
 * The active blocker record for a step that has just been blocked. Any earlier active
 * record is closed as replaced; the status before carries over from it when the step was
 * already blocked.
 */
export async function recordBlocker(workItem, { reason, notes = '', dependencyOwnerId = null, blockedById, statusBefore }) {
  const previous = await Blocker.findOne({ workItemId: workItem._id, status: 'Active' }).sort({ createdAt: -1 });
  const before = statusBefore === 'Blocked' ? previous?.statusBefore || null : statusBefore || null;
  await Blocker.updateMany(
    { workItemId: workItem._id, status: 'Active' },
    { $set: { status: 'Resolved', resolvedAt: new Date(), resolutionNotes: 'Replaced by new blocker' } }
  );
  return Blocker.create({
    workItemId: workItem._id,
    blockedById,
    reason,
    notes,
    dependencyOwnerId,
    status: 'Active',
    blockedAt: new Date(),
    statusBefore: before,
  });
}

/** Close the step's active blocker records (the step itself is updated by the caller). */
export async function resolveActiveBlockers(workItemId, resolvedById, resolutionNotes = '') {
  return Blocker.updateMany(
    { workItemId, status: 'Active' },
    { $set: { status: 'Resolved', resolvedAt: new Date(), resolvedById, resolutionNotes } }
  );
}
