import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import {
  platformSchema,
  prioritySchema,
  holdReasonSchema,
  contentFormatSchema,
  requestTypeSchema,
  settingsSchema,
} from '@mmp/shared';
import * as mdController from './controller.js';

const router = Router();

router.use(authenticate);

// 1. Platforms
router.get('/platforms', mdController.getPlatforms);
router.post('/platforms', requirePermission('settings.manage'), validate(platformSchema), mdController.createPlatform);
router.patch('/platforms/:id', requirePermission('settings.manage'), mdController.updatePlatform);
router.delete('/platforms/:id', requirePermission('settings.manage'), mdController.deletePlatform);

// 2. Priorities
router.get('/priorities', mdController.getPriorities);
router.post('/priorities', requirePermission('settings.manage'), validate(prioritySchema), mdController.createPriority);
router.patch('/priorities/:id', requirePermission('settings.manage'), mdController.updatePriority);
router.delete('/priorities/:id', requirePermission('settings.manage'), mdController.deletePriority);

// 3. Hold Reasons
router.get('/hold-reasons', mdController.getHoldReasons);
router.post('/hold-reasons', requirePermission('settings.manage'), validate(holdReasonSchema), mdController.createHoldReason);
router.patch('/hold-reasons/:id', requirePermission('settings.manage'), mdController.updateHoldReason);
router.delete('/hold-reasons/:id', requirePermission('settings.manage'), mdController.deleteHoldReason);

// 4. Content Formats
router.get('/content-formats', mdController.getContentFormats);
router.post('/content-formats', requirePermission('settings.manage'), validate(contentFormatSchema), mdController.createContentFormat);
router.patch('/content-formats/:id', requirePermission('settings.manage'), mdController.updateContentFormat);
router.delete('/content-formats/:id', requirePermission('settings.manage'), mdController.deleteContentFormat);

// 5. Request Types
router.get('/request-types', mdController.getRequestTypes);
router.get('/request-types/:id', mdController.getRequestTypeById);
router.post('/request-types', requirePermission('settings.manage'), validate(requestTypeSchema), mdController.createRequestType);
router.patch('/request-types/:id', requirePermission('settings.manage'), mdController.updateRequestType);
router.delete('/request-types/:id', requirePermission('settings.manage'), mdController.deleteRequestType);

// 6. Settings
router.get('/settings', mdController.getSettings);
router.patch('/settings', requirePermission('settings.manage'), validate(settingsSchema), mdController.updateSettings);

export default router;
