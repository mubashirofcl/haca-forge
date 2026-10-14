import { AuditLog } from './model.js';
import { logger } from '../../lib/logger.js';

export async function recordAuditLog({
  actor,
  actorEmail,
  action,
  entity,
  entityId,
  before,
  after,
  ip,
}) {
  try {
    const log = await AuditLog.create({
      actor: actor || null,
      actorEmail: actorEmail || 'system',
      action,
      entity,
      entityId: entityId ? String(entityId) : undefined,
      before: before ? JSON.parse(JSON.stringify(before)) : undefined,
      after: after ? JSON.parse(JSON.stringify(after)) : undefined,
      ip: ip || null,
      timestamp: new Date(),
    });
    return log;
  } catch (error) {
    logger.error({ err: error }, 'Failed to record audit log entry');
    // Non-fatal: do not crash caller if audit write fails
    return null;
  }
}

export async function listAuditLogs(query = {}) {
  const {
    actor,
    action,
    entity,
    entityId,
    startDate,
    endDate,
    page = 1,
    limit = 20,
  } = query;

  const filter = {};
  if (actor) filter.actor = actor;
  if (action) filter.action = action;
  if (entity) filter.entity = entity;
  if (entityId) filter.entityId = entityId;

  if (startDate || endDate) {
    filter.timestamp = {};
    if (startDate) filter.timestamp.$gte = new Date(startDate);
    if (endDate) filter.timestamp.$lte = new Date(endDate);
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('actor', 'name email role department')
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  return {
    logs,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  };
}
