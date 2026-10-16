import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import {
  createRequestSchema,
  editRequestSchema,
  triageAcceptSchema,
  triageRejectSchema,
  triageNeedsInfoSchema,
  triageMergeSchema,
  requestCommentSchema,
  convertRequestSchema,
} from '@mmp/shared';

import {
  createRequestHandler,
  listRequestsHandler,
  getRequestByIdHandler,
  editRequestHandler,
  cancelRequestHandler,
  addCommentHandler,
  repeatRequestHandler,
  checkDuplicatesHandler,
  triageAcceptHandler,
  triageRejectHandler,
  triageAskInfoHandler,
  triageMergeHandler,
  triageConvertHandler,
  bulkTriageAcceptHandler,
  bulkTriageRejectHandler,
} from './controller.js';

const router = Router();

// All request routes require authentication
router.use(authenticate);

// 1. Basic CRUD & Utility
router.post(
  '/',
  requirePermission('request.create'),
  validate(createRequestSchema),
  createRequestHandler
);

router.get('/', listRequestsHandler);

router.post('/check-duplicates', checkDuplicatesHandler);

router.get('/:id', getRequestByIdHandler);

router.patch(
  '/:id',
  requirePermission('request.create'),
  validate(editRequestSchema),
  editRequestHandler
);

router.delete(
  '/:id/cancel',
  requirePermission('request.create'),
  cancelRequestHandler
);

router.post(
  '/:id/comments',
  validate(requestCommentSchema),
  addCommentHandler
);

router.post(
  '/:id/repeat',
  requirePermission('request.create'),
  repeatRequestHandler
);

// 2. Marketing Lead & Admin Triage Endpoints
router.post(
  '/triage/bulk-accept',
  requirePermission('request.triage'),
  bulkTriageAcceptHandler
);

router.post(
  '/triage/bulk-reject',
  requirePermission('request.triage'),
  bulkTriageRejectHandler
);

router.post(
  '/:id/triage/accept',
  requirePermission('request.triage'),
  validate(triageAcceptSchema),
  triageAcceptHandler
);

router.post(
  '/:id/triage/reject',
  requirePermission('request.triage'),
  validate(triageRejectSchema),
  triageRejectHandler
);

router.post(
  '/:id/triage/ask-info',
  requirePermission('request.triage'),
  validate(triageNeedsInfoSchema),
  triageAskInfoHandler
);

router.post(
  '/:id/triage/merge',
  requirePermission('request.triage'),
  validate(triageMergeSchema),
  triageMergeHandler
);

router.post(
  '/:id/triage/convert',
  requirePermission('request.triage'),
  validate(convertRequestSchema),
  triageConvertHandler
);

export default router;
