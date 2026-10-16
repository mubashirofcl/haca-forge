import express from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import {
  getDepartmentReportHandler,
  getTeamReportHandler,
  getIndividualReportHandler,
  getContentReportHandler,
  getBottlenecksReportHandler,
  getScorecardReportHandler,
  exportReportHandler,
  createScheduledReportHandler,
  getScheduledReportsHandler,
  deleteScheduledReportHandler,
} from './controller.js';

const router = express.Router();

// All report routes require authentication and report.view permission
router.use(authenticate);
router.use(requirePermission('report.view'));

// 1. Department Performance & Turnaround Report
router.get('/department', getDepartmentReportHandler);

// 2. Production Team Throughput & Velocity Report
router.get('/team', getTeamReportHandler);

// 3. Individual Worker Performance & Efficiency Report
router.get('/individual', getIndividualReportHandler);
router.get('/individual/:userId', getIndividualReportHandler);

// 4. Content Output & Pipeline Report
router.get('/content', getContentReportHandler);

// 5. Bottlenecks, Delays & Hold Reason Radar
router.get('/bottlenecks', getBottlenecksReportHandler);

// 6. Management Monthly Scorecard & Demand Forecast
router.get('/scorecard', getScorecardReportHandler);

// 7. Streaming Exports (XLSX, CSV, PDF)
router.get('/export', exportReportHandler);

// 8. Scheduled Email Reports
router.get('/scheduled', getScheduledReportsHandler);
router.post('/scheduled', createScheduledReportHandler);
router.delete('/scheduled/:id', deleteScheduledReportHandler);

export default router;
