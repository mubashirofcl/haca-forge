import express from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission, requireAnyPermission } from '../../middleware/requirePermission.js';
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
router.get('/funnel', requireAnyPermission('lead.view', 'portal.view'), getLeadFunnelHandler);
router.get('/', requireAnyPermission('lead.view', 'portal.view'), getLeadFunnelHandler);

// 2. Data Center & LSQ Integration status (Screen 13)
router.get('/datacenter', requireAnyPermission('datacenter.view', 'portal.view'), getDataCenterStatusHandler);
router.patch('/datacenter/:id/resolve', requirePermission('automation.manage'), resolveDiscrepancyHandler);
router.post('/sync', requirePermission('automation.manage'), triggerLsqSyncHandler);

// 3. Read-authoritative constraint enforcement
router.post('/', rejectLeadModificationHandler);
router.put('/:id', rejectLeadModificationHandler);
router.patch('/:id', rejectLeadModificationHandler);
router.delete('/:id', rejectLeadModificationHandler);

export default router;
