import { Lead } from './model.js';
import { fetchLsqLeadsFromSource } from './lsqAdapter.js';
import { WorkItem } from '../workItems/model.js';
import { Campaign } from '../campaigns/model.js';
import { Person } from '../people/model.js';
import { Department } from '../departments/model.js';
import { MonthlyTarget } from '../targets/model.js';
import { ActivityEvent } from '../activity/model.js';
import { resolveScope } from '../../lib/scope.js';
import { logger } from '../../lib/logger.js';
import {
  FUNNEL_STAGES,
  LEAD_SOURCES,
  PAID_AD_LEAD_SOURCES,
} from '@mmp/shared';

/**
 * 1. Synchronize Leads from LeadSquared (LSQ)
 * Idempotently ingests leads, flags discrepancies, and executes auto-task creation for WhatsApp Inbound.
 */
export async function syncLsqLeads(options = {}, user = null) {
  const rawLeads = await fetchLsqLeadsFromSource(options);

  let syncedCount = 0;
  let discrepancyCount = 0;
  let tasksCreated = 0;

  for (const raw of rawLeads) {
    const existing = await Lead.findOne({ lsqLeadId: raw.lsqLeadId });
    const isNew = !existing;

    // Hygiene checks
    let syncStatus = raw.syncStatus || 'synced';
    let discrepancyReason = raw.discrepancyReason || null;

    if (!raw.profileId) {
      syncStatus = 'discrepancy';
      discrepancyReason = 'Missing Brand Profile';
    } else if (!LEAD_SOURCES.includes(raw.leadSource)) {
      syncStatus = 'discrepancy';
      discrepancyReason = 'Unmapped Lead Source';
    } else if (!FUNNEL_STAGES.includes(raw.stage)) {
      syncStatus = 'discrepancy';
      discrepancyReason = 'Invalid Funnel Stage';
    }

    const leadDoc = await Lead.findOneAndUpdate(
      { lsqLeadId: raw.lsqLeadId },
      {
        $set: {
          profileId: raw.profileId,
          leadSource: raw.leadSource,
          stage: raw.stage,
          score: raw.score || 0,
          contactName: raw.contactName,
          contactEmail: raw.contactEmail,
          contactPhone: raw.contactPhone,
          ownerName: raw.ownerName,
          ownerEmail: raw.ownerEmail,
          syncStatus,
          discrepancyReason,
          rawData: raw.rawData || {},
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (syncStatus === 'synced') {
      syncedCount++;
    } else {
      discrepancyCount++;
    }

    // Auto-Task Creation Rule:
    // Only WhatsApp Inbound source automatically creates a task for the WhatsApp Marketer.
    if (isNew && leadDoc.leadSource === 'WhatsApp Inbound' && leadDoc.profileId) {
      const taskCreated = await createWhatsAppInboundTask(leadDoc, user);
      if (taskCreated) tasksCreated++;
    }
  }

  // Record audit activity
  if (user?._id) {
    try {
      await ActivityEvent.create({
        actorId: user._id,
        action: 'lsq.sync_completed',
        entityType: 'lsq_sync',
        entityId: `sync-${Date.now()}`,
        metadata: {
          syncedCount,
          discrepancyCount,
          tasksCreated,
        },
      });
    } catch (err) {
      logger.warn({ err: err.message }, 'Failed to record ActivityEvent for LSQ sync');
    }
  }

  return {
    success: true,
    totalIngested: rawLeads.length,
    syncedCount,
    discrepancyCount,
    tasksCreated,
  };
}

/**
 * Auto-creates WorkItem when an inbound WhatsApp lead arrives.
 */
async function createWhatsAppInboundTask(lead, user) {
  try {
    // 1. Locate assignee: JobRole 'WhatsApp Marketer', or in department 'whatsapp'
    let assignee = await Person.findOne({
      jobRole: 'WhatsApp Marketer',
      status: { $ne: 'suspended' },
    });

    if (!assignee) {
      const waDept = await Department.findOne({ code: 'whatsapp' });
      if (waDept) {
        assignee = await Person.findOne({
          departmentId: waDept._id,
          status: { $ne: 'suspended' },
        });
      }
    }

    if (!assignee) {
      assignee = await Person.findOne({
        role: { $in: ['marketing_head', 'admin'] },
        status: { $ne: 'suspended' },
      });
    }

    if (!assignee) return null;

    // 2. Locate department
    const dept =
      assignee.departmentId || (await Department.findOne({ code: 'whatsapp' }))?._id;

    // 3. Find active campaign for profile
    let campaign = await Campaign.findOne({
      profileId: lead.profileId,
      status: 'In Progress',
    });

    if (!campaign) {
      campaign = await Campaign.findOne({ status: 'In Progress' });
    }

    if (!campaign) {
      // Create lightweight campaign anchor if none exists
      campaign = await Campaign.create({
        name: 'Inbound Lead Response Sprint',
        profileId: lead.profileId,
        departmentId: dept,
        ownerId: assignee._id,
        goalType: 'Leads',
        expectedOutcome: 'Lead Generation',
        relatedOKR: 'Respond to WhatsApp Inbound leads within 24h',
        status: 'In Progress',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 86400000),
      });
    }

    // 4. Create WorkItem
    const task = await WorkItem.create({
      title: `Follow-up WhatsApp Inbound Lead: ${lead.contactName || lead.lsqLeadId}`,
      workType: 'WhatsApp Blast',
      departmentId: dept,
      profileId: lead.profileId,
      campaignId: campaign._id,
      ownerId: assignee._id,
      status: 'Not Started',
      priority: 'High',
      deadline: new Date(Date.now() + 24 * 3600000), // 24-hour turnaround
      estimatedEffortHrs: 1.5,
      relatedOKR: 'WhatsApp Lead Inbound SLA < 24h',
      description: `Inbound WhatsApp lead automatically created from LeadSquared.\nContact: ${lead.contactName} (${lead.contactPhone || 'No phone'})\nLead ID: ${lead.lsqLeadId}`,
    });

    // 5. Activity Event
    await ActivityEvent.create({
      actorId: assignee._id,
      action: 'work_item.created',
      entityType: 'work_item',
      entityId: task._id.toString(),
      metadata: {
        trigger: 'lsq_whatsapp_inbound_auto_task',
        leadId: lead._id,
        lsqLeadId: lead.lsqLeadId,
      },
    });

    return task;
  } catch (err) {
    logger.error({ err: err.message, lsqLeadId: lead.lsqLeadId }, 'Failed to auto-create WhatsApp task');
    return null;
  }
}

/**
 * 2. Get Lead Funnel Analytics (Screen 12)
 * Computes 12-stage visual pipeline, conversion drops, CPL, CPQL, and 19-source mix.
 */
export async function getLeadFunnelMetrics(filters = {}, user = null) {
  const scope = await resolveScope(user, filters);
  if (!scope.isAllowed) {
    throw new Error('User does not have access to view leads within the requested scope');
  }

  // Build query
  const query = {};
  if (scope.allowedProfileIds.length > 0) {
    query.profileId = { $in: scope.allowedProfileIds };
  }
  if (filters.profileId && filters.profileId !== 'all') {
    query.profileId = filters.profileId;
  }

  const leads = await Lead.find(query).populate('profileId', 'name code').lean();
  const totalLeads = leads.length;

  // 12-Stage Funnel breakdown
  const stageCounts = {};
  FUNNEL_STAGES.forEach((stage) => {
    stageCounts[stage] = 0;
  });

  leads.forEach((l) => {
    if (stageCounts[l.stage] !== undefined) {
      stageCounts[l.stage] += 1;
    } else {
      stageCounts['Total Leads'] += 1;
    }
  });

  const funnelStages = FUNNEL_STAGES.map((stage) => {
    const count = stageCounts[stage];
    const conversionPct = totalLeads ? Math.round((count / totalLeads) * 100) : 0;
    return {
      stage,
      count,
      conversionPct,
    };
  });

  // Qualified Leads definition: 'Qualified Leads' stage or completed stages
  const qualifiedLeads = leads.filter((l) =>
    ['Qualified Leads', 'Call Back', 'Payment Received'].includes(l.stage)
  ).length;

  // Paid Ad Leads
  const adLeads = leads.filter((l) => PAID_AD_LEAD_SOURCES.includes(l.leadSource)).length;

  // Ad Spend calculation from active MonthlyTarget in scope
  const currentMonth = filters.month || new Date().toISOString().slice(0, 7);
  const targetQuery = { month: currentMonth };
  if (query.profileId) targetQuery.profileId = query.profileId;

  const targets = await MonthlyTarget.find(targetQuery).lean();
  const targetSpend = targets.reduce((sum, t) => sum + (t.budget || 0), 0);
  const targetQualified = targets.reduce((sum, t) => sum + (t.qualifiedLeadsTarget || 0), 0);

  // CPL & CPQL Formulas:
  // CPL = Spend / Ad Leads
  // CPQL = Spend / Qualified Leads
  // Qualified % = Qualified Leads / Total Leads * 100
  const cpl = adLeads > 0 ? (targetSpend / adLeads).toFixed(2) : '0.00';
  const cpql = qualifiedLeads > 0 ? (targetSpend / qualifiedLeads).toFixed(2) : '0.00';
  const qualifiedPct = totalLeads > 0 ? Math.round((qualifiedLeads / totalLeads) * 100) : 0;

  // Source Mix Breakdown across 19 Lead Sources
  const sourceMap = {};
  LEAD_SOURCES.forEach((src) => {
    sourceMap[src] = { count: 0, qualified: 0 };
  });

  leads.forEach((l) => {
    if (sourceMap[l.leadSource]) {
      sourceMap[l.leadSource].count += 1;
      if (['Qualified Leads', 'Call Back', 'Payment Received'].includes(l.stage)) {
        sourceMap[l.leadSource].qualified += 1;
      }
    }
  });

  const sourceMix = Object.entries(sourceMap).map(([src, stats]) => ({
    source: src,
    count: stats.count,
    sharePct: totalLeads ? Math.round((stats.count / totalLeads) * 100) : 0,
    qualifiedCount: stats.qualified,
    qualificationRate: stats.count ? Math.round((stats.qualified / stats.count) * 100) : 0,
  }));

  return {
    month: currentMonth,
    summary: {
      totalLeads,
      qualifiedLeads,
      targetQualifiedLeads: targetQualified,
      targetSpend,
      adLeads,
      cpl: `$${cpl}`,
      cpql: `$${cpql}`,
      qualifiedPercentage: `${qualifiedPct}%`,
    },
    funnelStages,
    sourceMix,
  };
}

/**
 * 3. Get Data Center & LSQ Sync Health (Screen 13)
 * Calculates health score, lists discrepancies, and summarizes orphan leads.
 */
export async function getDataCenterStatus(filters = {}, user = null) {
  const allLeads = await Lead.find()
    .populate('profileId', 'name code')
    .sort({ createdAt: -1 })
    .lean();

  const total = allLeads.length;
  const synced = allLeads.filter((l) => l.syncStatus === 'synced').length;
  const discrepancies = allLeads.filter((l) => l.syncStatus === 'discrepancy');
  const unassigned = allLeads.filter((l) => !l.profileId).length;

  // Integration Health Score: % of total leads synced cleanly (e.g. 98.4%)
  const healthScore = total > 0 ? Math.round((synced / total) * 1000) / 10 : 100.0;

  // Discrepancy groupings
  const missingProfilesCount = discrepancies.filter((d) => d.discrepancyReason === 'Missing Brand Profile').length;
  const unmappedSourcesCount = discrepancies.filter((d) => d.discrepancyReason === 'Unmapped Lead Source').length;

  return {
    healthScore,
    totalIngested: total,
    syncedCount: synced,
    discrepancyCount: discrepancies.length,
    unassignedCount: unassigned,
    metrics: {
      missingProfilesCount,
      unmappedSourcesCount,
    },
    discrepancies: discrepancies.slice(0, 50).map((d) => ({
      _id: d._id,
      lsqLeadId: d.lsqLeadId,
      contactName: d.contactName,
      contactEmail: d.contactEmail,
      contactPhone: d.contactPhone,
      leadSource: d.leadSource,
      stage: d.stage,
      profileName: d.profileId?.name || 'Unassigned',
      profileId: d.profileId?._id || null,
      discrepancyReason: d.discrepancyReason,
      syncStatus: d.syncStatus,
      createdAt: d.createdAt,
    })),
  };
}

/**
 * 4. Resolve Data Center Discrepancy (Screen 13)
 * Head / Admin maps a missing profile or unmapped lead source to resolve discrepancy.
 */
export async function resolveDiscrepancy(leadId, resolutionData = {}, user = null) {
  const lead = await Lead.findById(leadId);
  if (!lead) {
    throw new Error('Lead not found in Data Center');
  }

  if (resolutionData.profileId) {
    lead.profileId = resolutionData.profileId;
  }
  if (resolutionData.leadSource) {
    lead.leadSource = resolutionData.leadSource;
  }

  // Re-verify hygiene
  if (lead.profileId && LEAD_SOURCES.includes(lead.leadSource)) {
    lead.syncStatus = 'synced';
    lead.discrepancyReason = null;
    lead.resolvedAt = new Date();
    lead.resolvedById = user?._id || null;
  }

  await lead.save();

  if (user?._id) {
    try {
      await ActivityEvent.create({
        actorId: user._id,
        action: 'datacenter.discrepancy_resolved',
        entityType: 'lead',
        entityId: lead._id.toString(),
        metadata: {
          lsqLeadId: lead.lsqLeadId,
          resolvedProfileId: resolutionData.profileId,
          resolvedLeadSource: resolutionData.leadSource,
        },
      });
    } catch (err) {
      logger.warn({ err: err.message }, 'Failed to record ActivityEvent for discrepancy resolution');
    }
  }

  return lead;
}
