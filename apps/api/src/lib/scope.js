import mongoose from 'mongoose';
import { Person } from '../modules/people/model.js';
import { Profile } from '../modules/referenceData/profile.model.js';
import { normalizeRole } from '@mmp/shared';

/**
 * Resolves query-level scoping for a given user and optional request filters.
 * Source of truth: Spec Section 6.3 and Master Build Plan Phase 1.
 *
 * @param {Object} user - Authenticated user / Person object
 * @param {Object} filters - Optional filters: { profileId, departmentId, ownerId, campaignId, status }
 * @returns {Promise<Object>} Scoping definition with allowedProfileIds, allowedPersonIds, and query builders
 */
export async function resolveScope(user, filters = {}) {
  if (!user) {
    return {
      isAllowed: false,
      scopeType: 'none',
      allowedProfileIds: [],
      allowedPersonIds: [],
      buildQuery: () => ({ _id: { $exists: false } }),
    };
  }

  const role = normalizeRole(user.role);
  const userId = (user._id || user.id || user.userId)?.toString();

  // Normalize user's profile access
  let userProfileAccess = (user.profileAccess || []).map((p) =>
    typeof p === 'object' && p !== null ? (p._id || p.id)?.toString() : p?.toString()
  ).filter(Boolean);

  // If user is admin or marketing_head without profileAccess explicitly set, fetch all profile IDs
  if (role === 'admin' || (role === 'marketing_head' && userProfileAccess.length === 0)) {
    const allProfiles = await Profile.find({ active: true }, '_id').lean();
    if (allProfiles.length > 0) {
      userProfileAccess = allProfiles.map((p) => p._id.toString());
    }
  }

  // Check requested profile filter
  let allowedProfileIds = [...userProfileAccess];
  let isAllowed = true;

  if (filters.profileId) {
    let requestedProfileId = filters.profileId.toString();
    if (!mongoose.Types.ObjectId.isValid(requestedProfileId) || !/^[0-9a-fA-F]{24}$/.test(requestedProfileId)) {
      const pDoc = await Profile.findOne({
        $or: [
          { code: requestedProfileId.toLowerCase() },
          { name: requestedProfileId },
        ],
      }).select('_id');
      if (pDoc) {
        requestedProfileId = pDoc._id.toString();
      }
    }
    if (role === 'admin') {
      allowedProfileIds = [requestedProfileId];
    } else if (userProfileAccess.includes(requestedProfileId)) {
      allowedProfileIds = [requestedProfileId];
    } else {
      // Requested a profile outside allowed profileAccess
      allowedProfileIds = [];
      isAllowed = false;
    }
  }

  // Resolve person scope
  let scopeType = 'self';
  let allowedPersonIds = null; // null represents all people

  if (role === 'admin' || role === 'marketing_head' || role === 'executive') {
    scopeType = 'all';
    allowedPersonIds = null; // Full visibility

    if (filters.ownerId) {
      allowedPersonIds = [filters.ownerId.toString()];
    }
  } else if (role === 'team_lead') {
    scopeType = 'team';

    // Own team = direct reports (reportsToIds contains userId) + same department + self
    const teamQuery = {
      $or: [
        { _id: userId },
        { reportsToIds: userId },
      ],
      status: { $ne: 'suspended' },
    };

    if (user.departmentId) {
      teamQuery.$or.push({ departmentId: user.departmentId });
    }

    const teamMembers = await Person.find(teamQuery, '_id').lean();
    const teamIds = teamMembers.map((m) => m._id.toString());
    if (!teamIds.includes(userId)) {
      teamIds.push(userId);
    }

    if (filters.ownerId) {
      const reqOwnerId = filters.ownerId.toString();
      if (teamIds.includes(reqOwnerId)) {
        allowedPersonIds = [reqOwnerId];
      } else {
        allowedPersonIds = [];
        isAllowed = false;
      }
    } else {
      allowedPersonIds = teamIds;
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

    // Apply profile scoping (if allowedProfileIds is restricted)
    if (allowedProfileIds && allowedProfileIds.length > 0) {
      if (scopedQuery.profileId) {
        // If query already has profileId, verify it's allowed
        const existingProfileId = scopedQuery.profileId.toString();
        if (!allowedProfileIds.includes(existingProfileId)) {
          return { ...baseQuery, _id: { $exists: false } };
        }
      } else {
        scopedQuery.profileId = {
          $in: allowedProfileIds.map((id) =>
            mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id
          ),
        };
      }
    }

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

  const canAccessProfile = (profileId) => {
    if (!profileId) return false;
    if (role === 'admin') return true;
    return userProfileAccess.includes(profileId.toString());
  };

  const canAccessPerson = (personId) => {
    if (!personId) return false;
    if (role === 'admin' || role === 'marketing_head' || role === 'executive') return true;
    if (allowedPersonIds === null) return true;
    return allowedPersonIds.includes(personId.toString());
  };

  const canAccessAllProfiles = role === 'admin' || role === 'marketing_head';

  return {
    isAllowed,
    scopeType,
    canAccessAllProfiles,
    allowedProfileIds,
    allowedPersonIds,
    userProfileAccess,
    canAccessProfile,
    canAccessPerson,
    buildQuery,
  };
}
