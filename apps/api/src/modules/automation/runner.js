import { AutomationRule } from './model.js';
import { WorkItem } from '../workItems/model.js';
import { Person } from '../people/model.js';
import { Blocker } from '../blockers/model.js';
import { FeedbackEntry, RevisionFlag } from '../feedback/model.js';
import { Notification } from '../notifications/model.js';
import { ActivityEvent } from '../activity/model.js';
import { enqueueEmail } from '../../lib/queue.js';
import { generateReport } from '../reports/service.js';
import { logger } from '../../lib/logger.js';

// Default 7 Automation Rules seed data
export const DEFAULT_AUTOMATION_RULES = [
  {
    ruleKey: 'month_end_report',
    name: 'Month-End Performance Scorecard',
    description: 'Automatically compiles and dispatches the Monthly Performance Scorecard to Marketing Head and Admin at 23:59 on the final day of each month.',
    trigger: 'cron',
    schedule: 'Last day of month 23:59',
    cronExpression: '59 23 28-31 * *',
    action: 'Generate and distribute Monthly Performance Scorecard report',
    active: true,
    config: { reportKey: 'monthly_scorecard', sendEmail: true },
  },
  {
    ruleKey: 'overdue_escalation',
    name: 'Overdue Deliverable Escalation',
    description: 'Continuously audits deliverables past their deadline. Pings deliverable owner immediately; escalates to Department Team Lead after 4 hours overdue.',
    trigger: 'scheduled',
    schedule: 'Hourly check',
    cronExpression: '0 * * * *',
    action: 'Dispatch owner reminder and Team Lead escalation for overdue work items',
    active: true,
    config: { leadEscalationHours: 4 },
  },
  {
    ruleKey: 'todo_escalation',
    name: 'Stale Task & Todo Escalation',
    description: 'Flags open deliverables in progress that have experienced no status change for 3 or more consecutive days, prompting status updates.',
    trigger: 'scheduled',
    schedule: 'Daily at 09:00 AM',
    cronExpression: '0 9 * * *',
    action: 'Notify deliverable owner of stagnant deliverable in progress',
    active: true,
    config: { daysInactive: 3 },
  },
  {
    ruleKey: 'blocker_dependency_alert',
    name: 'Blocker Dependency Alert & SLA Monitor',
    description: 'Monitors unresolved deliverable blockers and executes reminder pings to assigned cross-functional dependency owners every 24 hours.',
    trigger: 'event',
    schedule: 'Instant & 24h cadence',
    cronExpression: '0 10 * * *',
    action: 'Dispatch blocker reminder to cross-team dependency owner',
    active: true,
    config: { reminderIntervalHours: 24 },
  },
  {
    ruleKey: 'revision_pattern_flag',
    name: 'Revision Pattern & Quality Guard',
    description: 'Detects deliverables entering round 4 or higher; triggers an excessive revision flag to Marketing Head and requests root-cause classification.',
    trigger: 'event',
    schedule: 'Instant on 4th round',
    cronExpression: null,
    action: 'Create RevisionFlag and alert Marketing Head',
    active: true,
    config: { thresholdRound: 4 },
  },
  {
    ruleKey: 'weekly_report',
    name: 'Weekly Marketing Executive Digest',
    description: 'Generates the comprehensive Weekly Marketing Report every Monday at 08:00 AM, detailing planned vs completed output, department throughput, and open blockers.',
    trigger: 'cron',
    schedule: 'Mondays at 08:00 AM',
    cronExpression: '0 8 * * 1',
    action: 'Generate and email Weekly Marketing Report to leadership',
    active: true,
    config: { reportKey: 'weekly_marketing', sendEmail: true },
  },
];

/**
 * Ensures standard 7 Automation Rules exist in the database.
 */
export async function ensureAutomationRules() {
  const validKeys = DEFAULT_AUTOMATION_RULES.map((r) => r.ruleKey);
  await AutomationRule.deleteMany({ ruleKey: { $nin: validKeys } });
  for (const rule of DEFAULT_AUTOMATION_RULES) {
    await AutomationRule.findOneAndUpdate(
      { ruleKey: rule.ruleKey },
      { $setOnInsert: rule },
      { upsert: true, new: true }
    );
  }
}

/**
 * Executes an automation rule by ruleKey.
 * Guaranteed idempotency: prevents spamming duplicate notifications within deduplication window.
 */
export async function executeAutomationRule(ruleKey, user = null, options = {}) {
  await ensureAutomationRules();
  const rule = await AutomationRule.findOne({ ruleKey });
  if (!rule) {
    throw new Error(`Automation rule not found: ${ruleKey}`);
  }

  // If rule is paused and not forced, skip execution
  if (!rule.active && !options.force) {
    return {
      ruleKey,
      status: 'skipped',
      message: 'Rule is paused / inactive',
    };
  }

  // Mark status as running
  rule.lastRunStatus = 'running';
  await rule.save();

  try {
    let result;
    switch (ruleKey) {
      case 'month_end_report':
        result = await runMonthEndReportRule(rule, user);
        break;
      case 'overdue_escalation':
        result = await runOverdueEscalationRule(rule, user);
        break;
      case 'todo_escalation':
        result = await runTodoEscalationRule(rule, user);
        break;
      case 'blocker_dependency_alert':
        result = await runBlockerDependencyAlertRule(rule, user);
        break;
      case 'revision_pattern_flag':
        result = await runRevisionPatternFlagRule(rule, user);
        break;
      case 'weekly_report':
        result = await runWeeklyReportRule(rule, user);
        break;
      default:
        throw new Error(`No runner implemented for ruleKey: ${ruleKey}`);
    }

    // Update rule record
    rule.lastRunAt = new Date();
    rule.lastRunStatus = 'success';
    rule.lastRunSummary = result.summary || 'Execution completed successfully';
    rule.lastRunDetails = result;
    await rule.save();

    // Record ActivityEvent
    if (user?._id) {
      try {
        await ActivityEvent.create({
          actorId: user._id,
          action: 'automation.executed',
          entityType: 'automation_rule',
          entityId: rule.ruleKey,
          metadata: {
            ruleKey,
            summary: result.summary,
            affectedCount: result.affectedCount || 0,
          },
        });
      } catch (err) {
        logger.warn({ err: err.message }, 'Failed to record ActivityEvent for automation');
      }
    }

    return {
      ruleKey,
      status: 'success',
      ...result,
    };
  } catch (err) {
    logger.error({ err: err.message, ruleKey }, 'Automation rule execution failed');
    rule.lastRunAt = new Date();
    rule.lastRunStatus = 'failed';
    rule.lastRunSummary = `Error: ${err.message}`;
    rule.lastRunDetails = { error: err.message };
    await rule.save();

    throw err;
  }
}

// -------------------------------------------------------------
// Individual Automation Rule Handlers
// -------------------------------------------------------------

/**
 * 1. Month-End Report Rule
 */
async function runMonthEndReportRule(rule, user) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const report = await generateReport('monthly_scorecard', { month: currentMonth }, user, {
    sendEmail: rule.config?.sendEmail ?? true,
    recipients: rule.config?.recipients || ['creative_head@hacaforge.com'],
  });

  return {
    summary: `Generated Monthly Performance Scorecard for ${currentMonth}`,
    affectedCount: 1,
    reportKey: report.reportKey,
  };
}

/**
 * 2. Overdue Escalation Rule
 * Escalates to deliverable owner immediately; escalates to Team Lead if overdue > leadEscalationHours.
 */
async function runOverdueEscalationRule(rule, user) {
  const leadEscalationHours = rule.config?.leadEscalationHours || 4;
  const now = new Date();

  // Find all work items that are past deadline and not finished
  const overdueItems = await WorkItem.find({
    deadline: { $lt: now },
    status: { $nin: ['Approved', 'Published'] },
  })
    .populate('ownerId', 'name email role departmentId')
    .populate('departmentId', 'name code')
    .lean();

  let ownerNotified = 0;
  let leadEscalated = 0;

  for (const item of overdueItems) {
    const hoursOverdue = Math.max(1, Math.round((now - new Date(item.deadline)) / (1000 * 60 * 60)));
    const owner = item.ownerId;

    if (owner?._id) {
      // Idempotency check: don't notify same owner for same deliverable within past 12 hours
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
      const existingOwnerNotification = await Notification.findOne({
        recipient: owner._id,
        'metadata.workItemId': item._id,
        'metadata.type': 'overdue_owner',
        createdAt: { $gte: twelveHoursAgo },
      });

      if (!existingOwnerNotification) {
        // Dispatch in-app notification
        await Notification.create({
          recipient: owner._id,
          title: `Deliverable Overdue: ${item.title}`,
          message: `Your deliverable "${item.title}" was due ${new Date(item.deadline).toLocaleDateString()} and is overdue by ${hoursOverdue} hours.`,
          type: 'warning',
          link: `/work/${item._id}`,
          metadata: {
            workItemId: item._id,
            type: 'overdue_owner',
            hoursOverdue,
          },
        });

        // Dispatch email
        if (owner.email) {
          await enqueueEmail({
            to: owner.email,
            subject: `[Action Required] Deliverable Overdue: ${item.title}`,
            text: `Hello ${owner.name},\n\nYour deliverable "${item.title}" is currently overdue by ${hoursOverdue} hours (deadline was ${new Date(item.deadline).toLocaleDateString()}). Please update its status in HACA Marketing OS.\n\nLink: http://localhost:5173/work/${item._id}`,
          });
        }
        ownerNotified++;
      }
    }

    // Team Lead Escalation if overdue > leadEscalationHours
    if (hoursOverdue >= leadEscalationHours && item.departmentId?._id) {
      // Find Team Lead for this department or Marketing Head
      const teamLead = await Person.findOne({
        departmentId: item.departmentId._id,
        role: { $in: ['sm_manager', 'creative_head'] },
        status: { $ne: 'suspended' },
      }).lean();

      if (teamLead?._id && String(teamLead._id) !== String(owner?._id)) {
        // Idempotency check: don't escalate same item to same lead within 24 hours
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const existingLeadEscalation = await Notification.findOne({
          recipient: teamLead._id,
          'metadata.workItemId': item._id,
          'metadata.type': 'overdue_lead_escalation',
          createdAt: { $gte: twentyFourHoursAgo },
        });

        if (!existingLeadEscalation) {
          await Notification.create({
            recipient: teamLead._id,
            title: `[Escalation] Deliverable Overdue > ${leadEscalationHours}h: ${item.title}`,
            message: `Deliverable "${item.title}" assigned to ${owner?.name || 'team member'} is overdue by ${hoursOverdue} hours. Immediate supervisory review required.`,
            type: 'alert',
            link: `/work/${item._id}`,
            metadata: {
              workItemId: item._id,
              type: 'overdue_lead_escalation',
              hoursOverdue,
            },
          });

          if (teamLead.email) {
            await enqueueEmail({
              to: teamLead.email,
              subject: `[Escalation Alert] Deliverable Overdue > ${leadEscalationHours}h: ${item.title}`,
              text: `Hello ${teamLead.name},\n\nDeliverable "${item.title}" assigned to ${owner?.name || 'team member'} is past due by ${hoursOverdue} hours without resolution. Please check in on this deliverable.\n\nLink: http://localhost:5173/work/${item._id}`,
            });
          }
          leadEscalated++;
        }
      }
    }
  }

  return {
    summary: `Audited ${overdueItems.length} overdue deliverables: notified ${ownerNotified} owners, escalated ${leadEscalated} to Team Leads.`,
    affectedCount: overdueItems.length,
    ownerNotified,
    leadEscalated,
  };
}

/**
 * 3. Stale Task & Todo Escalation Rule
 */
async function runTodoEscalationRule(rule, user) {
  const daysInactive = rule.config?.daysInactive || 3;
  const cutoffDate = new Date(Date.now() - daysInactive * 24 * 60 * 60 * 1000);

  const staleItems = await WorkItem.find({
    status: { $in: ['Not Started', 'In Progress', 'Pending'] },
    updatedAt: { $lt: cutoffDate },
  })
    .populate('ownerId', 'name email')
    .lean();

  let notifiedCount = 0;

  for (const item of staleItems) {
    const owner = item.ownerId;
    if (owner?._id) {
      // Idempotency check: don't notify within past 24 hours
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const existing = await Notification.findOne({
        recipient: owner._id,
        'metadata.workItemId': item._id,
        'metadata.type': 'stale_todo',
        createdAt: { $gte: yesterday },
      });

      if (!existing) {
        await Notification.create({
          recipient: owner._id,
          title: `Stale Deliverable Check: ${item.title}`,
          message: `Deliverable "${item.title}" has had no activity for over ${daysInactive} days. Please update your progress or report blockers.`,
          type: 'info',
          link: `/work/${item._id}`,
          metadata: {
            workItemId: item._id,
            type: 'stale_todo',
          },
        });
        notifiedCount++;
      }
    }
  }

  return {
    summary: `Found ${staleItems.length} stagnant deliverables (> ${daysInactive}d inactive); dispatched ${notifiedCount} reminders.`,
    affectedCount: staleItems.length,
    notifiedCount,
  };
}

/**
 * 4. Blocker Dependency Alert Rule
 */
async function runBlockerDependencyAlertRule(rule, user) {
  const reminderIntervalHours = rule.config?.reminderIntervalHours || 24;
  const cutoffDate = new Date(Date.now() - reminderIntervalHours * 60 * 60 * 1000);

  const activeBlockers = await Blocker.find({
    status: 'Active',
    dependencyOwnerId: { $exists: true, $ne: null },
    createdAt: { $lt: cutoffDate },
  })
    .populate('dependencyOwnerId', 'name email')
    .populate('workItemId', 'title')
    .lean();

  let remindedCount = 0;

  for (const blocker of activeBlockers) {
    const depOwner = blocker.dependencyOwnerId;
    if (depOwner?._id) {
      // Idempotency: don't re-ping within reminderIntervalHours
      const recentPing = await Notification.findOne({
        recipient: depOwner._id,
        'metadata.blockerId': blocker._id,
        createdAt: { $gte: cutoffDate },
      });

      if (!recentPing) {
        await Notification.create({
          recipient: depOwner._id,
          title: `Action Needed: Unresolved Dependency Blocker`,
          message: `Deliverable "${blocker.workItemId?.title || 'Deliverable'}" is blocked waiting for your input (${blocker.reason}). Please review and resolve.`,
          type: 'warning',
          link: `/issues`,
          metadata: {
            blockerId: blocker._id,
            type: 'blocker_dependency_reminder',
          },
        });

        if (depOwner.email) {
          await enqueueEmail({
            to: depOwner.email,
            subject: `[Reminder] Deliverable Blocked Waiting on You (${blocker.reason})`,
            text: `Hello ${depOwner.name},\n\nDeliverable "${blocker.workItemId?.title || 'Deliverable'}" is still blocked awaiting your input.\nReason: ${blocker.reason}\nNotes: ${blocker.notes || 'None'}\n\nPlease review and unblock at: http://localhost:5173/issues`,
          });
        }
        remindedCount++;
      }
    }
  }

  return {
    summary: `Evaluated ${activeBlockers.length} active blockers; dispatched ${remindedCount} dependency SLA reminders.`,
    affectedCount: activeBlockers.length,
    remindedCount,
  };
}

/**
 * 5. Revision Pattern Flag Rule
 */
async function runRevisionPatternFlagRule(rule, user) {
  const threshold = rule.config?.thresholdRound || 4;

  // Find feedback entries with round >= threshold
  const highRoundEntries = await FeedbackEntry.find({ round: { $gte: threshold } }).lean();
  const workItemIds = [...new Set(highRoundEntries.map((e) => String(e.workItemId)))];

  let flagsCreated = 0;

  for (const workItemId of workItemIds) {
    // Check if revision flag already exists
    const existing = await RevisionFlag.findOne({ workItemId });
    if (!existing) {
      const highestRound = Math.max(
        ...highRoundEntries.filter((e) => String(e.workItemId) === workItemId).map((e) => e.round)
      );

      await RevisionFlag.create({
        workItemId,
        isFlagged: true,
        roundCount: highestRound,
        revisionsCount: highestRound,
        rootCauseStatus: 'Unclassified',
        notifiedLead: true,
        flaggedAt: new Date(),
      });
      flagsCreated++;
    }
  }

  // Audit and escalate unclassified revision flags older than 48 hours
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const unclassifiedFlags = await RevisionFlag.find({
    isFlagged: true,
    $or: [{ rootCause: null }, { rootCause: '' }, { rootCauseStatus: 'Unclassified' }],
    isEscalated: { $ne: true },
    flaggedAt: { $lt: fortyEightHoursAgo },
  }).populate('workItemId', 'title');

  let escalatedCount = 0;
  const leaders = await Person.find({
    role: { $in: ['creative_head', 'admin'] },
    status: { $ne: 'suspended' },
  }).lean();

  for (const flag of unclassifiedFlags) {
    flag.isEscalated = true;
    await flag.save();

    for (const leader of leaders) {
      await Notification.create({
        recipient: leader._id,
        title: `[Escalation] Unclassified Revision Flag > 48h`,
        message: `Revision flag on "${flag.workItemId?.title || 'Deliverable'}" has remained unclassified for >48h. Supervisory root-cause classification required.`,
        type: 'alert',
        link: `/feedback`,
        metadata: {
          flagId: flag._id,
          type: 'unclassified_flag_escalation',
        },
      });
    }
    escalatedCount++;
  }

  return {
    summary: `Scanned revisions: flagged ${flagsCreated} deliverables exceeding round ${threshold}, escalated ${escalatedCount} unclassified flags (>48h).`,
    affectedCount: workItemIds.length + unclassifiedFlags.length,
    flagsCreated,
    escalatedCount,
  };
}

/**
 * 6. Weekly Report Rule
 */
async function runWeeklyReportRule(rule, user) {
  const report = await generateReport('weekly_marketing', {}, user, {
    sendEmail: rule.config?.sendEmail ?? true,
    recipients: rule.config?.recipients || ['creative_head@hacaforge.com'],
  });

  return {
    summary: `Generated Weekly Marketing Report successfully.`,
    affectedCount: 1,
    reportKey: report.reportKey,
  };
}
