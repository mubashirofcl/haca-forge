import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { createShootSchema, updateShootSchema, shootTransitionSchema } from '@mmp/shared';
import * as shootController from './controller.js';

const router = Router();

router.use(authenticate);

router.post('/', requirePermission('shoot.manage'), validate(createShootSchema), shootController.create);
router.get('/', shootController.list);
router.get('/:id', shootController.getById);
router.patch('/:id', requirePermission('shoot.manage'), validate(updateShootSchema), shootController.update);
router.post('/:id/transition', requirePermission('shoot.manage'), validate(shootTransitionSchema), shootController.transition);

export default router;
