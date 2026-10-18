import * as assignmentService from './service.js';
import { z } from 'zod';

const assignWorkerSchema = z.object({
  teamLeadId: z.string().min(1, 'teamLeadId is required'),
  workerId: z.string().min(1, 'workerId is required'),
  notes: z.string().optional(),
});

const unassignWorkerSchema = z.object({
  teamLeadId: z.string().min(1, 'teamLeadId is required'),
  workerId: z.string().min(1, 'workerId is required'),
  reason: z.enum(['reassigned', 'lead_changed', 'role_changed', 'manual', 'other']).optional(),
});

const bulkAssignSchema = z.object({
  teamLeadId: z.string().min(1, 'teamLeadId is required'),
  workerIds: z.array(z.string().min(1)).min(1, 'workerIds must contain at least one ID'),
  notes: z.string().optional(),
});

export async function createAssignment(req, res, next) {
  try {
    const validated = assignWorkerSchema.parse(req.body);
    const assignment = await assignmentService.assignWorker(
      validated.teamLeadId,
      validated.workerId,
      req.user,
      validated.notes
    );
    res.status(201).json({ success: true, assignment });
  } catch (error) {
    next(error);
  }
}

export async function removeAssignment(req, res, next) {
  try {
    const payload = req.method === 'DELETE' && Object.keys(req.body || {}).length > 0 ? req.body : req.query;
    const validated = unassignWorkerSchema.parse(payload);
    const assignment = await assignmentService.unassignWorker(
      validated.teamLeadId,
      validated.workerId,
      req.user,
      validated.reason || 'manual'
    );
    res.status(200).json({ success: true, assignment });
  } catch (error) {
    next(error);
  }
}

export async function bulkCreateAssignments(req, res, next) {
  try {
    const validated = bulkAssignSchema.parse(req.body);
    const assignments = await assignmentService.bulkAssign(
      validated.teamLeadId,
      validated.workerIds,
      req.user,
      validated.notes
    );
    res.status(201).json({ success: true, count: assignments.length, assignments });
  } catch (error) {
    next(error);
  }
}

export async function getAssignmentsForLead(req, res, next) {
  try {
    const leadId = req.params.leadId;
    const activeOnly = req.query.activeOnly !== 'false';
    const assignments = await assignmentService.getAssignmentsForLead(leadId, activeOnly);
    res.status(200).json({ success: true, assignments });
  } catch (error) {
    next(error);
  }
}

export async function getLeadsForWorker(req, res, next) {
  try {
    const workerId = req.params.workerId;
    const activeOnly = req.query.activeOnly !== 'false';
    const leads = await assignmentService.getLeadsForWorker(workerId, activeOnly);
    res.status(200).json({ success: true, leads });
  } catch (error) {
    next(error);
  }
}

export async function getUnassignedWorkers(req, res, next) {
  try {
    const unassigned = await assignmentService.getUnassignedWorkers();
    res.status(200).json({ success: true, count: unassigned.length, unassigned });
  } catch (error) {
    next(error);
  }
}

export async function getMyAssignments(req, res, next) {
  try {
    const user = req.user;
    if (user.role === 'team_lead') {
      const assignments = await assignmentService.getAssignmentsForLead(user._id, true);
      return res.status(200).json({ success: true, role: 'team_lead', assignments });
    }
    if (user.role === 'worker') {
      const leads = await assignmentService.getLeadsForWorker(user._id, true);
      return res.status(200).json({ success: true, role: 'worker', leads });
    }
    // Admin / Head sees unassigned summary or list
    const unassigned = await assignmentService.getUnassignedWorkers();
    return res.status(200).json({ success: true, role: user.role, unassignedCount: unassigned.length });
  } catch (error) {
    next(error);
  }
}

export async function listAllAssignments(req, res, next) {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const activeOnly = req.query.activeOnly !== 'false';
    const result = await assignmentService.listAssignments({
      page,
      limit,
      activeOnly,
      teamLeadId: req.query.teamLeadId,
      workerId: req.query.workerId,
    });
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}
