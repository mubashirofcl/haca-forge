/**
 * Content Flow Tracker: row types and the pure rules behind its filters, sorting and display.
 * Data rules (time labels, project labels, workflow) come from the API and @mmp/shared; this
 * file only reads them. Filters live in the URL so a refresh or a shared link keeps them.
 */
import {
  DELIVERABLE_TYPE_KEYS,
  ROW_WORKFLOWS,
  ROW_WORKFLOW_LABELS,
  getPipelineForContent,
  istDateKey,
  monthKeyInAppTz,
  workflowFromFlags,
  type CalendarKey,
  type RowWorkflow,
  type StageKey,
  type WorkItemStatus,
} from '@mmp/shared';
import type { TimeLabel } from '../../../components/TimeLabelChips';

export interface TrackerPerson {
  _id: string;
  name: string;
  email?: string;
  jobRole?: string;
  avatarUrl?: string;
}

export interface TrackerStage {
  _id: string;
  stageKey: StageKey;
  stageOrder: number;
  status: WorkItemStatus;
  dueDate: string;
  isLocked: boolean;
  isSkipped: boolean;
  revisions: number;
  blockerReason?: string;
  ownerId?: TrackerPerson | null;
  recommendedOwnerId?: TrackerPerson;
  deliverableUrl?: string;
  publishedUrl?: string;
  unlockedAt?: string | null;
  startedAt?: string | null;
  submittedAt?: string | null;
  approvedAt?: string | null;
  postedAt?: string | null;
  updatedAt?: string | null;
  timeLabels?: TimeLabel[];
  intervals?: Array<{ startedAt: string; endedAt?: string | null }>;
  [key: string]: unknown;
}

export interface TrackerPiece {
  _id: string;
  planId?: { _id: string; code: string; title: string; calendar?: CalendarKey };
  postingDate: string;
  topic: string;
  calendar?: CalendarKey;
  contentType: string;
  workflowLabel?: string;
  pipeline: string;
  needsScript: boolean;
  needsShoot: boolean;
  needsContent?: boolean;
  hasPostStage?: boolean;
  priority?: string;
  contentLink?: string;
  remarks?: string;
  rowStatus: string;
  stagesGenerated?: boolean;
  publishedAt?: string;
  liveUrl?: string;
  turnaroundDays?: number | null;
  stages: TrackerStage[];
  hasNeedsOwner: boolean;
  hasWaitingApproval: boolean;
  hasBlocked: boolean;
  hasOverdue: boolean;
  hasDoneLate?: boolean;
  projectLabel?: { kind: string; text: string; days: number } | null;
  waitingFormatted?: string;
  workTimeFormatted?: string;
  approvalWaitFormatted?: string;
  lateByFormatted?: string;
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export const TRACKER_STATUSES = [
  { value: 'overdue', label: 'Overdue' },
  { value: 'done_late', label: 'Done late' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'on_track', label: 'On track' },
  { value: 'posted', label: 'Posted' },
  { value: 'needs_owner', label: 'Needs owner' },
  { value: 'waiting_approval', label: 'Waiting for approval' },
  { value: 'not_approved', label: 'Not approved yet' },
] as const;
export type TrackerStatus = (typeof TRACKER_STATUSES)[number]['value'];

export const TRACKER_STEPS: Array<{ value: string; label: string }> = [
  { value: 'Content', label: 'Content' },
  { value: 'Script', label: 'Script' },
  { value: 'Shoot', label: 'Shoot' },
  { value: 'Edit', label: 'Edit' },
  { value: 'Design', label: 'Design' },
  { value: 'Post', label: 'Posting' },
  { value: 'done', label: 'All steps done' },
];

export const TRACKER_SORTS = [
  { value: 'publish', label: 'Publish date' },
  { value: 'due', label: 'Next due date' },
] as const;
export type TrackerSort = (typeof TRACKER_SORTS)[number]['value'];

export interface TrackerFilters {
  q: string;
  month: string;
  calendar: string;
  type: string;
  workflow: string;
  step: string;
  owner: string;
  status: string;
  urgent: boolean;
  sort: TrackerSort;
  /** Older links: any step with this status (the old "Stage status" filter). */
  stageStatus: string;
}

/** Older quick-filter links (?needsOwner=true …) map to a Status choice. */
const LEGACY_STATUS_PARAMS: Array<[string, TrackerStatus]> = [
  ['needsOwner', 'needs_owner'],
  ['waitingApproval', 'waiting_approval'],
  ['overdue', 'overdue'],
  ['blocked', 'blocked'],
  ['doneLate', 'done_late'],
];
const FILTER_KEYS = ['q', 'month', 'type', 'workflow', 'step', 'owner', 'status', 'urgent', 'sort', 'stageStatus'];

const isStatus = (v: string): v is TrackerStatus => TRACKER_STATUSES.some((s) => s.value === v);

export function filtersFromParams(sp: URLSearchParams): TrackerFilters {
  let status = sp.get('status') || '';
  if (!isStatus(status)) status = '';
  if (!status) {
    const legacy = LEGACY_STATUS_PARAMS.find(([k]) => sp.get(k) === 'true');
    if (legacy) status = legacy[1];
  }
  const month = sp.get('month') || '';
  const sort = sp.get('sort') === 'due' ? 'due' : 'publish';
  return {
    q: sp.get('q') || '',
    month: /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : '',
    calendar: sp.get('calendar') && sp.get('calendar') !== 'all' ? sp.get('calendar')! : '',
    type: sp.get('type') || '',
    workflow: (ROW_WORKFLOWS as readonly string[]).includes(sp.get('workflow') || '') ? sp.get('workflow')! : '',
    step: TRACKER_STEPS.some((s) => s.value === sp.get('step')) ? sp.get('step')! : '',
    owner: sp.get('owner') || '',
    status,
    urgent: sp.get('urgent') === '1',
    sort,
    stageStatus: sp.get('stageStatus') || '',
  };
}

/** Write the filters into the URL, keeping other parameters (tab …). Defaults are left out. */
export function filtersToParams(f: TrackerFilters, base: URLSearchParams): URLSearchParams {
  const sp = new URLSearchParams(base);
  for (const k of [...FILTER_KEYS, ...LEGACY_STATUS_PARAMS.map(([k]) => k)]) sp.delete(k);
  if (f.calendar) sp.set('calendar', f.calendar);
  else sp.delete('calendar');
  const put = (k: string, v: string) => v && sp.set(k, v);
  put('q', f.q.trim() ? f.q : '');
  put('month', f.month);
  put('type', f.type);
  put('workflow', f.workflow);
  put('step', f.step);
  put('owner', f.owner);
  put('status', f.status);
  if (f.urgent) sp.set('urgent', '1');
  if (f.sort === 'due') sp.set('sort', 'due');
  put('stageStatus', f.stageStatus);
  return sp;
}

/** The filters the API applies (month, calendar, type and the older step-status filter). */
export function apiParams(f: TrackerFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.month) p.set('month', f.month);
  if (f.calendar) p.set('calendar', f.calendar);
  if (f.type) p.set('type', f.type);
  if (f.stageStatus) p.set('stageStatus', f.stageStatus);
  return p;
}

// ---------------------------------------------------------------------------
// Row facts (read-only views of existing data)
// ---------------------------------------------------------------------------

const DONE = new Set(['Approved', 'Published']);
export const isStepDone = (s: TrackerStage) => s.isSkipped || DONE.has(String(s.status));

/** The step being worked on: the first one not done or skipped; null when all are done. */
export function currentStepOf(p: TrackerPiece): TrackerStage | null {
  return [...p.stages].sort((a, b) => a.stageOrder - b.stageOrder).find((s) => !isStepDone(s)) || null;
}

/** The earliest due date among steps not done yet; null when none. */
export function nextDueOf(p: TrackerPiece): string | null {
  const due = p.stages.filter((s) => !isStepDone(s) && s.dueDate).map((s) => s.dueDate).sort();
  return due[0] || null;
}

/** Posted: a published Post step (or a publish date), or a non-posted design whose steps are all done (handed over). */
export function isPosted(p: TrackerPiece): boolean {
  if (p.publishedAt) return true;
  if (p.stages.some((s) => s.stageKey === 'Post' && s.status === 'Published')) return true;
  const hasPost = p.stages.some((s) => s.stageKey === 'Post');
  return !hasPost && p.hasPostStage === false && p.stages.length > 0 && p.stages.every(isStepDone);
}

export const isNotApproved = (p: TrackerPiece) => p.stages.length === 0;

export function workflowOf(p: TrackerPiece): RowWorkflow | null {
  return workflowFromFlags(p.contentType, p);
}

export function matchesStatus(p: TrackerPiece, status: string): boolean {
  switch (status) {
    case 'overdue':
      return Boolean(p.hasOverdue);
    case 'done_late':
      return Boolean(p.hasDoneLate);
    case 'blocked':
      return Boolean(p.hasBlocked);
    case 'posted':
      return isPosted(p);
    case 'on_track':
      return !isNotApproved(p) && !isPosted(p) && !p.hasOverdue && !p.hasBlocked;
    case 'needs_owner':
      return Boolean(p.hasNeedsOwner);
    case 'waiting_approval':
      return Boolean(p.hasWaitingApproval);
    case 'not_approved':
      return isNotApproved(p);
    default:
      return true;
  }
}

/** Filters the API does not apply, then the chosen sort. Rows with no steps show only for "Not approved yet". */
export function applyTrackerFilters(pieces: TrackerPiece[], f: TrackerFilters): TrackerPiece[] {
  const q = f.q.trim().toLowerCase();
  const rows = pieces.filter((p) => {
    if (f.status !== 'not_approved' && isNotApproved(p)) return false;
    if (q && !p.topic.toLowerCase().includes(q) && !(p.planId?.code || '').toLowerCase().includes(q)) return false;
    if (f.workflow && workflowOf(p) !== f.workflow) return false;
    if (f.step) {
      const cur = currentStepOf(p);
      if (f.step === 'done' ? cur !== null || isNotApproved(p) : cur?.stageKey !== f.step) return false;
    }
    if (f.owner && !p.stages.some((s) => s.ownerId?._id === f.owner)) return false;
    if (f.status && !matchesStatus(p, f.status)) return false;
    if (f.urgent && p.priority !== 'Urgent') return false;
    return true;
  });
  const byPublish = (a: TrackerPiece, b: TrackerPiece) => (a.postingDate || '').localeCompare(b.postingDate || '') || a.topic.localeCompare(b.topic);
  if (f.sort === 'due') {
    return rows.sort((a, b) => {
      const da = nextDueOf(a);
      const db = nextDueOf(b);
      if (da && db) return da.localeCompare(db) || byPublish(a, b);
      if (da) return -1;
      if (db) return 1;
      return byPublish(a, b);
    });
  }
  return rows.sort(byPublish);
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const monthLabel = (key: string) => `${MONTH_NAMES[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;

/** Six months back to six months ahead of this month (IST), plus a chosen month outside that range. */
export function monthOptions(now: Date = new Date(), selected = ''): Array<{ value: string; label: string }> {
  const [y, m] = monthKeyInAppTz(now).split('-').map(Number);
  const keys: string[] = [];
  for (let i = -6; i <= 6; i++) {
    const d = new Date(Date.UTC(y, m - 1 + i, 1));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  if (selected && !keys.includes(selected)) keys.push(selected);
  return keys.sort().map((k) => ({ value: k, label: monthLabel(k) }));
}

export const TYPE_OPTIONS = DELIVERABLE_TYPE_KEYS.map((t) => ({ value: t, label: t }));
export const WORKFLOW_OPTIONS = ROW_WORKFLOWS.map((w) => ({ value: w, label: ROW_WORKFLOW_LABELS[w] }));

/** Everyone who owns a step on the loaded rows, by name. */
export function ownerOptions(pieces: TrackerPiece[]): Array<{ value: string; label: string }> {
  const seen = new Map<string, string>();
  for (const p of pieces) for (const s of p.stages) if (s.ownerId?._id) seen.set(s.ownerId._id, s.ownerId.name);
  return [...seen].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

/** "—" when there is no value, otherwise "N days" ("1 day"). */
export function turnaroundText(days: number | null | undefined): string {
  if (days === null || days === undefined || !Number.isFinite(days)) return '—';
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

/** An API duration string ("1d 1h", or "—" / '' for none) shown as is, with "—" for empty. */
export const metricText = (v?: string | null) => (v && v.trim() && v.trim() !== '—' ? v : '—');

/** Approval: when the last creation step (the last step before Post) was approved — the plan grid's rule. */
export function approvalDateOf(p: TrackerPiece): string | null {
  const creation = [...p.stages].filter((s) => s.stageKey !== 'Post').sort((a, b) => a.stageOrder - b.stageOrder).pop();
  return creation && DONE.has(String(creation.status)) ? creation.approvedAt || null : null;
}

/** Posting owner: the Post step's owner. */
export const postingOwnerOf = (p: TrackerPiece): TrackerPerson | null => p.stages.find((s) => s.stageKey === 'Post')?.ownerId || null;

/** "14m", "3h", "2d" since a moment. */
export function sinceText(from: string | null | undefined, now: Date = new Date()): string {
  if (!from) return '';
  const ms = now.getTime() - new Date(from).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '';
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${Math.max(1, min)}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/** When the current step entered its status, for "Content · Waiting for approval 14m". */
export function stateSince(s: TrackerStage): string | null {
  switch (s.status) {
    case 'Pending':
      return s.submittedAt || null;
    case 'In Progress':
      return s.startedAt || null;
    case 'Not Started':
      return s.isLocked ? null : s.unlockedAt || null;
    default:
      return s.updatedAt || null;
  }
}

/** Every step the row's type can have, in order, with the row's own step or null when its workflow does not use it. */
export function pipelineSlots(p: TrackerPiece): Array<{ stageKey: StageKey; stage: TrackerStage | null }> {
  const own = [...p.stages].sort((a, b) => a.stageOrder - b.stageOrder);
  if (!own.length) return [];
  const all = getPipelineForContent({ contentType: p.contentType, needsScript: true, needsShoot: true, needsContent: true }).stages as StageKey[];
  const keys = all.length && own.every((s) => all.includes(s.stageKey)) ? all : own.map((s) => s.stageKey);
  return keys.map((k) => ({ stageKey: k, stage: own.find((s) => s.stageKey === k) || null }));
}

export const firstName = (name?: string | null) => (name || '').trim().split(/\s+/)[0] || '';

export const dayKey = (v?: string | null) => istDateKey(v || null);
