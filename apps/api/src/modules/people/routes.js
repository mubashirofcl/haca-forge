import express from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission, requireAnyPermission } from '../../middleware/requirePermission.js';
import * as peopleController from './controller.js';

const router = express.Router();

// All people routes require authentication
router.use(authenticate);

// Listing & Candidate endpoints
router.get('/', requireAnyPermission('user.manage', 'people.assign', 'people.view', 'portal.view'), peopleController.listPeople);
router.get('/assignment-candidates', requireAnyPermission('people.assign', 'work.create', 'portal.view'), peopleController.getAssignmentCandidates);
router.get('/performance/team', requireAnyPermission('analytics.team', 'portal.view'), peopleController.getTeamPerformance);
router.get('/:id/performance', requireAnyPermission('analytics.team', 'portal.view'), peopleController.getPersonPerformance);
router.get('/:id', requireAnyPermission('user.manage', 'people.assign', 'people.view', 'portal.view'), peopleController.getPersonById);

// Admin-only creation
router.post('/', requirePermission('user.manage'), peopleController.createPerson);

// Update: Admin (user.manage) or Marketing Head (people.assign)
router.patch('/:id', requireAnyPermission('user.manage', 'people.assign'), peopleController.updatePerson);
router.put('/:id', requireAnyPermission('user.manage', 'people.assign'), peopleController.updatePerson);

// Admin-only lifecycle controls
router.post('/:id/suspend', requirePermission('user.manage'), peopleController.suspendPerson);
router.post('/:id/reactivate', requirePermission('user.manage'), peopleController.reactivatePerson);

export default router;
