import * as peopleService from './service.js';
import { logger } from '../../lib/logger.js';

export async function listPeople(req, res, next) {
  try {
    const filters = {
      departmentId: req.query.departmentId,
      profileId: req.query.profileId,
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
      profileId: req.query.profileId,
    });
    res.json({ data: candidates });
  } catch (err) {
    next(err);
  }
}
