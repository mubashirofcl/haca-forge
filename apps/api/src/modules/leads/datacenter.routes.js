import express from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission, requireAnyPermission } from '../../middleware/requirePermission.js';
import {
  getDataCenterStatusHandler,
  triggerLsqSyncHandler,
  resolveDiscrepancyHandler,
} from './controller.js';

const router = express.Router();

router.use(authenticate);
router.use(requireAnyPermission('datacenter.view', 'portal.view'));

router.get('/', getDataCenterStatusHandler);
router.get('/status', getDataCenterStatusHandler);
router.post('/sync', requirePermission('automation.manage'), triggerLsqSyncHandler);
router.patch('/discrepancies/:id/resolve', requirePermission('automation.manage'), resolveDiscrepancyHandler);
router.patch('/:id/resolve', requirePermission('automation.manage'), resolveDiscrepancyHandler);

export default router;
