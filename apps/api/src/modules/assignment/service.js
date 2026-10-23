import mongoose from 'mongoose';
import { AssignmentOverride } from './model.js';
import { Person } from '../people/model.js';
import { Department } from '../departments/model.js';
import { WorkItem } from '../workItems/model.js';
import { resolveScope } from '../../lib/scope.js';
import { logActivity } from '../activity/service.js';
import { WORK_TYPE_DEPARTMENT_MAP } from '@mmp/shared';
import { resolveProfileObjectId } from '../referenceData/service.js';

/**
 * Calculate member workload metrics and capacity bands
 * Healthy: < 65% | High: 65% - 85% | Overloaded: > 85%
 */
export async function calculateMemberWorkloadMetrics(personId, personDoc = null) {
  const person = personDoc || (await Person.findById(personId));
  if (!person) {
    const error = new Error('Person not found');
    error.statusCode = 404;
    throw error;
  }

  const capacity = person.weeklyCapacityHours || person.capacity || 40;

  // Open work items (status not Approved or Published)
  const openItems = await WorkItem.find({
    ownerId: person._id,
    status: { $nin: ['Approved', 'Published'] },
  })
    .populate('campaignId', 'name relatedOKR')
    .populate('profileId', 'name code')
    .sort({ deadline: 1 });

  const allocatedHours = openItems.reduce((acc, it) => acc + (it.estimatedEffortHrs || 4), 0);
  const workloadPct = capacity > 0 ? Math.round((allocatedHours / capacity) * 100) : 0;

  let capacityBand = 'Healthy';
  if (workloadPct > 85) {
    capacityBand = 'Overloaded';
  } else if (workloadPct >= 65) {
    capacityBand = 'High';
  }

  // Rolling 90-day average revisions calculation from completed items
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const completedRecentItems = await WorkItem.find({
    ownerId: person._id,
    status: { $in: ['Approved', 'Published'] },
    updatedAt: { $gte: ninetyDaysAgo },
  }).select('revisions');

  let avgRevisions = 1.0;
  if (completedRecentItems.length > 0) {
    const totalRevs = completedRecentItems.reduce((sum, item) => sum + (item.revisions || 0), 0);
    avgRevisions = Number((totalRevs / completedRecentItems.length).toFixed(1));
  }

  const availableHours = Math.max(0, capacity - allocatedHours);

  return {
    person: {
      _id: person._id,
      name: person.name,
      email: person.email,
      role: person.role,
      jobRole: person.jobRole,
      departmentId: person.departmentId,
      weeklyCapacityHours: capacity,
    },
    capacity,
    allocatedHours,
    availableHours,
    workloadPct,
    capacityBand,
    avgRevisions,
    activeItemsCount: openItems.length,
    activeWorkItems: openItems,
  };
}

/**
 * Auto-Assignment Recommendation Engine
 * Recommends optimal assignee based on department, workload percentage, rolling revisions, and bandwidth.
 * Never assigns silently. Returns human-readable explainable rationale.
 */
export async function recommendAssignee(criteria = {}, user) {
  const {
    workType,
    profileId,
    departmentId,
    deadline,
    estimatedEffortHrs = 4,
    stageKey,
    workItemId,
  } = criteria;

  let effectiveStageKey = stageKey || null;
  let rawProfileId = profileId || null;

  // Infer stageKey and brand profileId from existing work item if provided
  if (workItemId && mongoose.Types.ObjectId.isValid(workItemId)) {
    const item = await WorkItem.findById(workItemId);
    if (item) {
      if (!effectiveStageKey && item.stageKey) {
        effectiveStageKey = item.stageKey;
      }
      if (!rawProfileId && item.profileId) {
        rawProfileId = item.profileId;
      }
    }
  }

  // Resolve target brand profile
  let targetProfileId = null;
  if (rawProfileId) {
    targetProfileId = await resolveProfileObjectId(rawProfileId);
  }

  let candidates = [];
  let targetDepartment = null;

  if (effectiveStageKey) {
    // ------------------------------------------------------------------------
    // CONTENT FLOW DELTA: Stage Work Items
    // Candidates come from Person.workPreferences plus brand access
    // instead of the department table.
    // ------------------------------------------------------------------------
    const stageQuery = {
      status: 'active',
      role: { $nin: ['admin', 'executive'] },
      workPreferences: effectiveStageKey,
    };

    if (targetProfileId) {
      stageQuery.profileAccess = targetProfileId;
    }

    candidates = await Person.find(stageQuery);

    // If no candidate with this stage preference has explicit brand access,
    // fallback to any active team member with this stage preference
    if (candidates.length === 0 && targetProfileId) {
      candidates = await Person.find({
        status: 'active',
        role: { $nin: ['admin', 'executive'] },
        workPreferences: effectiveStageKey,
      });
    }

    // Ultimate fallback if no member has configured this preference
    if (candidates.length === 0) {
      candidates = await Person.find({
        status: 'active',
        role: { $nin: ['admin', 'executive'] },
      });
    }
  } else {
    // ------------------------------------------------------------------------
    // STANDALONE WORK ITEMS: Keep the department rule
    // Candidates come from the target department responsible for workType
    // ------------------------------------------------------------------------
    if (departmentId && mongoose.Types.ObjectId.isValid(departmentId)) {
      targetDepartment = await Department.findById(departmentId);
    } else if (workType && WORK_TYPE_DEPARTMENT_MAP[workType]) {
      const deptCode = WORK_TYPE_DEPARTMENT_MAP[workType];
      targetDepartment = await Department.findOne({
        $or: [{ code: deptCode }, { name: new RegExp(`^${deptCode}$`, 'i') }],
      });
    }

    const deptQuery = {
      status: 'active',
      role: { $nin: ['admin', 'executive'] },
    };

    if (targetDepartment) {
      deptQuery.departmentId = targetDepartment._id;
    }

    if (targetProfileId) {
      deptQuery.profileAccess = targetProfileId;
    }

    candidates = await Person.find(deptQuery);

    if (candidates.length === 0 && targetProfileId) {
      candidates = await Person.find({
        status: 'active',
        role: { $nin: ['admin', 'executive'] },
        profileAccess: targetProfileId,
      });
    }

    if (candidates.length === 0) {
      candidates = await Person.find({
        status: 'active',
        role: { $nin: ['admin', 'executive'] },
      });
    }
  }

  if (candidates.length === 0) {
    return {
      recommendedPerson: null,
      rationale: effectiveStageKey
        ? `No active team members available with "${effectiveStageKey}" work preference.`
        : 'No active team members available for assignment.',
      stageKey: effectiveStageKey,
      department: targetDepartment,
      candidatePool: [],
      isOverloadWarning: false,
    };
  }

  // 3. Compute Metrics for each candidate
  const candidatePool = [];
  for (const candidate of candidates) {
    const metrics = await calculateMemberWorkloadMetrics(candidate._id, candidate);

    // Can fit test
    const newWorkloadPct = Math.round(((metrics.allocatedHours + estimatedEffortHrs) / metrics.capacity) * 100);
    const canAccommodate = metrics.availableHours >= estimatedEffortHrs;

    candidatePool.push({
      ...metrics,
      newWorkloadPct,
      canAccommodate,
    });
  }

  // 4. Rank Candidates
  // Order:
  // a) Non-overloaded first (workloadPct <= 85%)
  // b) Lowest workload percentage
  // c) Lowest avgRevisions
  // d) Earliest availability / highest available hours
  candidatePool.sort((a, b) => {
    const aOverloaded = a.workloadPct > 85;
    const bOverloaded = b.workloadPct > 85;

    if (!aOverloaded && bOverloaded) return -1;
    if (aOverloaded && !bOverloaded) return 1;

    // Prefer creative team members over management/leads
    const aIsMember = a.person.role === 'team_member';
    const bIsMember = b.person.role === 'team_member';
    if (aIsMember && !bIsMember) return -1;
    if (!aIsMember && bIsMember) return 1;

    if (a.workloadPct !== b.workloadPct) {
      return a.workloadPct - b.workloadPct;
    }

    if (a.avgRevisions !== b.avgRevisions) {
      return a.avgRevisions - b.avgRevisions;
    }

    return b.availableHours - a.availableHours;
  });

  const bestCandidate = candidatePool[0];
  const deptLabel = targetDepartment ? targetDepartment.name : 'Marketing Operations';

  // 5. Generate Explainable Rationale
  let rationale = '';
  const isOverloadWarning = bestCandidate.workloadPct > 85;

  if (effectiveStageKey) {
    if (isOverloadWarning) {
      rationale = `Recommended Owner: ${bestCandidate.person.name} (Capacity Warning: ${bestCandidate.workloadPct}% current workload). All candidates with "${effectiveStageKey}" work preference exceed healthy bandwidth.`;
    } else {
      rationale = `Recommended Owner: ${bestCandidate.person.name}. Reason: matched work preference "${effectiveStageKey}" + brand access + lowest current workload (${bestCandidate.workloadPct}%) + ${bestCandidate.availableHours}h available bandwidth (avg ${bestCandidate.avgRevisions} revs).`;
    }
  } else {
    if (isOverloadWarning) {
      rationale = `Recommended Owner: ${bestCandidate.person.name} (Capacity Warning: ${bestCandidate.workloadPct}% current workload). All candidates in ${deptLabel} exceed healthy bandwidth.`;
    } else {
      rationale = `Recommended Owner: ${bestCandidate.person.name}. Reason: lowest current workload (${bestCandidate.workloadPct}%) + suitable skill in ${deptLabel} + ${bestCandidate.availableHours}h available bandwidth (avg ${bestCandidate.avgRevisions} revs).`;
    }
  }

  return {
    recommendedPerson: bestCandidate.person,
    recommendedMetrics: {
      workloadPct: bestCandidate.workloadPct,
      capacityBand: bestCandidate.capacityBand,
      avgRevisions: bestCandidate.avgRevisions,
      allocatedHours: bestCandidate.allocatedHours,
      availableHours: bestCandidate.availableHours,
      newWorkloadPct: bestCandidate.newWorkloadPct,
    },
    rationale,
    stageKey: effectiveStageKey,
    department: targetDepartment,
    candidatePool,
    isOverloadWarning,
  };
}

/**
 * Record an Assignment Override when a lead/admin departs from auto-assignment recommendation
 */
export async function recordAssignmentOverride(data, user) {
  const { workItemId, recommendedPersonId, chosenPersonId, reason, metadata = {} } = data;

  const workItem = await WorkItem.findById(workItemId);
  if (!workItem) {
    const error = new Error('Work item not found');
    error.statusCode = 404;
    throw error;
  }

  const [recommendedPerson, chosenPerson] = await Promise.all([
    Person.findById(recommendedPersonId),
    Person.findById(chosenPersonId),
  ]);

  if (!recommendedPerson || !chosenPerson) {
    const error = new Error('Recommended or chosen person not found');
    error.statusCode = 400;
    throw error;
  }

  const override = await AssignmentOverride.create({
    workItemId,
    recommendedPersonId,
    chosenPersonId,
    overriddenById: user._id || user.id,
    reason: reason.trim(),
    metadata: {
      ...metadata,
      workItemTitle: workItem.title,
      recommendedName: recommendedPerson.name,
      chosenName: chosenPerson.name,
    },
  });

  // Update workItem owner to chosen person
  workItem.ownerId = chosenPersonId;
  await workItem.save();

  // Audit activity
  await logActivity({
    entityType: 'work_item',
    entityId: workItem._id,
    profileId: workItem.profileId,
    actor: user,
    action: 'assignment.overridden',
    metadata: {
      fromPersonId: recommendedPersonId,
      fromPersonName: recommendedPerson.name,
      toPersonId: chosenPersonId,
      toPersonName: chosenPerson.name,
      reason: reason.trim(),
    },
  });

  return override;
}

/**
 * Team Workload Aggregator by Department and Capacity Bands
 * Serves Screen 9 (Team Workload)
 */
export async function getTeamWorkload(filters = {}, user) {
  const scope = await resolveScope(user, filters);

  const personQuery = {
    status: 'active',
    role: { $nin: ['admin', 'executive'] }, // Admin and Executive excluded from operational workload
  };

  if (!scope.canAccessAllProfiles) {
    personQuery.profileAccess = { $in: scope.allowedProfileIds };
  } else if (filters.profileId && filters.profileId !== 'all') {
    personQuery.profileAccess = filters.profileId;
  }

  if (filters.departmentId && filters.departmentId !== 'all') {
    personQuery.departmentId = filters.departmentId;
  }

  if (user.role === 'team_lead' && scope.allowedPersonIds) {
    personQuery._id = { $in: scope.allowedPersonIds };
  }

  const people = await Person.find(personQuery)
    .populate('departmentId', 'name code')
    .populate('profileAccess', 'name code')
    .sort({ name: 1 });

  // Calculate metrics for each person
  const memberMetrics = await Promise.all(
    people.map((p) => calculateMemberWorkloadMetrics(p._id, p))
  );

  // Group by Department
  const allDepartments = await Department.find({}).sort({ name: 1 });
  const deptMap = new Map();

  for (const d of allDepartments) {
    deptMap.set(d._id.toString(), {
      _id: d._id,
      name: d.name,
      code: d.code,
      totalMembers: 0,
      totalAllocatedHours: 0,
      totalCapacityHours: 0,
      avgWorkloadPct: 0,
      bandCounts: {
        healthy: 0,
        high: 0,
        overloaded: 0,
      },
      members: [],
    });
  }

  // Also handle unassigned department
  const unassignedDeptKey = 'unassigned';
  deptMap.set(unassignedDeptKey, {
    _id: 'unassigned',
    name: 'General / Unassigned',
    code: 'unassigned',
    totalMembers: 0,
    totalAllocatedHours: 0,
    totalCapacityHours: 0,
    avgWorkloadPct: 0,
    bandCounts: {
      healthy: 0,
      high: 0,
      overloaded: 0,
    },
    members: [],
  });

  let totalAllocatedOverall = 0;
  let totalCapacityOverall = 0;
  let overloadedOverall = 0;
  let totalOpenItemsOverall = 0;

  for (const m of memberMetrics) {
    const deptId = (m.person.departmentId?._id || m.person.departmentId)?.toString();
    const group = deptMap.get(deptId) || deptMap.get(unassignedDeptKey);

    group.totalMembers += 1;
    group.totalAllocatedHours += m.allocatedHours;
    group.totalCapacityHours += m.capacity;
    group.members.push(m);

    if (m.capacityBand === 'Healthy') group.bandCounts.healthy += 1;
    else if (m.capacityBand === 'High') group.bandCounts.high += 1;
    else if (m.capacityBand === 'Overloaded') group.bandCounts.overloaded += 1;

    totalAllocatedOverall += m.allocatedHours;
    totalCapacityOverall += m.capacity;
    if (m.capacityBand === 'Overloaded') overloadedOverall += 1;
    totalOpenItemsOverall += m.activeItemsCount;
  }

  // Calculate averages per department
  const departmentsResult = [];
  for (const group of deptMap.values()) {
    if (group.members.length > 0) {
      group.avgWorkloadPct =
        group.totalCapacityHours > 0
          ? Math.round((group.totalAllocatedHours / group.totalCapacityHours) * 100)
          : 0;
      // Sort members by workload descending
      group.members.sort((a, b) => b.workloadPct - a.workloadPct);
      departmentsResult.push(group);
    }
  }

  const overallAvgWorkload =
    totalCapacityOverall > 0 ? Math.round((totalAllocatedOverall / totalCapacityOverall) * 100) : 0;

  return {
    summary: {
      totalMembers: memberMetrics.length,
      totalCapacityHours: totalCapacityOverall,
      totalAllocatedHours: totalAllocatedOverall,
      availableCapacityHours: Math.max(0, totalCapacityOverall - totalAllocatedOverall),
      overallAvgWorkload,
      overloadedCount: overloadedOverall,
      totalOpenItems: totalOpenItemsOverall,
    },
    departments: departmentsResult,
  };
}

/**
 * List historical assignment overrides
 */
export async function listAssignmentOverrides(filters = {}, user) {
  const query = {};
  if (filters.workItemId) query.workItemId = filters.workItemId;

  return AssignmentOverride.find(query)
    .populate('workItemId', 'title workType deadline')
    .populate('recommendedPersonId', 'name email role jobRole')
    .populate('chosenPersonId', 'name email role jobRole')
    .populate('overriddenById', 'name email role')
    .sort({ createdAt: -1 })
    .limit(50);
}
