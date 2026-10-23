import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission, requireAnyPermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { monthlyTargetSchema, monthlyTargetUpdateSchema } from '@mmp/shared';
import * as targetController from './controller.js';

const router = Router();

router.use(authenticate);

// View monthly targets (Admin, Marketing Head, Team Lead, Executive)
router.get('/', requireAnyPermission('target.view', 'portal.view'), targetController.listTargets);
router.get('/:id', requireAnyPermission('target.view', 'portal.view'), targetController.getTarget);

// Set / Manage monthly targets (Admin, Marketing Head only)
router.post(
  '/',
  requirePermission('target.manage'),
  validate(monthlyTargetSchema),
  targetController.setTarget
);

router.patch(
  '/:id',
  requirePermission('target.manage'),
  validate(monthlyTargetUpdateSchema),
  targetController.updateTarget
);

router.delete('/:id', requirePermission('target.manage'), targetController.deleteTarget);

export default router;
