import { Department } from './model.js';
import { recordAuditLog } from '../audit/service.js';

export async function listDepartments() {
  return Department.find().populate('lead', 'name email role').sort({ name: 1 }).lean();
}

export async function getDepartmentById(id) {
  return Department.findById(id).populate('lead', 'name email role').lean();
}

export async function createDepartment(data, actor) {
  const department = await Department.create(data);
  await recordAuditLog({
    actor: actor?._id,
    actorEmail: actor?.email,
    action: 'department.create',
    entity: 'Department',
    entityId: department._id,
    after: department.toObject(),
  });
  return department;
}

export async function updateDepartment(id, updates, actor) {
  const before = await Department.findById(id).lean();
  if (!before) return null;

  const after = await Department.findByIdAndUpdate(id, updates, { new: true }).lean();
  await recordAuditLog({
    actor: actor?._id,
    actorEmail: actor?.email,
    action: 'department.update',
    entity: 'Department',
    entityId: id,
    before,
    after,
  });
  return after;
}

export async function deleteDepartment(id, actor) {
  const before = await Department.findById(id).lean();
  if (!before) return false;

  await Department.findByIdAndDelete(id);
  await recordAuditLog({
    actor: actor?._id,
    actorEmail: actor?.email,
    action: 'department.delete',
    entity: 'Department',
    entityId: id,
    before,
  });
  return true;
}
