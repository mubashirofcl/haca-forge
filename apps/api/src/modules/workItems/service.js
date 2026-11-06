import mongoose from 'mongoose';
import { WorkItem } from './model.js';
import { Department } from '../departments/model.js';
import { resolveScope } from '../../lib/scope.js';
import { logActivity, listRecentActivities } from '../activity/service.js';
import { ActivityEvent } from '../activity/model.js';
import { Submission } from '../submissions/model.js';
import { normalizeWorkType, normalizeRole, WORK_TYPE_DEPARTMENT_MAP, getAvailableActions } from '@mmp/shared';

export async function createWorkItem(data, user) {
  // 1. Resolve Department ID (auto-infer from workType if omitted)
  let resolvedDepartmentId =
    data.departmentId && mongoose.Types.ObjectId.isValid(data.departmentId)
      ? data.departmentId
      : null;
  const normalizedType = normalizeWorkType(data.workType) || data.workType;
  if (!resolvedDepartmentId) {
    const deptCode = WORK_TYPE_DEPARTMENT_MAP[normalizedType];
    if (deptCode) {
      const deptDoc =
        (await Department.findOne({ code: deptCode, isActive: true })) ||
        (await Department.findOne({ code: deptCode }));
      if (deptDoc) {
        resolvedDepartmentId = deptDoc._id;
      }
    }
  }
  if (!resolvedDepartmentId) {
    const fallbackDept = await Department.findOne({ isActive: true });
    if (fallbackDept) {
      resolvedDepartmentId = fallbackDept._id;
    }
  }

  // 4. Resolve Owner ID
  let resolvedOwnerId =
    data.ownerId && mongoose.Types.ObjectId.isValid(data.ownerId)
      ? data.ownerId
      : null;
  if (!resolvedOwnerId && data.ownerId === undefined && (user?._id || user?.userId)) {
    const candidateId = user._id || user.userId;
    if (mongoose.Types.ObjectId.isValid(candidateId)) {
      resolvedOwnerId = candidateId;
    }
  }

  const desc =
    data.description !== undefined
      ? data.description
      : typeof data.brief === 'string'
      ? data.brief
      : data.brief?.description || '';
  const contentLink = data.contentLink || data.brief?.contentLink || '';
  const assetsLink = data.assetsLink || data.brief?.assetsLink || '';

  const workItem = await WorkItem.create({
    title: data.title.trim(),
    workType: normalizedType,
    departmentId: resolvedDepartmentId,
    ownerId: resolvedOwnerId,
    assignedAt: resolvedOwnerId ? new Date() : null,
    deadline: data.deadline,
    estimatedEffortHrs: data.estimatedEffortHrs || 4,
    status: data.status || 'Not Started',
    priority: data.priority || 'Medium',
    description: desc,
    deliverableUrl: data.deliverableUrl || '',
    publishedUrl: data.publishedUrl || '',
    blockerReason: data.status === 'Blocked' ? data.blockerReason : null,
    blockerNote: data.status === 'Blocked' ? data.blockerNote : '',
    // Content Flow stage fields (Phase 3 delta)
    contentPieceId: data.contentPieceId || null,
    stageKey: data.stageKey || null,
    stageOrder: data.stageOrder !== undefined ? data.stageOrder : null,
    reviewRequired: Boolean(data.reviewRequired),
    unlockedAt: data.unlockedAt || null,
    isSkipped: Boolean(data.isSkipped),
    contentLink,
    assetsLink,
    brief: {
      description: desc,
      contentLink,
      assetsLink,
    },
  });

  await logActivity({
    entityType: 'work_item',
    entityId: workItem._id,
    actor: user,
    action: 'work_item.created',
    toStatus: workItem.status,
    metadata: {
      title: workItem.title,
      workType: workItem.workType,
      ownerId: workItem.ownerId,
      deadline: workItem.deadline,
    },
  });

  return WorkItem.findById(workItem._id)
    .populate('departmentId', 'name code')
    .populate('ownerId', 'name email role jobRole');
}

export async function listWorkItems(filters = {}, user) {
  const scope = await resolveScope(user, filters);
  const query = {};

  // Person Scoping (for Team Member)
  if (user.role === 'team_member' && filters.scopedToSelf !== false && !filters.allWork) {
    const userId = (user._id || user.id || user.userId)?.toString();
    query.ownerId = userId;
  } else if (filters.ownerId && filters.ownerId !== 'all') {
    query.ownerId = filters.ownerId;
  }

  if (filters.departmentId && filters.departmentId !== 'all') {
    query.departmentId = filters.departmentId;
  }

  if (filters.status && filters.status !== 'all') {
    query.status = filters.status;
  }

  if (filters.calendar && filters.calendar !== 'all') {
    query.calendar = filters.calendar;
  }

  if (user && user.role === 'team_member') {
    query.ownerId = (user._id || user.id || user.userId)?.toString();
  }

  if (filters.workType && filters.workType !== 'all') {
    query.workType = filters.workType;
  }

  if (filters.priority && filters.priority !== 'all') {
    query.priority = filters.priority;
  }

  // Content Flow filters
  if (filters.contentPieceId) {
    query.contentPieceId = filters.contentPieceId;
  }
  if (filters.stageKey && filters.stageKey !== 'all') {
    query.stageKey = filters.stageKey;
  }

  // Dynamic Overdue filter
  if (filters.isOverdue === 'true' || filters.isOverdue === true) {
    query.deadline = { $lt: new Date() };
    query.status = { $nin: ['Approved', 'Published'] };
  }

  if (filters.search) {
    const regex = new RegExp(filters.search, 'i');
    query.$or = [{ title: regex }, { description: regex }];
  }

  const items = await WorkItem.find(query)
    .populate('departmentId', 'name code')
    .populate('ownerId', 'name email role jobRole')
    .sort({ deadline: 1, createdAt: -1 });

  return items;
}

/**
 * Older steps were worked on before their timing fields were saved, but the
 * same moments exist in the activity log and in submissions. Fill only the
 * blanks, for this response. Saved records are not changed.
 */
async function withRecordedStepTimes(stages) {
  const plain = stages.map((s) => s.toObject());
  const missing = plain.filter((s) => {
    if (s.status === 'Not Started') return false;
    return !s.startedAt || !s.submittedAt || (['Approved', 'Published'].includes(s.status) && !s.approvedAt) || (s.status === 'Published' && !s.postedAt);
  });
  if (missing.length === 0) return plain;

  const ids = missing.map((s) => s._id);
  const [events, submissions] = await Promise.all([
    ActivityEvent.find({
      entityType: 'work_item',
      entityId: { $in: [...ids, ...ids.map(String)] },
      toStatus: { $in: ['In Progress', 'Approved', 'Published'] },
    })
      .select('entityId toStatus timestamp createdAt')
      .sort({ timestamp: 1 })
      .lean(),
    Submission.find({ workItemId: { $in: ids }, version: { $gt: 0 }, submittedAt: { $ne: null } })
      .select('workItemId status submittedAt reviewedAt')
      .sort({ submittedAt: 1 })
      .lean(),
  ]);

  for (const stage of missing) {
    const id = String(stage._id);
    const eventTimes = (toStatus) =>
      events.filter((e) => String(e.entityId) === id && e.toStatus === toStatus).map((e) => e.timestamp || e.createdAt);
    const subs = submissions.filter((sub) => String(sub.workItemId) === id);
    const done = ['Approved', 'Published'].includes(stage.status);

    stage.startedAt ||= eventTimes('In Progress')[0] || null;
    if (!stage.submittedAt && subs.length > 0) {
      stage.submittedAt = subs[0].submittedAt;
      if (subs.length > 1) stage.resubmittedAt ||= subs[subs.length - 1].submittedAt;
    }
    if (done) stage.approvedAt ||= eventTimes('Approved').at(-1) || subs.filter((sub) => sub.status === 'approved' && sub.reviewedAt).at(-1)?.reviewedAt || null;
    if (stage.status === 'Published') stage.postedAt ||= eventTimes('Published').at(-1) || null;
  }
  return plain;
}

export async function getWorkItemById(id, user) {
  const workItem = await WorkItem.findById(id)
    .populate('departmentId', 'name code')
    .populate('ownerId', 'name email role jobRole avatarUrl');

  if (!workItem) {
    const error = new Error('Work item not found');
    error.statusCode = 404;
    throw error;
  }

  const result = workItem.toObject();
  if (result.contentPieceId) {
    const { reconcileContentPieceStageLocks } = await import('./transition.service.js');
    await reconcileContentPieceStageLocks(result.contentPieceId);

    const refreshed = await WorkItem.findById(id).select('isLocked unlockedAt');
    if (refreshed) {
      result.isLocked = refreshed.isLocked;
      result.unlockedAt = refreshed.unlockedAt;
    }

    const siblingStages = await WorkItem.find({ contentPieceId: result.contentPieceId })
      .select('stageKey stageOrder status isLocked isSkipped ownerId title deadline deliverableUrl publishedUrl revisions startedAt submittedAt resubmittedAt approvedAt postedAt')
      .populate('ownerId', 'name email role jobRole avatarUrl')
      .sort({ stageOrder: 1 });
    result.pieceStages = await withRecordedStepTimes(siblingStages);

    if (result.stageOrder > 1) {
      const prevStage = siblingStages.find((s) => s.stageOrder === result.stageOrder - 1);
      result.previousStage = prevStage ? {
        stageKey: prevStage.stageKey,
        deliverableUrl: prevStage.deliverableUrl,
        publishedUrl: prevStage.publishedUrl,
        status: prevStage.status,
        owner: prevStage.ownerId,
      } : null;
      if (prevStage?.ownerId) {
        result.suggestedDependencyOwner = prevStage.ownerId;
      }
    }

    // Attach shot list from Script stage for Shoot and Edit stages (WS2 Acceptance Criteria)
    if (result.stageKey === 'Shoot' || result.stageKey === 'Edit') {
      const scriptStage = siblingStages.find((s) => s.stageKey === 'Script');
      if (scriptStage) {
        try {
          const { Submission } = await import('../submissions/model.js');
          const scriptSub = await Submission.findOne({
            workItemId: scriptStage._id,
            version: { $gt: 0 },
          }).sort({ version: -1 });

          if (scriptSub?.document?.metadata?.shotList) {
            result.scriptShotList = scriptSub.document.metadata.shotList;
          }
          if (scriptSub?.document?.htmlSnapshot || scriptSub?.document?.plainText) {
            result.scriptContent = scriptSub.document.htmlSnapshot || scriptSub.document.plainText;
          }
        } catch {}
      }
    }

    // Attach approved clips from Shoot stage for Edit stage (WS3 requirement)
    if (result.stageKey === 'Edit') {
      const shootStage = siblingStages.find((s) => s.stageKey === 'Shoot');
      if (shootStage) {
        try {
          const { MediaItem } = await import('../media/model.js');
          const approvedClips = await MediaItem.find({
            stageItemId: shootStage._id,
            status: 'approved',
          })
            .select('title shotRef take tags notes url thumbnailUrl durationSeconds width height orientationOk sizeBytes')
            .sort({ order: 1, createdAt: 1 })
            .lean();
          result.approvedClips = approvedClips;
        } catch {}
      }
    }
  }

  // Attach Latest Submission & Draft Submission for clean UI state & review cockpit
  try {
    const { Submission } = await import('../submissions/model.js');
    const latestSub = await Submission.findOne({
      workItemId: id,
      version: { $gt: 0 },
    })
      .sort({ version: -1 })
      .populate('submittedById', 'name email role jobRole')
      .populate('reviewedById', 'name email role jobRole')
      .lean();
    if (latestSub) {
      result.latestSubmission = latestSub;
    }

    const draftSub = await Submission.findOne({
      workItemId: id,
      version: 0,
    }).lean();
    if (draftSub) {
      result.draftSubmission = draftSub;
    }
  } catch {}

  // Attach Rating if approved with rating
  try {
    const { Rating } = await import('../submissions/model.js');
    const rating = await Rating.findOne({ workItemId: id })
      .sort({ createdAt: -1 })
      .populate('raterId', 'name email role')
      .populate('editedLog.editedBy', 'name role')
      .lean();
    if (rating) {
      result.rating = rating;
    }
  } catch {}

  return result;
}

/** The one field a step's owner sets through PATCH: the link saved after submitting a deliverable. */
const OWNER_PATCH_FIELDS = new Set(['deliverableUrl']);

function workItemNotFound() {
  const error = new Error('Work item not found');
  error.statusCode = 404;
  error.code = 'NOT_FOUND';
  return error;
}

function workItemPatchForbidden(message) {
  const error = new Error(message);
  error.statusCode = 403;
  error.code = 'FORBIDDEN_ACTION';
  return error;
}

/**
 * Who may PATCH a work item. Ownership always comes from the stored step, never the request.
 * - admin, sm_manager: every field.
 * - The step's owner, in any other role: deliverableUrl only, until the step is Approved or Published.
 * - team_member who owns another step of the same content piece: 403.
 * - Any other team_member: 404, the same response as a missing item or an invalid id.
 * - creative_head who does not own the step: 403.
 */
export async function assertCanPatchWorkItem(id, body, user) {
  const role = normalizeRole(user.role);
  if (role === 'admin' || role === 'sm_manager') return;

  const isTeamMember = role === 'team_member';
  if (isTeamMember && !mongoose.isValidObjectId(id)) throw workItemNotFound();

  const stored = await WorkItem.findById(id).select('ownerId contentPieceId status').lean();
  if (!stored) throw workItemNotFound();

  const userId = (user._id || user.id || user.userId)?.toString();
  const isOwner = Boolean(stored.ownerId && userId && stored.ownerId.toString() === userId);

  if (isTeamMember && !isOwner) {
    const onSamePiece =
      stored.contentPieceId && userId
        ? await WorkItem.exists({ contentPieceId: stored.contentPieceId, ownerId: userId })
        : null;
    if (!onSamePiece) throw workItemNotFound();
  }

  if (!isOwner) throw workItemPatchForbidden('Only an SM Manager or Admin can edit this work item');

  const fields = Object.keys(body || {});
  if (!fields.every((field) => OWNER_PATCH_FIELDS.has(field))) {
    throw workItemPatchForbidden('The step owner can only update the deliverable link');
  }
  // An empty body changes nothing, and the deliverable flow can send one when no link was given.
  if (fields.length > 0 && ['Approved', 'Published'].includes(stored.status)) {
    throw workItemPatchForbidden('The deliverable link cannot change after the step is approved');
  }
}

export async function updateWorkItem(id, data, user) {
  const workItem = await WorkItem.findById(id);
  if (!workItem) {
    const error = new Error('Work item not found');
    error.statusCode = 404;
    throw error;
  }

  // Nothing to change: succeed without saving or logging an update.
  if (Object.keys(data).length === 0) {
    return workItem.populate([
      { path: 'departmentId', select: 'name code' },
      { path: 'ownerId', select: 'name email role jobRole' },
    ]);
  }

  if (data.title) workItem.title = data.title.trim();
  if (data.workType) workItem.workType = normalizeWorkType(data.workType) || data.workType;
  if (data.departmentId) workItem.departmentId = data.departmentId;
  if (data.ownerId !== undefined) {
    if (data.ownerId?.toString() !== workItem.ownerId?.toString()) {
      workItem.ownerId = data.ownerId;
      workItem.assignedAt = data.ownerId ? new Date() : null;
    }
  }
  if (data.deadline) {
    workItem.deadline = data.deadline;
    workItem.dueDate = data.deadline;
    workItem.dueDateSource = 'manual';
  }
  if (data.estimatedEffortHrs !== undefined) workItem.estimatedEffortHrs = data.estimatedEffortHrs;
  if (data.priority) workItem.priority = data.priority;
  if (data.description !== undefined) {
    workItem.description = data.description;
    if (workItem.brief) workItem.brief.description = data.description;
  }
  if (data.deliverableUrl !== undefined) workItem.deliverableUrl = data.deliverableUrl;
  if (data.publishedUrl !== undefined) workItem.publishedUrl = data.publishedUrl;

  // Content Flow stage fields (Phase 3 delta)
  if (data.contentPieceId !== undefined) workItem.contentPieceId = data.contentPieceId;
  if (data.stageKey !== undefined) workItem.stageKey = data.stageKey;
  if (data.stageOrder !== undefined) workItem.stageOrder = data.stageOrder;
  if (data.reviewRequired !== undefined) workItem.reviewRequired = data.reviewRequired;
  if (data.unlockedAt !== undefined) workItem.unlockedAt = data.unlockedAt;
  if (data.isSkipped !== undefined) workItem.isSkipped = data.isSkipped;

  // Deliverable link and brief updates
  if (data.contentLink !== undefined) {
    workItem.contentLink = data.contentLink;
    if (workItem.brief) workItem.brief.contentLink = data.contentLink;
  }
  if (data.assetsLink !== undefined) {
    workItem.assetsLink = data.assetsLink;
    if (workItem.brief) workItem.brief.assetsLink = data.assetsLink;
  }
  if (data.brief !== undefined) {
    if (typeof data.brief === 'string') {
      workItem.description = data.brief;
      if (workItem.brief) workItem.brief.description = data.brief;
    } else if (data.brief && typeof data.brief === 'object') {
      if (!workItem.brief) {
        workItem.brief = { description: '', contentLink: '', assetsLink: '' };
      }
      if (data.brief.description !== undefined) {
        workItem.description = data.brief.description;
        workItem.brief.description = data.brief.description;
      }
      if (data.brief.contentLink !== undefined) {
        workItem.contentLink = data.brief.contentLink;
        workItem.brief.contentLink = data.brief.contentLink;
      }
      if (data.brief.assetsLink !== undefined) {
        workItem.assetsLink = data.brief.assetsLink;
        workItem.brief.assetsLink = data.brief.assetsLink;
      }
    }
  }

  await workItem.save();

  if (workItem.contentPieceId && (data.isSkipped !== undefined || data.isLocked !== undefined)) {
    const { reconcileContentPieceStageLocks } = await import('./transition.service.js');
    await reconcileContentPieceStageLocks(workItem.contentPieceId);
  }

  await logActivity({
    entityType: 'work_item',
    entityId: workItem._id,
    actor: user,
    action: 'work_item.updated',
    metadata: {
      title: workItem.title,
      ownerId: workItem.ownerId,
      deadline: workItem.deadline,
    },
  });

  return WorkItem.findById(workItem._id)
    .populate('departmentId', 'name code')
    .populate('ownerId', 'name email role jobRole');
}

export async function deleteWorkItem(id, user) {
  const workItem = await WorkItem.findById(id);
  if (!workItem) {
    const error = new Error('Work item not found');
    error.statusCode = 404;
    throw error;
  }

  const { actions } = getAvailableActions(user, workItem);
  if (!actions.includes('delete')) {
    const isStarted = workItem.status !== 'Not Started';
    const error = new Error(
      isStarted
        ? 'Cannot delete a task that has already started'
        : 'Deleting a task is only permitted for SM Manager and Admin'
    );
    error.statusCode = 403;
    error.code = isStarted ? 'CANNOT_DELETE_STARTED_WORK' : 'FORBIDDEN_DELETE';
    throw error;
  }

  await WorkItem.findByIdAndDelete(id);

  await logActivity({
    entityType: 'work_item',
    entityId: id,
    actor: user,
    action: 'work_item.deleted',
    metadata: { title: workItem.title, stageKey: workItem.stageKey },
  });

  return { success: true, message: 'Work item deleted successfully' };
}

export async function getMyWork(user) {
  const userId = (user._id || user.id || user.userId)?.toString();
  if (!userId) {
    return { overdue: [], today: [], thisWeek: [], upcoming: [], completed: [], stats: {} };
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const endOfThisWeek = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);

  const rawItems = await WorkItem.find({ ownerId: userId, isSkipped: { $ne: true } })
    .populate('departmentId', 'name code')
    .populate('contentPieceId', 'topic contentType postingDate liveUrl brief referenceLink programOrEvent priority')
    .sort({ deadline: 1 });

  const overdue = [];
  const today = [];
  const thisWeek = [];
  const upcoming = [];
  const completed = [];

  const latestVersions = await Submission.aggregate([
    { $match: { workItemId: { $in: rawItems.map((i) => i._id) }, version: { $gt: 0 } } },
    { $sort: { version: -1 } },
    { $group: { _id: '$workItemId', status: { $first: '$status' } } },
  ]);
  const latestStatusOf = new Map(latestVersions.map((row) => [String(row._id), row.status]));

  for (const rawItem of rawItems) {
    const item = rawItem.toObject();
    item.latestSubmissionStatus = latestStatusOf.get(String(item._id)) || null;
    if (item.contentPieceId && item.isLocked) {
      const pieceId = item.contentPieceId._id || item.contentPieceId;
      if (item.stageOrder <= 1) {
        item.isLocked = false;
        WorkItem.updateOne({ _id: item._id }, { $set: { isLocked: false } }).exec();
      } else {
        const precedingUnfinished = await WorkItem.countDocuments({
          contentPieceId: pieceId,
          stageOrder: { $lt: item.stageOrder },
          isSkipped: false,
          status: { $nin: ['Approved', 'Published'] },
        });
        if (precedingUnfinished === 0) {
          item.isLocked = false;
          item.unlockedAt = item.unlockedAt || new Date();
          WorkItem.updateOne({ _id: item._id }, { $set: { isLocked: false, unlockedAt: item.unlockedAt } }).exec();
        }
      }
    }
    if (item.contentPieceId && item.stageOrder > 1) {
      const prevStage = await WorkItem.findOne({
        contentPieceId: item.contentPieceId._id || item.contentPieceId,
        stageOrder: item.stageOrder - 1,
      })
        .select('stageKey deliverableUrl publishedUrl status title ownerId')
        .populate('ownerId', 'name email role jobRole');

      item.previousStage = prevStage ? {
        stageKey: prevStage.stageKey,
        deliverableUrl: prevStage.deliverableUrl,
        publishedUrl: prevStage.publishedUrl,
        status: prevStage.status,
        owner: prevStage.ownerId,
      } : null;
      if (prevStage?.ownerId) {
        item.suggestedDependencyOwner = prevStage.ownerId;
      }
    }

    // Attach latest reviewer feedback if item is in Feedback status
    if (item.status === 'Feedback') {
      try {
        const { FeedbackEntry } = await import('../feedback/model.js');
        const latestEntry = await FeedbackEntry.findOne({ workItemId: item._id, isResponse: false })
          .populate('fromPersonId', 'name role jobRole')
          .sort({ createdAt: -1 });
        if (latestEntry) {
          item.latestFeedback = {
            text: latestEntry.text,
            reviewer: latestEntry.fromPersonId?.name || 'Creative Head',
            createdAt: latestEntry.createdAt,
          };
        }
      } catch {
        // gracefully handle missing feedback entry
      }
    }

    const isCompleted = item.status === 'Approved' || item.status === 'Published' || item.status === 'Done';
    if (isCompleted) {
      completed.push(item);
      continue;
    }

    // Locked stages belong under Upcoming (rendered greyed out in UI)
    if (item.isLocked) {
      upcoming.push(item);
      continue;
    }

    const deadline = new Date(item.deadline || item.dueDate);
    if (isNaN(deadline.getTime())) {
      upcoming.push(item);
    } else if (deadline < startOfToday) {
      overdue.push(item);
    } else if (deadline <= endOfToday) {
      today.push(item);
    } else if (deadline <= endOfThisWeek) {
      thisWeek.push(item);
    } else {
      upcoming.push(item);
    }
  }

  const activeCount = overdue.length + today.length + thisWeek.length + upcoming.length;
  const activeItems = [...overdue, ...today, ...thisWeek, ...upcoming];
  const stageAssignmentsCount = activeItems.filter((i) => !!i.stageKey).length;
  const submissionsCount = activeItems.filter((i) => i.status === 'Pending' || i.status === 'Feedback').length;
  const deliverablesCount = activeItems.filter((i) => !!i.deliverableUrl || i.status === 'In Progress').length;

  const totalRevisions = rawItems.reduce((acc, it) => acc + (it.revisions || 0), 0);
  const avgRevisions = rawItems.length > 0 ? Number((totalRevisions / rawItems.length).toFixed(1)) : 0;

  return {
    overdue,
    today,
    thisWeek,
    upcoming,
    completed: completed.slice(0, 15),
    stats: {
      activeCount,
      overdueCount: overdue.length,
      todayCount: today.length,
      completedCount: completed.length,
      stageAssignmentsCount,
      submissionsCount,
      deliverablesCount,
      avgRevisions,
    },
  };
}

import { ContentPiece } from '../calendar/contentPiece.model.js';
import { CalendarPlan } from '../calendar/plan.model.js';
import { isPostableWorkType } from '@mmp/shared';

/** Same rule as the WorkItem isOverdue virtual, which .lean() results do not carry. */
function isPastDeadline(deadline, status) {
  if (!deadline || status === 'Approved' || status === 'Published') return false;
  return new Date(deadline) < new Date();
}

/** Plan ids of the given plans that are individual (one-off) work, not a monthly or project plan. */
async function individualPlanIds(planIds) {
  if (planIds.length === 0) return new Set();
  const plans = await CalendarPlan.find({ _id: { $in: planIds }, kind: 'individual' }).select('_id').lean();
  return new Set(plans.map((plan) => String(plan._id)));
}

export async function getCalendarWorkItems(filters = {}, user) {
  const query = {};

  if (user && user.role === 'team_member') {
    const userId = (user._id || user.id || user.userId)?.toString();
    query.ownerId = userId;
  } else if (filters.ownerId && filters.ownerId !== 'all') {
    query.ownerId = filters.ownerId;
  }

  if (filters.calendar && filters.calendar !== 'all') {
    query.calendar = filters.calendar;
  }

  if (filters.departmentId && filters.departmentId !== 'all') {
    query.departmentId = filters.departmentId;
  }

  if (filters.status && filters.status !== 'all') {
    query.status = filters.status;
  }

  const startParam = filters.start || filters.startDate;
  const endParam = filters.end || filters.endDate;

  if (startParam && endParam) {
    query.deadline = {
      $gte: new Date(startParam),
      $lte: new Date(endParam),
    };
  }

  const workItems = await WorkItem.find(query)
    .populate('departmentId', 'name code')
    .populate('ownerId', 'name email role jobRole avatarUrl')
    .sort({ deadline: 1 })
    .lean();

  // Individual work: from an individual plan, or not part of any plan.
  const stepPieces = await ContentPiece.find({ _id: { $in: workItems.map((w) => w.contentPieceId).filter(Boolean) } })
    .select('planId')
    .lean();
  const individualSteps = await individualPlanIds(stepPieces.map((piece) => piece.planId));
  const planOfPiece = new Map(stepPieces.map((piece) => [String(piece._id), String(piece.planId)]));
  for (const item of workItems) {
    item.isOverdue = isPastDeadline(item.deadline, item.status);
    item.isIndividual = !item.contentPieceId || individualSteps.has(planOfPiece.get(String(item.contentPieceId)));
  }

  // If not scoped to worker personal view, also include publish date events from ContentPiece
  if (user?.role !== 'team_member' && startParam && endParam) {
    const pieceQuery = {
      postingDate: {
        $gte: new Date(startParam),
        $lte: new Date(endParam),
      },
    };
    if (filters.calendar && filters.calendar !== 'all') {
      pieceQuery.calendar = filters.calendar;
    }

    const pieces = await ContentPiece.find(pieceQuery)
      .populate('postingOwnerId', 'name email role')
      .lean();

    const individualPieces = await individualPlanIds(pieces.map((p) => p.planId));
    // A publish date shows the state of the piece's final step, so its colour matches that step.
    const finalSteps = await WorkItem.find({ contentPieceId: { $in: pieces.map((p) => p._id) } })
      .select('contentPieceId stageOrder status isLocked')
      .sort({ stageOrder: 1 })
      .lean();
    const finalStepOfPiece = new Map(finalSteps.map((step) => [String(step.contentPieceId), step]));

    const publishItems = pieces.map((p) => {
      const isPostable = isPostableWorkType(p.contentType);
      const prefix = isPostable ? 'Publish' : 'Needed by';
      const ownerName = p.postingOwnerId?.name ? ` (${p.postingOwnerId.name})` : '';
      const finalStep = finalStepOfPiece.get(String(p._id));
      const status = finalStep ? finalStep.status : p.rowStatus === 'approved' ? 'Approved' : 'Planned';
      return {
        _id: `pub_${p._id.toString()}`,
        title: `${prefix}: ${p.topic}${ownerName}`,
        displayTitle: `${prefix}: ${p.topic}${ownerName}`,
        topic: p.topic,
        workType: p.contentType,
        status,
        isLocked: Boolean(finalStep?.isLocked),
        isOverdue: finalStep ? isPastDeadline(p.postingDate, status) : false,
        isIndividual: individualPieces.has(String(p.planId)),
        workItemId: finalStep?._id || null,
        deadline: p.postingDate,
        calendar: p.calendar || 'sm',
        isPublishDate: true,
        isPublishEvent: true,
        ownerId: p.postingOwnerId || null,
      };
    });

    return [...workItems, ...publishItems].sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  }

  return workItems;
}

export async function getTodoItems(user) {
  const scope = await resolveScope(user);
  const query = {};

  if (user.role === 'team_member') {
    const userId = (user._id || user.id || user.userId)?.toString();
    query.ownerId = userId;
  } else if (scope.allowedPersonIds) {
    query.ownerId = { $in: scope.allowedPersonIds };
  }

  query.status = { $nin: ['Approved', 'Published'] };

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const items = await WorkItem.find(query)
    .populate('departmentId', 'name code')
    .populate('ownerId', 'name email role jobRole')
    .sort({ deadline: 1 });

  const overdue = [];
  const today = [];
  const upcoming = [];

  for (const item of items) {
    const deadline = new Date(item.deadline);
    if (deadline < startOfToday) {
      overdue.push(item);
    } else if (deadline <= endOfToday) {
      today.push(item);
    } else {
      upcoming.push(item);
    }
  }

  return {
    overdue,
    today,
    upcoming,
    total: items.length,
  };
}

export async function getWorkItemActivities(id, user) {
  const item = await getWorkItemById(id, user);
  const { sanitizeActivities } = await import('./viewerRules.js');
  const activities = await listRecentActivities({ entityType: 'work_item', entityId: item._id, limit: 50 });
  return sanitizeActivities(activities, user, item);
}
