import * as timeService from './service.js';

export async function startTimer(req, res, next) {
  try {
    const result = await timeService.startTimer(req.body, req.user);
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function stopTimer(req, res, next) {
  try {
    const result = await timeService.stopTimer(req.body, req.user);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function getActiveTimer(req, res, next) {
  try {
    const result = await timeService.getActiveTimer(req.user);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function logManual(req, res, next) {
  try {
    const result = await timeService.logManualTime(req.body, req.user);
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function list(req, res, next) {
  try {
    const result = await timeService.listTimeEntries(req.query, req.user);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function submitTimesheet(req, res, next) {
  try {
    const result = await timeService.submitTimesheet(req.body, req.user);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function approveTimesheet(req, res, next) {
  try {
    const io = req.app.get('io');
    const result = await timeService.approveTimesheet(req.body, req.user, io);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}
