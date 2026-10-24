import express from "express";
import { authenticate } from "../../middleware/auth.js";
import {
  requirePermission,
  requireAnyPermission,
} from "../../middleware/requirePermission.js";
import {
  listReportDefinitionsHandler,
  getReportDefinitionHandler,
  generateReportHandler,
  viewReportHandler,
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
} from "./controller.js";

const router = express.Router();

// All report routes require authentication and report.view or portal.view permission
router.use(authenticate);
router.use(requireAnyPermission("report.view", "portal.view"));

// -------------------------------------------------------------
// Phase 7: 6 Marketing OS Report Definitions Endpoints
// -------------------------------------------------------------
router.get("/definitions", listReportDefinitionsHandler);
router.get("/definitions/:key", getReportDefinitionHandler);
router.post(
  "/definitions/:key/generate",
  requirePermission("report.configure"),
  generateReportHandler,
);
router.post(
  "/:key/generate",
  requirePermission("report.configure"),
  generateReportHandler,
);
router.get("/view/:key", viewReportHandler);

// -------------------------------------------------------------
// Legacy & Export Routes
// -------------------------------------------------------------
router.get("/department", getDepartmentReportHandler);
router.get("/team", getTeamReportHandler);
router.get("/individual", getIndividualReportHandler);
router.get("/individual/:userId", getIndividualReportHandler);
router.get("/content", getContentReportHandler);
router.get("/bottlenecks", getBottlenecksReportHandler);
router.get("/scorecard", getScorecardReportHandler);
router.get("/export", exportReportHandler);

router.get("/scheduled", getScheduledReportsHandler);
router.post(
  "/scheduled",
  requirePermission("report.configure"),
  createScheduledReportHandler,
);
router.delete(
  "/scheduled/:id",
  requirePermission("report.configure"),
  deleteScheduledReportHandler,
);

export default router;
