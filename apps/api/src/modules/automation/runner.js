import { AutomationRule } from './model.js';
import { WorkItem } from '../workItems/model.js';
import { Person } from '../people/model.js';
import { Blocker } from '../blockers/model.js';
import { FeedbackEntry, RevisionFlag } from '../feedback/model.js';
import { Notification } from '../notifications/model.js';
import { ActivityEvent } from '../activity/model.js';
import { enqueueEmail } from '../../lib/queue.js';
import { isRetiredJob, runRetiredJob } from '../jobs/retired.js';
import { logger } from '../../lib/logger.js';

// Default reminder rules (Phase 7: the two report-email rules were retired)
export const DEFAULT_AUTOMATION_RULES = [
  {
    ruleKey: 'overdue_escalation',
    name: 'Overdue Task Escalation',
    description: 'Continuously audits tasks past their deadline. Pings owner immediately; escalates to SM Manager after 4 hours overdue.',
    trigger: 'scheduled',
    schedule: 'Hourly check',
    cronExpression: '0 * * * *',
    action: 'Dispatch owner reminder and SM Manager escalation for overdue work items',
    active: true,
    config: { leadEscalationHours: 4 },
  },
  {
    ruleKey: 'todo_escalation',
    name: 'Stale Task & Todo Escalation',
    description: 'Flags open tasks in progress that have experienced no status change for 3 or more consecutive days, prompting status updates.',
    trigger: 'scheduled',
    schedule: 'Daily at 09:00 AM',
    cronExpression: '0 9 * * *',
    action: 'Notify owner of stagnant task in progress',
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
];

/**
 * Ensures the default reminder rules exist in the database.
 */
export async function ensureAutomationRules() {
  // Inserts missing default rules only. Never deletes or edits a rule record (Phase 7):
  // the retired report rules' records stay in the database untouched.
  // timestamps: false, so an existing record's updatedAt is not touched either.
  for (const rule of DEFAULT_AUTOMATION_RULES) {
    const now = new Date();
    await AutomationRule.updateOne(
      { ruleKey: rule.ruleKey },
      { $setOnInsert: { ...rule, createdAt: now, updatedAt: now } },
      { upsert: true, timestamps: false }
    );
  }
}

/**
 * Executes an automation rule by ruleKey.
 * Guaranteed idempotency: prevents spamming duplicate notifications within deduplication window.
 */
export async function executeAutomationRule(ruleKey, user = null, options = {}) {
  // Retired report rules (Phase 7): log and do nothing; their records are not touched.
  if (isRetiredJob(ruleKey)) return runRetiredJob(ruleKey);
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
 * 2. Overdue Escalation Rule
 * Escalates to task owner immediately; escalates to SM Manager if overdue > leadEscalationHours.
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
          title: `Task Overdue: ${item.title}`,
          message: `Your task "${item.title}" was due ${new Date(item.deadline).toLocaleDateString()} and is overdue by ${hoursOverdue} hours.`,
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
            subject: `[Action Required] Task Overdue: ${item.title}`,
            text: `Hello ${owner.name},\n\nYour task "${item.title}" is currently overdue by ${hoursOverdue} hours (deadline was ${new Date(item.deadline).toLocaleDateString()}). Please update its status in HACA Marketing OS.\n\nLink: http://localhost:5173/work/${item._id}`,
          });
        }
        ownerNotified++;
      }
    }

    // SM Manager Escalation if overdue > leadEscalationHours
    if (hoursOverdue >= leadEscalationHours && item.departmentId?._id) {
      // Find SM Manager or Creative Head (check department first, then organization-wide SM Manager)
      let smManager = await Person.findOne({
        departmentId: item.departmentId._id,
        role: { $in: ['sm_manager', 'creative_head'] },
        status: { $ne: 'suspended' },
      }).lean();

      if (!smManager) {
        smManager = await Person.findOne({
          role: 'sm_manager',
          status: { $ne: 'suspended' },
        }).lean();
      }

      if (smManager?._id && String(smManager._id) !== String(owner?._id)) {
        // Idempotency check: don't escalate same item to same manager within 24 hours
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const existingLeadEscalation = await Notification.findOne({
          recipient: smManager._id,
          'metadata.workItemId': item._id,
          'metadata.type': 'overdue_lead_escalation',
          createdAt: { $gte: twentyFourHoursAgo },
        });

        if (!existingLeadEscalation) {
          await Notification.create({
            recipient: smManager._id,
            title: `[Escalation] Task Overdue > ${leadEscalationHours}h: ${item.title}`,
            message: `Task "${item.title}" assigned to ${owner?.name || 'team member'} is overdue by ${hoursOverdue} hours. Immediate supervisory review required.`,
            type: 'alert',
            link: `/work/${item._id}`,
            metadata: {
              workItemId: item._id,
              type: 'overdue_lead_escalation',
              hoursOverdue,
            },
          });

          if (smManager.email) {
            await enqueueEmail({
              to: smManager.email,
              subject: `[Escalation Alert] Task Overdue > ${leadEscalationHours}h: ${item.title}`,
              text: `Hello ${smManager.name},\n\nTask "${item.title}" assigned to ${owner?.name || 'team member'} is past due by ${hoursOverdue} hours without resolution. Please check in on this task.\n\nLink: http://localhost:5173/work/${item._id}`,
            });
          }
          leadEscalated++;
        }
      }
    }
  }

  return {
    summary: `Audited ${overdueItems.length} overdue tasks: notified ${ownerNotified} owners, escalated ${leadEscalated} to SM Managers.`,
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

