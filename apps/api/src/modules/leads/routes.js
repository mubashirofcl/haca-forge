import express from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import {
  getLeadFunnelHandler,
  getDataCenterStatusHandler,
  triggerLsqSyncHandler,
  resolveDiscrepancyHandler,
  rejectLeadModificationHandler,
} from './controller.js';

const router = express.Router();

router.use(authenticate);

// 1. Lead Funnel analytics (Screen 12)
router.get('/funnel', requirePermission('lead.view'), getLeadFunnelHandler);
router.get('/', requirePermission('lead.view'), getLeadFunnelHandler);

// 2. Data Center & LSQ Integration status (Screen 13)
router.get('/datacenter', requirePermission('datacenter.view'), getDataCenterStatusHandler);
router.patch('/datacenter/:id/resolve', requirePermission('datacenter.view'), resolveDiscrepancyHandler);
router.post('/sync', requirePermission('datacenter.view'), triggerLsqSyncHandler);

// 3. Read-authoritative constraint enforcement
router.post('/', rejectLeadModificationHandler);
router.put('/:id', rejectLeadModificationHandler);
router.patch('/:id', rejectLeadModificationHandler);
router.delete('/:id', rejectLeadModificationHandler);

export default router;
