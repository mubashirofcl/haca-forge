import { Notification } from './model.js';
import { User } from '../people/model.js';
import { logger } from '../../lib/logger.js';
import { enqueueEmail } from '../../lib/queue.js';
import { eventBus, EVENTS } from '../../lib/events.js';

let ioInstance = null;

export function registerSocketIO(io) {
  ioInstance = io;
}

export function getSocketIO() {
  return ioInstance;
}

/**
 * Resolve notification category from event type
 */
export function resolveNotificationCategory(type = '') {
  const t = String(type).toLowerCase();
  if (t === 'security_alert') return 'security';
  if (t.includes('system') || t.includes('access')) return 'system';
  if (t.includes('chat')) return 'chat';
  if (t.includes('plan')) return 'planUpdates';
  if (t.includes('deadline') || t.includes('overdue')) return 'deadlinesOverdue';
  if (t.includes('comment') || t.includes('message') || t.includes('mention')) return 'messagesComments';
  if (t.includes('review') || t.includes('revision') || t.includes('approval') || t.includes('feedback')) return 'approvalsRevisions';
  if (t.includes('task') || t.includes('step') || t.includes('assign') || t.includes('handoff')) return 'mySteps';
  return 'mySteps';
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
    const category = resolveNotificationCategory(type);

    // Security notices cannot be turned off
    if (category !== 'security') {
      const recipientUser = await User.findById(recipient).select('notificationPrefs').lean();
      if (recipientUser?.notificationPrefs?.[category]?.inApp === false) {
        // In-app notifications for this category are disabled by user preference
        return null;
      }
    }

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
    query.type = type;
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
  return Notification.updateMany({ recipient: userId, read: false }, { read: true });
}

/**
 * Get unread notification count for badge
 */
export async function getUnreadCount(userId) {
  return Notification.countDocuments({ recipient: userId, read: false });
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
 * Maps domain events to recipients and dispatches in-app + email
 */
export async function handleDomainEvent(eventName, payload, io = ioInstance) {
  try {
    const recipients = new Set();
    let templateName = null;
    let templateContext = {};
    let notificationTitle = '';
    let notificationMessage = '';
    let link = '';
    let preferenceKey = 'accessRequests';

    switch (eventName) {
      case EVENTS.ACCESS_REQUESTED: {
        preferenceKey = 'accessRequests';
        const admins = await User.find({
          role: 'admin',
          status: 'active',
        }).select('_id email name notificationPreferences');

        for (const a of admins) recipients.add(a);
        notificationTitle = `New Access Request: ${payload.name || payload.email}`;
        notificationMessage = `${payload.name} (${payload.email}) requested access for department ${payload.department || 'Marketing'}`;
        link = '/admin/access-requests';
        break;
      }

      default:
        // Future Marketing OS domain events (blockers, revisions, escalations) handled in Phase 5 & 7
        return;
    }

    for (const recipient of recipients) {
      const prefs = recipient.notificationPreferences || {};
      const newPrefs = recipient.notificationPrefs || {};
      const inAppPrefs = prefs.inApp || {};
      const emailPrefs = prefs.email || {};

      // Check In-App preference (default true, security always allowed)
      const allowInApp =
        preferenceKey === 'security' ||
        (newPrefs[preferenceKey]?.inApp !== false && inAppPrefs[preferenceKey] !== false);
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

      // Check Email preference (default true, security always allowed)
      const allowEmail =
        preferenceKey === 'security' ||
        (newPrefs[preferenceKey]?.email !== false && emailPrefs[preferenceKey] !== false);
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

  logger.info('Domain event listeners initialized and attached to Notification service');
}
