import {
  firstSubmittedAt,
  isFinishedStepStatus,
  stepElapsedWork,
  stepTimeLabels,
} from '@mmp/shared';
import { Blocker } from '../blockers/model.js';
import { ContentPiece } from '../calendar/contentPiece.model.js';
import { loadStepHistory } from './history.js';

/**
 * Computed time facts for steps (Phase 7), the same for reports, lists and profiles:
 * labels from @mmp/shared, the first submission (stored, else from history), elapsed work
 * time (submitted rounds, else history marked partial), and the active blocker. Read only.
 */
export async function evaluateSteps(steps, { now = new Date(), withElapsed = true } = {}) {
  const result = new Map();
  const list = (steps || []).filter(Boolean);
  if (!list.length) return result;
  const ids = list.map((s) => s._id);

  const [history, blockers] = await Promise.all([
    loadStepHistory(list),
    Blocker.find({ workItemId: { $in: ids }, status: 'Active' }).select('workItemId blockedAt createdAt reason').lean(),
  ]);
  // A posted Post step saved before posting times were recorded: its piece's published time.
  const postNeedsPiece = list.filter(
    (s) => s.stageKey === 'Post' && s.status === 'Published' && !s.postedAt && s.contentPieceId &&
      !history.get(String(s._id))?.firstSubmittedAt && !history.get(String(s._id))?.postedAt
  );
  const publishedAt = new Map();
  if (postNeedsPiece.length) {
    const pieces = await ContentPiece.find({ _id: { $in: postNeedsPiece.map((s) => s.contentPieceId?._id || s.contentPieceId) } })
      .select('publishedAt')
      .lean();
    for (const p of pieces) if (p.publishedAt) publishedAt.set(String(p._id), p.publishedAt);
  }

  const activeBlocker = new Map();
  for (const b of blockers) {
    const key = String(b.workItemId);
    const since = b.blockedAt || b.createdAt;
    const prev = activeBlocker.get(key);
    if (!prev || new Date(since) < new Date(prev.since)) activeBlocker.set(key, { since, reason: b.reason || '' });
  }

  for (const step of list) {
    const id = String(step._id);
    const h = history.get(id) || {};
    const stored = firstSubmittedAt(step);
    const finished = isFinishedStepStatus(step.status);
    const filled = !stored && finished
      ? step.stageKey === 'Post'
        ? h.firstSubmittedAt || h.postedAt || publishedAt.get(String(step.contentPieceId?._id || step.contentPieceId)) || null
        : h.firstSubmittedAt
      : null;
    const first = stored || filled || null;
    let blocker = activeBlocker.get(id) || null;
    if (!blocker && step.status === 'Blocked') {
      // A step blocked before blocker records existed: its open blocked interval.
      const open = (step.intervals || []).filter((iv) => iv && iv.kind === 'blocked' && !iv.endedAt).at(-1);
      if (open?.startedAt) blocker = { since: open.startedAt, reason: step.blockerReason || '' };
    }
    const labels = stepTimeLabels(step, { now, blockedSince: blocker?.since, firstSubmitted: first || undefined });
    const elapsed = withElapsed
      ? stepElapsedWork(step, { startedAt: step.startedAt || h.startedAt, firstSubmittedAt: first })
      : null;
    result.set(id, {
      labels,
      firstSubmitted: first,
      firstSubmittedFromHistory: Boolean(filled),
      elapsed,
      blocker,
      changesRequested: Boolean(h.changesRequested),
      history: h,
    });
  }
  return result;
}

/** Adds `timeLabels` to each plain step object (in place) and returns the list. */
export async function attachTimeLabels(items, opts = {}) {
  const list = (items || []).filter((it) => it && it._id);
  const facts = await evaluateSteps(list, { ...opts, withElapsed: false });
  for (const item of list) item.timeLabels = facts.get(String(item._id))?.labels || [];
  return items;
}
