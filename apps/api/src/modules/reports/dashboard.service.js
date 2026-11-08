import { WorkItem } from '../workItems/model.js';
import { Person } from '../people/model.js';
import { Department } from '../departments/model.js';
import { Blocker } from '../blockers/model.js';
import { RevisionFlag } from '../feedback/model.js';
import { ActivityEvent } from '../activity/model.js';
import { CalendarPlan } from '../calendar/plan.model.js';
import { ContentPiece } from '../calendar/contentPiece.model.js';
import { calculateMemberWorkloadMetrics } from '../assignment/service.js';
import { resolveScope } from '../../lib/scope.js';
import { derivePlanStatus } from '@mmp/shared';

/**
 * 8-Section Operational Dashboard Overview Service
 * (admin, creative_head, sm_manager, executive; team_member redirected to /my-work)
 * Strictly operational: NO target, funnel, or campaign sections!
 */
export async function getDashboardOverview(filters = {}, user) {
  const scope = await resolveScope(user, filters);
  const now = new Date();
  const currentMonthStr = filters.month || now.toISOString().slice(0, 7);

  // Construct WorkItem query applying resolved scope
  const workItemQuery = {};

  // Person Scoping (for Team Member)
  if (user.role === 'team_member' && !filters.allWork) {
    const userId = (user._id || user.id || user.userId)?.toString();
    workItemQuery.ownerId = userId;
  } else if (filters.ownerId && filters.ownerId !== 'all') {
    workItemQuery.ownerId = filters.ownerId;
  }

  if (filters.departmentId && filters.departmentId !== 'all') {
    workItemQuery.departmentId = filters.departmentId;
  }
  if (filters.calendar && filters.calendar !== 'all') {
    workItemQuery.calendar = filters.calendar;
  }

  // ----------------------------------------------------
  // SECTION 1: Month Plan Status
  // ----------------------------------------------------
  const [yearStr, monthNumStr] = currentMonthStr.split('-');
  const year = parseInt(yearStr, 10) || now.getFullYear();
  const monthNum = parseInt(monthNumStr, 10) || now.getMonth() + 1;
  const startOfMonth = new Date(Date.UTC(year, monthNum - 1, 1, 0, 0, 0, 0));
  const endOfMonth = new Date(Date.UTC(year, monthNum, 0, 23, 59, 59, 999));

  const planQuery = {
    $or: [
      { periodStart: { $lte: endOfMonth }, periodEnd: { $gte: startOfMonth } },
      { periodStart: { $gte: startOfMonth, $lte: endOfMonth } },
    ],
  };

  if (filters.calendar && filters.calendar !== 'all') {
    planQuery.calendar = filters.calendar;
  }
  const plans = await CalendarPlan.find(planQuery)
    .populate('createdById', 'name email role')
    .populate('approvedById', 'name email role')
    .sort({ createdAt: -1 })
    .lean();

  const planSummaries = [];
  let totalPlannedRows = 0;
  let totalDoneRows = 0;

  for (const plan of plans) {
    const rows = await ContentPiece.find({ planId: plan._id }).lean();
    const status = derivePlanStatus(rows);
    const planned = rows.length;
    const done = rows.filter((r) => r.rowStatus === 'approved' || r.isPublished).length;
    totalPlannedRows += planned;
    totalDoneRows += done;

    planSummaries.push({
      _id: plan._id,
      code: plan.code,
      title: plan.title,
      kind: plan.kind,
      status,
      periodStart: plan.periodStart,
      periodEnd: plan.periodEnd,
      planned,
      done,
      submittedAt: plan.submittedAt,
      approvedAt: plan.approvedAt,
      createdByName: plan.createdById?.name,
    });
  }

  const daysInMonth = new Date(year, monthNum, 0).getDate();
  const daysPassed = Math.min(daysInMonth, Math.max(1, now.getDate()));
  const expectedPacePct = Math.round((daysPassed / daysInMonth) * 100);
  const planCompletionPct = totalPlannedRows > 0 ? Math.round((totalDoneRows / totalPlannedRows) * 100) : 0;
  const velocityText = `${totalDoneRows} done of ${totalPlannedRows} planned (${planCompletionPct}% vs ${expectedPacePct}% expected pace)`;

  const monthPlanStatus = {
    selectedMonth: currentMonthStr,
    activePlanStatus: planSummaries[0]?.status || (plans.length > 0 ? 'Draft' : 'No Plans'),
    totalPlans: plans.length,
    planned: totalPlannedRows,
    done: totalDoneRows,
    plannedPieces: totalPlannedRows,
    donePieces: totalDoneRows,
    completionRatePct: planCompletionPct,
    velocity: velocityText,
    plans: planSummaries,
  };

  // ----------------------------------------------------
  // SECTION 2: KPI Strip (7 core operational metrics)
  // ----------------------------------------------------
  const allScopedWorkItems = await WorkItem.find(workItemQuery)
    .select('status deadline estimatedEffortHrs workType revisions departmentId updatedAt createdAt')
    .lean();

  let inProgressCount = 0;
  let inFeedbackCount = 0;
  let blockedCount = 0;
  let approvedCount = 0;
  let publishedCount = 0;
  let overdueCount = 0;
  let atRiskCount = 0;

  const in72h = new Date(now.getTime() + 72 * 60 * 60 * 1000);

  for (const item of allScopedWorkItems) {
    const isTerminal = item.status === 'Approved' || item.status === 'Published';
    const isOverdue = !isTerminal && item.deadline && new Date(item.deadline) < now;
    const isAtRisk =
      !isTerminal &&
      item.status !== 'Feedback' &&
      item.deadline &&
      new Date(item.deadline) <= in72h &&
      new Date(item.deadline) >= now;

    if (item.status === 'In Progress') inProgressCount++;
    else if (item.status === 'Feedback') inFeedbackCount++;
    else if (item.status === 'Blocked') blockedCount++;
    else if (item.status === 'Approved') approvedCount++;
    else if (item.status === 'Published') publishedCount++;

    if (isOverdue) overdueCount++;
    if (isAtRisk) atRiskCount++;
  }

  const completedCount = approvedCount + publishedCount;
  const plannedCount = Math.max(totalPlannedRows, allScopedWorkItems.length);
  const completionRatePct = plannedCount > 0 ? Math.round((completedCount / plannedCount) * 100) : 0;

  const kpisStrip = {
    // 7 Core Metrics
    planned: plannedCount,
    completed: completedCount,
    inProgress: inProgressCount,
    atRisk: atRiskCount,
    blocked: blockedCount,
    pendingApproval: inFeedbackCount,
    overdue: overdueCount,

    // Backward compatibility aliases
    totalWorkItems: allScopedWorkItems.length,
    inFeedback: inFeedbackCount,
    approved: approvedCount,
    published: publishedCount,
    completionRatePct,
  };

  // ----------------------------------------------------
  // SECTION 3: Today's Priorities
  // ----------------------------------------------------
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const prioritiesItems = await WorkItem.find({
    ...workItemQuery,
    status: { $nin: ['Approved', 'Published'] },
    $or: [{ deadline: { $lte: endOfToday } }, { status: 'Blocked' }],
  })
    .populate('ownerId', 'name email role jobRole')
    .sort({ deadline: 1 })
    .limit(8)
    .lean();

  const priorities = prioritiesItems.map((item) => ({
    ...item,
    isOverdue: item.deadline && new Date(item.deadline) < now,
  }));

  // ----------------------------------------------------
  // SECTION 4: Production Stats & Trend
  // ----------------------------------------------------
  const workTypeBreakdown = {};
  for (const item of allScopedWorkItems) {
    if (item.workType) {
      workTypeBreakdown[item.workType] = (workTypeBreakdown[item.workType] || 0) + 1;
    }
  }

  const departments = await Department.find({}).lean();
  const departmentBreakdown = departments.map((d) => {
    const deptItems = allScopedWorkItems.filter(
      (item) => item.departmentId?.toString() === d._id.toString()
    );
    const completed = deptItems.filter((i) => i.status === 'Approved' || i.status === 'Published').length;
    return {
      departmentId: d._id,
      name: d.name,
      code: d.code,
      total: deptItems.length,
      inProgress: deptItems.filter((i) => i.status === 'In Progress').length,
      completed,
    };
  });

  // 4-Week completion trend
  const weeklyTrend = [];
  for (let w = 3; w >= 0; w--) {
    const wStart = new Date(now.getTime() - (w + 1) * 7 * 24 * 60 * 60 * 1000);
    const wEnd = new Date(now.getTime() - w * 7 * 24 * 60 * 60 * 1000);
    const count = allScopedWorkItems.filter(
      (i) =>
        ['Approved', 'Published'].includes(i.status) &&
        i.updatedAt &&
        new Date(i.updatedAt) >= wStart &&
        new Date(i.updatedAt) < wEnd
    ).length;
    weeklyTrend.push({
      weekLabel: `Week -${w}`,
      completed: count,
    });
  }

  const creativeStats = {
    totalDeliverables: allScopedWorkItems.length,
    byWorkType: workTypeBreakdown,
    byDepartment: departmentBreakdown,
    weeklyTrend,
  };

  const personQuery = {
    $or: [{ status: 'active' }, { active: true }],
    role: { $in: ['team_member', 'sm_manager'] },
  };
  if (workItemQuery.departmentId) {
    personQuery.departmentId = workItemQuery.departmentId;
  }

  const activePeople = await Person.find(personQuery)
    .select('_id name email role jobRole departmentId weeklyCapacityHours')
    .populate('departmentId', 'name code')
    .lean();

  let healthyCount = 0;
  let highCount = 0;
  let overloadedCount = 0;
  let sumWorkloadPct = 0;
  const membersSnapshot = [];

  for (const person of activePeople) {
    try {
      const metrics = await calculateMemberWorkloadMetrics(person._id);
      sumWorkloadPct += metrics.workloadPct;

      const memberInfo = {
        personId: person._id,
        name: person.name,
        role: person.role,
        jobRole: person.jobRole,
        departmentName: person.departmentId?.name || 'General',
        workloadPct: metrics.workloadPct, // Real un-capped percentage
        allocatedHours: metrics.allocatedHours,
        capacity: metrics.capacity,
        capacityBand: metrics.capacityBand,
      };

      membersSnapshot.push(memberInfo);

      if (metrics.capacityBand === 'Overloaded') {
        overloadedCount++;
      } else if (metrics.capacityBand === 'High') {
        highCount++;
      } else {
        healthyCount++;
      }
    } catch (_err) {
      healthyCount++;
    }
  }

  const avgWorkloadPct =
    activePeople.length > 0 ? Math.round(sumWorkloadPct / activePeople.length) : 0;

  const workloadSnapshot = {
    totalMembers: activePeople.length,
    avgWorkloadPct,
    bandCounts: {
      healthy: healthyCount,
      high: highCount,
      overloaded: overloadedCount,
    },
    members: membersSnapshot,
    overloadedMembers: membersSnapshot.filter((m) => m.capacityBand === 'Overloaded'),
  };

  // ----------------------------------------------------
  // SECTION 6: Issues & Blockers
  // ----------------------------------------------------
  const activeBlockers = await Blocker.find({ status: 'Active' })
    .populate('workItemId', 'title workType deadline departmentId')
    .populate('dependencyOwnerId', 'name email role jobRole')
    .populate('blockedById', 'name email')
    .sort({ blockedAt: -1 })
    .limit(6)
    .lean();

  const longBlockedCount = activeBlockers.filter((b) => {
    const elapsedHrs = (now.getTime() - new Date(b.blockedAt).getTime()) / (1000 * 60 * 60);
    return elapsedHrs > 48;
  }).length;

  // Phase 7 close-out: flags are listed by project and step (owner name on the row only;
  // never grouped, counted or sorted by person).
  const activeFlags = await RevisionFlag.find({ isFlagged: true })
    .populate({ path: 'workItemId', select: 'title workType stageKey stageOrder contentPieceId', populate: { path: 'contentPieceId', select: 'topic' } })
    .populate('ownerId', 'name')
    .lean();
  const flagProject = (f) => f.workItemId?.contentPieceId?.topic || f.workItemId?.title || 'Deliverable';
  activeFlags.sort(
    (a, b) => flagProject(a).localeCompare(flagProject(b)) || (a.workItemId?.stageOrder || 0) - (b.workItemId?.stageOrder || 0)
  );

  const escalatedFlagsCount = activeFlags.filter(
    (f) =>
      f.isEscalated || (!f.rootCause && now.getTime() - new Date(f.flaggedAt).getTime() > 48 * 3600 * 1000)
  ).length;

  const issuesSnapshot = {
    activeBlockersCount: activeBlockers.length,
    longBlockedCount,
    activeFlagsCount: activeFlags.length,
    escalatedFlagsCount,
    blockersList: activeBlockers.map((b) => ({
      _id: b._id,
      workItemId: b.workItemId?._id,
      deliverableTitle: b.workItemId?.title || 'Deliverable',
      reason: b.reason,
      notes: b.notes,
      dependencyOwnerName: b.dependencyOwnerId?.name,
      blockedAt: b.blockedAt,
      durationHours: Math.round((now.getTime() - new Date(b.blockedAt).getTime()) / (1000 * 60 * 60)),
    })),
    revisionFlags: activeFlags.map((f) => ({
      _id: f._id,
      workItemId: f.workItemId?._id,
      project: flagProject(f),
      stepType: f.workItemId?.stageKey || f.workItemId?.workType || 'Step',
      deliverableTitle: f.workItemId?.title || 'Deliverable',
      ownerName: f.ownerId?.name || null,
      revisionsCount: f.revisionsCount,
      rootCause: f.rootCause,
      isEscalated: f.isEscalated,
      flaggedAt: f.flaggedAt,
    })),
  };

  // ----------------------------------------------------
  // SECTION 7: Waiting for Approval (Plans & Stages)
  // ----------------------------------------------------
  const pendingApprovalPlans = plans
    .filter((p) => p.submittedAt && !p.approvedAt)
    .map((p) => ({
      _id: p._id,
      code: p.code,
      title: p.title,
      submittedAt: p.submittedAt,
      createdByName: p.createdById?.name || 'SM Manager',
    }));

  const pendingApprovalStages = await WorkItem.find({
    ...workItemQuery,
    status: 'Feedback',
  })
    .populate('ownerId', 'name email jobRole')
    .sort({ updatedAt: -1 })
    .limit(8)
    .lean();

  const waitingApproval = {
    plansCount: pendingApprovalPlans.length,
    stagesCount: inFeedbackCount,
    totalPending: pendingApprovalPlans.length + inFeedbackCount,
    plans: pendingApprovalPlans,
    stages: pendingApprovalStages.map((s) => ({
      _id: s._id,
      title: s.title,
      workType: s.workType,
      currentStageKey: s.currentStageKey,
      ownerName: s.ownerId?.name || 'Assignee',
      deadline: s.deadline,
    })),
  };

  // ----------------------------------------------------
  // SECTION 8: Recent Activity Feed
  // ----------------------------------------------------
  const recentActivities = await ActivityEvent.find({})
    .populate('actorId', 'name email role')
    .sort({ timestamp: -1 })
    .limit(10)
    .lean();

  return {
    scope: {
      departmentId: filters.departmentId || 'all',
      ownerId: filters.ownerId || 'all',
      month: currentMonthStr,
      userRole: user.role,
    },
    monthPlanStatus,
    kpis: kpisStrip,
    priorities,
    todaysPriorities: priorities,
    creativeStats,
    productionStats: creativeStats,
    workload: workloadSnapshot,
    teamWorkload: workloadSnapshot,
    issues: issuesSnapshot,
    issuesAndBlockers: issuesSnapshot,
    waitingApproval,
    waitingForApproval: waitingApproval,
    recentActivity: recentActivities,
  };
}

/**
 * Backward compatibility handler for legacy role summary
 */
export async function getDashboardSummaryByRole(role, user) {
  return getDashboardOverview({ role }, user);
}
