import mongoose from 'mongoose';
import { Request } from '../requests/model.js';
import { ContentItem } from '../content/model.js';
import { Task } from '../tasks/model.js';
import { TimeEntry } from '../time/model.js';
import { Deliverable } from '../deliverables/model.js';
import { getScorecardReport, getIndividualReport } from './service.js';

export async function getDashboardSummaryByRole(role, user) {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  // 1. Worker Dashboard
  if (role === 'worker') {
    let targetWorker = user.role === 'worker' ? user : await User.findOne({ role: 'worker', status: 'active' });
    if (!targetWorker) targetWorker = user;
    const workerId = new mongoose.Types.ObjectId(targetWorker._id);

    const [todayTasks, dueThisWeek, overdueTasks, blockedTasks, revisionTasks, timeThisWeek, individualStats] =
      await Promise.all([
        Task.find({
          assignee: workerId,
          dueDate: {
            $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0),
            $lte: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59),
          },
          status: { $ne: 'done' },
        }).lean(),
        Task.find({
          assignee: workerId,
          dueDate: { $gte: startOfWeek, $lte: endOfWeek },
          status: { $ne: 'done' },
        }).lean(),
        Task.find({
          assignee: workerId,
          dueDate: { $lt: now },
          status: { $ne: 'done' },
        }).lean(),
        Task.find({
          assignee: workerId,
          status: { $in: ['blocked', 'on_hold'] },
        }).lean(),
        Task.find({
          assignee: workerId,
          status: 'changes_requested',
        }).lean(),
        TimeEntry.aggregate([
          {
            $match: {
              userId: workerId,
              date: { $gte: startOfWeek, $lte: endOfWeek },
            },
          },
          { $group: { _id: null, totalMinutes: { $sum: '$minutes' } } },
        ]),
        getIndividualReport(targetWorker._id.toString(), { startDate: startOfWeek, endDate: endOfWeek }, targetWorker),
      ]);

    const loggedMinutes = timeThisWeek[0]?.totalMinutes || 0;

    return {
      role: 'worker',
      widgets: {
        todayTasksCount: todayTasks.length,
        dueThisWeekCount: dueThisWeek.length,
        overdueCount: overdueTasks.length,
        blockedCount: blockedTasks.length,
        pendingRevisionsCount: revisionTasks.length,
        hoursLoggedThisWeek: Math.round((loggedMinutes / 60) * 10) / 10,
        weeklyCapacity: user.capacity || 40,
        efficiencyScore: individualStats.metrics.efficiencyScore,
        onTimeRate: individualStats.metrics.onTimeRate,
        firstPassRate: individualStats.metrics.firstPassRate,
      },
      todayTasks,
      overdueTasks,
      revisionTasks,
    };
  }

  // 2. SM Manager Dashboard
  if (role === 'sm_manager') {
    const [scheduledPosts, publishedThisWeek, awaitingConfirmation, platformBreakdown] = await Promise.all([
      ContentItem.find({
        status: 'scheduled',
        publishDate: { $gte: startOfWeek, $lte: endOfWeek },
      })
        .select('title format platform publishDate status')
        .sort({ publishDate: 1 })
        .lean(),
      ContentItem.countDocuments({
        status: { $in: ['published', 'live'] },
        publishedAt: { $gte: startOfWeek, $lte: endOfWeek },
      }),
      ContentItem.find({
        'requesterConfirmation.status': 'pending',
      })
        .select('title format platform requesterConfirmation')
        .lean(),
      ContentItem.aggregate([
        { $match: { createdAt: { $gte: startOfWeek } } },
        { $group: { _id: '$platform', count: { $sum: 1 } } },
      ]),
    ]);

    return {
      role: 'sm_manager',
      widgets: {
        scheduledPostsCount: scheduledPosts.length,
        publishedThisWeekCount: publishedThisWeek,
        awaitingConfirmationCount: awaitingConfirmation.length,
        platformBreakdown: platformBreakdown.map((p) => ({ platform: p._id, count: p.count })),
      },
      upcomingScheduledPosts: scheduledPosts,
      awaitingConfirmation,
    };
  }

  // 3. Department Lead / Staff Dashboard
  if (role === 'dept_lead' || role === 'dept_staff') {
    const department = user.department;
    const [openRequests, completedRequests, awaitingReviewDeliverables] = await Promise.all([
      Request.find({
        sourceDepartment: department,
        status: { $in: ['submitted', 'under_triage', 'accepted', 'needs_info'] },
      })
        .select('requestId title requestTypeName status priority deadline createdAt')
        .sort({ createdAt: -1 })
        .lean(),
      Request.find({
        sourceDepartment: department,
        status: { $in: ['converted', 'completed'] },
      }).countDocuments(),
      ContentItem.find({
        sourceDepartment: department,
        'requesterConfirmation.status': 'pending',
      })
        .select('contentId title format platform requesterConfirmation')
        .lean(),
    ]);

    return {
      role,
      department,
      widgets: {
        activeRequestsCount: openRequests.length,
        completedRequestsCount: completedRequests,
        pendingConfirmationsCount: awaitingReviewDeliverables.length,
      },
      openRequests,
      pendingConfirmations: awaitingReviewDeliverables,
    };
  }

  // 4. Team Lead Dashboard
  if (role === 'team_lead') {
    const userTeam = user.teamId || user.team;
    const [teamTasks, completedThisWeek, blockedTasks, teamMembers] = await Promise.all([
      Task.find({
        team: userTeam,
        status: { $in: ['assigned', 'in_progress', 'submitted', 'changes_requested'] },
      })
        .populate('assignee', 'name email attendance')
        .lean(),
      Task.countDocuments({
        team: userTeam,
        status: 'done',
        updatedAt: { $gte: startOfWeek, $lte: endOfWeek },
      }),
      Task.find({
        team: userTeam,
        status: { $in: ['blocked', 'on_hold'] },
      })
        .populate('assignee', 'name email')
        .lean(),
      User.find({
        role: 'worker',
        teamId: userTeam,
        status: 'active',
      })
        .select('name email attendance onLeave capacity')
        .lean(),
    ]);

    return {
      role: 'team_lead',
      team: userTeam,
      widgets: {
        activeTasksCount: teamTasks.length,
        completedThisWeek,
        blockedCount: blockedTasks.length,
        teamSize: teamMembers.length,
      },
      teamTasks,
      blockedTasks,
      teamMembers,
    };
  }

  // 5. Admin, Lead, Viewer Dashboard (Default Executive View)
  const [scorecard, awaitingTriage, awaitingReview, blockedTasks, pipelinesByStage] = await Promise.all([
    getScorecardReport({ startDate: startOfWeek, endDate: endOfWeek }, user),
    Request.find({ status: { $in: ['submitted', 'under_triage'] } })
      .select('requestId title sourceDepartment priority deadline createdAt')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
    Deliverable.find({ status: 'submitted' })
      .populate('taskId', 'title team')
      .limit(10)
      .lean(),
    Task.find({ status: { $in: ['blocked', 'on_hold'] } })
      .populate('assignee', 'name email')
      .limit(10)
      .lean(),
    ContentItem.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $project: { _id: 0, stage: '$_id', count: 1 } },
    ]),
  ]);

  return {
    role,
    widgets: {
      scorecard: scorecard.scorecard,
      demandForecast: scorecard.forecast,
      awaitingTriageCount: awaitingTriage.length,
      awaitingReviewCount: awaitingReview.length,
      blockedCount: blockedTasks.length,
      pipelinesByStage,
    },
    awaitingTriage,
    awaitingReview,
    blockedTasks,
  };
}
