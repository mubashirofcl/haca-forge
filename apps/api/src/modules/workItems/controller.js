import * as workItemService from './service.js';
import * as transitionService from './transition.service.js';

export async function createWorkItem(req, res, next) {
  try {
    const item = await workItemService.createWorkItem(req.body, req.user);
    return res.status(201).json({
      success: true,
      message: 'Work item created successfully',
      data: item,
    });
  } catch (error) {
    next(error);
  }
}

export async function listWorkItems(req, res, next) {
  try {
    const items = await workItemService.listWorkItems(req.query, req.user);
    return res.status(200).json({ data: items });
  } catch (error) {
    next(error);
  }
}

export async function getWorkItem(req, res, next) {
  try {
    const item = await workItemService.getWorkItemById(req.params.id, req.user);
    return res.status(200).json({ data: item });
  } catch (error) {
    next(error);
  }
}

export async function updateWorkItem(req, res, next) {
  try {
    const item = await workItemService.updateWorkItem(req.params.id, req.body, req.user);
    return res.status(200).json({
      success: true,
      message: 'Work item updated successfully',
      data: item,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteWorkItem(req, res, next) {
  try {
    const result = await workItemService.deleteWorkItem(req.params.id, req.user);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function transitionWorkItem(req, res, next) {
  try {
    const item = await transitionService.transitionWorkItem(req.params.id, req.body, req.user);
    return res.status(200).json({
      success: true,
      message: `Status updated to ${item.status}`,
      data: item,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMyWork(req, res, next) {
  try {
    const myWork = await workItemService.getMyWork(req.user);
    return res.status(200).json({ data: myWork });
  } catch (error) {
    next(error);
  }
}

export async function getCalendarWorkItems(req, res, next) {
  try {
    const items = await workItemService.getCalendarWorkItems(req.query, req.user);
    return res.status(200).json({ data: items });
  } catch (error) {
    next(error);
  }
}

export async function getTodoItems(req, res, next) {
  try {
    const todo = await workItemService.getTodoItems(req.user);
    return res.status(200).json({ data: todo });
  } catch (error) {
    next(error);
  }
}

export async function getWorkItemActivities(req, res, next) {
  try {
    const activities = await workItemService.getWorkItemActivities(req.params.id, req.user);
    return res.status(200).json({ data: activities });
  } catch (error) {
    next(error);
  }
}
