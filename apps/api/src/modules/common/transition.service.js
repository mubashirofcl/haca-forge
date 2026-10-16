import { StatusHistory } from '../statusHistory/model.js';
import { AuditLog } from '../audit/model.js';
import { logger } from '../../lib/logger.js';

// State machine definition for Requests
const REQUEST_VALID_TRANSITIONS = {
  null: ['draft', 'submitted'],
  draft: ['submitted', 'cancelled'],
  submitted: ['under_triage', 'accepted', 'rejected', 'needs_info', 'cancelled'],
  under_triage: ['accepted', 'rejected', 'needs_info', 'cancelled'],
  needs_info: ['submitted', 'cancelled'],
  rejected: ['submitted', 'cancelled'],
  accepted: ['converted', 'cancelled'],
  converted: [],
  cancelled: [],
};

// State machine definition for ContentItems
const CONTENT_VALID_TRANSITIONS = {
  null: ['planned', 'brief_ready', 'in_production'],
  planned: ['brief_ready', 'in_production', 'on_hold'],
  brief_ready: ['in_production', 'on_hold'],
  in_production: ['in_review', 'approved', 'scheduled', 'live', 'on_hold'],
  in_review: ['changes_requested', 'approved', 'scheduled', 'live', 'on_hold'],
  changes_requested: ['in_production', 'in_review', 'approved', 'scheduled', 'on_hold'],
  approved: ['scheduled', 'published', 'live', 'on_hold'],
  scheduled: ['published', 'live', 'on_hold'],
  published: ['live', 'retired'],
  live: ['paused', 'retired'],
  paused: ['live', 'retired'],
  retired: [],
  on_hold: ['planned', 'brief_ready', 'in_production', 'in_review', 'approved', 'scheduled'],
};

// State machine definition for Tasks
const TASK_VALID_TRANSITIONS = {
  null: ['assigned', 'in_progress'],
  assigned: ['in_progress', 'submitted', 'done', 'blocked', 'on_hold'],
  in_progress: ['submitted', 'done', 'approved', 'blocked', 'on_hold'],
  submitted: ['changes_requested', 'approved', 'done', 'blocked', 'on_hold'],
  changes_requested: ['in_progress', 'submitted', 'blocked', 'on_hold'],
  approved: ['done'],
  done: [],
  blocked: ['in_progress', 'assigned'],
  on_hold: ['in_progress', 'assigned'],
};

// State machine definition for Deliverables
const DELIVERABLE_VALID_TRANSITIONS = {
  null: ['submitted'],
  submitted: ['approved', 'changes_requested', 'rejected'],
  changes_requested: ['submitted'],
  approved: [],
  rejected: ['submitted'],
};

/**
 * Universal State Machine Transition Service
 * Validates transition rules, checks required hold reason codes, persists StatusHistory,
 * updates the entity status, and logs an audit entry.
 *
 * @param {Object} params
 * @param {'Request'|'ContentItem'|'Task'} params.entityType - Model type
 * @param {Object} params.entity - Mongoose document
 * @param {string} params.toStatus - Target status
 * @param {Object} params.user - Current authenticated user document
 * @param {string} [params.reason] - Explanation / rejection / needs_info reason
 * @param {string} [params.reasonCode] - Required for 'on_hold' or 'blocked'
 * @param {string} [params.comment] - Optional transition note
 * @param {Object} [params.io] - Socket.io instance for real-time broadcast
 * @returns {Promise<Object>} Updated entity and status history entry
 */
export async function transitionStatus({
  entityType,
  entity,
  toStatus,
  user,
  reason,
  reasonCode,
  comment,
  io,
}) {
  const fromStatus = entity.status || null;

  // If already at target status (initial record or idempotent update)
  if (fromStatus === toStatus) {
    const historyEntry = await StatusHistory.create({
      entityType,
      entityId: entity._id,
      fromStatus: null,
      toStatus,
      changedBy: user?._id || user?.id,
      reason: reason || null,
      reasonCode: reasonCode || null,
      comment: comment || null,
      timestamp: new Date(),
    });
    return { entity, historyEntry };
  }

  // 1. Validate state machine transitions
  if (entityType === 'Request') {
    const allowed = REQUEST_VALID_TRANSITIONS[fromStatus] || [];
    if (!allowed.includes(toStatus)) {
      const err = new Error(
        `Invalid status transition for Request ${entity.requestId || entity._id}: cannot move from '${fromStatus}' to '${toStatus}'.`
      );
      err.statusCode = 400;
      err.code = 'INVALID_STATUS_TRANSITION';
      throw err;
    }
  } else if (entityType === 'ContentItem') {
    const allowed = CONTENT_VALID_TRANSITIONS[fromStatus] || [];
    if (!allowed.includes(toStatus)) {
      const err = new Error(
        `Invalid status transition for ContentItem ${entity.contentId || entity._id}: cannot move from '${fromStatus}' to '${toStatus}'.`
      );
      err.statusCode = 400;
      err.code = 'INVALID_STATUS_TRANSITION';
      throw err;
    }
  } else if (entityType === 'Task') {
    const allowed = TASK_VALID_TRANSITIONS[fromStatus] || [];
    if (!allowed.includes(toStatus)) {
      const err = new Error(
        `Invalid status transition for Task ${entity.taskId || entity._id}: cannot move from '${fromStatus}' to '${toStatus}'.`
      );
      err.statusCode = 400;
      err.code = 'INVALID_STATUS_TRANSITION';
      throw err;
    }
  } else if (entityType === 'Deliverable') {
    const allowed = DELIVERABLE_VALID_TRANSITIONS[fromStatus] || [];
    if (!allowed.includes(toStatus)) {
      const err = new Error(
        `Invalid status transition for Deliverable ${entity._id}: cannot move from '${fromStatus}' to '${toStatus}'.`
      );
      err.statusCode = 400;
      err.code = 'INVALID_STATUS_TRANSITION';
      throw err;
    }
  }

  // 2. Validate reasonCode when moving to on_hold or blocked
  if (['on_hold', 'blocked'].includes(toStatus) && !reasonCode) {
    const err = new Error(
      `Transitioning to '${toStatus}' strictly requires a valid reasonCode.`
    );
    err.statusCode = 400;
    err.code = 'REASON_CODE_REQUIRED';
    throw err;
  }

  // 3. Create StatusHistory record
  const historyEntry = await StatusHistory.create({
    entityType,
    entityId: entity._id,
    fromStatus,
    toStatus,
    changedBy: user?._id || user?.id,
    reason: reason || null,
    reasonCode: reasonCode || null,
    comment: comment || null,
    timestamp: new Date(),
  });

  // 4. Update the entity status
  entity.status = toStatus;

  // Apply triage metadata if it's a request
  if (entityType === 'Request') {
    if (['accepted', 'rejected', 'needs_info'].includes(toStatus)) {
      entity.triage = {
        decision: toStatus,
        reason: reason || comment || '',
        decidedBy: user?._id || user?.id,
        decidedAt: new Date(),
      };
    }
  }

  await entity.save();

  // 5. Create AuditLog entry for traceability
  try {
    await AuditLog.create({
      actor: user?._id || user?.id,
      actorEmail: user?.email || 'system',
      action: `STATUS_CHANGE_${toStatus.toUpperCase()}`,
      entity: entityType,
      entityId: String(entity._id),
      before: { status: fromStatus },
      after: {
        status: toStatus,
        reason: reason || undefined,
        reasonCode: reasonCode || undefined,
      },
      timestamp: new Date(),
    });
  } catch (auditErr) {
    logger.warn({ err: auditErr.message }, 'Failed to record audit log for status transition');
  }

  // 6. Real-time Socket.io notification
  if (io) {
    try {
      io.emit('status_change', {
        entityType,
        entityId: entity._id,
        requestId: entity.requestId,
        fromStatus,
        toStatus,
        changedBy: {
          _id: user?._id || user?.id,
          name: user?.name,
          email: user?.email,
        },
        timestamp: historyEntry.timestamp,
      });

      // Also notify personal requester room if applicable
      if (entity.requester) {
        const requesterId = entity.requester._id || entity.requester;
        io.to(`user:${requesterId}`).emit('request:updated', {
          requestId: entity.requestId,
          status: toStatus,
          title: entity.title,
        });
      }
    } catch (sockErr) {
      logger.warn({ err: sockErr.message }, 'Socket broadcast warning in transitionStatus');
    }
  }

  return { entity, historyEntry };
}
