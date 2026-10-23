import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission, requireAnyPermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { campaignSchema, campaignUpdateSchema } from '@mmp/shared';
import * as campaignController from './controller.js';

const router = Router();

router.use(authenticate);

// View campaigns (Team Leads, Marketing Head, Admin, Executive)
router.get('/', requireAnyPermission('campaign.manage', 'portal.view'), campaignController.listCampaigns);
router.get('/:id/activity', requireAnyPermission('campaign.manage', 'portal.view'), campaignController.getCampaignActivities);
router.get('/:id', requireAnyPermission('campaign.manage', 'portal.view'), campaignController.getCampaign);

// Create campaign (requires targetId & relatedOKR)
router.post(
  '/',
  requirePermission('campaign.manage'),
  validate(campaignSchema),
  campaignController.createCampaign
);

// Update campaign
router.patch(
  '/:id',
  requirePermission('campaign.manage'),
  validate(campaignUpdateSchema),
  campaignController.updateCampaign
);

// Delete campaign
router.delete('/:id', requirePermission('campaign.manage'), campaignController.deleteCampaign);

export default router;
