import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission, requireAnyPermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { assignmentRecommendSchema, assignmentOverrideSchema } from '@mmp/shared';
import * as assignmentController from './controller.js';

const router = Router();

router.use(authenticate);

// Auto-Assignment recommendation (Available to all who can create/request deliverables)
router.post(
  '/recommend',
  requireAnyPermission('work.create', 'work.request'),
  validate(assignmentRecommendSchema),
  assignmentController.getRecommendation
);

// Assignment Override (Requires explicit assignment.override permission: Admin, Marketing Head, Team Lead)
router.post(
  '/override',
  requirePermission('assignment.override'),
  validate(assignmentOverrideSchema),
  assignmentController.recordOverride
);

router.get(
  '/overrides',
  requireAnyPermission('assignment.override', 'portal.view'),
  assignmentController.listOverrides
);

export default router;
