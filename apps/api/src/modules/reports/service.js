import mongoose from 'mongoose';
import { Request } from '../requests/model.js';
import { ContentItem } from '../content/model.js';
import { Task } from '../tasks/model.js';
import { TimeEntry } from '../time/model.js';
import { StatusHistory } from '../statusHistory/model.js';
import { LeaveRequest } from '../leave/model.js';
import { User } from '../users/model.js';
import { Settings } from '../masterData/models.js';
import { Department } from '../departments/model.js';
import { ScheduledReport } from './model.js';
import {
  calculateOnTimeRate,
  calculateFirstPassRate,
  calculateSpeedScore,
  calculateVolumeScore,
  calculateEfficiencyScore,
  calculateTurnaround,
  categorizeAgingBuckets,
  DEFAULT_EFFICIENCY_WEIGHTS,
} from './metrics.js';
import { getManagedWorkerIds, isWorkerManagedBy } from '../../lib/teamAccess.js';
import { normalizeRole } from '@mmp/shared';

// ==========================================
// Scoping & Access Control Helper
// ==========================================
export async function getScopingFilter(user, entityType) {
  if (!user) return {};
  const role = normalizeRole(user.role);
  const { department, userId, _id } = user;
  const uid = userId || _id;

  // Admin, Head, Management (and legacy Lead/Viewer) can view all organizations & teams
  if (['admin', 'head', 'lead', 'management', 'viewer'].includes(role)) {
    return {};
  }

  // Team Lead: scoped dynamically to workers they manage
  if (role === 'team_lead') {
    const managedIds = await getManagedWorkerIds(user);
    const idArray = Array.isArray(managedIds) ? managedIds : [];
    if (entityType === 'task') {
      return { assignee: { $in: idArray } };
    }
    if (entityType === 'user') {
      return { _id: { $in: idArray } };
    }
    if (entityType === 'time') {
      return { userId: { $in: idArray } };
    }
    return {};
  }

  // Department Lead: scoped strictly to their department
  if (role === 'dept_lead') {
    if (entityType === 'request' || entityType === 'content') {
      return { sourceDepartment: department };
    }
    return {};
  }

  // Worker: scoped strictly to their own assigned work
  if (role === 'worker') {
    if (entityType === 'task') {
      return { assignee: new mongoose.Types.ObjectId(uid) };
    }
    if (entityType === 'user') {
      return { _id: new mongoose.Types.ObjectId(uid) };
    }
    if (entityType === 'time') {
      return { userId: new mongoose.Types.ObjectId(uid) };
    }
    return { _id: null }; // block others
  }

  // Department Staff: scoped strictly to their own created requests
  if (role === 'dept_staff') {
    if (entityType === 'request') {
      return {
        $or: [
          { requester: new mongoose.Types.ObjectId(uid) },
          { sourceDepartment: department },
        ],
      };
    }
    return { _id: null };
  }

  return {};
}

/**
 * Standardize Date Range Filter
 */
export function parseDateRange(startDate, endDate, defaultDays = 30) {
  const end = endDate ? new Date(endDate) : new Date();
  end.setHours(23, 59, 59, 999);

  const start = startDate
    ? new Date(startDate)
    : new Date(end.getTime() - defaultDays * 24 * 60 * 60 * 1000);
  start.setHours(0, 0, 0, 0);

  return { start, end };
}

// ==========================================
// 1. Department Report
// ==========================================
export async function getDepartmentReport(filters = {}, user) {
  const { start, end } = parseDateRange(filters.startDate, filters.endDate);
  const scoping = await getScopingFilter(user, 'request');

  const matchQuery = {
    createdAt: { $gte: start, $lte: end },
    ...scoping,
  };

  let deptDoc = null;
  let targetDeptName = filters.department;
  if (user?.role === 'dept_lead') {
    targetDeptName = user.department;
  }

  if (targetDeptName) {
    deptDoc = mongoose.isValidObjectId(targetDeptName)
      ? await Department.findById(targetDeptName)
      : await Department.findOne({ name: targetDeptName });
    matchQuery.sourceDepartment = deptDoc ? deptDoc.name : targetDeptName;
  }

  // 1. Requests by type and status
  const requestsSummary = await Request.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: {
          department: '$sourceDepartment',
          type: '$requestTypeName',
          status: '$status',
        },
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        department: '$_id.department',
        type: '$_id.type',
        status: '$_id.status',
        count: 1,
      },
    },
    { $sort: { department: 1, count: -1 } },
  ]);

  // 2. Content Items in Period
  const contentMatch = {
    createdAt: { $gte: start, $lte: end },
    ...(deptDoc ? { sourceDepartment: deptDoc._id } : {}),
  };

  const contentItems = await ContentItem.find(contentMatch)
    .select('title status format platform sourceDepartment publishDate publishedAt createdAt')
    .lean();

  const totalContent = contentItems.length;
  const publishedContent = contentItems.filter((c) => ['published', 'live'].includes(c.status));
  const onTimeCount = publishedContent.filter(
    (c) => !c.publishDate || (c.publishedAt && c.publishedAt <= c.publishDate)
  ).length;
  const onTimeRate = calculateOnTimeRate(onTimeCount, publishedContent.length);

  // Turnaround Time (creation to publishing)
  let totalTurnaroundDays = 0;
  publishedContent.forEach((c) => {
    totalTurnaroundDays += calculateTurnaround(c.createdAt, c.publishedAt || c.publishDate, 'days');
  });
  const avgTurnaroundDays =
    publishedContent.length > 0
      ? Math.round((totalTurnaroundDays / publishedContent.length) * 10) / 10
      : 0;

  // 3. Open Requests & Aging
  const openRequests = await Request.find({
    status: { $in: ['submitted', 'under_triage', 'needs_info'] },
    ...(matchQuery.sourceDepartment ? { sourceDepartment: matchQuery.sourceDepartment } : {}),
  })
    .select('title sourceDepartment status createdAt deadline priority')
    .lean();

  const agingBuckets = categorizeAgingBuckets(openRequests, 'createdAt');
  const now = new Date();
  const overdueRequests = openRequests.filter((r) => r.deadline && new Date(r.deadline) < now);

  // 4. Hours Consumed by Department, Team, and Format
  const hoursAggregation = await TimeEntry.aggregate([
    {
      $match: {
        date: { $gte: start, $lte: end },
        status: { $in: ['submitted', 'approved'] },
      },
    },
    {
      $lookup: {
        from: 'tasks',
        localField: 'taskId',
        foreignField: '_id',
        as: 'task',
      },
    },
    { $unwind: '$task' },
    {
      $lookup: {
        from: 'contentitems',
        localField: 'task.contentItemId',
        foreignField: '_id',
        as: 'content',
      },
    },
    { $unwind: { path: '$content', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'departments',
        localField: 'content.sourceDepartment',
        foreignField: '_id',
        as: 'deptDoc',
      },
    },
    { $unwind: { path: '$deptDoc', preserveNullAndEmptyArrays: true } },
    ...(deptDoc
      ? [{ $match: { 'content.sourceDepartment': deptDoc._id } }]
      : []),
    {
      $group: {
        _id: {
          department: { $ifNull: ['$deptDoc.name', 'General / Marketing'] },
          team: '$task.team',
          format: '$content.format',
        },
        totalMinutes: { $sum: '$minutes' },
      },
    },
    {
      $project: {
        _id: 0,
        department: '$_id.department',
        team: '$_id.team',
        format: { $ifNull: ['$_id.format', 'unspecified'] },
        hours: { $round: [{ $divide: ['$totalMinutes', 60] }, 1] },
      },
    },
    { $sort: { hours: -1 } },
  ]);

  return {
    period: { start, end },
    department: matchQuery.sourceDepartment || targetDeptName || 'All Departments',
    scopedDepartment: matchQuery.sourceDepartment || targetDeptName || 'All Departments',
    summary: {
      totalRequests: requestsSummary.reduce((sum, r) => sum + r.count, 0),
      totalContent,
      publishedContent: publishedContent.length,
      onTimeDeliveryRate: onTimeRate,
      avgTurnaroundDays,
      openRequestsCount: openRequests.length,
      overdueRequestsCount: overdueRequests.length,
    },
    agingBuckets,
    overdueRequests,
    requestsSummary,
    hoursConsumed: hoursAggregation,
  };
}

// ==========================================
// 2. Team Report
// ==========================================
export async function getTeamReport(filters = {}, user) {
  const { start, end } = parseDateRange(filters.startDate, filters.endDate);
  const scoping = await getScopingFilter(user, 'task');

  const matchQuery = {
    updatedAt: { $gte: start, $lte: end },
    ...scoping,
  };

  if (filters.team) {
    matchQuery.team = filters.team;
  }

  // 1. Throughput & Status Counts
  const tasks = await Task.find(matchQuery)
    .select('taskId title team status estimateHours actualHours revisionCount dueDate createdAt updatedAt')
    .lean();

  const completedTasks = tasks.filter((t) => t.status === 'done');
  const backlogTasks = await Task.find({
    status: { $in: ['assigned', 'in_progress', 'submitted', 'changes_requested', 'blocked', 'on_hold'] },
    ...(matchQuery.team ? { team: matchQuery.team } : {}),
  }).countDocuments();

  // 2. Rework Rate (Tasks with revisions > 0)
  const reworkedCount = completedTasks.filter((t) => (t.revisionCount || 0) > 0).length;
  const reworkRate = completedTasks.length > 0
    ? Math.round((reworkedCount / completedTasks.length) * 1000) / 10
    : 0;

  // 3. Queue Time vs Work Time (from StatusHistory)
  const taskIds = tasks.map((t) => t._id);
  const statusHistories = await StatusHistory.find({
    entityType: 'Task',
    entityId: { $in: taskIds },
  })
    .sort({ entityId: 1, timestamp: 1 })
    .lean();

  const historyByTask = new Map();
  for (const h of statusHistories) {
    const id = h.entityId.toString();
    if (!historyByTask.has(id)) historyByTask.set(id, []);
    historyByTask.get(id).push(h);
  }

  let totalQueueHours = 0;
  let totalWorkHours = 0;
  let queueCount = 0;
  let workCount = 0;

  for (const [, history] of historyByTask.entries()) {
    let assignedTime = null;
    let inProgressTime = null;
    let submittedTime = null;

    for (const entry of history) {
      if (entry.toStatus === 'assigned' && !assignedTime) assignedTime = new Date(entry.timestamp);
      if (entry.toStatus === 'in_progress' && !inProgressTime) inProgressTime = new Date(entry.timestamp);
      if (['submitted', 'approved', 'done'].includes(entry.toStatus) && !submittedTime) {
        submittedTime = new Date(entry.timestamp);
      }
    }

    if (assignedTime && inProgressTime) {
      totalQueueHours += Math.max(0, (inProgressTime.getTime() - assignedTime.getTime()) / (1000 * 60 * 60));
      queueCount += 1;
    }
    if (inProgressTime && submittedTime) {
      totalWorkHours += Math.max(0, (submittedTime.getTime() - inProgressTime.getTime()) / (1000 * 60 * 60));
      workCount += 1;
    }
  }

  const avgQueueHours = queueCount > 0 ? Math.round((totalQueueHours / queueCount) * 10) / 10 : 0;
  const avgWorkHours = workCount > 0 ? Math.round((totalWorkHours / workCount) * 10) / 10 : 0;

  // 4. Team Capacity & Utilization
  const managedWorkerIds = user?.role === 'team_lead' ? await getManagedWorkerIds(user) : null;
  const teamUsers = await User.find({
    role: 'worker',
    status: 'active',
    ...(matchQuery.team ? { teamId: matchQuery.team } : {}),
    ...(managedWorkerIds ? { _id: { $in: managedWorkerIds } } : {}),
  })
    .select('_id name capacity teamId')
    .lean();

  const memberCount = Math.max(1, teamUsers.length);
  const totalBaseCapacity = teamUsers.reduce((sum, u) => sum + (u.capacity || 40), 0);

  // Time entries logged for team in period
  const userIds = teamUsers.map((u) => u._id);
  const loggedMinutes = await TimeEntry.aggregate([
    {
      $match: {
        userId: { $in: userIds },
        date: { $gte: start, $lte: end },
        status: { $in: ['submitted', 'approved'] },
      },
    },
    { $group: { _id: null, total: { $sum: '$minutes' } } },
  ]);
  const totalLoggedHours = loggedMinutes[0] ? Math.round((loggedMinutes[0].total / 60) * 10) / 10 : 0;
  const utilization = calculateVolumeScore(totalLoggedHours, totalBaseCapacity);

  return {
    period: { start, end },
    team: matchQuery.team || 'All Production Teams',
    summary: {
      throughput: completedTasks.length,
      currentBacklog: backlogTasks,
      avgQueueHours,
      avgWorkHours,
      utilizationRate: utilization,
      reworkRate,
      activeMembers: memberCount,
      totalLoggedHours,
    },
    tasksByStatus: {
      done: completedTasks.length,
      in_progress: tasks.filter((t) => t.status === 'in_progress').length,
      blocked: tasks.filter((t) => t.status === 'blocked').length,
      on_hold: tasks.filter((t) => t.status === 'on_hold').length,
    },
  };
}

// ==========================================
// 3. Individual Worker Report
// ==========================================
export async function getIndividualReport(targetUserId, filters = {}, user) {
  const { start, end } = parseDateRange(filters.startDate, filters.endDate);

  // Scoping check: workers can only view their own
  if (user?.role === 'worker' && user.userId !== targetUserId) {
    throw Object.assign(new Error('Access Denied: Workers may only inspect their own performance metrics.'), {
      statusCode: 403,
      code: 'FORBIDDEN',
    });
  }

  const worker = await User.findById(targetUserId).select('-passwordHash').lean();
  if (!worker) {
    throw Object.assign(new Error('Worker not found'), { statusCode: 404, code: 'NOT_FOUND' });
  }

  // If team_lead, ensure worker is managed by them
  if (user?.role === 'team_lead') {
    const isManaged = await isWorkerManagedBy(user, targetUserId);
    if (!isManaged) {
      throw Object.assign(new Error('Access Denied: Worker is not assigned to you.'), {
        statusCode: 403,
        code: 'FORBIDDEN',
      });
    }
  }

  // Fetch tasks assigned to worker
  const tasks = await Task.find({
    assignee: new mongoose.Types.ObjectId(targetUserId),
    updatedAt: { $gte: start, $lte: end },
  })
    .select('taskId title stageKey status estimateHours actualHours revisionCount dueDate createdAt updatedAt')
    .lean();

  const assignedCount = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'done');
  const completedCount = completedTasks.length;

  // On-time completion
  const onTimeCount = completedTasks.filter((t) => !t.dueDate || new Date(t.updatedAt) <= new Date(t.dueDate)).length;
  const onTimeRate = calculateOnTimeRate(onTimeCount, completedCount);

  // First-Pass Approval Rate
  const firstPassCount = completedTasks.filter((t) => (t.revisionCount || 0) === 0).length;
  const firstPassRate = calculateFirstPassRate(firstPassCount, completedCount);

  // Speed Score (Estimated vs Actual)
  const totalEstimated = tasks.reduce((sum, t) => sum + (t.estimateHours || 0), 0);
  const totalActual = tasks.reduce((sum, t) => sum + (t.actualHours || 0), 0);
  const speedScore = calculateSpeedScore(totalEstimated, totalActual);

  // Total logged hours in period from TimeEntry
  const timeEntries = await TimeEntry.find({
    userId: new mongoose.Types.ObjectId(targetUserId),
    date: { $gte: start, $lte: end },
    status: { $in: ['submitted', 'approved'] },
  }).lean();
  const loggedHours = timeEntries.reduce((sum, te) => sum + (te.minutes || 0) / 60, 0);

  // Leave Days in Period
  const leaveRequests = await LeaveRequest.find({
    userId: new mongoose.Types.ObjectId(targetUserId),
    status: 'approved',
    startDate: { $lte: end },
    endDate: { $gte: start },
  }).lean();

  let leaveDays = 0;
  leaveRequests.forEach((l) => {
    const lStart = new Date(Math.max(new Date(l.startDate).getTime(), start.getTime()));
    const lEnd = new Date(Math.min(new Date(l.endDate).getTime(), end.getTime()));
    const days = Math.max(1, Math.ceil((lEnd.getTime() - lStart.getTime()) / (1000 * 60 * 60 * 24)));
    leaveDays += days;
  });

  const baseCapacity = worker.capacity || 40;
  const netCapacity = Math.max(1, baseCapacity - (leaveDays * 8));
  const volumeScore = calculateVolumeScore(loggedHours, netCapacity);

  // Fetch Settings for configured efficiency weights
  const systemSettings = await Settings.findOne().lean();
  const weights = systemSettings?.efficiencyWeights || DEFAULT_EFFICIENCY_WEIGHTS;

  const efficiencyScore = calculateEfficiencyScore({
    onTimeRate,
    firstPassRate,
    speedScore,
    volumeScore,
    weights,
  });

  // Revisions count
  const totalRevisions = tasks.reduce((sum, t) => sum + (t.revisionCount || 0), 0);
  const avgRevisionsPerTask = completedCount > 0 ? Math.round((totalRevisions / completedCount) * 10) / 10 : 0;

  return {
    worker: {
      id: worker._id,
      name: worker.name,
      email: worker.email,
      role: worker.role,
      team: worker.teamId,
      department: worker.department,
    },
    period: { start, end },
    metrics: {
      efficiencyScore,
      onTimeRate,
      firstPassRate,
      speedScore,
      volumeScore,
      assignedCount,
      completedCount,
      totalEstimatedHours: Math.round(totalEstimated * 10) / 10,
      totalActualHours: Math.round(totalActual * 10) / 10,
      totalLoggedHours: Math.round(loggedHours * 10) / 10,
      netCapacityHours: netCapacity,
      leaveDays,
      totalRevisions,
      avgRevisionsPerTask,
    },
    weightsUsed: weights,
    recentTasks: tasks.slice(0, 15),
  };
}

// ==========================================
// 4. Content Performance Report
// ==========================================
export async function getContentReport(filters = {}, user) {
  const { start, end } = parseDateRange(filters.startDate, filters.endDate);
  const scoping = await getScopingFilter(user, 'content');

  const matchQuery = {
    createdAt: { $gte: start, $lte: end },
    ...scoping,
  };

  if (filters.format) matchQuery.format = filters.format;
  if (filters.platform) matchQuery.platform = filters.platform;
  if (filters.campaignId) matchQuery.campaignId = new mongoose.Types.ObjectId(filters.campaignId);
  const deptSearch = filters.sourceDepartment || (user?.role === 'dept_lead' ? user.department : null);
  if (deptSearch) {
    const dept = mongoose.isValidObjectId(deptSearch)
      ? await Department.findById(deptSearch)
      : await Department.findOne({ name: deptSearch });
    if (dept) {
      matchQuery.sourceDepartment = dept._id;
    }
  }

  // 1. Output by Format and Platform
  const outputAggregation = await ContentItem.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: { format: '$format', platform: '$platform' },
        count: { $sum: 1 },
        publishedCount: {
          $sum: { $cond: [{ $in: ['$status', ['published', 'live']] }, 1, 0] },
        },
      },
    },
    {
      $project: {
        _id: 0,
        format: '$_id.format',
        platform: '$_id.platform',
        total: '$count',
        published: '$publishedCount',
      },
    },
    { $sort: { total: -1 } },
  ]);

  // 2. Planned vs Published
  const totalPlanned = await ContentItem.countDocuments(matchQuery);
  const totalPublished = await ContentItem.countDocuments({
    ...matchQuery,
    status: { $in: ['published', 'live'] },
  });

  // 3. Pipeline by Stage
  const pipelineByStage = await ContentItem.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        stage: '$_id',
        count: 1,
      },
    },
  ]);

  // 4. Late Items with Aging
  const now = new Date();
  const lateItems = await ContentItem.find({
    ...matchQuery,
    status: { $nin: ['published', 'live', 'retired'] },
    publishDate: { $lt: now },
  })
    .select('contentId title format platform publishDate status sourceDepartment')
    .sort({ publishDate: 1 })
    .limit(25)
    .lean();

  const lateAgingBuckets = categorizeAgingBuckets(lateItems, 'publishDate');

  return {
    period: { start, end },
    summary: {
      totalPlanned,
      totalPublished,
      onTimePublishRate: calculateOnTimeRate(totalPublished, totalPlanned),
      lateCount: lateItems.length,
    },
    outputByFormatPlatform: outputAggregation,
    pipelineByStage,
    lateAgingBuckets,
    lateItems,
  };
}

// ==========================================
// 5. Bottlenecks & Hold Radar Report
// ==========================================
export async function getBottlenecksReport(filters = {}, user) {
  const { start, end } = parseDateRange(filters.startDate, filters.endDate);

  // Status duration analysis from StatusHistory
  const statusHistoryMatch = {
    timestamp: { $gte: start, $lte: end },
    entityType: { $in: ['Task', 'ContentItem', 'Request'] },
  };

  // 1. Holds & Blocks by Reason Code
  const holdsAndBlocks = await StatusHistory.aggregate([
    {
      $match: {
        ...statusHistoryMatch,
        toStatus: { $in: ['blocked', 'on_hold'] },
      },
    },
    {
      $group: {
        _id: {
          reasonCode: { $ifNull: ['$reasonCode', 'other'] },
          toStatus: '$toStatus',
        },
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        reasonCode: '$_id.reasonCode',
        type: '$_id.toStatus',
        count: '$count',
      },
    },
    { $sort: { count: -1 } },
  ]);

  // 2. Average Latency / Time in Each Status for Tasks
  const statusDurations = await StatusHistory.aggregate([
    { $match: statusHistoryMatch },
    {
      $group: {
        _id: '$toStatus',
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        status: '$_id',
        transitions: '$count',
      },
    },
    { $sort: { transitions: -1 } },
  ]);

  // 3. Current Blocked & On-Hold Items
  const currentBlocked = await Task.find({
    status: { $in: ['blocked', 'on_hold'] },
  })
    .select('taskId title team status holdReason holdComment updatedAt')
    .sort({ updatedAt: -1 })
    .limit(20)
    .lean();

  return {
    period: { start, end },
    holdsAndBlocks,
    statusTransitions: statusDurations,
    currentBlockedCount: currentBlocked.length,
    currentBlockedTasks: currentBlocked,
  };
}

// ==========================================
// 6. Management Scorecard Report
// ==========================================
export async function getScorecardReport(filters = {}, user) {
  const { start, end } = parseDateRange(filters.startDate, filters.endDate);

  // Calculate previous month window for Month-over-Month (MoM) delta
  const durationMs = end.getTime() - start.getTime();
  const prevStart = new Date(start.getTime() - durationMs);
  const prevEnd = new Date(start.getTime());

  // Current window data
  const [currDept, prevDept] = await Promise.all([
    getDepartmentReport({ startDate: start, endDate: end }, user),
    getDepartmentReport({ startDate: prevStart, endDate: prevEnd }, user),
  ]);

  const currSummary = currDept.summary;
  const prevSummary = prevDept.summary;

  function calcDelta(curr, prev) {
    if (!prev || prev === 0) return 0;
    return Math.round(((curr - prev) / prev) * 1000) / 10;
  }

  // Demand vs Capacity Forecast
  const totalOpenRequests = currSummary.openRequestsCount || 0;
  const activeWorkers = await User.countDocuments({ role: 'worker', status: 'active' });
  const totalWeeklyCapacityHours = activeWorkers * 40;
  const estimatedWeeklyDemandHours = totalOpenRequests * 8; // approx 8h per request package
  const capacityGapHours = estimatedWeeklyDemandHours - totalWeeklyCapacityHours;

  return {
    period: { start, end },
    scorecard: {
      totalRequests: {
        value: currSummary.totalRequests,
        prev: prevSummary.totalRequests,
        momChangePct: calcDelta(currSummary.totalRequests, prevSummary.totalRequests),
      },
      publishedContent: {
        value: currSummary.publishedContent,
        prev: prevSummary.publishedContent,
        momChangePct: calcDelta(currSummary.publishedContent, prevSummary.publishedContent),
      },
      onTimeDeliveryRate: {
        value: currSummary.onTimeDeliveryRate,
        prev: prevSummary.onTimeDeliveryRate,
        momChangePct: Math.round((currSummary.onTimeDeliveryRate - prevSummary.onTimeDeliveryRate) * 10) / 10,
      },
      avgTurnaroundDays: {
        value: currSummary.avgTurnaroundDays,
        prev: prevSummary.avgTurnaroundDays,
        momChangePct: calcDelta(currSummary.avgTurnaroundDays, prevSummary.avgTurnaroundDays),
      },
    },
    forecast: {
      activeWorkers,
      weeklyCapacityHours: totalWeeklyCapacityHours,
      estimatedDemandHours: estimatedWeeklyDemandHours,
      capacityGapHours,
      status: capacityGapHours > 0 ? 'deficit' : 'healthy',
    },
  };
}

// ==========================================
// 7. Streaming Exports (Excel & CSV)
// ==========================================
export async function generateReportExport({ reportType, format = 'xlsx', filters = {}, user }) {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Marketing Operations Portal';
  workbook.created = new Date();

  let data = null;
  let filename = `${reportType}-report-${new Date().toISOString().slice(0, 10)}`;

  switch (reportType) {
    case 'department':
      data = await getDepartmentReport(filters, user);
      break;
    case 'team':
      data = await getTeamReport(filters, user);
      break;
    case 'individual':
      data = await getIndividualReport(filters.userId || user.userId, filters, user);
      break;
    case 'content':
      data = await getContentReport(filters, user);
      break;
    case 'bottlenecks':
      data = await getBottlenecksReport(filters, user);
      break;
    case 'scorecard':
    default:
      data = await getScorecardReport(filters, user);
      break;
  }

  // Summary Sheet
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Metric', key: 'metric', width: 35 },
    { header: 'Value', key: 'value', width: 25 },
  ];
  summarySheet.getRow(1).font = { bold: true };

  if (reportType === 'department') {
    summarySheet.addRow({ metric: 'Department', value: data.department });
    summarySheet.addRow({ metric: 'Total Requests', value: data.summary.totalRequests });
    summarySheet.addRow({ metric: 'Total Content Items', value: data.summary.totalContent });
    summarySheet.addRow({ metric: 'Published Content', value: data.summary.publishedContent });
    summarySheet.addRow({ metric: 'On-Time Delivery Rate (%)', value: `${data.summary.onTimeDeliveryRate}%` });
    summarySheet.addRow({ metric: 'Avg Turnaround (Days)', value: data.summary.avgTurnaroundDays });
    summarySheet.addRow({ metric: 'Open Requests', value: data.summary.openRequestsCount });
    summarySheet.addRow({ metric: 'Overdue Requests', value: data.summary.overdueRequestsCount });

    // Hours Consumed Sheet
    const hoursSheet = workbook.addWorksheet('Hours Consumed');
    hoursSheet.columns = [
      { header: 'Department', key: 'department', width: 25 },
      { header: 'Team', key: 'team', width: 20 },
      { header: 'Format', key: 'format', width: 20 },
      { header: 'Hours', key: 'hours', width: 15 },
    ];
    hoursSheet.getRow(1).font = { bold: true };
    data.hoursConsumed.forEach((row) => hoursSheet.addRow(row));
  } else if (reportType === 'team') {
    summarySheet.addRow({ metric: 'Production Team', value: data.team });
    summarySheet.addRow({ metric: 'Throughput (Completed Tasks)', value: data.summary.throughput });
    summarySheet.addRow({ metric: 'Current Backlog', value: data.summary.currentBacklog });
    summarySheet.addRow({ metric: 'Avg Queue Hours', value: data.summary.avgQueueHours });
    summarySheet.addRow({ metric: 'Avg Work Hours', value: data.summary.avgWorkHours });
    summarySheet.addRow({ metric: 'Utilization Rate (%)', value: `${data.summary.utilizationRate}%` });
    summarySheet.addRow({ metric: 'Rework Rate (%)', value: `${data.summary.reworkRate}%` });
  } else if (reportType === 'individual') {
    summarySheet.addRow({ metric: 'Worker Name', value: data.worker.name });
    summarySheet.addRow({ metric: 'Efficiency Score', value: `${data.metrics.efficiencyScore}/100` });
    summarySheet.addRow({ metric: 'On-Time Rate (%)', value: `${data.metrics.onTimeRate}%` });
    summarySheet.addRow({ metric: 'First-Pass Approval Rate (%)', value: `${data.metrics.firstPassRate}%` });
    summarySheet.addRow({ metric: 'Speed vs Estimate Score', value: `${data.metrics.speedScore}%` });
    summarySheet.addRow({ metric: 'Capacity Utilization Score', value: `${data.metrics.volumeScore}%` });
    summarySheet.addRow({ metric: 'Tasks Completed', value: data.metrics.completedCount });
    summarySheet.addRow({ metric: 'Total Logged Hours', value: data.metrics.totalLoggedHours });
  } else {
    // Scorecard / Content / Bottlenecks general dump
    summarySheet.addRow({ metric: 'Report Type', value: reportType });
    summarySheet.addRow({ metric: 'Generated At', value: new Date().toISOString() });
  }

  return { workbook, filename, data };
}

// ==========================================
// 8. Scheduled Reports Service
// ==========================================
export async function createScheduledReport(body, user) {
  const { name, reportType, frequency, format, recipients, filters } = body;

  const now = new Date();
  const nextRunAt = new Date(now);
  if (frequency === 'daily') nextRunAt.setDate(nextRunAt.getDate() + 1);
  else if (frequency === 'monthly') nextRunAt.setMonth(nextRunAt.getMonth() + 1);
  else nextRunAt.setDate(nextRunAt.getDate() + 7); // weekly default

  const userId = user?.userId || user?._id || user?.id;

  const report = await ScheduledReport.create({
    name,
    reportType,
    frequency: frequency || 'weekly',
    format: format || 'xlsx',
    recipients: recipients || [user.email],
    filters: filters || {},
    createdBy: userId,
    nextRunAt,
  });

  return report;
}

export async function getScheduledReports(user) {
  const userId = user?.userId || user?._id || user?.id;
  const scoping = ['admin', 'head', 'lead'].includes(user.role)
    ? {}
    : { createdBy: userId };

  return ScheduledReport.find(scoping).sort({ createdAt: -1 }).lean();
}

export async function deleteScheduledReport(id, user) {
  const userId = user?.userId || user?._id || user?.id;
  const scoping = ['admin', 'head', 'lead'].includes(user.role)
    ? { _id: id }
    : { _id: id, createdBy: userId };

  const res = await ScheduledReport.findOneAndDelete(scoping);
  if (!res) {
    throw Object.assign(new Error('Scheduled report not found or access denied'), {
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  }
  return res;
}
