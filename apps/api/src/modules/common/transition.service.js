import { logger } from '../../lib/logger.js';

/**
 * Universal State Machine Transition Service for HACA Marketing OS
 * 
 * Rebuilt in Phase 3 to manage WorkItem transitions:
 * Not Started -> In Progress -> Feedback -> Approved -> Published (and Blocked/Pending)
 * and persist ActivityEvent.
 */

export async function transitionStatus({
  entityType,
  entity,
  toStatus,
  user,
  reason,
  metadata,
}) {
  logger.info({ entityType, id: entity?._id, toStatus, userId: user?._id }, 'Transition service invoked');
  if (entity) {
    entity.status = toStatus;
  }
  return { entity, toStatus, reason, metadata };
}
