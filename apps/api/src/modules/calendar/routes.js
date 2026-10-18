import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import * as calendarController from './controller.js';

const router = Router();

router.use(authenticate);

// Calendar Entries CRUD
router.get('/', calendarController.listEntries);
router.post('/', calendarController.createEntry);
router.patch('/:id', calendarController.updateEntry);
router.delete('/:id', calendarController.deleteEntry);
router.post('/approve', calendarController.approveEntries);

export default router;
