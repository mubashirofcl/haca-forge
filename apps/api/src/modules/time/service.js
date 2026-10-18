import { TimeEntry } from './model.js';
import { Task } from '../tasks/model.js';
import { User } from '../users/model.js';
import { createNotification } from '../notifications/service.js';
import { recordAuditLog } from '../audit/service.js';
import { logger } from '../../lib/logger.js';
import { getManagedWorkerIds, isWorkerManagedBy } from '../../lib/teamAccess.js';

/**
 * Recalculates actualHours for a task from approved & submitted entries
 */
export async function recalculateTaskActualHours(taskId) {
  if (!taskId) return;
  const entries = await TimeEntry.find({
    taskId,
    status: { $in: ['submitted', 'approved'] },
  });

  const totalMinutes = entries.reduce((sum, e) => sum + (e.minutes || 0), 0);
  const actualHours = Math.round((totalMinutes / 60) * 100) / 100;

  await Task.findByIdAndUpdate(taskId, { actualHours });
  return actualHours;
}

export async function startTimer({ taskId, note }, user) {
  const task = await Task.findById(taskId);
  if (!task) {
    const err = new Error('Task not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  // Stop any currently running timer for this user
  const activeTimer = await TimeEntry.findOne({
    userId: user._id,
    start: { $ne: null },
    end: null,
  });

  if (activeTimer) {
    const now = new Date();
    const elapsedMinutes = Math.max(1, Math.round((now.getTime() - new Date(activeTimer.start).getTime()) / 60000));
    activeTimer.end = now;
    activeTimer.minutes = (activeTimer.minutes || 0) + elapsedMinutes;
    await activeTimer.save();
    await recalculateTaskActualHours(activeTimer.taskId);
  }

  const newEntry = await TimeEntry.create({
    taskId,
    userId: user._id,
    date: new Date(),
    start: new Date(),
    end: null,
    minutes: 0,
    note: note || `Timer started on ${task.title}`,
    status: 'draft',
  });

  return TimeEntry.findById(newEntry._id)
    .populate('taskId', 'taskId title stageKey team')
    .populate('userId', 'name email');
}

export async function stopTimer({ timeEntryId, note }, user) {
  let entry;
  if (timeEntryId) {
    entry = await TimeEntry.findById(timeEntryId);
  } else {
    // Find latest active timer for user
    entry = await TimeEntry.findOne({
      userId: user._id,
      start: { $ne: null },
      end: null,
    }).sort({ createdAt: -1 });
  }

  if (!entry) {
    const err = new Error('No active running timer found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const now = new Date();
  const elapsedMinutes = Math.max(1, Math.round((now.getTime() - new Date(entry.start).getTime()) / 60000));

  entry.end = now;
  entry.minutes = (entry.minutes || 0) + elapsedMinutes;
  if (note) entry.note = note;
  await entry.save();

  await recalculateTaskActualHours(entry.taskId);

  return TimeEntry.findById(entry._id)
    .populate('taskId', 'taskId title stageKey team actualHours')
    .populate('userId', 'name email');
}

export async function getActiveTimer(user) {
  const entry = await TimeEntry.findOne({
    userId: user._id,
    start: { $ne: null },
    end: null,
  })
    .populate('taskId', 'taskId title stageKey team')
    .sort({ createdAt: -1 });

  return entry;
}

export async function logManualTime({ taskId, date, minutes, note }, user) {
  const task = await Task.findById(taskId);
  if (!task) {
    const err = new Error('Task not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const entry = await TimeEntry.create({
    taskId,
    userId: user._id,
    date: date ? new Date(date) : new Date(),
    minutes: Number(minutes),
    note,
    status: 'draft',
  });

  return TimeEntry.findById(entry._id)
    .populate('taskId', 'taskId title stageKey team')
    .populate('userId', 'name email');
}

export async function listTimeEntries(query = {}, user) {
  // Requesters do not manage or view internal worker timesheets
  if (user && (user.role === 'dept_staff' || user.role === 'dept_lead')) {
    return [];
  }

  const filter = {};

  if (user.role === 'worker') {
    filter.userId = user._id;
  } else if (user.role === 'team_lead') {
    const managedWorkerIds = await getManagedWorkerIds(user);
    if (query.userId) {
      const isManaged = managedWorkerIds.some((id) => id.toString() === query.userId.toString());
      filter.userId = isManaged ? query.userId : { $in: [] };
    } else {
      filter.userId = { $in: managedWorkerIds };
    }
  } else if (query.userId) {
    filter.userId = query.userId;
  }

  if (query.taskId) {
    filter.taskId = query.taskId;
  }

  if (query.status) {
    filter.status = query.status;
  }

  if (query.weekStart) {
    const start = new Date(query.weekStart);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    filter.date = { $gte: start, $lt: end };
  } else if (query.from || query.to) {
    filter.date = {};
    if (query.from) filter.date.$gte = new Date(query.from);
    if (query.to) filter.date.$lte = new Date(query.to);
  }

  const entries = await TimeEntry.find(filter)
    .populate({
      path: 'taskId',
      select: 'taskId title team status stageKey estimateHours actualHours contentItemId',
      populate: {
        path: 'contentItemId',
        select: 'contentId title format',
      },
    })
    .populate('userId', 'name email avatar team teamId')
    .populate('approvedBy', 'name email role')
    .sort({ date: -1, createdAt: -1 });

  return entries;
}

export async function submitTimesheet({ weekStart, entryIds }, user) {
  let query = {
    userId: user._id,
    status: 'draft',
  };

  if (entryIds && entryIds.length > 0) {
    query._id = { $in: entryIds };
  } else if (weekStart) {
    const start = new Date(weekStart);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    query.date = { $gte: start, $lt: end };
  }

  const entries = await TimeEntry.find(query);
  if (!entries.length) {
    const err = new Error('No draft time entries found to submit');
    err.statusCode = 400;
    err.code = 'NO_ENTRIES';
    throw err;
  }

  await TimeEntry.updateMany(query, {
    status: 'submitted',
  });

  // Recalculate actual hours on affected tasks
  const affectedTaskIds = [...new Set(entries.map((e) => e.taskId.toString()))];
  for (const tId of affectedTaskIds) {
    await recalculateTaskActualHours(tId);
  }

  return {
    submittedCount: entries.length,
    taskIds: affectedTaskIds,
  };
}

export async function approveTimesheet({ entryIds, status, comment }, reviewer, io) {
  if (!entryIds || !entryIds.length) {
    const err = new Error('No time entries selected');
    err.statusCode = 400;
    err.code = 'NO_ENTRIES';
    throw err;
  }

  const entries = await TimeEntry.find({ _id: { $in: entryIds } }).populate('userId');

  // Team lead scoping check
  if (reviewer.role === 'team_lead') {
    for (const entry of entries) {
      const entryUserId = entry.userId?._id || entry.userId;
      const isManaged = await isWorkerManagedBy(reviewer, entryUserId);
      if (!isManaged) {
        const err = new Error('Team leads can only approve timesheets for workers they manage');
        err.statusCode = 403;
        err.code = 'FORBIDDEN';
        throw err;
      }
    }
  }

  await TimeEntry.updateMany(
    { _id: { $in: entryIds } },
    {
      status,
      approvedBy: reviewer._id,
      approvedAt: new Date(),
      rejectionComment: comment || undefined,
    }
  );

  // Recalculate actual hours on affected tasks
  const affectedTaskIds = [...new Set(entries.map((e) => e.taskId.toString()))];
  for (const tId of affectedTaskIds) {
    await recalculateTaskActualHours(tId);
  }

  // Notify affected users
  const userIds = [...new Set(entries.map((e) => e.userId?._id?.toString()).filter(Boolean))];
  for (const uId of userIds) {
    await createNotification({
      recipient: uId,
      type: `timesheet_${status}`,
      title: `Timesheet ${status === 'approved' ? 'Approved' : 'Rejected'}`,
      message: `Your submitted time entries have been ${status} by ${reviewer.name}${
        comment ? `: "${comment}"` : '.'
      }`,
      entityType: 'timesheet',
      entityId: entryIds[0],
      io,
    });
  }

  return {
    updatedCount: entryIds.length,
    status,
    affectedTasks: affectedTaskIds,
  };
}
