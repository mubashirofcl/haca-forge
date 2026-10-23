import mongoose from 'mongoose';
import { Profile } from './profile.model.js';
import { Department } from '../departments/model.js';
import {
  PROFILES,
  DEPARTMENTS,
  JOB_ROLES,
  PROGRAMS,
  WORK_TYPES,
  WORK_TYPE_ALIASES,
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

export async function resolveProfileObjectId(rawProfile) {
  if (!rawProfile) return null;
  if (rawProfile instanceof mongoose.Types.ObjectId) return rawProfile;

  const str = String(rawProfile).trim();
  if (!str || str === 'all' || str === 'null' || str === 'undefined' || str === 'org-wide') return null;

  if (mongoose.Types.ObjectId.isValid(str) && /^[0-9a-fA-F]{24}$/.test(str)) {
    const found = await Profile.findById(str).select('_id');
    if (found) return found._id;
  }

  const escaped = str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const profDoc = await Profile.findOne({
    $or: [
      { code: str.toLowerCase() },
      { name: str },
      { code: new RegExp(`^${escaped}$`, 'i') },
      { name: new RegExp(`^${escaped}$`, 'i') },
    ],
  }).select('_id');

  return profDoc ? profDoc._id : null;
}

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
    workTypeAliases: WORK_TYPE_ALIASES,
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
