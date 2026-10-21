import { env } from '../../config/env.js';
import * as authService from './service.js';
import { User } from '../users/model.js';
import { ROLE_PERMISSIONS, normalizeRole } from '@mmp/shared';

function getCookieOptions(maxAgeMs) {
  const isProd = env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    domain: env.COOKIE_DOMAIN || undefined,
    maxAge: maxAgeMs,
    path: '/',
  };
}

export async function login(req, res, next) {
  try {
    const result = await authService.loginUser(req.body);

    res.cookie('accessToken', result.accessToken, getCookieOptions(15 * 60 * 1000)); // 15 mins
    res.cookie('refreshToken', result.refreshToken, getCookieOptions(7 * 24 * 60 * 60 * 1000)); // 7 days

    return res.status(200).json({
      user: result.user,
      permissions: result.permissions,
      accessToken: result.accessToken, // Optional fallback for clients
    });
  } catch (error) {
    next(error);
  }
}

export async function refresh(req, res, next) {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    const result = await authService.refreshTokens(token);

    res.cookie('accessToken', result.accessToken, getCookieOptions(15 * 60 * 1000));
    res.cookie('refreshToken', result.refreshToken, getCookieOptions(7 * 24 * 60 * 60 * 1000));

    return res.status(200).json({
      user: result.user,
      permissions: result.permissions,
      accessToken: result.accessToken,
    });
  } catch (error) {
    next(error);
  }
}

export async function logout(req, res, next) {
  try {
    if (req.user) {
      await User.findByIdAndUpdate(req.user._id, { $unset: { refreshTokenHash: 1 } });
    }

    const clearOptions = {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
      domain: env.COOKIE_DOMAIN || undefined,
      path: '/',
    };

    res.clearCookie('accessToken', clearOptions);
    res.clearCookie('refreshToken', clearOptions);

    return res.status(200).json({ success: true, message: 'Logged out successfully' });
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
        profileAccess: req.user.profileAccess || [],
        reportsToIds: req.user.reportsToIds || [],
        weeklyCapacityHours: req.user.weeklyCapacityHours || req.user.capacity || 40,
        lastProfileId: req.user.lastProfileId,
        status: req.user.status,
      },
      role: normalizeRole(req.user.role),
      permissions: ROLE_PERMISSIONS[normalizeRole(req.user.role)] || [],
    });
  } catch (error) {
    next(error);
  }
}

export async function setPassword(req, res, next) {
  try {
    const result = await authService.setPasswordWithToken(req.body);
    return res.status(200).json({
      success: true,
      message: 'Password set successfully. You may now sign in with your credentials.',
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

