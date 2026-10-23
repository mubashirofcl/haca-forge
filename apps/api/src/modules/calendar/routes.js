import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission, requireAnyPermission } from '../../middleware/requirePermission.js';
import * as calendarController from './controller.js';

const router = Router();

router.use(authenticate);

// Calendar Entries CRUD
router.get('/', requireAnyPermission('work.request', 'work.update.own', 'portal.view'), calendarController.listEntries);
router.post('/', requirePermission('work.create'), calendarController.createEntry);
router.patch('/:id', requirePermission('work.create'), calendarController.updateEntry);
router.delete('/:id', requirePermission('work.create'), calendarController.deleteEntry);
router.post('/approve', requirePermission('work.create'), calendarController.approveEntries);

export default router;
