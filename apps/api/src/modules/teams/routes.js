import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import * as teamController from './controller.js';

const router = Router();

router.use(authenticate);

// Listing teams is available to authenticated users (needed for task assignment, filters, dashboard views)
router.get('/', teamController.list);

// Handoff queues across all teams
router.get('/queues', teamController.getQueues);

// Reassign task within team with overload & leave awareness
router.post('/reassign-task', requirePermission('task.assign'), teamController.reassign);

// Team dashboard data (members, capacity, load, skills, queue)
router.get('/:teamId/dashboard', teamController.getDashboard);

// Mutating team structure requires settings.manage (admin) or team_lead / lead
router.patch('/:id', requirePermission('settings.manage'), teamController.update);
router.post('/:id/members', requirePermission('settings.manage'), teamController.addMember);
router.delete('/:id/members/:userId', requirePermission('settings.manage'), teamController.removeMember);

export default router;

