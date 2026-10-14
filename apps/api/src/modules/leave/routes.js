import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createLeaveRequestSchema, reviewLeaveRequestSchema } from '@mmp/shared';
import * as leaveController from './controller.js';

const router = Router();

router.use(authenticate);

router.post('/', validate(createLeaveRequestSchema), leaveController.create);
router.get('/', leaveController.list);
router.patch('/:id/review', validate(reviewLeaveRequestSchema), leaveController.review);
router.post('/:id/cancel', leaveController.cancel);

export default router;
