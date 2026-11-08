import express from "express";
import { authenticate } from "../../middleware/auth.js";
import { requireAnyPermission } from "../../middleware/requirePermission.js";
import { liveReportHandler, projectKpiHandler } from "./live.controller.js";

/**
 * Reports (Phase 7): live figures only. Report definitions, generation, scheduled report
 * emails and HTML export were removed; their routes now answer 404.
 */
const router = express.Router();

router.use(authenticate);

// A project's KPI page. Registered before the report permission check so that a team
// member gets the same 404 as a project that does not exist.
router.get("/projects/:id", projectKpiHandler);

router.use(requireAnyPermission("report.view", "portal.view"));

// Live reports, computed on request (filters: month, calendar, stepType).
router.get("/overview", liveReportHandler("overview"));
router.get("/overdue", liveReportHandler("overdue"));
router.get("/production", liveReportHandler("production"));
router.get("/quality", liveReportHandler("quality"));
router.get("/projects", liveReportHandler("projects"));

export default router;
