import { ActivityEvent } from './model.js';
import { logger } from '../../lib/logger.js';

export async function logActivity({
  entityType,
  entityId,
  actor,
  action,
  fromStatus,
  toStatus,
  metadata = {},
}) {
  try {
    const actorId = actor?._id || actor?.id || actor?.userId;
    const actingAs = actor?.role === 'admin' ? 'admin' : undefined;

    const event = await ActivityEvent.create({
      entityType,
      entityId,
      actorId,
      actingAs,
      action,
      fromStatus,
      toStatus,
      metadata,
      timestamp: new Date(),
    });

    return event;
  } catch (err) {
    logger.error({ err: err.message, action, entityType, entityId }, 'Failed to record ActivityEvent');
    // Non-blocking error for main workflow
    return null;
  }
}

export async function listRecentActivities({ entityType, entityId, limit = 50 }) {
  const query = {};
  if (entityType) query.entityType = entityType;
  if (entityId) query.entityId = entityId;

  return ActivityEvent.find(query)
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('actorId', 'name email role')
    .lean();
}
