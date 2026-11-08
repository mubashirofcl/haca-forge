import { getDashboardOverview } from './dashboard.service.js';

// Dashboard handlers (the Dashboard page). The old report-definition, generation,
// scheduling and export handlers were removed in Phase 7; live reports are in
// live.controller.js.

export async function getDashboardOverviewHandler(req, res, next) {
  try {
    const data = await getDashboardOverview(req.query, req.user);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getDashboardSummaryHandler(req, res, next) {
  try {
    const data = await getDashboardOverview(req.query, req.user);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
