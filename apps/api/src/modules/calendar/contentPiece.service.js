import mongoose from 'mongoose';
import { ContentPiece } from './contentPiece.model.js';
import { WorkItem } from '../workItems/model.js';
import { Person } from '../people/model.js';
import { AssignmentOverride } from '../assignment/model.js';
import { logActivity } from '../activity/service.js';
import { createNotification } from '../notifications/service.js';
import { resolveScope } from '../../lib/scope.js';
import { recommendAssignee } from '../assignment/service.js';
import { normalizeRole } from '@mmp/shared';

/**
 * List Content Pieces (Content Tracker) with stages and metrics
 */
export async function listContentPieces(filters = {}, user) {
  const scope = await resolveScope(user);
  const userRole = normalizeRole(user.role);

  if (userRole === 'team_member') {
    const error = new Error('Team members cannot access the Content Tracker.');
    error.statusCode = 403;
    error.code = 'FORBIDDEN_SCOPE';
    throw error;
  }

  const query = {};
  if (scope.brandProfileId) {
    query.profileId = scope.brandProfileId;
  }
  if (filters.planId) {
    query.planId = filters.planId;
  }
  if (filters.type) {
    query.contentType = filters.type;
  }
  if (filters.month) {
    // format YYYY-MM
    const [year, month] = filters.month.split('-').map(Number);
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
    query.postingDate = { $gte: startOfMonth, $lte: endOfMonth };
  }

  const pieces = await ContentPiece.find(query)
    .populate('planId', 'code title kind')
    .sort({ postingDate: 1 })
    .lean();

  const pieceIds = pieces.map((p) => p._id);
  const allStages = await WorkItem.find({ contentPieceId: { $in: pieceIds } })
    .populate('ownerId', 'name email role jobRole workPreferences')
    .sort({ stageOrder: 1 })
    .lean();

  const stagesByPiece = {};
  for (const st of allStages) {
    const pId = st.contentPieceId.toString();
    if (!stagesByPiece[pId]) stagesByPiece[pId] = [];
    stagesByPiece[pId].push(st);
  }

  const now = new Date();

  const results = pieces.map((piece) => {
    const stages = stagesByPiece[piece._id.toString()] || [];

    // Derive piece status
    let pieceStatus = 'Planned';
    if (piece.publishedAt || stages.some((s) => s.status === 'Published')) {
      pieceStatus = 'Published';
    } else if (stages.some((s) => s.status === 'Blocked')) {
      pieceStatus = 'Blocked';
    } else if (stages.some((s) => s.status === 'Feedback')) {
      pieceStatus = 'In Review';
    } else if (stages.some((s) => s.status === 'In Progress')) {
      pieceStatus = 'In Progress';
    } else if (stages.length > 0 && stages.every((s) => s.status === 'Approved')) {
      pieceStatus = 'Approved';
    }

    const hasNeedsOwner = stages.some((s) => !s.ownerId || s.status === 'Not Started' && !s.assigneeConfirmed);
    const hasWaitingApproval = stages.some((s) => s.status === 'Feedback');
    const hasBlocked = stages.some((s) => s.status === 'Blocked');
    const hasOverdue = stages.some((s) => s.dueDate && new Date(s.dueDate) < now && s.status !== 'Approved' && s.status !== 'Published');

    return {
      ...piece,
      pieceStatus,
      stages,
      hasNeedsOwner,
      hasWaitingApproval,
      hasBlocked,
      hasOverdue,
    };
  });

  // Apply stage-level filters if requested
  return results.filter((p) => {
    if (filters.needsOwner && !p.hasNeedsOwner) return false;
    if (filters.waitingApproval && !p.hasWaitingApproval) return false;
    if (filters.blocked && !p.hasBlocked) return false;
    if (filters.overdue && !p.hasOverdue) return false;
    if (filters.ownerId) {
      const hasOwner = p.stages.some(
        (s) => s.ownerId?._id?.toString() === filters.ownerId.toString()
      );
      if (!hasOwner) return false;
    }
    if (filters.stageStatus) {
      const hasStatus = p.stages.some((s) => s.status === filters.stageStatus);
      if (!hasStatus) return false;
    }
    return true;
  });
}

/**
 * Recommend owners for stages of a content piece
 * Excludes overloaded members (workload >= 85%)
 */
export async function recommendOwnersForPiece(pieceId, user) {
  const piece = await ContentPiece.findById(pieceId);
  if (!piece) {
    const error = new Error('Content piece not found');
    error.statusCode = 404;
    throw error;
  }

  const stages = await WorkItem.find({ contentPieceId: piece._id })
    .populate('ownerId', 'name email role jobRole')
    .sort({ stageOrder: 1 });

  const recommendations = [];

  for (const st of stages) {
    const rec = await recommendAssignee(
      {
        workType: piece.contentType,
        stageKey: st.stageKey,
        deadline: st.dueDate || st.deadline,
        workItemId: st._id,
      },
      user
    );

    // Overload guard: if recommended candidate workload >= 85%, strictly exclude
    let recommendedPerson = rec?.recommendedPerson || null;
    const workloadPct = rec?.recommendedMetrics?.workloadPct ?? 0;
    let rationale = rec?.rationale || 'Needs owner';

    if (recommendedPerson && (workloadPct >= 85 || rec?.isOverloadWarning)) {
      recommendedPerson = null;
      rationale = 'All candidates with matching work preference are currently overloaded (>=85%). Needs owner.';
    }

    recommendations.push({
      workItemId: st._id,
      stageKey: st.stageKey,
      stageOrder: st.stageOrder,
      currentOwner: st.ownerId,
      recommendedPerson,
      rationale,
      candidatePool: (rec?.candidatePool || []).filter((c) => c.workloadPct < 85),
    });
  }

  return recommendations;
}

/**
 * Assign stage owners across departments
 * Permission: assignment.override
 * Logs overrides and emits notifications
 */
export async function assignStages(assignmentList, user) {
  const userRole = normalizeRole(user.role);
  if (userRole !== 'admin' && userRole !== 'sm_manager' && userRole !== 'creative_head') {
    const error = new Error('You do not have permission to assign stage owners.');
    error.statusCode = 403;
    error.code = 'FORBIDDEN_ASSIGNMENT';
    throw error;
  }

  const results = [];

  for (const assign of assignmentList) {
    const workItemId = assign.workItemId;
    const assigneeId = assign.assigneeId || assign.personId;
    const overrideReason = assign.overrideReason;
    const workItem = await WorkItem.findById(workItemId);
    if (!workItem) continue;

    const previousOwnerId = workItem.ownerId;
    const assignee = await Person.findById(assigneeId);
    if (!assignee) continue;

    workItem.ownerId = assignee._id;
    await workItem.save();

    // Log override if reason provided
    if (overrideReason) {
      await AssignmentOverride.create({
        workItemId: workItem._id,
        recommendedPersonId: previousOwnerId || user._id,
        chosenPersonId: assignee._id,
        reason: overrideReason,
        overriddenById: user._id || user.userId,
      });
    }

    await logActivity({
      entityType: 'work_item',
      entityId: workItem._id,
      profileId: workItem.profileId,
      actor: user,
      action: 'work_item.assigned',
      metadata: {
        stageKey: workItem.stageKey,
        assigneeId: assignee._id,
        assigneeName: assignee.name,
        overrideReason: overrideReason || null,
      },
    });

    // Notify assignee if stage is unlocked
    if (!workItem.isLocked) {
      await createNotification({
        recipient: assignee._id,
        type: 'stage_assigned',
        title: 'New Stage Assigned',
        message: `You were assigned ${workItem.title}. Due date: ${workItem.dueDate?.toISOString().slice(0, 10)}.`,
        link: `/my-work?id=${workItem._id}`,
        metadata: { workItemId: workItem._id },
      });
    }

    results.push(workItem);
  }

  return results;
}

/**
 * Reschedule content piece posting date
 * Option to shift unstarted stage due dates
 */
export async function rescheduleContentPiece(id, { postingDate, shiftUnstartedStages = true }, user) {
  const piece = await ContentPiece.findById(id);
  if (!piece) {
    const error = new Error('Content piece not found');
    error.statusCode = 404;
    throw error;
  }

  const oldDate = new Date(piece.postingDate);
  const newDate = new Date(postingDate);
  const diffTime = newDate.getTime() - oldDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 3600 * 24));

  piece.postingDate = newDate;
  await piece.save();

  let shiftedStagesCount = 0;
  if (shiftUnstartedStages && diffDays !== 0) {
    const unstartedStages = await WorkItem.find({
      contentPieceId: piece._id,
      status: 'Not Started',
    });

    for (const st of unstartedStages) {
      if (st.dueDate) {
        const curDueDate = new Date(st.dueDate);
        curDueDate.setDate(curDueDate.getDate() + diffDays);
        st.dueDate = curDueDate;
        st.deadline = curDueDate;
        await st.save();
        shiftedStagesCount++;
      }
    }
  }

  await logActivity({
    entityType: 'content_piece',
    entityId: piece._id,
    profileId: piece.profileId,
    actor: user,
    action: 'content_piece.rescheduled',
    metadata: {
      oldPostingDate: oldDate,
      newPostingDate: newDate,
      diffDays,
      shiftedStagesCount,
    },
  });

  return piece;
}

/**
 * Skip or restore a stage before it starts
 */
export async function skipOrRestoreStage(pieceId, stageKey, isSkipped, user) {
  const stage = await WorkItem.findOne({ contentPieceId: pieceId, stageKey });
  if (!stage) {
    const error = new Error(`Stage "${stageKey}" not found for this content piece`);
    error.statusCode = 404;
    throw error;
  }

  if (stage.status !== 'Not Started') {
    const error = new Error('Only unstarted stages can be skipped or restored.');
    error.statusCode = 400;
    throw error;
  }

  stage.isSkipped = Boolean(isSkipped);
  await stage.save();

  // If stage was active and unlocked, unlock the next stage
  if (stage.isSkipped && !stage.isLocked) {
    const nextStage = await WorkItem.findOne({
      contentPieceId: pieceId,
      stageOrder: { $gt: stage.stageOrder },
      isSkipped: false,
    }).sort({ stageOrder: 1 });

    if (nextStage) {
      nextStage.isLocked = false;
      nextStage.unlockedAt = new Date();
      await nextStage.save();

      if (nextStage.ownerId) {
        await createNotification({
          recipient: nextStage.ownerId,
          type: 'stage_unlocked',
          title: 'Stage Unlocked',
          message: `Stage ${nextStage.stageKey} for "${stage.title}" is now unlocked.`,
          link: `/my-work?id=${nextStage._id}`,
        });
      }
    }
  }

  await logActivity({
    entityType: 'work_item',
    entityId: stage._id,
    profileId: stage.profileId,
    actor: user,
    action: stage.isSkipped ? 'stage.skipped' : 'stage.restored',
    metadata: {
      stageKey,
      pieceId,
    },
  });

  return stage;
}
