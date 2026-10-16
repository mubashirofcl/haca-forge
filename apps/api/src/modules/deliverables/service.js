import { Deliverable } from './model.js';
import { Task } from '../tasks/model.js';
import { ContentItem } from '../content/model.js';
import { Comment } from '../comments/model.js';
import { transitionStatus } from '../common/transition.service.js';
import { advancePipelineHandoff } from '../pipelines/service.js';
import { createNotification } from '../notifications/service.js';
import { User } from '../users/model.js';
import { eventBus, EVENTS } from '../../lib/events.js';

/**
 * Worker uploads a deliverable and submits for review
 */
export async function createDeliverable(input, user, io) {
  const task = await Task.findById(input.taskId);
  if (!task) {
    const err = new Error('Task not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const contentItemId = input.contentItemId || task.contentItemId;
  const contentItem = await ContentItem.findById(contentItemId);
  if (!contentItem) {
    const err = new Error('Linked Content Item not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  // Calculate next version for this task
  const latestDeliverable = await Deliverable.findOne({ taskId: task._id }).sort({
    version: -1,
  });
  const version = (latestDeliverable?.version || 0) + 1;

  const deliverable = await Deliverable.create({
    taskId: task._id,
    contentItemId: contentItem._id,
    version,
    type: input.type || 'video',
    fileUrl: input.fileUrl || '',
    externalLink: input.externalLink || '',
    thumbnail: input.thumbnail || '',
    uploadedBy: user._id,
    notes: input.notes || '',
    status: 'submitted',
  });

  // Transition task to 'submitted'
  await transitionStatus({
    entityType: 'Task',
    entity: task,
    toStatus: 'submitted',
    user,
    comment: `Deliverable v${version} submitted for review`,
    io,
  });

  // If content item is in production, advance to in_review
  if (['planned', 'in_production', 'changes_requested'].includes(contentItem.status)) {
    await transitionStatus({
      entityType: 'ContentItem',
      entity: contentItem,
      toStatus: 'in_review',
      user,
      comment: `Deliverable v${version} submitted on stage ${task.stageKey}`,
      io,
    });
  }

  // Emit REVIEW_SUBMITTED domain event
  eventBus.emit(EVENTS.REVIEW_SUBMITTED, {
    _id: deliverable._id,
    title: task.title,
    version,
    reviewer: null,
    link: `/deliverables/${deliverable._id}`,
  });

  return Deliverable.findById(deliverable._id)
    .populate('uploadedBy', 'name email avatar role')
    .populate('taskId', 'taskId title stageKey team')
    .populate('contentItemId', 'contentId title format');
}

/**
 * Lead (or delegated reviewer) approves, requests changes, or rejects deliverable
 */
export async function reviewDeliverable(deliverableId, { decision, notes, comments }, user, io) {
  const deliverable = await Deliverable.findById(deliverableId);
  if (!deliverable) {
    const err = new Error('Deliverable not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const task = await Task.findById(deliverable.taskId);
  const contentItem = await ContentItem.findById(deliverable.contentItemId);

  // 1. Approved Decision
  if (decision === 'approved') {
    deliverable.status = 'approved';
    deliverable.decidedBy = user._id;
    deliverable.decidedAt = new Date();
    await deliverable.save();

    await transitionStatus({
      entityType: 'Deliverable',
      entity: deliverable,
      toStatus: 'approved',
      user,
      comment: notes || 'Approved by Lead',
      io,
    });

    // Move task to approved and advance pipeline
    await transitionStatus({
      entityType: 'Task',
      entity: task,
      toStatus: 'approved',
      user,
      comment: `Deliverable v${deliverable.version} approved`,
      io,
    });

    if (task) {
      await advancePipelineHandoff(task, user, io);
    }

    // Check if this was the final task of the content item
    if (contentItem) {
      const allTasks = await Task.find({ contentItemId: contentItem._id });
      const allDoneOrApproved = allTasks.every((t) =>
        ['done', 'approved'].includes(t.status)
      );

      if (allDoneOrApproved) {
        // If content item originated from a department request, require requester confirmation
        if (contentItem.requestId) {
          contentItem.requesterConfirmation = {
            status: 'pending',
            requestedAt: new Date(),
          };
          await contentItem.save();

          // Notify the original requester
          if (contentItem.requester) {
            await createNotification({
              recipient: contentItem.requester,
              type: 'requester_confirmation_needed',
              title: 'Final Output Ready for Confirmation',
              message: `Lead approved deliverables for "${contentItem.title}". Please review and confirm final output.`,
              entityType: 'content',
              entityId: contentItem._id,
              io,
            });
          }
        } else {
          // Calendar-based or internal item: skip confirmation, move to scheduled
          contentItem.requesterConfirmation = {
            status: 'not_required',
          };
          await transitionStatus({
            entityType: 'ContentItem',
            entity: contentItem,
            toStatus: 'scheduled',
            user,
            comment: 'All stages approved. Auto-scheduled (no external requester confirmation required).',
            io,
          });
        }
      }
    }

    // Notify assignee
    if (task.assignee) {
      await createNotification({
        recipient: task.assignee,
        type: 'deliverable_approved',
        title: 'Deliverable Approved',
        message: `Your deliverable v${deliverable.version} for "${task.title}" was approved!`,
        entityType: 'task',
        entityId: task._id,
        io,
      });
    }
  } else if (decision === 'changes_requested') {
    // 2. Changes Requested Decision
    deliverable.status = 'changes_requested';
    deliverable.decidedBy = user._id;
    deliverable.decidedAt = new Date();
    await deliverable.save();

    await transitionStatus({
      entityType: 'Deliverable',
      entity: deliverable,
      toStatus: 'changes_requested',
      user,
      comment: notes || 'Changes requested by Lead',
      io,
    });

    // Increment task revisionCount
    task.revisionCount = (task.revisionCount || 0) + 1;
    await task.save();

    // Transition task to changes_requested
    await transitionStatus({
      entityType: 'Task',
      entity: task,
      toStatus: 'changes_requested',
      user,
      comment: notes || `Changes requested (Revision #${task.revisionCount})`,
      io,
    });

    // Transition ContentItem back to changes_requested
    if (contentItem && contentItem.status !== 'changes_requested') {
      await transitionStatus({
        entityType: 'ContentItem',
        entity: contentItem,
        toStatus: 'changes_requested',
        user,
        comment: `Changes requested on stage ${task.stageKey} (Revision #${task.revisionCount})`,
        io,
      });
    }

    // Save timestamped comments if provided
    if (Array.isArray(comments) && comments.length > 0) {
      for (const c of comments) {
        await Comment.create({
          entityType: 'deliverable',
          entityId: deliverable._id,
          author: user._id,
          text: c.text,
          mediaTimestamp: c.mediaTimestamp ?? null,
        });
      }
    }

    // Notify assignee
    if (task.assignee) {
      await createNotification({
        recipient: task.assignee,
        type: 'changes_requested',
        title: `Changes Requested (Revision #${task.revisionCount})`,
        message: notes || `Lead requested revisions on "${task.title}". Check timestamped feedback notes.`,
        entityType: 'task',
        entityId: task._id,
        io,
      });
    }
  } else if (decision === 'rejected') {
    // 3. Rejected Decision
    deliverable.status = 'rejected';
    deliverable.decidedBy = user._id;
    deliverable.decidedAt = new Date();
    await deliverable.save();

    await transitionStatus({
      entityType: 'Deliverable',
      entity: deliverable,
      toStatus: 'rejected',
      user,
      comment: notes || 'Deliverable rejected by Lead',
      io,
    });

    await transitionStatus({
      entityType: 'Task',
      entity: task,
      toStatus: 'changes_requested',
      user,
      comment: notes || 'Deliverable rejected; revision required',
      io,
    });
  }

  // Emit REVIEW_DECIDED domain event
  eventBus.emit(EVENTS.REVIEW_DECIDED, {
    _id: deliverable._id,
    title: task ? task.title : 'Deliverable',
    decision,
    feedback: notes || (decision === 'approved' ? 'Approved' : 'Revisions requested'),
    assignee: task ? task.assignee : null,
    link: `/deliverables/${deliverable._id}`,
  });

  return Deliverable.findById(deliverable._id)
    .populate('uploadedBy', 'name email avatar role')
    .populate('decidedBy', 'name email avatar role')
    .populate('taskId', 'taskId title stageKey revisionCount status')
    .populate('contentItemId', 'contentId title format status');
}

/**
 * Requester confirms or requests changes on final deliverable output
 */
export async function confirmDeliverable(contentItemId, { decision, feedback }, user, io) {
  const contentItem = await ContentItem.findById(contentItemId).populate('requester');
  if (!contentItem) {
    const err = new Error('Content Item not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (decision === 'confirm') {
    contentItem.requesterConfirmation = {
      status: 'confirmed',
      confirmedBy: user._id,
      confirmedAt: new Date(),
    };
    await contentItem.save();

    // Transition to scheduled
    await transitionStatus({
      entityType: 'ContentItem',
      entity: contentItem,
      toStatus: 'scheduled',
      user,
      comment: 'Requester confirmed final deliverable output. Ready for publication.',
      io,
    });

    // Notify Leads & SM Managers
    const managers = await User.find({ role: { $in: ['lead', 'admin', 'sm_manager'] } });
    for (const mgr of managers) {
      await createNotification({
        recipient: mgr._id,
        type: 'requester_confirmed',
        title: 'Deliverable Confirmed by Requester',
        message: `${user.name} confirmed final deliverable for "${contentItem.title}"`,
        entityType: 'content',
        entityId: contentItem._id,
        io,
      });
    }
  } else if (decision === 'request_changes') {
    contentItem.requesterConfirmation = {
      status: 'changes_requested',
      feedback: feedback || '',
      requestedAt: new Date(),
    };
    await contentItem.save();

    // Transition content item back to changes_requested
    await transitionStatus({
      entityType: 'ContentItem',
      entity: contentItem,
      toStatus: 'changes_requested',
      user,
      comment: `Requester requested changes: ${feedback || 'No details provided'}`,
      io,
    });

    if (feedback) {
      await Comment.create({
        entityType: 'content',
        entityId: contentItem._id,
        author: user._id,
        text: `Requester Revision Note: ${feedback}`,
      });
    }

    // Notify Leads
    const leads = await User.find({ role: { $in: ['lead', 'admin'] } });
    for (const lead of leads) {
      await createNotification({
        recipient: lead._id,
        type: 'requester_changes_requested',
        title: 'Requester Requested Revisions',
        message: `${user.name} requested changes on "${contentItem.title}": "${feedback || ''}"`,
        entityType: 'content',
        entityId: contentItem._id,
        io,
      });
    }
  }

  return ContentItem.findById(contentItemId)
    .populate('requester', 'name email avatar department')
    .populate('sourceDepartment', 'name code');
}

/**
 * Hand an approved ad creative to Performance Marketing
 */
export async function handToPerformance(contentItemId, user, io) {
  if (user && !['admin', 'lead', 'team_lead'].includes(user.role)) {
    const err = new Error('Only Leads or Admins can hand deliverables to Performance');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  const contentItem = await ContentItem.findById(contentItemId);
  if (!contentItem) {
    const err = new Error('Content Item not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  contentItem.performanceStatus = 'handed_to_performance';
  await contentItem.save();

  return contentItem;
}

/**
 * Set an ad creative to Live in performance campaigns
 */
export async function setPerformanceLive(contentItemId, { liveUrl, liveDate, notes }, user, io) {
  const isPerformanceAuthorized =
    user &&
    (['admin', 'lead'].includes(user.role) ||
      (user.department && user.department.toLowerCase() === 'performance') ||
      (user.team && user.team.toLowerCase() === 'performance'));

  if (!isPerformanceAuthorized) {
    const err = new Error('Only the Performance team or Lead can mark an ad creative as Live');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  const contentItem = await ContentItem.findById(contentItemId);
  if (!contentItem) {
    const err = new Error('Content Item not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  contentItem.performanceStatus = 'live';
  contentItem.liveUrl = liveUrl;
  contentItem.liveDate = liveDate ? new Date(liveDate) : new Date();
  await contentItem.save();

  await transitionStatus({
    entityType: 'ContentItem',
    entity: contentItem,
    toStatus: 'live',
    user,
    comment: notes || `Ad creative marked Live at ${liveUrl}`,
    io,
  });

  return contentItem;
}

/**
 * Get all versions of deliverables for a task
 */
export async function getDeliverablesByTask(taskId) {
  return Deliverable.find({ taskId })
    .populate('uploadedBy', 'name email avatar role')
    .populate('decidedBy', 'name email avatar role')
    .sort({ version: -1 });
}

/**
 * Side-by-side comparison data between two deliverable versions
 */
export async function getDeliverableComparison(v1Id, v2Id) {
  const [v1, v2] = await Promise.all([
    Deliverable.findById(v1Id)
      .populate('uploadedBy', 'name email avatar role')
      .populate('decidedBy', 'name email avatar role'),
    Deliverable.findById(v2Id)
      .populate('uploadedBy', 'name email avatar role')
      .populate('decidedBy', 'name email avatar role'),
  ]);

  if (!v1 || !v2) {
    const err = new Error('One or both deliverable versions not found for comparison');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  // Also pull comments for both deliverables
  const [commentsV1, commentsV2] = await Promise.all([
    Comment.find({ entityType: 'deliverable', entityId: v1._id })
      .populate('author', 'name email avatar')
      .sort({ mediaTimestamp: 1, createdAt: 1 }),
    Comment.find({ entityType: 'deliverable', entityId: v2._id })
      .populate('author', 'name email avatar')
      .sort({ mediaTimestamp: 1, createdAt: 1 }),
  ]);

  return {
    v1: { ...v1.toObject(), comments: commentsV1 },
    v2: { ...v2.toObject(), comments: commentsV2 },
  };
}

/**
 * Lead Review Queue sorted by deadline
 */
export async function listReviewQueue() {
  const deliverables = await Deliverable.find({ status: 'submitted' })
    .populate('uploadedBy', 'name email avatar role team')
    .populate({
      path: 'taskId',
      select: 'taskId title stageKey dueDate estimateHours team revisionCount status',
    })
    .populate({
      path: 'contentItemId',
      select: 'contentId title format productionDeadline publishDate sourceDepartment platforms',
      populate: { path: 'sourceDepartment', select: 'name code' },
    })
    .sort({ createdAt: 1 });

  // Sort queue by contentItem productionDeadline or task dueDate
  return deliverables.sort((a, b) => {
    const deadlineA =
      a.contentItemId?.productionDeadline || a.taskId?.dueDate || a.createdAt;
    const deadlineB =
      b.contentItemId?.productionDeadline || b.taskId?.dueDate || b.createdAt;
    return new Date(deadlineA).getTime() - new Date(deadlineB).getTime();
  });
}

/**
 * File Library with rich filters
 */
export async function listFileLibrary({
  type,
  campaignId,
  contentItemId,
  status,
  search,
  page = 1,
  limit = 24,
}) {
  const filter = {};

  if (type) {
    filter.type = type;
  }
  if (status) {
    filter.status = status;
  }
  if (contentItemId) {
    filter.contentItemId = contentItemId;
  }

  if (search) {
    filter.$or = [
      { notes: { $regex: search, $options: 'i' } },
      { fileUrl: { $regex: search, $options: 'i' } },
      { externalLink: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const take = parseInt(limit, 10);

  const [files, total] = await Promise.all([
    Deliverable.find(filter)
      .populate('uploadedBy', 'name email avatar role')
      .populate('taskId', 'taskId title stageKey team')
      .populate({
        path: 'contentItemId',
        select: 'contentId title format publishDate campaignId sourceDepartment',
        populate: [
          { path: 'sourceDepartment', select: 'name code' },
          { path: 'campaignId', select: 'name code' },
        ],
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(take),
    Deliverable.countDocuments(filter),
  ]);

  // If campaignId was specified, filter by populated campaignId
  const finalFiles = campaignId
    ? files.filter((f) => String(f.contentItemId?.campaignId?._id) === String(campaignId))
    : files;

  return {
    files: finalFiles,
    total,
    page: parseInt(page, 10),
    pages: Math.ceil(total / take) || 1,
  };
}
