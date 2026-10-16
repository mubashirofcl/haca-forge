import { LeaveRequest } from './model.js';
import { User } from '../users/model.js';
import { createNotification } from '../notifications/service.js';
import { recordAuditLog } from '../audit/service.js';
import { logger } from '../../lib/logger.js';

export async function createLeaveRequest({ startDate, endDate, type, reason }, user, io) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    const err = new Error('Invalid leave start or end date');
    err.statusCode = 400;
    err.code = 'INVALID_DATES';
    throw err;
  }

  if (start > end) {
    const err = new Error('Leave start date must be before or equal to end date');
    err.statusCode = 400;
    err.code = 'INVALID_DATE_RANGE';
    throw err;
  }

  // Check for overlapping pending or approved leave requests
  const overlap = await LeaveRequest.findOne({
    userId: user._id,
    status: { $in: ['pending', 'approved'] },
    startDate: { $lte: end },
    endDate: { $gte: start },
  });

  if (overlap) {
    const err = new Error('An active or pending leave request already overlaps with these dates');
    err.statusCode = 400;
    err.code = 'OVERLAPPING_LEAVE';
    throw err;
  }

  const leaveDoc = await LeaveRequest.create({
    userId: user._id,
    startDate: start,
    endDate: end,
    type: type || 'vacation',
    reason,
    status: 'pending',
  });

  // Notify leads
  const leads = await User.find({ role: { $in: ['lead', 'admin'] } });
  for (const lead of leads) {
    await createNotification({
      recipient: lead._id,
      type: 'leave_requested',
      title: 'New Leave Request',
      message: `${user.name} requested ${type} leave from ${start.toLocaleDateString()} to ${end.toLocaleDateString()}`,
      entityType: 'leave',
      entityId: leaveDoc._id,
      io,
    });
  }

  return LeaveRequest.findById(leaveDoc._id).populate('userId', 'name email role team teamId attendance');
}

export async function listLeaveRequests(query = {}, user) {
  const filter = {};

  if (query.status) {
    filter.status = query.status;
  }

  // Scoping rules
  if (user.role === 'worker') {
    filter.userId = user._id;
  } else if (user.role === 'team_lead') {
    // team_lead sees their team's requests + own
    const teamName = user.team || user.teamId;
    const teamMembers = await User.find({
      $or: [{ teamId: teamName }, { _id: user._id }],
    }).select('_id');
    const memberIds = teamMembers.map((m) => m._id);
    filter.userId = { $in: memberIds };
  } else if (query.userId) {
    filter.userId = query.userId;
  }

  if (query.team && ['admin', 'lead'].includes(user.role)) {
    const teamUsers = await User.find({ teamId: query.team }).select('_id');
    filter.userId = { $in: teamUsers.map((u) => u._id) };
  }

  if (query.from || query.to) {
    filter.startDate = {};
    if (query.from) filter.startDate.$gte = new Date(query.from);
    if (query.to) filter.startDate.$lte = new Date(query.to);
  }

  const requests = await LeaveRequest.find(filter)
    .populate('userId', 'name email role team teamId avatar capacity attendance')
    .populate('reviewedBy', 'name email role')
    .sort({ startDate: -1 });

  return requests;
}

export async function reviewLeaveRequest(id, { status, reviewComment }, reviewer, io) {
  if (!reviewer || !['admin', 'lead', 'team_lead'].includes(reviewer.role)) {
    const err = new Error('Only Leads or Admins can review leave requests');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  const leave = await LeaveRequest.findById(id).populate('userId');
  if (!leave) {
    const err = new Error('Leave request not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  // Team lead scoping check
  if (reviewer.role === 'team_lead') {
    const reviewerTeam = reviewer.team || reviewer.teamId;
    const leaveUserTeam = leave.userId?.team || leave.userId?.teamId;
    if (reviewerTeam && leaveUserTeam && reviewerTeam !== leaveUserTeam) {
      const err = new Error('Team leads can only approve or reject leave requests for their own team');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }
  }

  const before = leave.toObject();

  leave.status = status;
  leave.reviewComment = reviewComment || undefined;
  leave.reviewedBy = reviewer._id;
  leave.reviewedAt = new Date();
  await leave.save();

  // If approved, update user's attendance and onLeave state
  if (status === 'approved') {
    const now = new Date();
    const isCurrentlyActive = now >= new Date(leave.startDate) && now <= new Date(leave.endDate);

    await User.findByIdAndUpdate(leave.userId._id, {
      ...(isCurrentlyActive ? { attendance: 'on_leave', onLeave: true } : {}),
      leaveDates: {
        start: leave.startDate,
        end: leave.endDate,
      },
    });
  }

  // Notify requester
  await createNotification({
    recipient: leave.userId._id,
    type: `leave_${status}`,
    title: `Leave Request ${status.toUpperCase()}`,
    message: `Your leave request for ${new Date(leave.startDate).toLocaleDateString()} has been ${status}${
      reviewComment ? `: "${reviewComment}"` : '.'
    }`,
    entityType: 'leave',
    entityId: leave._id,
    io,
  });

  await recordAuditLog({
    actor: reviewer._id,
    actorEmail: reviewer.email,
    action: `leave.${status}`,
    entity: 'LeaveRequest',
    entityId: leave._id,
    before: { status: before.status },
    after: { status, reviewComment },
  });

  return LeaveRequest.findById(id)
    .populate('userId', 'name email role team teamId attendance onLeave')
    .populate('reviewedBy', 'name email role');
}

export async function cancelLeaveRequest(id, user) {
  const leave = await LeaveRequest.findById(id);
  if (!leave) {
    const err = new Error('Leave request not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (leave.userId.toString() !== user._id.toString() && !['admin', 'lead'].includes(user.role)) {
    const err = new Error('You can only cancel your own leave requests');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  leave.status = 'cancelled';
  await leave.save();

  return leave;
}

/**
 * Checks if a specific user is on leave on a given date (or now)
 */
export async function isUserOnLeave(userId, targetDate = new Date()) {
  const date = new Date(targetDate);
  const activeLeave = await LeaveRequest.findOne({
    userId,
    status: 'approved',
    startDate: { $lte: date },
    endDate: { $gte: date },
  });

  if (activeLeave) return true;

  const user = await User.findById(userId);
  return user?.attendance === 'on_leave' || user?.onLeave === true;
}
