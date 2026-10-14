import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { createContentItemSchema, updateContentItemSchema, publishContentSchema } from '@mmp/shared';
import * as contentController from './controller.js';
import * as calendarController from '../calendar/controller.js';

const router = Router();

router.use(authenticate);

router.post(
  '/',
  requirePermission('content.create'),
  validate(createContentItemSchema),
  contentController.createContentItemHandler
);

router.get('/', contentController.listContentItemsHandler);

router.get('/:id', contentController.getContentItemByIdHandler);

router.patch(
  '/:id/publish',
  requirePermission('content.publish'),
  validate(publishContentSchema),
  calendarController.publishContent
);

router.patch(
  '/:id',
  requirePermission('content.update'),
  validate(updateContentItemSchema),
  contentController.updateContentItemHandler
);

export default router;
