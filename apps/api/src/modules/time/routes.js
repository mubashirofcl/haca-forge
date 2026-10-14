import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import {
  startTimerSchema,
  stopTimerSchema,
  createTimeEntrySchema,
  submitTimesheetSchema,
  approveTimesheetSchema,
} from '@mmp/shared';
import * as timeController from './controller.js';

const router = Router();

router.use(authenticate);

router.post('/timer/start', validate(startTimerSchema), timeController.startTimer);
router.post('/timer/stop', validate(stopTimerSchema), timeController.stopTimer);
router.get('/timer/active', timeController.getActiveTimer);
router.post('/manual', validate(createTimeEntrySchema), timeController.logManual);
router.get('/', timeController.list);
router.post('/timesheet/submit', validate(submitTimesheetSchema), timeController.submitTimesheet);
router.post('/timesheet/approve', requirePermission('timesheet.approve'), validate(approveTimesheetSchema), timeController.approveTimesheet);

export default router;
