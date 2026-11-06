import mongoose from 'mongoose';
import { Department } from '../departments/model.js';
import {
  DEPARTMENTS,
  JOB_ROLES,
  PROGRAMS,
  WORK_TYPES,
  WORK_TYPE_ALIASES,
  WORK_TYPE_DEPARTMENT_MAP,
  PRIORITIES,
  BLOCKER_REASONS,
  BLOCKER_DEPENDENCY_REASONS,
  CANONICAL_REVISION_ROOT_CAUSES,
  WORK_ITEM_STATUSES,
  WORKLOAD_BANDS,
} from '@mmp/shared';
import { logger } from '../../lib/logger.js';

export async function resolveProfileObjectId() {
  return null;
}

export async function getDepartments() {
  return Department.find({ isActive: true }).sort({ name: 1 }).lean();
}

export async function getAllReferenceData() {
  const departments = await Department.find().sort({ name: 1 }).lean();

  return {
    departments: departments.length > 0 ? departments : DEPARTMENTS,
    jobRoles: JOB_ROLES,
    programs: PROGRAMS,
    workTypes: WORK_TYPES,
    workTypeAliases: WORK_TYPE_ALIASES,
    workTypeDepartmentMap: WORK_TYPE_DEPARTMENT_MAP,
    priorities: PRIORITIES,
    blockerReasons: BLOCKER_REASONS,
    blockerDependencyReasons: BLOCKER_DEPENDENCY_REASONS,
    revisionRootCauses: CANONICAL_REVISION_ROOT_CAUSES,
    workItemStatuses: WORK_ITEM_STATUSES,
    workloadBands: WORKLOAD_BANDS,
  };
}

/**
 * Idempotently seeds the 7 Departments
 */
export async function seedReferenceData() {
  const seededDepts = [];
  for (const dept of DEPARTMENTS) {
    const existing = await Department.findOne({
      $or: [{ code: dept.code }, { name: dept.name }],
    });
    if (!existing) {
      const created = await Department.create({
        name: dept.name,
        code: dept.code,
        type: dept.code,
        isActive: true,
      });
      seededDepts.push(created);
      logger.info({ department: dept.name }, 'Seeded Department');
    } else {
      if (!existing.code) {
        existing.code = dept.code;
        await existing.save();
      }
      seededDepts.push(existing);
    }
  }

  return { departments: seededDepts };
}
