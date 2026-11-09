import * as planService from './plan.service.js';
import * as planGridService from './planGrid.service.js';

export async function getGrid(req, res, next) {
  try {
    const data = await planGridService.loadGrid(
      { calendar: req.query.calendar || 'sm', month: req.query.month, planId: req.query.planId },
      req.user
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function uploadGridFile(req, res, next) {
  try {
    const data = await planGridService.uploadGridFile(
      {
        buffer: req.file?.buffer,
        mimetype: req.file?.mimetype || '',
        calendar: req.body.calendar || 'sm',
        month: req.body.month,
        planId: req.body.planId || undefined,
        dryRun: req.body.dryRun === true || req.body.dryRun === 'true',
      },
      req.user
    );
    res.status(data.counts.saved > 0 ? 201 : 200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function saveGridRows(req, res, next) {
  try {
    const data = await planGridService.saveGridRows(req.body || {}, req.user);
    res.status(data.counts.saved > 0 ? 201 : 200).json({ data });
  } catch (err) {
    next(err);
  }
}
import * as importService from './import.service.js';
import { autofillRowPlan } from './autofill.service.js';
import { validatePlanAndRows } from './validation.js';
import { ContentPiece } from './contentPiece.model.js';
import { CalendarPlan } from './plan.model.js';

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

export async function deletePlan(req, res, next) {
  try {
    const result = await planService.deletePlan(req.params.id, req.user);
    res.json({ success: true, message: 'Plan deleted successfully', data: result });
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

export async function deleteRow(req, res, next) {
  try {
    const plan = await planService.deleteRow(
      req.params.id,
      req.params.rowId,
      req.user
    );
    res.json({ data: plan, message: 'Row deleted successfully' });
  } catch (err) {
    next(err);
  }
}

export async function submitRow(req, res, next) {
  try {
    const plan = await planService.submitRow(
      req.params.id,
      req.params.rowId,
      req.user
    );
    res.json({ data: plan, message: 'Row submitted for review' });
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
    const layout = req.query.layout === 'legacy' ? 'legacy' : 'grid';
    const buffer = await importService.generateExcelTemplate({ layout });
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

    const validationResult = await importService.validateImportRows(rawRows);
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

export async function autofillRow(req, res, next) {
  try {
    const { type, postingDate, needsScript, needsShoot, needsContent, currentPlanRows } = req.body;
    const planId = req.params.id;
    let existingRows = currentPlanRows || [];
    if (planId && (!existingRows || existingRows.length === 0)) {
      existingRows = await ContentPiece.find({ planId }).lean();
    }
    const autofillData = await autofillRowPlan({
      type,
      postingDate,
      needsScript,
      needsShoot,
      needsContent: needsContent !== false,
      currentPlanRows: existingRows,
    });
    res.json({ data: autofillData });
  } catch (err) {
    next(err);
  }
}

export async function validatePlan(req, res, next) {
  try {
    const planId = req.params.id;
    const plan = planId ? await CalendarPlan.findById(planId).lean() : req.body.plan;
    const rows = req.body.rows || (planId ? await ContentPiece.find({ planId }).lean() : []);
    const validation = await validatePlanAndRows({
      plan,
      rows,
      isSubmitting: Boolean(req.body.isSubmitting),
    });
    res.json({ data: validation });
  } catch (err) {
    next(err);
  }
}

export async function moveCalendar(req, res, next) {
  try {
    const { calendar } = req.body;
    const plan = await planService.movePlanCalendar(req.params.id, calendar, req.user);
    res.json({ success: true, data: plan });
  } catch (err) {
    next(err);
  }
}
