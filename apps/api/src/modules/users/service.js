import { User } from './model.js';
import { AuditLog } from '../audit/model.js';
import bcrypt from 'bcryptjs';

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
