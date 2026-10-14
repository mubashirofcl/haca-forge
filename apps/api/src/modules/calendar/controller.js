import * as calendarService from './service.js';

export async function listEntries(req, res, next) {
  try {
    const entries = await calendarService.listEntries(req.query, req.user);
    res.json({ data: entries });
  } catch (err) {
    next(err);
  }
}

export async function createEntry(req, res, next) {
  try {
    const io = req.app.get('io');
    const entry = await calendarService.createEntry(req.body, req.user, io);
    res.status(201).json({ data: entry });
  } catch (err) {
    next(err);
  }
}

export async function updateEntry(req, res, next) {
  try {
    const io = req.app.get('io');
    const entry = await calendarService.updateEntry(req.params.id, req.body, req.user, io);
    res.json({ data: entry });
  } catch (err) {
    next(err);
  }
}

export async function deleteEntry(req, res, next) {
  try {
    const io = req.app.get('io');
    const result = await calendarService.deleteEntry(req.params.id, req.user, io);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function approveEntries(req, res, next) {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        error: { code: 'INVALID_INPUT', message: 'An array of entry IDs is required.' },
      });
    }
    const result = await calendarService.approveEntries(ids, req.user);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function generateContent(req, res, next) {
  try {
    const io = req.app.get('io');
    const { entryIds } = req.body;
    if (!Array.isArray(entryIds) || entryIds.length === 0) {
      return res.status(400).json({
        error: { code: 'INVALID_INPUT', message: 'An array of entry IDs is required.' },
      });
    }
    const result = await calendarService.generateContentItems(entryIds, req.user, io);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function previewImport(req, res, next) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        error: { code: 'FILE_REQUIRED', message: 'Please upload an Excel (.xlsx) or CSV file.' },
      });
    }
    const result = await calendarService.previewBulkImport(
      req.file.buffer,
      req.file.mimetype,
      req.user
    );
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function commitImport(req, res, next) {
  try {
    const { entries, batchId } = req.body;
    const result = await calendarService.commitBulkImport(entries, batchId, req.user);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function downloadTemplate(req, res, next) {
  try {
    const buffer = await calendarService.generateExcelTemplate();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="haca-forge-calendar-template.xlsx"'
    );
    res.send(Buffer.from(buffer));
  } catch (err) {
    next(err);
  }
}

export async function getCapacity(req, res, next) {
  try {
    const { from, to } = req.query;
    const capacityReport = await calendarService.getTeamCapacityComparison(from, to);
    res.json({ data: capacityReport });
  } catch (err) {
    next(err);
  }
}

export async function publishContent(req, res, next) {
  try {
    const io = req.app.get('io');
    const content = await calendarService.publishContent(
      req.params.id,
      req.body,
      req.user,
      io
    );
    res.json({ data: content });
  } catch (err) {
    next(err);
  }
}
