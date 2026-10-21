import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import * as feedbackController from './controller.js';

export const feedbackRouter = Router();

feedbackRouter.use(authenticate);

// Feedback threads list
feedbackRouter.get('/threads', feedbackController.listFeedbackThreads);

// Feedback per work item
feedbackRouter.get('/work-item/:workItemId', feedbackController.getFeedbackForWorkItem);
feedbackRouter.post('/work-item/:workItemId', feedbackController.createFeedbackEntry);

// Generic feedback entry submission
feedbackRouter.post('/', feedbackController.createFeedbackEntry);

export const revisionsRouter = Router();

revisionsRouter.use(authenticate);

// Revision Flags
revisionsRouter.get('/flags', feedbackController.listRevisionFlags);
revisionsRouter.post('/flags/:id/classify', feedbackController.classifyRevisionFlag);
