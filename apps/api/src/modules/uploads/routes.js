import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { signUploadSchema } from '@mmp/shared';
import * as uploadController from './controller.js';

const router = Router();

router.use(authenticate);

router.post('/sign', validate(signUploadSchema), uploadController.signUploadHandler);

export default router;
