import mongoose from 'mongoose';
import { TeamAssignment } from './model.js';
import { User } from '../users/model.js';
import { AuditLog } from '../audit/model.js';

/**
 * Assign a worker to a team lead
 */
export async function assignWorker(teamLeadId, workerId, actor, notes = '') {
  const [teamLead, worker] = await Promise.all([
    User.findById(teamLeadId),
    User.findById(workerId),
  ]);

  if (!teamLead) {
    const error = new Error('Team lead user not found');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }
  if (teamLead.role !== 'team_lead') {
    const error = new Error(`Target user has role '${teamLead.role}', expected 'team_lead'`);
    error.statusCode = 400;
    error.code = 'INVALID_LEAD_ROLE';
    throw error;
  }

  if (!worker) {
    const error = new Error('Worker user not found');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }
  if (worker.role !== 'worker') {
    const error = new Error(`Target user has role '${worker.role}', expected 'worker'`);
    error.statusCode = 400;
    error.code = 'INVALID_WORKER_ROLE';
    throw error;
  }

  // Check if active assignment already exists
  let assignment = await TeamAssignment.findOne({
    teamLeadId: teamLead._id,
    workerId: worker._id,
    active: true,
  });

  if (assignment) {
    return assignment.populate([
      { path: 'teamLeadId', select: 'name email avatar team teamId department' },
      { path: 'workerId', select: 'name email avatar skills capacity attendance team teamId' },
      { path: 'assignedBy', select: 'name email' },
    ]);
  }

  assignment = await TeamAssignment.create({
    teamLeadId: teamLead._id,
    workerId: worker._id,
    assignedBy: actor?._id || teamLead._id,
    active: true,
    assignedAt: new Date(),
    notes: notes || undefined,
  });

  // Audit log
  await AuditLog.create({
    actor: actor?._id,
    actorEmail: actor?.email || 'admin@system.local',
    action: 'team_assignment.created',
    entity: 'TeamAssignment',
    entityId: assignment._id.toString(),
    after: {
      teamLeadId: teamLead._id.toString(),
      workerId: worker._id.toString(),
      leadName: teamLead.name,
      workerName: worker.name,
    },
    timestamp: new Date(),
  });

  return assignment.populate([
    { path: 'teamLeadId', select: 'name email avatar team teamId department' },
    { path: 'workerId', select: 'name email avatar skills capacity attendance team teamId' },
    { path: 'assignedBy', select: 'name email' },
  ]);
}

/**
 * End an active worker-to-lead assignment
 */
export async function unassignWorker(teamLeadId, workerId, actor, reason = 'manual') {
  const assignment = await TeamAssignment.findOne({
    teamLeadId,
    workerId,
    active: true,
  });

  if (!assignment) {
    const error = new Error('Active team assignment not found between specified lead and worker');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  assignment.active = false;
  assignment.endedAt = new Date();
  assignment.endReason = reason;
  await assignment.save();

  // Audit log
  await AuditLog.create({
    actor: actor?._id,
    actorEmail: actor?.email || 'admin@system.local',
    action: 'team_assignment.ended',
    entity: 'TeamAssignment',
    entityId: assignment._id.toString(),
    before: { active: true },
    after: { active: false, endReason: reason },
    timestamp: new Date(),
  });

  return assignment;
}

/**
 * Bulk assign workers to a lead
 */
export async function bulkAssign(teamLeadId, workerIds, actor, notes = '') {
  const results = [];
  for (const workerId of workerIds) {
    try {
      const assignment = await assignWorker(teamLeadId, workerId, actor, notes);
      results.push(assignment);
    } catch (err) {
      // Continue processing rest if individual assignment has an issue
      console.warn(`Failed to assign worker ${workerId} to lead ${teamLeadId}:`, err.message);
    }
  }
  return results;
}

/**
 * Bulk unassign workers from a lead
 */
export async function bulkUnassign(teamLeadId, workerIds, actor, reason = 'manual') {
  const updated = [];
  for (const workerId of workerIds) {
    try {
      const assignment = await unassignWorker(teamLeadId, workerId, actor, reason);
      if (assignment) updated.push(assignment);
    } catch (_err) {
      // ignore not founds in bulk unassign
    }
  }
  return updated;
}

/**
 * Get all active assignments for a given team lead
 */
export async function getAssignmentsForLead(teamLeadId, activeOnly = true) {
  const filter = { teamLeadId };
  if (activeOnly) {
    filter.active = true;
  }

  return TeamAssignment.find(filter)
    .populate('workerId', 'name email avatar skills capacity attendance team teamId')
    .populate('assignedBy', 'name email')
    .sort({ createdAt: -1 });
}

/**
 * Get all active assignments for a given worker
 */
export async function getLeadsForWorker(workerId, activeOnly = true) {
  const filter = { workerId };
  if (activeOnly) {
    filter.active = true;
  }

  return TeamAssignment.find(filter)
    .populate('teamLeadId', 'name email avatar team teamId department')
    .populate('assignedBy', 'name email')
    .sort({ createdAt: -1 });
}

/**
 * List all assignments with filtering and pagination
 */
export async function listAssignments({
  page = 1,
  limit = 50,
  activeOnly = true,
  teamLeadId,
  workerId,
} = {}) {
  const filter = {};
  if (activeOnly) filter.active = true;
  if (teamLeadId) filter.teamLeadId = teamLeadId;
  if (workerId) filter.workerId = workerId;

  const skip = (Math.max(1, page) - 1) * limit;

  const [data, total] = await Promise.all([
    TeamAssignment.find(filter)
      .populate('teamLeadId', 'name email avatar team teamId department')
      .populate('workerId', 'name email avatar skills capacity attendance team teamId')
      .populate('assignedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    TeamAssignment.countDocuments(filter),
  ]);

  return { data, total, page, limit };
}

/**
 * Return workers with zero active team lead assignments
 */
export async function getUnassignedWorkers() {
  const activeAssignedWorkerIds = await TeamAssignment.distinct('workerId', { active: true });
  return User.find({
    role: 'worker',
    status: 'active',
    _id: { $nin: activeAssignedWorkerIds },
  })
    .select('name email avatar team teamId skills capacity attendance')
    .sort({ name: 1 });
}

/**
 * Automatically soft-end all active assignments when a user changes role
 */
export async function deactivateAssignmentsForUser(userId, reason = 'role_changed', actor) {
  const activeAssignments = await TeamAssignment.find({
    $or: [{ workerId: userId }, { teamLeadId: userId }],
    active: true,
  });

  const now = new Date();
  for (const assignment of activeAssignments) {
    assignment.active = false;
    assignment.endedAt = now;
    assignment.endReason = reason;
    await assignment.save();

    await AuditLog.create({
      actor: actor?._id || userId,
      actorEmail: actor?.email || 'system@hacaforge.local',
      action: 'team_assignment.ended',
      entity: 'TeamAssignment',
      entityId: assignment._id.toString(),
      before: { active: true },
      after: { active: false, endReason: reason },
      timestamp: now,
    });
  }

  return activeAssignments.length;
}
