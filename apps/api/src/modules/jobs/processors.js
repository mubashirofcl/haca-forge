import { Task } from '../tasks/model.js';
import { ContentItem } from '../content/model.js';
import { Request } from '../requests/model.js';
import { User } from '../users/model.js';
import { Counter, getNextSequenceId } from '../requests/counter.model.js';
import { eventBus, EVENTS } from '../../lib/events.js';
import { logger } from '../../lib/logger.js';

/**
 * 1. Deadline Reminders Job (Idempotent)
 * Checks for tasks and content items due in <= 24 hours, and overdue items.
 */
export async function runDeadlineRemindersJob() {
  const now = new Date();
  const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const results = { approaching: 0, overdue: 0 };

  try {
    // 1A. Tasks Approaching Deadline (in <= 24 hours, not yet reminded, active status)
    const approachingTasks = await Task.find({
      dueDate: { $gte: now, $lte: in24Hours },
      reminderSentAt: { $exists: false },
      status: { $nin: ['completed', 'published', 'delivered'] },
    }).populate('assignee', 'name email');

    for (const task of approachingTasks) {
      task.reminderSentAt = now;
      await task.save();

      const hoursLeft = Math.max(1, Math.round((new Date(task.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60)));
      eventBus.emit(EVENTS.DEADLINE_APPROACHING, {
        itemType: 'Task',
        id: task._id,
        taskId: task.taskId,
        title: task.title,
        dueDate: task.dueDate,
        hoursLeft,
        assignee: task.assignee?._id || task.assignee,
        team: task.team,
        link: `/tasks?taskId=${task.taskId}`,
      });
      results.approaching += 1;
    }

    // 1B. Tasks Overdue (dueDate < now, overdue alert not yet sent, active status)
    const overdueTasks = await Task.find({
      dueDate: { $lt: now },
      overdueAlertSentAt: { $exists: false },
      status: { $nin: ['completed', 'published', 'delivered'] },
    }).populate('assignee', 'name email');

    for (const task of overdueTasks) {
      task.overdueAlertSentAt = now;
      await task.save();

      eventBus.emit(EVENTS.DEADLINE_OVERDUE, {
        itemType: 'Task',
        id: task._id,
        taskId: task.taskId,
        title: task.title,
        dueDate: task.dueDate,
        assignee: task.assignee?._id || task.assignee,
        team: task.team,
        link: `/tasks?taskId=${task.taskId}`,
      });
      results.overdue += 1;
    }

    // 1C. Content Items Approaching Deadline
    const approachingContent = await ContentItem.find({
      productionDeadline: { $gte: now, $lte: in24Hours },
      reminderSentAt: { $exists: false },
      status: { $nin: ['published', 'archived'] },
    }).populate('requester', 'name email');

    for (const item of approachingContent) {
      item.reminderSentAt = now;
      await item.save();

      const hoursLeft = Math.max(1, Math.round((new Date(item.productionDeadline).getTime() - now.getTime()) / (1000 * 60 * 60)));
      eventBus.emit(EVENTS.DEADLINE_APPROACHING, {
        itemType: 'ContentItem',
        id: item._id,
        contentId: item.contentId,
        title: item.title,
        dueDate: item.productionDeadline,
        hoursLeft,
        assignee: item.requester?._id || item.requester,
        link: `/content?contentId=${item.contentId}`,
      });
      results.approaching += 1;
    }

    logger.info(results, 'Deadline reminders job executed successfully');
    return results;
  } catch (err) {
    logger.error({ err: err.message }, 'Error running deadline reminders job');
    throw err;
  }
}

/**
 * 2. Recurring Requests Job
 * Spawns new request instances for active recurring templates when nextRunAt <= now.
 */
export async function runRecurringRequestsJob() {
  const now = new Date();
  const createdRequests = [];

  try {
    const recurringTemplates = await Request.find({
      'recurring.isRecurring': true,
      'recurring.nextRunAt': { $lte: now },
      $or: [
        { 'recurring.endDate': { $exists: false } },
        { 'recurring.endDate': null },
        { 'recurring.endDate': { $gte: now } },
      ],
    });

    for (const template of recurringTemplates) {
      // Generate next sequential request ID
      const newRequestId = await getNextSequenceId('MKT');

      const newRequest = await Request.create({
        requestId: newRequestId,
        title: `${template.title} (${now.toLocaleDateString()})`,
        sourceDepartment: template.sourceDepartment,
        requester: template.requester,
        requestType: template.requestType,
        requestTypeName: template.requestTypeName,
        dynamicFields: template.dynamicFields || {},
        priority: template.priority || 'medium',
        deadline: template.deadline || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        status: 'submitted',
        targetAudience: template.targetAudience,
        channels: template.channels,
        deliverables: template.deliverables,
        budget: template.budget,
        notes: `Automatically generated from recurring template ${template.requestId}`,
        recurring: {
          isRecurring: false, // Child instances are not recurring themselves
        },
      });

      // Calculate next run date for the template
      const nextRun = new Date(template.recurring.nextRunAt || now);
      if (template.recurring.frequency === 'monthly') {
        nextRun.setMonth(nextRun.getMonth() + 1);
      } else {
        // default weekly
        nextRun.setDate(nextRun.getDate() + 7);
      }
      template.recurring.nextRunAt = nextRun;
      await template.save();

      eventBus.emit(EVENTS.REQUEST_CREATED, newRequest);
      createdRequests.push(newRequest.requestId);
    }

    logger.info({ count: createdRequests.length, requests: createdRequests }, 'Recurring requests job processed');
    return createdRequests;
  } catch (err) {
    logger.error({ err: err.message }, 'Error running recurring requests job');
    throw err;
  }
}

/**
 * 3. Daily Digest Job
 * Prepares and sends operational digest for Leads, Marketing Leads, and Admins.
 */
export async function runDailyDigestJob() {
  const now = new Date();
  let digestsSent = 0;

  try {
    // 1. Gather global operational metrics
    const [pendingTriageCount, overdueTasksCount] = await Promise.all([
      Request.countDocuments({ status: { $in: ['submitted', 'under_triage'] } }),
      Task.countDocuments({
        dueDate: { $lt: now },
        status: { $nin: ['completed', 'published', 'delivered'] },
      }),
    ]);

    // 2. Find eligible leads & admins with dailyDigest enabled
    const leads = await User.find({
      role: { $in: ['admin', 'head', 'lead', 'marketing_lead', 'creative_lead', 'copy_lead', 'video_lead'] },
      status: 'active',
      $or: [
        { 'notificationPreferences.dailyDigest': true },
        { 'notificationPreferences.email.dailyDigest': true },
        { notificationPreferences: { $exists: false } },
      ],
    });

    for (const user of leads) {
      let teamBlockedTasks = 0;
      if (user.teamId) {
        teamBlockedTasks = await Task.countDocuments({ team: user.teamId, status: 'blocked' });
      } else {
        teamBlockedTasks = await Task.countDocuments({ status: 'blocked' });
      }

      eventBus.emit('daily.digest', {
        recipientId: user._id,
        name: user.name,
        email: user.email,
        pendingTriage: pendingTriageCount,
        blockedTasks: teamBlockedTasks,
        pendingReviews: 0,
        overdueTasks: overdueTasksCount,
      });

      digestsSent += 1;
    }

    logger.info({ digestsSent }, 'Daily digest job completed');
    return { digestsSent };
  } catch (err) {
    logger.error({ err: err.message }, 'Error running daily digest job');
    throw err;
  }
}

/**
 * 4. Capacity Gap Job
 * Checks next week's team scheduled workload vs capacity.
 */
export async function runCapacityGapJob() {
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const alertsGenerated = [];

  try {
    const teams = ['content', 'graphics', 'cinematography', 'editor'];

    for (const teamKey of teams) {
      // Find active staff for this team
      const teamUsers = await User.find({
        $or: [{ teamId: teamKey }, { team: teamKey }],
        status: 'active',
        attendance: 'present',
      });

      const totalTeamCapacity = teamUsers.reduce((acc, u) => acc + (u.capacity || 40), 0);

      // Sum estimated hours of active tasks in this team
      const activeTasks = await Task.find({
        team: teamKey,
        status: { $in: ['assigned', 'in_progress', 'review'] },
        dueDate: { $lte: nextWeek },
      });

      const totalScheduledHours = activeTasks.reduce((acc, t) => acc + (t.estimateHours || 2), 0);

      if (totalTeamCapacity > 0 && totalScheduledHours > totalTeamCapacity) {
        eventBus.emit(EVENTS.CAPACITY_GAP, {
          teamName: teamKey,
          teamKey,
          scheduledHours: totalScheduledHours,
          capacityHours: totalTeamCapacity,
          overloadPercentage: Math.round((totalScheduledHours / totalTeamCapacity) * 100),
        });
        alertsGenerated.push({ teamKey, totalScheduledHours, totalTeamCapacity });
      }
    }

    logger.info({ alerts: alertsGenerated }, 'Capacity gap job completed');
    return alertsGenerated;
  } catch (err) {
    logger.error({ err: err.message }, 'Error running capacity gap job');
    throw err;
  }
}

/**
 * 5. Scheduled Reports Email Job
 * Dispatches recurring report summaries to configured recipient lists
 */
export async function runScheduledReportsJob() {
  const { ScheduledReport } = await import('../reports/model.js');
  const { generateReportExport } = await import('../reports/service.js');
  const { sendMail } = await import('../../lib/mailer.js');

  const now = new Date();
  const dueReports = await ScheduledReport.find({
    isActive: true,
    nextRunAt: { $lte: now },
  });

  const processed = [];

  for (const report of dueReports) {
    try {
      const { filename, data } = await generateReportExport({
        reportType: report.reportType,
        format: report.format || 'xlsx',
        filters: report.filters || {},
        user: { role: 'admin', userId: report.createdBy },
      });

      const subject = `[Scheduled Report] ${report.name} (${report.frequency.toUpperCase()})`;
      const summaryText = `Here is your scheduled ${report.reportType} report for ${report.name}.\n\nGenerated at: ${new Date().toISOString()}\nRecipients: ${report.recipients.join(', ')}`;

      await sendMail({
        to: report.recipients.join(', '),
        subject,
        text: summaryText,
        html: `<div style="font-family:sans-serif;padding:16px;">
          <h2>📊 ${report.name}</h2>
          <p>Your automated <strong>${report.reportType}</strong> report has been prepared.</p>
          <p><strong>Frequency:</strong> ${report.frequency}</p>
          <pre style="background:#f4f4f5;padding:12px;border-radius:6px;">${JSON.stringify(data.summary || data, null, 2)}</pre>
        </div>`,
      });

      report.lastSentAt = now;
      const nextRun = new Date(now);
      if (report.frequency === 'daily') nextRun.setDate(nextRun.getDate() + 1);
      else if (report.frequency === 'monthly') nextRun.setMonth(nextRun.getMonth() + 1);
      else nextRun.setDate(nextRun.getDate() + 7);
      report.nextRunAt = nextRun;
      await report.save();

      processed.push(report.name);
    } catch (err) {
      logger.error({ err: err.message, reportId: report._id }, 'Failed to dispatch scheduled report');
    }
  }

  logger.info({ processedCount: processed.length }, 'Scheduled reports job finished');
  return processed;
}

