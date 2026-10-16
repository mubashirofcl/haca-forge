import crypto from 'crypto';
import { User } from './model.js';
import { AuditLog } from '../audit/model.js';
import { env } from '../../config/env.js';
import { sendMail, templates } from '../../lib/mailer.js';

export async function listUsers(query = {}) {
  const filter = {};
  if (query.role) filter.role = query.role;
  if (query.status) filter.status = query.status;
  if (query.department) filter.department = query.department;
  if (query.teamId) filter.teamId = query.teamId;
  if (query.search) {
    filter.$or = [
      { name: { $regex: query.search, $options: 'i' } },
      { email: { $regex: query.search, $options: 'i' } },
    ];
  }

  return User.find(filter).sort({ createdAt: -1 });
}

export async function updateUserRole(userId, newRole, adminUser, ip) {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.code = 'NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  const oldRole = user.role;
  user.role = newRole;
  await user.save();

  await AuditLog.create({
    actor: adminUser._id,
    actorEmail: adminUser.email,
    action: 'user.role_changed',
    entity: 'User',
    entityId: user._id.toString(),
    before: { role: oldRole },
    after: { role: newRole },
    ip,
  });

  return user;
}

export async function updateUserStatus(userId, newStatus, adminUser, ip) {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.code = 'NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  // Prevent admin from suspending themselves
  if (user._id.toString() === adminUser._id.toString() && newStatus === 'suspended') {
    const error = new Error('Administrators cannot suspend their own account');
    error.code = 'SELF_SUSPENSION_PROHIBITED';
    error.statusCode = 400;
    throw error;
  }

  const oldStatus = user.status;
  user.status = newStatus;
  if (newStatus === 'suspended') {
    user.refreshTokenHash = null; // Invalidate current session
  }
  await user.save();

  await AuditLog.create({
    actor: adminUser._id,
    actorEmail: adminUser.email,
    action: `user.${newStatus}`,
    entity: 'User',
    entityId: user._id.toString(),
    before: { status: oldStatus },
    after: { status: newStatus },
    ip,
  });

  return user;
}

export async function forceLogoutUser(userId, adminUser, ip) {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.code = 'NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  user.refreshTokenHash = null;
  await user.save();

  await AuditLog.create({
    actor: adminUser._id,
    actorEmail: adminUser.email,
    action: 'user.forced_logout',
    entity: 'User',
    entityId: user._id.toString(),
    ip,
  });

  return { success: true };
}

export async function updateUserAssignment(userId, { teamId, department, skills, capacity }, adminUser, ip) {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.code = 'NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  const before = {
    teamId: user.teamId,
    department: user.department,
    skills: user.skills,
    capacity: user.capacity,
  };

  if (teamId !== undefined) user.teamId = teamId;
  if (department !== undefined) user.department = department;
  if (skills !== undefined) user.skills = skills;
  if (capacity !== undefined) user.capacity = capacity;

  await user.save();

  await AuditLog.create({
    actor: adminUser._id,
    actorEmail: adminUser.email,
    action: 'user.assignment_updated',
    entity: 'User',
    entityId: user._id.toString(),
    before,
    after: {
      teamId: user.teamId,
      department: user.department,
      skills: user.skills,
      capacity: user.capacity,
    },
    ip,
  });

  return user;
}

export async function resetUserPasswordByAdmin(userId, adminUser, ip) {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.code = 'NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h

  user.resetPasswordTokenHash = tokenHash;
  user.resetPasswordExpiresAt = expiresAt;
  user.refreshTokenHash = null; // Revoke current session
  await user.save();

  await AuditLog.create({
    actor: adminUser._id,
    actorEmail: adminUser.email,
    action: 'user.password_reset_triggered',
    entity: 'User',
    entityId: user._id.toString(),
    ip,
  });

  const resetUrl = `${env.FRONTEND_URL}/set-password?token=${rawToken}`;

  const template = templates().inviteUser({
    name: user.name,
    email: user.email,
    inviteUrl: resetUrl,
  });

  await sendMail({
    to: user.email,
    subject: 'HACA FORGE - Password Reset Generated',
    text: `Hello ${user.name},\n\nAn administrator has triggered a password reset for your account. Please click the link below to set a new password:\n${resetUrl}\n\nThis link expires in 48 hours.`,
    html: template.html,
  }).catch(() => {});

  return {
    success: true,
    message: `Password reset link generated for ${user.name}`,
    resetLink: resetUrl,
  };
}

