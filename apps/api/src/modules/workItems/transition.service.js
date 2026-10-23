import { WorkItem } from './model.js';
import { logActivity } from '../activity/service.js';
import { BLOCKER_REASONS, APPROVER_JOB_ROLES, normalizeRole } from '@mmp/shared';
import { resolveScope } from '../../lib/scope.js';
import { Person } from '../people/model.js';

export const ALLOWED_TRANSITIONS = {
  'Not Started': ['In Progress', 'Blocked'],
  'In Progress': ['Feedback', 'Pending', 'Blocked'],
  'Feedback': ['In Progress', 'Pending', 'Approved', 'Blocked'],
  'Pending': ['Approved', 'Feedback', 'In Progress', 'Blocked'],
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
  const isAdminOrHead = user.role === 'admin' || user.role === 'marketing_head';
  const isTeamLead = user.role === 'team_lead';

  if (user.role === 'team_member' && ownerIdStr !== userId) {
    const error = new Error('You can only update status for work items assigned to you');
    error.statusCode = 403;
    error.code = 'FORBIDDEN_OWNERSHIP';
    throw error;
  }

  // 4. Approval Guard
  if (toStatus === 'Approved') {
    const userRole = normalizeRole(user.role);

    // CONTENT FLOW DELTA: The owner can NEVER approve their own stage
    if (workItem.reviewRequired && ownerIdStr === userId) {
      const error = new Error('The owner can never approve their own stage');
      error.statusCode = 403;
      error.code = 'FORBIDDEN_SELF_APPROVAL';
      throw error;
    }

    if (workItem.reviewRequired) {
      let userJobRole = user.jobRole;
      let effectiveUserRole = userRole;
      if ((!userJobRole || !effectiveUserRole) && userId) {
        const person = await Person.findById(userId);
        if (person) {
          userJobRole = userJobRole || person.jobRole;
          effectiveUserRole = effectiveUserRole || normalizeRole(person.role);
        }
      }

      const isApproverLead =
        effectiveUserRole === 'team_lead' && APPROVER_JOB_ROLES.includes(userJobRole);
      const isAllowedRole =
        effectiveUserRole === 'admin' || effectiveUserRole === 'marketing_head' || isApproverLead;

      if (!isAllowedRole) {
        const error = new Error(
          'For review-required stages, approvers must be team leads with an approver job role (Creative Manager (TL)), Marketing Head, or Administrator'
        );
        error.statusCode = 403;
        error.code = 'FORBIDDEN_APPROVAL';
        throw error;
      }

      // Normal scope rule: must hold the brand
      const scope = await resolveScope(user);
      const itemProfileIdStr = (workItem.profileId?._id || workItem.profileId)?.toString();
      if (itemProfileIdStr && !scope.canAccessProfile(itemProfileIdStr)) {
        const error = new Error('You do not have brand profile access to approve deliverables for this brand');
        error.statusCode = 403;
        error.code = 'FORBIDDEN_PROFILE_APPROVAL';
        throw error;
      }
    } else {
      // Standalone work items keep the standard rule
      if (!isAdminOrHead && !isTeamLead) {
        const error = new Error('Only a Team Lead, Marketing Head, or Administrator can approve deliverables');
        error.statusCode = 403;
        error.code = 'FORBIDDEN_APPROVAL';
        throw error;
      }

      const scope = await resolveScope(user);
      const itemProfileIdStr = (workItem.profileId?._id || workItem.profileId)?.toString();
      if (itemProfileIdStr && !scope.canAccessProfile(itemProfileIdStr)) {
        const error = new Error('You do not have permission to approve work items for this brand profile');
        error.statusCode = 403;
        error.code = 'FORBIDDEN_PROFILE_APPROVAL';
        throw error;
      }
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

  // 6. Revision Counter: increment when restarting work after feedback
  if (fromStatus === 'Feedback' && toStatus === 'In Progress') {
    workItem.revisions = (workItem.revisions || 0) + 1;
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

  // 8. Emit immutable ActivityEvent
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
    .populate('campaignId', 'name relatedOKR status budget')
    .populate('profileId', 'name code active')
    .populate('departmentId', 'name code')
    .populate('ownerId', 'name email role jobRole')
    .populate('relatedTarget', 'month revenueTarget leadsTarget');
}
