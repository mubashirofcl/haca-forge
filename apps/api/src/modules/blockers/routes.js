import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import * as blockerController from './controller.js';

const router = Router();

router.use(authenticate);

router.post('/', blockerController.createBlocker);
router.get('/', blockerController.listBlockers);
router.patch('/:id/resolve', blockerController.resolveBlocker);
router.post('/:id/notify', blockerController.notifyDependencyOwner);

export default router;
