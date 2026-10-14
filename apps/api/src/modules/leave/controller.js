import * as leaveService from './service.js';

export async function create(req, res, next) {
  try {
    const io = req.app.get('io');
    const result = await leaveService.createLeaveRequest(req.body, req.user, io);
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function list(req, res, next) {
  try {
    const result = await leaveService.listLeaveRequests(req.query, req.user);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function review(req, res, next) {
  try {
    const io = req.app.get('io');
    const result = await leaveService.reviewLeaveRequest(req.params.id, req.body, req.user, io);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function cancel(req, res, next) {
  try {
    const result = await leaveService.cancelLeaveRequest(req.params.id, req.user);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}
