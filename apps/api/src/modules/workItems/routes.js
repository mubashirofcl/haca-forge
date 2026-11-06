import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission, requireAnyPermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import {
  workItemCreateSchema,
  workItemUpdateSchema,
  workItemTransitionSchema,
} from '@mmp/shared';
import * as workItemController from './controller.js';

const router = Router();

router.use(authenticate);

// Special Aggregated Endpoints (mounted before /:id)
router.get('/my-work', requirePermission('work.update.own'), workItemController.getMyWork);
router.get('/calendar', requireAnyPermission('work.request', 'work.update.own', 'portal.view'), workItemController.getCalendarWorkItems);
router.get('/todo', requireAnyPermission('work.request', 'work.update.own', 'portal.view'), workItemController.getTodoItems);

// Work Items CRUD & Queries
router.get('/', requireAnyPermission('work.request', 'work.update.own', 'portal.view'), workItemController.listWorkItems);
router.get('/:id/activity', requireAnyPermission('work.request', 'work.update.own', 'portal.view'), workItemController.getWorkItemActivities);
router.get('/:id', requireAnyPermission('work.request', 'work.update.own', 'portal.view'), workItemController.getWorkItem);

router.post(
  '/',
  requirePermission('work.create'),
  validate(workItemCreateSchema),
  workItemController.createWorkItem
);

router.patch(
  '/:id',
  requirePermission('work.update.own'),
  workItemController.guardWorkItemPatch,
  validate(workItemUpdateSchema),
  workItemController.updateWorkItem
);

// Central State Machine Transition
router.post(
  '/:id/transition',
  requirePermission('work.update.own'),
  validate(workItemTransitionSchema),
  workItemController.transitionWorkItem
);

router.delete('/:id', requirePermission('work.create'), workItemController.deleteWorkItem);

export default router;
