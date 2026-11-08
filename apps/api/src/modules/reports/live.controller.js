import { normalizeRole } from '@mmp/shared';
import { LIVE_REPORTS, parseReportFilters, projectKpiReport } from './live.service.js';

/** Roles that may open a Project KPI page. Everyone else gets the same 404 as a missing project. */
const KPI_ROLES = ['admin', 'creative_head', 'sm_manager', 'executive'];

const notFound = (res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found' } });

export function liveReportHandler(name) {
  const build = LIVE_REPORTS[name];
  return async (req, res, next) => {
    try {
      const data = await build(parseReportFilters(req.query));
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };
}

export async function projectKpiHandler(req, res, next) {
  try {
    if (!KPI_ROLES.includes(normalizeRole(req.user?.role))) return notFound(res);
    const data = await projectKpiReport(req.params.id);
    if (!data) return notFound(res);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
