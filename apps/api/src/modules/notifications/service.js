import { Notification } from './model.js';
import { User } from '../users/model.js';
import { logger } from '../../lib/logger.js';
import { enqueueEmail } from '../../lib/queue.js';
import { eventBus, EVENTS } from '../../lib/events.js';

let ioInstance = null;

export function registerSocketIO(io) {
  ioInstance = io;
}

/**
 * Creates an in-app notification record and dispatches via Socket.io
 */
export async function createNotification({
  recipient,
  type,
  title,
  message,
  link,
  metadata,
  io = ioInstance,
}) {
  try {
    const notification = await Notification.create({
      recipient,
      type,
      title,
      message,
      link,
      metadata,
    });

    if (io) {
      io.to(`user:${recipient}`).emit('notification:new', notification);
    }

    return notification;
  } catch (err) {
    logger.warn({ err: err.message }, 'Failed to create notification');
    return null;
  }
}

/**
 * Get notifications for a user with pagination and optional type/unread filters
 */
export async function getUserNotifications(
  userId,
  { unreadOnly = false, type = null, page = 1, limit = 20 } = {}
) {
  const query = { recipient: userId };
  if (unreadOnly) {
    query.read = false;
  }
  if (type && type !== 'all') {
    if (type === 'mentions') {
      query.type = 'comment.mention';
    } else if (type === 'tasks') {
      query.type = { $in: ['task.assigned', 'task.blocked', 'task.completed', 'deadline.approaching', 'deadline.overdue'] };
    } else if (type === 'requests') {
      query.type = { $in: ['request.created', 'request.decided'] };
    } else {
      query.type = type;
    }
  }

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.max(1, Math.min(100, Number(limit) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [data, total, unreadCount] = await Promise.all([
    Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Notification.countDocuments(query),
    Notification.countDocuments({ recipient: userId, read: false }),
  ]);

  return {
    data,
    unreadCount,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum),
    },
  };
}

/**
 * Mark a notification as read
 */
export async function markAsRead(notificationId, userId) {
  return Notification.findOneAndUpdate(
    { _id: notificationId, recipient: userId },
    { read: true },
    { new: true }
  );
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId) {
  return Notification.updateMany(
    { recipient: userId, read: false },
    { read: true }
  );
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId, userId) {
  return Notification.findOneAndDelete({ _id: notificationId, recipient: userId });
}

/**
 * Get user's notification preferences
 */
export async function getUserPreferences(userId) {
  const user = await User.findById(userId).select('notificationPreferences').lean();
  return (
    user?.notificationPreferences || {
      email: {
        requestUpdates: true,
        taskAssigned: true,
        taskBlocked: true,
        reviewDecisions: true,
        deadlineReminders: true,
        dailyDigest: true,
      },
      inApp: {
        requestUpdates: true,
        taskAssigned: true,
        taskBlocked: true,
        reviewDecisions: true,
        deadlineReminders: true,
        mentions: true,
      },
      dailyDigest: true,
    }
  );
}

/**
 * Update user's notification preferences
 */
export async function updateUserPreferences(userId, preferences) {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  user.notificationPreferences = {
    ...user.notificationPreferences?.toObject(),
    ...preferences,
    email: {
      ...(user.notificationPreferences?.email || {}),
      ...(preferences.email || {}),
    },
    inApp: {
      ...(user.notificationPreferences?.inApp || {}),
      ...(preferences.inApp || {}),
    },
  };

  await user.save();
  return user.notificationPreferences;
}

/**
 * Maps domain events to recipients per Section 14.3 and dispatches in-app + email
 */
export async function handleDomainEvent(eventName, payload, io = ioInstance) {
  try {
    const recipients = new Set();
    let templateName = null;
    let templateContext = {};
    let notificationTitle = '';
    let notificationMessage = '';
    let link = '';
    let preferenceKey = 'requestUpdates';

    switch (eventName) {
      case EVENTS.REQUEST_CREATED: {
        preferenceKey = 'requestUpdates';
        const leads = await User.find({
          role: { $in: ['marketing_lead', 'admin'] },
          status: 'active',
        }).select('_id email name notificationPreferences');

        for (const u of leads) recipients.add(u);
        notificationTitle = `New Request: ${payload.requestId || 'Request'}`;
        notificationMessage = `${payload.title || 'New marketing request submitted for triage'}`;
        link = `/requests/${payload._id || payload.requestId}`;
        break;
      }

      case EVENTS.REQUEST_DECIDED: {
        preferenceKey = 'requestUpdates';
        if (payload.requester) {
          const reqUser = await User.findById(payload.requester).select('_id email name notificationPreferences');
          if (reqUser) recipients.add(reqUser);
        }
        const decisionStr = (payload.decision || 'updated').toUpperCase();
        notificationTitle = `Request ${decisionStr}: ${payload.requestId || ''}`;
        notificationMessage = `${payload.title || 'Your request status has been updated'}`;
        link = `/requests/${payload._id || payload.requestId}`;
        templateName = 'requestDecided';
        templateContext = {
          requestTitle: payload.title,
          requestId: payload.requestId,
          decision: payload.decision,
          reason: payload.reason,
          actionUrl: link,
        };
        break;
      }

      case EVENTS.TASK_ASSIGNED: {
        preferenceKey = 'taskAssigned';
        if (payload.assignee) {
          const user = await User.findById(payload.assignee).select('_id email name notificationPreferences');
          if (user) recipients.add(user);
        }
        notificationTitle = `Task Assigned: ${payload.taskId || 'New Task'}`;
        notificationMessage = `${payload.title || 'You have been assigned to a new production task'}`;
        link = payload.link || `/tasks?taskId=${payload.taskId}`;
        templateName = 'taskAssigned';
        templateContext = {
          taskTitle: payload.title,
          taskId: payload.taskId,
          dueDate: payload.dueDate,
          actionUrl: link,
        };
        break;
      }

      case EVENTS.TASK_BLOCKED: {
        preferenceKey = 'taskBlocked';
        if (payload.assignee) {
          const user = await User.findById(payload.assignee).select('_id email name notificationPreferences');
          if (user) recipients.add(user);
        }
        if (payload.team) {
          const teamLeads = await User.find({
            role: { $in: ['marketing_lead', `${payload.team}_lead`, 'creative_lead', 'video_lead', 'copy_lead'] },
            status: 'active',
          }).select('_id email name notificationPreferences');
          for (const tl of teamLeads) recipients.add(tl);
        }
        notificationTitle = `Task Blocked: ${payload.taskId || 'Task'}`;
        notificationMessage = `${payload.title || 'A task was marked as blocked'}: ${payload.reason || 'Needs resolution'}`;
        link = payload.link || `/tasks?taskId=${payload.taskId}`;
        templateName = 'taskBlocked';
        templateContext = {
          taskTitle: payload.title,
          taskId: payload.taskId,
          reason: payload.reason,
          actionUrl: link,
        };
        break;
      }

      case EVENTS.STAGE_HANDOFF: {
        preferenceKey = 'taskAssigned';
        if (payload.assignee) {
          const user = await User.findById(payload.assignee).select('_id email name notificationPreferences');
          if (user) recipients.add(user);
        } else if (payload.team) {
          const leads = await User.find({
            role: { $in: ['marketing_lead', `${payload.team}_lead`, 'creative_lead', 'video_lead', 'copy_lead'] },
            status: 'active',
          }).select('_id email name notificationPreferences');
          for (const l of leads) recipients.add(l);
        }
        notificationTitle = `Stage Handoff Ready: ${payload.stageKey || 'Next Stage'}`;
        notificationMessage = `${payload.title || 'Work is ready for the next production stage'}`;
        link = payload.link || `/tasks?taskId=${payload.taskId}`;
        break;
      }

      case EVENTS.REVIEW_SUBMITTED: {
        preferenceKey = 'reviewDecisions';
        if (payload.reviewer) {
          const user = await User.findById(payload.reviewer).select('_id email name notificationPreferences');
          if (user) recipients.add(user);
        } else {
          const leads = await User.find({
            role: { $in: ['marketing_lead', 'creative_lead', 'video_lead'] },
            status: 'active',
          }).select('_id email name notificationPreferences');
          for (const l of leads) recipients.add(l);
        }
        notificationTitle = `Deliverable Ready for Review: ${payload.title || 'Deliverable'}`;
        notificationMessage = `Version ${payload.version || 1} submitted for review and feedback`;
        link = payload.link || `/deliverables/${payload._id || payload.id}`;
        templateName = 'reviewSubmitted';
        templateContext = {
          deliverableTitle: payload.title,
          version: payload.version || 1,
          actionUrl: link,
        };
        break;
      }

      case EVENTS.REVIEW_DECIDED: {
        preferenceKey = 'reviewDecisions';
        if (payload.assignee) {
          const user = await User.findById(payload.assignee).select('_id email name notificationPreferences');
          if (user) recipients.add(user);
        }
        notificationTitle = `Review Decision: ${(payload.decision || 'decided').toUpperCase()}`;
        notificationMessage = `${payload.title || 'Deliverable review'}: ${payload.feedback || payload.decision}`;
        link = payload.link || `/deliverables/${payload._id || payload.id}`;
        templateName = 'reviewDecided';
        templateContext = {
          deliverableTitle: payload.title,
          decision: payload.decision,
          feedback: payload.feedback,
          actionUrl: link,
        };
        break;
      }

      case EVENTS.CONTENT_PUBLISHED: {
        preferenceKey = 'requestUpdates';
        if (payload.requester) {
          const user = await User.findById(payload.requester).select('_id email name notificationPreferences');
          if (user) recipients.add(user);
        }
        notificationTitle = `Content Published: ${payload.contentId || ''}`;
        notificationMessage = `${payload.title || 'Content'} is now live and published`;
        link = payload.link || `/content?contentId=${payload.contentId}`;
        break;
      }

      case EVENTS.COMMENT_MENTION: {
        preferenceKey = 'mentions';
        if (payload.mentionedUserId) {
          const user = await User.findById(payload.mentionedUserId).select('_id email name notificationPreferences');
          if (user) recipients.add(user);
        }
        notificationTitle = `Mentioned by ${payload.authorName || 'a colleague'}`;
        notificationMessage = `${payload.text || 'You were mentioned in a comment'}`;
        link = payload.link || '/';
        break;
      }

      case EVENTS.DEADLINE_APPROACHING: {
        preferenceKey = 'deadlineReminders';
        if (payload.assignee) {
          const user = await User.findById(payload.assignee).select('_id email name notificationPreferences');
          if (user) recipients.add(user);
        }
        notificationTitle = `Upcoming Deadline: ${payload.title || 'Task'}`;
        notificationMessage = `Deadline in ~${payload.hoursLeft || 24} hours on ${new Date(payload.dueDate).toLocaleDateString()}`;
        link = payload.link || '/';
        templateName = 'deadlineReminder';
        templateContext = {
          title: payload.title,
          type: payload.itemType || 'Task',
          dueDate: payload.dueDate,
          hoursLeft: payload.hoursLeft,
          actionUrl: link,
        };
        break;
      }

      case EVENTS.DEADLINE_OVERDUE: {
        preferenceKey = 'deadlineReminders';
        if (payload.assignee) {
          const user = await User.findById(payload.assignee).select('_id email name notificationPreferences');
          if (user) recipients.add(user);
        }
        const leads = await User.find({
          role: { $in: ['marketing_lead', 'admin'] },
          status: 'active',
        }).select('_id email name notificationPreferences');
        for (const l of leads) recipients.add(l);

        notificationTitle = `OVERDUE: ${payload.title || 'Task'}`;
        notificationMessage = `Scheduled deadline has passed (${new Date(payload.dueDate).toLocaleDateString()})`;
        link = payload.link || '/';
        templateName = 'deadlineOverdue';
        templateContext = {
          title: payload.title,
          type: payload.itemType || 'Task',
          dueDate: payload.dueDate,
          actionUrl: link,
        };
        break;
      }

      case EVENTS.CAPACITY_GAP: {
        preferenceKey = 'requestUpdates';
        const leads = await User.find({
          role: { $in: ['marketing_lead', 'admin', `${payload.teamKey}_lead`] },
          status: 'active',
        }).select('_id email name notificationPreferences');
        for (const l of leads) recipients.add(l);

        notificationTitle = `Capacity Alert: Team ${payload.teamName}`;
        notificationMessage = `Scheduled ${payload.scheduledHours}h vs ${payload.capacityHours}h capacity for coming week`;
        link = '/teams';
        templateName = 'capacityGapAlert';
        templateContext = {
          teamName: payload.teamName,
          scheduledHours: payload.scheduledHours,
          capacityHours: payload.capacityHours,
          actionUrl: link,
        };
        break;
      }

      case 'daily.digest': {
        preferenceKey = 'dailyDigest';
        if (payload.recipientId) {
          const user = await User.findById(payload.recipientId).select('_id email name notificationPreferences');
          if (user) recipients.add(user);
        }
        notificationTitle = 'Daily Operational Digest';
        notificationMessage = `Pending Triage: ${payload.pendingTriage}, Blocked Tasks: ${payload.blockedTasks}, Overdue: ${payload.overdueTasks}`;
        link = '/';
        templateName = 'dailyDigest';
        templateContext = {
          pendingTriage: payload.pendingTriage,
          blockedTasks: payload.blockedTasks,
          pendingReviews: payload.pendingReviews,
          overdueTasks: payload.overdueTasks,
          actionUrl: link,
        };
        break;
      }

      case EVENTS.ACCESS_REQUESTED: {
        const admins = await User.find({ role: 'admin', status: 'active' }).select('_id email name notificationPreferences');
        for (const a of admins) recipients.add(a);
        notificationTitle = `New Access Request: ${payload.name || 'User'}`;
        notificationMessage = `${payload.email} requested access for department ${payload.department}`;
        link = '/admin/access-requests';
        break;
      }

      default:
        logger.debug({ eventName }, 'Unhandled domain event type for notifications');
        return;
    }

    // Dispatch to all matching recipients according to user preferences
    for (const recipient of recipients) {
      const prefs = recipient.notificationPreferences || {};
      const inAppPrefs = prefs.inApp || {};
      const emailPrefs = prefs.email || {};

      // Check In-App preference (default true)
      const allowInApp = inAppPrefs[preferenceKey] !== false;
      if (allowInApp) {
        await createNotification({
          recipient: recipient._id,
          type: eventName,
          title: notificationTitle,
          message: notificationMessage,
          link,
          metadata: payload,
          io,
        });
      }

      // Check Email preference (default true)
      const allowEmail = emailPrefs[preferenceKey] !== false && (preferenceKey !== 'dailyDigest' || prefs.dailyDigest !== false);
      if (allowEmail && templateName && recipient.email) {
        await enqueueEmail({
          to: recipient.email,
          template: templateName,
          context: {
            ...templateContext,
            name: recipient.name || 'Colleague',
          },
        });
      }
    }
  } catch (err) {
    logger.error({ err: err.message, eventName }, 'Error handling domain event in notification service');
  }
}

// Subscribe notification service to central domain event bus
export function initDomainEventListeners(io = null) {
  if (io) registerSocketIO(io);

  for (const eventKey of Object.values(EVENTS)) {
    eventBus.on(eventKey, (payload) => {
      handleDomainEvent(eventKey, payload, ioInstance);
    });
  }

  // Also listen for daily.digest
  eventBus.on('daily.digest', (payload) => {
    handleDomainEvent('daily.digest', payload, ioInstance);
  });

  logger.info('Domain event listeners initialized and attached to Notification service');
}
