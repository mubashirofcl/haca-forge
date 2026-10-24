import * as planService from './plan.service.js';
import * as importService from './import.service.js';

export async function listPlans(req, res, next) {
  try {
    const plans = await planService.listPlans(req.query, req.user);
    res.json({ data: plans });
  } catch (err) {
    next(err);
  }
}

export async function getPlan(req, res, next) {
  try {
    const plan = await planService.getPlanById(req.params.id, req.user);
    res.json({ data: plan });
  } catch (err) {
    next(err);
  }
}

export async function createPlan(req, res, next) {
  try {
    const plan = await planService.createPlan(req.body, req.user);
    res.status(201).json({ data: plan });
  } catch (err) {
    next(err);
  }
}

export async function updatePlan(req, res, next) {
  try {
    const plan = await planService.updatePlan(req.params.id, req.body, req.user);
    res.json({ data: plan });
  } catch (err) {
    next(err);
  }
}

export async function addRows(req, res, next) {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({
        error: { code: 'INVALID_INPUT', message: 'Array of rows is required.' },
      });
    }
    const plan = await planService.addRowsToPlan(req.params.id, rows, req.user);
    res.status(201).json({ data: plan });
  } catch (err) {
    next(err);
  }
}

export async function updateRow(req, res, next) {
  try {
    const row = await planService.updateRow(
      req.params.id,
      req.params.rowId,
      req.body,
      req.user
    );
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
}

export async function submitPlan(req, res, next) {
  try {
    const plan = await planService.submitPlan(req.params.id, req.user);
    res.json({ data: plan });
  } catch (err) {
    next(err);
  }
}

export async function reviewPlan(req, res, next) {
  try {
    const plan = await planService.reviewPlan(req.params.id, req.body, req.user);
    res.json({ data: plan });
  } catch (err) {
    next(err);
  }
}

export async function downloadTemplate(req, res, next) {
  try {
    const buffer = await importService.generateExcelTemplate();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="haca-calendar-plan-template.xlsx"'
    );
    res.send(Buffer.from(buffer));
  } catch (err) {
    next(err);
  }
}

export async function previewImport(req, res, next) {
  try {
    let rawRows = [];
    if (req.file && req.file.buffer) {
      rawRows = await importService.parseBufferToRows(
        req.file.buffer,
        req.file.mimetype || ''
      );
    } else if (Array.isArray(req.body.rows)) {
      rawRows = req.body.rows.map((r, idx) => ({ rowIndex: idx + 1, ...r }));
    } else {
      return res.status(400).json({
        error: {
          code: 'FILE_OR_ROWS_REQUIRED',
          message: 'Upload an Excel/CSV file or send rows array for validation preview.',
        },
      });
    }

    const validationResult = importService.validateImportRows(rawRows);
    res.json({ data: validationResult });
  } catch (err) {
    next(err);
  }
}

export async function commitImport(req, res, next) {
  try {
    const { planId, rows, planData } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({
        error: { code: 'INVALID_INPUT', message: 'Array of valid rows is required for commit.' },
      });
    }

    let targetPlanId = planId;
    if (!targetPlanId) {
      // Create new plan if no planId provided
      const newPlan = await planService.createPlan(
        {
          title: planData?.title || `Imported Plan ${new Date().toISOString().slice(0, 10)}`,
          kind: planData?.kind || 'monthly',
          periodStart: planData?.periodStart || new Date(),
          periodEnd: planData?.periodEnd || new Date(Date.now() + 30 * 86400000),
          comment: planData?.comment || 'Imported via spreadsheet',
        },
        req.user
      );
      targetPlanId = newPlan._id;
    }

    const plan = await planService.addRowsToPlan(targetPlanId, rows, req.user);
    res.status(201).json({ data: plan });
  } catch (err) {
    next(err);
  }
}
