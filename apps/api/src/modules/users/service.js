import crypto from 'crypto';
import { User } from './model.js';
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

export async function updateUserRole(userId, newRole, actor) {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.code = 'NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  // Prevent non-admin from modifying admin or executive accounts or granting admin or executive roles
  if (actor && actor.role !== 'admin') {
    if (newRole === 'admin' || newRole === 'executive' || user.role === 'admin' || user.role === 'executive') {
      const error = new Error('Only administrators can grant or modify admin or executive roles');
      error.code = 'FORBIDDEN';
      error.statusCode = 403;
      throw error;
    }
  }

  user.role = newRole;
  await user.save();
  return user;
}

export async function updateUserStatus(userId, newStatus, adminUser) {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.code = 'NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  // Prevent non-admin from modifying admin or executive accounts
  if (adminUser && adminUser.role !== 'admin') {
    if (user.role === 'admin' || user.role === 'executive') {
      const error = new Error('Only administrators can modify admin or executive accounts');
      error.code = 'FORBIDDEN';
      error.statusCode = 403;
      throw error;
    }
  }

  // Prevent admin from suspending themselves
  if (adminUser && user._id.toString() === adminUser._id.toString() && newStatus === 'suspended') {
    const error = new Error('Administrators cannot suspend their own account');
    error.code = 'SELF_SUSPENSION_PROHIBITED';
    error.statusCode = 400;
    throw error;
  }

  user.status = newStatus;
  if (newStatus === 'suspended') {
    user.refreshTokenHash = null; // Invalidate current session
  }
  await user.save();

  return user;
}

export async function forceLogoutUser(userId) {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.code = 'NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  user.refreshTokenHash = null;
  await user.save();

  return { success: true };
}

export async function updateUserAssignment(userId, { teamId, department, skills, capacity }) {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.code = 'NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  if (teamId !== undefined) user.teamId = teamId;
  if (department !== undefined) user.department = department;
  if (skills !== undefined) user.skills = skills;
  if (capacity !== undefined) user.capacity = capacity;

  await user.save();
  return user;
}

export async function resetUserPasswordByAdmin(userId) {
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
