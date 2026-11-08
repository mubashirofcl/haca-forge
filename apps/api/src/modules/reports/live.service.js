import mongoose from 'mongoose';
import {
  CALENDAR_KEYS,
  CANONICAL_REVISION_ROOT_CAUSES,
  STAGE_KEYS,
  getCalendarDefinition,
  hasTimeLabel,
  isFinishedStepStatus,
  isFirstPassApproval,
  isFirstPassCandidate,
  isMonthKey,
  istDateKey,
  istWeekKey,
  monthKeyInAppTz,
  monthPeriod,
  projectDelivery,
  projectTimeLabel,
  ratingAverage,
} from '@mmp/shared';
import { ContentPiece } from '../calendar/contentPiece.model.js';
import { WorkItem } from '../workItems/model.js';
import { Rating, Submission } from '../submissions/model.js';
import { RevisionFlag } from '../feedback/model.js';
import { evaluateSteps } from '../workItems/timeLabels.js';

/**
 * Live reports (Phase 7). Every figure is computed on request from stored records, with the
 * shared label and KPI rules. Team-level only: owner names appear on list rows, but nothing
 * is grouped, counted or sorted by person. The month filter is by the piece's publish date
 * (IST), and everything follows it, including the step lists.
 */

const DAY = 86400000;

export function parseReportFilters(query = {}) {
  const month = isMonthKey(query.month) ? query.month : monthKeyInAppTz(new Date());
  const calendar = CALENDAR_KEYS.includes(query.calendar) ? query.calendar : 'all';
  const stepType = STAGE_KEYS.includes(query.stepType) ? query.stepType : 'all';
  return { month, calendar, stepType };
}

const calendarOf = (piece) => piece.calendar || 'sm';
const calendarName = (key) => getCalendarDefinition(key)?.name || key;
const ownerName = (step) => (step.ownerId && typeof step.ownerId === 'object' ? step.ownerId.name || null : null);
const iso = (d) => (d ? new Date(d).toISOString() : null);

/** One rating per step: the one on its latest approved submission, else its latest rating. */
async function oneRatingPerStep(stepIds) {
  const result = new Map();
  if (!stepIds.length) return result;
  const [approved, ratings] = await Promise.all([
    Submission.find({ workItemId: { $in: stepIds }, status: 'approved', version: { $gt: 0 } }).select('workItemId version').lean(),
    Rating.find({ workItemId: { $in: stepIds } }).select('workItemId submissionId score createdAt').lean(),
  ]);
  const latestApproved = new Map();
  for (const s of approved) {
    const key = String(s.workItemId);
    if (!latestApproved.has(key) || s.version > latestApproved.get(key).version) latestApproved.set(key, s);
  }
  const byStep = new Map();
  for (const r of ratings) {
    const key = String(r.workItemId);
    if (!byStep.has(key)) byStep.set(key, []);
    byStep.get(key).push(r);
  }
  for (const [key, list] of byStep) {
    const target = latestApproved.get(key);
    const onApproved = target ? list.find((r) => String(r.submissionId) === String(target._id)) : null;
    const latest = [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    const chosen = onApproved || latest;
    if (chosen && typeof chosen.score === 'number') result.set(key, chosen.score);
  }
  return result;
}

/** Pieces, steps and every computed fact the reports need. */
async function loadPieces(pieceFilter, { now }) {
  const pieces = await ContentPiece.find(pieceFilter).select('topic contentType calendar postingDate publishedAt hasPostStage planId').lean();
  const pieceIds = pieces.map((p) => p._id);
  const steps = pieceIds.length
    ? await WorkItem.find({ contentPieceId: { $in: pieceIds } })
        .select('title stageKey stageOrder status isLocked isSkipped reviewRequired dueDate deadline unlockedAt startedAt submittedAt approvedAt postedAt revisions rounds intervals ownerId contentPieceId blockerReason')
        .populate('ownerId', 'name')
        .lean()
    : [];
  const stepIds = steps.map((s) => s._id);
  const [facts, ratings, flags] = await Promise.all([
    evaluateSteps(steps, { now }),
    oneRatingPerStep(stepIds),
    stepIds.length
      ? RevisionFlag.find({ workItemId: { $in: stepIds }, rootCause: { $nin: [null, ''] } }).select('workItemId rootCause').lean()
      : [],
  ]);

  const stepsByPiece = new Map();
  for (const s of steps) {
    const key = String(s.contentPieceId);
    if (!stepsByPiece.has(key)) stepsByPiece.set(key, []);
    stepsByPiece.get(key).push(s);
  }

  const rows = [];
  for (const piece of pieces) {
    const pieceSteps = (stepsByPiece.get(String(piece._id)) || []).sort((a, b) => (a.stageOrder || 0) - (b.stageOrder || 0));
    const post = pieceSteps.find((s) => s.stageKey === 'Post' && !s.isSkipped);
    const design = pieceSteps.find((s) => s.stageKey === 'Design' && !s.isSkipped);
    const delivery = projectDelivery(piece, pieceSteps, {
      postedFromHistory: post ? facts.get(String(post._id))?.history?.postedAt : null,
      approvedFromHistory: design ? facts.get(String(design._id))?.history?.approvedAt : null,
    });
    const label = projectTimeLabel(piece, delivery, { now });
    const stepRows = pieceSteps.map((s) => {
      const f = facts.get(String(s._id)) || {};
      return {
        step: s,
        id: String(s._id),
        stageKey: s.stageKey,
        status: s.status,
        isSkipped: Boolean(s.isSkipped),
        ownerName: ownerName(s),
        dueDate: s.dueDate || s.deadline || null,
        labels: f.labels || [],
        firstSubmitted: f.firstSubmitted || null,
        firstSubmittedFromHistory: Boolean(f.firstSubmittedFromHistory),
        elapsed: f.elapsed || null,
        blocker: f.blocker || null,
        changesRequested: Boolean(f.changesRequested),
        rating: ratings.has(String(s._id)) ? ratings.get(String(s._id)) : null,
      };
    });
    rows.push({ piece, delivery, label, steps: stepRows });
  }
  return { rows, flags };
}

async function loadDataset(filters, { now = new Date() } = {}) {
  const { periodStart, periodEnd } = monthPeriod(filters.month);
  // A little wider than the month, then exact by the IST date of the publish date.
  const query = { postingDate: { $gte: new Date(periodStart.getTime() - DAY), $lte: new Date(periodEnd.getTime() + DAY) } };
  if (filters.calendar !== 'all') {
    query.$or = filters.calendar === 'sm'
      ? [{ calendar: 'sm' }, { calendar: null }, { calendar: { $exists: false } }]
      : [{ calendar: filters.calendar }];
  }
  const { rows, flags } = await loadPieces(query, { now });
  const inMonth = rows.filter((r) => (istDateKey(r.piece.postingDate) || '').slice(0, 7) === filters.month);
  // Only pieces that have steps (rows not yet approved into work have nothing to report).
  const projects = inMonth.filter((r) => r.steps.length > 0);
  const stepOk = (s) => !s.isSkipped && (filters.stepType === 'all' || s.stageKey === filters.stepType);
  const stepRows = projects.flatMap((p) => p.steps.filter(stepOk).map((s) => ({ ...s, project: p })));
  const stepIds = new Set(stepRows.map((s) => s.id));
  return { filters, now, projects, stepRows, flags: flags.filter((f) => stepIds.has(String(f.workItemId))) };
}

const projectRef = (p) => ({ id: String(p.piece._id), topic: p.piece.topic, calendar: calendarOf(p.piece), calendarName: calendarName(calendarOf(p.piece)), contentType: p.piece.contentType, publishDate: iso(p.piece.postingDate) });
const pct = (n, d) => (d ? Math.round((n / d) * 100) : null);
const isOnTimeDelivery = (p) => p.delivery.delivered && p.label?.kind !== 'completed_late';
const byDue = (a, b) => new Date(a.dueDate || 0) - new Date(b.dueDate || 0) || String(a.project).localeCompare(String(b.project));

/** Mondays of every IST week that touches the month. */
function monthWeeks(month) {
  const { periodStart, periodEnd } = monthPeriod(month);
  const weeks = [];
  let key = istWeekKey(new Date(periodStart.getTime() + 6 * 3600000));
  const last = istWeekKey(new Date(periodEnd.getTime() - 6 * 3600000));
  while (key && key <= last) {
    weeks.push(key);
    key = new Date(Date.parse(`${key}T00:00:00Z`) + 7 * DAY).toISOString().slice(0, 10);
  }
  return weeks;
}

function weekSeries(month, extraKeys = []) {
  const keys = [...new Set([...monthWeeks(month), ...extraKeys.filter(Boolean)])].sort();
  return keys;
}

/** Project KPIs over its (filtered) steps. Project on-time figures count every finished step. */
export function projectKpis(stepRows) {
  const live = stepRows.filter((s) => !s.isSkipped);
  const judged = live.filter((s) => hasTimeLabel(s.labels, 'done_on_time') || hasTimeLabel(s.labels, 'done_late'));
  const onTime = judged.filter((s) => hasTimeLabel(s.labels, 'done_on_time')).length;
  const delayedByEarlier = judged.filter((s) => hasTimeLabel(s.labels, 'late_earlier_step')).length;
  const candidates = live.filter((s) => isFirstPassCandidate(s.step));
  const firstPass = candidates.filter((s) => isFirstPassApproval(s.step, { changesRequested: s.changesRequested })).length;
  const rating = ratingAverage(live.map((s) => s.rating).filter((n) => typeof n === 'number'));
  const timed = live.filter((s) => s.elapsed);
  const fromHistory = timed.filter((s) => s.elapsed.fromHistory).length;
  return {
    onTime: { onTime, total: judged.length, rate: pct(onTime, judged.length), delayedByEarlier },
    rating,
    firstPass: { label: 'Reviewed steps approved first time', approvedFirstTime: firstPass, total: candidates.length, rate: pct(firstPass, candidates.length) },
    workTime: {
      label: 'Elapsed work time',
      totalMs: timed.reduce((sum, s) => sum + s.elapsed.ms, 0),
      steps: timed.length,
      fromHistory,
      partial: fromHistory > 0,
      note: fromHistory > 0 ? `${fromHistory} of ${timed.length} steps from history` : null,
    },
  };
}

function stepLabelTexts(labels) {
  return (labels || []).map((l) => l.text);
}

// ───────────────────────────── Reports ─────────────────────────────

export async function overviewReport(filters, opts) {
  const ds = await loadDataset(filters, opts);
  const delivered = ds.projects.filter((p) => p.delivery.delivered);
  const onTime = delivered.filter(isOnTimeDelivery);
  const overdueSteps = ds.stepRows.filter((s) => hasTimeLabel(s.labels, 'overdue'));
  const overdueProjects = ds.projects.filter((p) => p.label?.kind === 'overdue');
  const blocked = ds.stepRows.filter((s) => hasTimeLabel(s.labels, 'blocked'));
  const deliveredWeeks = delivered.map((p) => istWeekKey(p.delivery.deliveredAt));
  const weeks = weekSeries(filters.month, deliveredWeeks);
  const weekly = weeks.map((week) => {
    const inWeek = delivered.filter((p) => istWeekKey(p.delivery.deliveredAt) === week);
    return { week, delivered: inWeek.length, onTime: inWeek.filter(isOnTimeDelivery).length };
  });
  return {
    report: 'overview',
    filters,
    cards: {
      delivered: delivered.length,
      planned: ds.projects.length,
      onTime: onTime.length,
      onTimeRate: pct(onTime.length, delivered.length),
      overdueSteps: overdueSteps.length,
      overdueProjects: overdueProjects.length,
      blocked: blocked.length,
    },
    weekly,
    notes: { projectFigures: 'Delivered and on time count projects with all their steps; overdue and blocked count steps of the selected step type.' },
  };
}

export async function overdueReport(filters, opts) {
  const ds = await loadDataset(filters, opts);
  const base = (s) => ({ ...projectRef(s.project), project: s.project.piece.topic, stepId: s.id, stepType: s.stageKey, owner: s.ownerName, dueDate: iso(s.dueDate) });
  const openOverdue = ds.stepRows
    .filter((s) => hasTimeLabel(s.labels, 'overdue'))
    .map((s) => ({ ...base(s), daysOverdue: s.labels.find((l) => l.kind === 'overdue').days, labels: stepLabelTexts(s.labels) }))
    .sort(byDue);
  const doneLate = ds.stepRows
    .filter((s) => hasTimeLabel(s.labels, 'done_late'))
    .map((s) => ({ ...base(s), firstSubmitted: iso(s.firstSubmitted), fromHistory: s.firstSubmittedFromHistory, daysLate: s.labels.find((l) => l.kind === 'done_late').days, labels: stepLabelTexts(s.labels) }))
    .sort(byDue);
  const blockers = ds.stepRows
    .filter((s) => hasTimeLabel(s.labels, 'blocked'))
    .map((s) => ({ ...base(s), reason: s.blocker?.reason || '', since: iso(s.blocker?.since), daysBlocked: s.labels.find((l) => l.kind === 'blocked').days }))
    .sort(byDue);
  const count = (key, valueOf) => {
    const map = new Map();
    for (const s of ds.stepRows) {
      const k = valueOf(s);
      if (!map.has(k)) map.set(k, { [key]: k, overdue: 0, doneLate: 0 });
      if (hasTimeLabel(s.labels, 'overdue')) map.get(k).overdue += 1;
      if (hasTimeLabel(s.labels, 'done_late')) map.get(k).doneLate += 1;
    }
    return [...map.values()];
  };
  const byCalendar = count('calendar', (s) => calendarName(calendarOf(s.project.piece))).sort((a, b) => a.calendar.localeCompare(b.calendar));
  const byStepType = count('stepType', (s) => s.stageKey).sort((a, b) => STAGE_KEYS.indexOf(a.stepType) - STAGE_KEYS.indexOf(b.stepType));
  return { report: 'overdue', filters, openOverdue, doneLate, blockers, byCalendar, byStepType };
}

export async function productionReport(filters, opts) {
  const ds = await loadDataset(filters, opts);
  const group = (key, valueOf) => {
    const map = new Map();
    for (const p of ds.projects) {
      const k = valueOf(p);
      if (!map.has(k)) map.set(k, { [key]: k, planned: 0, delivered: 0 });
      map.get(k).planned += 1;
      if (p.delivery.delivered) map.get(k).delivered += 1;
    }
    return [...map.values()].sort((a, b) => String(a[key]).localeCompare(String(b[key])));
  };
  const plannedWeek = (p) => istWeekKey(p.piece.postingDate);
  const postedWeek = (p) => (p.delivery.delivered ? istWeekKey(p.delivery.deliveredAt) : null);
  const weeks = weekSeries(filters.month, ds.projects.map(postedWeek));
  const weekly = weeks.map((week) => ({
    week,
    planned: ds.projects.filter((p) => plannedWeek(p) === week).length,
    posted: ds.projects.filter((p) => postedWeek(p) === week).length,
  }));
  return {
    report: 'production',
    filters,
    byCalendar: group('calendar', (p) => calendarName(calendarOf(p.piece))),
    byType: group('contentType', (p) => p.piece.contentType || 'Other'),
    weekly,
    notes: { projectFigures: 'Planned and delivered count projects with all their steps.' },
  };
}

export async function qualityReport(filters, opts) {
  const ds = await loadDataset(filters, opts);
  const scores = ds.stepRows.map((s) => s.rating).filter((n) => typeof n === 'number');
  const ratingDistribution = [1, 2, 3, 4, 5].map((score) => ({ score, count: scores.filter((n) => n === score).length }));
  const candidates = ds.stepRows.filter((s) => isFirstPassCandidate(s.step));
  const first = candidates.filter((s) => isFirstPassApproval(s.step, { changesRequested: s.changesRequested })).length;
  const rootCauses = CANONICAL_REVISION_ROOT_CAUSES.map((cause) => ({ cause, count: ds.flags.filter((f) => f.rootCause === cause).length }));
  return {
    report: 'quality',
    filters,
    ratingDistribution,
    rating: ratingAverage(scores),
    firstPass: { label: 'Reviewed steps approved first time', approvedFirstTime: first, total: candidates.length, rate: pct(first, candidates.length) },
    rootCauses,
    classifiedRevisions: ds.flags.length,
  };
}

export async function projectsReport(filters, opts) {
  const ds = await loadDataset(filters, opts);
  const stepOk = (s) => !s.isSkipped && (filters.stepType === 'all' || s.stageKey === filters.stepType);
  const projects = ds.projects
    .map((p) => ({
      ...projectRef(p),
      label: p.label ? { kind: p.label.kind, text: p.label.text } : null,
      delivered: p.delivery.delivered,
      deliveredAt: iso(p.delivery.deliveredAt),
      kpis: projectKpis(p.steps.filter(stepOk)),
    }))
    .sort((a, b) => new Date(a.publishDate || 0) - new Date(b.publishDate || 0) || a.topic.localeCompare(b.topic));
  return { report: 'projects', filters, projects };
}

/** One project's KPI page. Read only. */
export async function projectKpiReport(id, opts = {}) {
  if (!mongoose.isValidObjectId(id)) return null;
  const { rows } = await loadPieces({ _id: new mongoose.Types.ObjectId(id) }, { now: opts.now || new Date() });
  const p = rows[0];
  if (!p) return null;
  return {
    project: {
      ...projectRef(p),
      label: p.label ? { kind: p.label.kind, text: p.label.text } : null,
      delivered: p.delivery.delivered,
      deliveredAt: iso(p.delivery.deliveredAt),
      deliveredVia: p.delivery.via,
    },
    kpis: projectKpis(p.steps),
    steps: p.steps.map((s) => ({
      id: s.id,
      stepType: s.stageKey,
      status: s.status,
      isSkipped: s.isSkipped,
      owner: s.ownerName,
      dueDate: iso(s.dueDate),
      firstSubmitted: iso(s.firstSubmitted),
      firstSubmittedFromHistory: s.firstSubmittedFromHistory,
      labels: s.labels.map((l) => ({ kind: l.kind, text: l.text })),
      elapsedMs: s.elapsed ? s.elapsed.ms : null,
      elapsedFromHistory: Boolean(s.elapsed?.fromHistory),
      rating: s.rating,
      finished: isFinishedStepStatus(s.status),
    })),
  };
}

export const LIVE_REPORTS = {
  overview: overviewReport,
  overdue: overdueReport,
  production: productionReport,
  quality: qualityReport,
  projects: projectsReport,
};
