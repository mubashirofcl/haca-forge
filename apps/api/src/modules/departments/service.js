import { Department } from './model.js';

export async function listDepartments() {
  return Department.find().populate('lead', 'name email role').sort({ name: 1 }).lean();
}

export async function getDepartmentById(id) {
  return Department.findById(id).populate('lead', 'name email role').lean();
}

export async function createDepartment(data) {
  return Department.create(data);
}

export async function updateDepartment(id, updates) {
  return Department.findByIdAndUpdate(id, updates, { new: true }).lean();
}

export async function deleteDepartment(id) {
  const before = await Department.findById(id).lean();
  if (!before) return false;

  await Department.findByIdAndDelete(id);
  return true;
}
