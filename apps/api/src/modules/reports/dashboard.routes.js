import express from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireAnyPermission } from '../../middleware/requirePermission.js';
import { getDashboardOverviewHandler, getDashboardSummaryHandler } from './controller.js';

const router = express.Router();

router.use(authenticate);
router.use(requireAnyPermission('analytics.team', 'portal.view'));

// Dynamic 9-section overview auto-resolved by user's role and global filters
router.get('/', getDashboardOverviewHandler);
router.get('/overview', getDashboardOverviewHandler);
router.get('/summary', getDashboardSummaryHandler);

// Specific role summary endpoints
router.get('/:role', getDashboardSummaryHandler);

export default router;
