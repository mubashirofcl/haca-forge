import { Profile } from './profile.model.js';
import { Department } from '../departments/model.js';
import {
  PROFILES,
  DEPARTMENTS,
  JOB_ROLES,
  PROGRAMS,
  WORK_TYPES,
  WORK_TYPE_DEPARTMENT_MAP,
  PRIORITIES,
  CAMPAIGN_STATUSES,
  GOAL_TYPES,
  EXPECTED_OUTCOMES,
  BLOCKER_REASONS,
  BLOCKER_DEPENDENCY_REASONS,
  REVISION_ROOT_CAUSES,
  LEAD_SOURCES,
  FUNNEL_STAGES,
  WORK_ITEM_STATUSES,
  WORKLOAD_BANDS,
} from '@mmp/shared';
import { logger } from '../../lib/logger.js';

export async function getProfiles() {
  return Profile.find({ active: true }).sort({ name: 1 }).lean();
}

export async function getDepartments() {
  return Department.find({ isActive: true }).sort({ name: 1 }).lean();
}

export async function getAllReferenceData() {
  const [profiles, departments] = await Promise.all([
    Profile.find().sort({ name: 1 }).lean(),
    Department.find().sort({ name: 1 }).lean(),
  ]);

  return {
    profiles: profiles.length > 0 ? profiles : PROFILES,
    departments: departments.length > 0 ? departments : DEPARTMENTS,
    jobRoles: JOB_ROLES,
    programs: PROGRAMS,
    workTypes: WORK_TYPES,
    workTypeDepartmentMap: WORK_TYPE_DEPARTMENT_MAP,
    priorities: PRIORITIES,
    campaignStatuses: CAMPAIGN_STATUSES,
    goalTypes: GOAL_TYPES,
    expectedOutcomes: EXPECTED_OUTCOMES,
    blockerReasons: BLOCKER_REASONS,
    blockerDependencyReasons: BLOCKER_DEPENDENCY_REASONS,
    revisionRootCauses: REVISION_ROOT_CAUSES,
    leadSources: LEAD_SOURCES,
    funnelStages: FUNNEL_STAGES,
    workItemStatuses: WORK_ITEM_STATUSES,
    workloadBands: WORKLOAD_BANDS,
  };
}

/**
 * Idempotently seeds the 7 Profiles and 7 Departments
 */
export async function seedReferenceData() {
  const seededProfiles = [];
  for (const prof of PROFILES) {
    const existing = await Profile.findOne({ code: prof.code });
    if (!existing) {
      const created = await Profile.create({
        name: prof.name,
        code: prof.code,
        active: true,
      });
      seededProfiles.push(created);
      logger.info({ profile: prof.name }, 'Seeded Profile');
    } else {
      seededProfiles.push(existing);
    }
  }

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

  return { profiles: seededProfiles, departments: seededDepts };
}
