import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { User } from "../people/model.js";
import { AccessRequest } from "../access/model.js";
import { ROLE_PERMISSIONS, normalizeRole } from "@mmp/shared";
import { sendMail, templates } from "../../lib/mailer.js";

function generateTokens(user) {
  const role = normalizeRole(user.role);
  const payload = {
    userId: user._id.toString(),
    role,
    email: user.email,
  };

  const accessToken = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });

  const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  });

  return { accessToken, refreshToken };
}

export async function loginUser({ email, password }) {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail }).select(
    "+passwordHash",
  );

  if (!user) {
    // Check if an access request exists for clearer status feedback
    const accessReq = await AccessRequest.findOne({
      email: normalizedEmail,
    }).sort({ createdAt: -1 });
    if (accessReq) {
      if (accessReq.status === "pending") {
        const error = new Error(
          "Your access request is currently under review by the administrator.",
        );
        error.code = "ACCESS_REQUEST_PENDING";
        error.statusCode = 403;
        throw error;
      }
      if (accessReq.status === "rejected") {
        const error = new Error(
          `Your access request was rejected: ${accessReq.rejectReason || "No reason provided"}`,
        );
        error.code = "ACCESS_REQUEST_REJECTED";
        error.statusCode = 403;
        throw error;
      }
      if (accessReq.status === "info_needed") {
        const error = new Error(
          "The administrator requested additional information before approving your access request.",
        );
        error.code = "ACCESS_REQUEST_INFO_NEEDED";
        error.statusCode = 403;
        throw error;
      }
    }

    const error = new Error("Invalid email or password");
    error.code = "INVALID_CREDENTIALS";
    error.statusCode = 401;
    throw error;
  }

  if (user.status === "suspended") {
    const error = new Error(
      "Your account has been suspended by the administrator.",
    );
    error.code = "ACCOUNT_SUSPENDED";
    error.statusCode = 403;
    throw error;
  }

  if (user.mustSetPassword) {
    const error = new Error(
      "Please set your password using the activation link sent to your email.",
    );
    error.code = "PASSWORD_RESET_REQUIRED";
    error.statusCode = 403;
    throw error;
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash || "");
  if (!isMatch) {
    const error = new Error("Invalid email or password");
    error.code = "INVALID_CREDENTIALS";
    error.statusCode = 401;
    throw error;
  }

  const { accessToken, refreshToken } = generateTokens(user);

  // Store hashed refresh token
  const refreshTokenHash = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");
  user.refreshTokenHash = refreshTokenHash;
  user.lastLogin = new Date();
  await user.save();

  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: normalizeRole(user.role),
      jobRole: user.jobRole,
      department: user.department,
      departmentId: user.departmentId,
      profileAccess: user.profileAccess || [],
      reportsToIds: user.reportsToIds || [],
      weeklyCapacityHours: user.weeklyCapacityHours || user.capacity || 40,
      lastProfileId: user.lastProfileId,
      status: user.status,
      workPreferences: user.workPreferences || [],
    },
    permissions: ROLE_PERMISSIONS[normalizeRole(user.role)] || [],
    accessToken,
    refreshToken,
  };
}

export async function refreshTokens(refreshToken) {
  if (!refreshToken) {
    const error = new Error("Refresh token is required");
    error.code = "REFRESH_TOKEN_REQUIRED";
    error.statusCode = 401;
    throw error;
  }

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
  } catch (_err) {
    const error = new Error("Invalid or expired refresh token");
    error.code = "INVALID_REFRESH_TOKEN";
    error.statusCode = 401;
    throw error;
  }

  const user = await User.findById(decoded.userId).select("+refreshTokenHash");
  if (!user || user.status === "suspended") {
    const error = new Error("User not found or account is suspended");
    error.code = "UNAUTHORIZED";
    error.statusCode = 401;
    throw error;
  }

  const tokenHash = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");
  if (user.refreshTokenHash !== tokenHash) {
    const error = new Error("Refresh token has been revoked or rotated");
    error.code = "REVOKED_REFRESH_TOKEN";
    error.statusCode = 401;
    throw error;
  }

  const newTokens = generateTokens(user);
  user.refreshTokenHash = crypto
    .createHash("sha256")
    .update(newTokens.refreshToken)
    .digest("hex");
  await user.save();

  return {
    accessToken: newTokens.accessToken,
    refreshToken: newTokens.refreshToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: normalizeRole(user.role),
      jobRole: user.jobRole,
      department: user.department,
      departmentId: user.departmentId,
      profileAccess: user.profileAccess || [],
      reportsToIds: user.reportsToIds || [],
      weeklyCapacityHours: user.weeklyCapacityHours || user.capacity || 40,
      lastProfileId: user.lastProfileId,
      status: user.status,
      workPreferences: user.workPreferences || [],
    },
    permissions: ROLE_PERMISSIONS[normalizeRole(user.role)] || [],
  };
}

export async function setPasswordWithToken({ token, password }) {
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  // 1. Check if token matches a direct User reset token
  let user = await User.findOne({
    resetPasswordTokenHash: tokenHash,
    resetPasswordExpiresAt: { $gt: new Date() },
  });

  if (user) {
    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(password, salt);
    user.mustSetPassword = false;
    user.resetPasswordTokenHash = undefined;
    user.resetPasswordExpiresAt = undefined;
    await user.save();
    return { success: true, email: user.email };
  }

  // 2. Check if token matches an initial AccessRequest invite
  const accessRequest = await AccessRequest.findOne({
    inviteTokenHash: tokenHash,
    inviteExpiresAt: { $gt: new Date() },
    status: "approved",
  });

  if (!accessRequest) {
    const error = new Error(
      "Invite or reset token is invalid or has expired (valid for 48 hours). Please request a new link.",
    );
    error.code = "INVALID_OR_EXPIRED_TOKEN";
    error.statusCode = 400;
    throw error;
  }

  user = await User.findOne({ email: accessRequest.email });
  if (!user) {
    const error = new Error("User account not found for this invite.");
    error.code = "USER_NOT_FOUND";
    error.statusCode = 404;
    throw error;
  }

  const salt = await bcrypt.genSalt(10);
  user.passwordHash = await bcrypt.hash(password, salt);
  user.mustSetPassword = false;
  await user.save();

  // Invalidate token
  accessRequest.inviteTokenHash = null;
  await accessRequest.save();

  return { success: true, email: user.email };
}

export async function requestPasswordReset(email) {
  const normalizedEmail = (email || "").toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user || user.status === "suspended") {
    // Return success to avoid email enumeration
    return {
      success: true,
      message:
        "If an active account exists with that email, a password reset link has been dispatched.",
    };
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h

  user.resetPasswordTokenHash = tokenHash;
  user.resetPasswordExpiresAt = expiresAt;
  await user.save();

  const resetUrl = `${env.FRONTEND_URL}/set-password?token=${rawToken}`;

  const template = templates().inviteUser({
    name: user.name,
    email: user.email,
    inviteUrl: resetUrl,
  });

  await sendMail({
    to: user.email,
    subject: "HACA FORGE - Password Reset Request",
    text: `Hello ${user.name},\n\nA password reset was requested for your account. Please click the following link to set your password (valid for 48 hours):\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: template.html,
  }).catch(() => {});

  return {
    success: true,
    message:
      "If an active account exists with that email, a password reset link has been dispatched.",
    resetLink: env.NODE_ENV === "development" ? resetUrl : undefined,
  };
}

export async function changeUserPassword(
  userId,
  { currentPassword, newPassword },
) {
  const user = await User.findById(userId).select("+passwordHash");
  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  const isMatch = await bcrypt.compare(
    currentPassword,
    user.passwordHash || "",
  );
  if (!isMatch) {
    const error = new Error("Current password is incorrect");
    error.code = "INVALID_CURRENT_PASSWORD";
    error.statusCode = 400;
    throw error;
  }

  const salt = await bcrypt.genSalt(10);
  user.passwordHash = await bcrypt.hash(newPassword, salt);
  await user.save();

  return { success: true, message: "Password changed successfully" };
}
