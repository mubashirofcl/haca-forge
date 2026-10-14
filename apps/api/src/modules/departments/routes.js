import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { departmentSchema } from '@mmp/shared';
import * as deptController from './controller.js';

const router = Router();

router.use(authenticate);

// Listing departments is accessible to all authenticated users (needed for dropdowns / creation forms)
router.get('/', deptController.list);

// Mutating departments requires settings.manage (admin)
router.post('/', requirePermission('settings.manage'), validate(departmentSchema), deptController.create);
router.patch('/:id', requirePermission('settings.manage'), deptController.update);
router.delete('/:id', requirePermission('settings.manage'), deptController.remove);

export default router;
