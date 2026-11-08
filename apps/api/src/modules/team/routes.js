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

// Roles without 'team.profile.view' (only team_member today) get 404, not 403, for the
// directory and for another person's records, so the response does not confirm that
// the resource exists (same anti-harvesting rule as requireProfileAccess). Requests for
// your own :id fall through to the normal permission check unchanged.
function notFoundForWorkers(req, res, next) {
  if (req.user && req.user.role !== 'admin' && !req.ability?.can('team.profile.view', 'all')) {
    const userIdStr = (req.user._id || req.user.id || req.user.userId)?.toString();
    const targetIdStr = req.params.id?.toString();
    if (!targetIdStr || targetIdStr !== userIdStr) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Not found' },
      });
    }
  }
  return next();
}

router.use(authenticate);

// Directory list - requires team.profile.view (team_member: 404)
router.get('/', notFoundForWorkers, requirePermission('team.profile.view'), teamController.getDirectory);

// Individual Profile Endpoints
router.get('/:id', requireProfileAccess, teamController.getBaseProfile);
router.get('/:id/overview', requireProfileAccess, teamController.getOverview);
router.get('/:id/work', requireProfileAccess, teamController.getWork);
router.get('/:id/performance', requireProfileAccess, teamController.getPerformance);
// Phase 8: profile KPIs for a period (same access as the profile) and the downloadable
// report (admin, creative_head and executive only; enforced in the service).
router.get('/:id/kpis', requireProfileAccess, teamController.getKpis);
router.get('/:id/report', requireProfileAccess, teamController.getReport);
router.get('/:id/ratings', requireProfileAccess, teamController.getRatings);
router.get('/:id/activity', requireProfileAccess, teamController.getActivity);
router.get('/:id/changes', notFoundForWorkers, requirePermission('team.profile.view'), teamController.getChanges);

// Mutations
router.patch('/:id', teamController.updateDetails);
router.post('/:id/reassign', teamController.reassign);
router.post('/:id/status', teamController.toggleStatusHandler);
router.post('/:id/reset-password', teamController.resetPasswordHandler);
router.post('/:id/force-logout', teamController.forceLogoutHandler);

export default router;
