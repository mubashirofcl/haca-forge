import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission, requireAnyPermission } from '../../middleware/requirePermission.js';
import * as feedbackController from './controller.js';
import { requireBodyWorkItemAccess, workItemParam } from '../workItems/access.js';

export const feedbackRouter = Router();

feedbackRouter.use(authenticate);
feedbackRouter.param('workItemId', workItemParam);

// Feedback threads list
feedbackRouter.get(
  '/threads',
  requireAnyPermission('analytics.team', 'portal.view'),
  feedbackController.listFeedbackThreads
);

// Feedback per work item
feedbackRouter.get(
  '/work-item/:workItemId',
  requireAnyPermission('feedback.respond', 'feedback.give', 'portal.view'),
  feedbackController.getFeedbackForWorkItem
);
feedbackRouter.post(
  '/work-item/:workItemId',
  requireAnyPermission('feedback.give', 'feedback.respond'),
  feedbackController.createFeedbackEntry
);

// Generic feedback entry submission
feedbackRouter.post(
  '/',
  requireAnyPermission('feedback.give', 'feedback.respond'),
  requireBodyWorkItemAccess,
  feedbackController.createFeedbackEntry
);

export const revisionsRouter = Router();

revisionsRouter.use(authenticate);

// Revision Flags
revisionsRouter.get(
  '/flags',
  requireAnyPermission('analytics.team', 'portal.view'),
  feedbackController.listRevisionFlags
);
revisionsRouter.post(
  '/flags/:id/classify',
  requirePermission('revision.classify'),
  feedbackController.classifyRevisionFlag
);
