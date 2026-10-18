import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import * as controller from './controller.js';

const router = Router();

router.use(authenticate);

// Current user's own assignments
router.get('/me', controller.getMyAssignments);

// Admin-only assignment management (requires assignment.manage)
router.post('/', requirePermission('assignment.manage'), controller.createAssignment);
router.delete('/', requirePermission('assignment.manage'), controller.removeAssignment);
router.post('/bulk', requirePermission('assignment.manage'), controller.bulkCreateAssignments);

// View unassigned workers
router.get('/unassigned', requirePermission('assignment.view'), controller.getUnassignedWorkers);

// Scoped viewing by lead or worker
router.get('/lead/:leadId', requirePermission('assignment.view'), controller.getAssignmentsForLead);
router.get('/worker/:workerId', requirePermission('assignment.view'), controller.getLeadsForWorker);

// List all assignments with pagination
router.get('/', requirePermission('assignment.view'), controller.listAllAssignments);

export default router;
