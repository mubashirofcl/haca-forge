import { ActivityEvent } from '../activity/model.js';
import { Submission } from '../submissions/model.js';

/**
 * Recorded moments of steps from the activity log and submissions (Phase 7). Read only: used
 * to fill older steps whose timing fields were never saved. Nothing is written back.
 *   startedAt         first move to In Progress
 *   firstSubmittedAt  first submission (a Post step: first move to Published)
 *   approvedAt        last move to Approved, else the last approved submission's review
 *   postedAt          last move to Published
 *   changesRequested  any submission sent back for changes
 */
export async function loadStepHistory(steps) {
  const map = new Map();
  const ids = (steps || []).map((s) => s._id);
  if (!ids.length) return map;
  const [events, submissions] = await Promise.all([
    ActivityEvent.find({
      entityType: 'work_item',
      entityId: { $in: [...ids, ...ids.map(String)] },
      toStatus: { $in: ['In Progress', 'Feedback', 'Pending', 'Approved', 'Published'] },
    })
      .select('entityId toStatus timestamp createdAt')
      .lean(),
    Submission.find({ workItemId: { $in: ids }, version: { $gt: 0 } })
      .select('workItemId status submittedAt reviewedAt version')
      .lean(),
  ]);

  const byStep = new Map();
  for (const e of events) {
    const key = String(e.entityId);
    if (!byStep.has(key)) byStep.set(key, { events: [], subs: [] });
    byStep.get(key).events.push({ to: e.toStatus, at: e.timestamp || e.createdAt });
  }
  for (const s of submissions) {
    const key = String(s.workItemId);
    if (!byStep.has(key)) byStep.set(key, { events: [], subs: [] });
    byStep.get(key).subs.push(s);
  }

  const asc = (a, b) => new Date(a) - new Date(b);
  for (const step of steps) {
    const id = String(step._id);
    const found = byStep.get(id) || { events: [], subs: [] };
    const times = (to) => found.events.filter((e) => e.to === to && e.at).map((e) => e.at).sort(asc);
    const submitted = found.subs.filter((s) => s.submittedAt).sort((a, b) => asc(a.submittedAt, b.submittedAt));
    const reviewEvents = [...times('Feedback'), ...times('Pending')].sort(asc);
    map.set(id, {
      startedAt: times('In Progress')[0] || null,
      firstSubmittedAt:
        step.stageKey === 'Post' ? times('Published')[0] || null : submitted[0]?.submittedAt || reviewEvents[0] || null,
      approvedAt:
        times('Approved').at(-1) ||
        submitted.filter((s) => s.status === 'approved' && s.reviewedAt).map((s) => s.reviewedAt).sort(asc).at(-1) ||
        null,
      postedAt: times('Published').at(-1) || null,
      changesRequested: found.subs.some((s) => s.status === 'changes_requested'),
    });
  }
  return map;
}
