import express from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import {
  getDataCenterStatusHandler,
  triggerLsqSyncHandler,
  resolveDiscrepancyHandler,
} from './controller.js';

const router = express.Router();

router.use(authenticate);
router.use(requirePermission('datacenter.view'));

router.get('/', getDataCenterStatusHandler);
router.get('/status', getDataCenterStatusHandler);
router.post('/sync', triggerLsqSyncHandler);
router.patch('/discrepancies/:id/resolve', resolveDiscrepancyHandler);
router.patch('/:id/resolve', resolveDiscrepancyHandler);

export default router;
