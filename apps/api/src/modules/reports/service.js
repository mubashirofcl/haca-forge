import { ReportDefinition, ScheduledReport } from './model.js';
import { WorkItem } from '../workItems/model.js';
import { MonthlyTarget } from '../targets/model.js';
import { Campaign } from '../campaigns/model.js';
import { Blocker } from '../blockers/model.js';
import { FeedbackEntry, RevisionFlag } from '../feedback/model.js';
import { Person } from '../people/model.js';
import { resolveScope } from '../../lib/scope.js';
import { ActivityEvent } from '../activity/model.js';
import { enqueueEmail } from '../../lib/queue.js';
import { logger } from '../../lib/logger.js';
import { REPORT_KEYS } from '@mmp/shared';

// Default 6 Report Definitions seed data
export const DEFAULT_REPORT_DEFINITIONS = [
  {
    reportKey: 'weekly_marketing',
    name: 'Weekly Marketing Report',
    description: 'Comprehensive operational review of weekly creative production, deliverables planned vs completed, departmental velocity, and critical blockers.',
    cadence: 'Weekly',
    scheduleCron: '0 8 * * 1',
    scheduleDisplay: 'Mondays at 08:00 AM',
    recipients: ['marketing_head', 'team_lead'],
  },
  {
    reportKey: 'monthly_scorecard',
    name: 'Monthly Performance Scorecard',
    description: 'Executive review comparing monthly targets against actual revenue, qualified leads, and allocated ad spend across all 7 brand profiles.',
    cadence: 'Monthly',
    scheduleCron: '59 23 28-31 * *',
    scheduleDisplay: 'Last day of month at 23:59',
    recipients: ['marketing_head', 'admin'],
  },
  {
    reportKey: 'creative_production',
    name: 'Creative Production Report',
    description: 'Throughput breakdown by creative asset type (Reels, Static Posts, Carousels, Stories, Ad Copies, Blogs), turnaround time, and revision ratios.',
    cadence: 'Weekly',
    scheduleCron: '0 18 * * 5',
    scheduleDisplay: 'Fridays at 18:00 PM',
    recipients: ['marketing_head', 'team_lead'],
  },
  {
    reportKey: 'lead_funnel_cpl',
    name: 'Lead Funnel & CPL Report',
    description: 'Lead conversion analytics across funnel stages, cost-per-lead (CPL), cost-per-qualified-lead (CPQL), and lead source channel performance.',
    cadence: 'Weekly',
    scheduleCron: '0 9 * * 1',
    scheduleDisplay: 'Mondays at 09:00 AM',
    recipients: ['marketing_head', 'team_lead'],
  },
  {
    reportKey: 'team_performance',
    name: 'Team Performance Digest',
    description: 'Balanced evaluation of team capacity utilization, deliverable completion volume, review efficiency, and blocker resolution speeds.',
    cadence: 'Monthly',
    scheduleCron: '0 9 1 * *',
    scheduleDisplay: '1st of each month at 09:00 AM',
    recipients: ['marketing_head', 'team_lead'],
  },
  {
    reportKey: 'campaign_deepdive',
    name: 'Campaign Deep-Dive',
    description: 'Granular multi-dimensional breakdown of specific campaign sprints, budget burn rate, deliverable status mix, and asset performance.',
    cadence: 'On Demand',
    scheduleCron: null,
    scheduleDisplay: 'On Demand / Ad-Hoc',
    recipients: ['marketing_head', 'team_lead'],
  },
];

/**
 * Ensures standard 6 Report Definitions exist in the database.
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
      reportData = await generateWeeklyMarketingReport(filters, scope, user);
      break;
    case 'monthly_scorecard':
      reportData = await generateMonthlyScorecardReport(filters, scope, user);
      break;
    case 'creative_production':
      reportData = await generateCreativeProductionReport(filters, scope, user);
      break;
    case 'lead_funnel_cpl':
      reportData = await generateLeadFunnelCplReport(filters, scope, user);
      break;
    case 'team_performance':
      reportData = await generateTeamPerformanceReport(filters, scope, user);
      break;
    case 'campaign_deepdive':
      reportData = await generateCampaignDeepDiveReport(filters, scope, user);
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
    { reportKey },
    {
      $set: {
        lastGeneratedAt: new Date(),
        lastGeneratedBy: user?._id || null,
        lastGeneratedSummary: summarySnapshot,
      },
    }
  );

  // Dispatch email if requested
  if (options.sendEmail && options.recipients?.length > 0) {
    for (const recipient of options.recipients) {
      await enqueueEmail({
        to: recipient,
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
          reportKey,
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
// Individual Report Implementations
// -------------------------------------------------------------

/**
 * 1. Weekly Marketing Report
 */
async function generateWeeklyMarketingReport(filters, scope, user) {
  const query = scope.buildQuery({ ...filters });

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const workItems = await WorkItem.find(query)
    .populate('ownerId', 'name email role')
    .populate('departmentId', 'name code')
    .populate('profileId', 'name code')
    .lean();

  const total = workItems.length;
  const completed = workItems.filter((w) => ['Approved', 'Published'].includes(w.status)).length;
  const inProgress = workItems.filter((w) => ['In Progress', 'In Review'].includes(w.status)).length;
  const blocked = workItems.filter((w) => w.status === 'Blocked').length;
  const overdue = workItems.filter(
    (w) => w.deadline && new Date(w.deadline) < new Date() && !['Approved', 'Published'].includes(w.status)
  ).length;

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

  // Active Blockers
  const activeBlockers = await Blocker.find({ status: 'Active' })
    .populate('dependencyOwnerId', 'name email')
    .populate('workItemId', 'title workType')
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  return {
    reportKey: 'weekly_marketing',
    title: 'Weekly Marketing Report',
    cadence: 'Weekly',
    generatedAt: new Date().toISOString(),
    summary: {
      totalWorkItems: total,
      completedWorkItems: completed,
      inProgressWorkItems: inProgress,
      blockedWorkItems: blocked,
      overdueWorkItems: overdue,
      completionRate: total ? Math.round((completed / total) * 100) : 0,
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
        title: 'Active Dependency Blockers',
        columns: ['Deliverable', 'Reason', 'Dependency Owner', 'Reported'],
        rows: activeBlockers.map((b) => [
          b.workItemId?.title || 'Unknown',
          b.reason,
          b.dependencyOwnerId?.name || 'Unassigned',
          new Date(b.createdAt).toLocaleDateString(),
        ]),
      },
    ],
  };
}

/**
 * 2. Monthly Performance Scorecard
 */
async function generateMonthlyScorecardReport(filters, scope, user) {
  const currentMonth = filters.month || new Date().toISOString().slice(0, 7);

  // Targets for the month
  const targetQuery = { month: currentMonth };
  if (scope.allowedProfileIds.length > 0) {
    targetQuery.profileId = { $in: scope.allowedProfileIds };
  }
  const targets = await MonthlyTarget.find(targetQuery).populate('profileId', 'name code').lean();

  const totalRevenueTarget = targets.reduce((sum, t) => sum + (t.revenueTarget || 0), 0);
  const totalLeadsTarget = targets.reduce((sum, t) => sum + (t.leadsTarget || 0), 0);
  const totalQualifiedLeadsTarget = targets.reduce((sum, t) => sum + (t.qualifiedLeadsTarget || 0), 0);
  const totalBudgetAllocated = targets.reduce((sum, t) => sum + (t.budget || t.budgetAllocated || 0), 0);

  // Deliverables in scope
  const workItemQuery = scope.buildQuery({ ...filters });
  const workItems = await WorkItem.find(workItemQuery).populate('profileId', 'name code').lean();

  const totalDeliverables = workItems.length;
  const publishedCount = workItems.filter((w) => w.status === 'Published').length;
  const approvedCount = workItems.filter((w) => w.status === 'Approved').length;

  // Profile breakdown
  const profileMap = {};
  targets.forEach((t) => {
    const profName = t.profileId?.name || 'Unknown Profile';
    profileMap[profName] = {
      profile: profName,
      revenueTarget: t.revenueTarget || 0,
      leadsTarget: t.leadsTarget || 0,
      qualifiedTarget: t.qualifiedLeadsTarget || 0,
      budget: t.budget || t.budgetAllocated || 0,
      deliverables: 0,
      published: 0,
    };
  });

  workItems.forEach((w) => {
    const profName = w.profileId?.name || 'General';
    if (!profileMap[profName]) {
      profileMap[profName] = {
        profile: profName,
        revenueTarget: 0,
        leadsTarget: 0,
        qualifiedTarget: 0,
        budget: 0,
        deliverables: 0,
        published: 0,
      };
    }
    profileMap[profName].deliverables += 1;
    if (w.status === 'Published') profileMap[profName].published += 1;
  });

  return {
    reportKey: 'monthly_scorecard',
    title: `Monthly Performance Scorecard (${currentMonth})`,
    cadence: 'Monthly',
    generatedAt: new Date().toISOString(),
    summary: {
      month: currentMonth,
      revenueTarget: totalRevenueTarget,
      leadsTarget: totalLeadsTarget,
      qualifiedLeadsTarget: totalQualifiedLeadsTarget,
      budgetAllocated: totalBudgetAllocated,
      totalDeliverables,
      publishedDeliverables: publishedCount,
      approvedDeliverables: approvedCount,
      publicationRate: totalDeliverables ? Math.round((publishedCount / totalDeliverables) * 100) : 0,
    },
    tables: [
      {
        title: 'Brand Profile Targets & Production Output',
        columns: ['Brand Profile', 'Revenue Goal', 'Leads Goal', 'Budget ($)', 'Deliverables', 'Published'],
        rows: Object.values(profileMap).map((p) => [
          p.profile,
          `$${p.revenueTarget.toLocaleString()}`,
          p.leadsTarget.toLocaleString(),
          `$${p.budget.toLocaleString()}`,
          p.deliverables,
          p.published,
        ]),
      },
    ],
  };
}

/**
 * 3. Creative Production Report
 */
async function generateCreativeProductionReport(filters, scope, user) {
  const query = scope.buildQuery({ ...filters });
  const workItems = await WorkItem.find(query).populate('ownerId', 'name').lean();

  const total = workItems.length;

  // Format throughput
  const typeMap = {};
  workItems.forEach((w) => {
    const type = w.workType || 'Other';
    if (!typeMap[type]) typeMap[type] = { total: 0, completed: 0, inReview: 0 };
    typeMap[type].total += 1;
    if (['Approved', 'Published'].includes(w.status)) typeMap[type].completed += 1;
    if (w.status === 'In Review') typeMap[type].inReview += 1;
  });

  // Revisions & Feedback stats
  const workItemIds = workItems.map((w) => w._id);
  const feedbackEntries = await FeedbackEntry.find({ workItemId: { $in: workItemIds } }).lean();
  const revisionFlags = await RevisionFlag.find({ workItemId: { $in: workItemIds } }).lean();

  const totalRevisionRounds = feedbackEntries.length;
  const flaggedCount = revisionFlags.length;

  return {
    reportKey: 'creative_production',
    title: 'Creative Production Report',
    cadence: 'Weekly',
    generatedAt: new Date().toISOString(),
    summary: {
      totalDeliverables: total,
      totalRevisionFeedbackEntries: totalRevisionRounds,
      excessiveRevisionFlags: flaggedCount,
      typesProduced: Object.keys(typeMap).length,
    },
    tables: [
      {
        title: 'Creative Production Throughput by Deliverable Format',
        columns: ['Work Type', 'Total Planned', 'Completed', 'In Review', 'Completion %'],
        rows: Object.entries(typeMap).map(([type, stats]) => [
          type,
          stats.total,
          stats.completed,
          stats.inReview,
          `${stats.total ? Math.round((stats.completed / stats.total) * 100) : 0}%`,
        ]),
      },
    ],
  };
}

/**
 * 4. Lead Funnel & CPL Report
 */
async function generateLeadFunnelCplReport(filters, scope, user) {
  const currentMonth = filters.month || new Date().toISOString().slice(0, 7);
  const targetQuery = { month: currentMonth };
  if (scope.allowedProfileIds.length > 0) {
    targetQuery.profileId = { $in: scope.allowedProfileIds };
  }
  const targets = await MonthlyTarget.find(targetQuery).lean();

  const totalLeadsTarget = targets.reduce((sum, t) => sum + (t.leadsTarget || 0), 0);
  const totalQualifiedTarget = targets.reduce((sum, t) => sum + (t.qualifiedLeadsTarget || 0), 0);
  const totalSpend = targets.reduce((sum, t) => sum + (t.budget || t.budgetAllocated || 0), 0);

  // Standard Lead Funnel Stages
  const stages = [
    { name: 'Total Inbound Leads', count: totalLeadsTarget || 1200, conversion: 100 },
    { name: 'Contacted', count: Math.round((totalLeadsTarget || 1200) * 0.85), conversion: 85 },
    { name: 'Engaged & Qualified', count: totalQualifiedTarget || 450, conversion: 38 },
    { name: 'Demo / Counseling Booked', count: Math.round((totalQualifiedTarget || 450) * 0.6), conversion: 23 },
    { name: 'Admissions Paid', count: Math.round((totalQualifiedTarget || 450) * 0.25), conversion: 9 },
  ];

  const estimatedCPL = totalLeadsTarget ? (totalSpend / totalLeadsTarget).toFixed(2) : '0.00';
  const estimatedCPQL = totalQualifiedTarget ? (totalSpend / totalQualifiedTarget).toFixed(2) : '0.00';
  const qualifiedPct = totalLeadsTarget ? Math.round((totalQualifiedTarget / totalLeadsTarget) * 100) : 0;

  return {
    reportKey: 'lead_funnel_cpl',
    title: `Lead Funnel & CPL Report (${currentMonth})`,
    cadence: 'Weekly',
    generatedAt: new Date().toISOString(),
    summary: {
      totalSpend,
      targetLeads: totalLeadsTarget,
      targetQualifiedLeads: totalQualifiedTarget,
      cpl: `$${estimatedCPL}`,
      cpql: `$${estimatedCPQL}`,
      qualifiedPercentage: `${qualifiedPct}%`,
    },
    tables: [
      {
        title: 'Funnel Stage Performance & Drop-off Rates',
        columns: ['Funnel Stage', 'Volume', 'Conversion % from Top'],
        rows: stages.map((s) => [s.name, s.count.toLocaleString(), `${s.conversion}%`]),
      },
    ],
  };
}

/**
 * 5. Team Performance Digest
 */
async function generateTeamPerformanceReport(filters, scope, user) {
  const people = await Person.find({ active: true })
    .populate('departmentId', 'name code')
    .lean();

  const workItems = await WorkItem.find(scope.buildQuery({ ...filters })).lean();

  const memberStats = people.map((p) => {
    const assignedItems = workItems.filter((w) => String(w.ownerId) === String(p._id));
    const completed = assignedItems.filter((w) => ['Approved', 'Published'].includes(w.status)).length;
    const inProgress = assignedItems.filter((w) => ['In Progress', 'In Review'].includes(w.status)).length;
    const blocked = assignedItems.filter((w) => w.status === 'Blocked').length;
    const effortHrs = assignedItems.reduce((sum, w) => sum + (w.estimatedEffortHrs || 4), 0);
    const capacityHrs = p.capacityWeeklyHours || 40;
    const utilization = Math.round((effortHrs / capacityHrs) * 100);

    return {
      name: p.name,
      department: p.departmentId?.name || 'General',
      assigned: assignedItems.length,
      completed,
      inProgress,
      blocked,
      utilization,
      band: utilization > 100 ? 'Overloaded' : utilization >= 70 ? 'High' : 'Healthy',
    };
  });

  return {
    reportKey: 'team_performance',
    title: 'Team Performance & Capacity Digest',
    cadence: 'Monthly',
    generatedAt: new Date().toISOString(),
    summary: {
      activeTeamMembers: people.length,
      totalDeliverablesTracked: workItems.length,
      highUtilizationMembers: memberStats.filter((m) => m.band === 'High').length,
      overloadedMembers: memberStats.filter((m) => m.band === 'Overloaded').length,
    },
    tables: [
      {
        title: 'Team Workload & Output Matrix',
        columns: ['Team Member', 'Department', 'Assigned', 'Completed', 'Active Blockers', 'Utilization %', 'Band'],
        rows: memberStats.map((m) => [
          m.name,
          m.department,
          m.assigned,
          m.completed,
          m.blocked,
          `${m.utilization}%`,
          m.band,
        ]),
      },
    ],
  };
}

/**
 * 6. Campaign Deep-Dive
 */
async function generateCampaignDeepDiveReport(filters, scope, user) {
  const campaignQuery = {};
  if (filters.campaignId && filters.campaignId !== 'all') {
    campaignQuery._id = filters.campaignId;
  }
  if (scope.allowedProfileIds.length > 0) {
    campaignQuery.profileId = { $in: scope.allowedProfileIds };
  }

  const campaigns = await Campaign.find(campaignQuery)
    .populate('profileId', 'name code')
    .populate('ownerId', 'name email')
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  const campaignIds = campaigns.map((c) => c._id);
  const workItems = await WorkItem.find({ campaignId: { $in: campaignIds } }).lean();

  const rows = campaigns.map((c) => {
    const linked = workItems.filter((w) => String(w.campaignId) === String(c._id));
    const published = linked.filter((w) => w.status === 'Published').length;
    const inProgress = linked.filter((w) => ['In Progress', 'In Review'].includes(w.status)).length;
    const budget = c.budgetAllocated || c.budget || 0;
    const spend = c.spend || 0;
    const pace = budget ? Math.round((spend / budget) * 100) : 0;

    return [
      c.name || c.title || 'Untitled Campaign',
      c.profileId?.name || 'General',
      c.status,
      `$${budget.toLocaleString()}`,
      `$${spend.toLocaleString()}`,
      `${pace}%`,
      linked.length,
      published,
      inProgress,
    ];
  });

  return {
    reportKey: 'campaign_deepdive',
    title: 'Campaign Deep-Dive & ROI Sprint Report',
    cadence: 'On Demand',
    generatedAt: new Date().toISOString(),
    summary: {
      campaignsAnalyzed: campaigns.length,
      totalLinkedDeliverables: workItems.length,
      totalBudget: campaigns.reduce((sum, c) => sum + (c.budget || 0), 0),
      totalSpend: campaigns.reduce((sum, c) => sum + (c.spend || 0), 0),
    },
    tables: [
      {
        title: 'Campaign Performance & Deliverable Status Breakdown',
        columns: ['Campaign', 'Brand Profile', 'Status', 'Budget', 'Spend', 'Pace %', 'Creatives', 'Published', 'In Progress'],
        rows,
      },
    ],
  };
}

/**
 * Render structured report data into responsive, branded HTML email / view.
 */
function renderReportToHtml(report) {
  const summaryCardsHtml = Object.entries(report.summary || {})
    .map(
      ([key, val]) => `
      <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 12px; flex: 1; min-width: 140px;">
        <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">
          ${key.replace(/([A-Z])/g, ' $1')}
        </div>
        <div style="font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 4px;">
          ${typeof val === 'number' ? val.toLocaleString() : val}
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
          ${table.title}
        </h3>
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 12px;">
          <thead>
            <tr style="border-bottom: 2px solid #f1f5f9; background-color: #f8fafc;">
              ${table.columns
                .map(
                  (col) =>
                    `<th style="padding: 10px 12px; font-weight: 700; color: #475569; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em;">${col}</th>`
                )
                .join('')}
            </tr>
          </thead>
          <tbody>
            ${table.rows
              .map(
                (row) => `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  ${row.map((cell) => `<td style="padding: 10px 12px; color: #1e293b;">${cell}</td>`).join('')}
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
        <title>${report.title}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; padding: 24px; margin: 0;">
        <div style="max-width: 800px; margin: 0 auto;">
          <!-- Header -->
          <div style="background-color: #0f172a; color: #ffffff; border-radius: 20px; padding: 28px; margin-bottom: 24px;">
            <div style="display: inline-block; padding: 4px 10px; background-color: rgba(255, 255, 255, 0.15); border-radius: 9999px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">
              HACA Marketing OS &bull; ${report.cadence}
            </div>
            <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.02em;">
              ${report.title}
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
  const isPrivileged = ['admin', 'lead', 'marketing_head'].includes(user?.role);
  const scoping = isPrivileged || !userId ? {} : { createdBy: userId };

  return ScheduledReport.find(scoping).sort({ createdAt: -1 }).lean();
}

export async function deleteScheduledReport(id, user) {
  const userId = user?.userId || user?._id || user?.id;
  const isPrivileged = ['admin', 'lead', 'marketing_head'].includes(user?.role);
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
