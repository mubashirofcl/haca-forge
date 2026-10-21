import * as assignmentService from './service.js';

export async function getRecommendation(req, res, next) {
  try {
    const recommendation = await assignmentService.recommendAssignee(req.body, req.user);
    res.json({
      success: true,
      data: recommendation,
    });
  } catch (error) {
    next(error);
  }
}

export async function recordOverride(req, res, next) {
  try {
    const override = await assignmentService.recordAssignmentOverride(req.body, req.user);
    res.status(201).json({
      success: true,
      message: 'Assignment override recorded successfully',
      data: override,
    });
  } catch (error) {
    next(error);
  }
}

export async function getTeamWorkload(req, res, next) {
  try {
    const workload = await assignmentService.getTeamWorkload(req.query, req.user);
    res.json({
      success: true,
      data: workload,
    });
  } catch (error) {
    next(error);
  }
}

export async function listOverrides(req, res, next) {
  try {
    const overrides = await assignmentService.listAssignmentOverrides(req.query, req.user);
    res.json({
      success: true,
      data: overrides,
    });
  } catch (error) {
    next(error);
  }
}
