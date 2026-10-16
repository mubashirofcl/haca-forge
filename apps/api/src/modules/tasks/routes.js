import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { createTaskSchema, updateTaskSchema, taskTransitionSchema } from '@mmp/shared';
import * as taskController from './controller.js';

const router = Router();

router.use(authenticate);

// Workload endpoints (available to lead and team_lead)
router.get('/workload', taskController.getWorkloadHandler);
router.get('/workload/suggestions', taskController.getWorkloadSuggestionsHandler);

// Task CRUD and lifecycle
router.post(
  '/',
  requirePermission('task.assign'),
  validate(createTaskSchema),
  taskController.createTaskHandler
);

router.get('/', taskController.listTasksHandler);

router.get('/:id', taskController.getTaskByIdHandler);

router.patch(
  '/:id',
  requirePermission('task.assign'),
  validate(updateTaskSchema),
  taskController.updateTaskHandler
);

router.post(
  '/:id/transition',
  validate(taskTransitionSchema),
  taskController.transitionTaskStatusHandler
);

// Subtasks
router.patch('/:id/subtasks/:subtaskId', taskController.toggleSubtaskHandler);
router.post('/:id/subtasks', taskController.addSubtaskHandler);

// Deadline extension requests
router.post('/:id/extension-request', taskController.requestDeadlineExtensionHandler);
router.post(
  '/:id/extension-review',
  requirePermission('task.assign'),
  taskController.reviewDeadlineExtensionHandler
);

export default router;
