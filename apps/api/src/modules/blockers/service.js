import mongoose from 'mongoose';
import { Blocker } from './model.js';
import { recordBlocker, openBlockedInterval, closeIntervals, statusAfterBlocker } from './lifecycle.js';
import { WorkItem } from '../workItems/model.js';
import { Person } from '../people/model.js';
import { logActivity } from '../activity/service.js';
import { createNotification } from '../notifications/service.js';
import { sendMail } from '../../lib/mailer.js';
import { BLOCKER_DEPENDENCY_REASONS } from '@mmp/shared';
import { isTeamMember, participantWorkItemIds, requireParticipant } from '../workItems/access.js';

/**
 * Mark a deliverable Blocked and alert dependency owner if applicable
 */
export async function createBlocker(data, user) {
  if (isTeamMember(user)) await requireParticipant(data?.workItemId, user);
  const { workItemId, reason, notes = '', dependencyOwnerId } = data;

  // Validate mandatory dependencyOwnerId if reason requires it
  if (BLOCKER_DEPENDENCY_REASONS.includes(reason)) {
    if (!dependencyOwnerId || !dependencyOwnerId.trim()) {
      const error = new Error(
        `dependencyOwnerId is mandatory when blocker reason is "${reason}"`
      );
      error.statusCode = 400;
      error.code = 'DEPENDENCY_OWNER_REQUIRED';
      throw error;
    }
  }

  const workItem = await WorkItem.findById(workItemId)
    .populate('departmentId', 'name code')
    .populate('ownerId', 'name email role');

  if (!workItem) {
    const error = new Error('Work item not found');
    error.statusCode = 404;
    throw error;
  }

  const userId = (user._id || user.id || user.userId)?.toString();
  const blockerPerson = await Person.findOne({
    $or: [{ userId }, { _id: userId }],
  });

  const ownerIdStr = workItem.ownerId?._id?.toString() || workItem.ownerId?.toString();
  if (user.role === 'team_member' && ownerIdStr !== blockerPerson?._id?.toString()) {
    const error = new Error('You can only mark your own assigned deliverables as blocked');
    error.statusCode = 403;
    throw error;
  }

  // An owner cannot take a step out of review while its latest version waits on a reviewer.
  const userIdStr = (user._id || user.id || user.userId)?.toString();
  if (ownerIdStr && ownerIdStr === userIdStr) {
    const { assertOwnerCanLeaveReview } = await import('../submissions/reviewDecision.js');
    await assertOwnerCanLeaveReview(workItem);
  }

  let dependencyPerson = null;
  if (dependencyOwnerId) {
    dependencyPerson = await Person.findById(dependencyOwnerId);
    if (!dependencyPerson) {
      const error = new Error('Dependency owner person not found');
      error.statusCode = 400;
      throw error;
    }
  }

  const fromStatus = workItem.status;

  // Active blocker record, remembering the status to return to (an earlier one is replaced)
  const blocker = await recordBlocker(workItem, {
    reason,
    notes: notes.trim(),
    dependencyOwnerId: dependencyPerson?._id || null,
    blockedById: blockerPerson?._id || user._id,
    statusBefore: fromStatus,
  });
  if (dependencyPerson) {
    blocker.lastNotifiedAt = new Date();
    await blocker.save();
  }

  // Update WorkItem state; blocked time is paused, not counted as work time
  workItem.status = 'Blocked';
  workItem.blockerReason = reason;
  workItem.blockerNote = notes.trim();
  openBlockedInterval(workItem, { reason, note: notes.trim() });
  await workItem.save();

  // Log ActivityEvent
  await logActivity({
    entityType: 'work_item',
    entityId: workItem._id,
    actor: user,
    action: 'work_item.blocked',
    fromStatus,
    toStatus: 'Blocked',
    metadata: {
      blockerId: blocker._id,
      reason,
      notes,
      dependencyOwnerId: dependencyPerson?._id,
      dependencyOwnerName: dependencyPerson?.name,
    },
  });

  // Immediate Alert to Dependency Owner
  if (dependencyPerson) {
    await createNotification({
      recipient: dependencyPerson._id,
      type: 'work_item.blocked',
      title: `Action Needed: Deliverable Blocked Waiting on You`,
      message: `"${workItem.title}" is blocked: ${reason}. ${notes ? `Note: ${notes}` : ''}`,
      link: `/issues`,
      metadata: { workItemId: workItem._id, blockerId: blocker._id, reason },
    });

    try {
      if (dependencyPerson.email) {
        await sendMail({
          to: dependencyPerson.email,
          subject: `[Marketing OS] Deliverable Blocked: Waiting on Your Input (${workItem.title})`,
          text: `Hello ${dependencyPerson.name},\n\nDeliverable "${workItem.title}" has been marked as Blocked waiting on you.\n\nReason: ${reason}\nNotes: ${notes || 'None provided'}\nReported by: ${blockerPerson?.name || 'Team'}\n\nPlease review and unblock in Marketing OS: http://localhost:5173/issues\n`,
        });
      }
    } catch (mailErr) {
      // Non-blocking mail failure
    }
  }

  // Notify SM Manager of active blocker
  try {
    const smManagers = await Person.find({ role: 'sm_manager', status: 'active' });
    for (const sm of smManagers) {
      if (dependencyPerson && String(sm._id) === String(dependencyPerson._id)) continue;
      await createNotification({
        recipient: sm._id,
        type: 'work_item.blocked',
        title: `Deliverable Blocked: ${workItem.title}`,
        message: `"${workItem.title}" was marked as Blocked: ${reason}. ${notes ? `Note: ${notes}` : ''}`,
        link: `/issues`,
        metadata: { workItemId: workItem._id, blockerId: blocker._id, reason },
      });
    }
  } catch (smErr) {
    // Non-blocking
  }

  return Blocker.findById(blocker._id)
    .populate('workItemId', 'title workType deadline status')
    .populate('blockedById', 'name email role')
    .populate('dependencyOwnerId', 'name email role jobRole');
}

/**
 * Resolve an active blocker and restore work item status
 */
export async function resolveBlocker(blockerId, data = {}, user) {
  const { resolutionNotes = '', resumeStatus } = data;

  const blocker = await Blocker.findById(blockerId);
  if (!blocker) {
    const error = new Error('Blocker not found');
    error.statusCode = 404;
    throw error;
  }

  if (blocker.status === 'Resolved') {
    return blocker;
  }

  const userId = (user._id || user.id || user.userId)?.toString();
  const resolverPerson = await Person.findOne({
    $or: [{ userId }, { _id: userId }],
  });

  blocker.status = 'Resolved';
  blocker.resolvedAt = new Date();
  blocker.resolvedById = resolverPerson?._id || user._id;
  blocker.resolutionNotes = resolutionNotes.trim();
  await blocker.save();

  // Restore WorkItem: back to the status it had before it was blocked (unless an explicit,
  // valid resume status was chosen), with its blocked interval closed.
  const workItem = await WorkItem.findById(blocker.workItemId);
  const resumedTo = statusAfterBlocker(blocker, resumeStatus);
  if (workItem && workItem.status === 'Blocked') {
    const fromStatus = workItem.status;
    workItem.status = resumedTo;
    workItem.blockerReason = null;
    workItem.blockerNote = '';
    closeIntervals(workItem, ['blocked']);
    await workItem.save();
    const resumeStatus = resumedTo;

    // Log ActivityEvent
    await logActivity({
      entityType: 'work_item',
      entityId: workItem._id,
      actor: user,
      action: 'work_item.unblocked',
      fromStatus,
      toStatus: resumeStatus,
      metadata: {
        blockerId: blocker._id,
        resolutionNotes,
        resolvedBy: resolverPerson?.name,
      },
    });

    // Notify WorkItem Owner that blocker is resolved
    if (workItem.ownerId) {
      await createNotification({
        recipient: workItem.ownerId,
        type: 'work_item.unblocked',
        title: `Blocker Cleared: ${workItem.title}`,
        message: `The blocker on "${workItem.title}" has been resolved by ${resolverPerson?.name || 'team'}. Status restored to ${resumeStatus}.`,
        link: `/work/${workItem._id}`,
        metadata: { workItemId: workItem._id, blockerId: blocker._id },
      });
    }
  }

  return Blocker.findById(blocker._id)
    .populate('workItemId', 'title workType deadline status')
    .populate('blockedById', 'name email role')
    .populate('dependencyOwnerId', 'name email role')
    .populate('resolvedById', 'name email role');
}

/**
 * Re-ping / notify dependency owner with a reminder
 */
export async function notifyDependencyOwner(blockerId, user) {
  const blocker = await Blocker.findById(blockerId)
    .populate('workItemId', 'title')
    .populate('dependencyOwnerId', 'name email');

  if (!blocker) {
    const error = new Error('Blocker not found');
    error.statusCode = 404;
    throw error;
  }

  if (blocker.status !== 'Active') {
    const error = new Error('Cannot send reminder for an already resolved blocker');
    error.statusCode = 400;
    throw error;
  }

  if (!blocker.dependencyOwnerId) {
    const error = new Error('This blocker has no dependency owner assigned');
    error.statusCode = 400;
    throw error;
  }

  blocker.lastNotifiedAt = new Date();
  await blocker.save();

  await createNotification({
    recipient: blocker.dependencyOwnerId._id,
    type: 'blocker.reminder',
    title: `Reminder: Deliverable Still Blocked Waiting on You`,
    message: `Reminder: "${blocker.workItemId?.title}" is awaiting resolution for reason: ${blocker.reason}.`,
    link: `/issues`,
    metadata: { blockerId: blocker._id, workItemId: blocker.workItemId?._id },
  });

  try {
    if (blocker.dependencyOwnerId.email) {
      await sendMail({
        to: blocker.dependencyOwnerId.email,
        subject: `[Reminder] Action Needed: Deliverable Blocked (${blocker.workItemId?.title})`,
        text: `Hello ${blocker.dependencyOwnerId.name},\n\nThis is a friendly reminder that "${blocker.workItemId?.title}" is still blocked waiting on your input (${blocker.reason}).\n\nPlease review at: http://localhost:5173/issues\n`,
      });
    }
  } catch (err) {
    // Non-blocking
  }

  // Log Activity
  await logActivity({
    entityType: 'work_item',
    entityId: blocker.workItemId?._id,
    actor: user,
    action: 'blocker.reminder_sent',
    metadata: { blockerId: blocker._id, dependencyOwner: blocker.dependencyOwnerId.name },
  });

  return blocker;
}

/**
 * List active or resolved blockers with duration calculations
 */
export async function listBlockers(filters = {}, user) {
  const query = {};

  if (filters.status) {
    query.status = filters.status;
  } else {
    // Default to Active if not specified
    query.status = 'Active';
  }

  if (filters.dependencyOwnerId) {
    query.dependencyOwnerId = filters.dependencyOwnerId;
  }

  if (filters.reason) {
    query.reason = filters.reason;
  }

  if (filters.workItemId && mongoose.isValidObjectId(filters.workItemId)) {
    query.workItemId = new mongoose.Types.ObjectId(filters.workItemId);
  }

  // A team_member sees only blockers on deliverables they participate in.
  if (isTeamMember(user)) {
    const allowed = await participantWorkItemIds(user);
    if (query.workItemId) {
      const wanted = String(query.workItemId);
      query.workItemId = { $in: allowed.filter((id) => String(id) === wanted) };
    } else {
      query.workItemId = { $in: allowed };
    }
  }

  const blockers = await Blocker.find(query)
    .populate({
      path: 'workItemId',
      select: 'title workType deadline status departmentId ownerId',
      populate: [
        { path: 'departmentId', select: 'name code' },
        { path: 'ownerId', select: 'name email role jobRole' },
      ],
    })
    .populate('blockedById', 'name email role')
    .populate('dependencyOwnerId', 'name email role jobRole departmentId')
    .populate('resolvedById', 'name email role')
    .sort({ blockedAt: -1 });

  // Map and compute blocked duration
  const now = Date.now();
  return blockers.map((b) => {
    const obj = b.toObject();
    const start = new Date(b.blockedAt).getTime();
    const end = b.resolvedAt ? new Date(b.resolvedAt).getTime() : now;
    const durationHours = Math.round((end - start) / (1000 * 60 * 60));
    const durationDays = (durationHours / 24).toFixed(1);

    return {
      ...obj,
      durationHours,
      durationDays: Number(durationDays),
      isLongBlocked: durationHours > 48,
    };
  });
}
