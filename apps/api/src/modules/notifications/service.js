import { Notification } from './model.js';
import { logger } from '../../lib/logger.js';

/**
 * Creates an in-app notification record and optionally dispatches via socket
 */
export async function createNotification({
  recipient,
  type,
  title,
  message,
  link,
  metadata,
  io,
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
 * Get notifications for a user with pagination
 */
export async function getUserNotifications(userId, { unreadOnly = false, page = 1, limit = 20 } = {}) {
  const query = { recipient: userId };
  if (unreadOnly) {
    query.read = false;
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [data, total, unreadCount] = await Promise.all([
    Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Notification.countDocuments(query),
    Notification.countDocuments({ recipient: userId, read: false }),
  ]);

  return {
    data,
    unreadCount,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)),
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
