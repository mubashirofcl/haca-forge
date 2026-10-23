import express from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission, requireAnyPermission } from '../../middleware/requirePermission.js';
import {
  getAutomationRulesHandler,
  getAutomationRuleHandler,
  toggleAutomationRuleHandler,
  runAutomationRuleHandler,
} from './controller.js';

const router = express.Router();

router.use(authenticate);

// View rules (accessible to users with report.view, automation.manage, or portal.view)
router.get('/', requireAnyPermission('automation.manage', 'report.view', 'portal.view'), getAutomationRulesHandler);
router.get('/:id', requireAnyPermission('automation.manage', 'report.view', 'portal.view'), getAutomationRuleHandler);

// Toggle & Run rules (strictly requires automation.manage)
router.patch('/:id/toggle', requirePermission('automation.manage'), toggleAutomationRuleHandler);
router.post('/:id/run', requirePermission('automation.manage'), runAutomationRuleHandler);

export default router;
