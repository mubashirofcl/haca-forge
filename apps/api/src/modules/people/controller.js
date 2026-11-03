import * as peopleService from './service.js';
import { logger } from '../../lib/logger.js';

export async function listPeople(req, res, next) {
  try {
    const filters = {
      departmentId: req.query.departmentId,
      role: req.query.role,
      status: req.query.status,
    };
    const excludeAdmin = req.query.excludeAdmin === 'true';

    const people = await peopleService.listPeople({
      actor: req.user,
      filters,
      excludeAdmin,
    });

    res.json({ data: people });
  } catch (err) {
    next(err);
  }
}

export async function getPersonById(req, res, next) {
  try {
    const person = await peopleService.getPersonById(req.params.id, req.user);
    res.json({ data: person });
  } catch (err) {
    next(err);
  }
}

export async function createPerson(req, res, next) {
  try {
    const person = await peopleService.createPerson(req.body, req.user);
    res.status(201).json({
      message: 'Person created successfully',
      data: person,
    });
  } catch (err) {
    next(err);
  }
}

export async function updatePerson(req, res, next) {
  try {
    const person = await peopleService.updatePerson(req.params.id, req.body, req.user);
    res.json({
      message: 'Person updated successfully',
      data: person,
    });
  } catch (err) {
    next(err);
  }
}

export async function suspendPerson(req, res, next) {
  try {
    const person = await peopleService.suspendPerson(req.params.id, req.user);
    res.json({
      message: 'User account suspended successfully',
      data: person,
    });
  } catch (err) {
    next(err);
  }
}

export async function reactivatePerson(req, res, next) {
  try {
    const person = await peopleService.reactivatePerson(req.params.id, req.user);
    res.json({
      message: 'User account reactivated successfully',
      data: person,
    });
  } catch (err) {
    next(err);
  }
}

export async function getAssignmentCandidates(req, res, next) {
  try {
    const candidates = await peopleService.getAssignmentCandidates({
      departmentId: req.query.departmentId,
    });
    res.json({ data: candidates });
  } catch (err) {
    next(err);
  }
}

export async function getPersonPerformance(req, res, next) {
  try {
    const { calculatePersonPerformance } = await import('./metrics.js');
    const filters = {
      month: req.query.month,
    };
    const metrics = await calculatePersonPerformance(req.params.id, filters, req.user);
    res.json({ data: metrics });
  } catch (err) {
    next(err);
  }
}

export async function getTeamPerformance(req, res, next) {
  try {
    const { calculateTeamPerformance } = await import('./metrics.js');
    const filters = {
      month: req.query.month,
      departmentId: req.query.departmentId,
    };
    const teamMetrics = await calculateTeamPerformance(filters, req.user);
    res.json({ data: teamMetrics });
  } catch (err) {
    next(err);
  }
}

export async function getPersonProfileHandler(req, res, next) {
  try {
    const profile = await peopleService.getPersonProfile(req.params.id, req.user);
    res.json({ data: profile });
  } catch (err) {
    next(err);
  }
}

export async function adminUpdateBasicInfoHandler(req, res, next) {
  try {
    const result = await peopleService.adminUpdatePersonBasic(req.params.id, req.body, req.user);
    res.json({
      success: true,
      message: 'Person basic details updated successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function adminRemoveAvatarHandler(req, res, next) {
  try {
    const result = await peopleService.adminRemovePersonAvatar(req.params.id, req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getPersonWorkHistoryHandler(req, res, next) {
  try {
    const history = await peopleService.getPersonWorkHistory(req.params.id, req.user);
    res.json({ data: history });
  } catch (err) {
    next(err);
  }
}

