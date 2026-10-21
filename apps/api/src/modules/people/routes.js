import express from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import * as peopleController from './controller.js';

const router = express.Router();

function requireAnyPermission(keys) {
  return (req, res, next) => {
    if (!req.user || !req.ability) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required before checking permissions.' },
      });
    }
    if (req.user.role === 'admin') return next();
    const hasPerm = keys.some((k) => req.ability.can(k, 'all'));
    if (hasPerm) return next();
    return res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: `You do not have the required permissions (${keys.join(' or ')}) to perform this action.`,
      },
    });
  };
}

// All people routes require authentication
router.use(authenticate);

// Listing & Candidate endpoints
router.get('/', peopleController.listPeople);
router.get('/assignment-candidates', peopleController.getAssignmentCandidates);
router.get('/:id', peopleController.getPersonById);

// Admin-only creation
router.post('/', requirePermission('user.manage'), peopleController.createPerson);

// Update: Admin (user.manage) or Marketing Head (people.assign)
router.patch('/:id', requireAnyPermission(['user.manage', 'people.assign']), peopleController.updatePerson);
router.put('/:id', requireAnyPermission(['user.manage', 'people.assign']), peopleController.updatePerson);

// Admin-only lifecycle controls
router.post('/:id/suspend', requirePermission('user.manage'), peopleController.suspendPerson);
router.post('/:id/reactivate', requirePermission('user.manage'), peopleController.reactivatePerson);

export default router;
