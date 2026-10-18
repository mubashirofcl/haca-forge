import { TeamAssignment } from '../modules/teamAssignments/model.js';
import { normalizeRole } from '@mmp/shared';

/**
 * Returns the set of worker IDs managed by a user based on dynamic TeamAssignments.
 *
 * @param {Object} user - User document or token payload containing _id/userId and role
 * @returns {Promise<'all' | mongoose.Types.ObjectId[]>} 'all' for admin/head, array of worker IDs for team_lead/worker, [] otherwise
 */
export async function getManagedWorkerIds(user) {
  if (!user) return [];

  const role = normalizeRole(user.role);
  const userId = user._id || user.userId || user.id;

  // 1. Admin and Marketing Head manage all workers across all teams
  if (role === 'admin' || role === 'head') {
    return 'all';
  }

  // 2. Team Lead: manages workers actively assigned via TeamAssignment (plus self)
  if (role === 'team_lead') {
    const assignments = await TeamAssignment.find({
      teamLeadId: userId,
      active: true,
    }).select('workerId');

    const workerIds = assignments.map((a) => a.workerId);
    // Include self so leads can view their own entries
    if (userId && !workerIds.some((id) => id.toString() === userId.toString())) {
      workerIds.push(userId);
    }
    return workerIds;
  }

  // 3. Worker: manages strictly themselves
  if (role === 'worker') {
    return userId ? [userId] : [];
  }

  // 4. Other roles manage no production workers
  return [];
}

/**
 * Checks whether a given worker is managed by a specific user (admin, head, or assigned team_lead)
 *
 * @param {Object} leadUser - User document or payload
 * @param {string|mongoose.Types.ObjectId} workerId - Target worker ID
 * @returns {Promise<boolean>}
 */
export async function isWorkerManagedBy(leadUser, workerId) {
  if (!leadUser || !workerId) return false;

  const role = normalizeRole(leadUser.role);
  if (role === 'admin' || role === 'head') {
    return true;
  }

  if (role === 'team_lead') {
    const leadId = leadUser._id || leadUser.userId || leadUser.id;
    if (leadId && leadId.toString() === workerId.toString()) {
      return true;
    }

    const assignment = await TeamAssignment.findOne({
      teamLeadId: leadId,
      workerId,
      active: true,
    });
    return !!assignment;
  }

  if (role === 'worker') {
    const leadId = leadUser._id || leadUser.userId || leadUser.id;
    return leadId && leadId.toString() === workerId.toString();
  }

  return false;
}

/**
 * Generates a MongoDB query condition for filtering entities by managed worker IDs
 *
 * @param {Object} user - User document or payload
 * @param {string} fieldName - Field to filter on ('assignee', 'userId', etc.)
 * @returns {Promise<Object>} MongoDB filter object
 */
export async function getManagedWorkersFilter(user, fieldName = 'assignee') {
  const managed = await getManagedWorkerIds(user);
  if (managed === 'all') {
    return {};
  }
  if (Array.isArray(managed) && managed.length > 0) {
    return { [fieldName]: { $in: managed } };
  }
  return { [fieldName]: null };
}
