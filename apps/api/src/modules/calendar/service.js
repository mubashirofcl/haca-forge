import mongoose from 'mongoose';
import ExcelJS from 'exceljs';
import { CalendarEntry } from './model.js';
import { ContentItem } from '../content/model.js';
import { PipelineTemplate } from '../pipelines/model.js';
import { initializeContentPipeline } from '../pipelines/service.js';
import { getNextSequenceId } from '../requests/counter.model.js';
import { Department } from '../departments/model.js';
import { Team } from '../teams/model.js';
import { User } from '../users/model.js';
import { StatusHistory } from '../statusHistory/model.js';

export const VALID_FORMATS = [
  'static_post',
  'carousel',
  'story',
  'reel',
  'ad_creative',
  'brochure',
  'academic_creative',
];

export const VALID_PLATFORMS = [
  'instagram',
  'linkedin',
  'youtube',
  'facebook',
  'tiktok',
  'twitter',
  'pinterest',
];

const DEFAULT_LEAD_TIMES = {
  static_post: 3,
  carousel: 4,
  story: 2,
  reel: 7,
  ad_creative: 4,
  brochure: 5,
  academic_creative: 4,
};

/**
 * List calendar entries within a date range with scoping and clash detection
 */
export async function listEntries(filters, user) {
  const query = {};

  if (filters.from || filters.to) {
    query.date = {};
    if (filters.from) query.date.$gte = new Date(filters.from);
    if (filters.to) {
      const toDate = new Date(filters.to);
      toDate.setHours(23, 59, 59, 999);
      query.date.$lte = toDate;
    }
  }

  if (filters.platform) query.platform = filters.platform.toLowerCase();
  if (filters.format) query.format = filters.format;
  if (filters.status) query.status = filters.status;
  if (filters.campaign) query.campaign = filters.campaign;

  const entries = await CalendarEntry.find(query)
    .populate('owner', 'name email avatar role')
    .populate('campaign', 'name startDate endDate')
    .populate('linkedContentItemId', 'contentId title status productionDeadline')
    .sort({ date: 1, createdAt: 1 });

  // Clash detection: flag days where a platform has > threshold deliverables (default 3)
  const threshold = filters.maxPostsPerPlatform ? parseInt(filters.maxPostsPerPlatform, 10) : 3;
  const platformDayCounts = {};

  entries.forEach((e) => {
    const dayKey = `${e.date.toISOString().split('T')[0]}_${e.platform}`;
    platformDayCounts[dayKey] = (platformDayCounts[dayKey] || 0) + 1;
  });

  const enrichedEntries = entries.map((entry) => {
    const dayKey = `${entry.date.toISOString().split('T')[0]}_${entry.platform}`;
    const count = platformDayCounts[dayKey] || 0;
    const doc = entry.toObject();
    doc.hasClash = count > threshold;
    doc.dayDeliverableCount = count;
    return doc;
  });

  return enrichedEntries;
}

/**
 * Create a new calendar entry
 */
export async function createEntry(input, user, io) {
  const date = new Date(input.date);
  if (isNaN(date.getTime())) {
    const err = new Error('Invalid date provided');
    err.statusCode = 400;
    err.code = 'INVALID_DATE';
    throw err;
  }

  const platform = input.platform.toLowerCase().trim();
  const format = input.format.trim();

  const entry = new CalendarEntry({
    date,
    platform,
    format,
    theme: input.theme.trim(),
    campaign: input.campaign || undefined,
    captionBrief: input.captionBrief || '',
    contentPillar: input.contentPillar || 'General',
    owner: user._id,
    status: input.status || 'draft',
  });

  await entry.save();
  await entry.populate('owner', 'name email avatar');

  if (io) {
    io.emit('calendar:created', entry);
  }

  return entry;
}

/**
 * Update calendar entry
 */
export async function updateEntry(id, updates, user, io) {
  const entry = await CalendarEntry.findById(id);
  if (!entry) {
    const err = new Error('Calendar entry not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (updates.date) {
    const newDate = new Date(updates.date);
    if (!isNaN(newDate.getTime())) {
      entry.date = newDate;

      // If linked to ContentItem, update publishDate and re-derive productionDeadline
      if (entry.linkedContentItemId) {
        const item = await ContentItem.findById(entry.linkedContentItemId);
        if (item) {
          item.publishDate = newDate;
          const leadDays = DEFAULT_LEAD_TIMES[item.format] || 3;
          item.productionDeadline = new Date(newDate.getTime() - leadDays * 86400000);
          await item.save();
        }
      }
    }
  }

  if (updates.platform) entry.platform = updates.platform.toLowerCase().trim();
  if (updates.format) entry.format = updates.format.trim();
  if (updates.theme) entry.theme = updates.theme.trim();
  if (updates.captionBrief !== undefined) entry.captionBrief = updates.captionBrief;
  if (updates.contentPillar !== undefined) entry.contentPillar = updates.contentPillar;
  if (updates.status) entry.status = updates.status;
  if (updates.campaign !== undefined) entry.campaign = updates.campaign || null;

  await entry.save();
  await entry.populate('owner', 'name email avatar');
  await entry.populate('linkedContentItemId', 'contentId title status productionDeadline');

  if (io) {
    io.emit('calendar:updated', entry);
  }

  return entry;
}

/**
 * Delete a calendar entry
 */
export async function deleteEntry(id, user, io) {
  const entry = await CalendarEntry.findById(id);
  if (!entry) {
    const err = new Error('Calendar entry not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (entry.status === 'converted' && user.role !== 'admin') {
    const err = new Error('Cannot delete a converted calendar entry that is already in production.');
    err.statusCode = 400;
    err.code = 'CANNOT_DELETE_CONVERTED';
    throw err;
  }

  await CalendarEntry.findByIdAndDelete(id);

  if (io) {
    io.emit('calendar:deleted', { id });
  }

  return { message: 'Calendar entry deleted successfully' };
}

/**
 * Batch or single approve calendar entries
 */
export async function approveEntries(ids, user) {
  const res = await CalendarEntry.updateMany(
    { _id: { $in: ids }, status: 'draft' },
    { $set: { status: 'approved' } }
  );
  return { approvedCount: res.modifiedCount };
}

/**
 * Generate ContentItems and full pipelines from approved CalendarEntries (idempotent)
 */
export async function generateContentItems(entryIds, user, io) {
  const entries = await CalendarEntry.find({
    _id: { $in: entryIds },
    status: 'approved',
    linkedContentItemId: { $exists: false },
  });

  if (entries.length === 0) {
    return {
      message: 'No eligible approved calendar entries found for pipeline generation.',
      created: [],
      count: 0,
    };
  }

  // Resolve Social Media or fallback Department
  let smDept = await Department.findOne({
    $or: [{ code: 'SM' }, { type: 'social_media' }, { name: /social/i }],
  });
  if (!smDept) {
    smDept = await Department.findOne();
  }

  const createdItems = [];

  for (const entry of entries) {
    const contentId = await getNextSequenceId('CNT');
    const leadDays = DEFAULT_LEAD_TIMES[entry.format] || 3;
    const productionDeadline = new Date(entry.date.getTime() - leadDays * 86400000);

    const title = `[${entry.platform.toUpperCase()}] ${entry.theme}`;

    const contentItem = new ContentItem({
      contentId,
      title,
      format: entry.format,
      sourceDepartment: smDept?._id,
      requester: entry.owner,
      calendarEntryId: entry._id,
      campaignId: entry.campaign || undefined,
      pillar: entry.contentPillar || 'General',
      platforms: [entry.platform],
      publishDate: entry.date,
      productionDeadline,
      priority: 'medium',
      caption: '',
      brief: entry.captionBrief || entry.theme,
      status: 'planned',
    });

    await contentItem.save();

    // Trigger pipeline generation and stage tasks
    await initializeContentPipeline(contentItem, user, io);

    // Update CalendarEntry to converted and link content item
    entry.status = 'converted';
    entry.linkedContentItemId = contentItem._id;
    await entry.save();

    createdItems.push(contentItem);
  }

  return {
    message: `Generated ${createdItems.length} content item(s) and stage pipelines.`,
    created: createdItems,
    count: createdItems.length,
  };
}

/**
 * Pre-validation parse of Excel or CSV without writing to the database
 */
export async function previewBulkImport(buffer, mimeType, user) {
  const workbook = new ExcelJS.Workbook();

  if (mimeType && mimeType.includes('csv')) {
    // Read CSV stream
    const stream = new (await import('stream')).PassThrough();
    stream.end(buffer);
    await workbook.csv.read(stream);
  } else {
    // Read XLSX
    await workbook.xlsx.load(buffer);
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    const err = new Error('No worksheets found in spreadsheet');
    err.statusCode = 400;
    err.code = 'EMPTY_SPREADSHEET';
    throw err;
  }

  const errors = [];
  const preview = [];
  const seenInFile = new Set();
  const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Find header row or default to row 1
  let headerRow = 1;
  const colMap = {};
  const row1 = worksheet.getRow(1);
  row1.eachCell((cell, colNumber) => {
    const text = String(cell.value || '').trim().toLowerCase();
    if (text.includes('date')) colMap.date = colNumber;
    else if (text.includes('platform')) colMap.platform = colNumber;
    else if (text.includes('format')) colMap.format = colNumber;
    else if (text.includes('theme')) colMap.theme = colNumber;
    else if (text.includes('pillar')) colMap.contentPillar = colNumber;
    else if (text.includes('caption') || text.includes('brief')) colMap.captionBrief = colNumber;
    else if (text.includes('campaign')) colMap.campaign = colNumber;
  });

  // Default fallback col numbers if headers weren't named
  if (!colMap.date) colMap.date = 1;
  if (!colMap.platform) colMap.platform = 2;
  if (!colMap.format) colMap.format = 3;
  if (!colMap.theme) colMap.theme = 4;
  if (!colMap.contentPillar) colMap.contentPillar = 5;
  if (!colMap.captionBrief) colMap.captionBrief = 6;
  if (!colMap.campaign) colMap.campaign = 7;

  // Process rows 2 to total
  const rowCount = worksheet.rowCount;
  for (let r = 2; r <= rowCount; r++) {
    const row = worksheet.getRow(r);
    if (!row || !row.hasValues) continue;

    const rawDate = row.getCell(colMap.date).value;
    const rawPlatform = String(row.getCell(colMap.platform).value || '').trim().toLowerCase();
    const rawFormat = String(row.getCell(colMap.format).value || '').trim().toLowerCase();
    const rawTheme = String(row.getCell(colMap.theme).value || '').trim();
    const rawPillar = String(row.getCell(colMap.contentPillar).value || 'General').trim();
    const rawBrief = String(row.getCell(colMap.captionBrief).value || '').trim();
    const rawCampaign = String(row.getCell(colMap.campaign).value || '').trim();

    // Skip empty lines
    if (!rawDate && !rawPlatform && !rawFormat && !rawTheme) continue;

    let rowHasError = false;

    // Validate Date
    let parsedDate = null;
    if (rawDate instanceof Date) {
      parsedDate = rawDate;
    } else if (rawDate) {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        parsedDate = d;
      }
    }

    if (!parsedDate || isNaN(parsedDate.getTime())) {
      errors.push({
        row: r,
        field: 'date',
        message: `Invalid date format '${rawDate}'. Expected YYYY-MM-DD.`,
      });
      rowHasError = true;
    }

    // Validate Platform
    if (!rawPlatform || !VALID_PLATFORMS.includes(rawPlatform)) {
      errors.push({
        row: r,
        field: 'platform',
        message: `Unknown platform '${rawPlatform}'. Supported: ${VALID_PLATFORMS.join(', ')}`,
      });
      rowHasError = true;
    }

    // Validate Format
    if (!rawFormat || !VALID_FORMATS.includes(rawFormat)) {
      errors.push({
        row: r,
        field: 'format',
        message: `Unknown format '${rawFormat}'. Supported: ${VALID_FORMATS.join(', ')}`,
      });
      rowHasError = true;
    }

    // Validate Theme
    if (!rawTheme) {
      errors.push({
        row: r,
        field: 'theme',
        message: 'Theme or deliverable topic cannot be empty.',
      });
      rowHasError = true;
    }

    // Check intra-file duplicate
    if (parsedDate && rawPlatform && rawTheme) {
      const key = `${parsedDate.toISOString().split('T')[0]}_${rawPlatform}_${rawTheme.toLowerCase()}`;
      if (seenInFile.has(key)) {
        errors.push({
          row: r,
          field: 'theme',
          message: `Duplicate deliverable found in file on ${parsedDate.toISOString().split('T')[0]} for ${rawPlatform}.`,
        });
        rowHasError = true;
      } else {
        seenInFile.add(key);
      }
    }

    if (!rowHasError && parsedDate) {
      preview.push({
        rowNumber: r,
        date: parsedDate.toISOString().split('T')[0],
        platform: rawPlatform,
        format: rawFormat,
        theme: rawTheme,
        contentPillar: rawPillar || 'General',
        captionBrief: rawBrief,
        campaign: rawCampaign,
      });
    }
  }

  return {
    batchId,
    totalRows: rowCount - 1,
    validCount: preview.length,
    errorCount: errors.length,
    errors,
    preview,
  };
}

/**
 * Commit validated bulk import rows to the database
 */
export async function commitBulkImport(entries, batchId, user) {
  if (!entries || !entries.length) {
    const err = new Error('No valid entries to import');
    err.statusCode = 400;
    err.code = 'NO_ENTRIES';
    throw err;
  }

  const importBatchId = batchId || `batch_${Date.now()}`;
  const docs = entries.map((entry) => ({
    date: new Date(entry.date),
    platform: entry.platform.toLowerCase(),
    format: entry.format,
    theme: entry.theme,
    contentPillar: entry.contentPillar || 'General',
    captionBrief: entry.captionBrief || '',
    owner: user._id,
    status: 'draft',
    importBatchId,
  }));

  const inserted = await CalendarEntry.insertMany(docs);

  return {
    message: `Successfully imported ${inserted.length} calendar entries.`,
    importedCount: inserted.length,
    batchId: importBatchId,
  };
}

/**
 * Generate a downloadable Excel template for bulk calendar import
 */
export async function generateExcelTemplate() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'HACA FORGE';
  workbook.created = new Date();

  // 1. Template Sheet
  const sheet = workbook.addWorksheet('Content Calendar Template');
  sheet.columns = [
    { header: 'Date (YYYY-MM-DD)', key: 'date', width: 22 },
    { header: 'Platform', key: 'platform', width: 16 },
    { header: 'Format', key: 'format', width: 22 },
    { header: 'Theme / Topic', key: 'theme', width: 35 },
    { header: 'Content Pillar', key: 'pillar', width: 20 },
    { header: 'Caption Brief & Specs', key: 'brief', width: 40 },
    { header: 'Campaign Name', key: 'campaign', width: 22 },
  ];

  // Header Styling: Dark obsidian background with purple highlight
  const headerRow = sheet.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0D0E12' },
    };
    cell.font = {
      color: { argb: 'FFFFFFFF' },
      bold: true,
      size: 11,
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  // Example Sample Rows
  const sampleDate1 = new Date();
  sampleDate1.setDate(sampleDate1.getDate() + 7);
  const sampleDate2 = new Date();
  sampleDate2.setDate(sampleDate2.getDate() + 10);

  sheet.addRow({
    date: sampleDate1.toISOString().split('T')[0],
    platform: 'instagram',
    format: 'static_post',
    theme: 'Q4 Product Feature Showcase Poster',
    pillar: 'Product',
    brief: 'Focus on high-contrast visuals, highlight new analytics suite features.',
    campaign: 'Fall Launch',
  });

  sheet.addRow({
    date: sampleDate2.toISOString().split('T')[0],
    platform: 'youtube',
    format: 'reel',
    theme: 'Behind the Scenes Workshop Highlights',
    pillar: 'Culture',
    brief: 'Energetic video clips, captions, and upbeat background score.',
    campaign: 'Company Culture',
  });

  // 2. Allowed Values Sheet
  const helperSheet = workbook.addWorksheet('Allowed Values & Guide');
  helperSheet.columns = [
    { header: 'Platform Keys', key: 'p', width: 20 },
    { header: 'Format Keys', key: 'f', width: 25 },
    { header: 'Lead Time (Days)', key: 'lt', width: 18 },
  ];

  const maxRows = Math.max(VALID_PLATFORMS.length, VALID_FORMATS.length);
  for (let i = 0; i < maxRows; i++) {
    const format = VALID_FORMATS[i];
    helperSheet.addRow({
      p: VALID_PLATFORMS[i] || '',
      f: format || '',
      lt: format ? DEFAULT_LEAD_TIMES[format] || 3 : '',
    });
  }

  const helperHeader = helperSheet.getRow(1);
  helperHeader.font = { bold: true };

  return workbook.xlsx.writeBuffer();
}

/**
 * Capacity comparison: compares team demand hours vs available worker capacity factoring in leave
 */
export async function getTeamCapacityComparison(fromDate, toDate) {
  const from = fromDate ? new Date(fromDate) : new Date();
  const to = toDate ? new Date(toDate) : new Date(from.getTime() + 7 * 86400000);

  // 1. Fetch all 4 production teams
  const teams = await Team.find();

  // 2. Fetch users per team to compute available capacity
  const users = await User.find({ status: 'active' });

  // Import LeaveRequest to discount workers with approved leaves in this window
  const { LeaveRequest } = await import('../leave/model.js');
  const leavesInWindow = await LeaveRequest.find({
    status: 'approved',
    startDate: { $lte: to },
    endDate: { $gte: from },
  }).select('userId');
  const leaveUserSet = new Set(leavesInWindow.map((l) => l.userId.toString()));

  // 3. Compute available capacity per team (hours/week)
  const teamCapacityMap = {
    content: { total: 0, available: 0, onLeaveCount: 0, memberCount: 0 },
    graphics: { total: 0, available: 0, onLeaveCount: 0, memberCount: 0 },
    cinematography: { total: 0, available: 0, onLeaveCount: 0, memberCount: 0 },
    editor: { total: 0, available: 0, onLeaveCount: 0, memberCount: 0 },
  };

  users.forEach((u) => {
    const teamKey = (u.teamId || u.team)?.toLowerCase();
    if (teamCapacityMap[teamKey]) {
      const cap = u.capacity || 40;
      teamCapacityMap[teamKey].memberCount += 1;
      teamCapacityMap[teamKey].total += cap;
      const isOnLeave = u.attendance === 'on_leave' || u.onLeave === true || leaveUserSet.has(u._id.toString());
      if (isOnLeave) {
        teamCapacityMap[teamKey].onLeaveCount += 1;
      } else {
        teamCapacityMap[teamKey].available += cap;
      }
    }
  });

  // 4. Fetch planned items (CalendarEntry and ContentItem) in date window
  const calendarItems = await CalendarEntry.find({
    date: { $gte: from, $lte: to },
    status: { $in: ['draft', 'approved'] },
  });

  const contentItems = await ContentItem.find({
    publishDate: { $gte: from, $lte: to },
    status: { $in: ['planned', 'in_production', 'in_review'] },
  });

  // Fetch PipelineTemplates to know hours per stage/team
  const templates = await PipelineTemplate.find();
  const templateMap = {};
  templates.forEach((t) => {
    templateMap[t.format] = t;
  });

  // 5. Aggregate required hours per team
  const demandHours = { content: 0, graphics: 0, cinematography: 0, editor: 0 };

  const allFormats = [
    ...calendarItems.map((c) => c.format),
    ...contentItems.map((ci) => ci.format),
  ];

  allFormats.forEach((fmt) => {
    const tpl = templateMap[fmt];
    if (tpl && tpl.stages) {
      tpl.stages.forEach((stg) => {
        const teamKey = stg.team?.toLowerCase();
        if (demandHours[teamKey] !== undefined) {
          demandHours[teamKey] += stg.defaultHours || 2;
        }
      });
    } else {
      // Fallback heuristics based on format
      if (fmt === 'static_post') {
        demandHours.content += 2;
        demandHours.graphics += 3;
      } else if (fmt === 'reel') {
        demandHours.content += 3;
        demandHours.cinematography += 6;
        demandHours.editor += 8;
      } else {
        demandHours.content += 2;
        demandHours.graphics += 4;
      }
    }
  });

  // 6. Build comparison report
  const report = Object.keys(teamCapacityMap).map((teamKey) => {
    const capInfo = teamCapacityMap[teamKey];
    const demand = demandHours[teamKey] || 0;
    const available = capInfo.available || 1; // avoid divide by zero
    const utilizationPct = Math.round((demand / available) * 100);

    let status = 'optimal';
    if (utilizationPct > 100) status = 'overloaded';
    else if (utilizationPct >= 85) status = 'warning';

    return {
      team: teamKey,
      totalCapacity: capInfo.total,
      availableCapacity: capInfo.available,
      onLeaveMembers: capInfo.onLeaveCount,
      activeMembers: capInfo.memberCount - capInfo.onLeaveCount,
      demandHours: demand,
      gapHours: capInfo.available - demand,
      utilizationPct,
      status,
    };
  });

  return {
    window: { from, to },
    totalDemandHours: Object.values(demandHours).reduce((a, b) => a + b, 0),
    teams: report,
  };
}

/**
 * Publishing workflow: PATCH /api/content/:id/publish (sm_manager and admin only)
 */
export async function publishContent(contentId, publishData, user, io) {
  if (!['admin', 'sm_manager'].includes(user.role)) {
    const err = new Error('Only Social Media Managers and Administrators can publish content.');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  const contentItem = await ContentItem.findById(contentId);
  if (!contentItem) {
    const err = new Error('Content item not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  // Allowed only from 'approved' or 'scheduled'
  if (!['approved', 'scheduled'].includes(contentItem.status)) {
    const err = new Error(
      `Cannot publish content item in status '${contentItem.status}'. Content must be 'approved' or 'scheduled' first.`
    );
    err.statusCode = 400;
    err.code = 'INVALID_PUBLISH_STATUS';
    throw err;
  }

  const fromStatus = contentItem.status;
  contentItem.status = 'published';
  contentItem.publishedUrl = publishData.publishedUrl || contentItem.publishedUrl || '';
  contentItem.publishedAt = publishData.publishedAt ? new Date(publishData.publishedAt) : new Date();
  contentItem.publishedBy = user._id;

  if (publishData.metrics) {
    contentItem.metrics = {
      reach: publishData.metrics.reach || 0,
      views: publishData.metrics.views || 0,
      likes: publishData.metrics.likes || 0,
      shares: publishData.metrics.shares || 0,
      comments: publishData.metrics.comments || 0,
    };
  }

  await contentItem.save();

  // Record StatusHistory
  await StatusHistory.create({
    entityType: 'ContentItem',
    entityId: contentItem._id,
    fromStatus,
    toStatus: 'published',
    changedBy: user._id,
    reason: `Published with link: ${contentItem.publishedUrl}`,
    timestamp: new Date(),
  });

  // If linked to calendar entry, mark entry as published
  if (contentItem.calendarEntryId) {
    await CalendarEntry.findByIdAndUpdate(contentItem.calendarEntryId, {
      $set: { status: 'converted' },
    });
  }

  if (io) {
    io.emit('content:published', {
      id: contentItem._id,
      contentId: contentItem.contentId,
      publishedUrl: contentItem.publishedUrl,
    });
  }

  return contentItem;
}
