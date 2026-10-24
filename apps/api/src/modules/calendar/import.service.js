import ExcelJS from 'exceljs';
import { WORK_TYPES, normalizeWorkType } from '@mmp/shared';

export const TEMPLATE_COLUMNS = [
  { header: 'Posting Date', key: 'postingDate', width: 16 },
  { header: 'Topic', key: 'topic', width: 35 },
  { header: 'Type', key: 'contentType', width: 22 },
  { header: 'Needs Script (Reel only)', key: 'needsScript', width: 26 },
  { header: 'Needs Shoot (Reel only)', key: 'needsShoot', width: 26 },
  { header: 'Content Link', key: 'contentLink', width: 30 },
  { header: 'Remarks', key: 'remarks', width: 30 },
];

/**
 * Generates an Excel template workbook buffer
 */
export async function generateExcelTemplate() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'HACA Marketing OS';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Calendar Plan');
  worksheet.columns = TEMPLATE_COLUMNS;

  // Header styling
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' }, // slate-800
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 28;

  // Add sample rows for guidance
  const today = new Date();
  const nextWeek = new Date(today.getTime() + 7 * 86400000);
  const twoWeeks = new Date(today.getTime() + 14 * 86400000);

  worksheet.addRow({
    postingDate: nextWeek.toISOString().slice(0, 10),
    topic: 'Alumni Success Story Reel - Sarah M.',
    contentType: 'Reel',
    needsScript: 'Yes',
    needsShoot: 'Yes',
    contentLink: 'https://docs.google.com/document/d/sample-script',
    remarks: 'Focus on transformation & placement',
  });

  worksheet.addRow({
    postingDate: twoWeeks.toISOString().slice(0, 10),
    topic: 'Admissions Open - Batch 14 Poster',
    contentType: 'Static Post',
    needsScript: 'No',
    needsShoot: 'No',
    contentLink: '',
    remarks: 'Include scholarship deadline',
  });

  return workbook.xlsx.writeBuffer();
}

/**
 * Normalizes boolean inputs from Excel/CSV (Yes/No, true/false, 1/0)
 */
function parseBoolean(val) {
  if (val === true || val === 1 || val === '1') return true;
  if (!val) return false;
  const s = String(val).trim().toLowerCase();
  return s === 'yes' || s === 'y' || s === 'true';
}

/**
 * Parses buffer (Excel or CSV) into raw row objects
 */
export async function parseBufferToRows(buffer, mimetype = '') {
  const workbook = new ExcelJS.Workbook();
  const isCsv =
    mimetype.includes('csv') ||
    mimetype.includes('text') ||
    buffer.toString('utf8', 0, 100).includes(',') ||
    buffer.toString('utf8', 0, 100).includes('Posting Date');

  if (isCsv) {
    const stream = new (await import('stream')).Readable();
    stream.push(buffer);
    stream.push(null);
    await workbook.csv.read(stream);
  } else {
    await workbook.xlsx.load(buffer);
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const rows = [];
  let headerMap = {};

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) {
      // Map column headers
      row.eachCell((cell, colNumber) => {
        const val = String(cell.value || '').trim().toLowerCase();
        if (val.includes('posting') || val.includes('date')) headerMap[colNumber] = 'postingDate';
        else if (val.includes('topic') || val.includes('title')) headerMap[colNumber] = 'topic';
        else if (val === 'type' || val.includes('content type') || val.includes('format')) headerMap[colNumber] = 'contentType';
        else if (val.includes('script')) headerMap[colNumber] = 'needsScript';
        else if (val.includes('shoot')) headerMap[colNumber] = 'needsShoot';
        else if (val.includes('link') || val.includes('url')) headerMap[colNumber] = 'contentLink';
        else if (val.includes('remark') || val.includes('note')) headerMap[colNumber] = 'remarks';
      });
      return;
    }

    const rowData = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const field = headerMap[colNumber];
      if (field) {
        let val = cell.value;
        if (val && typeof val === 'object' && val.text) val = val.text;
        if (val && typeof val === 'object' && val.result !== undefined) val = val.result;
        rowData[field] = val;
      }
    });

    if (Object.keys(rowData).length > 0) {
      rows.push({
        rowIndex: rowNumber,
        ...rowData,
      });
    }
  });

  return rows;
}

/**
 * Validates extracted rows according to R3 business rules:
 * - Bad/missing date
 * - Past dates
 * - Unknown content types
 * - Duplicates
 * - Flags on non-reels
 */
export function validateImportRows(rawRows) {
  const validatedRows = [];
  const seenCombinations = new Set();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  for (const raw of rawRows) {
    const errors = [];
    const warnings = [];

    // 1. Topic validation
    const topic = typeof raw.topic === 'string' ? raw.topic.trim() : String(raw.topic || '').trim();
    if (!topic || topic.length < 2) {
      errors.push('Topic is required (minimum 2 characters)');
    }

    // 2. Date validation
    let postingDate = null;
    if (raw.postingDate) {
      const parsedDate = new Date(raw.postingDate);
      if (isNaN(parsedDate.getTime())) {
        errors.push('Invalid date format for Posting Date');
      } else {
        postingDate = parsedDate;
        if (parsedDate < startOfToday) {
          errors.push('Posting Date cannot be in the past');
        }
      }
    } else {
      errors.push('Posting Date is required');
    }

    // 3. Content Type validation
    const rawType = typeof raw.contentType === 'string' ? raw.contentType.trim() : String(raw.contentType || '').trim();
    const normalizedType = normalizeWorkType(rawType);
    const isValidType = WORK_TYPES.some((t) => t.toLowerCase() === normalizedType.toLowerCase());

    if (!rawType) {
      errors.push('Content Type is required');
    } else if (!isValidType) {
      errors.push(`Unknown content type: "${rawType}"`);
    }

    // 4. Flags on non-reels
    const needsScript = parseBoolean(raw.needsScript);
    const needsShoot = parseBoolean(raw.needsShoot);
    const isReel = normalizedType.toLowerCase() === 'reel';

    if (!isReel && (needsScript || needsShoot)) {
      errors.push('Needs Script and Needs Shoot flags apply only to Reels');
    }

    // 5. Duplicates detection (same date + topic + type)
    if (postingDate && topic && isValidType) {
      const dateKey = postingDate.toISOString().slice(0, 10);
      const comboKey = `${dateKey}:::${topic.toLowerCase()}:::${normalizedType.toLowerCase()}`;
      if (seenCombinations.has(comboKey)) {
        errors.push(`Duplicate row: "${topic}" on ${dateKey} already exists in this plan`);
      } else {
        seenCombinations.add(comboKey);
      }
    }

    const rowObj = {
      rowIndex: raw.rowIndex,
      postingDate: postingDate ? postingDate.toISOString() : null,
      topic: topic || '',
      contentType: isValidType ? normalizedType : rawType || '',
      needsScript: isReel ? needsScript : false,
      needsShoot: isReel ? needsShoot : false,
      contentLink: typeof raw.contentLink === 'string' ? raw.contentLink.trim() : '',
      remarks: typeof raw.remarks === 'string' ? raw.remarks.trim() : '',
      isValid: errors.length === 0,
      errors,
      warnings,
    };

    validatedRows.push(rowObj);
  }

  const validCount = validatedRows.filter((r) => r.isValid).length;
  const errorCount = validatedRows.filter((r) => !r.isValid).length;

  return {
    rows: validatedRows,
    totalRows: validatedRows.length,
    validCount,
    errorCount,
    hasErrors: errorCount > 0,
  };
}
