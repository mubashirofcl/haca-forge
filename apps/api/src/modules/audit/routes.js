import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validateQuery } from '../../middleware/validate.js';
import { auditLogQuerySchema } from '@mmp/shared';
import * as auditController from './controller.js';

const router = Router();

router.use(authenticate);
router.use(requirePermission('audit.view'));

router.get('/', validateQuery(auditLogQuerySchema), auditController.getAuditLogs);

export default router;
