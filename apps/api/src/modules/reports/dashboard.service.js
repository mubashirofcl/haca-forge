import { WorkItem } from '../workItems/model.js';
import { Campaign } from '../campaigns/model.js';
import { MonthlyTarget } from '../targets/model.js';
import { Person } from '../people/model.js';
import { Department } from '../departments/model.js';
import { Blocker } from '../blockers/model.js';
import { RevisionFlag } from '../feedback/model.js';
import { ActivityEvent } from '../activity/model.js';
import { calculateMemberWorkloadMetrics } from '../assignment/service.js';
import { resolveScope } from '../../lib/scope.js';

/**
 * 9-Section Team Dashboard Overview Service
 */
export async function getDashboardOverview(filters = {}, user) {
  const scope = await resolveScope(user, filters);
  const now = new Date();
  const currentMonthStr = filters.month || now.toISOString().slice(0, 7);

  // Construct WorkItem query applying resolved scope
  const workItemQuery = {};

  // Profile Scoping
  if (!scope.canAccessAllProfiles) {
    if (filters.profileId && filters.profileId !== 'all') {
      if (!scope.allowedProfileIds.includes(filters.profileId.toString())) {
        workItemQuery.profileId = { $in: [] };
      } else {
        workItemQuery.profileId = filters.profileId;
      }
    } else {
      workItemQuery.profileId = { $in: scope.allowedProfileIds };
    }
  } else if (filters.profileId && filters.profileId !== 'all') {
    workItemQuery.profileId = filters.profileId;
  }

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
  if (filters.campaignId && filters.campaignId !== 'all') {
    workItemQuery.campaignId = filters.campaignId;
  }

  // ----------------------------------------------------
  // SECTION 1: Targets Strip
  // ----------------------------------------------------
  const targetQuery = { month: currentMonthStr };
  if (workItemQuery.profileId) {
    targetQuery.profileId = workItemQuery.profileId;
  }

  const targets = await MonthlyTarget.find(targetQuery)
    .populate('profileId', 'name code active')
    .lean();

  const targetsStrip = {
    month: currentMonthStr,
    targetCount: targets.length,
    revenueTarget: targets.reduce((sum, t) => sum + (t.revenueTarget || 0), 0),
    leadsTarget: targets.reduce((sum, t) => sum + (t.leadsTarget || 0), 0),
    qualifiedLeadsTarget: targets.reduce((sum, t) => sum + (t.qualifiedLeadsTarget || 0), 0),
    budgetAllocated: targets.reduce((sum, t) => sum + (t.budget || 0), 0),
    targetsList: targets.map((t) => ({
      _id: t._id,
      profileName: t.profileId?.name || 'All Profiles',
      revenueTarget: t.revenueTarget,
      leadsTarget: t.leadsTarget,
      qualifiedLeadsTarget: t.qualifiedLeadsTarget,
      budget: t.budget,
    })),
  };

  // ----------------------------------------------------
  // SECTION 2: KPI Strip & Execution Pulse
  // ----------------------------------------------------
  const allScopedWorkItems = await WorkItem.find(workItemQuery)
    .select('status deadline estimatedEffortHrs workType revisions profileId departmentId')
    .lean();

  let inProgressCount = 0;
  let inFeedbackCount = 0;
  let blockedCount = 0;
  let approvedCount = 0;
  let publishedCount = 0;
  let overdueCount = 0;

  for (const item of allScopedWorkItems) {
    const isTerminal = item.status === 'Approved' || item.status === 'Published';
    const isOverdue = !isTerminal && item.deadline && new Date(item.deadline) < now;

    if (item.status === 'In Progress') inProgressCount++;
    else if (item.status === 'Feedback') inFeedbackCount++;
    else if (item.status === 'Blocked') blockedCount++;
    else if (item.status === 'Approved') approvedCount++;
    else if (item.status === 'Published') publishedCount++;

    if (isOverdue) overdueCount++;
  }

  const totalItems = allScopedWorkItems.length;
  const completedCount = approvedCount + publishedCount;
  const completionRatePct = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

  const kpisStrip = {
    totalWorkItems: totalItems,
    inProgress: inProgressCount,
    inFeedback: inFeedbackCount,
    blocked: blockedCount,
    approved: approvedCount,
    published: publishedCount,
    overdue: overdueCount,
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
    .populate('campaignId', 'name')
    .populate('profileId', 'name code')
    .populate('ownerId', 'name email role jobRole')
    .sort({ deadline: 1 })
    .limit(6)
    .lean();

  const priorities = prioritiesItems.map((item) => ({
    ...item,
    isOverdue: item.deadline && new Date(item.deadline) < now,
  }));

  // ----------------------------------------------------
  // SECTION 4: Creative Production Stats
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

  const creativeStats = {
    totalDeliverables: totalItems,
    byWorkType: workTypeBreakdown,
    byDepartment: departmentBreakdown,
  };

  // ----------------------------------------------------
  // SECTION 5: Campaign Progress
  // ----------------------------------------------------
  const campaignQuery = {};
  if (workItemQuery.profileId) {
    campaignQuery.profileId = workItemQuery.profileId;
  }

  const activeCampaigns = await Campaign.find(campaignQuery)
    .populate('profileId', 'name code')
    .populate('ownerId', 'name email')
    .sort({ updatedAt: -1 })
    .limit(6)
    .lean();

  const campaignsProgress = await Promise.all(
    activeCampaigns.map(async (c) => {
      const campItems = await WorkItem.find({ campaignId: c._id }).select('status').lean();
      const campTotal = campItems.length;
      const campDone = campItems.filter((i) => i.status === 'Approved' || i.status === 'Published').length;
      const progressPct = campTotal > 0 ? Math.round((campDone / campTotal) * 100) : 0;

      return {
        _id: c._id,
        name: c.name,
        profileName: c.profileId?.name || 'Profile',
        status: c.status,
        goalType: c.goalType,
        budgetAllocated: c.budgetAllocated || 0,
        totalItems: campTotal,
        completedItems: campDone,
        progressPct,
      };
    })
  );

  // ----------------------------------------------------
  // SECTION 6: Team Workload Snapshot
  // ----------------------------------------------------
  const personQuery = { active: true, role: { $in: ['team_member', 'team_lead'] } };
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
  const overloadedMembers = [];

  for (const person of activePeople) {
    try {
      const metrics = await calculateMemberWorkloadMetrics(person._id);
      sumWorkloadPct += metrics.workloadPct;

      if (metrics.capacityBand === 'Overloaded') {
        overloadedCount++;
        overloadedMembers.push({
          personId: person._id,
          name: person.name,
          role: person.role,
          jobRole: person.jobRole,
          departmentName: person.departmentId?.name || 'Department',
          workloadPct: metrics.workloadPct,
          allocatedHours: metrics.allocatedHours,
          capacity: metrics.capacity,
          capacityBand: metrics.capacityBand,
        });
      } else if (metrics.capacityBand === 'High') {
        highCount++;
      } else {
        healthyCount++;
      }
    } catch (err) {
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
    overloadedMembers,
  };

  // ----------------------------------------------------
  // SECTION 7: Lead Funnel Snapshot
  // ----------------------------------------------------
  const totalLeadsTarget = targetsStrip.leadsTarget;
  const qualifiedLeadsTarget = targetsStrip.qualifiedLeadsTarget;
  const conversionRateTarget =
    totalLeadsTarget > 0 ? Number(((qualifiedLeadsTarget / totalLeadsTarget) * 100).toFixed(1)) : 0;

  const leadFunnelSnapshot = {
    totalLeadsTarget,
    qualifiedLeadsTarget,
    conversionRateTarget,
    activeCampaignsWithGoals: activeCampaigns.filter((c) => c.goalType === 'Leads').length,
  };

  // ----------------------------------------------------
  // SECTION 8: Issues & Blockers
  // ----------------------------------------------------
  const activeBlockers = await Blocker.find({ status: 'Active' })
    .populate('workItemId', 'title workType deadline profileId departmentId')
    .populate('dependencyOwnerId', 'name email role jobRole')
    .populate('blockedById', 'name email')
    .sort({ blockedAt: -1 })
    .limit(5)
    .lean();

  const longBlockedCount = activeBlockers.filter((b) => {
    const elapsedHrs = (now.getTime() - new Date(b.blockedAt).getTime()) / (1000 * 60 * 60);
    return elapsedHrs > 48;
  }).length;

  const activeFlags = await RevisionFlag.find({ isFlagged: true })
    .populate('workItemId', 'title workType')
    .populate('ownerId', 'name email')
    .lean();

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
  };

  // ----------------------------------------------------
  // SECTION 9: Recent Activity Feed
  // ----------------------------------------------------
  const recentActivities = await ActivityEvent.find({})
    .populate('actorId', 'name email role')
    .populate('profileId', 'name code')
    .sort({ timestamp: -1 })
    .limit(8)
    .lean();

  return {
    scope: {
      profileId: filters.profileId || 'all',
      departmentId: filters.departmentId || 'all',
      ownerId: filters.ownerId || 'all',
      campaignId: filters.campaignId || 'all',
      month: currentMonthStr,
      userRole: user.role,
    },
    targets: targetsStrip,
    kpis: kpisStrip,
    priorities,
    creativeStats,
    campaigns: campaignsProgress,
    workload: workloadSnapshot,
    leadFunnel: leadFunnelSnapshot,
    issues: issuesSnapshot,
    recentActivity: recentActivities,
  };
}

/**
 * Backward compatibility handler for legacy role summary
 */
export async function getDashboardSummaryByRole(role, user) {
  return getDashboardOverview({ role }, user);
}
