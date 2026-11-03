import mongoose from 'mongoose';
import { Person } from '../modules/people/model.js';
import { normalizeRole } from '@mmp/shared';

/**
 * Resolves query-level scoping for a given user and optional request filters.
 * Scoped to people scope only (all or self by role).
 * HACA is the only organisation; there is no brand or profile dimension.
 *
 * @param {Object} user - Authenticated user / Person object
 * @param {Object} filters - Optional filters: { departmentId, ownerId, status }
 * @returns {Promise<Object>} Scoping definition with allowedPersonIds and query builders
 */
export async function resolveScope(user, filters = {}) {
  if (!user) {
    return {
      isAllowed: false,
      scopeType: 'none',
      allowedPersonIds: [],
      canAccessPerson: () => false,
      canAccessProfile: () => true,
      canAccessAllProfiles: true,
      allowedProfileIds: [],
      buildQuery: () => ({ _id: { $exists: false } }),
    };
  }

  const role = normalizeRole(user.role);
  const userId = (user._id || user.id || user.userId)?.toString();

  let isAllowed = true;

  // Resolve person scope (admin, creative_head, executive, and sm_manager see all; team_member sees self only)
  let scopeType = 'self';
  let allowedPersonIds = null; // null represents all people

  if (role === 'admin' || role === 'creative_head' || role === 'executive' || role === 'sm_manager') {
    scopeType = 'all';
    allowedPersonIds = null; // Full visibility across all people and all work

    if (filters.ownerId) {
      allowedPersonIds = [filters.ownerId.toString()];
    }
  } else {
    // team_member: self only
    scopeType = 'self';
    allowedPersonIds = [userId];

    if (filters.ownerId) {
      const reqOwnerId = filters.ownerId.toString();
      if (reqOwnerId !== userId) {
        allowedPersonIds = [];
        isAllowed = false;
      }
    }
  }

  /**
   * Helper to construct MongoDB filter query applying resolved scope
   */
  const buildQuery = (baseQuery = {}) => {
    if (!isAllowed) {
      return { ...baseQuery, _id: { $exists: false } };
    }

    const scopedQuery = { ...baseQuery };

    // Apply person scoping
    if (allowedPersonIds !== null) {
      const objectIdPersons = allowedPersonIds.map((id) =>
        mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id
      );

      if (scopedQuery.ownerId) {
        const existingOwnerId = scopedQuery.ownerId.toString();
        if (!allowedPersonIds.includes(existingOwnerId)) {
          return { ...baseQuery, _id: { $exists: false } };
        }
      } else {
        scopedQuery.ownerId = { $in: objectIdPersons };
      }
    }

    return scopedQuery;
  };

  const canAccessPerson = (personId) => {
    if (!personId) return false;
    if (role === 'admin' || role === 'creative_head' || role === 'executive' || role === 'sm_manager') return true;
    if (allowedPersonIds === null) return true;
    return allowedPersonIds.includes(personId.toString());
  };

  return {
    isAllowed,
    scopeType,
    canAccessPerson,
    canAccessProfile: () => true,
    canAccessAllProfiles: true,
    allowedProfileIds: [],
    allowedPersonIds,
    buildQuery,
  };
}
