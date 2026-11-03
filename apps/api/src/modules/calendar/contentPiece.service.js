import mongoose from 'mongoose';
import { ContentPiece } from './contentPiece.model.js';
import { WorkItem } from '../workItems/model.js';
import { Person } from '../people/model.js';
import { AssignmentOverride } from '../assignment/model.js';
import { logActivity } from '../activity/service.js';
import { createNotification } from '../notifications/service.js';
import { resolveScope } from '../../lib/scope.js';
import { recommendAssignee } from '../assignment/service.js';
import { normalizeRole, calculateIndividualWorkMeasures, formatDuration } from '@mmp/shared';

/**
 * List Content Pieces (Content Tracker) with stages and metrics
 */
export async function listContentPieces(filters = {}, user) {
  const scope = await resolveScope(user);
  const userRole = normalizeRole(user.role);
  const userId = (user?._id || user?.id || user?.userId)?.toString();

  const query = {};
  if (userRole === 'team_member') {
    // Workers see only content pieces where they own at least one stage
    const myStages = await WorkItem.find({ ownerId: userId, contentPieceId: { $ne: null } }).select('contentPieceId');
    const myPieceIds = myStages.map((s) => s.contentPieceId);
    query._id = { $in: myPieceIds };
  }

  if (filters.calendar && filters.calendar !== 'all') {
    query.calendar = filters.calendar;
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
    let stages = stagesByPiece[piece._id.toString()] || [];
    if (userRole === 'team_member') {
      stages = stages.filter((s) => (s.ownerId?._id || s.ownerId)?.toString() === userId);
    }

    // Reconcile and derive stage locks
    let precedingComplete = true;
    for (let i = 0; i < stages.length; i++) {
      const s = stages[i];
      if (i === 0) {
        if (s.isLocked) {
          s.isLocked = false;
          WorkItem.updateOne({ _id: s._id }, { $set: { isLocked: false } }).exec();
        }
      } else {
        if (precedingComplete && s.isLocked) {
          s.isLocked = false;
          s.unlockedAt = s.unlockedAt || now;
          WorkItem.updateOne({ _id: s._id }, { $set: { isLocked: false, unlockedAt: s.unlockedAt } }).exec();
        }
      }
      if (!s.isSkipped && s.status !== 'Approved' && s.status !== 'Published') {
        precedingComplete = false;
      }
    }

    // Derive active stage (first uncompleted stage)
    const allStagesDone = stages.length > 0 && stages.every((s) => s.status === 'Approved' || s.status === 'Published');
    const activeStage = allStagesDone ? null : (stages.find((s) => s.status !== 'Approved' && s.status !== 'Published') || stages[stages.length - 1]);

    let holder = 'Done';
    let maxLateByDays = 0;

    const enrichedStages = stages.map((s) => {
      const due = s.dueDate ? new Date(s.dueDate) : null;
      let lateBy = 0;
      if (due && due < now && s.status !== 'Approved' && s.status !== 'Published') {
        lateBy = Math.max(0, Math.floor((now.getTime() - due.getTime()) / (1000 * 3600 * 24)));
      }
      if (lateBy > maxLateByDays) maxLateByDays = lateBy;

      let ownerLag = 0;
      if (due && s.submittedAt) {
        const sub = new Date(s.submittedAt);
        if (sub > due) {
          ownerLag = Math.max(0, Math.floor((sub.getTime() - due.getTime()) / (1000 * 3600 * 24)));
        }
      }

      let approvalWait = 0;
      if (s.submittedAt) {
        const sub = new Date(s.submittedAt);
        const approved = s.approvedAt ? new Date(s.approvedAt) : (s.status === 'Feedback' ? now : null);
        if (approved && approved > sub) {
          approvalWait = Math.max(0, Math.floor((approved.getTime() - sub.getTime()) / (1000 * 3600 * 24)));
        }
      }

      let stageHolder = 'Done';
      if (s.status === 'Blocked') {
        stageHolder = `Blocked since ${s.updatedAt ? new Date(s.updatedAt).toISOString().slice(0, 10) : 'recent'}`;
      } else if (s.status === 'Feedback') {
        stageHolder = 'Creative Head';
      } else if (!s.ownerId) {
        stageHolder = 'SM Manager';
      } else if (s.isLocked) {
        stageHolder = 'Locked';
      } else {
        stageHolder = s.ownerId?.name || 'Worker';
      }

      const measures = calculateIndividualWorkMeasures(s, now);

      return {
        ...s,
        lateByDays: lateBy,
        ownerLagDays: ownerLag,
        approvalWaitDays: approvalWait,
        holder: stageHolder,
        measures,
      };
    });

    if (activeStage) {
      if (activeStage.status === 'Blocked') {
        holder = `Blocked since ${activeStage.updatedAt ? new Date(activeStage.updatedAt).toISOString().slice(0, 10) : 'recent'}`;
      } else if (activeStage.status === 'Feedback') {
        holder = 'Creative Head';
      } else if (!activeStage.ownerId) {
        holder = 'SM Manager';
      } else if (activeStage.isLocked) {
        holder = 'Locked';
      } else {
        holder = activeStage.ownerId?.name || 'Worker';
      }
    }

    // Piece status: 'Late', 'At Risk', 'On Track'
    let pieceStatus = 'On Track';
    const hasLateStage = enrichedStages.some((s) => s.lateByDays > 0);
    const hasAtRiskStage = enrichedStages.some((s) => {
      if (s.status === 'Approved' || s.status === 'Published' || s.isLocked) return false;
      if (!s.dueDate) return false;
      const due = new Date(s.dueDate);
      const daysUntilDue = (due.getTime() - now.getTime()) / (1000 * 3600 * 24);
      return daysUntilDue >= 0 && daysUntilDue <= 2 && ['Not Started', 'Pending', 'Blocked'].includes(s.status);
    });

    if (hasLateStage) {
      pieceStatus = 'Late';
    } else if (hasAtRiskStage) {
      pieceStatus = 'At Risk';
    } else if (piece.publishedAt || (stages.length > 0 && stages.every((s) => s.status === 'Published' || s.status === 'Approved'))) {
      pieceStatus = 'Done';
    }

    const hasNeedsOwner = enrichedStages.some((s) => !s.ownerId || (s.status === 'Not Started' && !s.assigneeConfirmed));
    const hasWaitingApproval = enrichedStages.some((s) => s.status === 'Feedback');
    const hasBlocked = enrichedStages.some((s) => s.status === 'Blocked');
    const hasOverdue = maxLateByDays > 0;

    let pieceWorkTimeMs = 0;
    let pieceApprovalWaitMs = 0;
    let pieceWaitToStartMs = 0;
    let maxStageLateDays = 0;

    for (const s of enrichedStages) {
      if (s.measures?.workTimeMs) pieceWorkTimeMs += s.measures.workTimeMs;
      if (s.measures?.approvalWaitMs) pieceApprovalWaitMs += s.measures.approvalWaitMs;
      if (s.measures?.waitingToStartMs) pieceWaitToStartMs += s.measures.waitingToStartMs;
      if (s.measures?.lateByDays && s.measures.lateByDays > maxStageLateDays) {
        maxStageLateDays = s.measures.lateByDays;
      }
    }

    return {
      ...piece,
      pieceStatus,
      holder,
      lateByDays: maxLateByDays,
      waitingFormatted: pieceWaitToStartMs > 0 ? formatDuration(pieceWaitToStartMs) : '—',
      workTimeFormatted: pieceWorkTimeMs > 0 ? formatDuration(pieceWorkTimeMs) : '—',
      approvalWaitFormatted: pieceApprovalWaitMs > 0 ? formatDuration(pieceApprovalWaitMs) : '—',
      lateByFormatted: maxStageLateDays > 0 ? `${maxStageLateDays}d` : '—',
      stages: enrichedStages,
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
    actor: user,
    action: stage.isSkipped ? 'stage.skipped' : 'stage.restored',
    metadata: {
      stageKey,
      pieceId,
    },
  });

  return stage;
}

/**
 * Reassign an existing stage WorkItem
 */
export async function reassignStage(pieceId, { stageKey, newOwnerId, overrideReason }, user) {
  const piece = await ContentPiece.findById(pieceId);
  if (!piece) {
    const error = new Error('Content piece not found');
    error.statusCode = 404;
    throw error;
  }
  const stage = await WorkItem.findOne({ contentPieceId: piece._id, stageKey });
  if (!stage) {
    const error = new Error(`Stage "${stageKey}" not found for this piece`);
    error.statusCode = 404;
    throw error;
  }
  const oldOwnerId = stage.ownerId;
  const newOwner = await Person.findById(newOwnerId);
  if (!newOwner) {
    const error = new Error('New owner not found');
    error.statusCode = 404;
    throw error;
  }
  stage.ownerId = newOwner._id;
  stage.ownerSource = 'manual';
  stage.assignedAt = new Date();
  await stage.save();

  await logActivity({
    entityType: 'work_item',
    entityId: stage._id,
    actor: user,
    action: 'work_item.reassigned',
    metadata: {
      oldOwnerId,
      newOwnerId: newOwner._id,
      overrideReason: overrideReason || null,
      stageKey,
    },
  });

  await createNotification({
    recipient: newOwner._id,
    type: 'stage_assigned',
    title: 'Stage Assigned',
    message: `You were reassigned stage ${stageKey} for "${piece.topic}".`,
    link: `/my-work?id=${stage._id}`,
  });

  return stage;
}

/**
 * Update an existing stage deadline
 */
export async function changeStageDeadline(pieceId, { stageKey, newDeadline }, user) {
  const piece = await ContentPiece.findById(pieceId);
  if (!piece) {
    const error = new Error('Content piece not found');
    error.statusCode = 404;
    throw error;
  }
  const stage = await WorkItem.findOne({ contentPieceId: piece._id, stageKey });
  if (!stage) {
    const error = new Error(`Stage "${stageKey}" not found for this piece`);
    error.statusCode = 404;
    throw error;
  }
  const oldDeadline = stage.dueDate;
  const d = new Date(newDeadline);
  stage.dueDate = d;
  stage.deadline = d;
  stage.dueDateSource = 'manual';
  await stage.save();

  await logActivity({
    entityType: 'work_item',
    entityId: stage._id,
    actor: user,
    action: 'work_item.deadline_changed',
    metadata: {
      oldDeadline,
      newDeadline: d,
      stageKey,
    },
  });

  if (stage.ownerId) {
    await createNotification({
      recipient: stage.ownerId,
      type: 'stage_deadline_changed',
      title: 'Stage Deadline Changed',
      message: `Deadline for stage ${stageKey} ("${piece.topic}") changed to ${d.toISOString().slice(0, 10)}.`,
      link: `/my-work?id=${stage._id}`,
    });
  }

  return stage;
}
