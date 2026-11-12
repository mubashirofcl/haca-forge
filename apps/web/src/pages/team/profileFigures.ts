import { formatDuration } from '@mmp/shared';
import { fmtPct, fmtHours, type ReportColumn } from '../../lib/reportExport';

/**
 * Profile KPI figures (Phase 8). The cards on screen, the print report and the CSV are all
 * built from these rows, so they always show the same values. One person's own figures only.
 */
export interface FigureRow {
  key: string;
  label: string;
  value: string;
  basis: string;
  /** The same person's figure for the period before, as plain text (no colour or arrows). */
  last: string | null;
}

export interface WorkerKpis {
  cards: {
    assigned: number;
    completed: number;
    inProgress: number;
    openOverdue: number;
    blocked: number;
    onTime: { rate: number | null; onTime: number; total: number; delayedByEarlier: number; delayedText: string };
    late: { rate: number | null; late: number; total: number; doneLateCount: number };
    changesRequested: { rate: number | null; withChangeRequest: number; reviewed: number };
    rework: { rounds: number; rate: number | null; reviewed: number };
    firstPass: { label: string; rate: number | null; approvedFirstTime: number; total: number };
    rating: { count: number; average: number | null; text: string };
    workTime: { label: string; totalMs: number; totalText: string; byStepType: { stepType: string; ms: number; text: string }[]; steps: number; fromHistory: number; partial: boolean; note: string | null };
  };
  lastPeriod: {
    period: { from: string; to: string; label: string };
    completed: number;
    onTimeRate: number | null;
    lateRate: number | null;
    changesRequestedRate: number | null;
    reworkRate: number | null;
    firstPassRate: number | null;
    ratingText: string;
  };
  charts: {
    monthlyTrend: { month: string; completed: number; onTimeRate: number | null }[];
    ratingDistribution: { score: number; count: number }[];
    rootCauses: { cause: string; count: number }[];
    classifiedRevisions: number;
    byStepType: { stepType: string; count: number }[];
    byCalendar: { calendar: string; count: number }[];
  };
  steps?: ProfileStepRow[];
}

export interface ReviewerKpis {
  cards: {
    reviews: number;
    approvals: number;
    changesRequested: number;
    avgApprovalWait: { ms: number | null; text: string; basedOn: number };
    queue: { label: string; waiting: number; oldestMs: number | null; text: string; oldestSince: string | null };
    planApprovals: number;
    legacyApprovals: number;
    legacyNote: string | null;
  };
  charts: {
    reviewsPerWeek: { week: string; reviews: number }[];
    ratingsGiven: { score: number; count: number }[];
    rootCausesUsed: { cause: string; count: number }[];
  };
}

export interface ProfileStepRow {
  id: string;
  project: string;
  stepType: string;
  status: string;
  dueDate: string | null;
  firstSubmitted: string | null;
  firstSubmittedFromHistory: boolean;
  labels: string[];
  elapsedMs: number | null;
  elapsedFromHistory: boolean;
  /** Time spent on rework rounds; null when never reworked. */
  reworkMs?: number | null;
  rating: number | null;
}

export interface ProfileKpiData {
  person: { _id: string; name: string; preferredName: string; role: string; jobRole: string; department: string | null; status: string };
  period: { kind: string; from: string; to: string; label: string };
  worker: WorkerKpis | null;
  creativeHead: ReviewerKpis | null;
  canDownload: boolean;
  note: string;
}

const lastText = (v: string | null | undefined) => (v === null || v === undefined ? null : `Last period: ${v}`);
const n = (v: number) => String(v);
const ratio = (v: number | null) => (v === null ? 'No data' : `${v} per reviewed step`);

export function workerFigureRows(w: WorkerKpis): FigureRow[] {
  const c = w.cards;
  const lp = w.lastPeriod;
  return [
    { key: 'assigned', label: 'Steps assigned', value: n(c.assigned), basis: 'Due in the period', last: null },
    { key: 'completed', label: 'Completed', value: n(c.completed), basis: 'Of the steps due in the period', last: lastText(n(lp.completed)) },
    { key: 'inProgress', label: 'In progress', value: n(c.inProgress), basis: 'Now', last: null },
    { key: 'openOverdue', label: 'Open overdue', value: n(c.openOverdue), basis: 'Now', last: null },
    { key: 'blocked', label: 'Blocked', value: n(c.blocked), basis: 'Now', last: null },
    {
      key: 'onTime',
      label: 'On-time rate',
      value: fmtPct(c.onTime.rate),
      basis: `${c.onTime.onTime} of ${c.onTime.total} steps by their due date (IST)${c.onTime.delayedByEarlier ? `; ${c.onTime.delayedText}` : ''}`,
      last: lastText(fmtPct(lp.onTimeRate)),
    },
    { key: 'late', label: 'Late submission rate', value: fmtPct(c.late.rate), basis: `${c.late.late} of ${c.late.total} late; ${c.late.doneLateCount} done late in all`, last: lastText(fmtPct(lp.lateRate)) },
    { key: 'changesRequested', label: 'Changes requested rate', value: fmtPct(c.changesRequested.rate), basis: `${c.changesRequested.withChangeRequest} of ${c.changesRequested.reviewed} reviewed steps`, last: lastText(fmtPct(lp.changesRequestedRate)) },
    { key: 'rework', label: 'Rework', value: `${c.rework.rounds} revision ${c.rework.rounds === 1 ? 'round' : 'rounds'}`, basis: ratio(c.rework.rate), last: lastText(ratio(lp.reworkRate)) },
    { key: 'firstPass', label: c.firstPass.label, value: fmtPct(c.firstPass.rate), basis: `${c.firstPass.approvedFirstTime} of ${c.firstPass.total} review steps; Post not counted`, last: lastText(fmtPct(lp.firstPassRate)) },
    { key: 'rating', label: 'Average rating', value: c.rating.text, basis: `${c.rating.count} rated steps (one rating per step; needs 3)`, last: lastText(lp.ratingText) },
    {
      key: 'workTime',
      label: c.workTime.label,
      value: c.workTime.steps ? fmtHours(c.workTime.totalMs) : 'No data',
      basis: [
        c.workTime.byStepType.map((t) => `${t.stepType} ${fmtHours(t.ms)}`).join(', ') || 'No submitted rounds',
        c.workTime.partial ? `Partial: ${c.workTime.note}` : '',
      ]
        .filter(Boolean)
        .join('. '),
      last: null,
    },
  ];
}

export function reviewerFigureRows(r: ReviewerKpis): FigureRow[] {
  const c = r.cards;
  return [
    { key: 'reviews', label: 'Reviews completed', value: n(c.reviews), basis: 'Decisions in the period', last: null },
    { key: 'approvals', label: 'Approvals', value: n(c.approvals), basis: c.legacyNote || 'Submission decisions', last: null },
    { key: 'changesRequested', label: 'Changes requested', value: n(c.changesRequested), basis: 'Submission decisions', last: null },
    { key: 'avgWait', label: 'Average approval wait', value: c.avgApprovalWait.text, basis: `Submission to decision, ${c.avgApprovalWait.basedOn} decisions`, last: null },
    { key: 'queue', label: c.queue.label, value: c.queue.text, basis: `${c.queue.waiting} waiting now${c.queue.oldestSince ? `; since ${c.queue.oldestSince}` : ''}`, last: null },
    { key: 'planApprovals', label: 'Plan approvals completed', value: n(c.planApprovals), basis: 'In the period', last: null },
  ];
}

export const FIGURE_COLUMNS: ReportColumn<FigureRow>[] = [
  { key: 'label', header: 'Figure', text: (r) => r.label },
  { key: 'value', header: 'Value', text: (r) => r.value },
  { key: 'basis', header: 'Based on', text: (r) => r.basis },
  { key: 'last', header: 'Last period', text: (r) => (r.last ? r.last.replace(/^Last period: /, '') : '') },
];

export const STEP_COLUMNS: ReportColumn<ProfileStepRow>[] = [
  { key: 'project', header: 'Project', text: (r) => r.project },
  { key: 'step', header: 'Step', text: (r) => r.stepType },
  { key: 'status', header: 'Status', text: (r) => r.status },
  { key: 'due', header: 'Due date', text: (r) => r.dueDate || '' },
  { key: 'first', header: 'First submitted', text: (r) => (r.firstSubmitted ? `${r.firstSubmitted}${r.firstSubmittedFromHistory ? ' (from history)' : ''}` : '') },
  { key: 'labels', header: 'Labels', text: (r) => r.labels.join('; ') },
  { key: 'hours', header: 'Elapsed work time', text: (r) => (r.elapsedMs === null ? '' : `${fmtHours(r.elapsedMs)}${r.elapsedFromHistory ? ' (partial)' : ''}`) },
  { key: 'rework', header: 'Rework time', text: (r) => (r.reworkMs === null || r.reworkMs === undefined ? '' : formatDuration(r.reworkMs)) },
  { key: 'rating', header: 'Rating', text: (r) => (r.rating ? String(r.rating) : '') },
];

export const profileQuery = (p: { period: string; from?: string; to?: string }) =>
  new URLSearchParams(p.period === 'custom' ? { period: 'custom', from: p.from || '', to: p.to || '' } : { period: p.period }).toString();
