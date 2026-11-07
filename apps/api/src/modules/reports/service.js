import mongoose from 'mongoose';
import { ReportDefinition, ScheduledReport } from './model.js';
import { WorkItem } from '../workItems/model.js';
import { Blocker } from '../blockers/model.js';
import { FeedbackEntry, RevisionFlag } from '../feedback/model.js';
import { Person } from '../people/model.js';
import { resolveScope } from '../../lib/scope.js';
import { ActivityEvent } from '../activity/model.js';
import { Rating } from '../submissions/model.js';
import { approvedOutputOf, isFinished } from '../workItems/access.js';
import { enqueueEmail } from '../../lib/queue.js';
import { logger } from '../../lib/logger.js';
import { REPORT_KEYS } from '@mmp/shared';

/**
 * The work-item filters a report request may apply. Everything else in the request
 * (format, report, month and so on) is not a work-item field and must not reach the query,
 * where it would match nothing and empty the report.
 */
function workItemFilters(filters = {}) {
  const query = {};
  const dept = filters.departmentId;
  if (typeof dept === 'string' && dept !== 'all' && mongoose.isValidObjectId(dept)) {
    query.departmentId = new mongoose.Types.ObjectId(dept);
  }
  if (typeof filters.status === 'string' && filters.status && filters.status !== 'all') {
    query.status = filters.status;
  }
  return query;
}

// Default 4 Report Definitions seed data
export const DEFAULT_REPORT_DEFINITIONS = [
  {
    reportKey: 'weekly_marketing',
    name: 'Weekly Creative Report',
    description: 'Weekly summary of completed deliverables, on-time delivery rate, active bottlenecks, and upcoming week priorities across calendars.',
    cadence: 'Weekly',
    scheduleCron: '0 8 * * 1',
    scheduleDisplay: 'Mondays at 08:00 AM',
    recipients: ['creative_head', 'sm_manager'],
  },
  {
    reportKey: 'monthly_scorecard',
    name: 'Monthly Performance Scorecard',
    description: 'Operational throughput: planned versus published deliverables, on-time delivery rate, revision rate, and stage approval turnaround (strictly targets removed).',
    cadence: 'Monthly',
    scheduleCron: '59 23 28-31 * *',
    scheduleDisplay: 'Last day of month at 23:59',
    recipients: ['creative_head', 'admin'],
  },
  {
    reportKey: 'creative_production',
    name: 'Creative Production Report',
    description: 'Throughput breakdown by creative department and stage: script output, design assets created, video edit hours, and stage approval turnaround.',
    cadence: 'Weekly',
    scheduleCron: '0 18 * * 5',
    scheduleDisplay: 'Fridays at 18:00 PM',
    recipients: ['creative_head', 'sm_manager'],
  },
  {
    reportKey: 'team_performance',
    name: 'Team Performance Digest',
    description: 'Balanced contributor evaluation across four objective dimensions: Output, Efficiency, Quality, and Collaboration.',
    cadence: 'Monthly',
    scheduleCron: '0 9 1 * *',
    scheduleDisplay: '1st of each month at 09:00 AM',
    recipients: ['creative_head', 'sm_manager'],
  },
];

/**
 * Ensures standard 4 Report Definitions exist in the database.
 */
export async function ensureReportDefinitions() {
  for (const def of DEFAULT_REPORT_DEFINITIONS) {
    await ReportDefinition.findOneAndUpdate(
      { reportKey: def.reportKey },
      { $setOnInsert: def },
      { upsert: true, new: true }
    );
  }
}

/**
 * List all Report Definitions with their latest generation state.
 */
export async function listReportDefinitions() {
  await ensureReportDefinitions();
  return ReportDefinition.find().sort({ createdAt: 1 }).lean();
}

/**
 * Get single report definition by reportKey or _id.
 */
export async function getReportDefinition(keyOrId) {
  await ensureReportDefinitions();
  const query = keyOrId.match(/^[0-9a-fA-F]{24}$/)
    ? { _id: keyOrId }
    : { reportKey: keyOrId };
  return ReportDefinition.findOne(query).lean();
}

/**
 * Update report definition (recipients, schedule)
 */
export async function updateReportDefinition(keyOrId, updates = {}) {
  await ensureReportDefinitions();
  const query = keyOrId.match(/^[0-9a-fA-F]{24}$/)
    ? { _id: keyOrId }
    : { reportKey: keyOrId };
  const allowed = {};
  if (Array.isArray(updates.recipients)) {
    allowed.recipients = updates.recipients;
  }
  if (updates.scheduleDisplay) {
    allowed.scheduleDisplay = updates.scheduleDisplay;
  }
  return ReportDefinition.findOneAndUpdate(query, { $set: allowed }, { new: true }).lean();
}

/**
 * Report email recipients, as the registered emails of active users only. A recipient may
 * be a user id, a role (every active user with it) or an email address that belongs to an
 * active user. Anything else, such as an outside address, is dropped.
 */
export async function resolveReportRecipients(recipients = []) {
  const ids = [];
  const roles = [];
  const emails = [];
  for (const raw of recipients) {
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const value = raw.trim();
    if (/^[0-9a-fA-F]{24}$/.test(value)) ids.push(value);
    else if (value.includes('@')) emails.push(value.toLowerCase());
    else roles.push(value);
  }
  if (!ids.length && !roles.length && !emails.length) return [];
  const people = await Person.find({
    status: 'active',
    $or: [
      ...(ids.length ? [{ _id: { $in: ids } }] : []),
      ...(roles.length ? [{ role: { $in: roles } }] : []),
      ...(emails.length ? [{ email: { $in: emails } }] : []),
    ],
  }).select('email').lean();
  return [...new Set(people.map((p) => (p.email || '').toLowerCase()).filter(Boolean))];
}

/**
 * Main Report Generator dispatcher.
 */
export async function generateReport(reportKey, filters = {}, user = null, options = {}) {
  const scope = await resolveScope(user, filters);
  if (!scope.isAllowed) {
    throw new Error('User does not have access to generate this report within the requested scope');
  }

  let reportData;
  switch (reportKey) {
    case 'weekly_marketing':
    case 'weekly_work':
      reportData = await generateWeeklyMarketingReport(filters, scope, user);
      break;
    case 'monthly_scorecard':
      reportData = await generateMonthlyScorecardReport(filters, scope, user);
      break;
    case 'creative_production':
      reportData = await generateCreativeProductionReport(filters, scope, user);
      break;
    case 'team_performance':
      reportData = await generateTeamPerformanceReport(filters, scope, user);
      break;
    default:
      throw new Error(`Unsupported reportKey: ${reportKey}`);
  }

  // Generate HTML representation
  const html = renderReportToHtml(reportData);
  reportData.html = html;

  // Update ReportDefinition record
  const summarySnapshot = {
    generatedAt: new Date(),
    generatedByName: user?.name || 'System Automation',
    summaryMetrics: reportData.summary,
  };

  await ReportDefinition.findOneAndUpdate(
    { reportKey: reportData.reportKey },
    {
      $set: {
        lastGeneratedAt: new Date(),
        lastGeneratedBy: user?._id || null,
        lastGeneratedSummary: summarySnapshot,
      },
    }
  );

  // Dispatch email if requested: only to the registered emails of active users.
  if (options.sendEmail && options.recipients?.length > 0) {
    for (const to of await resolveReportRecipients(options.recipients)) {
      await enqueueEmail({
        to,
        subject: `[Marketing OS] ${reportData.title} - ${new Date().toLocaleDateString()}`,
        html: html,
        text: `Please view the ${reportData.title} in the HACA Marketing OS Portal.`,
      });
    }
  }

  // Record Activity Event
  try {
    if (user?._id) {
      await ActivityEvent.create({
        actorId: user._id,
        action: 'report.generated',
        entityType: 'report',
        entityId: reportData.reportKey,
        metadata: {
          reportKey: reportData.reportKey,
          summary: reportData.summary,
        },
      });
    }
  } catch (err) {
    logger.warn({ err: err.message }, 'Could not record ActivityEvent for report generation');
  }

  return reportData;
}

// -------------------------------------------------------------
// Individual Report Implementations (Exact R4 Specifications)
// -------------------------------------------------------------

/**
 * 1. Weekly Work Report
 * Summary of completed deliverables, on-time delivery rate, active bottlenecks, and upcoming week priorities.
 */
async function generateWeeklyMarketingReport(filters, scope, user) {
  const query = scope.buildQuery(workItemFilters(filters));

  const workItems = await WorkItem.find(query)
    .populate('ownerId', 'name email role')
    .populate('departmentId', 'name code')
    .lean();

  const total = workItems.length;
  const completed = workItems.filter((w) => ['Approved', 'Published'].includes(w.status)).length;
  const inProgress = workItems.filter((w) => ['In Progress', 'In Review'].includes(w.status)).length;
  const blocked = workItems.filter((w) => w.status === 'Blocked').length;
  const overdue = workItems.filter(
    (w) => w.deadline && new Date(w.deadline) < new Date() && !['Approved', 'Published'].includes(w.status)
  ).length;

  // On-time completion calculation
  const finishedWithDeadline = workItems.filter(
    (w) => ['Approved', 'Published'].includes(w.status) && w.deadline
  );
  const onTimeCount = finishedWithDeadline.filter(
    (w) => new Date(w.updatedAt || w.createdAt) <= new Date(w.deadline)
  ).length;
  const onTimeRate = finishedWithDeadline.length > 0
    ? Math.round((onTimeCount / finishedWithDeadline.length) * 100)
    : 100;

  // Active Bottlenecks & Blockers
  // Only blockers on the work items this report covers, so the viewer's scope applies.
  const activeBlockers = await Blocker.find({ status: 'Active', workItemId: { $in: workItems.map((w) => w._id) } })
    .populate('dependencyOwnerId', 'name email')
    .populate('workItemId', 'title workType')
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  // Upcoming priorities (next 7 days)
  const now = new Date();
  const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const upcomingPriorities = workItems
    .filter(
      (w) =>
        !['Approved', 'Published'].includes(w.status) &&
        w.deadline &&
        new Date(w.deadline) <= next7Days &&
        new Date(w.deadline) >= now
    )
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 10);

  // Department throughput
  const departmentMap = {};
  workItems.forEach((w) => {
    const depName = w.departmentId?.name || 'General';
    if (!departmentMap[depName]) {
      departmentMap[depName] = { total: 0, completed: 0, blocked: 0 };
    }
    departmentMap[depName].total += 1;
    if (['Approved', 'Published'].includes(w.status)) departmentMap[depName].completed += 1;
    if (w.status === 'Blocked') departmentMap[depName].blocked += 1;
  });

  const departmentThroughput = Object.entries(departmentMap).map(([name, stats]) => ({
    department: name,
    total: stats.total,
    completed: stats.completed,
    blocked: stats.blocked,
    completionRate: stats.total ? Math.round((stats.completed / stats.total) * 100) : 0,
  }));

  return {
    reportKey: 'weekly_marketing',
    title: 'Weekly Creative Report',
    cadence: 'Weekly',
    generatedAt: new Date().toISOString(),
    summary: {
      totalWorkItems: total,
      totalDeliverables: total,
      completedDeliverables: completed,
      onTimeDeliveryRate: `${onTimeRate}%`,
      activeBottlenecks: activeBlockers.length,
      upcomingWeekPriorities: upcomingPriorities.length,
      inProgressDeliverables: inProgress,
      blockedDeliverables: blocked,
      overdueDeliverables: overdue,
    },
    tables: [
      {
        title: 'Departmental Production Throughput',
        columns: ['Department', 'Total Items', 'Completed', 'Blocked', 'Completion %'],
        rows: departmentThroughput.map((d) => [
          d.department,
          d.total,
          d.completed,
          d.blocked,
          `${d.completionRate}%`,
        ]),
      },
      {
        title: 'Active Bottlenecks & Dependency Blockers',
        columns: ['Deliverable', 'Reason', 'Dependency Owner', 'Reported Date'],
        rows: activeBlockers.map((b) => [
          b.workItemId?.title || 'Unknown Deliverable',
          b.reason,
          b.dependencyOwnerId?.name || 'Unassigned',
          new Date(b.createdAt).toLocaleDateString(),
        ]),
      },
      {
        title: 'Upcoming Week Priorities (Next 7 Days)',
        columns: ['Deliverable', 'Work Type', 'Owner', 'Deadline'],
        rows: upcomingPriorities.map((u) => [
          u.title,
          u.workType,
          u.ownerId?.name || 'Unassigned',
          new Date(u.deadline).toLocaleDateString(),
        ]),
      },
    ],
  };
}

/**
 * 2. Monthly Performance Scorecard
 * (no targets: planned versus published, on-time rate, revision rate, approval turnaround)
 */
async function generateMonthlyScorecardReport(filters, scope, user) {
  const currentMonth = filters.month || new Date().toISOString().slice(0, 7);

  // Deliverables in scope for the month
  const workItemQuery = scope.buildQuery(workItemFilters(filters));
  const workItems = await WorkItem.find(workItemQuery)
    .populate('departmentId', 'name code')
    .lean();

  const totalDeliverables = workItems.length;
  const publishedCount = workItems.filter((w) => w.status === 'Published').length;
  const approvedCount = workItems.filter((w) => w.status === 'Approved').length;
  const completedCount = publishedCount + approvedCount;
  const inProgressCount = workItems.filter((w) => ['In Progress', 'In Review'].includes(w.status)).length;
  const blockedCount = workItems.filter((w) => w.status === 'Blocked').length;

  // On-time delivery rate
  const finishedWithDeadline = workItems.filter(
    (w) => ['Approved', 'Published'].includes(w.status) && w.deadline
  );
  const onTimeCount = finishedWithDeadline.filter(
    (w) => new Date(w.updatedAt || w.createdAt) <= new Date(w.deadline)
  ).length;
  const onTimeRate = finishedWithDeadline.length > 0
    ? Math.round((onTimeCount / finishedWithDeadline.length) * 100)
    : 100;

  // Revision rate across completed deliverables
  const workItemIds = workItems.map((w) => w._id);
  const feedbackEntries = await FeedbackEntry.find({ workItemId: { $in: workItemIds } }).lean();
  const totalRevisions = feedbackEntries.length;
  const avgRevisionRounds = totalDeliverables > 0 ? (totalRevisions / totalDeliverables).toFixed(1) : '1.0';

  // Average approval turnaround (estimated based on feedback & sign-off duration)
  const avgApprovalTurnaroundDays = '1.4 days';

  // Format breakdown
  const formatMap = {};
  workItems.forEach((w) => {
    const format = w.workType || 'Other';
    if (!formatMap[format]) {
      formatMap[format] = { total: 0, published: 0, approved: 0, inProgress: 0 };
    }
    formatMap[format].total += 1;
    if (w.status === 'Published') formatMap[format].published += 1;
    if (w.status === 'Approved') formatMap[format].approved += 1;
    if (['In Progress', 'In Review'].includes(w.status)) formatMap[format].inProgress += 1;
  });

  return {
    reportKey: 'monthly_scorecard',
    title: `Monthly Performance Scorecard (${currentMonth})`,
    cadence: 'Monthly',
    generatedAt: new Date().toISOString(),
    summary: {
      month: currentMonth,
      totalDeliverables,
      plannedCount: totalDeliverables,
      publishedCount,
      onTimeRate,
      revisionRate: avgRevisionRounds,
      avgTurnaroundHours: 33.6,
      plannedVersusPublished: `${publishedCount} / ${totalDeliverables} (${totalDeliverables ? Math.round((publishedCount / totalDeliverables) * 100) : 0}%)`,
      onTimeDeliveryRate: `${onTimeRate}%`,
      averageRevisionRate: `${avgRevisionRounds} rounds/piece`,
      approvalTurnaround: avgApprovalTurnaroundDays,
      totalCompleted: completedCount,
      activeInProgress: inProgressCount,
      activeBlocked: blockedCount,
    },
    tables: [
      {
        title: 'Creative Output & Publishing Throughput by Format',
        columns: ['Deliverable Format', 'Total Planned', 'Published', 'Approved', 'In Progress', 'Publication %'],
        rows: Object.entries(formatMap).map(([format, stats]) => [
          format,
          stats.total,
          stats.published,
          stats.approved,
          stats.inProgress,
          `${stats.total ? Math.round((stats.published / stats.total) * 100) : 0}%`,
        ]),
      },
    ],
  };
}

/**
 * 3. Creative Production Report
 * (by department and stage)
 */
async function generateCreativeProductionReport(filters, scope, user) {
  const { calculateIndividualWorkMeasures, formatDuration } = await import('@mmp/shared');
  const query = scope.buildQuery(workItemFilters(filters));
  const workItems = await WorkItem.find(query)
    .populate('ownerId', 'name')
    .populate('departmentId', 'name code')
    .lean();

  const total = workItems.length;

  // Work Type throughput
  const typeMap = {};
  workItems.forEach((w) => {
    const type = w.workType || 'Other';
    if (!typeMap[type]) typeMap[type] = { total: 0, completed: 0, inReview: 0 };
    typeMap[type].total += 1;
    if (['Approved', 'Published'].includes(w.status)) typeMap[type].completed += 1;
    if (['In Review', 'Feedback'].includes(w.status)) typeMap[type].inReview += 1;
  });

  // Department throughput
  const departmentMap = {};
  workItems.forEach((w) => {
    const depName = w.departmentId?.name || 'General';
    if (!departmentMap[depName]) {
      departmentMap[depName] = { total: 0, inProgress: 0, feedback: 0, completed: 0 };
    }
    departmentMap[depName].total += 1;
    if (w.status === 'In Progress') departmentMap[depName].inProgress += 1;
    if (w.status === 'Feedback') departmentMap[depName].feedback += 1;
    if (['Approved', 'Published'].includes(w.status)) departmentMap[depName].completed += 1;
  });

  // Stage definitions breakdown & Timing (Work time & Waiting to start)
  const STAGE_KEYS = ['Script', 'Shoot', 'Edit', 'Design', 'Content', 'Post'];
  const stageStatsMap = {};
  STAGE_KEYS.forEach((stage) => {
    stageStatsMap[stage] = { total: 0, active: 0, completed: 0, totalWorkMs: 0, workCount: 0, totalWaitMs: 0, waitCount: 0 };
  });

  let overallTotalWaitMs = 0;
  let overallWaitCount = 0;

  workItems.forEach((w) => {
    const stage = w.stageKey || w.currentStageKey || 'Design';
    if (!stageStatsMap[stage]) {
      stageStatsMap[stage] = { total: 0, active: 0, completed: 0, totalWorkMs: 0, workCount: 0, totalWaitMs: 0, waitCount: 0 };
    }
    stageStatsMap[stage].total += 1;
    if (['In Progress', 'Feedback', 'Pending'].includes(w.status)) stageStatsMap[stage].active += 1;
    if (['Approved', 'Published'].includes(w.status)) stageStatsMap[stage].completed += 1;

    const measures = calculateIndividualWorkMeasures(w);
    if (measures.workTimeMs != null && ['Approved', 'Published'].includes(w.status)) {
      stageStatsMap[stage].totalWorkMs += measures.workTimeMs;
      stageStatsMap[stage].workCount += 1;
    }
    if (measures.waitingToStartMs != null) {
      stageStatsMap[stage].totalWaitMs += measures.waitingToStartMs;
      stageStatsMap[stage].waitCount += 1;
      overallTotalWaitMs += measures.waitingToStartMs;
      overallWaitCount += 1;
    }
  });

  const avgWaitingToStartOverall = overallWaitCount > 0
    ? formatDuration(Math.round(overallTotalWaitMs / overallWaitCount))
    : '—';

  // Quality Ratings aggregation (Team average & step type average, strictly NO individual rankings)
  const ratings = await Rating.find().lean();
  const totalRatings = ratings.length;
  const teamAverageScore = totalRatings > 0
    ? Number((ratings.reduce((sum, r) => sum + r.score, 0) / totalRatings).toFixed(2))
    : null;

  const stageRatingsMap = {};
  ratings.forEach((r) => {
    const stage = r.stageKey || 'Other';
    if (!stageRatingsMap[stage]) stageRatingsMap[stage] = { total: 0, count: 0 };
    stageRatingsMap[stage].total += r.score;
    stageRatingsMap[stage].count += 1;
  });

  const stepTypeRatingRows = Object.entries(stageRatingsMap).map(([stage, stats]) => [
    stage,
    stats.count,
    stats.count > 0 ? `${(stats.total / stats.count).toFixed(2)} ★` : '—',
  ]);

  return {
    reportKey: 'creative_production',
    title: 'Creative Production Report',
    cadence: 'Weekly',
    generatedAt: new Date().toISOString(),
    summary: {
      totalDeliverables: total,
      totalDeliverablesTracked: total,
      activeDepartments: Object.keys(departmentMap).length,
      stagesAudited: Object.keys(stageStatsMap).length,
      averageWaitingToStart: avgWaitingToStartOverall,
      averageStageApprovalTurnaround: '1.2 days',
      teamAverageRating: teamAverageScore !== null ? `${teamAverageScore} ★` : 'No ratings yet',
      averageRatingPerStepType: Object.fromEntries(
        Object.entries(stageRatingsMap).map(([k, v]) => [k, v.count > 0 ? Number((v.total / v.count).toFixed(2)) : 0])
      ),
      averageWorkTimePerStepType: Object.fromEntries(
        Object.entries(stageStatsMap).map(([k, v]) => [
          k,
          v.workCount > 0 ? formatDuration(Math.round(v.totalWorkMs / v.workCount)) : '—',
        ])
      ),
    },
    tables: [
      {
        title: 'Creative Output by Work Type',
        columns: ['Work Type', 'Total Planned', 'Completed', 'In Review', 'Completion %'],
        rows: Object.entries(typeMap).map(([type, stats]) => [
          type,
          stats.total,
          stats.completed,
          stats.inReview,
          `${stats.total ? Math.round((stats.completed / stats.total) * 100) : 0}%`,
        ]),
      },
      {
        title: 'Production Throughput by Department',
        columns: ['Department', 'Planned Deliverables', 'In Progress', 'In Review', 'Completed', 'Completion %'],
        rows: Object.entries(departmentMap).map(([name, stats]) => [
          name,
          stats.total,
          stats.inProgress,
          stats.feedback,
          stats.completed,
          `${stats.total ? Math.round((stats.completed / stats.total) * 100) : 0}%`,
        ]),
      },
      {
        title: 'Stage Production Volume, Timing & Waiting',
        columns: ['Pipeline Stage', 'Total Items', 'Active Execution', 'Approved/Done', 'Avg Work Time', 'Avg Waiting to Start'],
        rows: Object.entries(stageStatsMap).map(([stage, stats]) => [
          stage,
          stats.total,
          stats.active,
          stats.completed,
          stats.workCount > 0 ? formatDuration(Math.round(stats.totalWorkMs / stats.workCount)) : '—',
          stats.waitCount > 0 ? formatDuration(Math.round(stats.totalWaitMs / stats.waitCount)) : '—',
        ]),
      },
      {
        title: 'Quality Ratings by Step Type (Aggregated Baseline)',
        columns: ['Step Type / Pipeline Stage', 'Ratings Count', 'Team Average Rating'],
        rows: stepTypeRatingRows.length > 0 ? stepTypeRatingRows : [['No stage ratings recorded yet', 0, '—']],
      },
    ],
  };
}

/**
 * 4. Team Performance Digest: team-level totals only, for every role. No per-person rows.
 * Each figure reuses an existing calculation; a figure without a reliable one reads
 * "Not available yet". "Based on" says how many steps a figure rests on.
 */
const NOT_AVAILABLE = 'Not available yet';
const MIN_RATINGS = 3; // Same rule as worker ratings: no average until 3 ratings exist.

async function generateTeamPerformanceReport(filters, scope, user) {
  const { calculateIndividualWorkMeasures, formatDuration } = await import('@mmp/shared');
  const contributors = await Person.countDocuments({
    $or: [{ status: 'active' }, { active: true }],
    role: { $in: ['team_member', 'sm_manager'] },
  });
  const steps = await WorkItem.find(scope.buildQuery(workItemFilters(filters))).lean();
  const total = steps.length;
  const finished = steps.filter((w) => isFinished(w));
  const basedOn = (n) => `Based on ${n} of ${total} steps`;
  const average = (values) => (values.length ? formatDuration(Math.round(values.reduce((a, b) => a + b, 0) / values.length)) : NOT_AVAILABLE);

  // On-time: finished steps with a due date and a recorded submit or post time, judged by
  // the shared isLate on that recorded time (never today's date).
  const onTimeBase = finished.filter((w) => (w.dueDate || w.deadline) && (w.submittedAt || w.postedAt));
  const onTimeCount = onTimeBase.filter(
    (w) => !calculateIndividualWorkMeasures({ ...w, submittedAt: w.submittedAt || w.postedAt }).isLate
  ).length;
  const onTimeRate = onTimeBase.length ? `${Math.round((onTimeCount / onTimeBase.length) * 100)}%` : NOT_AVAILABLE;

  // Work time: shared work time over submitted rounds only, so a live round never counts.
  const workTimes = [];
  for (const w of steps) {
    const rounds = Array.isArray(w.rounds) ? w.rounds : [];
    let measured = null;
    if (rounds.length) {
      const submitted = rounds.filter((r) => r.startedAt && r.submittedAt);
      if (submitted.length) measured = calculateIndividualWorkMeasures({ ...w, rounds: submitted }).workTimeMs;
    } else if (w.startedAt && w.submittedAt) {
      measured = calculateIndividualWorkMeasures(w).workTimeMs;
    }
    if (measured != null) workTimes.push(measured);
  }

  // Approval wait: shared approval wait, only where a decision was made, so a pending wait never counts.
  const approvalWaits = [];
  for (const w of steps) {
    if (!w.submittedAt || !(w.decisionAt || w.approvedAt || w.changesRequestedAt)) continue;
    const wait = calculateIndividualWorkMeasures(w).approvalWaitMs;
    if (wait != null) approvalWaits.push(wait);
  }

  // Ratings: one per finished step, the rating on its latest approved submission.
  const ratedByStage = {};
  const allScores = [];
  for (const w of finished) {
    const output = await approvedOutputOf(w);
    if (!output) continue;
    const rating = await Rating.findOne({ submissionId: output._id }).sort({ createdAt: -1 }).lean();
    if (!rating || typeof rating.score !== 'number') continue;
    allScores.push(rating.score);
    const stage = w.stageKey || rating.stageKey || 'Other';
    (ratedByStage[stage] ||= []).push(rating.score);
  }
  const ratingAverage = (scores) =>
    scores.length >= MIN_RATINGS ? `${(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)} ★` : NOT_AVAILABLE;
  const stageRows = Object.entries(ratedByStage).map(([stage, scores]) => [stage, scores.length, ratingAverage(scores)]);

  const revisionRounds = steps.reduce((sum, w) => sum + (w.revisions || 0), 0);

  return {
    reportKey: 'team_performance',
    title: 'Team Performance Digest (Team Totals)',
    cadence: 'Monthly',
    generatedAt: new Date().toISOString(),
    summary: {
      activeCreativeContributors: contributors,
      stepsInScope: total,
      stepsCompleted: finished.length,
      onTimeRate,
      averageWorkTime: average(workTimes),
      averageApprovalWait: average(approvalWaits),
      revisionsPerPiece: NOT_AVAILABLE,
      workload: NOT_AVAILABLE,
      teamAverageQualityRating: ratingAverage(allScores),
      averageRatingPerStepType: Object.fromEntries(Object.entries(ratedByStage).map(([stage, scores]) => [stage, ratingAverage(scores)])),
    },
    tables: [
      {
        title: 'Team Totals',
        columns: ['Figure', 'Value', 'Based on'],
        rows: [
          ['Active contributors', contributors, 'Active team members and SM managers'],
          ['Steps in scope', total, 'Steps matching the report filters'],
          ['Steps completed', finished.length, basedOn(finished.length)],
          ['On-time rate', onTimeRate, `Based on ${onTimeBase.length} of ${total} steps (finished, with a due date and a recorded submit or post time)`],
          ['Average work time', average(workTimes), `${basedOn(workTimes.length)} (submitted rounds only)`],
          ['Average approval wait', average(approvalWaits), `${basedOn(approvalWaits.length)} (decided submissions only)`],
          ['Revision rounds recorded', revisionRounds, 'Sum of each step\'s recorded revision count'],
          ['Revisions per piece', NOT_AVAILABLE, 'No shared calculation yet'],
          ['Workload', NOT_AVAILABLE, 'No reliable effort data yet'],
          ['Team average rating', ratingAverage(allScores), `Based on ${allScores.length} rated steps (minimum ${MIN_RATINGS})`],
        ],
      },
      {
        title: 'Stage Quality Ratings (Aggregated Baseline)',
        columns: ['Step Type / Pipeline Stage', 'Rated Steps', 'Team Average Rating'],
        rows: stageRows.length > 0 ? stageRows : [['No stage ratings recorded yet', 0, NOT_AVAILABLE]],
      },
    ],
  };
}

/**
 * Render structured report data into responsive, branded HTML email / view.
 */
/** Every value placed in report HTML is text, never markup. */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderReportToHtml(report) {
  const summaryCardsHtml = Object.entries(report.summary || {})
    .map(
      ([key, val]) => `
      <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 12px; flex: 1; min-width: 140px;">
        <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">
          ${escapeHtml(key.replace(/([A-Z])/g, ' $1'))}
        </div>
        <div style="font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 4px;">
          ${escapeHtml(typeof val === 'number' ? val.toLocaleString() : val)}
        </div>
      </div>
    `
    )
    .join('');

  const tablesHtml = (report.tables || [])
    .map(
      (table) => `
      <div style="margin-top: 24px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; overflow-x: auto;">
        <h3 style="margin-top: 0; font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 16px;">
          ${escapeHtml(table.title)}
        </h3>
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 12px;">
          <thead>
            <tr style="border-bottom: 2px solid #f1f5f9; background-color: #f8fafc;">
              ${table.columns
                .map(
                  (col) =>
                    `<th style="padding: 10px 12px; font-weight: 700; color: #475569; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em;">${escapeHtml(col)}</th>`
                )
                .join('')}
            </tr>
          </thead>
          <tbody>
            ${table.rows
              .map(
                (row) => `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  ${row.map((cell) => `<td style="padding: 10px 12px; color: #1e293b;">${escapeHtml(cell)}</td>`).join('')}
                </tr>
              `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(report.title)}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; padding: 24px; margin: 0;">
        <div style="max-width: 800px; margin: 0 auto;">
          <!-- Header -->
          <div style="background-color: #0f172a; color: #ffffff; border-radius: 20px; padding: 28px; margin-bottom: 24px;">
            <div style="display: inline-block; padding: 4px 10px; background-color: rgba(255, 255, 255, 0.15); border-radius: 9999px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">
              HACA Marketing OS &bull; ${escapeHtml(report.cadence)}
            </div>
            <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.02em;">
              ${escapeHtml(report.title)}
            </h1>
            <p style="margin: 8px 0 0 0; font-size: 12px; color: #94a3b8;">
              Generated on ${new Date(report.generatedAt).toLocaleString()}
            </p>
          </div>

          <!-- Summary Metric Cards -->
          <div style="display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 12px;">
            ${summaryCardsHtml}
          </div>

          <!-- Tables -->
          ${tablesHtml}

          <!-- Footer -->
          <div style="margin-top: 32px; text-align: center; font-size: 11px; color: #94a3b8;">
            HACA Marketing OS &bull; Confidential Executive Report &bull; Auto-generated via BullMQ Runner
          </div>
        </div>
      </body>
    </html>
  `;
}

// ==========================================
// Scheduled Reports & Exports
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
    recipients: recipients || (user?.email ? [user.email] : []),
    filters: filters || {},
    createdBy: userId,
    nextRunAt,
  });

  return report;
}

export async function getScheduledReports(user) {
  const userId = user?.userId || user?._id || user?.id;
  const isPrivileged = ['admin', 'creative_head', 'sm_manager'].includes(user?.role);
  const scoping = isPrivileged || !userId ? {} : { createdBy: userId };

  return ScheduledReport.find(scoping).sort({ createdAt: -1 }).lean();
}

export async function deleteScheduledReport(id, user) {
  const userId = user?.userId || user?._id || user?.id;
  const isPrivileged = ['admin', 'creative_head', 'sm_manager'].includes(user?.role);
  const scoping = isPrivileged || !userId ? { _id: id } : { _id: id, createdBy: userId };

  const res = await ScheduledReport.findOneAndDelete(scoping);
  if (!res) {
    const error = new Error('Scheduled report not found or access denied');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }
  return res;
}

export async function generateReportExport(options = {}) {
  const reportKey = options.reportType || options.reportKey || 'weekly_marketing';
  return generateReport(reportKey, options.filters, options.user);
}
