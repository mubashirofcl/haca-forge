import mongoose from 'mongoose';
import { markAwaitingReview } from '../workItems/reviewState.js';
import {
  CANONICAL_REVISION_ROOT_CAUSES,
  formatDuration,
  hasTimeLabel,
  inProfilePeriod,
  isFinishedStepStatus,
  isFirstPassApproval,
  isFirstPassCandidate,
  istDateKey,
  istWeekKey,
  monthKeyInAppTz,
  normalizeRole,
  previousProfilePeriod,
  ratingAverage,
  resolveProfilePeriod,
  reviewQueueAge,
  reviewStats,
  reviewerStats,
  reworkTimeMs,
  workerOnTime,
} from '@mmp/shared';
import { Person } from '../people/model.js';
import { WorkItem } from '../workItems/model.js';
import { Submission, Rating } from '../submissions/model.js';
import { RevisionFlag } from '../feedback/model.js';
import { CalendarPlan } from '../calendar/plan.model.js';
import { ActivityEvent } from '../activity/model.js';
import { evaluateSteps } from '../workItems/timeLabels.js';
import { oneRatingPerStep } from '../submissions/ratingsPerStep.js';

/**
 * Profile KPIs (Phase 8). Read only. One person's own figures for a period (steps belong to
 * it by due date, IST), built on the Phase 7 shared helpers. No team averages, rankings or
 * comparisons with anyone else; the "last period" figures are the same person's.
 * No contact details are returned.
 */

const notFound = () => Object.assign(new Error('Profile not found'), { statusCode: 404, code: 'NOT_FOUND' });
const forbidden = (message) => Object.assign(new Error(message), { statusCode: 403, code: 'FORBIDDEN' });
const idOf = (u) => (u?._id || u?.id || u?.userId)?.toString();
const REPORT_ROLES = ['admin', 'creative_head', 'executive'];
const pct = (n, d) => (d ? Math.round((n / d) * 100) : null);

export const canDownloadProfileReport = (actor) => REPORT_ROLES.includes(normalizeRole(actor?.role));

/** Who sees the Creative Head review section: admin, executive, and the Creative Head on their own profile. */
const canSeeReviewSection = (actor, target) => {
  const role = normalizeRole(actor?.role);
  return role === 'admin' || role === 'executive' || idOf(actor) === String(target._id);
};

function assertProfileAccess(targetId, actor) {
  const role = normalizeRole(actor?.role);
  if (role === 'team_member' && idOf(actor) !== String(targetId)) throw notFound();
}

/** When a finished step was finished: approval (posting for Post), stored or from history. */
function finishedAt(step, fact) {
  if (!isFinishedStepStatus(step.status)) return null;
  if (step.stageKey === 'Post') return step.postedAt || fact?.history?.postedAt || fact?.firstSubmitted || null;
  return step.approvedAt || fact?.history?.approvedAt || fact?.firstSubmitted || null;
}

function lastMonths(count, now) {
  const key = monthKeyInAppTz(now);
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5, 7)) - 1;
  const out = [];
  for (let i = count - 1; i >= 0; i--) out.push(new Date(Date.UTC(y, m - i, 1)).toISOString().slice(0, 7));
  return out;
}

function weeksOf(period) {
  const out = [];
  let key = istWeekKey(`${period.from}T06:00:00Z`);
  const last = istWeekKey(`${period.to}T06:00:00Z`);
  while (key && key <= last) {
    out.push(key);
    key = new Date(Date.parse(`${key}T00:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10);
  }
  return out;
}

/** The headline figures for one set of steps (used for the period and the previous period). */
function headline(steps, facts, ratings) {
  const labelsOf = (s) => facts.get(String(s._id))?.labels || [];
  const finished = steps.filter((s) => isFinishedStepStatus(s.status));
  const onTime = workerOnTime(finished.map(labelsOf));
  const review = reviewStats(steps.map((s) => ({ ...s, changesRequested: facts.get(String(s._id))?.changesRequested })));
  const candidates = steps.filter(isFirstPassCandidate);
  const firstPass = candidates.filter((s) => isFirstPassApproval(s, { changesRequested: facts.get(String(s._id))?.changesRequested })).length;
  const rating = ratingAverage(steps.map((s) => ratings.get(String(s._id))?.score).filter((n) => typeof n === 'number'));
  return {
    assigned: steps.length,
    completed: finished.length,
    onTime: { rate: onTime.rate, onTime: onTime.onTime, total: onTime.total, delayedByEarlier: onTime.delayedByEarlier, delayedText: onTime.delayedText },
    late: { rate: onTime.lateRate, late: onTime.late, total: onTime.total, doneLateCount: onTime.doneLateCount },
    changesRequested: { rate: review.changesRequestedRate, withChangeRequest: review.withChangeRequest, reviewed: review.reviewed },
    rework: { rounds: review.reworkRounds, rate: review.reworkRate, reviewed: review.reviewed },
    firstPass: { label: 'Reviewed steps approved first time', rate: pct(firstPass, candidates.length), approvedFirstTime: firstPass, total: candidates.length },
    rating,
  };
}

async function workerFigures(allSteps, period, now) {
  const live = allSteps.filter((s) => !s.isSkipped);
  if (!live.length) return null;
  const facts = await evaluateSteps(live, { now });
  const ratings = await oneRatingPerStep(live.map((s) => s._id));
  const due = (s) => s.dueDate || s.deadline;
  const inPeriod = live.filter((s) => inProfilePeriod(due(s), period));
  const prevPeriod = previousProfilePeriod(period);
  const inPrev = live.filter((s) => inProfilePeriod(due(s), prevPeriod));
  const labelsOf = (s) => facts.get(String(s._id))?.labels || [];
  const open = live.filter((s) => !isFinishedStepStatus(s.status));

  // Elapsed work time, total and by step type, with the partial-history note.
  const timed = inPeriod.filter((s) => facts.get(String(s._id))?.elapsed);
  const fromHistory = timed.filter((s) => facts.get(String(s._id)).elapsed.fromHistory).length;
  const byType = {};
  for (const s of timed) byType[s.stageKey || 'Other'] = (byType[s.stageKey || 'Other'] || 0) + facts.get(String(s._id)).elapsed.ms;
  const totalMs = timed.reduce((n, s) => n + facts.get(String(s._id)).elapsed.ms, 0);

  // Monthly trend by finish date (last 6 IST months).
  const months = lastMonths(6, now);
  const finishedAll = live.filter((s) => isFinishedStepStatus(s.status)).map((s) => ({ s, at: finishedAt(s, facts.get(String(s._id))) }));
  const monthlyTrend = months.map((month) => {
    const done = finishedAll.filter((x) => x.at && monthKeyInAppTz(x.at) === month);
    const ot = workerOnTime(done.map((x) => labelsOf(x.s)));
    return { month, completed: done.length, onTimeRate: ot.rate };
  });

  const scores = inPeriod.map((s) => ratings.get(String(s._id))?.score).filter((n) => typeof n === 'number');
  const flags = inPeriod.length
    ? await RevisionFlag.find({ workItemId: { $in: inPeriod.map((s) => s._id) }, rootCause: { $nin: [null, ''] } }).select('rootCause').lean()
    : [];
  const countBy = (list, keyOf) => {
    const map = new Map();
    for (const item of list) map.set(keyOf(item), (map.get(keyOf(item)) || 0) + 1);
    return [...map.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => String(a.key).localeCompare(String(b.key)));
  };

  const current = headline(inPeriod, facts, ratings);
  const previous = headline(inPrev, facts, ratings);
  return {
    cards: {
      ...current,
      inProgress: open.filter((s) => ['In Progress', 'Feedback', 'Pending'].includes(s.status)).length,
      openOverdue: open.filter((s) => hasTimeLabel(labelsOf(s), 'overdue')).length,
      blocked: open.filter((s) => hasTimeLabel(labelsOf(s), 'blocked')).length,
      workTime: {
        label: 'Elapsed work time',
        totalMs,
        totalText: timed.length ? formatDuration(totalMs) : 'No data',
        byStepType: Object.entries(byType).map(([stepType, ms]) => ({ stepType, ms, text: formatDuration(ms) })).sort((a, b) => a.stepType.localeCompare(b.stepType)),
        steps: timed.length,
        fromHistory,
        partial: fromHistory > 0,
        note: fromHistory > 0 ? `${fromHistory} of ${timed.length} steps from history` : null,
      },
    },
    // The same person's figures for the period before (shown as plain "Last period" text).
    lastPeriod: {
      period: prevPeriod,
      completed: previous.completed,
      onTimeRate: previous.onTime.rate,
      lateRate: previous.late.rate,
      changesRequestedRate: previous.changesRequested.rate,
      reworkRate: previous.rework.rate,
      firstPassRate: previous.firstPass.rate,
      ratingText: previous.rating.text,
    },
    charts: {
      monthlyTrend,
      ratingDistribution: [1, 2, 3, 4, 5].map((score) => ({ score, count: scores.filter((n) => n === score).length })),
      rootCauses: CANONICAL_REVISION_ROOT_CAUSES.map((cause) => ({ cause, count: flags.filter((f) => f.rootCause === cause).length })),
      classifiedRevisions: flags.length,
      byStepType: countBy(inPeriod, (s) => s.stageKey || 'Other').map(({ key, count }) => ({ stepType: key, count })),
      byCalendar: countBy(inPeriod, (s) => s.calendar || s.contentPieceId?.calendar || 'sm').map(({ key, count }) => ({ calendar: key, count })),
    },
    steps: inPeriod
      .sort((a, b) => new Date(due(a) || 0) - new Date(due(b) || 0))
      .map((s) => {
        const f = facts.get(String(s._id)) || {};
        return {
          id: String(s._id),
          project: s.contentPieceId?.topic || s.title,
          stepType: s.stageKey || s.workType || 'Step',
          status: s.awaitingReview && s.status === 'Feedback' ? 'Pending' : s.status,
          dueDate: istDateKey(due(s)),
          firstSubmitted: f.firstSubmitted ? istDateKey(f.firstSubmitted) : null,
          firstSubmittedFromHistory: Boolean(f.firstSubmittedFromHistory),
          labels: (f.labels || []).map((l) => l.text),
          elapsedMs: f.elapsed ? f.elapsed.ms : null,
          elapsedFromHistory: Boolean(f.elapsed?.fromHistory),
          reworkMs: reworkTimeMs(s, now),
          rating: ratings.get(String(s._id))?.score ?? null,
        };
      }),
  };
}

async function reviewerFigures(personId, period, now) {
  const pid = new mongoose.Types.ObjectId(String(personId));
  const decisionsAll = await Submission.find({ reviewedById: pid, status: { $in: ['approved', 'changes_requested'] }, version: { $gt: 0 } })
    .select('status submittedAt reviewedAt workItemId')
    .lean();
  const decisions = decisionsAll.filter((d) => inProfilePeriod(d.reviewedAt, period));
  const stats = reviewerStats(decisions);

  // Approvals recorded only in the activity log (older direct approvals with no review record).
  const approvalEvents = await ActivityEvent.find({ actorId: pid, action: 'work_item.approved' }).select('entityId timestamp createdAt').lean();
  const inPeriodEvents = approvalEvents.filter((e) => inProfilePeriod(e.timestamp || e.createdAt, period));
  const withRecord = new Set(
    (await Submission.find({ workItemId: { $in: inPeriodEvents.map((e) => e.entityId).filter((id) => mongoose.isValidObjectId(id)) }, status: 'approved' }).select('workItemId').lean()).map((s) => String(s.workItemId))
  );
  const legacyApprovals = inPeriodEvents.filter((e) => !withRecord.has(String(e.entityId))).length;

  // The team review queue: review steps waiting for a decision, by their latest submission.
  const waitingSteps = (
    await markAwaitingReview(
      await WorkItem.find({ status: { $in: ['Feedback', 'Pending'] }, stageKey: { $ne: 'Post' }, isSkipped: { $ne: true } })
        .select('status revisions submittedAt resubmittedAt')
        .lean()
    )
  ).filter((s) => s.awaitingReview);
  const latestSubs = waitingSteps.length
    ? await Submission.aggregate([
        { $match: { workItemId: { $in: waitingSteps.map((s) => s._id) }, version: { $gt: 0 } } },
        { $group: { _id: '$workItemId', submittedAt: { $max: '$submittedAt' } } },
      ])
    : [];
  const latestOf = new Map(latestSubs.map((r) => [String(r._id), r.submittedAt]));
  const queue = reviewQueueAge(
    waitingSteps.map((s) => ({ submittedAt: latestOf.get(String(s._id)) || s.resubmittedAt || s.submittedAt })),
    now
  );

  const planApprovals = (await CalendarPlan.find({ approvedById: pid, approvedAt: { $ne: null } }).select('approvedAt').lean()).filter((p) =>
    inProfilePeriod(p.approvedAt, period)
  ).length;
  const ratingsGiven = (await Rating.find({ raterId: pid }).select('score createdAt').lean()).filter((r) => inProfilePeriod(r.createdAt, period));
  const classified = (await RevisionFlag.find({ classifiedBy: pid, rootCause: { $nin: [null, ''] } }).select('rootCause classifiedAt').lean()).filter((f) =>
    inProfilePeriod(f.classifiedAt, period)
  );

  return {
    cards: {
      reviews: stats.reviews,
      approvals: stats.approvals,
      changesRequested: stats.changesRequested,
      avgApprovalWait: { ms: stats.avgWaitMs, text: stats.avgWaitMs === null ? 'No data' : formatDuration(stats.avgWaitMs), basedOn: stats.waitBasedOn },
      queue: {
        label: 'Oldest item in the team review queue',
        waiting: queue.waiting,
        oldestMs: queue.oldestMs,
        text: queue.oldestMs === null ? 'Nothing waiting' : formatDuration(queue.oldestMs),
        oldestSince: queue.oldestSubmittedAt ? istDateKey(queue.oldestSubmittedAt) : null,
      },
      planApprovals,
      legacyApprovals,
      legacyNote: legacyApprovals ? `${legacyApprovals} earlier approvals have no review record and are not counted.` : null,
    },
    charts: {
      reviewsPerWeek: weeksOf(period).map((week) => ({ week, reviews: decisions.filter((d) => istWeekKey(d.reviewedAt) === week).length })),
      ratingsGiven: [1, 2, 3, 4, 5].map((score) => ({ score, count: ratingsGiven.filter((r) => r.score === score).length })),
      rootCausesUsed: CANONICAL_REVISION_ROOT_CAUSES.map((cause) => ({ cause, count: classified.filter((f) => f.rootCause === cause).length })),
    },
  };
}

/** GET /api/team/:id/kpis (and the report). */
export async function getProfileKpis(targetId, actor, query = {}, { withSteps = false } = {}) {
  if (!mongoose.isValidObjectId(targetId)) throw notFound();
  assertProfileAccess(targetId, actor);
  const person = await Person.findById(targetId).select('name preferredName role jobRole departmentId status avatarUrl').populate('departmentId', 'name').lean();
  if (!person) throw notFound();
  const now = new Date();
  const period = resolveProfilePeriod(query.period, { from: query.from, to: query.to, now });

  const steps = await WorkItem.find({ ownerId: person._id })
    .select('title workType stageKey stageOrder status isLocked isSkipped reviewRequired dueDate deadline unlockedAt startedAt submittedAt approvedAt postedAt revisions rounds intervals contentPieceId calendar blockerReason')
    .populate('contentPieceId', 'topic calendar')
    .lean();
  await markAwaitingReview(steps);
  const worker = await workerFigures(steps, period, now);
  if (worker && !withSteps) delete worker.steps;
  const isCreativeHead = normalizeRole(person.role) === 'creative_head';
  const creativeHead = isCreativeHead && canSeeReviewSection(actor, person) ? await reviewerFigures(person._id, period, now) : null;

  return {
    person: {
      _id: person._id,
      name: person.name,
      preferredName: person.preferredName || '',
      role: person.role,
      jobRole: person.jobRole || '',
      department: person.departmentId?.name || null,
      status: person.status,
    },
    period,
    worker,
    creativeHead,
    canDownload: canDownloadProfileReport(actor),
    note: 'For coaching only. These are this person\'s own figures; nothing is compared with anyone else.',
  };
}

/** GET /api/team/:id/report: the same figures plus the step list. admin, creative_head, executive only. */
export async function getProfileReport(targetId, actor, query = {}) {
  assertProfileAccess(targetId, actor);
  if (!canDownloadProfileReport(actor)) throw forbidden('Only admin, creative head and executive can download a profile report.');
  return getProfileKpis(targetId, actor, query, { withSteps: true });
}
