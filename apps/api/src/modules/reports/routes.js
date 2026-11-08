import express from "express";
import { authenticate } from "../../middleware/auth.js";
import {
  requirePermission,
  requireAnyPermission,
} from "../../middleware/requirePermission.js";
import {
  listReportDefinitionsHandler,
  getReportDefinitionHandler,
  updateReportDefinitionHandler,
  generateReportHandler,
  viewReportHandler,
  getDepartmentReportHandler,
  getTeamReportHandler,
  getContentReportHandler,
  getBottlenecksReportHandler,
  getScorecardReportHandler,
  exportReportHandler,
  createScheduledReportHandler,
  getScheduledReportsHandler,
  deleteScheduledReportHandler,
} from "./controller.js";
import { liveReportHandler, projectKpiHandler } from "./live.controller.js";

const router = express.Router();

// All report routes require authentication and report.view or portal.view permission
router.use(authenticate);

// Phase 7: a project's KPI page. Registered before the report permission check so that a
// team member gets the same 404 as a project that does not exist.
router.get("/projects/:id", projectKpiHandler);

router.use(requireAnyPermission("report.view", "portal.view"));

// Phase 7: live reports, computed on request (filters: month, calendar, stepType).
router.get("/overview", liveReportHandler("overview"));
router.get("/overdue", liveReportHandler("overdue"));
router.get("/production", liveReportHandler("production"));
router.get("/quality", liveReportHandler("quality"));
router.get("/projects", liveReportHandler("projects"));

// -------------------------------------------------------------
// Phase 7: 6 Marketing OS Report Definitions Endpoints
// -------------------------------------------------------------
router.get("/definitions", listReportDefinitionsHandler);
router.get("/definitions/:key", getReportDefinitionHandler);
router.patch(
  "/definitions/:key",
  requirePermission("report.configure"),
  updateReportDefinitionHandler,
);
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
// No /individual routes: reports show team-level totals only, never one person.
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
