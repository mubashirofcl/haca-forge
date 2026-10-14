import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import {
  createCalendarEntrySchema,
  updateCalendarEntrySchema,
  commitCalendarImportSchema,
} from '@mmp/shared';
import * as calendarController from './controller.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const router = Router();

router.use(authenticate);

// 1. Template Download & Capacity Comparison
router.get('/template', calendarController.downloadTemplate);
router.get('/capacity', calendarController.getCapacity);

// 2. Calendar Entries CRUD
router.get('/', calendarController.listEntries);
router.post(
  '/',
  requirePermission('calendar.manage'),
  validate(createCalendarEntrySchema),
  calendarController.createEntry
);
router.patch(
  '/:id',
  requirePermission('calendar.manage'),
  validate(updateCalendarEntrySchema),
  calendarController.updateEntry
);
router.delete(
  '/:id',
  requirePermission('calendar.manage'),
  calendarController.deleteEntry
);

// 3. Approval & Pipeline Generation
router.post(
  '/approve',
  requirePermission('calendar.manage'),
  calendarController.approveEntries
);
router.post(
  '/generate-content',
  requirePermission('calendar.manage'),
  calendarController.generateContent
);

// 4. Excel / CSV Bulk Import
router.post(
  '/import/preview',
  requirePermission('calendar.import'),
  upload.single('file'),
  calendarController.previewImport
);
router.post(
  '/import/commit',
  requirePermission('calendar.import'),
  validate(commitCalendarImportSchema),
  calendarController.commitImport
);

export default router;
