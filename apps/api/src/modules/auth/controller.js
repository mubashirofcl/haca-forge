import { env } from "../../config/env.js";
import * as authService from "./service.js";
import { User } from "../people/model.js";
import { ROLE_PERMISSIONS, normalizeRole } from "@mmp/shared";

function getCookieOptions(maxAgeMs) {
  const isProd = env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    domain: env.COOKIE_DOMAIN || undefined,
    maxAge: maxAgeMs,
    path: "/",
  };
}

export async function login(req, res, next) {
  try {
    const result = await authService.loginUser({
      ...req.body,
      userAgent: req.headers['user-agent'] || '',
      ip: req.ip || req.socket?.remoteAddress || '',
    });

    res.cookie(
      "accessToken",
      result.accessToken,
      getCookieOptions(15 * 60 * 1000),
    ); // 15 mins
    res.cookie(
      "refreshToken",
      result.refreshToken,
      getCookieOptions(7 * 24 * 60 * 60 * 1000),
    ); // 7 days

    return res.status(200).json({
      user: result.user,
      permissions: result.permissions,
      accessToken: result.accessToken, // Optional fallback for clients
      refreshToken: result.refreshToken,
    });
  } catch (error) {
    next(error);
  }
}

export async function refresh(req, res, next) {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    const result = await authService.refreshTokens(token);

    res.cookie(
      "accessToken",
      result.accessToken,
      getCookieOptions(15 * 60 * 1000),
    );
    res.cookie(
      "refreshToken",
      result.refreshToken,
      getCookieOptions(7 * 24 * 60 * 60 * 1000),
    );

    return res.status(200).json({
      user: result.user,
      permissions: result.permissions,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (error) {
    next(error);
  }
}

export async function logout(req, res, next) {
  try {
    if (req.user) {
      await User.findByIdAndUpdate(req.user._id, {
        $unset: { refreshTokenHash: 1 },
      });
    }

    const clearOptions = {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      domain: env.COOKIE_DOMAIN || undefined,
      path: "/",
    };

    res.clearCookie("accessToken", clearOptions);
    res.clearCookie("refreshToken", clearOptions);

    return res
      .status(200)
      .json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    next(error);
  }
}

export async function me(req, res, next) {
  try {
    return res.status(200).json({
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: normalizeRole(req.user.role),
        jobRole: req.user.jobRole,
        department: req.user.department,
        departmentId: req.user.departmentId,
        reportsToIds: req.user.reportsToIds || [],
        weeklyCapacityHours:
          req.user.weeklyCapacityHours || req.user.capacity || 40,
        status: req.user.status,
        workPreferences: req.user.workPreferences || [],
        avatarUrl: req.user.avatarUrl || null,
        avatarStorageId: req.user.avatarStorageId || null,
        preferredName: req.user.preferredName || '',
        phone: req.user.phone || '',
        whatsappNumber: req.user.whatsappNumber || '',
        languages: req.user.languages || [],
        about: req.user.about || '',
        skills: req.user.skills || [],
        preferences: req.user.preferences || {
          startPage: 'Home',
          dateFormat: 'DD/MM/YYYY',
          timeFormat: '12h',
          weekStart: 'monday',
        },
        notificationPrefs: req.user.notificationPrefs || {
          mySteps: { inApp: true, email: true },
          approvalsRevisions: { inApp: true, email: true },
          messagesComments: { inApp: true, email: true },
          deadlinesOverdue: { inApp: true, email: true },
          planUpdates: { inApp: true, email: true },
          system: { inApp: true, email: true },
        },
        profileCompletedAt: req.user.profileCompletedAt || null,
        lastLoginAt: req.user.lastLoginAt || req.user.lastLogin || null,
        createdAt: req.user.createdAt,
      },
      role: normalizeRole(req.user.role),
      permissions: ROLE_PERMISSIONS[normalizeRole(req.user.role)] || [],
    });
  } catch (error) {
    next(error);
  }
}

export async function verifyToken(req, res, next) {
  try {
    const token = req.query.token || req.body?.token;
    const result = await authService.verifyPasswordToken(token);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function setPassword(req, res, next) {
  try {
    const result = await authService.setPasswordWithToken(req.body);
    return res.status(200).json({
      success: true,
      message:
        "Password set successfully. You may now sign in with your credentials.",
      email: result.email,
    });
  } catch (error) {
    next(error);
  }
}

export async function forgotPassword(req, res, next) {
  try {
    const result = await authService.requestPasswordReset(req.body.email);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function changePassword(req, res, next) {
  try {
    const result = await authService.changeUserPassword(req.user._id, req.body);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
