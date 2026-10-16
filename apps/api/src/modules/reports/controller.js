import {
  getDepartmentReport,
  getTeamReport,
  getIndividualReport,
  getContentReport,
  getBottlenecksReport,
  getScorecardReport,
  generateReportExport,
  createScheduledReport,
  getScheduledReports,
  deleteScheduledReport,
} from './service.js';
import { getDashboardSummaryByRole } from './dashboard.service.js';

export async function getDepartmentReportHandler(req, res, next) {
  try {
    const report = await getDepartmentReport(req.query, req.user);
    return res.status(200).json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
}

export async function getTeamReportHandler(req, res, next) {
  try {
    const report = await getTeamReport(req.query, req.user);
    return res.status(200).json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
}

export async function getIndividualReportHandler(req, res, next) {
  try {
    const targetUserId = req.params.userId || req.user.userId;
    const report = await getIndividualReport(targetUserId, req.query, req.user);
    return res.status(200).json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
}

export async function getContentReportHandler(req, res, next) {
  try {
    const report = await getContentReport(req.query, req.user);
    return res.status(200).json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
}

export async function getBottlenecksReportHandler(req, res, next) {
  try {
    const report = await getBottlenecksReport(req.query, req.user);
    return res.status(200).json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
}

export async function getScorecardReportHandler(req, res, next) {
  try {
    const report = await getScorecardReport(req.query, req.user);
    return res.status(200).json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
}

export async function exportReportHandler(req, res, next) {
  try {
    const reportType = req.query.report || 'scorecard';
    const format = (req.query.format || 'xlsx').toLowerCase();
    const { workbook, filename, data } = await generateReportExport({
      reportType,
      format,
      filters: req.query,
      user: req.user,
    });

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      return await workbook.csv.write(res);
    }

    if (format === 'pdf') {
      // PDF summary export: returns clean JSON/HTML payload or stream
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({
        success: true,
        filename: `${filename}.pdf`,
        summary: data,
        note: 'Formatted PDF printable document data ready for print rendering',
      });
    }

    // Default: XLSX
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
    return await workbook.xlsx.write(res);
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

export async function getDashboardSummaryHandler(req, res, next) {
  try {
    const role = req.params.role || req.user.role;
    const summary = await getDashboardSummaryByRole(role, req.user);
    return res.status(200).json({ success: true, data: summary });
  } catch (err) {
    next(err);
  }
}
