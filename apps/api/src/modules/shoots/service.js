import { Shoot } from './model.js';
import { ContentItem } from '../content/model.js';
import { Task } from '../tasks/model.js';
import { User } from '../users/model.js';
import { getNextSequenceId } from '../requests/counter.model.js';
import { transitionStatus } from '../common/transition.service.js';
import { createNotification } from '../notifications/service.js';
import { findLeastLoadedWorker } from '../pipelines/service.js';
import { recordAuditLog } from '../audit/service.js';
import { StatusHistory } from '../statusHistory/model.js';
import { logger } from '../../lib/logger.js';

export async function createShoot(input, user, io) {
  const {
    title,
    date,
    location,
    crew,
    equipment,
    talentNotes,
    contentItems,
    notes,
    overrideWarning,
  } = input;

  if (!contentItems || contentItems.length === 0) {
    const err = new Error('At least one video content item must be linked to the shoot');
    err.statusCode = 400;
    err.code = 'CONTENT_ITEMS_REQUIRED';
    throw err;
  }

  // 1. Validate content items are video formats and exist
  const items = await ContentItem.find({ _id: { $in: contentItems } }).populate('tasks');
  if (items.length !== contentItems.length) {
    const err = new Error('One or more selected content items could not be found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  // Verify format allows shoots (reel, video, or deliverable with cinematography stage)
  const allowedFormats = ['reel', 'video'];
  const invalidFormatItems = items.filter(
    (item) => !allowedFormats.includes(item.format) && item.format !== 'ad_creative'
  );
  if (invalidFormatItems.length > 0) {
    const err = new Error(
      `Only video-format content items (e.g. reels/videos) can be scheduled for shoots. Invalid items: ${invalidFormatItems
        .map((i) => i.title)
        .join(', ')}`
    );
    err.statusCode = 400;
    err.code = 'INVALID_FORMAT_FOR_SHOOT';
    throw err;
  }

  // 2. Script-ready check: The content (script) stage must be done or approved
  const notReadyItems = [];
  for (const item of items) {
    const scriptTask = item.tasks?.find(
      (t) => t.stageKey === 'content_script' || (t.team === 'content' && t.stageOrder === 1)
    );
    if (scriptTask && !['done', 'approved'].includes(scriptTask.status)) {
      notReadyItems.push({
        contentId: item.contentId,
        title: item.title,
        scriptStatus: scriptTask.status,
      });
    }
  }

  if (notReadyItems.length > 0 && !overrideWarning) {
    const names = notReadyItems.map((i) => `${i.contentId} (${i.title})`).join(', ');
    const err = new Error(
      `Cannot schedule shoot: Script is not yet approved for [${names}]. Check "Override warning" to proceed anyway.`
    );
    err.statusCode = 400;
    err.code = 'SCRIPT_NOT_READY';
    err.details = { notReadyItems };
    throw err;
  }

  // 3. Generate shoot sequential ID
  const shootId = await getNextSequenceId('SHT');

  const shoot = await Shoot.create({
    shootId,
    title,
    date: new Date(date),
    location,
    crew: crew || [],
    equipment: Array.isArray(equipment) ? equipment : equipment ? [equipment] : [],
    talentNotes,
    contentItems,
    notes,
    overrideWarning: !!overrideWarning,
    createdBy: user._id,
    status: 'scheduled',
  });

  // Notify crew members
  if (crew && crew.length > 0) {
    for (const memberId of crew) {
      await createNotification({
        recipient: memberId,
        type: 'shoot_assigned',
        title: 'Assigned to Shoot',
        message: `You were assigned to shoot ${shootId}: "${title}" at ${location} on ${new Date(
          date
        ).toLocaleDateString()}`,
        entityType: 'shoot',
        entityId: shoot._id,
        io,
      });
    }
  }

  return Shoot.findById(shoot._id)
    .populate('crew', 'name email avatar team skills attendance')
    .populate('contentItems', 'contentId title format status publishDate');
}

export async function listShoots(query = {}, user) {
  const filter = {};

  if (query.status) {
    filter.status = query.status;
  }

  if (query.myShoots === 'true' || user.role === 'worker') {
    if (query.all !== 'true' && user.team === 'cinematography') {
      filter.crew = user._id;
    }
  }

  if (query.today === 'true') {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    filter.date = { $gte: startOfToday, $lte: endOfToday };
  } else if (query.from || query.to) {
    filter.date = {};
    if (query.from) filter.date.$gte = new Date(query.from);
    if (query.to) filter.date.$lte = new Date(query.to);
  }

  const shoots = await Shoot.find(filter)
    .populate('crew', 'name email avatar team skills attendance')
    .populate('contentItems', 'contentId title format status publishDate')
    .populate('createdBy', 'name email role')
    .sort({ date: 1 });

  return shoots;
}

export async function getShootById(id) {
  const shoot = await Shoot.findById(id)
    .populate('crew', 'name email avatar team skills attendance')
    .populate({
      path: 'contentItems',
      select: 'contentId title format status publishDate brief tasks',
      populate: {
        path: 'tasks',
        select: 'taskId title team status stageKey stageOrder assignee',
        populate: {
          path: 'assignee',
          select: 'name email avatar',
        },
      },
    })
    .populate('createdBy', 'name email role');

  if (!shoot) {
    const err = new Error('Shoot not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  return shoot;
}

export async function updateShoot(id, updates, user) {
  const shoot = await Shoot.findById(id);
  if (!shoot) {
    const err = new Error('Shoot not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  Object.assign(shoot, updates);
  await shoot.save();

  return getShootById(id);
}

export async function transitionShootStatus(id, { status, notes, reshootReason, footageUrls }, user, io) {
  const shoot = await Shoot.findById(id).populate('contentItems');
  if (!shoot) {
    const err = new Error('Shoot not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const oldStatus = shoot.status;

  if (status === 'reshoot_needed' && !reshootReason) {
    const err = new Error('A detailed reshoot reason is required when marking a shoot as reshoot needed');
    err.statusCode = 400;
    err.code = 'REASON_REQUIRED';
    throw err;
  }

  shoot.status = status;
  if (notes) shoot.notes = notes;
  if (reshootReason) shoot.reshootReason = reshootReason;
  if (footageUrls) shoot.footageUrls = footageUrls;

  if (status === 'reshoot_needed') {
    shoot.reshootCount = (shoot.reshootCount || 0) + 1;
  }

  await shoot.save();

  // Log status history
  await StatusHistory.create({
    entityType: 'Shoot',
    entityId: shoot._id,
    fromStatus: oldStatus,
    toStatus: status,
    changedBy: user._id,
    reason: reshootReason || notes || `Shoot status transitioned to ${status}`,
    timestamp: new Date(),
  });

  // -----------------------------------------------------------------
  // 1. When marked DONE -> Release footage to Editor queue!
  // -----------------------------------------------------------------
  if (status === 'done') {
    for (const item of shoot.contentItems) {
      // Find all tasks for this content item
      const tasks = await Task.find({ contentItemId: item._id }).sort({ stageOrder: 1 });

      // Mark cinematography task as 'done'
      const cinemaTask = tasks.find(
        (t) => t.team === 'cinematography' || t.stageKey === 'cinematography_shoot'
      );
      if (cinemaTask && cinemaTask.status !== 'done') {
        cinemaTask.status = 'done';
        await cinemaTask.save();
      }

      // Find Editor stage task
      const editorTask = tasks.find(
        (t) => t.team === 'editor' || t.stageKey === 'editor_video'
      );

      if (editorTask) {
        // Unblock editor task
        editorTask.status = 'assigned';

        // Auto-assign to least loaded editor if currently unassigned
        if (!editorTask.assignee) {
          const bestEditor = await findLeastLoadedWorker('editor');
          if (bestEditor) {
            editorTask.assignee = bestEditor._id;
          }
        }
        await editorTask.save();

        // Send notification to editor assignee or team
        if (editorTask.assignee) {
          await createNotification({
            recipient: editorTask.assignee,
            type: 'footage_ready',
            title: 'Footage Ready for Editing',
            message: `Shoot ${shoot.shootId} complete! Footage is ready for editing on ${item.contentId}: "${item.title}".`,
            entityType: 'task',
            entityId: editorTask._id,
            io,
          });
        }
      }

      // Keep ContentItem in_production
      await ContentItem.findByIdAndUpdate(item._id, { status: 'in_production' });
    }
  }

  // -----------------------------------------------------------------
  // 2. When marked RESHOOT_NEEDED -> Return items to Cinematography!
  // -----------------------------------------------------------------
  if (status === 'reshoot_needed') {
    for (const item of shoot.contentItems) {
      const cinemaTask = await Task.findOne({
        contentItemId: item._id,
        $or: [{ team: 'cinematography' }, { stageKey: 'cinematography_shoot' }],
      });

      if (cinemaTask) {
        cinemaTask.status = 'in_progress';
        cinemaTask.holdReason = 'reshoot_required';
        cinemaTask.holdComment = reshootReason;
        cinemaTask.revisionCount = (cinemaTask.revisionCount || 0) + 1;
        await cinemaTask.save();

        if (cinemaTask.assignee) {
          await createNotification({
            recipient: cinemaTask.assignee,
            type: 'reshoot_needed',
            title: 'Reshoot Required',
            message: `Reshoot requested for ${item.contentId} (${item.title}): "${reshootReason}".`,
            entityType: 'task',
            entityId: cinemaTask._id,
            io,
          });
        }
      }
    }
  }

  return getShootById(id);
}
