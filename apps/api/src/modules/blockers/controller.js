import * as blockerService from './service.js';
import { blockerCreateSchema, blockerResolveSchema } from '@mmp/shared';

export async function createBlocker(req, res, next) {
  try {
    const parsed = blockerCreateSchema.parse(req.body);
    const blocker = await blockerService.createBlocker(parsed, req.user);
    res.status(201).json({ success: true, data: blocker });
  } catch (err) {
    next(err);
  }
}

export async function resolveBlocker(req, res, next) {
  try {
    const { id } = req.params;
    const parsed = blockerResolveSchema.parse(req.body || {});
    const resolved = await blockerService.resolveBlocker(id, parsed, req.user);
    res.json({ success: true, data: resolved });
  } catch (err) {
    next(err);
  }
}

export async function notifyDependencyOwner(req, res, next) {
  try {
    const { id } = req.params;
    const notified = await blockerService.notifyDependencyOwner(id, req.user);
    res.json({ success: true, data: notified, message: 'Reminder sent to dependency owner' });
  } catch (err) {
    next(err);
  }
}

export async function listBlockers(req, res, next) {
  try {
    const blockers = await blockerService.listBlockers(req.query, req.user);
    res.json({ success: true, data: blockers });
  } catch (err) {
    next(err);
  }
}
