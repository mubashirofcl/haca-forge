import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import {
  createDeliverableSchema,
  reviewDeliverableSchema,
  requesterConfirmSchema,
  performanceLiveSchema,
} from '@mmp/shared';
import * as deliverableController from './controller.js';

const router = Router();

router.use(authenticate);

// 1. Upload & Submit Deliverable
router.post(
  '/',
  requirePermission('task.upload'),
  validate(createDeliverableSchema),
  deliverableController.createDeliverableHandler
);

// 2. Lead Review Queue
router.get(
  '/queue',
  requirePermission('review.approve'),
  deliverableController.listReviewQueueHandler
);

// 3. Lead Review Decision (Approve / Request Changes / Reject)
router.post(
  '/:id/review',
  requirePermission('review.approve'),
  validate(reviewDeliverableSchema),
  deliverableController.reviewDeliverableHandler
);

// 4. Requester Final Confirmation / Changes
router.post(
  '/confirm/:contentItemId',
  requirePermission('request.confirm'),
  validate(requesterConfirmSchema),
  deliverableController.confirmDeliverableHandler
);

// 5. Performance Hand-off and Live Launch
router.post(
  '/performance/:contentItemId/hand',
  requirePermission('content.update'),
  deliverableController.handToPerformanceHandler
);

router.post(
  '/performance/:contentItemId/live',
  requirePermission('content.update'),
  validate(performanceLiveSchema),
  deliverableController.setPerformanceLiveHandler
);

// 6. Deliverable Versions & Comparison
router.get('/task/:taskId', deliverableController.getTaskDeliverablesHandler);
router.get('/compare', deliverableController.getComparisonHandler);

// 7. Global File Library
router.get('/files', deliverableController.listFileLibraryHandler);

export default router;
