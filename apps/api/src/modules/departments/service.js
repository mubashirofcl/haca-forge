import { Department } from './model.js';
import { Person } from '../people/model.js';
import { WorkItem } from '../workItems/model.js';

export async function listDepartments({ inUse = false } = {}) {
  const query = {};
  if (inUse) {
    // Filter dropdowns: only departments with real data (an active person or a work item).
    // Records stay in place, because assignment forms still need to offer every department.
    const [peopleDepts, workDepts] = await Promise.all([
      Person.distinct('departmentId', { status: 'active', departmentId: { $ne: null } }),
      WorkItem.distinct('departmentId', { departmentId: { $ne: null } }),
    ]);
    query._id = { $in: [...peopleDepts, ...workDepts] };
  }
  return Department.find(query).populate('lead', 'name email role').sort({ name: 1 }).lean();
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
