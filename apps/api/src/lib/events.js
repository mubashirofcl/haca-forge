import { EventEmitter } from 'events';
import { logger } from './logger.js';

class DomainEventEmitter extends EventEmitter {
  constructor() {
    super();
    // Allow up to 50 listeners without Node.js MaxListenersExceeded warning
    this.setMaxListeners(50);
  }

  emit(eventName, payload) {
    logger.debug({ eventName, payloadSummary: payload ? { id: payload.id || payload._id, title: payload.title } : null }, `[DomainEvent] Emitting: ${eventName}`);
    return super.emit(eventName, payload);
  }
}

export const eventBus = new DomainEventEmitter();

export const EVENTS = {
  REQUEST_CREATED: 'request.created',
  REQUEST_DECIDED: 'request.decided',
  TASK_ASSIGNED: 'task.assigned',
  TASK_BLOCKED: 'task.blocked',
  TASK_COMPLETED: 'task.completed',
  STAGE_HANDOFF: 'stage.handoff',
  REVIEW_SUBMITTED: 'review.submitted',
  REVIEW_DECIDED: 'review.decided',
  CONTENT_PUBLISHED: 'content.published',
  COMMENT_CREATED: 'comment.created',
  COMMENT_MENTION: 'comment.mention',
  DEADLINE_APPROACHING: 'deadline.approaching',
  DEADLINE_OVERDUE: 'deadline.overdue',
  CAPACITY_GAP: 'capacity.gap',
  ACCESS_REQUESTED: 'access.requested',
};
