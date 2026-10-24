import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission, requireAnyPermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import {
  calendarPlanCreateSchema,
  calendarPlanReviewSchema,
} from '@mmp/shared';
import * as planController from './plan.controller.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit for Excel/CSV
});

router.use(authenticate);

// Import & Template routes (mounted before :id)
router.get(
  '/template',
  requireAnyPermission('calendar.plan', 'calendar.approve', 'portal.view'),
  planController.downloadTemplate
);

router.post(
  '/preview',
  requirePermission('calendar.plan'),
  upload.single('file'),
  planController.previewImport
);

router.post(
  '/commit',
  requirePermission('calendar.plan'),
  planController.commitImport
);

// Plans CRUD & review
router.get(
  '/',
  requireAnyPermission('calendar.plan', 'calendar.approve', 'portal.view'),
  planController.listPlans
);

router.post(
  '/',
  requirePermission('calendar.plan'),
  validate(calendarPlanCreateSchema),
  planController.createPlan
);

router.get(
  '/:id',
  requireAnyPermission('calendar.plan', 'calendar.approve', 'portal.view'),
  planController.getPlan
);

router.patch(
  '/:id',
  requirePermission('calendar.plan'),
  planController.updatePlan
);

router.post(
  '/:id/rows',
  requirePermission('calendar.plan'),
  planController.addRows
);

router.patch(
  '/:id/rows/:rowId',
  requirePermission('calendar.plan'),
  planController.updateRow
);

router.post(
  '/:id/submit',
  requirePermission('calendar.plan'),
  planController.submitPlan
);

router.post(
  '/:id/review',
  requirePermission('calendar.approve'),
  validate(calendarPlanReviewSchema),
  planController.reviewPlan
);

export default router;
