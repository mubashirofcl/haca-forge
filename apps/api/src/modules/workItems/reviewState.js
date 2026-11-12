import { stepReviewState } from '@mmp/shared';
import { WorkItem } from './model.js';
import { Submission, SubmissionComment } from '../submissions/model.js';
import { ActivityEvent } from '../activity/model.js';

/**
 * A step saved as 'Feedback' is either waiting on the reviewer (its latest version is still
 * 'submitted') or was sent back for changes (latest version 'changes_requested'). These
 * helpers tell the two apart from the latest version, so every screen and count can say
 * "Waiting for approval" or "Changes requested" correctly. Read only.
 */

const idOf = (value) => String(value?._id || value);

/** Latest real version status per step id, for the given step ids. */
export async function latestVersionStatuses(stepIds) {
  if (!stepIds.length) return new Map();
  const rows = await Submission.aggregate([
    { $match: { workItemId: { $in: stepIds }, version: { $gt: 0 } } },
    { $sort: { version: -1 } },
    { $group: { _id: '$workItemId', status: { $first: '$status' } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), row.status]));
}

/** The ids (strings) of the given steps that are waiting on a reviewer. */
export async function awaitingReviewIds(steps) {
  const list = (steps || []).filter(Boolean);
  const feedback = list.filter((s) => s.status === 'Feedback');
  const latest = await latestVersionStatuses(feedback.map((s) => s._id));
  const ids = new Set(list.filter((s) => s.status === 'Pending').map((s) => idOf(s)));
  for (const step of feedback) {
    if (stepReviewState('Feedback', latest.get(idOf(step)), step.revisions || 0) === 'awaiting_review') ids.add(idOf(step));
  }
  return ids;
}

/**
 * Marks each plain step that is waiting on a reviewer with `awaitingReview: true`, so lists
 * (tracker, plan grid, calendar, reports, profiles) show "Waiting for approval" for it and
 * "Changes requested" only for a step that was sent back. The saved status is not touched,
 * and nothing is written to the database.
 */
export async function markAwaitingReview(steps) {
  const list = (steps || []).filter(Boolean);
  if (!list.some((s) => s.status === 'Feedback' || s.status === 'Pending')) return steps;
  const awaiting = await awaitingReviewIds(list);
  for (const step of list) {
    if (awaiting.has(idOf(step))) step.awaitingReview = true;
  }
  return steps;
}

/** How many steps matching the filter are waiting on a reviewer. */
export async function countAwaitingReview(filter = {}) {
  const steps = await WorkItem.find({ ...filter, status: { $in: ['Feedback', 'Pending'] } })
    .select('_id status revisions')
    .lean();
  return (await awaitingReviewIds(steps)).size;
}

/**
 * The reviewer's message and notes on a version that was sent back, from the records every
 * revision path already writes: the revision event (Review Studio, Work Detail), the feedback
 * entry (Feedback page) or the status event (Shoot clip review). Null when not sent back.
 */
export async function revisionNoteFor(workItem, latestSubmission) {
  if (!latestSubmission || latestSubmission.status !== 'changes_requested') return null;
  const since = latestSubmission.submittedAt || new Date(0);
  const note = { text: '', reviewer: '', rootCause: null, createdAt: latestSubmission.reviewedAt || null, notes: [] };

  const event = await ActivityEvent.findOne({ entityId: { $in: [latestSubmission._id, String(latestSubmission._id)] }, action: 'submission.revision_requested' })
    .sort({ timestamp: -1 })
    .populate('actorId', 'name')
    .lean();
  if (event) {
    note.text = event.metadata?.comment || '';
    note.rootCause = event.metadata?.rootCause || null;
    note.reviewer = event.actorId?.name || '';
    note.createdAt = event.timestamp || event.createdAt || note.createdAt;
  }
  if (!note.text) {
    const { FeedbackEntry } = await import('../feedback/model.js');
    const entry = await FeedbackEntry.findOne({ workItemId: workItem._id, isResponse: false, createdAt: { $gte: since } })
      .sort({ createdAt: -1 })
      .populate('fromPersonId', 'name')
      .lean();
    if (entry) {
      note.text = entry.text || '';
      note.reviewer = entry.fromPersonId?.name || note.reviewer;
      note.createdAt = entry.createdAt;
    }
  }
  if (!note.text) {
    const statusEvent = await ActivityEvent.findOne({
      entityId: { $in: [workItem._id, String(workItem._id)] },
      action: 'work_item.status_changed',
      toStatus: 'Feedback',
      timestamp: { $gte: since },
    })
      .sort({ timestamp: -1 })
      .populate('actorId', 'name')
      .lean();
    if (statusEvent?.metadata?.comment) {
      note.text = statusEvent.metadata.comment;
      note.reviewer = statusEvent.actorId?.name || note.reviewer;
    }
  }
  if (!note.reviewer && latestSubmission.reviewedById) {
    const { Person } = await import('../people/model.js');
    const reviewer = await Person.findById(latestSubmission.reviewedById?._id || latestSubmission.reviewedById).select('name').lean();
    note.reviewer = reviewer?.name || '';
  }

  // The reviewer's comments on that version, other than the message itself.
  const comments = await SubmissionComment.find({ submissionId: latestSubmission._id, parentId: null })
    .sort({ createdAt: 1 })
    .limit(30)
    .populate('authorId', 'name')
    .lean();
  const ownerId = idOf(workItem.ownerId);
  note.notes = comments
    .filter((c) => c.text && c.text.trim() !== note.text.trim() && idOf(c.authorId) !== ownerId)
    .map((c) => ({ text: c.text, author: c.authorId?.name || '' }));
  return note;
}
