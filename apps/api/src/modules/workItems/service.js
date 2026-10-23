import mongoose from 'mongoose';
import { WorkItem } from './model.js';
import { Campaign } from '../campaigns/model.js';
import { resolveScope } from '../../lib/scope.js';
import { logActivity, listRecentActivities } from '../activity/service.js';
import { resolveProfileObjectId } from '../referenceData/service.js';
import { normalizeWorkType } from '@mmp/shared';

export async function createWorkItem(data, user) {
  // 1. Strict Campaign Linkage Verification
  if (!data.campaignId) {
    const error = new Error('Work item creation strictly requires a valid campaignId');
    error.statusCode = 400;
    error.code = 'CAMPAIGN_REQUIRED';
    throw error;
  }

  const campaign = await Campaign.findById(data.campaignId);
  if (!campaign) {
    const error = new Error(`Linked campaign with ID "${data.campaignId}" does not exist`);
    error.statusCode = 400;
    error.code = 'INVALID_CAMPAIGN';
    throw error;
  }

  // 2. Inherit strategic attributes from campaign if not explicitly passed
  let resolvedProfileId = null;
  if (data.profileId) {
    resolvedProfileId = await resolveProfileObjectId(data.profileId);
  }
  if (!resolvedProfileId && campaign.profileId) {
    resolvedProfileId = campaign.profileId;
  }
  const relatedOKR = data.relatedOKR || campaign.relatedOKR;
  const relatedTarget = data.relatedTarget || campaign.targetId;

  // 3. Profile Scoping Check
  const scope = await resolveScope(user);
  const profileIdStr = (resolvedProfileId?._id || resolvedProfileId)?.toString();

  if (!scope.canAccessAllProfiles && !scope.allowedProfileIds.includes(profileIdStr)) {
    const error = new Error('You do not have permission to create work items for this brand profile');
    error.statusCode = 403;
    error.code = 'FORBIDDEN_PROFILE';
    throw error;
  }

  const desc =
    data.description !== undefined
      ? data.description
      : typeof data.brief === 'string'
      ? data.brief
      : data.brief?.description || '';
  const contentLink = data.contentLink || data.brief?.contentLink || '';
  const assetsLink = data.assetsLink || data.brief?.assetsLink || '';

  const workItem = await WorkItem.create({
    campaignId: campaign._id,
    profileId: resolvedProfileId,
    relatedOKR,
    relatedTarget,
    title: data.title.trim(),
    workType: normalizeWorkType(data.workType) || data.workType,
    departmentId: data.departmentId,
    ownerId: data.ownerId || user._id || user.userId,
    deadline: data.deadline,
    estimatedEffortHrs: data.estimatedEffortHrs || 4,
    status: data.status || 'Not Started',
    priority: data.priority || 'Medium',
    description: desc,
    deliverableUrl: data.deliverableUrl || '',
    publishedUrl: data.publishedUrl || '',
    blockerReason: data.status === 'Blocked' ? data.blockerReason : null,
    blockerNote: data.status === 'Blocked' ? data.blockerNote : '',
    // Content Flow stage fields (Phase 3 delta)
    contentPieceId: data.contentPieceId || null,
    stageKey: data.stageKey || null,
    stageOrder: data.stageOrder !== undefined ? data.stageOrder : null,
    reviewRequired: Boolean(data.reviewRequired),
    unlockedAt: data.unlockedAt || null,
    isSkipped: Boolean(data.isSkipped),
    contentLink,
    assetsLink,
    brief: {
      description: desc,
      contentLink,
      assetsLink,
    },
  });

  await logActivity({
    entityType: 'work_item',
    entityId: workItem._id,
    profileId: workItem.profileId,
    actor: user,
    action: 'work_item.created',
    toStatus: workItem.status,
    metadata: {
      title: workItem.title,
      campaignId: workItem.campaignId,
      workType: workItem.workType,
      ownerId: workItem.ownerId,
      deadline: workItem.deadline,
    },
  });

  return WorkItem.findById(workItem._id)
    .populate('campaignId', 'name relatedOKR status budget')
    .populate('profileId', 'name code active')
    .populate('departmentId', 'name code')
    .populate('ownerId', 'name email role jobRole')
    .populate('relatedTarget', 'month revenueTarget leadsTarget');
}

export async function listWorkItems(filters = {}, user) {
  const scope = await resolveScope(user, filters);
  const query = {};

  let filterProfileId = null;
  if (filters.profileId && filters.profileId !== 'all') {
    filterProfileId = await resolveProfileObjectId(filters.profileId);
  }

  // Profile Scoping
  if (!scope.canAccessAllProfiles) {
    if (filterProfileId) {
      if (!scope.allowedProfileIds.includes(filterProfileId.toString())) {
        return [];
      }
      query.profileId = filterProfileId;
    } else {
      query.profileId = { $in: scope.allowedProfileIds };
    }
  } else if (filterProfileId) {
    query.profileId = filterProfileId;
  }

  // Person Scoping (for Team Member)
  if (user.role === 'team_member' && filters.scopedToSelf !== false && !filters.allWork) {
    const userId = (user._id || user.id || user.userId)?.toString();
    query.ownerId = userId;
  } else if (filters.ownerId && filters.ownerId !== 'all') {
    query.ownerId = filters.ownerId;
  }

  if (filters.campaignId) {
    query.campaignId = filters.campaignId;
  }

  if (filters.departmentId && filters.departmentId !== 'all') {
    query.departmentId = filters.departmentId;
  }

  if (filters.status && filters.status !== 'all') {
    query.status = filters.status;
  }

  if (filters.workType && filters.workType !== 'all') {
    query.workType = filters.workType;
  }

  if (filters.priority && filters.priority !== 'all') {
    query.priority = filters.priority;
  }

  // Content Flow filters
  if (filters.contentPieceId) {
    query.contentPieceId = filters.contentPieceId;
  }
  if (filters.stageKey && filters.stageKey !== 'all') {
    query.stageKey = filters.stageKey;
  }

  // Dynamic Overdue filter
  if (filters.isOverdue === 'true' || filters.isOverdue === true) {
    query.deadline = { $lt: new Date() };
    query.status = { $nin: ['Approved', 'Published'] };
  }

  if (filters.search) {
    const regex = new RegExp(filters.search, 'i');
    query.$or = [{ title: regex }, { description: regex }];
  }

  const items = await WorkItem.find(query)
    .populate('campaignId', 'name relatedOKR status budget')
    .populate('profileId', 'name code active')
    .populate('departmentId', 'name code')
    .populate('ownerId', 'name email role jobRole')
    .populate('relatedTarget', 'month revenueTarget leadsTarget')
    .sort({ deadline: 1, createdAt: -1 });

  return items;
}

export async function getWorkItemById(id, user) {
  const workItem = await WorkItem.findById(id)
    .populate('campaignId', 'name relatedOKR status budget')
    .populate('profileId', 'name code active')
    .populate('departmentId', 'name code')
    .populate('ownerId', 'name email role jobRole')
    .populate('relatedTarget', 'month revenueTarget leadsTarget');

  if (!workItem) {
    const error = new Error('Work item not found');
    error.statusCode = 404;
    throw error;
  }

  const scope = await resolveScope(user);
  const profileIdStr = (workItem.profileId?._id || workItem.profileId)?.toString();

  if (!scope.canAccessAllProfiles && !scope.allowedProfileIds.includes(profileIdStr)) {
    const error = new Error('You do not have permission to view work items for this brand profile');
    error.statusCode = 403;
    throw error;
  }

  return workItem;
}

export async function updateWorkItem(id, data, user) {
  const workItem = await WorkItem.findById(id);
  if (!workItem) {
    const error = new Error('Work item not found');
    error.statusCode = 404;
    throw error;
  }

  const scope = await resolveScope(user);
  const profileIdStr = (workItem.profileId?._id || workItem.profileId)?.toString();

  if (!scope.canAccessAllProfiles && !scope.allowedProfileIds.includes(profileIdStr)) {
    const error = new Error('You do not have permission to update work items for this brand profile');
    error.statusCode = 403;
    throw error;
  }

  if (data.title) workItem.title = data.title.trim();
  if (data.workType) workItem.workType = normalizeWorkType(data.workType) || data.workType;
  if (data.departmentId) workItem.departmentId = data.departmentId;
  if (data.ownerId) workItem.ownerId = data.ownerId;
  if (data.deadline) workItem.deadline = data.deadline;
  if (data.estimatedEffortHrs !== undefined) workItem.estimatedEffortHrs = data.estimatedEffortHrs;
  if (data.priority) workItem.priority = data.priority;
  if (data.description !== undefined) {
    workItem.description = data.description;
    if (workItem.brief) workItem.brief.description = data.description;
  }
  if (data.deliverableUrl !== undefined) workItem.deliverableUrl = data.deliverableUrl;
  if (data.publishedUrl !== undefined) workItem.publishedUrl = data.publishedUrl;

  // Content Flow stage fields (Phase 3 delta)
  if (data.contentPieceId !== undefined) workItem.contentPieceId = data.contentPieceId;
  if (data.stageKey !== undefined) workItem.stageKey = data.stageKey;
  if (data.stageOrder !== undefined) workItem.stageOrder = data.stageOrder;
  if (data.reviewRequired !== undefined) workItem.reviewRequired = data.reviewRequired;
  if (data.unlockedAt !== undefined) workItem.unlockedAt = data.unlockedAt;
  if (data.isSkipped !== undefined) workItem.isSkipped = data.isSkipped;

  // Deliverable link and brief updates
  if (data.contentLink !== undefined) {
    workItem.contentLink = data.contentLink;
    if (workItem.brief) workItem.brief.contentLink = data.contentLink;
  }
  if (data.assetsLink !== undefined) {
    workItem.assetsLink = data.assetsLink;
    if (workItem.brief) workItem.brief.assetsLink = data.assetsLink;
  }
  if (data.brief !== undefined) {
    if (typeof data.brief === 'string') {
      workItem.description = data.brief;
      if (workItem.brief) workItem.brief.description = data.brief;
    } else if (data.brief && typeof data.brief === 'object') {
      if (!workItem.brief) {
        workItem.brief = { description: '', contentLink: '', assetsLink: '' };
      }
      if (data.brief.description !== undefined) {
        workItem.description = data.brief.description;
        workItem.brief.description = data.brief.description;
      }
      if (data.brief.contentLink !== undefined) {
        workItem.contentLink = data.brief.contentLink;
        workItem.brief.contentLink = data.brief.contentLink;
      }
      if (data.brief.assetsLink !== undefined) {
        workItem.assetsLink = data.brief.assetsLink;
        workItem.brief.assetsLink = data.brief.assetsLink;
      }
    }
  }

  await workItem.save();

  await logActivity({
    entityType: 'work_item',
    entityId: workItem._id,
    profileId: workItem.profileId,
    actor: user,
    action: 'work_item.updated',
    metadata: {
      title: workItem.title,
      ownerId: workItem.ownerId,
      deadline: workItem.deadline,
    },
  });

  return WorkItem.findById(workItem._id)
    .populate('campaignId', 'name relatedOKR status budget')
    .populate('profileId', 'name code active')
    .populate('departmentId', 'name code')
    .populate('ownerId', 'name email role jobRole')
    .populate('relatedTarget', 'month revenueTarget leadsTarget');
}

export async function deleteWorkItem(id, user) {
  const workItem = await WorkItem.findById(id);
  if (!workItem) {
    const error = new Error('Work item not found');
    error.statusCode = 404;
    throw error;
  }

  const scope = await resolveScope(user);
  const profileIdStr = (workItem.profileId?._id || workItem.profileId)?.toString();

  if (!scope.canAccessAllProfiles && !scope.allowedProfileIds.includes(profileIdStr)) {
    const error = new Error('You do not have permission to delete this work item');
    error.statusCode = 403;
    throw error;
  }

  await WorkItem.findByIdAndDelete(id);

  await logActivity({
    entityType: 'work_item',
    entityId: id,
    profileId: workItem.profileId,
    actor: user,
    action: 'work_item.deleted',
    metadata: { title: workItem.title },
  });

  return { success: true, message: 'Work item deleted successfully' };
}

export async function getMyWork(user) {
  const userId = (user._id || user.id || user.userId)?.toString();
  if (!userId) {
    return { overdue: [], today: [], thisWeek: [], upcoming: [], completed: [], stats: {} };
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const endOfThisWeek = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);

  const items = await WorkItem.find({ ownerId: userId })
    .populate('campaignId', 'name relatedOKR status')
    .populate('profileId', 'name code active')
    .populate('departmentId', 'name code')
    .sort({ deadline: 1 });

  const overdue = [];
  const today = [];
  const thisWeek = [];
  const upcoming = [];
  const completed = [];

  for (const item of items) {
    const isCompleted = item.status === 'Approved' || item.status === 'Published';
    if (isCompleted) {
      completed.push(item);
      continue;
    }

    const deadline = new Date(item.deadline);
    if (deadline < startOfToday) {
      overdue.push(item);
    } else if (deadline <= endOfToday) {
      today.push(item);
    } else if (deadline <= endOfThisWeek) {
      thisWeek.push(item);
    } else {
      upcoming.push(item);
    }
  }

  const activeCount = overdue.length + today.length + thisWeek.length + upcoming.length;
  const totalRevisions = items.reduce((acc, it) => acc + (it.revisions || 0), 0);
  const avgRevisions = items.length > 0 ? Number((totalRevisions / items.length).toFixed(1)) : 0;

  return {
    overdue,
    today,
    thisWeek,
    upcoming,
    completed: completed.slice(0, 15),
    stats: {
      activeCount,
      overdueCount: overdue.length,
      todayCount: today.length,
      completedCount: completed.length,
      avgRevisions,
    },
  };
}

export async function getCalendarWorkItems(filters = {}, user) {
  const scope = await resolveScope(user, filters);
  const query = {};

  if (!scope.canAccessAllProfiles) {
    query.profileId = { $in: scope.allowedProfileIds };
  } else if (filters.profileId && filters.profileId !== 'all') {
    query.profileId = filters.profileId;
  }

  if (filters.departmentId && filters.departmentId !== 'all') {
    query.departmentId = filters.departmentId;
  }

  if (filters.ownerId && filters.ownerId !== 'all') {
    query.ownerId = filters.ownerId;
  }

  if (filters.campaignId) {
    query.campaignId = filters.campaignId;
  }

  if (filters.status && filters.status !== 'all') {
    query.status = filters.status;
  }

  if (filters.start && filters.end) {
    query.deadline = {
      $gte: new Date(filters.start),
      $lte: new Date(filters.end),
    };
  }

  return WorkItem.find(query)
    .populate('campaignId', 'name relatedOKR status')
    .populate('profileId', 'name code active')
    .populate('departmentId', 'name code')
    .populate('ownerId', 'name email role jobRole')
    .sort({ deadline: 1 });
}

export async function getTodoItems(user) {
  const scope = await resolveScope(user);
  const query = {};

  if (!scope.canAccessAllProfiles) {
    query.profileId = { $in: scope.allowedProfileIds };
  }

  if (user.role === 'team_member') {
    const userId = (user._id || user.id || user.userId)?.toString();
    query.ownerId = userId;
  } else if (user.role === 'team_lead') {
    if (scope.allowedPersonIds) {
      query.ownerId = { $in: scope.allowedPersonIds };
    }
  }

  query.status = { $nin: ['Approved', 'Published'] };

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const items = await WorkItem.find(query)
    .populate('campaignId', 'name relatedOKR status')
    .populate('profileId', 'name code active')
    .populate('departmentId', 'name code')
    .populate('ownerId', 'name email role jobRole')
    .sort({ deadline: 1 });

  const overdue = [];
  const today = [];
  const upcoming = [];

  for (const item of items) {
    const deadline = new Date(item.deadline);
    if (deadline < startOfToday) {
      overdue.push(item);
    } else if (deadline <= endOfToday) {
      today.push(item);
    } else {
      upcoming.push(item);
    }
  }

  return {
    overdue,
    today,
    upcoming,
    total: items.length,
  };
}

export async function getWorkItemActivities(id, user) {
  const item = await getWorkItemById(id, user);
  return listRecentActivities({ entityType: 'work_item', entityId: item._id, limit: 50 });
}
