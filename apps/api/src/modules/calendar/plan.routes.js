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
import { normalizeRole } from '@mmp/shared';

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

router.post(
  '/autofill',
  requirePermission('calendar.plan'),
  planController.autofillRow
);

// Excel-style grid: one grid per calendar + month (mounted before :id)
// Team members get 404 on every grid route (isolation rule: the grid does not exist for them).
router.use('/grid', (req, res, next) => {
  if (normalizeRole(req.user?.role) === 'team_member') {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } });
  }
  return next();
});

router.get(
  '/grid',
  requireAnyPermission('calendar.plan', 'calendar.approve', 'portal.view'),
  planController.getGrid
);

router.post(
  '/grid/rows',
  requirePermission('calendar.plan'),
  planController.saveGridRows
);

router.post(
  '/grid/upload',
  requirePermission('calendar.plan'),
  upload.single('file'),
  planController.uploadGridFile
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
  '/:id/calendar',
  requirePermission('calendar.plan'),
  planController.moveCalendar
);

router.patch(
  '/:id',
  requirePermission('calendar.plan'),
  planController.updatePlan
);

router.delete(
  '/:id',
  requirePermission('calendar.plan'),
  planController.deletePlan
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

router.delete(
  '/:id/rows/:rowId',
  requirePermission('calendar.plan'),
  planController.deleteRow
);

router.post(
  '/:id/rows/:rowId/submit',
  requirePermission('calendar.plan'),
  planController.submitRow
);

router.post(
  '/:id/rows/autofill',
  requirePermission('calendar.plan'),
  planController.autofillRow
);

router.post(
  '/:id/validate',
  requirePermission('calendar.plan'),
  planController.validatePlan
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
