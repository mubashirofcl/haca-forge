import crypto from 'crypto';
import mongoose from 'mongoose';
import { REQUESTABLE_ROLES, ROLE_KEYS } from '@mmp/shared';
import { AccessRequest } from './model.js';
import { Person } from '../people/model.js';
import { Department } from '../departments/model.js';
import { Profile } from '../referenceData/profile.model.js';
import { sendMail, templates } from '../../lib/mailer.js';
import { env } from '../../config/env.js';
import { eventBus, EVENTS } from '../../lib/events.js';
import { logActivity } from '../activity/service.js';

export async function submitAccessRequest(data) {
  const normalizedEmail = data.email ? data.email.toLowerCase().trim() : '';

  // Server-side guard: public request form strictly allows team_member and team_lead only
  if (!REQUESTABLE_ROLES.includes(data.requestedRole)) {
    const error = new Error('Only Team Member or Team Lead can be requested');
    error.code = 'INVALID_REQUESTED_ROLE';
    error.statusCode = 400;
    throw error;
  }

  // Check if active user already exists
  const existingUser = await Person.findOne({ email: normalizedEmail });
  if (existingUser) {
    const error = new Error('An account already exists with this email address. Please log in.');
    error.code = 'USER_EXISTS';
    error.statusCode = 409;
    throw error;
  }

  // Check if pending access request already exists
  const pendingReq = await AccessRequest.findOne({
    email: normalizedEmail,
    status: 'pending',
  });
  if (pendingReq) {
    const error = new Error('A request for this email is already pending.');
    error.code = 'DUPLICATE_PENDING_REQUEST';
    error.statusCode = 409;
    throw error;
  }

  // Resolve departmentId if not explicitly provided
  let departmentId = data.departmentId;
  if (!departmentId && data.department) {
    const deptDoc = await Department.findOne({
      $or: [{ code: data.department }, { name: data.department }],
    });
    if (deptDoc) {
      departmentId = deptDoc._id;
    }
  }

  // Resolve requestedProfileIds from requestedProfileCodes
  let requestedProfileIds = [];
  if (Array.isArray(data.requestedProfileCodes) && data.requestedProfileCodes.length > 0) {
    const matchedProfiles = await Profile.find({
      code: { $in: data.requestedProfileCodes },
    }).select('_id');
    requestedProfileIds = matchedProfiles.map((p) => p._id);
  }

  const accessRequest = await AccessRequest.create({
    name: data.name,
    email: normalizedEmail,
    phone: data.phone,
    department: data.department,
    departmentId,
    jobRole: data.jobRole,
    requestedRole: data.requestedRole,
    requestedProfileCodes: data.requestedProfileCodes || [],
    requestedProfileIds,
    reason: data.reason,
    status: 'pending',
  });

  // Log activity event
  await logActivity({
    entityType: 'access_request',
    entityId: accessRequest._id,
    actor: null,
    action: 'access_request.submitted',
    toStatus: 'pending',
    metadata: {
      name: data.name,
      email: normalizedEmail,
      department: data.department,
      jobRole: data.jobRole,
      requestedRole: data.requestedRole,
      brands: data.requestedProfileCodes,
    },
  });

  // Notify domain event bus
  eventBus.emit(EVENTS.ACCESS_REQUESTED, {
    id: accessRequest._id,
    name: data.name,
    email: normalizedEmail,
    department: data.department,
    requestedRole: data.requestedRole,
  });

  // Notify all active administrators via email
  try {
    const activeAdmins = await Person.find({ role: 'admin', status: 'active' }).select('email');
    const adminEmails = new Set(
      activeAdmins.map((a) => a.email?.toLowerCase().trim()).filter(Boolean)
    );
    if (env.ADMIN_SEED_EMAIL) {
      adminEmails.add(env.ADMIN_SEED_EMAIL.toLowerCase().trim());
    }

    const emailTemplate = templates().accessRequestSubmitted({
      name: data.name,
      email: normalizedEmail,
      department: data.department,
      jobRole: data.jobRole,
      requestedRole: data.requestedRole,
      brands: data.requestedProfileCodes || [],
    });

    for (const adminEmail of adminEmails) {
      await sendMail({
        to: adminEmail,
        ...emailTemplate,
      }).catch(() => {});
    }
  } catch (err) {
    // Non-blocking notification error
  }

  return accessRequest;
}

export async function listAccessRequests(query = {}) {
  const filter = {};
  if (query.status && query.status !== 'all') {
    filter.status = query.status;
  }

  if (query.department && query.department !== 'all') {
    if (mongoose.Types.ObjectId.isValid(query.department)) {
      filter.$or = [{ departmentId: query.department }, { department: query.department }];
    } else {
      filter.department = { $regex: new RegExp(`^${query.department}$`, 'i') };
    }
  }

  if (query.brand && query.brand !== 'all') {
    if (mongoose.Types.ObjectId.isValid(query.brand)) {
      filter.$or = [
        { requestedProfileIds: query.brand },
        { assignedProfileAccess: query.brand },
      ];
    } else {
      filter.requestedProfileCodes = query.brand;
    }
  }

  return AccessRequest.find(filter)
    .populate('reviewedBy', 'name email role')
    .populate('departmentId', 'name code')
    .populate('requestedProfileIds', 'name code')
    .populate('assignedDepartmentId', 'name code')
    .populate('assignedProfileAccess', 'name code')
    .populate('assignedReportsToIds', 'name email role jobRole')
    .sort({ createdAt: -1 });
}

export async function approveAccessRequest(id, reviewData = {}, adminUser) {
  // Only full administrators can approve access requests
  if (adminUser.role !== 'admin') {
    const error = new Error('Only administrators can approve access requests');
    error.code = 'FORBIDDEN';
    error.statusCode = 403;
    throw error;
  }

  const accessReq = await AccessRequest.findById(id);
  if (!accessReq) {
    const error = new Error('Access request not found');
    error.code = 'NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  if (accessReq.status === 'approved') {
    const error = new Error('Access request has already been approved');
    error.code = 'ALREADY_APPROVED';
    error.statusCode = 400;
    throw error;
  }

  const assignedRole = reviewData.assignedRole || accessReq.requestedRole || 'team_member';

  // Only admin may grant admin or marketing_head
  if (['admin', 'marketing_head'].includes(assignedRole) && adminUser.role !== 'admin') {
    const error = new Error('Only full Administrators can grant Admin or Marketing Head roles');
    error.code = 'UNAUTHORIZED_ROLE_ASSIGNMENT';
    error.statusCode = 403;
    throw error;
  }

  // Resolve assigned Department
  let assignedDepartmentId = reviewData.departmentId || accessReq.departmentId;
  if (!assignedDepartmentId && accessReq.department) {
    const deptDoc = await Department.findOne({
      $or: [{ code: accessReq.department }, { name: accessReq.department }],
    });
    if (deptDoc) assignedDepartmentId = deptDoc._id;
  }

  // Resolve assigned Profile Access
  let assignedProfileAccess = [];
  if (Array.isArray(reviewData.profileAccess) && reviewData.profileAccess.length > 0) {
    const validIds = reviewData.profileAccess.filter((x) => mongoose.Types.ObjectId.isValid(x));
    const codes = reviewData.profileAccess.filter((x) => !mongoose.Types.ObjectId.isValid(x));
    const docs = await Profile.find({
      $or: [{ _id: { $in: validIds } }, { code: { $in: codes } }],
    }).select('_id');
    assignedProfileAccess = docs.map((d) => d._id);
  } else if (accessReq.requestedProfileIds && accessReq.requestedProfileIds.length > 0) {
    assignedProfileAccess = accessReq.requestedProfileIds;
  } else if (accessReq.requestedProfileCodes && accessReq.requestedProfileCodes.length > 0) {
    const docs = await Profile.find({
      code: { $in: accessReq.requestedProfileCodes },
    }).select('_id');
    assignedProfileAccess = docs.map((d) => d._id);
  }

  const assignedJobRole = reviewData.jobRole || accessReq.jobRole || '';
  const assignedReportsToIds = Array.isArray(reviewData.reportsToIds) ? reviewData.reportsToIds : [];
  const assignedCapacity = reviewData.weeklyCapacityHours ?? reviewData.capacity ?? 40;

  // Generate 32-byte secure invite token with 48h expiry
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

  // Upsert or activate Person
  let user = await Person.findOne({ email: accessReq.email });
  if (!user) {
    user = new Person({
      name: accessReq.name,
      email: accessReq.email,
      role: assignedRole,
      jobRole: assignedJobRole,
      departmentId: assignedDepartmentId,
      profileAccess: assignedProfileAccess,
      reportsToIds: assignedReportsToIds,
      weeklyCapacityHours: assignedCapacity,
      status: 'active',
      mustSetPassword: true,
      resetPasswordTokenHash: tokenHash,
      resetPasswordExpiresAt: expiresAt,
    });
  } else {
    user.role = assignedRole;
    user.jobRole = assignedJobRole;
    user.departmentId = assignedDepartmentId;
    user.profileAccess = assignedProfileAccess;
    user.reportsToIds = assignedReportsToIds;
    user.weeklyCapacityHours = assignedCapacity;
    user.status = 'active';
    user.mustSetPassword = true;
    user.resetPasswordTokenHash = tokenHash;
    user.resetPasswordExpiresAt = expiresAt;
  }
  await user.save();

  // Update AccessRequest
  accessReq.status = 'approved';
  accessReq.reviewedBy = adminUser._id;
  accessReq.reviewedAt = new Date();
  accessReq.assignedRole = assignedRole;
  accessReq.assignedJobRole = assignedJobRole;
  accessReq.assignedDepartmentId = assignedDepartmentId;
  accessReq.assignedProfileAccess = assignedProfileAccess;
  accessReq.assignedReportsToIds = assignedReportsToIds;
  accessReq.assignedCapacity = assignedCapacity;
  accessReq.inviteTokenHash = tokenHash;
  accessReq.inviteExpiresAt = expiresAt;
  await accessReq.save();

  // Send single-use 48-hour set-password invitation
  const setPasswordUrl = `${env.FRONTEND_URL}/set-password?token=${rawToken}`;
  const inviteTemplate = templates().invite({
    name: accessReq.name,
    setPasswordUrl,
  });

  await sendMail({
    to: accessReq.email,
    ...inviteTemplate,
  }).catch(() => {});

  // Record ActivityEvent
  await logActivity({
    entityType: 'access_request',
    entityId: accessReq._id,
    actor: adminUser,
    action: 'access_request.approved',
    fromStatus: 'pending',
    toStatus: 'approved',
    metadata: {
      userId: user._id,
      assignedRole,
      jobRole: assignedJobRole,
      departmentId: assignedDepartmentId,
      profileAccessCount: assignedProfileAccess.length,
    },
  });

  return {
    accessRequest: accessReq,
    user,
    inviteSent: true,
    inviteLink: setPasswordUrl,
    inviteToken: rawToken,
  };
}

export async function rejectAccessRequest(id, reason, adminUser) {
  if (adminUser.role !== 'admin') {
    const error = new Error('Only administrators can reject access requests');
    error.code = 'FORBIDDEN';
    error.statusCode = 403;
    throw error;
  }

  const accessReq = await AccessRequest.findById(id);
  if (!accessReq) {
    const error = new Error('Access request not found');
    error.code = 'NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  const fromStatus = accessReq.status;
  accessReq.status = 'rejected';
  accessReq.rejectReason = reason;
  accessReq.reviewedBy = adminUser._id;
  accessReq.reviewedAt = new Date();
  await accessReq.save();

  // Send rejection email
  const template = templates().requestRejected({
    name: accessReq.name,
    reason,
  });
  await sendMail({
    to: accessReq.email,
    ...template,
  }).catch(() => {});

  // Record ActivityEvent
  await logActivity({
    entityType: 'access_request',
    entityId: accessReq._id,
    actor: adminUser,
    action: 'access_request.rejected',
    fromStatus,
    toStatus: 'rejected',
    metadata: { reason },
  });

  return accessReq;
}

export async function requestInfoForAccess(id, question, adminUser) {
  if (adminUser.role !== 'admin') {
    const error = new Error('Only administrators can request info on access requests');
    error.code = 'FORBIDDEN';
    error.statusCode = 403;
    throw error;
  }

  const accessReq = await AccessRequest.findById(id);
  if (!accessReq) {
    const error = new Error('Access request not found');
    error.code = 'NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  const fromStatus = accessReq.status;
  accessReq.status = 'info_needed';
  accessReq.infoQuestion = question;
  accessReq.reviewedBy = adminUser._id;
  accessReq.reviewedAt = new Date();
  await accessReq.save();

  const template = templates().infoNeeded({
    name: accessReq.name,
    question,
  });
  await sendMail({
    to: accessReq.email,
    ...template,
  }).catch(() => {});

  // Record ActivityEvent
  await logActivity({
    entityType: 'access_request',
    entityId: accessReq._id,
    actor: adminUser,
    action: 'access_request.info_requested',
    fromStatus,
    toStatus: 'info_needed',
    metadata: { question },
  });

  return accessReq;
}

export async function bulkApproveAccessRequests({ requestIds, defaultRole, defaultCapacity }, adminUser, ip) {
  if (adminUser.role !== 'admin') {
    const error = new Error('Only administrators can bulk approve access requests');
    error.code = 'FORBIDDEN';
    error.statusCode = 403;
    throw error;
  }

  if (!Array.isArray(requestIds) || requestIds.length === 0) {
    const error = new Error('requestIds array is required and must not be empty');
    error.statusCode = 400;
    throw error;
  }

  const results = [];
  for (const id of requestIds) {
    try {
      const res = await approveAccessRequest(
        id,
        {
          assignedRole: defaultRole,
          weeklyCapacityHours: defaultCapacity,
        },
        adminUser,
        ip
      );
      results.push({ id, success: true, email: res.accessRequest.email });
    } catch (err) {
      results.push({ id, success: false, error: err.message });
    }
  }

  return results;
}
