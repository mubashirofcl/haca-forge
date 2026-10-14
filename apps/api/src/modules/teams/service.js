import { Team } from './model.js';
import { User } from '../users/model.js';
import { recordAuditLog } from '../audit/service.js';

export async function listTeams() {
  const teams = await Team.find()
    .populate('lead', 'name email role')
    .populate('members', 'name email role skills capacity attendance')
    .lean();

  // If members array is empty, also find users assigned to this teamId
  for (const team of teams) {
    if (!team.members || team.members.length === 0) {
      team.members = await User.find({ teamId: team.name })
        .select('name email role skills capacity attendance')
        .lean();
    }
    // Calculate total allocated weekly capacity
    team.totalWeeklyCapacity = (team.members || []).reduce(
      (sum, m) => sum + (m.capacity || 40),
      0
    );
  }

  return teams;
}

export async function getTeamByName(name) {
  return Team.findOne({ name })
    .populate('lead', 'name email role')
    .populate('members', 'name email role skills capacity attendance')
    .lean();
}

export async function updateTeam(id, updates, actor) {
  const before = await Team.findById(id).lean();
  if (!before) return null;

  const after = await Team.findByIdAndUpdate(id, updates, { new: true })
    .populate('lead', 'name email role')
    .populate('members', 'name email role skills capacity attendance')
    .lean();

  await recordAuditLog({
    actor: actor?._id,
    actorEmail: actor?.email,
    action: 'team.update',
    entity: 'Team',
    entityId: id,
    before,
    after,
  });

  return after;
}

export async function addTeamMember(teamId, userId, actor) {
  const team = await Team.findById(teamId);
  if (!team) return null;

  if (!team.members.includes(userId)) {
    team.members.push(userId);
    await team.save();
  }

  // Update user's teamId
  await User.findByIdAndUpdate(userId, { teamId: team.name });

  await recordAuditLog({
    actor: actor?._id,
    actorEmail: actor?.email,
    action: 'team.member_add',
    entity: 'Team',
    entityId: teamId,
    after: { teamId, userId },
  });

  return Team.findById(teamId).populate('members', 'name email role capacity').lean();
}

export async function removeTeamMember(teamId, userId, actor) {
  const team = await Team.findById(teamId);
  if (!team) return null;

  team.members = team.members.filter((m) => m.toString() !== userId.toString());
  await team.save();

  await User.findByIdAndUpdate(userId, { $unset: { teamId: 1 } });

  await recordAuditLog({
    actor: actor?._id,
    actorEmail: actor?.email,
    action: 'team.member_remove',
    entity: 'Team',
    entityId: teamId,
    after: { teamId, userId },
  });

  return Team.findById(teamId).populate('members', 'name email role capacity').lean();
}

/**
 * Get comprehensive team dashboard data (members, capacity, load, leave, skills matrix, queue)
 */
export async function getTeamDashboardData(teamIdOrName, user) {
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(teamIdOrName);
  let team;
  if (isObjectId) {
    team = await Team.findById(teamIdOrName).populate('lead', 'name email role').lean();
  } else {
    team = await Team.findOne({ name: { $regex: new RegExp(`^${teamIdOrName}$`, 'i') } })
      .populate('lead', 'name email role')
      .lean();
  }

  if (!team) {
    // Fallback: create virtual team object if using valid team key
    team = { name: teamIdOrName.toLowerCase(), totalWeeklyCapacity: 0 };
  }

  // Team lead scoping check: team_lead can only view their own team
  if (user.role === 'team_lead') {
    const userTeam = (user.team || user.teamId || '').toLowerCase();
    if (userTeam && team.name.toLowerCase() !== userTeam) {
      const err = new Error('Team leads can only access dashboard data for their own assigned team');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }
  }

  const teamNameLower = team.name.toLowerCase();

  // Find all active members belonging to this team
  const members = await User.find({
    status: 'active',
    $or: [{ teamId: { $regex: new RegExp(`^${teamNameLower}$`, 'i') } }, { team: teamNameLower }],
  })
    .select('name email role avatar skills capacity attendance onLeave leaveDates')
    .lean();

  const memberIds = members.map((m) => m._id);

  // Import Task dynamically or use Task model
  const { Task } = await import('../tasks/model.js');
  const { LeaveRequest } = await import('../leave/model.js');

  // Fetch open tasks for these members
  const openTasks = await Task.find({
    assignee: { $in: memberIds },
    status: { $in: ['assigned', 'in_progress', 'submitted'] },
  })
    .populate('contentItemId', 'contentId title format priority status')
    .lean();

  // Group tasks by member
  const memberTasksMap = new Map();
  for (const task of openTasks) {
    const mId = String(task.assignee);
    if (!memberTasksMap.has(mId)) memberTasksMap.set(mId, []);
    memberTasksMap.get(mId).push(task);
  }

  // Active leaves in current range
  const now = new Date();
  const activeLeaves = await LeaveRequest.find({
    userId: { $in: memberIds },
    status: 'approved',
    endDate: { $gte: now },
  }).lean();

  const memberLeavesMap = new Map();
  for (const leave of activeLeaves) {
    const uId = String(leave.userId);
    if (!memberLeavesMap.has(uId)) memberLeavesMap.set(uId, []);
    memberLeavesMap.get(uId).push(leave);
  }

  // Enrich members with planned hours, utilization and current tasks
  const enrichedMembers = members.map((m) => {
    const mId = String(m._id);
    const tasks = memberTasksMap.get(mId) || [];
    const plannedHours = tasks.reduce((sum, t) => sum + (t.estimateHours || 2), 0);
    const capacity = m.capacity || 40;
    const utilization = Math.round((plannedHours / capacity) * 100);
    const isOverloaded = plannedHours > capacity;
    const leaves = memberLeavesMap.get(mId) || [];
    const currentlyOnLeave =
      m.attendance === 'on_leave' ||
      m.onLeave === true ||
      leaves.some((l) => now >= new Date(l.startDate) && now <= new Date(l.endDate));

    return {
      ...m,
      tasks,
      taskCount: tasks.length,
      plannedHours,
      capacity,
      utilization,
      isOverloaded,
      currentlyOnLeave,
      upcomingLeaves: leaves,
    };
  });

  // Skills matrix: distinct skills across the team
  const allSkills = [...new Set(members.flatMap((m) => m.skills || []))].sort();
  const skillsMatrix = enrichedMembers.map((m) => ({
    userId: m._id,
    name: m.name,
    avatar: m.avatar,
    skills: allSkills.map((s) => ({
      skill: s,
      hasSkill: (m.skills || []).includes(s),
    })),
  }));

  // Team unassigned / team queue tasks
  const teamQueue = await Task.find({
    team: { $regex: new RegExp(`^${teamNameLower}$`, 'i') },
    status: { $in: ['assigned', 'in_progress'] },
  })
    .populate('assignee', 'name email avatar')
    .populate('contentItemId', 'contentId title format priority status')
    .sort({ dueDate: 1 })
    .lean();

  const totalCapacity = enrichedMembers.reduce((sum, m) => sum + m.capacity, 0);
  const totalPlanned = enrichedMembers.reduce((sum, m) => sum + m.plannedHours, 0);

  return {
    team: {
      ...team,
      totalWeeklyCapacity: totalCapacity,
      totalPlannedHours: totalPlanned,
      utilization: totalCapacity ? Math.round((totalPlanned / totalCapacity) * 100) : 0,
    },
    members: enrichedMembers,
    skillsMatrix,
    allSkills,
    teamQueue,
  };
}

/**
 * Returns team handoff queues across all four teams plus Lead review queue
 */
export async function getTeamHandoffQueues(user) {
  const { Task } = await import('../tasks/model.js');
  const { ContentItem } = await import('../content/model.js');
  const { Shoot } = await import('../shoots/model.js');

  // 1. Editor: "Footage Ready" queue
  // Tasks where team is 'editor' and prerequisite cinematography task is 'done' or shoot is 'done'
  const editorTasks = await Task.find({
    team: 'editor',
    status: { $in: ['assigned', 'in_progress'] },
  })
    .populate('assignee', 'name email avatar')
    .populate('contentItemId', 'contentId title format priority status')
    .populate('dependencies', 'taskId title status team')
    .sort({ dueDate: 1 })
    .lean();

  const footageReadyQueue = editorTasks.filter((t) => {
    if (!t.dependencies || t.dependencies.length === 0) return true;
    return t.dependencies.every((d) => ['done', 'approved'].includes(d.status));
  });

  // 2. Graphics: "Copy Ready" queue
  // Tasks where team is 'graphics' and prerequisite content stage is 'done'
  const graphicsTasks = await Task.find({
    team: 'graphics',
    status: { $in: ['assigned', 'in_progress'] },
  })
    .populate('assignee', 'name email avatar')
    .populate('contentItemId', 'contentId title format priority status')
    .populate('dependencies', 'taskId title status team')
    .sort({ dueDate: 1 })
    .lean();

  const copyReadyQueue = graphicsTasks.filter((t) => {
    if (!t.dependencies || t.dependencies.length === 0) return true;
    return t.dependencies.every((d) => ['done', 'approved'].includes(d.status));
  });

  // 3. Cinematography: "Script Ready" content items & "Today's Shoots"
  const now = new Date();
  const startOfDay = new Date(now.setHours(0, 0, 0, 0));
  const endOfDay = new Date(now.setHours(23, 59, 59, 999));

  const todaysShoots = await Shoot.find({
    date: { $gte: startOfDay, $lte: endOfDay },
    status: { $in: ['scheduled', 'reshoot_needed'] },
  })
    .populate('crew', 'name email avatar')
    .populate('contentItems', 'contentId title format status')
    .lean();

  const cinemaTasks = await Task.find({
    team: 'cinematography',
    status: { $in: ['assigned', 'in_progress'] },
  })
    .populate('assignee', 'name email avatar')
    .populate('contentItemId', 'contentId title format priority status')
    .populate('dependencies', 'taskId title status team')
    .sort({ dueDate: 1 })
    .lean();

  const scriptReadyQueue = cinemaTasks.filter((t) => {
    if (!t.dependencies || t.dependencies.length === 0) return true;
    return t.dependencies.every((d) => ['done', 'approved'].includes(d.status));
  });

  // 4. Lead: "Waiting for Review" queue
  const waitingForReview = await ContentItem.find({
    status: 'in_review',
  })
    .populate('tasks', 'taskId title team status assignee')
    .sort({ updatedAt: -1 })
    .lean();

  return {
    editor: {
      title: 'Footage Ready Queue',
      count: footageReadyQueue.length,
      tasks: footageReadyQueue,
    },
    graphics: {
      title: 'Copy Ready Queue',
      count: copyReadyQueue.length,
      tasks: copyReadyQueue,
    },
    cinematography: {
      title: 'Script Ready Queue',
      count: scriptReadyQueue.length,
      tasks: scriptReadyQueue,
      todaysShoots,
    },
    lead: {
      title: 'Waiting for Review',
      count: waitingForReview.length,
      items: waitingForReview,
    },
  };
}

/**
 * Reassign task to another worker with capacity check
 */
export async function reassignTask({ taskId, targetUserId }, actor, io) {
  const { Task } = await import('../tasks/model.js');
  const { isUserOnLeave } = await import('../leave/service.js');
  const { createNotification } = await import('../notifications/service.js');

  const task = await Task.findById(taskId);
  if (!task) {
    const err = new Error('Task not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const targetUser = await User.findById(targetUserId);
  if (!targetUser) {
    const err = new Error('Target worker not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  // Check if target user is on leave
  const onLeave = await isUserOnLeave(targetUserId);
  const warnings = [];
  if (onLeave) {
    warnings.push(`Warning: ${targetUser.name} is currently marked on leave.`);
  }

  // Calculate current workload of target user
  const activeTasks = await Task.find({
    assignee: targetUserId,
    status: { $in: ['assigned', 'in_progress'] },
  });
  const currentHours = activeTasks.reduce((sum, t) => sum + (t.estimateHours || 2), 0);
  const capacity = targetUser.capacity || 40;
  if (currentHours + (task.estimateHours || 2) > capacity) {
    warnings.push(`Warning: Reassigning will put ${targetUser.name} at ${Math.round(((currentHours + (task.estimateHours || 2)) / capacity) * 100)}% capacity (Overloaded).`);
  }

  const prevAssignee = task.assignee;
  task.assignee = targetUserId;
  await task.save();

  // Notify new assignee
  await createNotification({
    recipient: targetUserId,
    type: 'task_assigned',
    title: 'Task Reassigned to You',
    message: `${actor.name} reassigned task ${task.taskId}: "${task.title}" to you.`,
    entityType: 'task',
    entityId: task._id,
    io,
  });

  await recordAuditLog({
    actor: actor._id,
    actorEmail: actor.email,
    action: 'task.reassign',
    entity: 'Task',
    entityId: task._id,
    before: { assignee: prevAssignee },
    after: { assignee: targetUserId },
  });

  const updatedTask = await Task.findById(task._id)
    .populate('assignee', 'name email avatar team skills capacity attendance')
    .populate('contentItemId', 'contentId title format status');

  return {
    task: updatedTask,
    warnings,
  };
}
