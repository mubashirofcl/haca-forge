import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { Person } from '../people/model.js';
import { Department } from '../departments/model.js';
import { WorkItem } from '../workItems/model.js';
import { Rating } from '../submissions/model.js';
import { ActivityEvent } from '../activity/model.js';
import { PersonChangeAudit } from './audit.model.js';
import { evaluateSteps } from '../workItems/timeLabels.js';
import { Session } from '../auth/session.model.js';
import { logActivity } from '../activity/service.js';
import { getRatingsSummary } from '../submissions/service.js';
import { disconnectUserSockets } from '../../lib/socketHub.js';
import {
  calculateIndividualWorkMeasures,
  formatDuration,
  normalizeRole,
  ROLE_LABELS,
  submittedWorkTimeMs,
  ROLE_KEYS,
} from '@mmp/shared';

/**
 * Worker isolation guard: A team_member accessing someone else's profile gets HTTP 404 (strictly anti-harvesting).
 */
export function enforceProfileAccess(targetPersonId, actor) {
  const actorRole = normalizeRole(actor?.role);
  const actorId = (actor?._id || actor?.id || actor?.userId)?.toString();
  const targetIdStr = targetPersonId.toString();

  if (actorRole === 'team_member' && actorId !== targetIdStr) {
    const error = new Error('Profile not found');
    error.code = 'NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }
}

/**
 * Get Team Directory
 * Strictly whitelist sorted by: name, department, jobRole, load (no performance/rating sort).
 */
export async function getTeamDirectory(query = {}, actor) {
  const {
    role,
    departmentId,
    status = 'active',
    loadBand,
    hasLate,
    search,
    sortBy = 'name',
    sortDir = 'asc',
    page = 1,
    limit = 50,
  } = query;

  const filter = {};

  if (status && status !== 'all') {
    filter.status = status;
  }

  if (role && role !== 'all') {
    filter.role = role;
  }

  if (departmentId && departmentId !== 'all') {
    filter.departmentId = departmentId;
  }

  if (search && search.trim()) {
    const s = search.trim();
    filter.$or = [
      { name: { $regex: s, $options: 'i' } },
      { preferredName: { $regex: s, $options: 'i' } },
      { email: { $regex: s, $options: 'i' } },
      { jobRole: { $regex: s, $options: 'i' } },
      { skills: { $in: [new RegExp(s, 'i')] } },
    ];
  }

  const people = await Person.find(filter)
    .populate('departmentId', 'name code')
    .lean();

  const now = new Date();

  // Enhance each person with operational load, active counts, and current step
  const enhancedList = await Promise.all(
    people.map(async (person) => {
      const openItems = await WorkItem.find({
        ownerId: person._id,
        status: { $nin: ['Approved', 'Published'] },
      })
        .populate('contentPieceId', 'title topic code')
        .lean();

      const capacity = person.weeklyCapacityHours || 40;
      const allocatedHours = openItems.reduce(
        (acc, it) => acc + (it.estimatedEffortHrs || 4),
        0
      );
      const loadPct = capacity > 0 ? Math.round((allocatedHours / capacity) * 100) : 0;

      let band = 'Healthy';
      if (loadPct > 85) band = 'Overloaded';
      else if (loadPct >= 65) band = 'High';

      const inProgress = openItems.filter((it) => it.status === 'In Progress').length;
      const waitingApproval = openItems.filter((it) => it.status === 'Feedback').length;
      const lateItems = openItems.filter((it) => {
        if (!it.deadline) return false;
        return new Date(it.deadline) < now;
      });
      const late = lateItems.length;

      // Find 'Now' item: In Progress first, then Feedback, Pending, Blocked
      const currentActiveItem =
        openItems.find((it) => it.status === 'In Progress') ||
        openItems.find((it) => it.status === 'Feedback') ||
        openItems.find((it) => it.status === 'Blocked') ||
        openItems.find((it) => it.status === 'Pending') ||
        null;

      let currentStep = null;
      if (currentActiveItem) {
        currentStep = {
          workItemId: currentActiveItem._id,
          title:
            currentActiveItem.title ||
            currentActiveItem.contentPieceId?.title ||
            currentActiveItem.contentPieceId?.topic ||
            'Deliverable',
          stageKey: currentActiveItem.stageKey || currentActiveItem.workType || 'Stage',
          status: currentActiveItem.status,
          dueDate: currentActiveItem.deadline || null,
          isLate: currentActiveItem.deadline ? new Date(currentActiveItem.deadline) < now : false,
        };
      }

      return {
        _id: person._id,
        name: person.name,
        preferredName: person.preferredName || '',
        avatarUrl: person.avatarUrl || null,
        role: person.role,
        jobRole: person.jobRole || '',
        department: person.departmentId || null,
        status: person.status,
        weeklyCapacityHours: capacity,
        loadPct,
        capacityBand: band,
        currentStep,
        counts: {
          inProgress,
          waitingApproval,
          late,
        },
      };
    })
  );

  // Apply in-memory filters for computed load band and late
  let filtered = enhancedList;
  if (loadBand && loadBand !== 'all') {
    filtered = filtered.filter((p) => p.capacityBand.toLowerCase() === loadBand.toLowerCase());
  }

  if (hasLate === 'true' || hasLate === true) {
    filtered = filtered.filter((p) => p.counts.late > 0);
  }

  // Whitelist Sorting ONLY: name, department, jobRole, load
  const allowedSortKeys = ['name', 'department', 'jobRole', 'load'];
  const effectiveSortKey = allowedSortKeys.includes(sortBy) ? sortBy : 'name';
  const multiplier = sortDir === 'desc' ? -1 : 1;

  filtered.sort((a, b) => {
    if (effectiveSortKey === 'load') {
      return (a.loadPct - b.loadPct) * multiplier;
    }
    if (effectiveSortKey === 'department') {
      const deptA = a.department?.name || '';
      const deptB = b.department?.name || '';
      return deptA.localeCompare(deptB) * multiplier;
    }
    if (effectiveSortKey === 'jobRole') {
      return (a.jobRole || '').localeCompare(b.jobRole || '') * multiplier;
    }
    // Default: name (preferred name considered if present)
    const nameA = a.preferredName || a.name || '';
    const nameB = b.preferredName || b.name || '';
    return nameA.localeCompare(nameB) * multiplier;
  });

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
  const total = filtered.length;
  const totalPages = Math.ceil(total / limitNum) || 1;
  const paginated = filtered.slice((pageNum - 1) * limitNum, pageNum * limitNum);

  return {
    items: paginated,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages,
    },
  };
}

/**
 * Get Base Profile & KPI Strip
 */
export async function getPersonBaseProfile(targetPersonId, actor) {
  enforceProfileAccess(targetPersonId, actor);

  const person = await Person.findById(targetPersonId)
    .populate('departmentId', 'name code')
    .lean();

  if (!person) {
    const error = new Error('Person not found');
    error.code = 'NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  const now = new Date();
  const capacity = person.weeklyCapacityHours || 40;

  // Open steps
  const openItems = await WorkItem.find({
    ownerId: person._id,
    status: { $nin: ['Approved', 'Published'] },
  }).lean();

  const allocatedHours = openItems.reduce(
    (acc, it) => acc + (it.estimatedEffortHrs || 4),
    0
  );
  const loadPct = capacity > 0 ? Math.round((allocatedHours / capacity) * 100) : 0;
  let capacityBand = 'Healthy';
  if (loadPct > 85) capacityBand = 'Overloaded';
  else if (loadPct >= 65) capacityBand = 'High';

  const inProgress = openItems.filter((it) => it.status === 'In Progress').length;
  const waitingApproval = openItems.filter((it) => it.status === 'Feedback').length;
  const late = openItems.filter((it) => it.deadline && new Date(it.deadline) < now).length;

  // Completed steps for on-time rate
  const completedItems = await WorkItem.find({
    ownerId: person._id,
    status: { $in: ['Approved', 'Published'] },
  }).lean();

  let onTimeRate = 100;
  if (completedItems.length > 0) {
    const onTimeCount = completedItems.filter((it) => {
      if (!it.deadline) return true;
      const finishDate = it.postedAt || it.submittedAt || it.updatedAt;
      return new Date(finishDate) <= new Date(it.deadline);
    }).length;
    onTimeRate = Math.round((onTimeCount / completedItems.length) * 100);
  }

  // Ratings calculation with minimum 3-rating visibility threshold
  const ratings = await Rating.find({ workerId: person._id }).lean();
  let averageRating = null;
  const ratingCount = ratings.length;
  if (ratingCount >= 3) {
    const totalScore = ratings.reduce((sum, r) => sum + (r.score || 0), 0);
    averageRating = Number((totalScore / ratingCount).toFixed(1));
  }

  // Executive privacy redaction: hide email, phone, whatsapp
  const isSelf = String(actor._id || actor.id || actor.userId) === String(targetPersonId);
  const isExecutive = normalizeRole(actor.role) === 'executive' && !isSelf;

  return {
    _id: person._id,
    name: person.name,
    preferredName: person.preferredName || '',
    avatarUrl: person.avatarUrl || null,
    role: person.role,
    jobRole: person.jobRole || '',
    department: person.departmentId || null,
    status: person.status,
    createdAt: person.createdAt,
    lastLoginAt: person.lastLoginAt || person.lastLogin || null,
    weeklyCapacityHours: capacity,
    languages: person.languages || [],
    skills: person.skills || [],
    workPreferences: person.workPreferences || [],
    about: person.about || '',
    email: isExecutive ? null : person.email,
    phone: isExecutive ? null : person.phone || '',
    whatsappNumber: isExecutive ? null : person.whatsappNumber || '',
    kpis: {
      loadPct,
      capacityBand,
      inProgressCount: inProgress,
      waitingApprovalCount: waitingApproval,
      lateCount: late,
      onTimeRate,
      averageRating,
      ratingCount,
    },
  };
}

/**
 * 8-Week Load History & Overview
 */
export async function getPersonOverview(targetPersonId, actor, query = {}) {
  enforceProfileAccess(targetPersonId, actor);

  const person = await Person.findById(targetPersonId)
    .populate('departmentId', 'name code')
    .lean();
  if (!person) {
    const error = new Error('Person not found');
    error.code = 'NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  const capacity = person.weeklyCapacityHours || 40;
  const now = new Date();

  // Right Now: active items in progress, feedback, pending, blocked
  const activeItems = await WorkItem.find({
    ownerId: person._id,
    status: { $in: ['In Progress', 'Feedback', 'Pending', 'Blocked'] },
  })
    .populate('contentPieceId', 'title topic code calendar channel')
    .sort({ deadline: 1 })
    .lean();

  const rightNow = activeItems.map((item) => {
    const measures = calculateIndividualWorkMeasures(item, now);
    return {
      _id: item._id,
      title: item.title || item.contentPieceId?.title || item.contentPieceId?.topic || 'Deliverable',
      stageKey: item.stageKey || item.workType || 'Stage',
      status: item.status,
      deadline: item.deadline || null,
      calendar: item.calendar || item.contentPieceId?.calendar || item.channel || 'sm',
      measures,
      contentPieceId: item.contentPieceId?._id || item.contentPieceId,
    };
  });

  // Next Up: Not Started items assigned to worker
  const nextItems = await WorkItem.find({
    ownerId: person._id,
    status: 'Not Started',
  })
    .populate('contentPieceId', 'title topic code calendar channel')
    .sort({ deadline: 1 })
    .limit(10)
    .lean();

  const nextUp = nextItems.map((item) => ({
    _id: item._id,
    title: item.title || item.contentPieceId?.title || item.contentPieceId?.topic || 'Deliverable',
    stageKey: item.stageKey || item.workType || 'Stage',
    status: item.status,
    deadline: item.deadline || null,
    calendar: item.calendar || item.contentPieceId?.calendar || item.channel || 'sm',
    contentPieceId: item.contentPieceId?._id || item.contentPieceId,
  }));

  // 8-Week Load Trend:
  // For each of the last 8 calendar weeks, calculate:
  // sum of default stage hours of steps assigned to the person and not yet submitted during that week / weekly capacity
  const loadTrend = [];
  const startOfThisWeek = new Date(now);
  const day = startOfThisWeek.getDay();
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  startOfThisWeek.setDate(startOfThisWeek.getDate() + diffToMonday);
  startOfThisWeek.setHours(0, 0, 0, 0);

  // Retrieve all steps ever assigned to this person to evaluate weekly state
  const allAssigned = await WorkItem.find({ ownerId: person._id }).lean();

  for (let w = 7; w >= 0; w--) {
    const weekStart = new Date(startOfThisWeek);
    weekStart.setDate(weekStart.getDate() - w * 7);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // Filter items assigned on or before weekEnd and not submitted before weekStart
    const assignedDuringWeek = allAssigned.filter((it) => {
      const assignedTime = it.assignedAt || it.createdAt;
      if (new Date(assignedTime) > weekEnd) return false;
      if (it.submittedAt && new Date(it.submittedAt) < weekStart) return false;
      return true;
    });

    const allocatedHours = assignedDuringWeek.reduce(
      (sum, it) => sum + (it.estimatedEffortHrs || 4),
      0
    );
    const loadPct = capacity > 0 ? Math.round((allocatedHours / capacity) * 100) : 0;
    let band = 'Healthy';
    if (loadPct > 85) band = 'Overloaded';
    else if (loadPct >= 65) band = 'High';

    const weekNumber = Math.ceil(
      ((weekStart - new Date(weekStart.getFullYear(), 0, 1)) / 86400000 + 1) / 7
    );

    loadTrend.push({
      weekLabel: `W${weekNumber}`,
      weekNumber,
      year: weekStart.getFullYear(),
      startDate: weekStart.toISOString(),
      endDate: weekEnd.toISOString(),
      allocatedHours,
      capacityHours: capacity,
      loadPct,
      band,
    });
  }

  // Work Breakdown by step type and calendar
  const workByType = {};
  const workByCalendar = {};

  allAssigned.forEach((it) => {
    const stage = it.stageKey || it.workType || 'Other';
    workByType[stage] = (workByType[stage] || 0) + 1;

    const cal = it.calendar || it.channel || 'sm';
    workByCalendar[cal] = (workByCalendar[cal] || 0) + 1;
  });

  // Operational summary for non-worker roles
  let operationalSummary = null;
  const personRole = normalizeRole(person.role);

  if (personRole === 'creative_head') {
    const pendingReviewsCount = await WorkItem.countDocuments({ status: 'Feedback' });
    const approvedPast30Days = await WorkItem.countDocuments({
      status: { $in: ['Approved', 'Published'] },
      approvedAt: { $gte: new Date(Date.now() - 30 * 86400000) },
    });
    operationalSummary = {
      role: 'creative_head',
      pendingReviewsCount,
      approvedPast30Days,
    };
  } else if (personRole === 'sm_manager') {
    const { CalendarPlan } = await import('../calendar/plan.model.js');
    const activePlansCount = await CalendarPlan.countDocuments({
      status: { $in: ['Draft', 'Submitted', 'Approved'] },
    });
    const upcomingPostingsCount = await WorkItem.countDocuments({
      stageKey: 'Post',
      status: { $nin: ['Published'] },
    });
    operationalSummary = {
      role: 'sm_manager',
      activePlansCount,
      upcomingPostingsCount,
    };
  }

  return {
    rightNow,
    nextUp,
    loadTrend,
    workByType,
    workByCalendar,
    skills: person.skills || [],
    workPreferences: person.workPreferences || [],
    operationalSummary,
  };
}

/**
 * Filterable Step List for Work Tab
 */
export async function getPersonWork(targetPersonId, actor, query = {}) {
  enforceProfileAccess(targetPersonId, actor);

  const {
    status,
    stageKey,
    calendar,
    startDate,
    endDate,
    page = 1,
    limit = 20,
  } = query;

  const filter = { ownerId: targetPersonId };

  if (status && status !== 'all') {
    filter.status = status;
  }

  if (stageKey && stageKey !== 'all') {
    filter.stageKey = stageKey;
  }

  if (calendar && calendar !== 'all') {
    filter.calendar = calendar;
  }

  if (startDate || endDate) {
    filter.deadline = {};
    if (startDate) filter.deadline.$gte = new Date(startDate);
    if (endDate) filter.deadline.$lte = new Date(endDate);
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const total = await WorkItem.countDocuments(filter);
  const items = await WorkItem.find(filter)
    .populate('contentPieceId', 'title topic code calendar channel')
    .sort({ deadline: 1, createdAt: -1 })
    .skip(skip)
    .limit(limitNum)
    .lean();

  const now = new Date();
  const facts = await evaluateSteps(items, { now, withElapsed: false });
  const formattedItems = items.map((it) => {
    const measures = calculateIndividualWorkMeasures(it, now);
    return {
      timeLabels: facts.get(String(it._id))?.labels || [],
      _id: it._id,
      title: it.title || it.contentPieceId?.title || it.contentPieceId?.topic || 'Deliverable',
      stageKey: it.stageKey || it.workType || 'Stage',
      status: it.status,
      calendar: it.calendar || it.contentPieceId?.calendar || it.channel || 'sm',
      deadline: it.deadline || null,
      revisions: it.revisions || 0,
      assignedAt: it.assignedAt || it.createdAt,
      unlockedAt: it.unlockedAt || null,
      startedAt: it.startedAt || null,
      submittedAt: it.submittedAt || null,
      decisionAt: it.decisionAt || null,
      approvedAt: it.approvedAt || null,
      postedAt: it.postedAt || null,
      rounds: it.rounds || [],
      intervals: it.intervals || [],
      measures,
      contentPieceId: it.contentPieceId?._id || it.contentPieceId,
    };
  });

  return {
    items: formattedItems,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    },
  };
}

/**
 * Performance Tab Metrics
 */
export async function getPersonPerformance(targetPersonId, actor, query = {}) {
  enforceProfileAccess(targetPersonId, actor);

  const { range = '30d', customStart, customEnd } = query;
  const now = new Date();

  let days = 30;
  if (range === '7d') days = 7;
  else if (range === '90d') days = 90;

  let currentStart = new Date(now.getTime() - days * 86400000);
  let currentEnd = new Date(now);

  if (range === 'this_month') {
    currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
    currentEnd = new Date(now);
  } else if (range === 'last_month') {
    currentStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    currentEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  } else if (customStart && customEnd) {
    currentStart = new Date(customStart);
    currentEnd = new Date(customEnd);
    days = Math.max(1, Math.round((currentEnd - currentStart) / 86400000));
  }

  // Preceding window for comparison deltas
  const prevStart = new Date(currentStart.getTime() - days * 86400000);
  const prevEnd = new Date(currentStart);

  // Retrieve completed items in current window
  const currentCompleted = await WorkItem.find({
    ownerId: targetPersonId,
    status: { $in: ['Approved', 'Published'] },
    updatedAt: { $gte: currentStart, $lte: currentEnd },
  }).lean();

  // Retrieve completed items in previous window
  const prevCompleted = await WorkItem.find({
    ownerId: targetPersonId,
    status: { $in: ['Approved', 'Published'] },
    updatedAt: { $gte: prevStart, $lte: prevEnd },
  }).lean();

  const calculateWindowStats = (items) => {
    if (items.length === 0) {
      return {
        completedCount: 0,
        onTimeRate: 100,
        avgDaysLate: 0,
        firstPassApprovalRate: 100,
        avgRevisions: 0,
        avgWorkTimeMs: 0,
        avgWorkTimeFormatted: '—',
        workTimeByType: {},
        avgWaitingToStartMs: 0,
        avgWaitingToStartFormatted: '—',
        avgApprovalWaitMs: 0,
        avgApprovalWaitFormatted: '—',
        blockersCount: 0,
        avgBlockerDurationMs: 0,
        avgBlockerDurationFormatted: '—',
      };
    }

    let onTimeCount = 0;
    let totalLateDays = 0;
    let lateItemsCount = 0;
    let firstPassCount = 0;
    let totalRevisions = 0;
    let totalWorkTimeMs = 0;
    let workTimeItemsCount = 0;
    let totalWaitToStartMs = 0;
    let waitToStartCount = 0;
    let totalApprovalWaitMs = 0;
    let approvalWaitCount = 0;
    let blockersCount = 0;
    let totalBlockerDurationMs = 0;

    const workByTypeMap = {};

    items.forEach((it) => {
      const m = calculateIndividualWorkMeasures(it, now);

      // On-time check
      if (!m.isLate) {
        onTimeCount++;
      } else {
        totalLateDays += m.lateByDays || 0;
        lateItemsCount++;
      }

      // First-pass approval
      if ((it.revisions || 0) === 0) {
        firstPassCount++;
      }
      totalRevisions += it.revisions || 0;

      // Work time: the shared work time over submitted rounds only, as in the team digest
      // (the calculator has no netWorkTimeMs, so this used to always be 0).
      const workTimeMs = submittedWorkTimeMs(it);
      if (workTimeMs > 0) {
        totalWorkTimeMs += workTimeMs;
        workTimeItemsCount++;

        const type = it.stageKey || it.workType || 'Stage';
        if (!workByTypeMap[type]) {
          workByTypeMap[type] = { totalMs: 0, count: 0 };
        }
        workByTypeMap[type].totalMs += workTimeMs;
        workByTypeMap[type].count += 1;
      }

      // Waiting to start
      if (m.waitingToStartMs !== null && m.waitingToStartMs > 0) {
        totalWaitToStartMs += m.waitingToStartMs;
        waitToStartCount++;
      }

      // Approval wait
      if (m.approvalWaitMs !== null && m.approvalWaitMs > 0) {
        totalApprovalWaitMs += m.approvalWaitMs;
        approvalWaitCount++;
      }

      // Blockers
      if (Array.isArray(it.intervals)) {
        it.intervals.forEach((iv) => {
          if (iv.kind === 'blocked') {
            blockersCount++;
            if (iv.startedAt && iv.endedAt) {
              totalBlockerDurationMs += Math.max(
                0,
                new Date(iv.endedAt) - new Date(iv.startedAt)
              );
            }
          }
        });
      }
    });

    const workTimeByType = {};
    Object.keys(workByTypeMap).forEach((type) => {
      const entry = workByTypeMap[type];
      const avgMs = Math.round(entry.totalMs / entry.count);
      workTimeByType[type] = {
        avgMs,
        formatted: formatDuration(avgMs),
        count: entry.count,
      };
    });

    const avgWorkTime = workTimeItemsCount > 0 ? Math.round(totalWorkTimeMs / workTimeItemsCount) : 0;
    const avgWaitStart = waitToStartCount > 0 ? Math.round(totalWaitToStartMs / waitToStartCount) : 0;
    const avgAppWait = approvalWaitCount > 0 ? Math.round(totalApprovalWaitMs / approvalWaitCount) : 0;
    const avgBlockerDur = blockersCount > 0 ? Math.round(totalBlockerDurationMs / blockersCount) : 0;

    return {
      completedCount: items.length,
      onTimeRate: Math.round((onTimeCount / items.length) * 100),
      avgDaysLate: lateItemsCount > 0 ? Number((totalLateDays / lateItemsCount).toFixed(1)) : 0,
      firstPassApprovalRate: Math.round((firstPassCount / items.length) * 100),
      avgRevisions: Number((totalRevisions / items.length).toFixed(1)),
      avgWorkTimeMs: avgWorkTime,
      avgWorkTimeFormatted: avgWorkTime > 0 ? formatDuration(avgWorkTime) : '—',
      workTimeByType,
      avgWaitingToStartMs: avgWaitStart,
      avgWaitingToStartFormatted: avgWaitStart > 0 ? formatDuration(avgWaitStart) : '—',
      avgApprovalWaitMs: avgAppWait,
      avgApprovalWaitFormatted: avgAppWait > 0 ? formatDuration(avgAppWait) : '—',
      blockersCount,
      avgBlockerDurationMs: avgBlockerDur,
      avgBlockerDurationFormatted: avgBlockerDur > 0 ? formatDuration(avgBlockerDur) : '—',
    };
  };

  const currentStats = calculateWindowStats(currentCompleted);
  const prevStats = calculateWindowStats(prevCompleted);

  // Trailing 6 months output trend
  const monthlyOutputTrend = [];
  for (let m = 5; m >= 0; m--) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

    const monthCount = await WorkItem.countDocuments({
      ownerId: targetPersonId,
      status: { $in: ['Approved', 'Published'] },
      updatedAt: { $gte: mStart, $lte: mEnd },
    });

    const monthLabel = mStart.toLocaleString('default', { month: 'short', year: 'numeric' });
    monthlyOutputTrend.push({
      month: monthLabel,
      count: monthCount,
    });
  }

  // Revision flags summary
  const revisionFlags = {
    total: currentStats.avgRevisions * currentStats.completedCount,
    creativeDirection: 0,
    technicalExecution: 0,
    brandGuidelines: 0,
    copyMistakes: 0,
  };

  return {
    period: {
      range,
      startDate: currentStart.toISOString(),
      endDate: currentEnd.toISOString(),
    },
    current: currentStats,
    deltas: {
      completedCountDelta: currentStats.completedCount - prevStats.completedCount,
      onTimeRateDelta: currentStats.onTimeRate - prevStats.onTimeRate,
      firstPassRateDelta: currentStats.firstPassApprovalRate - prevStats.firstPassApprovalRate,
    },
    monthlyOutputTrend,
    revisionFlags,
  };
}

/**
 * Ratings Tab
 */
export async function getPersonRatings(targetPersonId, actor) {
  enforceProfileAccess(targetPersonId, actor);
  return getRatingsSummary(targetPersonId, actor);
}

/**
 * Activity Tab
 */
export async function getPersonActivity(targetPersonId, actor, query = {}) {
  enforceProfileAccess(targetPersonId, actor);

  const { limit = 30 } = query;
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 30));

  // Retrieve domain events for person (strictly excluding chat)
  const events = await ActivityEvent.find({
    $or: [{ actorId: targetPersonId }, { entityId: targetPersonId }],
    entityType: { $ne: 'chat' },
  })
    .sort({ timestamp: -1 })
    .limit(limitNum)
    .populate('actorId', 'name role avatarUrl')
    .lean();

  const { sanitizeActivities } = await import('../workItems/viewerRules.js');
  return sanitizeActivities(events, actor);
}

/**
 * Changes Tab (Audit Log of Operational Attributes)
 * Accessible ONLY to admin and creative_head.
 */
export async function getPersonChanges(targetPersonId, actor) {
  const actorRole = normalizeRole(actor?.role);
  if (actorRole !== 'admin' && actorRole !== 'creative_head') {
    const error = new Error('Forbidden: Only Admin and Creative Head can view the operational changes audit log');
    error.code = 'FORBIDDEN';
    error.statusCode = 403;
    throw error;
  }

  const logs = await PersonChangeAudit.find({ personId: targetPersonId })
    .populate('actorId', 'name role email')
    .sort({ createdAt: -1 })
    .lean();

  return logs;
}

/**
 * Update Person Details & Record Operational Changes
 */
export async function updatePersonDetails(targetPersonId, updates, actor) {
  const actorRole = normalizeRole(actor?.role);
  const target = await Person.findById(targetPersonId);

  if (!target) {
    const error = new Error('Person not found');
    error.code = 'NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  const targetRole = normalizeRole(target.role);

  // Creative Head permission check
  if (actorRole === 'creative_head') {
    if (targetRole === 'admin' || targetRole === 'creative_head' || targetRole === 'executive') {
      const error = new Error('Forbidden: Creative Head cannot modify leadership accounts');
      error.code = 'FORBIDDEN';
      error.statusCode = 403;
      throw error;
    }

    if (updates.role && updates.role !== target.role) {
      const error = new Error('Forbidden: Creative Head cannot change roles');
      error.code = 'FORBIDDEN';
      error.statusCode = 403;
      throw error;
    }

    if (updates.status && updates.status !== target.status) {
      const error = new Error('Forbidden: Creative Head cannot alter account status');
      error.code = 'FORBIDDEN';
      error.statusCode = 403;
      throw error;
    }
  } else if (actorRole !== 'admin') {
    const error = new Error('Forbidden: Insufficient privileges to update person details');
    error.code = 'FORBIDDEN';
    error.statusCode = 403;
    throw error;
  }

  // An unknown role is the caller's mistake: 400, not the schema's 500 (Phase 6).
  if (updates.role !== undefined && !ROLE_KEYS.includes(updates.role)) {
    const error = new Error(`Unknown role. Use one of: ${ROLE_KEYS.join(', ')}.`);
    error.code = 'INVALID_ROLE';
    error.statusCode = 400;
    throw error;
  }

  // Audit log tracking for operational fields
  const trackedFields = ['jobRole', 'departmentId', 'workPreferences', 'weeklyCapacityHours'];
  const auditEntries = [];

  for (const field of trackedFields) {
    if (updates[field] !== undefined) {
      const oldVal = target[field];
      const newVal = updates[field];

      const isDifferent =
        Array.isArray(oldVal) || Array.isArray(newVal)
          ? JSON.stringify(oldVal || []) !== JSON.stringify(newVal || [])
          : String(oldVal || '') !== String(newVal || '');

      if (isDifferent) {
        auditEntries.push({
          personId: target._id,
          actorId: actor._id,
          field,
          oldValue: oldVal,
          newValue: newVal,
          reason: updates.reason || 'Operational update',
        });
        target[field] = newVal;
      }
    }
  }

  // Apply other allowed fields if admin
  if (actorRole === 'admin') {
    if (updates.name !== undefined) target.name = updates.name.trim();
    if (updates.preferredName !== undefined) target.preferredName = updates.preferredName.trim();
    if (updates.email !== undefined) target.email = updates.email.toLowerCase().trim();
    if (updates.role !== undefined) target.role = updates.role;
    if (updates.status !== undefined) target.status = updates.status;
    if (updates.skills !== undefined) target.skills = updates.skills;
    if (updates.languages !== undefined) target.languages = updates.languages;
    if (updates.about !== undefined) target.about = updates.about;
    if (updates.phone !== undefined) target.phone = updates.phone;
    if (updates.whatsappNumber !== undefined) target.whatsappNumber = updates.whatsappNumber;
  }

  await target.save();

  if (auditEntries.length > 0) {
    await PersonChangeAudit.insertMany(auditEntries);
  }

  await logActivity({
    entityType: 'person',
    entityId: target._id,
    actor,
    action: 'person.updated',
    metadata: { fields: Object.keys(updates) },
  });

  return getPersonBaseProfile(target._id, actor);
}

/**
 * Reassign Steps to Another Worker
 */
export async function reassignSteps(sourcePersonId, { targetPersonId, workItemIds }, actor) {
  const actorRole = normalizeRole(actor?.role);
  if (actorRole !== 'admin' && actorRole !== 'creative_head' && actorRole !== 'sm_manager') {
    const error = new Error('Forbidden: Insufficient privileges to reassign steps');
    error.code = 'FORBIDDEN';
    error.statusCode = 403;
    throw error;
  }

  const targetPerson = await Person.findById(targetPersonId);
  if (!targetPerson) {
    const error = new Error('Target assignee not found');
    error.code = 'NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  const query = { ownerId: sourcePersonId };
  if (Array.isArray(workItemIds) && workItemIds.length > 0) {
    query._id = { $in: workItemIds };
  } else {
    // Reassign all active incomplete steps by default
    query.status = { $nin: ['Approved', 'Published'] };
  }

  const result = await WorkItem.updateMany(query, {
    $set: {
      ownerId: targetPerson._id,
      assignedAt: new Date(),
    },
  });

  await logActivity({
    entityType: 'person',
    entityId: sourcePersonId,
    actor,
    action: 'steps.reassigned',
    metadata: {
      targetPersonId: targetPerson._id,
      reassignedCount: result.modifiedCount,
    },
  });

  return {
    reassignedCount: result.modifiedCount,
    targetPerson: {
      _id: targetPerson._id,
      name: targetPerson.name,
    },
  };
}

/**
 * Toggle Status (Suspend / Reactivate)
 */
export async function toggleStatus(personId, actor) {
  const actorRole = normalizeRole(actor?.role);
  if (actorRole !== 'admin') {
    const error = new Error('Forbidden: Only Administrator can suspend or reactivate users');
    error.code = 'FORBIDDEN';
    error.statusCode = 403;
    throw error;
  }

  const person = await Person.findById(personId);
  if (!person) {
    const error = new Error('Person not found');
    error.code = 'NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  person.status = person.status === 'active' ? 'suspended' : 'active';
  await person.save();

  if (person.status === 'suspended') {
    await Session.deleteMany({ userId: person._id });
  }

  return {
    _id: person._id,
    status: person.status,
  };
}

/**
 * Reset Password
 */
export async function triggerPasswordReset(personId, actor) {
  const actorRole = normalizeRole(actor?.role);
  if (actorRole !== 'admin') {
    const error = new Error('Forbidden: Only Administrator can trigger password resets');
    error.code = 'FORBIDDEN';
    error.statusCode = 403;
    throw error;
  }

  const person = await Person.findById(personId);
  if (!person) {
    const error = new Error('Person not found');
    error.code = 'NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  person.mustSetPassword = true;
  await person.save();

  return {
    success: true,
    message: `Password reset triggered for ${person.name}`,
  };
}

/**
 * Force Logout (Revoke Sessions)
 */
export async function forceLogout(personId, actor) {
  const actorRole = normalizeRole(actor?.role);
  if (actorRole !== 'admin') {
    const error = new Error('Forbidden: Only Administrator can revoke user sessions');
    error.code = 'FORBIDDEN';
    error.statusCode = 403;
    throw error;
  }

  await Session.deleteMany({ userId: personId });
  disconnectUserSockets(personId);

  return {
    success: true,
    message: 'All active sessions revoked',
  };
}

