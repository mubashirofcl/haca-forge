import crypto from 'crypto';
import { AccessRequest } from './model.js';
import { User } from '../users/model.js';
import { AuditLog } from '../audit/model.js';
import { sendMail, templates } from '../../lib/mailer.js';
import { env } from '../../config/env.js';

export async function submitAccessRequest(data) {
  const normalizedEmail = data.email.toLowerCase().trim();

  // Check if active user exists
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    const error = new Error('An account already exists with this email address. Please log in.');
    error.code = 'USER_EXISTS';
    error.statusCode = 409;
    throw error;
  }

  // Check if pending access request exists
  const pendingReq = await AccessRequest.findOne({
    email: normalizedEmail,
    status: 'pending',
  });
  if (pendingReq) {
    const error = new Error('An access request for this email is already pending admin review.');
    error.code = 'DUPLICATE_PENDING_REQUEST';
    error.statusCode = 409;
    throw error;
  }

  const accessRequest = await AccessRequest.create({
    ...data,
    email: normalizedEmail,
    status: 'pending',
  });

  // Notify admin if email is configured
  if (env.ADMIN_SEED_EMAIL) {
    const template = templates().accessRequestSubmitted({
      name: data.name,
      email: normalizedEmail,
      department: data.department,
      requestedRole: data.requestedRole,
    });
    await sendMail({
      to: env.ADMIN_SEED_EMAIL,
      ...template,
    }).catch(() => {});
  }

  return accessRequest;
}

export async function listAccessRequests(query = {}) {
  const filter = {};
  if (query.status) {
    filter.status = query.status;
  }
  return AccessRequest.find(filter).sort({ createdAt: -1 });
}

export async function approveAccessRequest(id, reviewData, adminUser, ip) {
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

  const assignedRole = reviewData.assignedRole || accessReq.requestedRole;

  // Non-admins cannot grant admin or lead roles
  if ((assignedRole === 'admin' || assignedRole === 'lead') && adminUser.role !== 'admin') {
    const error = new Error('Only full Administrators can grant Lead or Admin roles');
    error.code = 'UNAUTHORIZED_ROLE_ASSIGNMENT';
    error.statusCode = 403;
    throw error;
  }

  // Generate random 32-byte invite token
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

  // Upsert or create user
  let user = await User.findOne({ email: accessReq.email });
  if (!user) {
    user = new User({
      name: accessReq.name,
      email: accessReq.email,
      role: assignedRole,
      department: accessReq.department,
      teamId: reviewData.teamId,
      skills: reviewData.skills || accessReq.skills || [],
      capacity: reviewData.capacity || 40,
      status: 'active',
      mustSetPassword: true,
    });
  } else {
    user.role = assignedRole;
    user.status = 'active';
    user.mustSetPassword = true;
  }
  await user.save();

  // Update AccessRequest
  accessReq.status = 'approved';
  accessReq.reviewedBy = adminUser._id;
  accessReq.reviewedAt = new Date();
  accessReq.assignedRole = assignedRole;
  accessReq.inviteTokenHash = tokenHash;
  accessReq.inviteExpiresAt = expiresAt;
  await accessReq.save();

  // Send invitation email
  const setPasswordUrl = `${env.FRONTEND_URL}/set-password?token=${rawToken}`;
  const inviteTemplate = templates().invite({
    name: accessReq.name,
    setPasswordUrl,
  });

  await sendMail({
    to: accessReq.email,
    ...inviteTemplate,
  });

  // Write AuditLog
  await AuditLog.create({
    actor: adminUser._id,
    actorEmail: adminUser.email,
    action: 'access_request.approved',
    entity: 'AccessRequest',
    entityId: accessReq._id.toString(),
    before: { status: 'pending' },
    after: { status: 'approved', assignedRole, userId: user._id },
    ip,
  });

  return { accessRequest: accessReq, user, inviteSent: true };
}

export async function rejectAccessRequest(id, reason, adminUser, ip) {
  const accessReq = await AccessRequest.findById(id);
  if (!accessReq) {
    const error = new Error('Access request not found');
    error.code = 'NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

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

  // Write AuditLog
  await AuditLog.create({
    actor: adminUser._id,
    actorEmail: adminUser.email,
    action: 'access_request.rejected',
    entity: 'AccessRequest',
    entityId: accessReq._id.toString(),
    before: { status: 'pending' },
    after: { status: 'rejected', rejectReason: reason },
    ip,
  });

  return accessReq;
}

export async function requestInfoForAccess(id, question, adminUser, ip) {
  const accessReq = await AccessRequest.findById(id);
  if (!accessReq) {
    const error = new Error('Access request not found');
    error.code = 'NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  accessReq.status = 'info_needed';
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

  await AuditLog.create({
    actor: adminUser._id,
    actorEmail: adminUser.email,
    action: 'access_request.info_needed',
    entity: 'AccessRequest',
    entityId: accessReq._id.toString(),
    before: { status: accessReq.status },
    after: { status: 'info_needed', question },
    ip,
  });

  return accessReq;
}
