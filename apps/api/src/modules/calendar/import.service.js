import ExcelJS from 'exceljs';
import { parsePriorityInput } from '@mmp/shared';
import {
  WORK_TYPES,
  normalizeWorkType,
  getPipelineForContent,
  calculateStageDueDate,
  DEFAULT_STAGE_HOURS,
  isPostableWorkType,
  STAGE_DUE_OFFSETS,
  DELIVERABLE_TYPE_KEYS,
  PLAN_GRID_COLUMNS,
  PLAN_GRID_EXTRA_COLUMNS,
  TURNAROUND_HELP,
  isNewPlanLayout,
  planGridColumnForHeader,
  matchGridOwner,
} from '@mmp/shared';
import { Person } from '../people/model.js';
import { WorkItem } from '../workItems/model.js';

export const TEMPLATE_COLUMNS = [
  { header: 'Posting Date', key: 'postingDate', width: 16 },
  { header: 'Posting Time', key: 'postingTime', width: 14 },
  { header: 'Topic', key: 'topic', width: 35 },
  { header: 'Type', key: 'contentType', width: 22 },
  { header: 'Program or Event', key: 'programOrEvent', width: 25 },
  { header: 'Brief', key: 'brief', width: 35 },
  { header: 'Reference Link', key: 'referenceLink', width: 30 },
  { header: 'Priority', key: 'priority', width: 14 },
  { header: 'Posting Owner', key: 'postingOwner', width: 28 },
  { header: 'Content Owner', key: 'contentOwner', width: 28 },
  { header: 'Content Deadline', key: 'contentDeadline', width: 18 },
  { header: 'Script Owner', key: 'scriptOwner', width: 28 },
  { header: 'Script Deadline', key: 'scriptDeadline', width: 18 },
  { header: 'Needs Script', key: 'needsScript', width: 16 },
  { header: 'Needs Shoot', key: 'needsShoot', width: 16 },
  { header: 'Shoot Owner', key: 'shootOwner', width: 28 },
  { header: 'Shoot Deadline', key: 'shootDeadline', width: 18 },
  { header: 'Edit Owner', key: 'editOwner', width: 28 },
  { header: 'Edit Deadline', key: 'editDeadline', width: 18 },
  { header: 'Design Owner', key: 'designOwner', width: 28 },
  { header: 'Design Deadline', key: 'designDeadline', width: 18 },
  { header: 'Source Video Link', key: 'sourceVideoLink', width: 30 },
  { header: 'Remarks', key: 'remarks', width: 30 },
];

/**
 * Plan template. Default: the 18 Excel columns plus the optional Content Owner and
 * Design Owner columns, matched by exact name. `layout: 'legacy'` returns the older
 * 23-column file (owners by email), which uploads still accept.
 */
export async function generateExcelTemplate({ layout = 'grid' } = {}) {
  if (layout === 'legacy') return generateLegacyExcelTemplate();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'HACA Marketing OS';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Calendar Plan', { views: [{ state: 'frozen', xSplit: 3, ySplit: 1 }] });
  const allColumns = [...PLAN_GRID_COLUMNS, ...PLAN_GRID_EXTRA_COLUMNS];
  sheet.columns = allColumns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.key === 'topic' || c.key === 'remarks' ? 36 : c.key.endsWith('Owner') ? 24 : 16,
  }));

  const header = sheet.getRow(1);
  header.height = 30;
  header.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  allColumns.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.font = { bold: true, color: { argb: c.editable ? 'FFFFFFFF' : 'FF0B0B0D' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c.editable ? 'FF0B0B0D' : 'FFDDE2EB' } };
    if (!c.editable) cell.note = 'Filled by the app. Leave blank; anything typed here is ignored.';
    else if (c.optional) cell.note = 'Optional. Only for rows with this step (e.g. Static Post, Carousel Post).';
  });

  // Type dropdown: the 15 documented types; Excel words (Poster, Carousal) are also accepted when typed.
  const typeCol = allColumns.findIndex((c) => c.key === 'type') + 1;
  for (let r = 2; r <= 300; r++) {
    sheet.getCell(r, typeCol).dataValidation = {
      type: 'list',
      allowBlank: true,
      showErrorMessage: false,
      formulae: [`"${DELIVERABLE_TYPE_KEYS.join(',')}"`],
    };
  }

  const help = workbook.addWorksheet('How to fill');
  help.columns = [{ width: 110 }];
  [
    'One row per post. Black headers are yours to fill; grey headers are filled by the app and ignored on upload.',
    'Posting Date: 2 Nov, 2026 or 16/11/2026 (day/month/year). A date like 02/11/2026 is accepted only when exactly one reading falls in the plan month.',
    `Type: ${DELIVERABLE_TYPE_KEYS.join(', ')}. "Poster" typed by hand means Static Post; "Carousal" means Carousel Post.`,
    'Owners: the person\'s exact name as it appears in the app. Leave blank to let the app suggest someone.',
    'Script/Shoot owners apply to reels only; Content/Design owners apply to design rows (Static Post, Carousel Post and the other design types).',
    TURNAROUND_HELP,
  ].forEach((line) => help.addRow([line]));

  return workbook.xlsx.writeBuffer();
}

/** Older 23-column template (owners by email). */
async function generateLegacyExcelTemplate() {
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
    postingTime: '18:00',
    topic: 'Alumni Success Story Reel - Sarah M.',
    contentType: 'Reel',
    programOrEvent: 'HACA Admissions',
    brief: 'Focus on transformation & placement',
    referenceLink: 'https://docs.google.com/document/d/sample-script',
    priority: 'Normal',
    postingOwner: 'smmanager@demo.haca.local',
    contentOwner: '',
    contentDeadline: '',
    scriptOwner: 'writer1@demo.haca.local',
    scriptDeadline: new Date(nextWeek.getTime() - 8 * 86400000).toISOString().slice(0, 10),
    needsScript: 'Yes',
    needsShoot: 'Yes',
    shootOwner: 'shooter@demo.haca.local',
    shootDeadline: new Date(nextWeek.getTime() - 5 * 86400000).toISOString().slice(0, 10),
    editOwner: 'editor1@demo.haca.local',
    editDeadline: new Date(nextWeek.getTime() - 2 * 86400000).toISOString().slice(0, 10),
    designOwner: '',
    designDeadline: '',
    sourceVideoLink: '',
    remarks: 'Approved concept',
  });

  worksheet.addRow({
    postingDate: twoWeeks.toISOString().slice(0, 10),
    postingTime: '18:00',
    topic: 'Admissions Open - Batch 14 Poster',
    contentType: 'Static Post',
    programOrEvent: 'Admissions Campaign',
    brief: 'Include scholarship deadline and eligibility',
    referenceLink: '',
    priority: 'Normal',
    postingOwner: 'smmanager@demo.haca.local',
    contentOwner: 'writer1@demo.haca.local',
    contentDeadline: new Date(twoWeeks.getTime() - 5 * 86400000).toISOString().slice(0, 10),
    scriptOwner: '',
    scriptDeadline: '',
    needsScript: 'No',
    needsShoot: 'No',
    shootOwner: '',
    shootDeadline: '',
    editOwner: '',
    editDeadline: '',
    designOwner: 'designer1@demo.haca.local',
    designDeadline: new Date(twoWeeks.getTime() - 2 * 86400000).toISOString().slice(0, 10),
    sourceVideoLink: '',
    remarks: 'Focus on visual branding',
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
 * An .xlsx file is a zip ("PK"); anything else is read as CSV. The old check
 * ("a comma in the first 100 bytes") also matched zip bytes, so real Excel files were
 * read as CSV and came back empty.
 */
export function looksLikeCsv(buffer, mimetype = '') {
  const isZip = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
  if (isZip) return false;
  return (
    mimetype.includes('csv') ||
    mimetype.includes('text') ||
    buffer.toString('utf8', 0, 100).includes(',') ||
    buffer.toString('utf8', 0, 100).includes('Posting Date')
  );
}

/** Plain text for an ExcelJS cell value. Excel dates (UTC midnight) become YYYY-MM-DD. */
export function cellText(val) {
  if (val === null || val === undefined) return '';
  if (val instanceof Date) return isNaN(val.getTime()) ? '' : val.toISOString().slice(0, 10);
  if (typeof val === 'object') {
    if (Array.isArray(val.richText)) return val.richText.map((t) => t.text).join('');
    if (val.text !== undefined) return cellText(val.text);
    if (val.result !== undefined) return cellText(val.result);
    if (val.hyperlink) return String(val.hyperlink);
    return '';
  }
  return String(val);
}

async function loadFirstWorksheet(buffer, mimetype = '') {
  const workbook = new ExcelJS.Workbook();
  const isCsv = looksLikeCsv(buffer, mimetype);
  if (isCsv) {
    const stream = new (await import('stream')).Readable();
    stream.push(buffer);
    stream.push(null);
    await workbook.csv.read(stream);
  } else {
    await workbook.xlsx.load(buffer);
  }
  return workbook.worksheets[0] || null;
}

const LEGACY_OWNER_FIELDS = ['postingOwner', 'contentOwner', 'scriptOwner', 'shootOwner', 'editOwner', 'designOwner'];
const LEGACY_DEADLINE_STAGE = {
  contentDeadline: 'Content',
  scriptDeadline: 'Script',
  shootDeadline: 'Shoot',
  editDeadline: 'Edit',
  designDeadline: 'Design',
};

/**
 * Read an uploaded plan file into grid cell maps.
 * - New layout (18 Excel columns + optional Content/Design Owner): owners by exact name.
 * - Older 23-column layout: mapped onto the same cells; owner emails are kept in
 *   `<field>Email` so the caller can resolve them, and step deadlines go to `deadlines`.
 */
export async function parseBufferToGridInput(buffer, mimetype = '') {
  const sheet = await loadFirstWorksheet(buffer, mimetype);
  if (!sheet) return { layout: 'empty', rows: [] };
  const headers = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col] = cellText(cell.value).trim();
  });

  if (isNewPlanLayout(headers.filter(Boolean))) {
    const keyByCol = headers.map((h) => (h ? planGridColumnForHeader(h) : null));
    const rows = [];
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      const cells = {};
      row.eachCell({ includeEmpty: false }, (cell, col) => {
        const key = keyByCol[col];
        const text = cellText(cell.value).trim();
        if (key && text) cells[key] = text;
      });
      if (Object.keys(cells).length) rows.push({ rowIndex: rowNumber, cells });
    });
    return { layout: 'grid', rows };
  }

  const legacy = await parseBufferToRows(buffer, mimetype);
  const rows = legacy.map((r) => {
    const cells = {};
    const set = (k, v) => {
      const t = cellText(v).trim();
      if (t) cells[k] = t;
    };
    set('postingDate', r.postingDate);
    set('topic', r.topic);
    set('type', r.contentType);
    set('publishTime', r.postingTime);
    set('programOrEvent', r.programOrEvent);
    set('brief', r.brief);
    set('referenceLink', r.referenceLink);
    set('priority', r.priority);
    set('sourceVideoLink', r.sourceVideoLink);
    set('contentLink', r.contentLink);
    set('remarks', r.remarks);
    if (r.needsScript !== undefined && cellText(r.needsScript).trim()) cells.needsScript = cellText(r.needsScript).trim();
    if (r.needsShoot !== undefined && cellText(r.needsShoot).trim()) cells.needsShoot = cellText(r.needsShoot).trim();
    for (const f of LEGACY_OWNER_FIELDS) {
      const v = cellText(r[f]).trim();
      if (!v) continue;
      if (v.includes('@')) cells[`${f}Email`] = v;
      else cells[f] = v;
    }
    const deadlines = {};
    for (const [f, stage] of Object.entries(LEGACY_DEADLINE_STAGE)) {
      const v = cellText(r[f]).trim();
      if (v) deadlines[stage] = v;
    }
    if (Object.keys(deadlines).length) cells.deadlines = deadlines;
    return { rowIndex: r.rowIndex, cells };
  });
  return { layout: 'legacy', rows };
}

/**
 * Parses buffer (Excel or CSV) into raw row objects
 */
export async function parseBufferToRows(buffer, mimetype = '') {
  const workbook = new ExcelJS.Workbook();
  const isCsv = looksLikeCsv(buffer, mimetype);

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
        if (val.includes('posting date') || val === 'date' || val.includes('publish date') || val.includes('needed-by')) headerMap[colNumber] = 'postingDate';
        else if (val.includes('posting time') || val === 'time' || val.includes('publish time')) headerMap[colNumber] = 'postingTime';
        else if (val.includes('topic') || val.includes('title')) headerMap[colNumber] = 'topic';
        else if (val === 'type' || val.includes('content type') || val.includes('format')) headerMap[colNumber] = 'contentType';
        else if (val.includes('program') || val.includes('event')) headerMap[colNumber] = 'programOrEvent';
        else if (val.includes('brief')) headerMap[colNumber] = 'brief';
        else if (val.includes('reference link') || val.includes('ref link')) headerMap[colNumber] = 'referenceLink';
        else if (val.includes('priority')) headerMap[colNumber] = 'priority';
        else if (val.includes('posting owner') || val.includes('post owner')) headerMap[colNumber] = 'postingOwner';
        else if (val.includes('content owner')) headerMap[colNumber] = 'contentOwner';
        else if (val.includes('content deadline')) headerMap[colNumber] = 'contentDeadline';
        else if (val.includes('script owner')) headerMap[colNumber] = 'scriptOwner';
        else if (val.includes('script deadline')) headerMap[colNumber] = 'scriptDeadline';
        else if (val.includes('needs script') || val === 'script') headerMap[colNumber] = 'needsScript';
        else if (val.includes('needs shoot') || val === 'shoot') headerMap[colNumber] = 'needsShoot';
        else if (val.includes('shoot owner')) headerMap[colNumber] = 'shootOwner';
        else if (val.includes('shoot deadline')) headerMap[colNumber] = 'shootDeadline';
        else if (val.includes('edit owner')) headerMap[colNumber] = 'editOwner';
        else if (val.includes('edit deadline')) headerMap[colNumber] = 'editDeadline';
        else if (val.includes('design owner')) headerMap[colNumber] = 'designOwner';
        else if (val.includes('design deadline')) headerMap[colNumber] = 'designDeadline';
        else if (val.includes('source video') || val.includes('video link')) headerMap[colNumber] = 'sourceVideoLink';
        else if (val.includes('content link') || val.includes('drive')) headerMap[colNumber] = 'contentLink';
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
 * Validates extracted rows according to Workflow V2 business rules:
 * - Bad/missing date
 * - Past dates
 * - Unknown content types
 * - Duplicates
 * - Flags on non-reels
 * - Step owners and deadlines (suggests blanks)
 */
export async function validateImportRows(rawRows) {
  const validatedRows = [];
  const seenCombinations = new Set();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // Fetch active team members for owner lookup and autofill
  const activeMembers = await Person.find({
    role: { $in: ['team_member', 'sm_manager', 'admin'] },
    status: 'active',
  }).lean();
  const membersByEmail = new Map();
  const membersById = new Map();
  for (const m of activeMembers) {
    if (m.email) membersByEmail.set(m.email.toLowerCase().trim(), m);
    membersById.set(m._id.toString(), m);
  }

  /** Owner cell: an email (older files) or an exact name (new files, same rules as the grid). */
  function findOwner(raw) {
    const s = String(raw || '').trim();
    if (s.includes('@')) return { member: membersByEmail.get(s.toLowerCase()) || null };
    const r = matchGridOwner(s, activeMembers.map((m) => ({ _id: m._id.toString(), name: m.name })));
    if (!r.ok) return { member: null, error: r.error };
    return { member: r.empty ? null : membersById.get(r.id) };
  }

  // Pre-calculate workload per member
  const memberWorkload = new Map();
  for (const m of activeMembers) {
    const openItems = await WorkItem.find({
      ownerId: m._id,
      status: { $in: ['Not Started', 'In Progress', 'Feedback'] },
    }).select('estimatedEffortHrs').lean();
    const totalHours = openItems.reduce((acc, it) => acc + (it.estimatedEffortHrs || 4), 0);
    const capacity = m.weeklyCapacityHours || 40;
    const pct = capacity > 0 ? Math.round((totalHours / capacity) * 100) : 0;
    memberWorkload.set(m._id.toString(), pct);
  }

  function pickBestMemberForStage(stageKey) {
    const eligible = activeMembers.filter((m) => {
      const prefs = m.workPreferences || [];
      const load = memberWorkload.get(m._id.toString()) || 0;
      return prefs.includes(stageKey) && load < 85;
    });

    if (eligible.length === 0) return null;
    eligible.sort((a, b) => {
      const loadA = memberWorkload.get(a._id.toString()) || 0;
      const loadB = memberWorkload.get(b._id.toString()) || 0;
      return loadA - loadB;
    });
    return eligible[0];
  }

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
    if (parsePriorityInput(raw.priority) === null) {
      errors.push(`Priority must be Normal or Urgent (got "${String(raw.priority).trim()}")`);
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
    let needsScript = parseBoolean(raw.needsScript);
    let needsShoot = parseBoolean(raw.needsShoot);
    const isReel = normalizedType.toLowerCase() === 'reel';

    if (rawType.toLowerCase() === 'reel a') {
      needsScript = true;
      needsShoot = true;
    } else if (rawType.toLowerCase() === 'reel b') {
      needsScript = false;
      needsShoot = true;
    } else if (rawType.toLowerCase() === 'reel c') {
      needsScript = false;
      needsShoot = false;
    }

    if (!isReel && (needsScript || needsShoot)) {
      errors.push('Needs Script and Needs Shoot flags apply only to Reels');
    }

    // Source video link check
    const sourceVideoLink = typeof raw.sourceVideoLink === 'string' ? raw.sourceVideoLink.trim() : '';
    if (isReel && !needsShoot && !sourceVideoLink) {
      errors.push('Source video link is required when Reel does not need a shoot.');
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

    // 6. Build and validate Stage Plan
    const stagePlan = [];
    let postingOwnerId = null;
    let postingOwnerName = '';
    let isPostingOwnerSuggested = false;

    if (isValidType && postingDate) {
      const pipelineInfo = getPipelineForContent({
        contentType: normalizedType,
        needsScript: isReel ? needsScript : false,
        needsShoot: isReel ? needsShoot : false,
      });

      const stageInputMap = {
        Script: { owner: raw.scriptOwner, deadline: raw.scriptDeadline },
        Shoot: { owner: raw.shootOwner, deadline: raw.shootDeadline },
        Edit: { owner: raw.editOwner, deadline: raw.editDeadline },
        Content: { owner: raw.contentOwner, deadline: raw.contentDeadline },
        Design: { owner: raw.designOwner, deadline: raw.designDeadline },
        Post: { owner: raw.postingOwner, deadline: raw.postingDate },
      };

      let prevDate = null;
      let lastCreationDate = null;

      for (const stageKey of pipelineInfo.stages) {
        const input = stageInputMap[stageKey] || {};
        let ownerId = null;
        let ownerName = '';
        let ownerSource = 'suggested';
        let ownerReason = '';
        let dueDate = null;
        let dueDateSource = 'auto';

        // Check owner (email in older files, exact name in new ones)
        if (input.owner && String(input.owner).trim()) {
          const email = String(input.owner).toLowerCase().trim();
          const found = findOwner(input.owner);
          const member = found.member;
          if (found.error) {
            errors.push(`${stageKey} owner: ${found.error}`);
          } else if (member) {
            if (stageKey !== 'Post') {
              const prefs = member.workPreferences || [];
              if (!prefs.includes(stageKey)) {
                errors.push(`${member.name} (${email}) does not have "${stageKey}" in work preferences`);
              }
            }
            ownerId = member._id.toString();
            ownerName = member.name;
            ownerSource = 'manual';
          } else {
            errors.push(`Owner "${input.owner}" for ${stageKey} is not an active team member`);
          }
        } else {
          // Autofill owner
          const best = pickBestMemberForStage(stageKey);
          if (best) {
            ownerId = best._id.toString();
            ownerName = best.name;
            ownerSource = 'suggested';
            ownerReason = `Lowest workload (${memberWorkload.get(best._id.toString()) || 0}%)`;
          } else {
            ownerReason = 'No available person with this role';
          }
        }

        // Check deadline
        if (input.deadline && String(input.deadline).trim()) {
          const parsedDue = new Date(input.deadline);
          if (isNaN(parsedDue.getTime())) {
            errors.push(`Invalid deadline date for ${stageKey}: "${input.deadline}"`);
          } else {
            dueDate = parsedDue;
            dueDateSource = 'manual';
          }
        } else {
          // Calculate suggested deadline from F
          dueDate = calculateStageDueDate(
            postingDate,
            pipelineInfo.pipeline,
            stageKey,
            pipelineInfo.hasPostStage
          );
          dueDateSource = 'auto';
        }

        // Validate deadline order & bounds
        if (dueDate) {
          const dueMidnight = new Date(dueDate);
          dueMidnight.setHours(0, 0, 0, 0);

          if (dueMidnight < startOfToday) {
            errors.push(`${stageKey} deadline cannot be in the past`);
          }
          if (dueMidnight > postingDate) {
            errors.push(`${stageKey} deadline cannot be after publish date`);
          }
          if (prevDate && dueMidnight < prevDate) {
            errors.push(`${stageKey} deadline must be on or after preceding stage deadline`);
          }
          prevDate = dueMidnight;
          if (stageKey !== 'Post') {
            lastCreationDate = dueMidnight;
          }
        }

        stagePlan.push({
          stageKey,
          ownerId,
          ownerName,
          dueDate: dueDate ? dueDate.toISOString() : null,
          ownerSource,
          dueDateSource,
          ownerReason,
          isSuggestedOwner: ownerSource === 'suggested',
          isSuggestedDueDate: dueDateSource === 'auto',
        });
      }

      // Check posting owner for postable types
      if (isPostableWorkType(normalizedType)) {
        if (raw.postingOwner && String(raw.postingOwner).trim()) {
          const found = findOwner(raw.postingOwner);
          const member = found.member;
          if (found.error) {
            errors.push(`Posting owner: ${found.error}`);
          } else if (member) {
            postingOwnerId = member._id.toString();
            postingOwnerName = member.name;
          } else {
            errors.push(`Posting owner "${raw.postingOwner}" not found or not active`);
          }
        } else {
          const bestPost = pickBestMemberForStage('Post');
          if (bestPost) {
            postingOwnerId = bestPost._id.toString();
            postingOwnerName = bestPost.name;
            isPostingOwnerSuggested = true;
          }
        }
      }

      // Check tight buffer warning
      if (lastCreationDate && postingDate) {
        const postMidnight = new Date(postingDate);
        postMidnight.setHours(0, 0, 0, 0);
        const bufferDays = Math.round((postMidnight.getTime() - lastCreationDate.getTime()) / 86400000);
        if (bufferDays < 1) {
          warnings.push(`Tight creation buffer: last creation step is due less than 24h before publish date`);
        }
      }
    }

    const rowObj = {
      rowIndex: raw.rowIndex,
      postingDate: postingDate ? postingDate.toISOString() : null,
      postingTime: typeof raw.postingTime === 'string' && raw.postingTime.trim() ? raw.postingTime.trim() : '18:00',
      topic: topic || '',
      contentType: isValidType ? normalizedType : rawType || '',
      programOrEvent: typeof raw.programOrEvent === 'string' ? raw.programOrEvent.trim() : '',
      brief: typeof raw.brief === 'string' ? raw.brief.trim() : '',
      referenceLink: typeof raw.referenceLink === 'string' ? raw.referenceLink.trim() : '',
      priority: parsePriorityInput(raw.priority) || 'Normal',
      postingOwnerId,
      postingOwnerName,
      isPostingOwnerSuggested,
      needsScript: isReel ? needsScript : false,
      needsShoot: isReel ? needsShoot : false,
      sourceVideoLink,
      stagePlan,
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
