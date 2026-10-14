import {
  Platform,
  Priority,
  HoldReason,
  ContentFormat,
  RequestType,
  Settings,
} from './models.js';
import { recordAuditLog } from '../audit/service.js';

// ==========================================
// 1. Platforms
// ==========================================

export async function listPlatforms(activeOnly = false) {
  const query = activeOnly ? { isActive: true } : {};
  return Platform.find(query).sort({ name: 1 }).lean();
}

export async function createPlatform(data, actor) {
  const platform = await Platform.create(data);
  await recordAuditLog({
    actor: actor?._id,
    actorEmail: actor?.email,
    action: 'platform.create',
    entity: 'Platform',
    entityId: platform._id,
    after: platform.toObject(),
  });
  return platform;
}

export async function updatePlatform(id, updates, actor) {
  const before = await Platform.findById(id).lean();
  if (!before) return null;
  const after = await Platform.findByIdAndUpdate(id, updates, { new: true }).lean();
  await recordAuditLog({
    actor: actor?._id,
    actorEmail: actor?.email,
    action: 'platform.update',
    entity: 'Platform',
    entityId: id,
    before,
    after,
  });
  return after;
}

export async function deletePlatform(id, actor) {
  const before = await Platform.findById(id).lean();
  if (!before) return false;
  await Platform.findByIdAndDelete(id);
  await recordAuditLog({
    actor: actor?._id,
    actorEmail: actor?.email,
    action: 'platform.delete',
    entity: 'Platform',
    entityId: id,
    before,
  });
  return true;
}

// ==========================================
// 2. Priorities
// ==========================================

export async function listPriorities(activeOnly = false) {
  const query = activeOnly ? { isActive: true } : {};
  return Priority.find(query).sort({ level: 1 }).lean();
}

export async function createPriority(data, actor) {
  const priority = await Priority.create(data);
  await recordAuditLog({
    actor: actor?._id,
    actorEmail: actor?.email,
    action: 'priority.create',
    entity: 'Priority',
    entityId: priority._id,
    after: priority.toObject(),
  });
  return priority;
}

export async function updatePriority(id, updates, actor) {
  const before = await Priority.findById(id).lean();
  if (!before) return null;
  const after = await Priority.findByIdAndUpdate(id, updates, { new: true }).lean();
  await recordAuditLog({
    actor: actor?._id,
    actorEmail: actor?.email,
    action: 'priority.update',
    entity: 'Priority',
    entityId: id,
    before,
    after,
  });
  return after;
}

export async function deletePriority(id, actor) {
  const before = await Priority.findById(id).lean();
  if (!before) return false;
  await Priority.findByIdAndDelete(id);
  await recordAuditLog({
    actor: actor?._id,
    actorEmail: actor?.email,
    action: 'priority.delete',
    entity: 'Priority',
    entityId: id,
    before,
  });
  return true;
}

// ==========================================
// 3. Hold Reasons
// ==========================================

export async function listHoldReasons(activeOnly = false) {
  const query = activeOnly ? { isActive: true } : {};
  return HoldReason.find(query).sort({ code: 1 }).lean();
}

export async function createHoldReason(data, actor) {
  const holdReason = await HoldReason.create(data);
  await recordAuditLog({
    actor: actor?._id,
    actorEmail: actor?.email,
    action: 'hold_reason.create',
    entity: 'HoldReason',
    entityId: holdReason._id,
    after: holdReason.toObject(),
  });
  return holdReason;
}

export async function updateHoldReason(id, updates, actor) {
  const before = await HoldReason.findById(id).lean();
  if (!before) return null;
  const after = await HoldReason.findByIdAndUpdate(id, updates, { new: true }).lean();
  await recordAuditLog({
    actor: actor?._id,
    actorEmail: actor?.email,
    action: 'hold_reason.update',
    entity: 'HoldReason',
    entityId: id,
    before,
    after,
  });
  return after;
}

export async function deleteHoldReason(id, actor) {
  const before = await HoldReason.findById(id).lean();
  if (!before) return false;
  await HoldReason.findByIdAndDelete(id);
  await recordAuditLog({
    actor: actor?._id,
    actorEmail: actor?.email,
    action: 'hold_reason.delete',
    entity: 'HoldReason',
    entityId: id,
    before,
  });
  return true;
}

// ==========================================
// 4. Content Formats
// ==========================================

export async function listContentFormats(activeOnly = false) {
  const query = activeOnly ? { isActive: true } : {};
  return ContentFormat.find(query).sort({ name: 1 }).lean();
}

export async function createContentFormat(data, actor) {
  const format = await ContentFormat.create(data);
  await recordAuditLog({
    actor: actor?._id,
    actorEmail: actor?.email,
    action: 'content_format.create',
    entity: 'ContentFormat',
    entityId: format._id,
    after: format.toObject(),
  });
  return format;
}

export async function updateContentFormat(id, updates, actor) {
  const before = await ContentFormat.findById(id).lean();
  if (!before) return null;
  const after = await ContentFormat.findByIdAndUpdate(id, updates, { new: true }).lean();
  await recordAuditLog({
    actor: actor?._id,
    actorEmail: actor?.email,
    action: 'content_format.update',
    entity: 'ContentFormat',
    entityId: id,
    before,
    after,
  });
  return after;
}

export async function deleteContentFormat(id, actor) {
  const before = await ContentFormat.findById(id).lean();
  if (!before) return false;
  await ContentFormat.findByIdAndDelete(id);
  await recordAuditLog({
    actor: actor?._id,
    actorEmail: actor?.email,
    action: 'content_format.delete',
    entity: 'ContentFormat',
    entityId: id,
    before,
  });
  return true;
}

// ==========================================
// 5. Request Types with Dynamic Field Schema
// ==========================================

export async function listRequestTypes(filter = {}) {
  const query = {};
  if (filter.departmentType) query.departmentType = filter.departmentType;
  if (filter.activeOnly) query.isActive = true;

  return RequestType.find(query).sort({ name: 1 }).lean();
}

export async function getRequestTypeById(id) {
  return RequestType.findById(id).lean();
}

export async function createRequestType(data, actor) {
  const requestType = await RequestType.create(data);
  await recordAuditLog({
    actor: actor?._id,
    actorEmail: actor?.email,
    action: 'request_type.create',
    entity: 'RequestType',
    entityId: requestType._id,
    after: requestType.toObject(),
  });
  return requestType;
}

export async function updateRequestType(id, updates, actor) {
  const before = await RequestType.findById(id).lean();
  if (!before) return null;
  const after = await RequestType.findByIdAndUpdate(id, updates, { new: true }).lean();
  await recordAuditLog({
    actor: actor?._id,
    actorEmail: actor?.email,
    action: 'request_type.update',
    entity: 'RequestType',
    entityId: id,
    before,
    after,
  });
  return after;
}

export async function deleteRequestType(id, actor) {
  const before = await RequestType.findById(id).lean();
  if (!before) return false;
  await RequestType.findByIdAndDelete(id);
  await recordAuditLog({
    actor: actor?._id,
    actorEmail: actor?.email,
    action: 'request_type.delete',
    entity: 'RequestType',
    entityId: id,
    before,
  });
  return true;
}

// ==========================================
// 6. Settings
// ==========================================

export async function getSettings() {
  let settings = await Settings.findOne().lean();
  if (!settings) {
    settings = await Settings.create({});
  }
  return settings;
}

export async function updateSettings(updates, actor) {
  let before = await Settings.findOne().lean();
  let after;
  if (!before) {
    after = await Settings.create(updates);
  } else {
    after = await Settings.findByIdAndUpdate(before._id, updates, { new: true }).lean();
  }

  await recordAuditLog({
    actor: actor?._id,
    actorEmail: actor?.email,
    action: 'settings.update',
    entity: 'Settings',
    entityId: after._id,
    before,
    after,
  });

  return after;
}
