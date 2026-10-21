import * as feedbackService from './service.js';
import { feedbackEntryCreateSchema, revisionClassifySchema } from '@mmp/shared';

export async function getFeedbackForWorkItem(req, res, next) {
  try {
    const { workItemId } = req.params;
    const result = await feedbackService.getFeedbackForWorkItem(workItemId, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function createFeedbackEntry(req, res, next) {
  try {
    const parsed = feedbackEntryCreateSchema.parse({
      ...req.body,
      workItemId: req.params.workItemId || req.body.workItemId,
    });
    const entry = await feedbackService.createFeedbackEntry(parsed, req.user);
    res.status(201).json({ success: true, data: entry });
  } catch (err) {
    next(err);
  }
}

export async function classifyRevisionFlag(req, res, next) {
  try {
    const { id } = req.params;
    const parsed = revisionClassifySchema.parse(req.body);
    const updatedFlag = await feedbackService.classifyRevisionFlag(id, parsed, req.user);
    res.json({ success: true, data: updatedFlag });
  } catch (err) {
    next(err);
  }
}

export async function listRevisionFlags(req, res, next) {
  try {
    const flags = await feedbackService.listRevisionFlags(req.query, req.user);
    res.json({ success: true, data: flags });
  } catch (err) {
    next(err);
  }
}

export async function listFeedbackThreads(req, res, next) {
  try {
    const threads = await feedbackService.listFeedbackThreads(req.query, req.user);
    res.json({ success: true, data: threads });
  } catch (err) {
    next(err);
  }
}
