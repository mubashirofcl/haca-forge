import * as shootService from './service.js';

export async function create(req, res, next) {
  try {
    const io = req.app.get('io');
    const result = await shootService.createShoot(req.body, req.user, io);
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function list(req, res, next) {
  try {
    const result = await shootService.listShoots(req.query, req.user);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function getById(req, res, next) {
  try {
    const result = await shootService.getShootById(req.params.id);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const result = await shootService.updateShoot(req.params.id, req.body, req.user);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function transition(req, res, next) {
  try {
    const io = req.app.get('io');
    const result = await shootService.transitionShootStatus(req.params.id, req.body, req.user, io);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}
