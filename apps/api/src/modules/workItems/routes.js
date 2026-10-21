import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
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
router.get('/my-work', workItemController.getMyWork);
router.get('/calendar', workItemController.getCalendarWorkItems);
router.get('/todo', workItemController.getTodoItems);

// Work Items CRUD & Queries
router.get('/', workItemController.listWorkItems);
router.get('/:id/activity', workItemController.getWorkItemActivities);
router.get('/:id', workItemController.getWorkItem);

router.post(
  '/',
  requirePermission('work.request'),
  validate(workItemCreateSchema),
  workItemController.createWorkItem
);

router.patch(
  '/:id',
  requirePermission('work.update.own'),
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
