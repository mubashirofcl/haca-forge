import * as deptService from './service.js';

export async function list(req, res, next) {
  try {
    const departments = await deptService.listDepartments();
    return res.status(200).json({ departments });
  } catch (error) {
    next(error);
  }
}

export async function create(req, res, next) {
  try {
    const department = await deptService.createDepartment(req.body, req.user);
    return res.status(201).json({ department });
  } catch (error) {
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    const department = await deptService.updateDepartment(req.params.id, req.body, req.user);
    if (!department) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Department not found' } });
    }
    return res.status(200).json({ department });
  } catch (error) {
    next(error);
  }
}

export async function remove(req, res, next) {
  try {
    const success = await deptService.deleteDepartment(req.params.id, req.user);
    if (!success) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Department not found' } });
    }
    return res.status(200).json({ success: true, message: 'Department deleted successfully' });
  } catch (error) {
    next(error);
  }
}
