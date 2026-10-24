import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { accessRequestReviewSchema } from '@mmp/shared';
import * as accessController from './controller.js';

const router = Router();

router.use(authenticate);
router.use(requirePermission('user.approve'));

router.get('/', accessController.listRequests);
router.patch('/:id/approve', validate(accessRequestReviewSchema), accessController.approveRequest);
router.post('/:id/approve', validate(accessRequestReviewSchema), accessController.approveRequest);
router.patch('/:id/reject', accessController.rejectRequest);
router.post('/:id/reject', accessController.rejectRequest);
router.patch('/:id/info', accessController.requestInfo);
router.post('/bulk-approve', accessController.bulkApproveRequests);

export default router;
