import * as referenceService from './service.js';

export async function getAll(req, res, next) {
  try {
    const data = await referenceService.getAllReferenceData();
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function getDepartments(req, res, next) {
  try {
    const departments = await referenceService.getDepartments();
    res.json({ data: departments });
  } catch (err) {
    next(err);
  }
}
