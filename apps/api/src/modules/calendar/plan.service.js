import mongoose from 'mongoose';
import { CalendarPlan } from './plan.model.js';
import { ContentPiece } from './contentPiece.model.js';
import { WorkItem } from '../workItems/model.js';
import { Person } from '../people/model.js';
import { Department } from '../departments/model.js';
import { logActivity } from '../activity/service.js';
import { createNotification } from '../notifications/service.js';
import { resolveScope } from '../../lib/scope.js';
import {
  derivePlanStatus,
  getPipelineForContent,
  calculateStageDueDate,
  REVIEW_STAGES,
  normalizeRole,
  normalizeWorkType,
  WORK_TYPE_DEPARTMENT_MAP,
} from '@mmp/shared';
import { recommendAssignee } from '../assignment/service.js';

/**
 * Generate sequential unique plan code: PLAN-YYYY-MM-001
 */
export async function generatePlanCode(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const prefix = `PLAN-${year}-${month}`;
  const count = await CalendarPlan.countDocuments({ code: new RegExp(`^${prefix}`) });
  const seq = String(count + 1).padStart(3, '0');
  return `${prefix}-${seq}`;
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
  if (scope.brandProfileId) {
    query.profileId = scope.brandProfileId;
  }
  if (filters.kind) {
    query.kind = filters.kind;
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

  return plans.map((plan) => {
    const rows = rowsByPlan[plan._id.toString()] || [];
    const derivedStatus = derivePlanStatus(rows, plan.submittedAt);
    const approvedRows = rows.filter((r) => r.rowStatus === 'approved').length;
    const pendingRows = rows.filter((r) => r.rowStatus !== 'approved').length;

    return {
      ...plan,
      status: derivedStatus,
      totalRows: rows.length,
      approvedRows,
      pendingRows,
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
    .sort({ postingDate: 1 })
    .lean();

  const derivedStatus = derivePlanStatus(rows, plan.submittedAt);

  return {
    ...plan,
    status: derivedStatus,
    totalRows: rows.length,
    approvedRows: rows.filter((r) => r.rowStatus === 'approved').length,
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

  const code = data.code || (await generatePlanCode(new Date(data.periodStart)));

  const plan = await CalendarPlan.create({
    code,
    title: data.title,
    kind: data.kind || 'monthly',
    periodStart: new Date(data.periodStart),
    periodEnd: new Date(data.periodEnd),
    createdById: user._id || user.userId,
    profileId: scope.brandProfileId || null,
    comment: data.comment || '',
  });

  const createdRows = [];
  if (Array.isArray(data.rows) && data.rows.length > 0) {
    for (const r of data.rows) {
      const pipelineInfo = getPipelineForContent({
        contentType: r.contentType,
        needsScript: r.needsScript,
        needsShoot: r.needsShoot,
      });

      const piece = await ContentPiece.create({
        planId: plan._id,
        postingDate: new Date(r.postingDate),
        topic: r.topic,
        contentType: normalizeWorkType(r.contentType),
        needsScript: Boolean(r.needsScript),
        needsShoot: Boolean(r.needsShoot),
        contentLink: r.contentLink || '',
        remarks: r.remarks || '',
        rowStatus: 'draft',
        pipeline: pipelineInfo.pipeline,
        hasPostStage: pipelineInfo.hasPostStage,
        profileId: scope.brandProfileId || null,
        createdById: user._id || user.userId,
      });
      createdRows.push(piece);
    }
  }

  await logActivity({
    entityType: 'calendar_plan',
    entityId: plan._id,
    profileId: plan.profileId,
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
  if (updates.title) allowedUpdates.title = updates.title;
  if (updates.comment !== undefined) allowedUpdates.comment = updates.comment;
  if (updates.periodStart) allowedUpdates.periodStart = new Date(updates.periodStart);
  if (updates.periodEnd) allowedUpdates.periodEnd = new Date(updates.periodEnd);

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
  const createdRows = [];

  for (const r of rows) {
    const pipelineInfo = getPipelineForContent({
      contentType: r.contentType,
      needsScript: r.needsScript,
      needsShoot: r.needsShoot,
    });

    const piece = await ContentPiece.create({
      planId: plan._id,
      postingDate: new Date(r.postingDate),
      topic: r.topic,
      contentType: normalizeWorkType(r.contentType),
      needsScript: Boolean(r.needsScript),
      needsShoot: Boolean(r.needsShoot),
      contentLink: r.contentLink || '',
      remarks: r.remarks || '',
      rowStatus: 'draft',
      pipeline: pipelineInfo.pipeline,
      hasPostStage: pipelineInfo.hasPostStage,
      profileId: scope.brandProfileId || null,
      createdById: user._id || user.userId,
    });
    createdRows.push(piece);
  }

  await logActivity({
    entityType: 'calendar_plan',
    entityId: plan._id,
    profileId: plan.profileId,
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
  if (updates.contentLink !== undefined) piece.contentLink = updates.contentLink;
  if (updates.remarks !== undefined) piece.remarks = updates.remarks;

  if (updates.contentType || updates.needsScript !== undefined || updates.needsShoot !== undefined) {
    if (updates.contentType) piece.contentType = normalizeWorkType(updates.contentType);
    if (updates.needsScript !== undefined) piece.needsScript = Boolean(updates.needsScript);
    if (updates.needsShoot !== undefined) piece.needsShoot = Boolean(updates.needsShoot);

    const pipelineInfo = getPipelineForContent({
      contentType: piece.contentType,
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

  const updatedRows = await ContentPiece.updateMany(
    { planId: plan._id, rowStatus: { $in: ['draft', 'changes_requested'] } },
    { $set: { rowStatus: 'submitted', reviewComment: null } }
  );

  plan.submittedAt = new Date();
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
    profileId: plan.profileId,
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

  // Pick placeholder owner initially (admin or user) until assigned
  const fallbackOwnerId = user._id || user.userId;

  let profileId = piece.profileId;
  if (!profileId) {
    const { Profile } = await import('../referenceData/profile.model.js');
    const haca = await Profile.findOne({ code: 'haca' });
    profileId = haca?._id;
  }

  for (let idx = 0; idx < stages.length; idx++) {
    const stageKey = stages[idx];
    const stageOrder = idx + 1;
    const isFirstStage = stageOrder === 1;
    const isReview = REVIEW_STAGES.includes(stageKey);

    const dueDate = calculateStageDueDate(
      piece.postingDate,
      pipelineInfo.pipeline,
      stageKey,
      pipelineInfo.hasPostStage
    );

    const stageDeptId = await getDepartmentForStage(stageKey, piece.contentType);

    const workItem = await WorkItem.create({
      title: `${piece.topic} - ${stageKey}`,
      workType: piece.contentType,
      departmentId: stageDeptId || defaultDeptId,
      ownerId: null,
      deadline: dueDate,
      dueDate,
      estimatedEffortHrs: 4,
      status: 'Not Started',
      priority: 'Medium',
      profileId,
      calendarPlanId: piece.planId,
      contentPieceId: piece._id,
      stageKey,
      stageOrder,
      reviewRequired: isReview,
      isLocked: !isFirstStage,
      unlockedAt: isFirstStage ? now : null,
      isSkipped: false,
      deliverableUrl: piece.contentLink || '',
    });

    createdStages.push(workItem);
  }

  piece.stagesGenerated = true;
  await piece.save();

  // Compute recommended owners for each newly created stage
  for (const stageItem of createdStages) {
    try {
      const rec = await recommendAssignee({
        workType: piece.contentType,
        stageKey: stageItem.stageKey,
        deadline: stageItem.dueDate,
        workItemId: stageItem._id,
      }, user);
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

  return createdStages;
}

/**
 * Creative Head Review
 * Actions: approve_all | approve_selected | request_changes
 */
export async function reviewPlan(id, reviewData, user) {
  const userRole = normalizeRole(user.role);
  if (userRole !== 'creative_head' && userRole !== 'admin') {
    const error = new Error('Review stages and calendar plans can be approved only by Creative Head and Admin.');
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

    if (action === 'request_changes') {
      notifTitle = 'Changes Requested on Calendar Plan';
      notifMsg = `Creative Head requested changes on ${changesRequestedRows.length} row(s) in ${plan.title}.`;
    } else if (action === 'approve_selected') {
      notifTitle = 'Calendar Plan Partially Approved';
      notifMsg = `${rowsToApprove.length} row(s) approved in ${plan.title}.`;
    }

    await createNotification({
      recipient: plan.createdById,
      type: action === 'request_changes' ? 'plan_changes_requested' : 'plan_approved',
      title: notifTitle,
      message: notifMsg,
      link: `/calendar?tab=plans&planId=${plan._id}`,
      metadata: { planId: plan._id, action },
    });
  }

  await logActivity({
    entityType: 'calendar_plan',
    entityId: plan._id,
    profileId: plan.profileId,
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
