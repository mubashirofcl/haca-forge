import express from 'express';
import { authenticate } from '../../middleware/auth.js';
import { getDashboardSummaryHandler } from './controller.js';

const router = express.Router();

router.use(authenticate);

// Dynamic summary auto-resolved by user's role
router.get('/summary', getDashboardSummaryHandler);

// Specific role summary endpoints
router.get('/:role', getDashboardSummaryHandler);

export default router;
