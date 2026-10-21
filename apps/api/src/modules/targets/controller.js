import * as targetService from './service.js';

export async function listTargets(req, res, next) {
  try {
    const targets = await targetService.listMonthlyTargets(req.query, req.user);
    return res.status(200).json({ data: targets });
  } catch (error) {
    next(error);
  }
}

export async function getTarget(req, res, next) {
  try {
    const target = await targetService.getMonthlyTargetById(req.params.id, req.user);
    return res.status(200).json({ data: target });
  } catch (error) {
    next(error);
  }
}

export async function setTarget(req, res, next) {
  try {
    const target = await targetService.setMonthlyTarget(req.body, req.user);
    return res.status(201).json({
      success: true,
      message: 'Monthly target saved successfully',
      data: target,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateTarget(req, res, next) {
  try {
    const target = await targetService.updateMonthlyTarget(req.params.id, req.body, req.user);
    return res.status(200).json({
      success: true,
      message: 'Monthly target updated successfully',
      data: target,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteTarget(req, res, next) {
  try {
    const result = await targetService.deleteMonthlyTarget(req.params.id, req.user);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
