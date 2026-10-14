import * as taskService from './service.js';

export async function createTaskHandler(req, res, next) {
  try {
    const io = req.app.get('io');
    const task = await taskService.createTask(req.body, req.user, io);
    res.status(201).json({ data: task });
  } catch (err) {
    next(err);
  }
}

export async function listTasksHandler(req, res, next) {
  try {
    const tasks = await taskService.listTasks(req.query, req.user);
    res.json({ data: tasks });
  } catch (err) {
    next(err);
  }
}

export async function getTaskByIdHandler(req, res, next) {
  try {
    const result = await taskService.getTaskById(req.params.id, req.user);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function updateTaskHandler(req, res, next) {
  try {
    const io = req.app.get('io');
    const updated = await taskService.updateTask(req.params.id, req.body, req.user, io);
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
}

export async function transitionTaskStatusHandler(req, res, next) {
  try {
    const io = req.app.get('io');
    const updated = await taskService.transitionTaskStatus(
      req.params.id,
      req.body,
      req.user,
      io
    );
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
}

export async function getWorkloadHandler(req, res, next) {
  try {
    const workload = await taskService.getWorkload(req.query.team);
    res.json({ data: workload });
  } catch (err) {
    next(err);
  }
}

export async function getWorkloadSuggestionsHandler(req, res, next) {
  try {
    const skills = req.query.skills ? req.query.skills.split(',') : [];
    const suggestions = await taskService.getWorkloadSuggestions(req.query.team, skills);
    res.json({ data: suggestions });
  } catch (err) {
    next(err);
  }
}
