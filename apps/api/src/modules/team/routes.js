import express from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import * as teamController from './controller.js';

const router = express.Router();

// Middleware: allow access if user has 'team.profile.view' OR is accessing their own profile (:id === req.user._id)
// If a team_member tries to access someone else's ID, return 404 (strictly anti-harvesting).
function requireProfileAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    });
  }

  if (req.user.role === 'admin' || req.ability?.can('team.profile.view', 'all')) {
    return next();
  }

  const userIdStr = (req.user._id || req.user.id || req.user.userId)?.toString();
  const targetIdStr = req.params.id?.toString();

  if (userIdStr && targetIdStr && userIdStr === targetIdStr) {
    return next();
  }

  // Worker attempting to access another profile -> 404 Not Found
  return res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Profile not found',
    },
  });
}

router.use(authenticate);

// Directory list - requires team.profile.view
router.get('/', requirePermission('team.profile.view'), teamController.getDirectory);

// Individual Profile Endpoints
router.get('/:id', requireProfileAccess, teamController.getBaseProfile);
router.get('/:id/overview', requireProfileAccess, teamController.getOverview);
router.get('/:id/work', requireProfileAccess, teamController.getWork);
router.get('/:id/performance', requireProfileAccess, teamController.getPerformance);
router.get('/:id/ratings', requireProfileAccess, teamController.getRatings);
router.get('/:id/activity', requireProfileAccess, teamController.getActivity);
router.get('/:id/changes', requirePermission('team.profile.view'), teamController.getChanges);

// Mutations
router.patch('/:id', teamController.updateDetails);
router.post('/:id/reassign', teamController.reassign);
router.post('/:id/status', teamController.toggleStatusHandler);
router.post('/:id/reset-password', teamController.resetPasswordHandler);
router.post('/:id/force-logout', teamController.forceLogoutHandler);

export default router;
