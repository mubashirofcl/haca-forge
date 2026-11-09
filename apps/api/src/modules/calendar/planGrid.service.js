/**
 * Excel-style plan grid (PG-1): one grid per calendar + month.
 *
 * - loadGrid: plans for that calendar/month (selector when there are several),
 *   rows mapped to the 18 Excel columns plus the app-only fields.
 * - saveGridRows: create/update rows from typed cells or pasted Excel text, with
 *   per-cell errors. The monthly draft plan is created on the first valid row only.
 *
 * Owners are matched by exact name; dates/types are parsed without guessing.
 * Step rules, autofill and deadline offsets are the existing ones.
 */
import {
  CALENDAR_KEYS,
  PLAN_GRID_COLUMNS,
  PLAN_GRID_DISPLAY_COLUMNS,
  DELIVERABLE_TYPE_KEYS,
  APP_TIME_ZONE,
  getPipelineForContent,
  calculateStageDueDate,
  derivePlanStatus,
  isMonthKey,
  monthKeyInAppTz,
  monthPeriod,
  planMonthKey,
  normalizeRole,
  parseClipboardTsv,
  pastedRowsToCells,
  parseGridDate,
  parseGridType,
  matchGridOwner,
  parsePriorityInput,
  parseWorkflow,
  workflowFlags,
  workflowFromFlags,
  workflowOptionsFor,
  defaultWorkflowFor,
  ROW_WORKFLOW_LABELS,
} from '@mmp/shared';
import { CalendarPlan } from './plan.model.js';
import { ContentPiece } from './contentPiece.model.js';
import { WorkItem } from '../workItems/model.js';
import { Submission } from '../submissions/model.js';
import { Person } from '../people/model.js';
import { logActivity } from '../activity/service.js';
import { autofillRowPlan, buildAutofillContext } from './autofill.service.js';
import { validatePlanAndRows } from './validation.js';
import { createPlan, getDefaultPlanTitle } from './plan.service.js';
import { parseBufferToGridInput } from './import.service.js';

export const GRID_MAX_ROWS = 500;

/** Owner column for each step. Content/Design have no Excel column (app-only fields). */
export const OWNER_FIELD_BY_STAGE = {
  Script: 'scriptOwner',
  Shoot: 'shootOwner',
  Edit: 'editOwner',
  Post: 'postingOwner',
  Content: 'contentOwner',
  Design: 'designOwner',
};
const STAGE_BY_OWNER_FIELD = Object.fromEntries(Object.entries(OWNER_FIELD_BY_STAGE).map(([s, f]) => [f, s]));

/** Workflow columns: filled by the system, never written from the grid. */
export const READ_ONLY_FIELDS = PLAN_GRID_COLUMNS.filter((c) => !c.editable).map((c) => c.key);

const PLAN_EDIT_ROLES = ['sm_manager', 'admin'];

function httpError(status, code, message, extra = {}) {
  const error = new Error(message);
  error.statusCode = status;
  error.code = code;
  Object.assign(error, extra);
  return error;
}

function ymdInAppTz(value) {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

function assertCalendarAndMonth(calendar, month) {
  if (!CALENDAR_KEYS.includes(calendar)) {
    throw httpError(400, 'INVALID_CALENDAR', `Unknown calendar "${calendar}".`);
  }
  if (!isMonthKey(month)) {
    throw httpError(400, 'INVALID_MONTH', 'Month must be YYYY-MM.');
  }
}

/** Monthly plans of one calendar whose period starts in the given month. Legacy plans without a calendar count as SM. */
async function findMonthPlans(calendar, month) {
  const { periodStart, periodEnd } = monthPeriod(month);
  const calendarQuery =
    calendar === 'sm'
      ? { $or: [{ calendar: 'sm' }, { calendar: null }, { calendar: '' }, { calendar: { $exists: false } }] }
      : { calendar };
  // A day of slack each side covers plans saved at local midnight.
  const plans = await CalendarPlan.find({
    kind: 'monthly',
    ...calendarQuery,
    periodStart: { $gte: new Date(periodStart.getTime() - 86400000), $lte: periodEnd },
  })
    .sort({ createdAt: 1 })
    .lean();
  return plans.filter(
    (p) => planMonthKey(p.periodStart) === month && p.status !== 'cancelled' && p.status !== 'Cancelled'
  );
}

async function summarizePlans(plans) {
  const ids = plans.map((p) => p._id);
  const rows = await ContentPiece.find({ planId: { $in: ids } }).select('planId rowStatus').lean();
  return plans.map((p) => {
    const own = rows.filter((r) => String(r.planId) === String(p._id));
    return {
      _id: String(p._id),
      code: p.code,
      title: p.title,
      status: derivePlanStatus(own, p.submittedAt),
      rowCount: own.length,
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      // Stored data from the old wizard bug; reported, not rewritten.
      periodIssue: new Date(p.periodEnd) < new Date(p.periodStart) ? 'END_BEFORE_START' : null,
      createdAt: p.createdAt,
    };
  });
}

function stepStatus(stageKey, stages, piece, workItem) {
  if (!stages.includes(stageKey)) return 'N/A';
  // No work item yet: the row has not been approved, so the step has not started.
  if (!workItem) return '';
  if (workItem.isSkipped) return 'Skipped';
  if (workItem.isLocked && (!workItem.status || workItem.status === 'Not Started')) return 'Locked';
  return workItem.status || '';
}

function doneDate(workItem) {
  if (!workItem) return '';
  return ymdInAppTz(workItem.approvedAt || workItem.postedAt);
}

/** Map one stored row to the 18 Excel columns plus app-only fields. Names only, no contact details. */
export function toGridRow(piece, workItems = []) {
  const pipelineInfo = getPipelineForContent({
    contentType: piece.contentType,
    needsScript: piece.needsScript,
    needsShoot: piece.needsShoot,
    needsContent: piece.needsContent,
  });
  const stages = pipelineInfo.stages;
  const wiByStage = new Map(workItems.map((w) => [w.stageKey, w]));
  const planByStage = new Map((piece.stagePlan || []).map((s) => [s.stageKey, s]));
  const ownerName = (stageKey) => {
    const sp = planByStage.get(stageKey);
    const o = sp?.ownerId;
    return o && typeof o === 'object' && o.name ? o.name : '';
  };
  const ownerId = (stageKey) => {
    const o = planByStage.get(stageKey)?.ownerId;
    return o ? String(o._id || o) : null;
  };
  const postingOwnerName =
    (piece.postingOwnerId && typeof piece.postingOwnerId === 'object' && piece.postingOwnerId.name) || ownerName('Post');

  // Approval = Creative Head decision on the last creation step (Edit for reels, Design otherwise). VERIFY.
  const finalStage = [...stages].reverse().find((s) => s !== 'Post');
  const finalWi = finalStage ? wiByStage.get(finalStage) : null;
  // Same wording as the rest of the app (getStepStatusLabel): Pending = waiting, Feedback = changes requested.
  let approvalStatus = '';
  if (finalWi?.status === 'Approved' || finalWi?.status === 'Published') approvalStatus = 'Approved';
  else if (finalWi?.status === 'Pending') approvalStatus = 'Waiting for approval';
  else if (finalWi?.status === 'Feedback') approvalStatus = 'Changes requested';

  const stepDeadlines = {};
  const ownerSources = {};
  for (const s of stages) {
    const sp = planByStage.get(s);
    const auto = calculateStageDueDate(piece.postingDate, pipelineInfo.pipeline, s, pipelineInfo.hasPostStage);
    stepDeadlines[s] = ymdInAppTz(sp?.dueDate || auto);
    ownerSources[s] = { owner: sp?.ownerSource || 'suggested', deadline: sp?.dueDateSource || 'auto' };
  }

  return {
    rowId: String(piece._id),
    rowStatus: piece.rowStatus,
    editable: piece.rowStatus !== 'approved',
    // Delete is allowed until any of the row's steps has started (the API checks again on delete).
    deletable: !workItems.some((w) => w.started),
    // 18 Excel columns
    postingDate: ymdInAppTz(piece.postingDate),
    topic: piece.topic,
    type: piece.contentType,
    scriptStatus: stepStatus('Script', stages, piece, wiByStage.get('Script')),
    scriptDoneDate: doneDate(wiByStage.get('Script')),
    scriptOwner: stages.includes('Script') ? ownerName('Script') : '',
    shootStatus: stepStatus('Shoot', stages, piece, wiByStage.get('Shoot')),
    shootDoneDate: doneDate(wiByStage.get('Shoot')),
    shootOwner: stages.includes('Shoot') ? ownerName('Shoot') : '',
    editStatus: stepStatus('Edit', stages, piece, wiByStage.get('Edit')),
    editDoneDate: doneDate(wiByStage.get('Edit')),
    editOwner: stages.includes('Edit') ? ownerName('Edit') : '',
    approvalStatus,
    approvalDate: approvalStatus === 'Approved' ? ymdInAppTz(finalWi?.approvedAt) : '',
    publishedDate: ymdInAppTz(piece.publishedAt || wiByStage.get('Post')?.postedAt),
    postingOwner: pipelineInfo.hasPostStage ? postingOwnerName : '',
    turnaroundDays: piece.turnaroundDays ?? null,
    remarks: piece.remarks || '',
    // App fields that are not Excel columns
    brief: piece.brief || '',
    publishTime: piece.postingTime || '',
    contentLink: piece.contentLink || '',
    reviewFeedback: piece.reviewComment || '',
    stepDeadlines,
    ownerSources,
    ownerIds: Object.fromEntries(stages.map((s) => [s, ownerId(s)])),
    contentOwner: stages.includes('Content') ? ownerName('Content') : '',
    designOwner: stages.includes('Design') ? ownerName('Design') : '',
    contentStatus: stepStatus('Content', stages, piece, wiByStage.get('Content')),
    contentDoneDate: doneDate(wiByStage.get('Content')),
    designStatus: stepStatus('Design', stages, piece, wiByStage.get('Design')),
    needsScript: Boolean(piece.needsScript),
    needsShoot: Boolean(piece.needsShoot),
    needsContent: piece.needsContent !== false,
    // Workflow read from the stored flags (null for types with a fixed step list).
    workflow: workflowFromFlags(piece.contentType, piece),
    programOrEvent: piece.programOrEvent || '',
    referenceLink: piece.referenceLink || '',
    priority: piece.priority || 'Normal',
    sourceVideoLink: piece.sourceVideoLink || '',
    pipeline: pipelineInfo.pipeline,
    stages,
  };
}

async function loadGridRows(planId) {
  const pieces = await ContentPiece.find({ planId })
    .populate('postingOwnerId', 'name')
    .populate('stagePlan.ownerId', 'name')
    .sort({ postingDate: 1, createdAt: 1 })
    .lean();
  const workItems = await WorkItem.find({ contentPieceId: { $in: pieces.map((p) => p._id) } })
    .select('contentPieceId stageKey status isSkipped isLocked approvedAt postedAt startedAt')
    .lean();
  // Same "started" rule as plan and row delete: left Not Started, has a start time, or has a submission.
  const submitted = workItems.length
    ? new Set((await Submission.distinct('workItemId', { workItemId: { $in: workItems.map((w) => w._id) } })).map(String))
    : new Set();
  const byPiece = new Map();
  for (const w of workItems) {
    w.started = w.status !== 'Not Started' || Boolean(w.startedAt) || submitted.has(String(w._id));
    const k = String(w.contentPieceId);
    if (!byPiece.has(k)) byPiece.set(k, []);
    byPiece.get(k).push(w);
  }
  return pieces.map((p) => toGridRow(p, byPiece.get(String(p._id)) || []));
}

function gridPermissions(user) {
  const role = normalizeRole(user.role);
  const canEdit = PLAN_EDIT_ROLES.includes(role);
  // Spec: only the Creative Head reviews rows. The existing review endpoint also lets admin; see PG-3.
  const canReview = role === 'creative_head';
  return { role, canEdit, canReview, readOnly: !canEdit && !canReview };
}

async function activeOwnerCandidates() {
  return Person.find({ role: { $in: ['team_member', 'sm_manager', 'admin'] }, status: 'active' })
    .select('name role workPreferences')
    .lean();
}

/**
 * GET grid: plans for calendar+month (selector), the chosen plan's rows, and
 * what the viewer may do. Never creates a plan.
 */
export async function loadGrid({ calendar = 'sm', month, planId } = {}, user) {
  const perms = gridPermissions(user);
  if (perms.role === 'team_member') {
    throw httpError(403, 'FORBIDDEN_SCOPE', 'Team members cannot access calendar plans.');
  }
  const monthKey = month || monthKeyInAppTz(new Date());
  assertCalendarAndMonth(calendar, monthKey);

  const plans = await summarizePlans(await findMonthPlans(calendar, monthKey));
  let selected = null;
  if (planId) {
    selected = plans.find((p) => p._id === String(planId)) || null;
    if (!selected) throw httpError(404, 'PLAN_NOT_IN_MONTH', 'That plan is not a monthly plan for this calendar and month.');
  } else if (plans.length === 1) {
    selected = plans[0];
  }

  const { periodStart, periodEnd } = monthPeriod(monthKey);
  const people = perms.canEdit
    ? (await activeOwnerCandidates()).map((p) => ({ _id: String(p._id), name: p.name, role: p.role, workPreferences: p.workPreferences || [] }))
    : [];

  return {
    calendar,
    month: monthKey,
    period: { periodStart, periodEnd },
    columns: PLAN_GRID_COLUMNS,
    displayColumns: PLAN_GRID_DISPLAY_COLUMNS,
    types: DELIVERABLE_TYPE_KEYS,
    plans,
    selectionRequired: !selected && plans.length > 1,
    plan: selected,
    rows: selected ? await loadGridRows(selected._id) : [],
    permissions: { canEdit: perms.canEdit, canReview: perms.canReview, readOnly: perms.readOnly },
    people,
  };
}

const str = (v) => (v === undefined || v === null ? '' : String(v).trim());
const has = (obj, k) => Object.prototype.hasOwnProperty.call(obj, k);

function parseBool(v) {
  if (typeof v === 'boolean') return v;
  const s = str(v).toLowerCase();
  if (['yes', 'y', 'true', '1'].includes(s)) return true;
  if (['no', 'n', 'false', '0', ''].includes(s)) return false;
  return null;
}

/**
 * Parse one input row (cells may be partial on update) into a draft row and cell errors.
 * Pure apart from the people list; autofill/validation happen afterwards.
 */
export function parseGridRowInput(cells, existing, people, { month } = {}) {
  const errors = {};
  const addError = (field, msg) => {
    (errors[field] ||= []).push(msg);
  };
  const ignoredCells = READ_ONLY_FIELDS.filter((k) => has(cells, k) && str(cells[k]) !== '');
  // What the parser read from free text, so the paste preview can show it before saving.
  const resolved = {};

  const pick = (k, fallback) => (has(cells, k) ? cells[k] : fallback);

  // Plan columns
  let postingDate = existing ? ymdInAppTz(existing.postingDate) : '';
  if (has(cells, 'postingDate') || !existing) {
    const r = parseGridDate(cells.postingDate, { month });
    if (r.ok) {
      postingDate = r.value;
      resolved.postingDate = { input: str(cells.postingDate), value: r.value, byMonth: Boolean(r.resolvedByMonth) };
    } else {
      postingDate = '';
      addError('postingDate', r.error);
    }
  }
  const topic = str(pick('topic', existing?.topic));
  if (topic.length < 2) addError('topic', 'Topic is required.');

  let type = existing?.contentType || '';
  if (has(cells, 'type') || !existing) {
    // typeExact: picked from the 15-type list, so "Poster" stays the print Poster type.
    const r = parseGridType(cells.type, { exact: Boolean(cells.typeExact) });
    if (r.ok && str(cells.type) !== r.value) resolved.type = { input: str(cells.type), value: r.value };
    if (r.ok) type = r.value;
    else {
      type = '';
      addError('type', r.error);
    }
  }

  // Workflow (which steps the row has), stored as flags. New rows and blank cells get the type's
  // default (Full / With content); a changed Type resets to its default unless a workflow is given.
  // Existing rows keep their flags. Older files may still send Needs Script / Needs Shoot.
  const isReel = type === 'Reel';
  const typeChanged = Boolean(existing) && has(cells, 'type') && type !== existing.contentType;
  const defaultFlags = workflowFlags(defaultWorkflowFor(type) || 'with_content');
  let needsScript = existing && !typeChanged ? Boolean(existing.needsScript) : defaultFlags.needsScript;
  let needsShoot = existing && !typeChanged ? Boolean(existing.needsShoot) : defaultFlags.needsShoot;
  let needsContent = existing && !typeChanged ? existing.needsContent !== false : true;
  if (has(cells, 'workflow')) {
    const r = parseWorkflow(type, cells.workflow);
    if (!r.ok) addError('workflow', r.error);
    else if (type) {
      const f = workflowFlags(r.value || defaultWorkflowFor(type) || 'with_content');
      needsScript = f.needsScript;
      needsShoot = f.needsShoot;
      needsContent = f.needsContent;
    }
  } else {
    for (const [k, setter] of [
      ['needsScript', (v) => (needsScript = v)],
      ['needsShoot', (v) => (needsShoot = v)],
    ]) {
      if (has(cells, k)) {
        const b = parseBool(cells[k]);
        if (b === null) addError(k, 'Use Yes or No.');
        else setter(b);
      }
    }
  }
  if (!isReel) {
    needsScript = false;
    needsShoot = false;
  }
  if (!workflowOptionsFor(type).includes('design_only')) needsContent = true;
  const pipelineInfo = type ? getPipelineForContent({ contentType: type, needsScript, needsShoot, needsContent }) : null;
  const stages = pipelineInfo?.stages || [];
  const workflowLabelText = ROW_WORKFLOW_LABELS[workflowFromFlags(type, { needsScript, needsShoot, needsContent })] || '';

  // Owners (exact name). Blank = autofill later. A name on a step this row does not have is an error, not dropped.
  const owners = {};
  for (const [field, ownStage] of Object.entries(STAGE_BY_OWNER_FIELD)) {
    const idKey = `${field}Id`;
    if (!has(cells, field) && !has(cells, idKey)) continue;
    // Script Owner is the "Script / Content" column: on a design row it sets the Content owner,
    // unless the older Content Owner column is also given (that one wins).
    let stageKey = ownStage;
    if (field === 'scriptOwner' && pipelineInfo && !stages.includes('Script') && stages.includes('Content')) {
      if (has(cells, 'contentOwner') || has(cells, 'contentOwnerId')) continue;
      stageKey = 'Content';
    }
    let r;
    if (has(cells, idKey) && str(cells[idKey]) !== '') {
      // Picked from the owner list (also how two people with the same name are told apart).
      const p = people.find((x) => String(x._id) === str(cells[idKey]));
      r = p ? { ok: true, id: String(p._id), name: p.name } : { ok: false, error: 'That person is not an active team member.' };
    } else {
      r = matchGridOwner(has(cells, field) ? cells[field] : '', people);
    }
    if (!r.ok) {
      addError(field, r.error);
      continue;
    }
    if (r.empty) {
      owners[stageKey] = { clear: true };
      continue;
    }
    if (pipelineInfo && !stages.includes(stageKey)) {
      addError(
        field,
        workflowLabelText
          ? `${type} · ${workflowLabelText} has no ${stageKey} step. Change Workflow, or clear the name.`
          : `${type} has no ${stageKey} step.`
      );
      continue;
    }
    owners[stageKey] = { id: r.id, name: r.name };
  }

  // Step deadlines (app field): { Script: '2 Nov, 2026', ... }
  const deadlines = {};
  if (has(cells, 'deadlines') && cells.deadlines && typeof cells.deadlines === 'object') {
    for (const [stageKey, raw] of Object.entries(cells.deadlines)) {
      if (str(raw) === '') {
        deadlines[stageKey] = { clear: true };
        continue;
      }
      if (pipelineInfo && !stages.includes(stageKey)) {
        addError(`deadline.${stageKey}`, `This row has no ${stageKey} step.`);
        continue;
      }
      const r = parseGridDate(raw, { month });
      if (r.ok) deadlines[stageKey] = { value: r.value };
      else addError(`deadline.${stageKey}`, r.error);
    }
  }

  const publishTime = str(pick('publishTime', existing?.postingTime || '18:00')) || '18:00';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(publishTime)) addError('publishTime', 'Use 24-hour time, e.g. 18:00.');
  // Normal or Urgent only. A row whose stored older value (Low, Medium, High) is not being
  // changed keeps it unchanged.
  const rawPriority = str(pick('priority', existing?.priority || 'Normal')) || 'Normal';
  const parsedPriority = parsePriorityInput(rawPriority);
  const priority = existing && rawPriority === existing.priority ? rawPriority : parsedPriority || rawPriority;
  if (!(existing && rawPriority === existing.priority) && !parsedPriority) addError('priority', 'Priority must be Normal or Urgent.');

  return {
    errors,
    ignoredCells,
    resolved,
    draft: {
      postingDate,
      topic,
      type,
      needsScript,
      needsShoot,
      needsContent,
      pipelineInfo,
      owners,
      deadlines,
      publishTime,
      priority,
      remarks: str(pick('remarks', existing?.remarks)),
      brief: str(pick('brief', existing?.brief)),
      contentLink: str(pick('contentLink', existing?.contentLink)),
      programOrEvent: str(pick('programOrEvent', existing?.programOrEvent)),
      referenceLink: str(pick('referenceLink', existing?.referenceLink)),
      sourceVideoLink: str(pick('sourceVideoLink', existing?.sourceVideoLink)),
    },
  };
}

/** Build the stagePlan: manual cells > kept manual values > autofill suggestion; deadlines manual > auto offsets. */
function buildStagePlan(draft, existing, suggestion) {
  const { pipelineInfo } = draft;
  const prev = new Map((existing?.stagePlan || []).map((s) => [s.stageKey, s]));
  const sugg = new Map((suggestion?.stages || []).map((s) => [s.stageKey, s]));
  const postingDate = new Date(`${draft.postingDate}T00:00:00.000Z`);
  return pipelineInfo.stages.map((stageKey) => {
    const cell = draft.owners[stageKey];
    const old = prev.get(stageKey);
    let ownerId = null;
    let ownerSource = 'suggested';
    if (cell && !cell.clear) {
      ownerId = cell.id;
      ownerSource = 'manual';
    } else if (!cell && old?.ownerSource === 'manual' && old.ownerId) {
      ownerId = String(old.ownerId._id || old.ownerId);
      ownerSource = 'manual';
    } else {
      ownerId = sugg.get(stageKey)?.ownerId || null;
    }

    const dl = draft.deadlines[stageKey];
    let dueDate;
    let dueDateSource = 'auto';
    if (dl && !dl.clear) {
      dueDate = new Date(`${dl.value}T00:00:00.000Z`);
      dueDateSource = 'manual';
    } else if (!dl && old?.dueDateSource === 'manual' && old.dueDate) {
      dueDate = new Date(old.dueDate);
      dueDateSource = 'manual';
    } else {
      dueDate = calculateStageDueDate(postingDate, pipelineInfo.pipeline, stageKey, pipelineInfo.hasPostStage);
    }
    return { stageKey, ownerId, dueDate, ownerSource, dueDateSource, overrideReason: old?.overrideReason || '' };
  });
}

function mapValidationField(field) {
  if (!field) return 'row';
  if (field === 'postingOwnerId') return 'postingOwner';
  const m = /^stages\.([A-Za-z]+)\.(ownerId|dueDate)$/.exec(field);
  if (m) return m[2] === 'ownerId' ? OWNER_FIELD_BY_STAGE[m[1]] || 'row' : `deadline.${m[1]}`;
  return field;
}

/**
 * POST grid rows: create/update rows from cells or pasted text.
 * body: { calendar, month, planId?, rows?: [{ clientKey?, rowId?, cells }], tsv?, startColumn?, dryRun? }
 */
export async function saveGridRows(body = {}, user) {
  const perms = gridPermissions(user);
  if (!perms.canEdit) {
    throw httpError(403, 'FORBIDDEN_ROLE', 'Only SM Manager and Admin can create or edit plans.');
  }
  const calendar = body.calendar || 'sm';
  const month = body.month;
  assertCalendarAndMonth(calendar, month);

  let inputs = [];
  let paste = null;
  if (typeof body.tsv === 'string') {
    const parsed = pastedRowsToCells(parseClipboardTsv(body.tsv), body.startColumn || 'postingDate');
    paste = { headerDetected: parsed.headerDetected, unknownHeaders: parsed.unknownHeaders, rowCount: parsed.cells.length };
    inputs = parsed.cells.map((cells, i) => ({ clientKey: `paste-${i + 1}`, cells }));
  } else if (Array.isArray(body.rows)) {
    inputs = body.rows.map((r, i) => ({ clientKey: r.clientKey || `row-${i + 1}`, rowId: r.rowId || null, cells: r.cells || {} }));
  }
  if (inputs.length === 0) throw httpError(400, 'NO_ROWS', 'Send rows or pasted text.');
  if (inputs.length > GRID_MAX_ROWS) throw httpError(400, 'TOO_MANY_ROWS', `Paste at most ${GRID_MAX_ROWS} rows at a time.`);

  // Target plan: given, the only one for the month, or none yet. Never pick between duplicates.
  const monthPlans = await findMonthPlans(calendar, month);
  let plan = null;
  if (body.planId) {
    plan = monthPlans.find((p) => String(p._id) === String(body.planId));
    if (!plan) throw httpError(400, 'PLAN_NOT_IN_MONTH', 'That plan is not a monthly plan for this calendar and month.');
  } else if (monthPlans.length === 1) {
    plan = monthPlans[0];
  } else if (monthPlans.length > 1) {
    throw httpError(409, 'PLAN_SELECTION_REQUIRED', 'This month has more than one plan. Choose one first.', {
      details: {
        plans: (await summarizePlans(monthPlans)).map(({ _id, code, title, rowCount }) => ({ _id, code, title, rowCount })),
      },
    });
  }

  const people = (await activeOwnerCandidates()).map((p) => ({ _id: String(p._id), name: p.name }));
  const existingRows = plan ? await ContentPiece.find({ planId: plan._id }).lean() : [];
  const existingById = new Map(existingRows.map((r) => [String(r._id), r]));
  const defaultPoster = await Person.findOne({ role: 'sm_manager', status: 'active' }).select('_id').lean();

  const results = [];
  const built = [];
  let autofillContext = null;
  for (const input of inputs) {
    // `input` echoes the cells so a preview (or an upload) can show and re-edit rows that were not saved.
    const result = { clientKey: input.clientKey, rowId: input.rowId, status: 'invalid', cellErrors: {}, warnings: [], ignoredCells: [], input: input.cells };
    results.push(result);
    let existing = null;
    if (input.rowId) {
      existing = existingById.get(String(input.rowId));
      if (!existing) {
        result.cellErrors.row = ['This row is not in the selected plan.'];
        continue;
      }
      if (existing.rowStatus === 'approved') {
        result.status = 'locked';
        result.cellErrors.row = ['Approved rows cannot be edited.'];
        continue;
      }
    }
    const { errors, ignoredCells, resolved, draft } = parseGridRowInput(input.cells, existing, people, { month });
    result.ignoredCells = ignoredCells;
    result.resolved = resolved;
    Object.assign(result.cellErrors, errors);
    if (!draft.pipelineInfo || !draft.postingDate) continue;

    // Autofill only what is blank (owners) using the existing autofill rules.
    const needsSuggestion = draft.pipelineInfo.stages.some((s) => {
      const c = draft.owners[s];
      const old = (existing?.stagePlan || []).find((x) => x.stageKey === s);
      return !(c && !c.clear) && !(!c && old?.ownerSource === 'manual' && old.ownerId);
    });
    // Workload is read once per request; earlier rows of this batch still count, in row order.
    if (needsSuggestion && !autofillContext) autofillContext = await buildAutofillContext();
    const suggestion = needsSuggestion
      ? await autofillRowPlan({
          type: draft.type,
          postingDate: new Date(`${draft.postingDate}T00:00:00.000Z`),
          needsScript: draft.needsScript,
          needsShoot: draft.needsShoot,
          needsContent: draft.needsContent,
          currentPlanRows: [...existingRows, ...built.map((b) => b.doc)],
          context: autofillContext,
        })
      : null;
    const stagePlan = buildStagePlan(draft, existing, suggestion);
    const postStage = stagePlan.find((s) => s.stageKey === 'Post');
    const postingOwnerId = draft.pipelineInfo.hasPostStage
      ? postStage?.ownerId || (existing?.postingOwnerId ? String(existing.postingOwnerId) : null) || (defaultPoster ? String(defaultPoster._id) : null)
      : null;

    const brief = draft.brief || (existing ? '' : `Brief for ${draft.topic}`);
    built.push({
      result,
      existing,
      doc: {
        postingDate: new Date(`${draft.postingDate}T00:00:00.000Z`),
        postingTime: draft.publishTime,
        topic: draft.topic,
        type: draft.type,
        contentType: draft.type,
        calendar,
        programOrEvent: draft.programOrEvent,
        brief,
        referenceLink: draft.referenceLink,
        priority: draft.priority,
        postingOwnerId,
        needsScript: draft.needsScript,
        needsShoot: draft.needsShoot,
        needsContent: draft.needsContent,
        sourceVideoLink: draft.sourceVideoLink,
        contentLink: draft.contentLink,
        remarks: draft.remarks,
        stagePlan,
        pipeline: draft.pipelineInfo.pipeline,
        hasPostStage: draft.pipelineInfo.hasPostStage,
      },
    });
  }

  // One validation pass with the existing rules. Untouched plan rows go first as context
  // so a pasted duplicate is flagged on the new row, not the saved one.
  const updatedIds = new Set(built.filter((b) => b.existing).map((b) => String(b.existing._id)));
  const context = existingRows.filter((r) => !updatedIds.has(String(r._id))).map((r, i) => ({ ...r, rowNumber: `ctx-${i}` }));
  const { periodStart, periodEnd } = monthPeriod(month);
  const validation = await validatePlanAndRows({
    plan: { kind: 'monthly', periodStart, periodEnd },
    rows: [...context, ...built.map((b, i) => ({ ...b.doc, rowNumber: `in-${i}` }))],
    isSubmitting: false,
  });
  const batchWarnings = [];
  for (const e of validation.errors) {
    const m = /^in-(\d+)$/.exec(String(e.rowNumber));
    if (!m) continue;
    const r = built[Number(m[1])].result;
    (r.cellErrors[mapValidationField(e.field)] ||= []).push(e.message);
  }
  for (const w of validation.warnings) {
    const m = /^in-(\d+)$/.exec(String(w.rowNumber));
    if (m) built[Number(m[1])].result.warnings.push({ field: mapValidationField(w.field), code: w.code, message: w.message });
    else if (!String(w.rowNumber).startsWith('ctx-')) batchWarnings.push({ code: w.code, message: w.message });
  }

  const valid = built.filter((b) => Object.keys(b.result.cellErrors).length === 0);
  let planCreated = false;
  if (!body.dryRun && valid.length > 0) {
    if (!plan) {
      // First valid row creates the draft for this calendar + month.
      const created = await createPlan(
        { calendar, kind: 'monthly', month, periodStart, periodEnd, title: getDefaultPlanTitle(periodStart, calendar) },
        user
      );
      plan = await CalendarPlan.findById(created._id).lean();
      planCreated = true;
    }
    for (const b of valid) {
      if (b.existing) {
        await ContentPiece.updateOne({ _id: b.existing._id }, { $set: b.doc });
        b.result.rowId = String(b.existing._id);
      } else {
        const piece = await ContentPiece.create({
          ...b.doc,
          planId: plan._id,
          rowStatus: 'draft',
          createdById: user._id || user.userId,
        });
        b.result.rowId = String(piece._id);
      }
      b.result.status = 'saved';
      delete b.result.input;
    }
    await logActivity({
      entityType: 'calendar_plan',
      entityId: plan._id,
      actor: user,
      action: 'calendar_plan.grid_rows_saved',
      metadata: {
        created: valid.filter((b) => !b.existing).length,
        updated: valid.filter((b) => b.existing).length,
        invalid: results.length - valid.length,
        pasted: Boolean(paste),
      },
    });
  } else if (body.dryRun) {
    for (const b of valid) b.result.status = 'valid';
  }

  // Return saved rows in grid shape so the client can refresh cells.
  if (plan && valid.length > 0 && !body.dryRun) {
    const savedIds = new Set(valid.map((b) => b.result.rowId));
    const gridRows = await loadGridRows(plan._id);
    for (const g of gridRows) {
      if (!savedIds.has(g.rowId)) continue;
      const r = results.find((x) => x.rowId === g.rowId);
      if (r) r.row = g;
    }
  }

  return {
    calendar,
    month,
    dryRun: Boolean(body.dryRun),
    planCreated,
    plan: plan ? (await summarizePlans([plan]))[0] : null,
    paste,
    counts: {
      total: results.length,
      saved: results.filter((r) => r.status === 'saved').length,
      valid: results.filter((r) => r.status === 'valid').length,
      invalid: results.filter((r) => r.status === 'invalid').length,
      locked: results.filter((r) => r.status === 'locked').length,
    },
    results,
    warnings: batchWarnings,
  };
}

/**
 * Upload a plan file into the grid. New 18-column files match owners by exact name;
 * older 23-column files keep working (owner emails are resolved to people here).
 * Same results shape as saveGridRows; use dryRun first to show the preview.
 */
export async function uploadGridFile({ buffer, mimetype = '', calendar = 'sm', month, planId, dryRun = false }, user) {
  const perms = gridPermissions(user);
  if (!perms.canEdit) {
    throw httpError(403, 'FORBIDDEN_ROLE', 'Only SM Manager and Admin can create or edit plans.');
  }
  if (!buffer || !buffer.length) throw httpError(400, 'FILE_REQUIRED', 'Choose an Excel or CSV file.');
  const parsed = await parseBufferToGridInput(buffer, mimetype);
  if (parsed.rows.length === 0) throw httpError(400, 'NO_ROWS', 'The file has no plan rows under the header row.');

  const emailFields = parsed.rows.flatMap((r) => Object.keys(r.cells).filter((k) => k.endsWith('Email')));
  let byEmail = new Map();
  if (emailFields.length) {
    const active = await Person.find({ role: { $in: ['team_member', 'sm_manager', 'admin'] }, status: 'active' }).select('email').lean();
    byEmail = new Map(active.filter((p) => p.email).map((p) => [p.email.toLowerCase(), String(p._id)]));
  }
  const rows = parsed.rows.map((r) => {
    const cells = { ...r.cells };
    for (const k of Object.keys(cells)) {
      if (!k.endsWith('Email')) continue;
      const field = k.slice(0, -'Email'.length);
      const id = byEmail.get(String(cells[k]).toLowerCase());
      if (id) cells[`${field}Id`] = id;
      else cells[field] = cells[k]; // reported as an unmatched owner on that cell
      delete cells[k];
    }
    return { clientKey: `file-row-${r.rowIndex}`, cells };
  });

  const result = await saveGridRows({ calendar, month, planId, dryRun, rows }, user);
  return { ...result, upload: { layout: parsed.layout, rowCount: rows.length } };
}

export const __test = { findMonthPlans, mapValidationField, ymdInAppTz };
