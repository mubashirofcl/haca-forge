import mongoose from 'mongoose';
import { MonthlyTarget } from './model.js';
import { Campaign } from '../campaigns/model.js';
import { resolveScope } from '../../lib/scope.js';
import { logActivity } from '../activity/service.js';

export async function listMonthlyTargets(filter = {}, user) {
  const scope = await resolveScope(user);
  const query = {};

  if (filter.month) {
    query.month = filter.month;
  }

  if (filter.profileId) {
    if (filter.profileId === 'org-wide' || filter.profileId === 'null') {
      query.profileId = null;
    } else {
      query.profileId = filter.profileId;
    }
  }

  // Scoping: If user is not admin or marketing_head and has profile restrictions
  if (!scope.canAccessAllProfiles) {
    query.$or = [
      { profileId: { $in: scope.allowedProfileIds } },
      { profileId: null }, // Org-wide targets visible to all with target.view
    ];
  }

  const targets = await MonthlyTarget.find(query)
    .populate('profileId', 'name code active')
    .populate('createdBy', 'name email role')
    .sort({ month: -1, createdAt: -1 })
    .lean();

  // Aggregate campaign actuals for each target
  const targetIds = targets.map((t) => t._id);
  const campaignStats = await Campaign.aggregate([
    { $match: { targetId: { $in: targetIds } } },
    {
      $group: {
        _id: '$targetId',
        spendActual: { $sum: '$spend' },
        leadsActual: { $sum: '$leadsActual' },
        qualifiedLeadsActual: { $sum: '$qualifiedLeadsActual' },
        budgetAllocated: { $sum: '$budget' },
        campaignsCount: { $sum: 1 },
      },
    },
  ]);

  const statsMap = new Map(campaignStats.map((s) => [s._id.toString(), s]));

  return targets.map((t) => {
    const stats = statsMap.get(t._id.toString()) || {
      spendActual: 0,
      leadsActual: 0,
      qualifiedLeadsActual: 0,
      budgetAllocated: 0,
      campaignsCount: 0,
    };
    return {
      ...t,
      spendActual: stats.spendActual,
      leadsActual: stats.leadsActual,
      qualifiedLeadsActual: stats.qualifiedLeadsActual,
      budgetAllocated: stats.budgetAllocated,
      campaignsCount: stats.campaignsCount,
    };
  });
}

export async function getMonthlyTargetById(id, user) {
  const target = await MonthlyTarget.findById(id)
    .populate('profileId', 'name code active')
    .populate('createdBy', 'name email role')
    .lean();

  if (!target) {
    const error = new Error('Monthly target not found');
    error.statusCode = 404;
    throw error;
  }

  const scope = await resolveScope(user);
  if (
    !scope.canAccessAllProfiles &&
    target.profileId &&
    !scope.allowedProfileIds.includes(target.profileId._id.toString())
  ) {
    const error = new Error('You do not have permission to view targets for this profile');
    error.statusCode = 403;
    throw error;
  }

  // Fetch linked campaigns
  const campaigns = await Campaign.find({ targetId: id })
    .populate('ownerId', 'name email role jobRole')
    .sort({ createdAt: -1 })
    .lean();

  const spendActual = campaigns.reduce((acc, c) => acc + (c.spend || 0), 0);
  const leadsActual = campaigns.reduce((acc, c) => acc + (c.leadsActual || 0), 0);
  const qualifiedLeadsActual = campaigns.reduce((acc, c) => acc + (c.qualifiedLeadsActual || 0), 0);
  const budgetAllocated = campaigns.reduce((acc, c) => acc + (c.budget || 0), 0);

  return {
    ...target,
    spendActual,
    leadsActual,
    qualifiedLeadsActual,
    budgetAllocated,
    campaignsCount: campaigns.length,
    campaigns,
  };
}

export async function setMonthlyTarget(data, user) {
  const profileId = data.profileId || null;

  const target = await MonthlyTarget.findOneAndUpdate(
    { month: data.month, profileId },
    {
      $set: {
        month: data.month,
        profileId,
        revenueTarget: data.revenueTarget ?? 0,
        leadsTarget: data.leadsTarget ?? 0,
        qualifiedLeadsTarget: data.qualifiedLeadsTarget ?? 0,
        budget: data.budget ?? 0,
        createdBy: user._id || user.userId,
      },
    },
    { upsert: true, new: true, runValidators: true }
  ).populate('profileId', 'name code');

  await logActivity({
    entityType: 'monthly_target',
    entityId: target._id,
    profileId: target.profileId?._id || target.profileId,
    actor: user,
    action: 'target.set',
    metadata: {
      month: data.month,
      revenueTarget: data.revenueTarget,
      leadsTarget: data.leadsTarget,
      budget: data.budget,
    },
  });

  return target;
}

export async function updateMonthlyTarget(id, data, user) {
  const target = await MonthlyTarget.findById(id);
  if (!target) {
    const error = new Error('Monthly target not found');
    error.statusCode = 404;
    throw error;
  }

  if (data.revenueTarget !== undefined) target.revenueTarget = data.revenueTarget;
  if (data.leadsTarget !== undefined) target.leadsTarget = data.leadsTarget;
  if (data.qualifiedLeadsTarget !== undefined) target.qualifiedLeadsTarget = data.qualifiedLeadsTarget;
  if (data.budget !== undefined) target.budget = data.budget;

  await target.save();

  await logActivity({
    entityType: 'monthly_target',
    entityId: target._id,
    profileId: target.profileId,
    actor: user,
    action: 'target.updated',
    metadata: data,
  });

  return target;
}

export async function deleteMonthlyTarget(id, user) {
  const target = await MonthlyTarget.findById(id);
  if (!target) {
    const error = new Error('Monthly target not found');
    error.statusCode = 404;
    throw error;
  }

  // Enforce traceability: cannot delete target if campaigns are linked
  const linkedCampaignsCount = await Campaign.countDocuments({ targetId: id });
  if (linkedCampaignsCount > 0) {
    const error = new Error(
      `Cannot delete target: ${linkedCampaignsCount} campaign(s) are linked to this monthly target.`
    );
    error.statusCode = 400;
    throw error;
  }

  await MonthlyTarget.findByIdAndDelete(id);

  await logActivity({
    entityType: 'monthly_target',
    entityId: id,
    profileId: target.profileId,
    actor: user,
    action: 'target.deleted',
    metadata: { month: target.month },
  });

  return { success: true, message: 'Monthly target deleted' };
}
