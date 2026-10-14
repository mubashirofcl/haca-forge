import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import * as userController from './controller.js';

const router = Router();

router.use(authenticate);
router.use(requirePermission('user.manage'));

router.get('/', userController.listUsers);
router.patch('/:id/role', userController.updateRole);
router.patch('/:id/status', userController.updateStatus);
router.patch('/:id/assignment', userController.updateAssignment);
router.post('/:id/force-logout', userController.forceLogout);

export default router;
