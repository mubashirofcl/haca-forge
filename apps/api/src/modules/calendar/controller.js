import * as calendarService from './service.js';

export async function listEntries(req, res, next) {
  try {
    const entries = await calendarService.listEntries(req.query);
    res.json({ data: entries });
  } catch (err) {
    next(err);
  }
}

export async function createEntry(req, res, next) {
  try {
    const entry = await calendarService.createEntry(req.body, req.user);
    res.status(201).json({ data: entry });
  } catch (err) {
    next(err);
  }
}

export async function updateEntry(req, res, next) {
  try {
    const entry = await calendarService.updateEntry(req.params.id, req.body);
    res.json({ data: entry });
  } catch (err) {
    next(err);
  }
}

export async function deleteEntry(req, res, next) {
  try {
    const result = await calendarService.deleteEntry(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function approveEntries(req, res, next) {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        error: { code: 'INVALID_INPUT', message: 'An array of entry IDs is required.' },
      });
    }
    const result = await calendarService.approveEntries(ids);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}
