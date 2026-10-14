import { Task } from './model.js';
import { ContentItem } from '../content/model.js';
import { User } from '../users/model.js';
import { Comment } from '../comments/model.js';
import { StatusHistory } from '../statusHistory/model.js';
import { getNextSequenceId } from '../requests/counter.model.js';
import { transitionStatus } from '../common/transition.service.js';
import { advancePipelineHandoff } from '../pipelines/service.js';
import { createNotification } from '../notifications/service.js';
import { logger } from '../../lib/logger.js';

export async function createTask(input, user, io) {
  const taskId = await getNextSequenceId('TSK');

  const task = new Task({
    ...input,
    taskId,
    status: 'assigned',
  });

  await task.save();

  // Link to ContentItem
  await ContentItem.findByIdAndUpdate(input.contentItemId, {
    $addToSet: { tasks: task._id },
  });

  if (task.assignee) {
    await createNotification({
      recipient: task.assignee,
      type: 'task_assigned',
      title: 'Task Assigned',
      message: `You were assigned ${taskId}: ${task.title}`,
      entityType: 'task',
      entityId: task._id,
      io,
    });
  }

  return Task.findById(task._id)
    .populate('assignee', 'name email avatar team skills')
    .populate('contentItemId', 'contentId title format status');
}

export async function listTasks(query = {}, user) {
  const filter = {};

  if (query.mine === 'true' || user.role === 'worker') {
    if (query.teamQueue !== 'true') {
      filter.$or = [{ assignee: user._id }, { collaborators: user._id }];
    }
  }

  if (query.team) {
    filter.team = query.team;
  } else if (query.teamQueue === 'true' && user.team) {
    filter.team = user.team;
  }

  if (query.contentItemId) {
    filter.contentItemId = query.contentItemId;
  }

  if (query.status) {
    filter.status = query.status;
  }

  const tasks = await Task.find(filter)
    .populate('assignee', 'name email avatar team skills onLeave')
    .populate('collaborators', 'name email avatar')
    .populate('contentItemId', 'contentId title format priority status publishDate')
    .populate('dependencies', 'taskId title status')
    .sort({ dueDate: 1, createdAt: -1 });

  return tasks;
}

export async function getTaskById(id, user) {
  const task = await Task.findById(id)
    .populate('assignee', 'name email avatar team skills onLeave weeklyCapacityHours')
    .populate('collaborators', 'name email avatar')
    .populate('contentItemId', 'contentId title format priority status publishDate sourceDepartment brief')
    .populate('dependencies', 'taskId title status assignee');

  if (!task) {
    const err = new Error('Task not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const comments = await Comment.find({
    entityType: 'task',
    entityId: task._id,
  })
    .populate('author', 'name email avatar role')
    .sort({ createdAt: 1 });

  const statusHistory = await StatusHistory.find({
    entityType: 'Task',
    entityId: task._id,
  })
    .populate('changedBy', 'name email')
    .sort({ timestamp: -1 });

  return { task, comments, statusHistory };
}

export async function updateTask(id, updates, user, io) {
  const task = await Task.findById(id);
  if (!task) {
    const err = new Error('Task not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const previousAssignee = task.assignee?.toString();

  Object.assign(task, updates);
  await task.save();

  // If assignee changed, send notification
  if (updates.assignee && updates.assignee.toString() !== previousAssignee) {
    await createNotification({
      recipient: updates.assignee,
      type: 'task_assigned',
      title: 'Task Reassigned',
      message: `You were assigned ${task.taskId}: ${task.title}`,
      entityType: 'task',
      entityId: task._id,
      io,
    });
  }

  return Task.findById(id)
    .populate('assignee', 'name email avatar team skills')
    .populate('collaborators', 'name email avatar');
}

export async function transitionTaskStatus(id, { status, holdReason, holdComment, comment }, user, io) {
  const task = await Task.findById(id).populate('dependencies');
  if (!task) {
    const err = new Error('Task not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  // 1. Dependency check: starting a task requires all prerequisites to be 'done' or 'approved'
  if (['in_progress', 'submitted'].includes(status) && task.dependencies && task.dependencies.length > 0) {
    const pendingPrereqs = task.dependencies.filter(
      (dep) => !['done', 'approved'].includes(dep.status)
    );
    if (pendingPrereqs.length > 0) {
      const pendingNames = pendingPrereqs.map((d) => d.taskId).join(', ');
      const err = new Error(
        `Cannot start task. Prerequisite task(s) [${pendingNames}] must be completed first.`
      );
      err.statusCode = 400;
      err.code = 'DEPENDENCY_BLOCKED';
      err.details = { pendingTasks: pendingNames };
      throw err;
    }
  }

  // 2. Reason code required for blocked or on_hold
  if (['blocked', 'on_hold'].includes(status) && !holdReason) {
    const err = new Error(
      `Moving task to '${status}' requires a mandatory hold reason code.`
    );
    err.statusCode = 400;
    err.code = 'REASON_CODE_REQUIRED';
    throw err;
  }

  // 3. Transition via central state machine
  await transitionStatus({
    entityType: 'Task',
    entity: task,
    toStatus: status,
    user,
    reason: holdComment,
    reasonCode: holdReason,
    comment,
    io,
  });

  task.holdReason = holdReason || undefined;
  task.holdComment = holdComment || undefined;
  await task.save();

  // 4. Automated handoff trigger if task is done or approved
  if (['done', 'approved'].includes(status)) {
    await advancePipelineHandoff(task, user, io);
  }

  return Task.findById(id)
    .populate('assignee', 'name email avatar team skills')
    .populate('dependencies', 'taskId title status');
}

export async function getWorkload(team) {
  const filter = { status: 'active' };
  if (team) {
    filter.$or = [{ team }, { skills: team }];
  }

  const users = await User.find(filter).select(
    'name email avatar role team skills weeklyCapacityHours onLeave'
  );

  const userIds = users.map((u) => u._id);

  const activeTasks = await Task.aggregate([
    {
      $match: {
        assignee: { $in: userIds },
        status: { $in: ['assigned', 'in_progress', 'blocked', 'on_hold'] },
      },
    },
    {
      $group: {
        _id: '$assignee',
        openTaskCount: { $sum: 1 },
        totalPlannedHours: { $sum: '$estimateHours' },
      },
    },
  ]);

  const workloadMap = new Map();
  activeTasks.forEach((t) => {
    workloadMap.set(String(t._id), {
      openTaskCount: t.openTaskCount,
      totalPlannedHours: t.totalPlannedHours,
    });
  });

  const workload = users.map((u) => {
    const stats = workloadMap.get(String(u._id)) || {
      openTaskCount: 0,
      totalPlannedHours: 0,
    };
    const capacity = u.weeklyCapacityHours || 40;
    const utilizationRate = Math.round((stats.totalPlannedHours / capacity) * 100);

    return {
      user: {
        _id: u._id,
        name: u.name,
        email: u.email,
        avatar: u.avatar,
        role: u.role,
        team: u.team,
        skills: u.skills || [],
        weeklyCapacityHours: capacity,
        onLeave: !!u.onLeave,
      },
      openTaskCount: stats.openTaskCount,
      totalPlannedHours: stats.totalPlannedHours,
      utilizationRate,
      status: u.onLeave ? 'on_leave' : utilizationRate > 90 ? 'overloaded' : 'available',
    };
  });

  return workload;
}

export async function getWorkloadSuggestions(team, skills = []) {
  const workload = await getWorkload(team);

  // Exclude workers currently on leave
  const eligible = workload.filter((w) => !w.user.onLeave);

  // Score each eligible worker:
  // - High score for matching skills
  // - Bonus for lower utilization rate
  eligible.forEach((w) => {
    let score = 100 - w.utilizationRate;
    if (skills.length > 0) {
      const matchCount = skills.filter((s) => w.user.skills.includes(s)).length;
      score += matchCount * 25;
    }
    w.matchScore = Math.max(score, 0);
  });

  eligible.sort((a, b) => b.matchScore - a.matchScore);

  return eligible;
}
