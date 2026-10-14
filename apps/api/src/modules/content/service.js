import mongoose from 'mongoose';
import { ContentItem } from './model.js';
import { Request } from '../requests/model.js';
import { Department } from '../departments/model.js';
import { Task } from '../tasks/model.js';
import { Comment } from '../comments/model.js';
import { StatusHistory } from '../statusHistory/model.js';
import { getNextSequenceId } from '../requests/counter.model.js';
import { initializeContentPipeline } from '../pipelines/service.js';
import { transitionStatus } from '../common/transition.service.js';
import { createNotification } from '../notifications/service.js';
import { logger } from '../../lib/logger.js';

export async function createContentItem(input, user, io) {
  const contentId = await getNextSequenceId('CNT');

  const contentItem = new ContentItem({
    ...input,
    contentId,
    requester: input.requester || user._id,
    status: 'planned',
  });

  await contentItem.save();

  // Initialize pipeline stages and tasks
  await initializeContentPipeline(contentItem, user, io);

  // Return populated
  return ContentItem.findById(contentItem._id)
    .populate('requester', 'name email avatar')
    .populate('sourceDepartment', 'name code')
    .populate('tasks');
}

export async function listContentItems(query = {}, user) {
  const filter = {};

  // Role scoping
  if (user.role === 'dept_lead') {
    filter.sourceDepartment = user.department;
  } else if (user.role === 'dept_staff') {
    filter.requester = user._id;
  } else if (user.role === 'worker') {
    // Workers see items with tasks in their team or assigned to them
    const workerTaskContentIds = await Task.find({
      $or: [{ assignee: user._id }, { team: user.team }],
    }).distinct('contentItemId');
    filter._id = { $in: workerTaskContentIds };
  }

  if (query.status) {
    filter.status = query.status;
  }
  if (query.format) {
    filter.format = query.format;
  }
  if (query.department) {
    filter.sourceDepartment = query.department;
  }
  if (query.priority) {
    filter.priority = query.priority;
  }
  if (query.search) {
    filter.$or = [
      { title: { $regex: query.search, $options: 'i' } },
      { contentId: { $regex: query.search, $options: 'i' } },
    ];
  }

  const page = parseInt(query.page, 10) || 1;
  const limit = Math.min(parseInt(query.limit, 10) || 20, 100);
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    ContentItem.find(filter)
      .populate('requester', 'name email avatar')
      .populate('sourceDepartment', 'name code')
      .populate('tasks')
      .sort({ publishDate: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    ContentItem.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function getContentItemById(id, user) {
  const item = await ContentItem.findById(id)
    .populate('requester', 'name email avatar')
    .populate('sourceDepartment', 'name code')
    .populate('campaignId', 'name startDate endDate')
    .populate({
      path: 'tasks',
      populate: {
        path: 'assignee',
        select: 'name email avatar team skills',
      },
    });

  if (!item) {
    const err = new Error('Content item not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  // Load comments
  const comments = await Comment.find({
    entityType: 'content',
    entityId: item._id,
  })
    .populate('author', 'name email avatar role')
    .sort({ createdAt: 1 });

  // Load status history
  const statusHistory = await StatusHistory.find({
    entityType: 'ContentItem',
    entityId: item._id,
  })
    .populate('changedBy', 'name email')
    .sort({ timestamp: -1 });

  return { item, comments, statusHistory };
}

export async function updateContentItem(id, updates, user, io) {
  const item = await ContentItem.findById(id);
  if (!item) {
    const err = new Error('Content item not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  // If status is transitioning
  if (updates.status && updates.status !== item.status) {
    await transitionStatus({
      entityType: 'ContentItem',
      entity: item,
      toStatus: updates.status,
      user,
      reasonCode: updates.reasonCode,
      reason: updates.reason,
      comment: updates.comment,
      io,
    });
    delete updates.status;
  }

  Object.assign(item, updates);
  await item.save();

  return ContentItem.findById(id)
    .populate('requester', 'name email avatar')
    .populate('sourceDepartment', 'name code')
    .populate('tasks');
}

/**
 * Converts an accepted request into a ContentItem with full pipeline
 */
export async function convertRequestToContentItem(requestId, convertInput, user, io) {
  const request = await Request.findById(requestId);
  if (!request) {
    const err = new Error('Request not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (request.status !== 'accepted') {
    const err = new Error(
      `Cannot convert request in status '${request.status}'. Request must be 'accepted' first.`
    );
    err.statusCode = 400;
    err.code = 'REQUEST_NOT_ACCEPTED';
    throw err;
  }

  const contentId = await getNextSequenceId('CNT');

  let sourceDepartment = request.sourceDepartment;
  if (!mongoose.Types.ObjectId.isValid(sourceDepartment)) {
    const dept = await Department.findOne({
      $or: [
        { name: request.sourceDepartment },
        { code: request.sourceDepartment },
        { type: request.sourceDepartment?.toLowerCase?.() },
      ],
    });
    if (dept) {
      sourceDepartment = dept._id;
    } else {
      const anyDept = await Department.findOne();
      sourceDepartment = anyDept?._id;
    }
  }

  let publishDate = convertInput.publishDate
    ? new Date(convertInput.publishDate)
    : request.deadline
    ? new Date(request.deadline)
    : new Date(Date.now() + 7 * 86400000);

  if (isNaN(publishDate.getTime())) {
    publishDate = new Date(Date.now() + 7 * 86400000);
  }

  const contentItem = new ContentItem({
    contentId,
    title: convertInput.title || request.title,
    format: convertInput.format || 'static_post',
    sourceDepartment,
    requester: request.requester,
    requestId: request._id,
    campaignId: convertInput.campaignId || undefined,
    pillar: convertInput.pillar || 'General',
    platforms: convertInput.platforms?.length ? convertInput.platforms : ['instagram'],
    publishDate,
    priority: convertInput.priority || request.priority || 'medium',
    caption: convertInput.caption || '',
    brief: convertInput.brief || request.dynamicFields?.brief || request.title,
    status: 'planned',
  });

  await contentItem.save();

  // Initialize pipeline
  await initializeContentPipeline(contentItem, user, io);

  // Mark request as converted via transition service
  await transitionStatus({
    entityType: 'Request',
    entity: request,
    toStatus: 'converted',
    user,
    comment: `Converted to content item ${contentId} (${contentItem.format})`,
    io,
  });

  // Link to request
  if (!request.contentItemIds) request.contentItemIds = [];
  request.contentItemIds.push(contentItem._id);
  await request.save();

  // Send notification to requester
  await createNotification({
    recipient: request.requester,
    type: 'request_converted',
    title: 'Request Converted to Production',
    message: `Your request ${request.requestId} was converted to Content Item ${contentId}. Production has begun!`,
    entityType: 'content',
    entityId: contentItem._id,
    io,
  });

  return {
    contentItem: await ContentItem.findById(contentItem._id)
      .populate('requester', 'name email avatar')
      .populate('sourceDepartment', 'name code')
      .populate('tasks'),
    request,
  };
}
