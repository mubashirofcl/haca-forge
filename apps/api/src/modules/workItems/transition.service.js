import { WorkItem } from './model.js';
import { logActivity } from '../activity/service.js';
import { BLOCKER_REASONS, normalizeRole } from '@mmp/shared';
import { resolveScope } from '../../lib/scope.js';
import { Person } from '../people/model.js';

export const ALLOWED_TRANSITIONS = {
  'Not Started': ['In Progress', 'Blocked'],
  'In Progress': ['Feedback', 'Pending', 'Blocked', 'Approved', 'Published'],
  'Feedback': ['In Progress', 'Pending', 'Approved', 'Blocked'],
  'Pending': ['Approved', 'Feedback', 'In Progress', 'Blocked', 'Published'],
  'Blocked': ['In Progress', 'Not Started'],
  'Approved': ['Published', 'Feedback', 'In Progress'],
  'Published': ['Feedback', 'In Progress'],
};

export async function transitionWorkItem(id, transitionData, user) {
  const { toStatus, blockerReason, blockerNote, deliverableUrl, publishedUrl, comment } =
    transitionData;

  const workItem = await WorkItem.findById(id);
  if (!workItem) {
    const error = new Error('Work item not found');
    error.statusCode = 404;
    throw error;
  }

  const fromStatus = workItem.status;

  // 1. Check if same status
  if (fromStatus === toStatus) {
    return workItem;
  }

  // 2. Validate allowed state transition
  const validTargets = ALLOWED_TRANSITIONS[fromStatus] || [];
  if (!validTargets.includes(toStatus)) {
    const error = new Error(
      `Invalid transition from "${fromStatus}" to "${toStatus}". Allowed transitions: ${validTargets.join(', ')}`
    );
    error.statusCode = 400;
    error.code = 'INVALID_TRANSITION';
    throw error;
  }

  // 3. Ownership / Role Authorization
  const userId = (user._id || user.id || user.userId)?.toString();
  const ownerIdStr = (workItem.ownerId?._id || workItem.ownerId)?.toString();
  const userRole = normalizeRole(user.role);
  const isAdminOrHead = userRole === 'admin' || userRole === 'creative_head';

  if (userRole === 'team_member' && ownerIdStr !== userId) {
    const error = new Error('You can only update status for work items assigned to you');
    error.statusCode = 403;
    error.code = 'FORBIDDEN_OWNERSHIP';
    throw error;
  }

  // 4. Approval Guard: Review stages can be approved only by creative_head and admin. sm_manager and owner cannot approve.
  const isNonReviewStage = workItem.stageKey === 'Shoot';
  const isReviewStage = !isNonReviewStage;
  if (toStatus === 'Approved' && isReviewStage) {
    if (ownerIdStr === userId) {
      const error = new Error('The owner can never approve their own stage');
      error.statusCode = 403;
      error.code = 'FORBIDDEN_SELF_APPROVAL';
      throw error;
    }

    if (!isAdminOrHead) {
      const error = new Error(
        'Review stages can be approved only by Creative Head and Admin. SM Manager and the owner cannot approve.'
      );
      error.statusCode = 403;
      error.code = 'FORBIDDEN_APPROVAL';
      throw error;
    }

    const scope = await resolveScope(user);
    const itemProfileIdStr = (workItem.profileId?._id || workItem.profileId)?.toString();
    if (itemProfileIdStr && !scope.canAccessProfile(itemProfileIdStr)) {
      const error = new Error('You do not have brand profile access to approve deliverables for this brand');
      error.statusCode = 403;
      error.code = 'FORBIDDEN_PROFILE_APPROVAL';
      throw error;
    }
  }

  // 4b. Revision Request Guard: Only Creative Head and Admin can request revisions on review stages
  if (fromStatus === 'Feedback' && toStatus === 'In Progress' && isReviewStage) {
    if (!isAdminOrHead) {
      const error = new Error(
        'Only Creative Head and Admin can request revisions on review stages. The owner and SM Manager cannot.'
      );
      error.statusCode = 403;
      error.code = 'FORBIDDEN_REVISION_REQUEST';
      throw error;
    }
  }

  // 5. Blocker Reason Guard: mandatory when toStatus is Blocked
  if (toStatus === 'Blocked') {
    if (!blockerReason || !BLOCKER_REASONS.includes(blockerReason)) {
      const error = new Error(
        'A valid blockerReason is strictly required when transitioning a work item to Blocked'
      );
      error.statusCode = 400;
      error.code = 'BLOCKER_REASON_REQUIRED';
      throw error;
    }
    workItem.blockerReason = blockerReason;
    workItem.blockerNote = blockerNote || '';
  } else if (fromStatus === 'Blocked') {
    // Clear blocker reason once unblocked
    workItem.blockerReason = null;
    workItem.blockerNote = '';
  }

  // 6. Revision Counter: increment when restarting work after feedback & notify owner
  if (fromStatus === 'Feedback' && toStatus === 'In Progress') {
    workItem.revisions = (workItem.revisions || 0) + 1;
    if (workItem.ownerId) {
      const { createNotification } = await import('../notifications/service.js');
      await createNotification({
        recipient: workItem.ownerId?._id || workItem.ownerId,
        type: 'revision_requested',
        title: 'Revision Requested on Stage Deliverable',
        message: `Creative Head requested a revision on ${workItem.title}. Note: ${comment || 'Please update and resubmit.'}`,
        link: `/my-work?id=${workItem._id}`,
        metadata: { workItemId: workItem._id, comment },
      });
    }
  }

  // 7. Deliverable / Published URLs update if provided
  if (deliverableUrl) {
    workItem.deliverableUrl = deliverableUrl.trim();
  }
  if (publishedUrl) {
    workItem.publishedUrl = publishedUrl.trim();
  }

  workItem.status = toStatus;
  await workItem.save();

  // 8. Scope Reset R3: Content Flow Hand-offs & Stage Unlocking
  if (workItem.contentPieceId) {
    const { ContentPiece } = await import('../calendar/contentPiece.model.js');
    const { createNotification } = await import('../notifications/service.js');

    // If stage approved / completed, unlock next unskipped stage
    if (toStatus === 'Approved') {
      const nextStage = await WorkItem.findOne({
        contentPieceId: workItem.contentPieceId,
        stageOrder: { $gt: workItem.stageOrder },
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
            message: `Stage ${nextStage.stageKey} for "${workItem.title}" is now unlocked.`,
            link: `/my-work?id=${nextStage._id}`,
          });
        } else {
          // Notify SM Managers that stage needs an owner
          const smManagers = await Person.find({ role: 'sm_manager', status: 'active' });
          for (const sm of smManagers) {
            await createNotification({
              recipient: sm._id,
              type: 'needs_owner',
              title: 'Stage Unlocked - Needs Owner',
              message: `Stage ${nextStage.stageKey} for "${workItem.title}" is unlocked and needs an owner.`,
              link: `/calendar?tab=tracker`,
            });
          }
        }
      }
    }

    // If stage published, update parent ContentPiece & turnaround days
    if (toStatus === 'Published') {
      const piece = await ContentPiece.findById(workItem.contentPieceId);
      if (piece) {
        const now = new Date();
        piece.publishedAt = now;
        piece.liveUrl = workItem.publishedUrl || piece.liveUrl;

        const firstStage = await WorkItem.findOne({
          contentPieceId: piece._id,
        }).sort({ stageOrder: 1 });

        const startTimestamp = firstStage?.createdAt || piece.createdAt || now;
        const diffMs = now.getTime() - new Date(startTimestamp).getTime();
        const turnaroundDays = Math.max(0, Math.round(diffMs / (1000 * 3600 * 24)));

        piece.turnaroundDays = turnaroundDays;
        await piece.save();
      }
    }

    // If review requested (moved to Feedback), notify Creative Heads
    if (toStatus === 'Feedback') {
      const creativeHeads = await Person.find({ role: 'creative_head', status: 'active' });
      for (const ch of creativeHeads) {
        await createNotification({
          recipient: ch._id,
          type: 'approval_requested',
          title: 'Deliverable Review Requested',
          message: `${workItem.title} (${workItem.stageKey || 'Stage'}) submitted by ${user.name || 'Worker'} for approval.`,
          link: `/feedback?tab=stages&workItemId=${workItem._id}`,
        });
      }
    }
  }

  // 9. Emit immutable ActivityEvent
  await logActivity({
    entityType: 'work_item',
    entityId: workItem._id,
    profileId: workItem.profileId,
    actor: user,
    action: 'work_item.status_changed',
    fromStatus,
    toStatus,
    metadata: {
      title: workItem.title,
      blockerReason: workItem.blockerReason,
      blockerNote: workItem.blockerNote,
      deliverableUrl: workItem.deliverableUrl,
      publishedUrl: workItem.publishedUrl,
      revisions: workItem.revisions,
      comment,
    },
  });

  return WorkItem.findById(workItem._id)
    .populate('profileId', 'name code active')
    .populate('departmentId', 'name code')
    .populate('ownerId', 'name email role jobRole');
}

