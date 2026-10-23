import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireAnyPermission } from '../../middleware/requirePermission.js';
import * as blockerController from './controller.js';

const router = Router();

router.use(authenticate);

router.post('/', requireAnyPermission('work.request', 'work.update.own'), blockerController.createBlocker);
router.get('/', requireAnyPermission('work.request', 'work.update.own', 'portal.view'), blockerController.listBlockers);
router.patch('/:id/resolve', requireAnyPermission('work.request', 'work.update.own'), blockerController.resolveBlocker);
router.post('/:id/notify', requireAnyPermission('work.request', 'work.update.own'), blockerController.notifyDependencyOwner);

export default router;
