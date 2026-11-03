import {
  listReportDefinitions,
  getReportDefinition,
  updateReportDefinition,
  generateReport,
  generateReportExport,
  createScheduledReport,
  getScheduledReports,
  deleteScheduledReport,
} from './service.js';
import { getDashboardOverview } from './dashboard.service.js';
import { reportGenerateSchema } from '@mmp/shared';

// -------------------------------------------------------------------
// Phase 7: 6 Marketing OS Report Definitions Endpoints
// -------------------------------------------------------------------

export async function listReportDefinitionsHandler(req, res, next) {
  try {
    const definitions = await listReportDefinitions();
    return res.status(200).json({ definitions });
  } catch (err) {
    next(err);
  }
}

export async function getReportDefinitionHandler(req, res, next) {
  try {
    const definition = await getReportDefinition(req.params.key);
    if (!definition) {
      return res.status(404).json({ error: { message: 'Report definition not found' } });
    }
    return res.status(200).json({ definition });
  } catch (err) {
    next(err);
  }
}

export async function updateReportDefinitionHandler(req, res, next) {
  try {
    const updated = await updateReportDefinition(req.params.key, req.body);
    if (!updated) {
      return res.status(404).json({ error: { message: 'Report definition not found' } });
    }
    return res.status(200).json({ success: true, definition: updated });
  } catch (err) {
    next(err);
  }
}

export async function generateReportHandler(req, res, next) {
  try {
    const parsed = reportGenerateSchema.safeParse(req.body || {});
    const input = parsed.success ? parsed.data : {};

    const reportKey = req.params.key;
    const filters = {};
    const month = input.month || req.query.month;
    if (month && month !== 'all') filters.month = month;
    const departmentId = input.departmentId || req.query.departmentId;
    if (departmentId && departmentId !== 'all') filters.departmentId = departmentId;

    const report = await generateReport(reportKey, filters, req.user, {
      sendEmail: input.sendEmail,
      recipients: req.body?.recipients,
    });

    return res.status(200).json({ success: true, report });
  } catch (err) {
    next(err);
  }
}

export async function viewReportHandler(req, res, next) {
  try {
    const reportKey = req.params.key;
    const report = await generateReport(reportKey, req.query, req.user);
    return res.status(200).json({ success: true, report });
  } catch (err) {
    next(err);
  }
}

// -------------------------------------------------------------------
// Legacy / Shared Handlers
// -------------------------------------------------------------------

export async function getDepartmentReportHandler(req, res, next) {
  try {
    const report = await generateReport('creative_production', req.query, req.user);
    return res.status(200).json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
}

export async function getTeamReportHandler(req, res, next) {
  try {
    const report = await generateReport('team_performance', req.query, req.user);
    return res.status(200).json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
}

export async function getIndividualReportHandler(req, res, next) {
  try {
    const report = await generateReport('team_performance', req.query, req.user);
    return res.status(200).json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
}

export async function getContentReportHandler(req, res, next) {
  try {
    const report = await generateReport('creative_production', req.query, req.user);
    return res.status(200).json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
}

export async function getBottlenecksReportHandler(req, res, next) {
  try {
    const report = await generateReport('weekly_marketing', req.query, req.user);
    return res.status(200).json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
}

export async function getScorecardReportHandler(req, res, next) {
  try {
    const report = await generateReport('monthly_scorecard', req.query, req.user);
    return res.status(200).json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
}

export async function exportReportHandler(req, res, next) {
  try {
    const reportKey = req.query.report || 'weekly_marketing';
    const report = await generateReport(reportKey, req.query, req.user);

    if (req.query.format === 'html') {
      res.setHeader('Content-Type', 'text/html');
      return res.send(report.html);
    }

    return res.status(200).json({
      success: true,
      report,
    });
  } catch (err) {
    next(err);
  }
}

export async function createScheduledReportHandler(req, res, next) {
  try {
    const report = await createScheduledReport(req.body, req.user);
    return res.status(201).json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
}

export async function getScheduledReportsHandler(req, res, next) {
  try {
    const reports = await getScheduledReports(req.user);
    return res.status(200).json({ success: true, data: reports });
  } catch (err) {
    next(err);
  }
}

export async function deleteScheduledReportHandler(req, res, next) {
  try {
    await deleteScheduledReport(req.params.id, req.user);
    return res.status(200).json({ success: true, message: 'Scheduled report cancelled' });
  } catch (err) {
    next(err);
  }
}

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
