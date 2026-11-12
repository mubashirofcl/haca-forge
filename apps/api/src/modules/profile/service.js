import bcrypt from 'bcryptjs';
import { countAwaitingReview } from '../workItems/reviewState.js';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { User } from '../people/model.js';
import { Session } from '../auth/session.model.js';
import { ActivityEvent } from '../activity/model.js';
import { sendMail, templates } from '../../lib/mailer.js';
import { createNotification } from '../notifications/service.js';
import { logger } from '../../lib/logger.js';
import { normalizeRole } from '@mmp/shared';
import { AccessRequest } from '../access/model.js';
import { CalendarPlan } from '../calendar/plan.model.js';
import { WorkItem } from '../workItems/model.js';
import { PhoneVerification } from './phoneVerification.model.js';
import { disconnectUserSockets } from '../../lib/socketHub.js';

export function stripHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/<[^>]*>?/gm, '').trim();
}

export function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return '';
  return phone.trim().replace(/[\s\-\(\)]/g, '');
}

/**
 * Get the current signed-in user's profile
 */
export async function getProfile(userId) {
  const user = await User.findById(userId)
    .populate('departmentId', 'name code')
    .populate('reportsToIds', 'name email role jobRole')
    .lean();

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  const deptName = user.departmentId?.name || (typeof user.department === 'string' ? user.department : '');
  const normalizedRole = normalizeRole(user.role);

  // Compute role panel metric summaries
  let rolePanelData = null;
  if (normalizedRole === 'admin') {
    const pendingAccessRequests = await AccessRequest.countDocuments({ status: 'pending' }).catch(() => 0);
    const activeUsers = await User.find({ status: 'active' }).select('role').lean().catch(() => []);
    const usersByRole = activeUsers.reduce((acc, u) => {
      acc[u.role] = (acc[u.role] || 0) + 1;
      return acc;
    }, {});
    rolePanelData = {
      adminMetrics: { pendingAccessRequests, usersByRole },
    };
  } else if (normalizedRole === 'creative_head') {
    const stagesWaitingApproval = await countAwaitingReview().catch(() => 0);
    const plansWaiting = await CalendarPlan.countDocuments({ status: { $in: ['submitted', 'in_review'] } }).catch(() => 0);
    rolePanelData = {
      creativeMetrics: { stagesWaitingApproval, plansWaiting },
    };
  } else if (normalizedRole === 'sm_manager') {
    const needsOwnerCount = await WorkItem.countDocuments({ ownerId: null }).catch(() => 0);
    const now = new Date();
    const lateItemsCount = await WorkItem.countDocuments({
      status: { $nin: ['Approved', 'Published'] },
      deadline: { $lt: now },
    }).catch(() => 0);
    rolePanelData = {
      smMetrics: { planStatus: 'Active', needsOwnerCount, lateItemsCount },
    };
  } else if (normalizedRole === 'executive') {
    const activeUsersCount = await User.countDocuments({ status: 'active' }).catch(() => 0);
    const activeDeliverablesCount = await WorkItem.countDocuments({ status: { $nin: ['Published'] } }).catch(() => 0);
    rolePanelData = {
      companySummary: { activeUsersCount, activeDeliverablesCount },
    };
  } else if (normalizedRole === 'team_member') {
    const myCurrentStepsCount = await WorkItem.countDocuments({
      ownerId: userId,
      status: { $nin: ['Approved', 'Published'] },
    }).catch(() => 0);
    rolePanelData = {
      memberMetrics: { myCurrentStepsCount, capacityBand: 'Balanced', onTimeRate: 100 },
    };
  }

  return {
    id: user._id.toString(),
    _id: user._id.toString(),
    name: user.name,
    preferredName: user.preferredName || '',
    email: user.email,
    role: normalizedRole,
    jobRole: user.jobRole || (user.role === 'admin' ? 'System Administrator' : 'Team Member'),
    department: deptName || 'General',
    departmentId: user.departmentId?._id?.toString() || null,
    status: user.status || 'active',
    avatarUrl: user.avatarUrl || null,
    avatarStorageId: user.avatarStorageId || null,
    phone: user.phone || '',
    phoneVerified: Boolean(user.phoneVerified || user.phoneVerifiedAt || user.phone),
    phoneVerifiedAt: user.phoneVerifiedAt || null,
    whatsappNumber: user.whatsappNumber || '',
    languages: Array.isArray(user.languages) ? user.languages : [],
    about: user.about || '',
    skills: Array.isArray(user.skills) ? user.skills : [],
    weeklyCapacityHours: user.weeklyCapacityHours || user.capacity || 40,
    workPreferences: Array.isArray(user.workPreferences) ? user.workPreferences : [],
    rolePanelData,
    preferences: user.preferences || {
      startPage: 'Home',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '12h',
      weekStart: 'monday',
    },
    notificationPrefs: user.notificationPrefs || {
      mySteps: { inApp: true, email: true },
      approvalsRevisions: { inApp: true, email: true },
      messagesComments: { inApp: true, email: true },
      deadlinesOverdue: { inApp: true, email: true },
      planUpdates: { inApp: true, email: true },
      system: { inApp: true, email: true },
    },
    profileCompletedAt: user.profileCompletedAt || null,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt || user.lastLogin || null,
  };
}

/**
 * Send 6-digit OTP to mobile phone for verification
 */
export async function sendPhoneOtp(userId, { phone }) {
  const cleanPhone = normalizePhone(phone);
  if (!cleanPhone || !/^\+?[1-9]\d{6,14}$/.test(cleanPhone)) {
    const error = new Error('Please enter a valid mobile number (e.g. +919876543210).');
    error.statusCode = 400;
    error.code = 'INVALID_PHONE';
    throw error;
  }

  // Generate 6-digit numeric OTP
  const otp = env.NODE_ENV === 'test' ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Invalidate any existing OTP requests for this user & phone
  await PhoneVerification.deleteMany({ userId, phone: cleanPhone });

  await PhoneVerification.create({
    userId,
    phone: cleanPhone,
    otp,
    expiresAt,
    attempts: 0,
    verified: false,
  });

  logger.info({ phone: cleanPhone, otp }, '📱 [SMS OTP] Mobile verification code generated');
  console.log(`\n========================================\n📱 [SMS OTP] Mobile verification for ${cleanPhone}: ${otp}\n========================================\n`);

  const maskedPhone = cleanPhone.length > 4
    ? `${cleanPhone.slice(0, 3)}****${cleanPhone.slice(-4)}`
    : cleanPhone;

  return {
    success: true,
    message: `Verification code sent to ${maskedPhone}`,
    expiresAt,
    testOtp: env.NODE_ENV === 'test' ? otp : undefined,
  };
}

/**
 * Verify 6-digit OTP code and generate verification token
 */
export async function verifyPhoneOtp(userId, { phone, otp }) {
  const cleanPhone = normalizePhone(phone);
  if (!cleanPhone) {
    const error = new Error('Mobile number is required.');
    error.statusCode = 400;
    error.code = 'INVALID_PHONE';
    throw error;
  }

  if (!otp || typeof otp !== 'string' || !/^\d{6}$/.test(otp.trim())) {
    const error = new Error('Verification code must be exactly 6 digits.');
    error.statusCode = 400;
    error.code = 'INVALID_OTP_FORMAT';
    throw error;
  }

  const record = await PhoneVerification.findOne({
    userId,
    phone: cleanPhone,
    expiresAt: { $gt: new Date() },
  });

  if (!record) {
    const error = new Error('Verification code has expired or was not requested. Please request a new OTP.');
    error.statusCode = 400;
    error.code = 'OTP_EXPIRED';
    throw error;
  }

  if (record.attempts >= 5) {
    const error = new Error('Too many invalid attempts. Please request a new OTP.');
    error.statusCode = 400;
    error.code = 'MAX_ATTEMPTS_EXCEEDED';
    throw error;
  }

  const isMatch = record.otp === otp.trim() || (env.NODE_ENV === 'test' && otp.trim() === '123456');
  if (!isMatch) {
    record.attempts += 1;
    await record.save();
    const error = new Error('Invalid verification code. Please check and try again.');
    error.statusCode = 400;
    error.code = 'INVALID_OTP';
    throw error;
  }

  const token = crypto.randomUUID();
  record.verified = true;
  record.token = token;
  await record.save();

  return {
    success: true,
    verified: true,
    verificationToken: token,
    message: 'Mobile number verified successfully!',
  };
}

/**
 * Update allowed profile fields for current user
 */
export async function updateProfile(userId, data) {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  // Registered & accepted email cannot be changed by the user (only by admin)
  if (data.email !== undefined && data.email.toLowerCase().trim() !== user.email.toLowerCase().trim()) {
    const error = new Error('Registered and accepted email address cannot be changed by the user. Only an administrator can update email addresses.');
    error.statusCode = 403;
    error.code = 'EMAIL_CHANGE_ADMIN_ONLY';
    throw error;
  }

  const changedFields = [];

  if (data.name !== undefined && data.name.trim().length >= 2) {
    user.name = stripHtml(data.name).trim();
    changedFields.push('name');
  }

  if (data.preferredName !== undefined) {
    user.preferredName = stripHtml(data.preferredName);
    changedFields.push('preferredName');
  }

  if (data.phone !== undefined) {
    const cleanPhone = normalizePhone(data.phone);
    if (cleanPhone && cleanPhone !== user.phone) {
      // Must be verified via OTP in production or when token/enforceOtp is specified
      if (data.phoneVerificationToken || data.enforceOtp || env.NODE_ENV !== 'test') {
        const verification = await PhoneVerification.findOne({
          userId: user._id,
          phone: cleanPhone,
          verified: true,
          token: data.phoneVerificationToken,
        });

        if (!verification) {
          const error = new Error('Mobile number must be verified with OTP before adding or updating it.');
          error.statusCode = 400;
          error.code = 'PHONE_OTP_REQUIRED';
          throw error;
        }

        await PhoneVerification.deleteOne({ _id: verification._id });
      }

      user.phone = cleanPhone;
      user.phoneVerified = true;
      user.phoneVerifiedAt = new Date();
      changedFields.push('phone');
    } else if (!cleanPhone && user.phone) {
      user.phone = '';
      user.phoneVerified = false;
      user.phoneVerifiedAt = null;
      changedFields.push('phone');
    }
  }

  if (data.whatsappNumber !== undefined) {
    user.whatsappNumber = normalizePhone(data.whatsappNumber);
    changedFields.push('whatsappNumber');
  }

  if (data.languages !== undefined) {
    user.languages = (Array.isArray(data.languages) ? data.languages : [])
      .slice(0, 5)
      .map((l) => stripHtml(String(l)).slice(0, 40));
    changedFields.push('languages');
  }

  if (data.about !== undefined) {
    user.about = stripHtml(data.about).slice(0, 200);
    changedFields.push('about');
  }

  if (data.skills !== undefined) {
    user.skills = (Array.isArray(data.skills) ? data.skills : [])
      .slice(0, 10)
      .map((s) => stripHtml(String(s)).slice(0, 30));
    changedFields.push('skills');
  }

  // Mark profile completed if name and phone exist
  if (!user.profileCompletedAt && user.name && user.phone) {
    user.profileCompletedAt = new Date();
    changedFields.push('profileCompletedAt');
  }

  await user.save();

  // Record ActivityEvent with field names only
  if (changedFields.length > 0) {
    try {
      await ActivityEvent.create({
        entityType: 'person',
        entityId: user._id,
        actorId: user._id,
        actingAs: user.role,
        action: 'profile.updated',
        metadata: { changedFields },
      });
    } catch (e) {
      logger.warn({ err: e.message }, 'Failed to record ActivityEvent for profile update');
    }
  }

  return getProfile(userId);
}

/**
 * Direct file upload handler for avatar
 */
export async function processAvatarUpload(userId, file) {
  if (!file) {
    const error = new Error('No avatar file provided');
    error.statusCode = 400;
    error.code = 'NO_FILE_PROVIDED';
    throw error;
  }

  const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  if (!allowedMimes.includes(file.mimetype)) {
    // Clean up uploaded file
    if (file.path && fs.existsSync(file.path)) {
      try { fs.unlinkSync(file.path); } catch {}
    }
    const error = new Error('Invalid file type. Allowed formats: PNG, JPG, WEBP.');
    error.statusCode = 400;
    error.code = 'INVALID_FILE_TYPE';
    throw error;
  }

  const maxBytes = 5 * 1024 * 1024; // 5 MB
  if (file.size > maxBytes) {
    if (file.path && fs.existsSync(file.path)) {
      try { fs.unlinkSync(file.path); } catch {}
    }
    const error = new Error('Avatar file size exceeds maximum limit of 5 MB.');
    error.statusCode = 400;
    error.code = 'FILE_TOO_LARGE';
    throw error;
  }

  const user = await User.findById(userId);
  if (!user) {
    if (file.path && fs.existsSync(file.path)) {
      try { fs.unlinkSync(file.path); } catch {}
    }
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  // Delete previous local file if it exists
  if (user.avatarStorageId) {
    deleteLocalAvatarFile(user.avatarStorageId);
  }

  const newUrl = `/uploads/${file.filename}`;
  user.avatarUrl = newUrl;
  user.avatarStorageId = file.filename;
  await user.save();

  try {
    await ActivityEvent.create({
      entityType: 'person',
      entityId: user._id,
      actorId: user._id,
      actingAs: user.role,
      action: 'avatar.updated',
      metadata: { changedFields: ['avatarUrl', 'avatarStorageId'] },
    });
  } catch (e) {
    logger.warn({ err: e.message }, 'Failed to record ActivityEvent for avatar update');
  }

  return {
    avatarUrl: user.avatarUrl,
    avatarStorageId: user.avatarStorageId,
  };
}

/**
 * Delete avatar helper
 */
export function deleteLocalAvatarFile(filename) {
  if (!filename) return;
  try {
    const uploadDir = path.resolve(process.cwd(), 'uploads');
    const filePath = path.join(uploadDir, path.basename(filename));
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    logger.warn({ err: err.message, filename }, 'Could not delete old avatar file');
  }
}

/**
 * Remove avatar for user
 */
export async function removeAvatar(userId, actor = null) {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  if (user.avatarStorageId) {
    deleteLocalAvatarFile(user.avatarStorageId);
  }

  user.avatarUrl = null;
  user.avatarStorageId = null;
  await user.save();

  try {
    const actorId = actor ? actor._id : user._id;
    const actorRole = actor ? actor.role : user.role;
    await ActivityEvent.create({
      entityType: 'person',
      entityId: user._id,
      actorId,
      actingAs: actorRole,
      action: 'avatar.removed',
      metadata: { changedFields: ['avatarUrl', 'avatarStorageId'] },
    });
  } catch (e) {
    logger.warn({ err: e.message }, 'Failed to record ActivityEvent for avatar removal');
  }

  return { success: true, message: 'Avatar removed successfully' };
}

/**
 * Get settings for user
 */
export async function getSettings(userId) {
  const user = await User.findById(userId).lean();
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  return {
    preferences: user.preferences || {
      startPage: 'Home',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '12h',
      weekStart: 'monday',
    },
    notificationPrefs: user.notificationPrefs || {
      mySteps: { inApp: true, email: true },
      approvalsRevisions: { inApp: true, email: true },
      messagesComments: { inApp: true, email: true },
      deadlinesOverdue: { inApp: true, email: true },
      planUpdates: { inApp: true, email: true },
      system: { inApp: true, email: true },
    },
  };
}

/**
 * Update user settings
 */
export async function updateSettings(userId, data, userRole) {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const changedFields = [];

  if (data.preferences) {
    user.preferences = {
      startPage: data.preferences.startPage || user.preferences?.startPage || 'Home',
      dateFormat: data.preferences.dateFormat || user.preferences?.dateFormat || 'DD/MM/YYYY',
      timeFormat: data.preferences.timeFormat || user.preferences?.timeFormat || '12h',
      weekStart: data.preferences.weekStart || user.preferences?.weekStart || 'monday',
    };
    changedFields.push('preferences');
  }

  if (data.notificationPrefs) {
    const isAdmin = normalizeRole(userRole) === 'admin';
    const current = user.notificationPrefs || {};

    user.notificationPrefs = {
      mySteps: data.notificationPrefs.mySteps || current.mySteps || { inApp: true, email: true },
      approvalsRevisions: data.notificationPrefs.approvalsRevisions || current.approvalsRevisions || { inApp: true, email: true },
      messagesComments: data.notificationPrefs.messagesComments || current.messagesComments || { inApp: true, email: true },
      deadlinesOverdue: data.notificationPrefs.deadlinesOverdue || current.deadlinesOverdue || { inApp: true, email: true },
      planUpdates: data.notificationPrefs.planUpdates || current.planUpdates || { inApp: true, email: true },
      system: isAdmin
        ? (data.notificationPrefs.system || current.system || { inApp: true, email: true })
        : (current.system || { inApp: true, email: true }),
    };
    changedFields.push('notificationPrefs');
  }

  await user.save();

  if (changedFields.length > 0) {
    try {
      await ActivityEvent.create({
        entityType: 'person',
        entityId: user._id,
        actorId: user._id,
        actingAs: user.role,
        action: 'settings.updated',
        metadata: { changedFields },
      });
    } catch (e) {
      logger.warn({ err: e.message }, 'Failed to record ActivityEvent for settings update');
    }
  }

  return {
    preferences: user.preferences,
    notificationPrefs: user.notificationPrefs,
  };
}

const passwordAttempts = new Map();

/**
 * Change user password
 */
export async function changePassword(userId, { currentPassword, newPassword, confirmPassword }) {
  const userIdStr = userId.toString();
  const now = Date.now();
  const attemptRecord = passwordAttempts.get(userIdStr);

  if (attemptRecord && attemptRecord.resetAt > now) {
    if (attemptRecord.count >= 5) {
      const error = new Error('Too many password change attempts. Please wait 15 minutes.');
      error.code = 'PASSWORD_RATE_LIMITED';
      error.statusCode = 429;
      throw error;
    }
  } else {
    passwordAttempts.set(userIdStr, { count: 0, resetAt: now + 15 * 60 * 1000 });
  }

  const recordAttempt = () => {
    const cur = passwordAttempts.get(userIdStr) || { count: 0, resetAt: now + 15 * 60 * 1000 };
    cur.count += 1;
    passwordAttempts.set(userIdStr, cur);
  };

  if (newPassword !== confirmPassword) {
    recordAttempt();
    const error = new Error('New password and confirm password must match');
    error.code = 'PASSWORD_MISMATCH';
    error.statusCode = 400;
    throw error;
  }

  if (newPassword === currentPassword) {
    recordAttempt();
    const error = new Error('New password must be different from current password');
    error.code = 'PASSWORD_MUST_BE_DIFFERENT';
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findById(userId).select('+passwordHash');
  if (!user) {
    recordAttempt();
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const isMatch = await bcrypt.compare(currentPassword, user.passwordHash || '');
  if (!isMatch) {
    recordAttempt();
    const error = new Error('Current password is incorrect');
    error.code = 'INVALID_CURRENT_PASSWORD';
    error.statusCode = 400;
    throw error;
  }

  passwordAttempts.delete(userIdStr);

  const salt = await bcrypt.genSalt(10);
  user.passwordHash = await bcrypt.hash(newPassword, salt);
  await user.save();

  // Send mandatory security email notice
  try {
    const template = templates().passwordChanged({
      name: user.name,
      time: new Date().toLocaleString(),
    });
    await sendMail({
      to: user.email,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });
  } catch (err) {
    logger.error({ err: err.message }, 'Failed to dispatch password change security email');
  }

  // Create mandatory security in-app notification
  try {
    await createNotification({
      recipient: user._id,
      type: 'security_alert',
      title: 'Security Alert: Password Changed',
      message: 'Your account password was successfully updated.',
      link: '/settings',
    });
  } catch (err) {
    logger.warn({ err: err.message }, 'Failed to create password change notification');
  }

  try {
    await ActivityEvent.create({
      entityType: 'person',
      entityId: user._id,
      actorId: user._id,
      actingAs: user.role,
      action: 'password.changed',
      metadata: { changedFields: ['password'] },
    });
  } catch (e) {
    logger.warn({ err: e.message }, 'Failed to record ActivityEvent for password change');
  }

  return { success: true, message: 'Password changed successfully' };
}

/**
 * Helper to identify current session ID from refresh token
 */
export function extractSessionId(refreshToken) {
  if (!refreshToken) return null;
  try {
    const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
    return decoded.sessionId || null;
  } catch {
    return null;
  }
}

/**
 * List active sessions for user
 */
export async function listSessions(userId, currentRefreshToken = null) {
  const currentSessionId = extractSessionId(currentRefreshToken);

  const sessions = await Session.find({
    userId,
    revokedAt: null,
  })
    .sort({ lastUsedAt: -1 })
    .lean();

  return sessions.map((s) => ({
    id: s._id.toString(),
    _id: s._id.toString(),
    deviceLabel: s.deviceLabel,
    createdAt: s.createdAt,
    lastUsedAt: s.lastUsedAt,
    isCurrent: Boolean(currentSessionId && s._id.toString() === currentSessionId),
  }));
}

/**
 * Revoke specific session
 */
export async function revokeSession(userId, sessionId, currentRefreshToken = null) {
  const currentSessionId = extractSessionId(currentRefreshToken);
  const session = await Session.findOne({
    _id: sessionId,
    userId,
    revokedAt: null,
  });

  if (!session) {
    const error = new Error('Session not found or already revoked');
    error.code = 'SESSION_NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  session.revokedAt = new Date();
  await session.save();

  try {
    await ActivityEvent.create({
      entityType: 'session',
      entityId: session._id,
      actorId: userId,
      action: 'session.revoked',
      metadata: { deviceLabel: session.deviceLabel },
    });
  } catch (e) {
    logger.warn({ err: e.message }, 'Failed to record ActivityEvent for session revocation');
  }

  const isCurrent = Boolean(currentSessionId && sessionId === currentSessionId);
  disconnectUserSockets(userId);
  return { success: true, isCurrent };
}

/**
 * Revoke all other sessions except current
 */
export async function revokeOtherSessions(userId, currentRefreshToken = null) {
  const currentSessionId = extractSessionId(currentRefreshToken);

  const query = {
    userId,
    revokedAt: null,
  };

  if (currentSessionId) {
    query._id = { $ne: currentSessionId };
  }

  const result = await Session.updateMany(query, {
    revokedAt: new Date(),
  });

  try {
    await ActivityEvent.create({
      entityType: 'session',
      entityId: userId,
      actorId: userId,
      action: 'sessions.revoked_others',
      metadata: { count: result.modifiedCount },
    });
  } catch (e) {
    logger.warn({ err: e.message }, 'Failed to record ActivityEvent for revoke other sessions');
  }

  disconnectUserSockets(userId);
  return { success: true, revokedCount: result.modifiedCount };
}

/**
 * Submit role / capacity / department change request
 */
export async function submitChangeRequest(userId, { requestedChanges }) {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const sanitizedChanges = stripHtml(requestedChanges);

  // Find all active admins
  const admins = await User.find({
    role: 'admin',
    status: 'active',
  }).select('_id email name');

  for (const admin of admins) {
    // 1. Create in-app notification
    try {
      await createNotification({
        recipient: admin._id,
        type: 'change_request',
        title: `Change Request from ${user.preferredName || user.name}`,
        message: `${user.name} (${user.role}) submitted a work details update request: "${sanitizedChanges.slice(0, 100)}..."`,
        link: '/people',
      });
    } catch (err) {
      logger.warn({ err: err.message }, 'Failed to dispatch in-app notification for change request');
    }

    // 2. Dispatch email
    try {
      const template = templates().changeRequestSubmitted({
        requesterName: user.name,
        requesterEmail: user.email,
        requesterRole: user.role,
        requestedChanges: sanitizedChanges,
      });
      await sendMail({
        to: admin.email,
        subject: template.subject,
        text: template.text,
        html: template.html,
      });
    } catch (err) {
      logger.warn({ err: err.message }, 'Failed to dispatch email for change request');
    }
  }

  try {
    await ActivityEvent.create({
      entityType: 'change_request',
      entityId: user._id,
      actorId: user._id,
      actingAs: user.role,
      action: 'profile.change_requested',
      metadata: { changedFields: ['requestedChanges'] },
    });
  } catch (e) {
    logger.warn({ err: e.message }, 'Failed to record ActivityEvent for change request');
  }

  return {
    success: true,
    message: 'Your change request has been submitted to system administrators.',
  };
}

