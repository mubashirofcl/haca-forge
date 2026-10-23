import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireAnyPermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { signUploadSchema } from '@mmp/shared';
import * as uploadController from './controller.js';

const router = Router();

router.use(authenticate);

router.post(
  '/sign',
  requireAnyPermission('work.create', 'work.request', 'work.update.own'),
  validate(signUploadSchema),
  uploadController.signUploadHandler
);

export default router;
