import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createCommentSchema } from '@mmp/shared';
import * as commentController from './controller.js';

const router = Router();

router.use(authenticate);

router.post('/', validate(createCommentSchema), commentController.createCommentHandler);
router.get('/', commentController.listCommentsHandler);

export default router;
