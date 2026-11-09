import mongoose from 'mongoose';
import { CalendarPlan } from './plan.model.js';
import { parsePriorityInput } from '@mmp/shared';
import { ContentPiece } from './contentPiece.model.js';
import { WorkItem } from '../workItems/model.js';
import { Person } from '../people/model.js';
import { Department } from '../departments/model.js';
import { logActivity } from '../activity/service.js';
import { createNotification } from '../notifications/service.js';
import { resolveScope } from '../../lib/scope.js';
import {
  CALENDARS,
  CALENDAR_KEYS,
  getCalendarDefinition,
  derivePlanStatus,
  getPipelineForContent,
  calculateStageDueDate,
  REVIEW_STAGES,
  DEFAULT_STAGE_HOURS,
  normalizeRole,
  normalizeWorkType,
  isPostableWorkType,
  WORK_TYPE_DEPARTMENT_MAP,
  isMonthKey,
  monthPeriod,
  planMonthKey,
  istDateKey,
  formatGridDate,
} from '@mmp/shared';
import { recommendAssignee } from '../assignment/service.js';
import { validatePlanAndRows } from './validation.js';

/**
 * Generate sequential unique plan code: PLAN-YYYY-MM-001
 */
export async function generatePlanCode(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const prefix = `PLAN-${year}-${month}`;

  const latest = await CalendarPlan.findOne({ code: new RegExp(`^${prefix}`) })
    .sort({ code: -1 })
    .collation({ locale: 'en', numericOrdering: true })
    .lean();

  let nextSeq = 1;
  if (latest && latest.code) {
    const parts = latest.code.split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) {
      nextSeq = lastNum + 1;
    }
  }

  let code = `${prefix}-${String(nextSeq).padStart(3, '0')}`;
  while (await CalendarPlan.exists({ code })) {
    nextSeq++;
    code = `${prefix}-${String(nextSeq).padStart(3, '0')}`;
  }

  return code;
}

/**
 * Compute exhaustive row statistics and derived status for a plan
 */
export function computePlanRowStats(rows = [], plan = {}) {
  const derivedStatus = derivePlanStatus(rows, plan.submittedAt);
  const total = rows.length;
  const draft = rows.filter((r) => r.rowStatus === 'draft').length;
  const submitted = rows.filter((r) => r.rowStatus === 'submitted').length;
  const changes_requested = rows.filter((r) => r.rowStatus === 'changes_requested').length;
  const approved = rows.filter((r) => r.rowStatus === 'approved').length;

  return {
    status: derivedStatus,
    totalRows: total,
    rowCount: total,
    draftRowCount: draft,
    submittedRowCount: submitted,
    changesRequestedRowCount: changes_requested,
    approvedRowCount: approved,
    draftRows: draft,
    submittedRows: submitted,
    changesRequestedRows: changes_requested,
    approvedRows: approved,
    pendingRows: total - approved,
    rowCounts: {
      total,
      draft,
      submitted,
      changes_requested,
      approved,
    },
  };
}

/**
 * Resolve the stored period for a plan.
 * - monthly + `month` ('YYYY-MM'): the whole month. The grid and the fixed wizard
 *   send this, so a stale period end can no longer produce "1/1/2027 - 12/31/2026".
 * - otherwise: dates as given (custom-range monthly plans stay allowed), but the end
 *   may not be before the start.
 */
export function resolvePlanPeriod({ kind = 'monthly', month, periodStart, periodEnd }) {
  if (kind === 'monthly' && month !== undefined && month !== null && month !== '') {
    if (!isMonthKey(month)) {
      const error = new Error('Month must be YYYY-MM.');
      error.statusCode = 400;
      error.code = 'INVALID_PERIOD';
      throw error;
    }
    return { ...monthPeriod(month), month };
  }
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    const error = new Error('Period start and end must be valid dates.');
    error.statusCode = 400;
    error.code = 'INVALID_PERIOD';
    throw error;
  }
  if (end < start) {
    const error = new Error('Period end cannot be before period start.');
    error.statusCode = 400;
    error.code = 'INVALID_PERIOD';
    throw error;
  }
  return { periodStart: start, periodEnd: end, month: kind === 'monthly' ? planMonthKey(start) : null };
}

/**
 * Generate human-friendly default plan title: <Month> <Year> (e.g. 'November 2026')
 */
export function getDefaultPlanTitle(periodStart, calendarKey = 'sm') {
  const date = new Date(periodStart || Date.now());
  const monthName = date.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
  const year = date.getUTCFullYear();
  const calDef = getCalendarDefinition(calendarKey);
  const calName = calDef ? calDef.name : 'SM';
  return `${calName} ${monthName} ${year}`;
}

/**
 * Check for duplicate or overlapping monthly calendar plans
 */
export async function checkPlanPeriodConstraints({
  planId = null,
  kind = 'monthly',
  calendar = 'sm',
  periodStart,
  periodEnd,
}) {
  if (kind !== 'monthly' || !periodStart || !periodEnd) {
    return { warnings: [] };
  }

  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  const startDay = start.toISOString().slice(0, 10);
  const endDay = end.toISOString().slice(0, 10);

  const query = {
    kind: 'monthly',
    calendar: calendar || 'sm',
  };
  if (planId) {
    query._id = { $ne: new mongoose.Types.ObjectId(planId) };
  }

  const existingPlans = await CalendarPlan.find(query).lean();
  const warnings = [];

  for (const existing of existingPlans) {
    if (existing.status === 'cancelled' || existing.status === 'Cancelled') {
      continue;
    }

    const exStart = new Date(existing.periodStart);
    const exEnd = new Date(existing.periodEnd);
    const exStartDay = exStart.toISOString().slice(0, 10);
    const exEndDay = exEnd.toISOString().slice(0, 10);

    // Exact duplicate period check -> block
    if (startDay === exStartDay && endDay === exEndDay) {
      const error = new Error(
        `An active monthly plan already exists for this exact period: ${existing.title} (${existing.code})`
      );
      error.statusCode = 400;
      error.code = 'EXACT_DUPLICATE_PERIOD';
      error.conflictingPlan = {
        _id: existing._id,
        code: existing.code,
        title: existing.title,
      };
      throw error;
    }

    // Overlapping period check: start < exEnd && end > exStart -> warn
    if (start < exEnd && end > exStart) {
      warnings.push({
        code: 'OVERLAPPING_PERIOD',
        message: `Plan period (${startDay} to ${endDay}) overlaps with ${existing.title} (${existing.code}, ${exStartDay} to ${exEndDay}).`,
        overlappingPlanId: existing._id.toString(),
        overlappingPlanCode: existing.code,
        overlappingPlanTitle: existing.title,
      });
    }
  }

  return { warnings };
}

/**
 * List all Calendar Plans with derived status and row counts
 */
export async function listPlans(filters = {}, user) {
  const scope = await resolveScope(user);
  const userRole = normalizeRole(user.role);

  if (userRole === 'team_member') {
    const error = new Error('Team members cannot access calendar plans.');
    error.statusCode = 403;
    error.code = 'FORBIDDEN_SCOPE';
    throw error;
  }

  const query = {};
  if (filters.kind) {
    query.kind = filters.kind;
  }
  if (filters.calendar && filters.calendar !== 'all') {
    query.calendar = filters.calendar;
  }
  if (filters.search) {
    query.$or = [
      { title: new RegExp(filters.search, 'i') },
      { code: new RegExp(filters.search, 'i') },
    ];
  }

  const plans = await CalendarPlan.find(query)
    .populate('createdById', 'name email role')
    .populate('approvedById', 'name email role')
    .sort({ periodStart: -1 })
    .lean();

  // Attach derived status & counts for each plan
  const planIds = plans.map((p) => p._id);
  const allRows = await ContentPiece.find({ planId: { $in: planIds } }).lean();

  const rowsByPlan = {};
  for (const row of allRows) {
    const pId = row.planId.toString();
    if (!rowsByPlan[pId]) rowsByPlan[pId] = [];
    rowsByPlan[pId].push(row);
  }

  // On-read repair for inconsistent plans (zero rows but has submittedAt / approvedAt)
  for (const plan of plans) {
    const rows = rowsByPlan[plan._id.toString()] || [];
    if (rows.length === 0 && (plan.submittedAt || plan.approvedAt)) {
      await CalendarPlan.updateOne(
        { _id: plan._id },
        { $set: { submittedAt: null, approvedAt: null, approvedById: null, rejectionConcern: '' } }
      );
      plan.submittedAt = null;
      plan.approvedAt = null;
      plan.approvedById = null;
    }
  }

  return plans.map((plan) => {
    const rows = rowsByPlan[plan._id.toString()] || [];
    const stats = computePlanRowStats(rows, plan);

    return {
      ...plan,
      ...stats,
    };
  });
}

/**
 * Get a single Calendar Plan with all its rows
 */
export async function getPlanById(id, user) {
  const userRole = normalizeRole(user.role);
  if (userRole === 'team_member') {
    const error = new Error('Team members cannot access calendar plans.');
    error.statusCode = 403;
    error.code = 'FORBIDDEN_SCOPE';
    throw error;
  }

  const plan = await CalendarPlan.findById(id)
    .populate('createdById', 'name email role')
    .populate('approvedById', 'name email role')
    .lean();

  if (!plan) {
    const error = new Error('Calendar plan not found');
    error.statusCode = 404;
    throw error;
  }

  const rows = await ContentPiece.find({ planId: plan._id })
    .populate('postingOwnerId', 'name email role workPreferences')
    .populate('stagePlan.ownerId', 'name email role workPreferences')
    .sort({ postingDate: 1 })
    .lean();

  // On-read repair for single plan
  if (rows.length === 0 && (plan.submittedAt || plan.approvedAt)) {
    await CalendarPlan.updateOne(
      { _id: plan._id },
      { $set: { submittedAt: null, approvedAt: null, approvedById: null, rejectionConcern: '' } }
    );
    plan.submittedAt = null;
    plan.approvedAt = null;
    plan.approvedById = null;
  }

  const stats = computePlanRowStats(rows, plan);
  const work = await planWorkState(rows.map((r) => r._id));

  return {
    ...plan,
    ...stats,
    hasStartedWork: work.started > 0,
    rows,
  };
}

/**
 * Create a new Calendar Plan with optional initial rows
 */
export async function createPlan(data, user) {
  const scope = await resolveScope(user);
  const userRole = normalizeRole(user.role);

  if (userRole !== 'admin' && userRole !== 'sm_manager') {
    const error = new Error('Only SM Manager and Admin can create calendar plans.');
    error.statusCode = 403;
    error.code = 'FORBIDDEN_ROLE';
    throw error;
  }

  const calendar = data.calendar || 'sm';
  const period = resolvePlanPeriod({
    kind: data.kind || 'monthly',
    month: data.month,
    periodStart: data.periodStart,
    periodEnd: data.periodEnd,
  });
  const startDate = period.periodStart;
  const defaultTitle = getDefaultPlanTitle(startDate, calendar);
  const title = (data.title && data.title.trim()) || defaultTitle;

  const { warnings } = await checkPlanPeriodConstraints({
    kind: data.kind || 'monthly',
    calendar,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
  });

  const code = data.code || (await generatePlanCode(period.periodStart));

  const plan = await CalendarPlan.create({
    code,
    title,
    calendar,
    kind: data.kind || 'monthly',
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    createdById: user._id || user.userId,
    comment: data.comment || '',
    rejectionConcern: data.rejectionConcern || '',
    submissionWarnings: warnings,
  });

  const createdRows = [];
  if (Array.isArray(data.rows) && data.rows.length > 0) {
    for (const r of data.rows) {
      const rawType = r.type || r.contentType || 'Static Post';
      const normType = normalizeWorkType(rawType);
      const isReel = normType === 'Reel';
      const needsScript = r.needsScript !== undefined ? Boolean(r.needsScript) : isReel;
      const needsShoot = r.needsShoot !== undefined ? Boolean(r.needsShoot) : isReel;
      const pipelineInfo = getPipelineForContent({
        contentType: normType,
        needsScript,
        needsShoot,
      });

      const piece = await ContentPiece.create({
        planId: plan._id,
        postingDate: new Date(r.postingDate),
        postingTime: r.postingTime || '18:00',
        topic: r.topic,
        type: normType,
        contentType: normType,
        calendar: plan.calendar || 'sm',
        programOrEvent: r.programOrEvent || '',
        brief: r.brief || '',
        referenceLink: r.referenceLink || '',
        priority: priorityInput(r.priority),
        postingOwnerId: r.postingOwnerId || null,
        needsScript,
        needsShoot,
        sourceVideoLink: r.sourceVideoLink || '',
        stagePlan: Array.isArray(r.stagePlan) ? r.stagePlan : [],
        contentLink: r.contentLink || '',
        remarks: r.remarks || '',
        rowStatus: 'draft',
        pipeline: pipelineInfo.pipeline,
        hasPostStage: pipelineInfo.hasPostStage,
        createdById: user._id || user.userId,
      });
      createdRows.push(piece);
    }
  }

  await logActivity({
    entityType: 'calendar_plan',
    entityId: plan._id,
    actor: user,
    action: 'calendar_plan.created',
    metadata: {
      code: plan.code,
      title: plan.title,
      rowsCount: createdRows.length,
    },
  });

  return getPlanById(plan._id, user);
}

/**
 * Update plan metadata (only while Draft or Changes requested)
 */
export async function updatePlan(id, updates, user) {
  const planObj = await getPlanById(id, user);
  if (planObj.status === 'Approved') {
    const error = new Error('Approved plans cannot have their top-level dates modified.');
    error.statusCode = 400;
    error.code = 'INVALID_PLAN_STATUS';
    throw error;
  }

  const allowedUpdates = {};
  if (updates.title !== undefined) allowedUpdates.title = updates.title.trim() || planObj.title;
  if (updates.comment !== undefined) allowedUpdates.comment = updates.comment;
  if (updates.periodStart) allowedUpdates.periodStart = new Date(updates.periodStart);
  if (updates.periodEnd) allowedUpdates.periodEnd = new Date(updates.periodEnd);
  if (updates.kind) allowedUpdates.kind = updates.kind;
  if (updates.calendar) {
    allowedUpdates.calendar = updates.calendar;
    await ContentPiece.updateMany({ planId: id }, { $set: { calendar: updates.calendar } });
    await WorkItem.updateMany({ calendarPlanId: id }, { $set: { calendar: updates.calendar } });
  }

  if (updates.periodStart || updates.periodEnd || updates.kind || updates.month) {
    const newKind = allowedUpdates.kind || planObj.kind;
    const period = resolvePlanPeriod({
      kind: newKind,
      month: updates.month,
      periodStart: allowedUpdates.periodStart || planObj.periodStart,
      periodEnd: allowedUpdates.periodEnd || planObj.periodEnd,
    });
    allowedUpdates.periodStart = period.periodStart;
    allowedUpdates.periodEnd = period.periodEnd;
    const newStart = period.periodStart;
    const newEnd = period.periodEnd;
    const { warnings } = await checkPlanPeriodConstraints({
      planId: id,
      kind: newKind,
      calendar: allowedUpdates.calendar || planObj.calendar || 'sm',
      periodStart: newStart,
      periodEnd: newEnd,
    });
    allowedUpdates.submissionWarnings = warnings;
  }

  const updated = await CalendarPlan.findByIdAndUpdate(id, allowedUpdates, { new: true });
  return getPlanById(updated._id, user);
}

/**
 * Add rows to an existing plan
 * New rows start as 'draft'
 */
export async function addRowsToPlan(id, rows, user) {
  const plan = await CalendarPlan.findById(id);
  if (!plan) {
    const error = new Error('Calendar plan not found');
    error.statusCode = 404;
    throw error;
  }

  const scope = await resolveScope(user);
  const smManager = (await Person.findOne({ role: 'sm_manager', status: 'active' }).lean()) || user;
  const defaultPosterId = (smManager?._id || user._id || user.userId)?.toString();

  // Validate incoming rows
  const validation = await validatePlanAndRows({
    plan,
    rows: rows.map((r) => {
      const rawType = r.type || r.contentType || 'Static Post';
      const normType = normalizeWorkType(rawType);
      let needsScript = Boolean(r.needsScript);
      let needsShoot = Boolean(r.needsShoot);
      if (rawType.toLowerCase() === 'reel a') {
        needsScript = true;
        needsShoot = true;
      } else if (rawType.toLowerCase() === 'reel b') {
        needsScript = false;
        needsShoot = true;
      } else if (rawType.toLowerCase() === 'reel c') {
        needsScript = false;
        needsShoot = false;
      }
      const pipelineInfo = getPipelineForContent({
        contentType: normType,
        needsScript,
        needsShoot,
      });
      const derivedBrief =
        (r.brief && String(r.brief).trim()) ||
        (r.remarks && String(r.remarks).trim()) ||
        (r.contentLink && String(r.contentLink).trim()) ||
        (r.topic ? `Brief for ${r.topic}` : '');
      const postingOwnerId =
        r.postingOwnerId && mongoose.isValidObjectId(r.postingOwnerId)
          ? r.postingOwnerId
          : pipelineInfo.hasPostStage && defaultPosterId && mongoose.isValidObjectId(defaultPosterId)
            ? defaultPosterId
            : null;

      return {
        ...r,
        contentType: normType,
        needsScript,
        needsShoot,
        brief: derivedBrief,
        postingOwnerId,
      };
    }),
    isSubmitting: false,
  });

  if (!validation.isValid) {
    const error = new Error(`Validation failed for rows: ${validation.errors.map((e) => e.message).join('; ')}`);
    error.statusCode = 400;
    error.code = 'PLAN_VALIDATION_FAILED';
    error.errors = validation.errors;
    error.warnings = validation.warnings;
    throw error;
  }

  const createdRows = [];

  for (const r of rows) {
    const rawType = r.type || r.contentType || 'Static Post';
    const normType = normalizeWorkType(rawType);
    let needsScript = Boolean(r.needsScript);
    let needsShoot = Boolean(r.needsShoot);

    if (rawType.toLowerCase() === 'reel a') {
      needsScript = true;
      needsShoot = true;
    } else if (rawType.toLowerCase() === 'reel b') {
      needsScript = false;
      needsShoot = true;
    } else if (rawType.toLowerCase() === 'reel c') {
      needsScript = false;
      needsShoot = false;
    }

    const pipelineInfo = getPipelineForContent({
      contentType: normType,
      needsScript,
      needsShoot,
    });

    const derivedBrief =
      (r.brief && String(r.brief).trim()) ||
      (r.remarks && String(r.remarks).trim()) ||
      (r.contentLink && String(r.contentLink).trim()) ||
      (r.topic ? `Brief for ${r.topic}` : '');

    const postingOwnerId =
      r.postingOwnerId && mongoose.isValidObjectId(r.postingOwnerId)
        ? r.postingOwnerId
        : pipelineInfo.hasPostStage && defaultPosterId && mongoose.isValidObjectId(defaultPosterId)
          ? defaultPosterId
          : null;

    const piece = await ContentPiece.create({
      planId: plan._id,
      postingDate: new Date(r.postingDate),
      postingTime: r.postingTime || '18:00',
      topic: r.topic,
      type: normType,
      contentType: normType,
      calendar: plan.calendar || 'sm',
      programOrEvent: r.programOrEvent || '',
      brief: derivedBrief,
      referenceLink: r.referenceLink || '',
      priority: priorityInput(r.priority),
      postingOwnerId,
      needsScript,
      needsShoot,
      sourceVideoLink: r.sourceVideoLink || '',
      stagePlan: Array.isArray(r.stagePlan) ? r.stagePlan : [],
      contentLink: r.contentLink || '',
      remarks: r.remarks || '',
      rowStatus: 'draft',
      pipeline: pipelineInfo.pipeline,
      hasPostStage: pipelineInfo.hasPostStage,
      createdById: user._id || user.userId,
    });
    createdRows.push(piece);
  }

  await logActivity({
    entityType: 'calendar_plan',
    entityId: plan._id,
    actor: user,
    action: 'calendar_plan.rows_added',
    metadata: {
      addedCount: createdRows.length,
    },
  });

  return getPlanById(plan._id, user);
}

/**
 * Update a specific row (only if Draft or Changes requested)
 */
export async function updateRow(planId, rowId, updates, user) {
  const piece = await ContentPiece.findOne({ _id: rowId, planId });
  if (!piece) {
    const error = new Error('Content piece row not found in this plan');
    error.statusCode = 404;
    throw error;
  }

  if (piece.rowStatus === 'approved') {
    const error = new Error('Approved rows cannot be edited directly.');
    error.statusCode = 400;
    error.code = 'ROW_ALREADY_APPROVED';
    throw error;
  }

  if (updates.topic) piece.topic = updates.topic;
  if (updates.postingDate) piece.postingDate = new Date(updates.postingDate);
  if (updates.postingTime !== undefined) piece.postingTime = updates.postingTime;
  if (updates.type) piece.type = updates.type;
  if (updates.calendar) piece.calendar = updates.calendar;
  if (updates.programOrEvent !== undefined) piece.programOrEvent = updates.programOrEvent;
  if (updates.brief !== undefined) piece.brief = updates.brief;
  if (updates.referenceLink !== undefined) piece.referenceLink = updates.referenceLink;
  // Normal or Urgent only; resending a row's stored older value leaves it unchanged.
  if (updates.priority !== undefined && updates.priority !== piece.priority) piece.priority = priorityInput(updates.priority);
  if (updates.postingOwnerId !== undefined) piece.postingOwnerId = updates.postingOwnerId;
  if (updates.sourceVideoLink !== undefined) piece.sourceVideoLink = updates.sourceVideoLink;
  if (updates.stagePlan !== undefined) piece.stagePlan = updates.stagePlan;
  if (updates.contentLink !== undefined) piece.contentLink = updates.contentLink;
  if (updates.remarks !== undefined) piece.remarks = updates.remarks;

  const rawType = updates.type || updates.contentType || piece.type || piece.contentType;
  if (rawType || updates.needsScript !== undefined || updates.needsShoot !== undefined) {
    const normType = normalizeWorkType(rawType);
    piece.contentType = normType;
    if (updates.type) piece.type = updates.type;
    if (updates.needsScript !== undefined) piece.needsScript = Boolean(updates.needsScript);
    if (updates.needsShoot !== undefined) piece.needsShoot = Boolean(updates.needsShoot);

    const pipelineInfo = getPipelineForContent({
      contentType: normType,
      needsScript: piece.needsScript,
      needsShoot: piece.needsShoot,
    });
    piece.pipeline = pipelineInfo.pipeline;
    piece.hasPostStage = pipelineInfo.hasPostStage;
  }

  await piece.save();
  return piece;
}

/**
 * Delete a specific row (only if not approved)
 */
/** A row's priority from input: Normal (default) or Urgent; anything else is a 400. */
function priorityInput(value) {
  const parsed = parsePriorityInput(value);
  if (parsed === null) {
    const error = new Error('Priority must be Normal or Urgent.');
    error.statusCode = 400;
    error.code = 'INVALID_PRIORITY';
    throw error;
  }
  return parsed || 'Normal';
}

export const ROW_STARTED_MESSAGE = "This post has started work and can't be deleted.";

/**
 * Delete one row (SM Manager and Admin). An unapproved row is simply removed. An approved
 * row can be removed only while none of its steps has started (same rule as plan delete,
 * Phase 6): its unstarted steps go with it, and their owners are told the post was removed.
 */
export async function deleteRow(planId, rowId, user) {
  const userRole = normalizeRole(user.role);
  if (userRole !== 'admin' && userRole !== 'sm_manager') {
    const error = new Error('Only SM Manager and Admin can delete plan rows.');
    error.statusCode = 403;
    error.code = 'FORBIDDEN_ROLE';
    throw error;
  }
  const plan = await CalendarPlan.findById(planId);
  if (!plan) {
    const error = new Error('Calendar plan not found');
    error.statusCode = 404;
    throw error;
  }
  const piece = await ContentPiece.findOne({ _id: rowId, planId });
  if (!piece) {
    const error = new Error('Content piece row not found in this plan');
    error.statusCode = 404;
    throw error;
  }

  // Steps exist only once a row is approved; checked for every row so none is ever left behind.
  const work = await planWorkState([piece._id]);
  if (work.started > 0) {
    const error = new Error(ROW_STARTED_MESSAGE);
    error.statusCode = 409;
    error.code = 'ROW_HAS_STARTED_WORK';
    throw error;
  }
  const steps = work.ids.length
    ? await WorkItem.find({ _id: { $in: work.ids } }).select('_id ownerId stageKey').lean()
    : [];
  // Only steps still unstarted are matched, so a step that starts meanwhile is never removed.
  const removedSteps = work.ids.length
    ? (await WorkItem.deleteMany({ _id: { $in: work.ids }, ...UNSTARTED_STEP })).deletedCount
    : 0;
  await ContentPiece.findByIdAndDelete(piece._id);

  const dateLabel = formatGridDate(istDateKey(piece.postingDate) || '');
  await logActivity({
    entityType: 'calendar_plan',
    entityId: plan._id,
    actor: user,
    action: 'calendar_plan.row_deleted',
    metadata: {
      rowId: String(piece._id),
      topic: piece.topic,
      postingDate: istDateKey(piece.postingDate),
      rowStatus: piece.rowStatus,
      deletedWorkItemsCount: removedSteps,
    },
  });

  // One notice per owner of a removed step (the person deleting is not notified).
  const actorId = String(user._id || user.id || user.userId || '');
  const stepsByOwner = new Map();
  for (const st of steps) {
    if (!st.ownerId || String(st.ownerId) === actorId) continue;
    const k = String(st.ownerId);
    if (!stepsByOwner.has(k)) stepsByOwner.set(k, []);
    stepsByOwner.get(k).push(st.stageKey);
  }
  for (const [ownerId, stageKeys] of stepsByOwner) {
    const stepWord = stageKeys.length === 1 ? 'step' : 'steps';
    await createNotification({
      recipient: ownerId,
      type: 'step_removed',
      title: 'Post removed from the plan',
      message: `"${piece.topic}" (${dateLabel}) was removed from ${plan.title}. Your ${stageKeys.join(', ')} ${stepWord} for it ${stageKeys.length === 1 ? 'is' : 'are'} no longer needed.`,
      link: '/my-work',
      metadata: { planId: plan._id, contentPieceId: piece._id, stageKeys },
    });
  }

  return getPlanById(planId, user);
}

/**
 * Submit or Resubmit a single deliverable row
 */
export async function submitRow(planId, rowId, user) {
  const plan = await CalendarPlan.findById(planId);
  if (!plan) {
    const error = new Error('Calendar plan not found');
    error.statusCode = 404;
    throw error;
  }
  const piece = await ContentPiece.findOne({ _id: rowId, planId });
  if (!piece) {
    const error = new Error('Content piece row not found in this plan');
    error.statusCode = 404;
    throw error;
  }
  if (piece.rowStatus === 'approved') {
    const error = new Error('Approved rows cannot be resubmitted.');
    error.statusCode = 400;
    error.code = 'ROW_ALREADY_APPROVED';
    throw error;
  }

  // Auto-heal brief if empty
  if (!piece.brief || !String(piece.brief).trim()) {
    piece.brief =
      (piece.remarks && String(piece.remarks).trim()) ||
      (piece.contentLink && String(piece.contentLink).trim()) ||
      (piece.topic ? `Brief for ${piece.topic}` : 'Deliverable brief');
  }

  piece.rowStatus = 'submitted';
  piece.reviewComment = null;
  await piece.save();

  plan.submittedAt = new Date();
  plan.rejectionConcern = '';
  await plan.save();

  // Notify Creative Heads
  const creativeHeads = await Person.find({ role: 'creative_head', status: 'active' });
  for (const ch of creativeHeads) {
    await createNotification({
      recipient: ch._id,
      type: 'plan_submitted',
      title: 'Deliverable Row Resubmitted for Review',
      message: `"${piece.topic}" in ${plan.title} (${plan.code}) was resubmitted by ${user.name || 'SM Manager'}.`,
      link: `/calendar?tab=plans&planId=${plan._id}`,
      metadata: { planId: plan._id, code: plan.code, rowId: piece._id },
    });
  }

  await logActivity({
    entityType: 'calendar_plan',
    entityId: plan._id,
    actor: user,
    action: 'calendar_plan.row_submitted',
    metadata: { rowId: piece._id, topic: piece.topic },
  });

  return getPlanById(plan._id, user);
}

/**
 * Submit Calendar Plan
 * Moves draft and changes_requested rows to 'submitted'
 * Notifies all Creative Heads
 */
export async function submitPlan(id, user) {
  const plan = await CalendarPlan.findById(id);
  if (!plan) {
    const error = new Error('Calendar plan not found');
    error.statusCode = 404;
    throw error;
  }

  // Auto-heal incomplete draft rows before validation
  const smManager = (await Person.findOne({ role: 'sm_manager', status: 'active' }).lean()) || user;
  const defaultPosterId = (smManager?._id || user._id || user.userId)?.toString();

  const existingRows = await ContentPiece.find({ planId: plan._id });
  for (const row of existingRows) {
    let changed = false;
    const rawType = (row.type || row.contentType || '').trim();
    const norm = normalizeWorkType(rawType);

    if (norm && norm !== row.type) {
      row.type = norm;
      changed = true;
    }
    if (norm && norm !== row.contentType) {
      row.contentType = norm;
      changed = true;
    }

    if (rawType.toLowerCase() === 'reel a') {
      row.needsScript = true;
      row.needsShoot = true;
      changed = true;
    } else if (rawType.toLowerCase() === 'reel b') {
      row.needsScript = false;
      row.needsShoot = true;
      changed = true;
    } else if (rawType.toLowerCase() === 'reel c') {
      row.needsScript = false;
      row.needsShoot = false;
      changed = true;
    } else if (norm === 'Reel' && !row.needsShoot && !row.sourceVideoLink) {
      row.needsShoot = true;
      if (row.needsScript === undefined) {
        row.needsScript = true;
      }
      changed = true;
    }

    if (!row.brief || !String(row.brief).trim()) {
      row.brief =
        (row.remarks && String(row.remarks).trim()) ||
        (row.contentLink && String(row.contentLink).trim()) ||
        (row.topic ? `Brief for ${row.topic}` : 'Deliverable brief');
      changed = true;
    }

    if (!row.calendar) {
      row.calendar = plan.calendar || 'sm';
      changed = true;
    }

    const effectiveType = norm || rawType;
    if (
      isPostableWorkType(effectiveType) &&
      !row.postingOwnerId &&
      defaultPosterId &&
      mongoose.isValidObjectId(defaultPosterId)
    ) {
      row.postingOwnerId = defaultPosterId;
      changed = true;
    }

    if (changed) {
      await row.save();
    }
  }

  const rows = await ContentPiece.find({ planId: plan._id }).lean();
  if (!rows || rows.length === 0) {
    const error = new Error('Add at least one row');
    error.statusCode = 400;
    error.code = 'PLAN_EMPTY_ROWS';
    throw error;
  }
  const validation = await validatePlanAndRows({
    plan,
    rows,
    isSubmitting: true,
  });

  if (!validation.isValid) {
    const error = new Error(
      `Cannot submit plan: ${validation.errors.map((e) => e.message).join('; ')}`
    );
    error.statusCode = 400;
    error.code = 'PLAN_SUBMISSION_BLOCKED';
    error.validationErrors = validation.errors;
    error.validationWarnings = validation.warnings;
    throw error;
  }

  plan.submissionWarnings = validation.warnings || [];

  const updatedRows = await ContentPiece.updateMany(
    { planId: plan._id, rowStatus: { $in: ['draft', 'changes_requested'] } },
    { $set: { rowStatus: 'submitted', reviewComment: null } }
  );

  plan.submittedAt = new Date();
  plan.rejectionConcern = '';
  await plan.save();

  // Notify every creative_head
  const creativeHeads = await Person.find({ role: 'creative_head', status: 'active' });
  for (const ch of creativeHeads) {
    await createNotification({
      recipient: ch._id,
      type: 'plan_submitted',
      title: 'Calendar Plan Submitted for Review',
      message: `${plan.title} (${plan.code}) submitted by ${user.name || 'SM Manager'}.`,
      link: `/feedback?tab=plans&planId=${plan._id}`,
      metadata: { planId: plan._id, code: plan.code },
    });
  }

  await logActivity({
    entityType: 'calendar_plan',
    entityId: plan._id,
    actor: user,
    action: 'calendar_plan.submitted',
    metadata: {
      code: plan.code,
      title: plan.title,
      submittedRowsCount: updatedRows.modifiedCount,
    },
  });

  return getPlanById(plan._id, user);
}

/**
 * Resolve fallback department for a stage or workType
 */
async function getDepartmentForStage(stageKey, workType) {
  let deptCode = 'design';
  if (stageKey === 'Content' || stageKey === 'Script') deptCode = 'seo_content';
  else if (stageKey === 'Shoot' || stageKey === 'Edit') deptCode = 'video_production';
  else if (stageKey === 'Post') deptCode = 'social_media';
  else if (WORK_TYPE_DEPARTMENT_MAP[workType]) deptCode = WORK_TYPE_DEPARTMENT_MAP[workType];

  let dept = await Department.findOne({ code: deptCode });
  if (!dept) {
    dept = await Department.findOne();
  }
  return dept?._id;
}

/**
 * Auto-generate WorkItem stages for an approved row
 * Stage 1 is unlocked, stages 2+ are locked
 */
export async function generateStagesForApprovedRow(piece, user) {
  if (piece.stagesGenerated) {
    return [];
  }

  const pipelineInfo = getPipelineForContent({
    contentType: piece.contentType,
    needsScript: piece.needsScript,
    needsShoot: piece.needsShoot,
  });

  const stages = pipelineInfo.stages;
  const createdStages = [];
  const defaultDeptId = await getDepartmentForStage('Design', piece.contentType);
  const now = new Date();

  const stagePlanMap = new Map();
  if (Array.isArray(piece.stagePlan)) {
    for (const sp of piece.stagePlan) {
      if (sp && sp.stageKey) {
        stagePlanMap.set(sp.stageKey, sp);
      }
    }
  }

  for (let idx = 0; idx < stages.length; idx++) {
    const stageKey = stages[idx];
    const stageOrder = idx + 1;
    const isFirstStage = stageOrder === 1;
    const isReview = REVIEW_STAGES.includes(stageKey);

    const plannedStage = stagePlanMap.get(stageKey);

    let dueDate = calculateStageDueDate(
      piece.postingDate,
      pipelineInfo.pipeline,
      stageKey,
      pipelineInfo.hasPostStage
    );
    if (plannedStage?.dueDate) {
      dueDate = new Date(plannedStage.dueDate);
    }

    const assignedOwnerId = plannedStage?.ownerId || null;
    const stageDeptId = await getDepartmentForStage(stageKey, piece.contentType);

    const workItem = await WorkItem.create({
      title: `${piece.topic} - ${stageKey}`,
      workType: piece.contentType,
      departmentId: stageDeptId || defaultDeptId,
      ownerId: assignedOwnerId,
      deadline: dueDate,
      dueDate,
      estimatedEffortHrs: DEFAULT_STAGE_HOURS[stageKey] || 4,
      status: 'Not Started',
      priority: piece.priority || 'Normal',
      calendarPlanId: piece.planId,
      calendar: piece.calendar || plan.calendar || 'sm',
      contentPieceId: piece._id,
      stageKey,
      stageOrder,
      reviewRequired: isReview,
      isLocked: !isFirstStage,
      unlockedAt: isFirstStage ? now : null,
      isSkipped: false,
      deliverableUrl: piece.contentLink || '',
      assignedAt: assignedOwnerId ? now : null,
      ownerSource: plannedStage?.ownerSource || 'suggested',
      dueDateSource: plannedStage?.dueDateSource || 'auto',
    });

    createdStages.push(workItem);

    if (isFirstStage && assignedOwnerId) {
      await createNotification({
        recipient: assignedOwnerId,
        type: 'stage_unlocked',
        title: 'Work Ready to Start',
        message: `Your stage ${stageKey} for "${piece.topic}" is unlocked and ready to start. Due date: ${dueDate.toISOString().slice(0, 10)}.`,
        link: `/my-work?id=${workItem._id}`,
        metadata: { workItemId: workItem._id, contentPieceId: piece._id },
      });
    }
  }

  piece.stagesGenerated = true;
  await piece.save();

  // For unassigned stages, attempt recommendation
  for (const stageItem of createdStages) {
    if (!stageItem.ownerId) {
      try {
        const rec = await recommendAssignee(
          {
            workType: piece.contentType,
            stageKey: stageItem.stageKey,
            deadline: stageItem.dueDate,
            workItemId: stageItem._id,
          },
          user
        );
        if (
          rec &&
          rec.recommendedPerson &&
          !rec.isOverloadWarning &&
          (rec.recommendedMetrics?.workloadPct ?? 0) < 85
        ) {
          stageItem.recommendedOwnerId = rec.recommendedPerson._id;
          await stageItem.save();
        }
      } catch {
        // Non-blocking recommendation computation
      }
    }
  }

  return createdStages;
}

/**
 * Creative Head Review
 * Actions: approve_all | approve_selected | request_changes | reject
 */
export async function reviewPlan(id, reviewData, user) {
  const userRole = normalizeRole(user.role);
  // PG-3: plan row review (approve, request changes, reject) is the Creative Head's alone.
  // Admin keeps every other permission; step reviews in transition.service are unchanged.
  if (userRole !== 'creative_head') {
    const error = new Error('Plan rows can be reviewed only by the Creative Head.');
    error.statusCode = 403;
    error.code = 'FORBIDDEN_APPROVAL';
    throw error;
  }

  const plan = await CalendarPlan.findById(id);
  if (!plan) {
    const error = new Error('Calendar plan not found');
    error.statusCode = 404;
    throw error;
  }

  let { action, approvedRowIds = [], selectedRowIds = [], changes = [], comments = {} } = reviewData;
  if ((!approvedRowIds || approvedRowIds.length === 0) && Array.isArray(selectedRowIds) && selectedRowIds.length > 0) {
    approvedRowIds = selectedRowIds;
  }
  if ((!changes || changes.length === 0) && comments && Object.keys(comments).length > 0) {
    changes = Object.entries(comments).map(([rowId, comment]) => ({ rowId, comment }));
  }
  const rowsToApprove = [];
  const changesRequestedRows = [];

  if (action === 'approve_all') {
    const allRows = await ContentPiece.find({ planId: plan._id });
    for (const row of allRows) {
      row.rowStatus = 'approved';
      row.reviewComment = null;
      await row.save();
      rowsToApprove.push(row);
    }
  } else if (action === 'approve_selected') {
    if (!Array.isArray(approvedRowIds) || approvedRowIds.length === 0) {
      const error = new Error('approvedRowIds array is required for approve_selected action');
      error.statusCode = 400;
      throw error;
    }
    const rows = await ContentPiece.find({ _id: { $in: approvedRowIds }, planId: plan._id });
    for (const row of rows) {
      row.rowStatus = 'approved';
      row.reviewComment = null;
      await row.save();
      rowsToApprove.push(row);
    }
  } else if (action === 'request_changes') {
    if (!Array.isArray(changes) || changes.length === 0) {
      const error = new Error('changes array with rowId and comment is required');
      error.statusCode = 400;
      throw error;
    }
    for (const ch of changes) {
      const row = await ContentPiece.findOne({ _id: ch.rowId, planId: plan._id });
      if (row) {
        row.rowStatus = 'changes_requested';
        row.reviewComment = ch.comment;
        await row.save();
        changesRequestedRows.push(row);
      }
    }
  } else if (action === 'reject') {
    const concern = reviewData.rejectionConcern || reviewData.concern || reviewData.comment;
    if (!concern || !concern.trim()) {
      const error = new Error('Rejection concern is required when rejecting the whole plan.');
      error.statusCode = 400;
      error.code = 'REJECTION_CONCERN_REQUIRED';
      throw error;
    }
    plan.rejectionConcern = concern.trim();
    const rows = await ContentPiece.find({ planId: plan._id, rowStatus: 'submitted' });
    for (const row of rows) {
      row.rowStatus = 'changes_requested';
      row.reviewComment = concern.trim();
      await row.save();
      changesRequestedRows.push(row);
    }
    await plan.save();
  }

  // Generate Stage WorkItems ONLY for newly approved rows
  for (const approvedRow of rowsToApprove) {
    await generateStagesForApprovedRow(approvedRow, user);
  }

  // Update plan approval timestamp if anything was approved
  if (rowsToApprove.length > 0) {
    plan.approvedById = user._id || user.userId;
    plan.approvedAt = new Date();
    await plan.save();
  }

  // Notify SM Manager who created the plan
  if (plan.createdById) {
    let notifTitle = 'Calendar Plan Approved';
    let notifMsg = `Your calendar plan ${plan.title} (${plan.code}) was approved.`;

    if (action === 'reject') {
      notifTitle = 'Calendar Plan Rejected';
      notifMsg = `Entire plan rejected by Creative Head: ${plan.rejectionConcern || 'Strategic concern'}.`;
    } else if (action === 'request_changes') {
      notifTitle = 'Changes Requested on Calendar Plan';
      notifMsg = `Creative Head requested changes on ${changesRequestedRows.length} row(s) in ${plan.title}.`;
    } else if (action === 'approve_selected') {
      notifTitle = 'Calendar Plan Partially Approved';
      notifMsg = `${rowsToApprove.length} row(s) approved in ${plan.title}.`;
    }

    await createNotification({
      recipient: plan.createdById,
      type: action === 'request_changes' || action === 'reject' ? 'plan_changes_requested' : 'plan_approved',
      title: notifTitle,
      message: notifMsg,
      link: `/calendar?tab=plans&planId=${plan._id}`,
      metadata: { planId: plan._id, action },
    });
  }

  await logActivity({
    entityType: 'calendar_plan',
    entityId: plan._id,
    actor: user,
    action: `calendar_plan.${action}`,
    metadata: {
      code: plan.code,
      approvedCount: rowsToApprove.length,
      changesCount: changesRequestedRows.length,
    },
  });

  return getPlanById(plan._id, user);
}

/**
 * Delete a Draft calendar plan that has no approved rows
 */
/** A step that has not started: never moved on from Not Started, no start time, no submission. */
const UNSTARTED_STEP = { status: 'Not Started', startedAt: null };

/**
 * The steps generated for a plan's rows, and how many of them have started (Phase 6).
 * A step has started once it left Not Started, has a start time, or has any submission.
 */
export async function planWorkState(pieceIds) {
  if (!pieceIds.length) return { ids: [], started: 0 };
  const steps = await WorkItem.find({ contentPieceId: { $in: pieceIds } }).select('_id status startedAt').lean();
  const ids = steps.map((s) => s._id);
  let started = steps.filter((s) => s.status !== 'Not Started' || s.startedAt).length;
  if (!started && ids.length) {
    const { Submission } = await import('../submissions/model.js');
    started = await Submission.countDocuments({ workItemId: { $in: ids } });
  }
  return { ids, started };
}

export async function deletePlan(id, user) {
  const userRole = normalizeRole(user.role);
  if (userRole !== 'admin' && userRole !== 'sm_manager') {
    const error = new Error('Only SM Manager and Admin can delete calendar plans.');
    error.statusCode = 403;
    error.code = 'FORBIDDEN_ROLE';
    throw error;
  }

  const plan = await CalendarPlan.findById(id);
  if (!plan) {
    const error = new Error('Calendar plan not found');
    error.statusCode = 404;
    throw error;
  }

  const rows = await ContentPiece.find({ planId: plan._id }).select('_id').lean();
  const pieceIds = rows.map((r) => r._id);
  const work = await planWorkState(pieceIds);
  if (work.started > 0) {
    const error = new Error('This plan has work that has already started, so it cannot be deleted.');
    error.statusCode = 409;
    error.code = 'PLAN_HAS_STARTED_WORK';
    throw error;
  }

  // Nothing has started: remove the plan's unstarted steps, then its rows, then the plan.
  // Only steps still unstarted are matched, so a step that starts meanwhile is never removed.
  const removedSteps = work.ids.length
    ? (await WorkItem.deleteMany({ _id: { $in: work.ids }, ...UNSTARTED_STEP })).deletedCount
    : 0;
  await ContentPiece.deleteMany({ planId: plan._id });
  await CalendarPlan.findByIdAndDelete(plan._id);

  await logActivity({
    entityType: 'calendar_plan',
    entityId: plan._id.toString(),
    actor: user,
    action: 'calendar_plan.deleted',
    metadata: {
      code: plan.code,
      title: plan.title,
      deletedRowsCount: rows.length,
      deletedWorkItemsCount: removedSteps,
    },
  });

  return { _id: plan._id, code: plan.code, title: plan.title };
}

/**
 * One-time repair utility for plans with inconsistent stored/derived states
 */
export async function repairInconsistentPlanStatuses() {
  const plans = await CalendarPlan.find({});
  const repairedPlans = [];

  for (const plan of plans) {
    const rows = await ContentPiece.find({ planId: plan._id }).lean();
    let modified = false;
    const changes = [];

    // Plans with 0 rows must never be submitted or approved
    if (rows.length === 0) {
      if (plan.submittedAt) {
        changes.push(`cleared submittedAt (${plan.submittedAt.toISOString ? plan.submittedAt.toISOString() : plan.submittedAt})`);
        plan.submittedAt = null;
        modified = true;
      }
      if (plan.approvedAt) {
        changes.push(`cleared approvedAt (${plan.approvedAt.toISOString ? plan.approvedAt.toISOString() : plan.approvedAt})`);
        plan.approvedAt = null;
        modified = true;
      }
      if (plan.approvedById) {
        changes.push(`cleared approvedById (${plan.approvedById})`);
        plan.approvedById = null;
        modified = true;
      }
      if (plan.rejectionConcern) {
        changes.push('cleared rejectionConcern');
        plan.rejectionConcern = '';
        modified = true;
      }
    } else {
      const derivedStatus = derivePlanStatus(rows, plan.submittedAt);
      if (derivedStatus === 'Draft' && (plan.submittedAt || plan.approvedAt)) {
        if (plan.submittedAt) {
          changes.push('cleared submittedAt');
          plan.submittedAt = null;
          modified = true;
        }
        if (plan.approvedAt) {
          changes.push('cleared approvedAt');
          plan.approvedAt = null;
          modified = true;
        }
        if (plan.approvedById) {
          changes.push('cleared approvedById');
          plan.approvedById = null;
          modified = true;
        }
      }
    }

    if (modified) {
      await plan.save();
      console.log(`[repairInconsistentPlanStatuses] Repaired plan ${plan.code} (${plan.title}): ${changes.join(', ')}`);
      repairedPlans.push({
        _id: plan._id,
        code: plan.code,
        title: plan.title,
        changes,
      });
    }
  }

  return { repairedCount: repairedPlans.length, repairedPlans };
}


/**
 * Move a calendar plan (and its content pieces & work items) to a different calendar.
 * If Draft or Changes requested: SM Manager, Admin, or creator can move.
 * If Approved: strictly SM Manager and Admin only (logged and notified).
 */
export async function movePlanCalendar(id, newCalendar, user) {
  const userRole = normalizeRole(user.role);
  const plan = await CalendarPlan.findById(id);
  if (!plan) {
    const error = new Error('Calendar plan not found');
    error.statusCode = 404;
    throw error;
  }

  if (!CALENDAR_KEYS.includes(newCalendar)) {
    const error = new Error(`Invalid calendar key: ${newCalendar}`);
    error.statusCode = 400;
    throw error;
  }

  const rows = await ContentPiece.find({ planId: plan._id }).lean();
  const derivedStats = computePlanRowStats(rows, plan);
  const isApproved = derivedStats.status === 'Approved' || derivedStats.status === 'Approved with pending rows';

  if (isApproved && userRole !== 'sm_manager' && userRole !== 'admin') {
    const error = new Error('Only SM Manager and Admin can move an approved plan to another calendar.');
    error.statusCode = 403;
    error.code = 'FORBIDDEN_MOVE';
    throw error;
  }

  const oldCalendar = plan.calendar || 'sm';
  if (oldCalendar === newCalendar) {
    return getPlanById(plan._id, user);
  }

  plan.calendar = newCalendar;
  await plan.save();

  // Update all child content pieces and work items
  await ContentPiece.updateMany({ planId: plan._id }, { $set: { calendar: newCalendar } });
  await WorkItem.updateMany({ calendarPlanId: plan._id }, { $set: { calendar: newCalendar } });

  // Log activity
  await logActivity({
    entityType: 'calendar_plan',
    entityId: plan._id,
    action: 'plan.calendar_moved',
    actor: user,
    metadata: {
      fromCalendar: oldCalendar,
      toCalendar: newCalendar,
      planTitle: plan.title,
      code: plan.code,
    },
  });

  // Create notification
  const notifyRoles = ['creative_head'];
  if (userRole !== 'sm_manager') notifyRoles.push('sm_manager');
  const notifyUsers = await Person.find({ role: { $in: notifyRoles }, status: 'active' }).lean();
  for (const recipient of notifyUsers) {
    await createNotification({
      recipient: recipient._id,
      type: 'plan_calendar_moved',
      title: 'Plan moved to another calendar',
      message: `Plan "${plan.title}" (${plan.code}) was moved from ${getCalendarDefinition(oldCalendar).name} to ${getCalendarDefinition(newCalendar).name} by ${user.name || 'User'}.`,
      link: `/calendar?tab=plans&planId=${plan._id}`,
      metadata: { planId: plan._id, code: plan.code },
    });
  }

  return getPlanById(plan._id, user);
}
