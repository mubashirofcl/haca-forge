import jwt from 'jsonwebtoken';
import { normalizeRole } from '@mmp/shared';
import { env } from '../config/env.js';
import { User } from '../modules/users/model.js';
import { defineAbilityForUser } from '../lib/permissions.js';

export async function authenticate(req, res, next) {
  try {
    const token =
      req.cookies?.accessToken ||
      req.cookies?.token ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.split(' ')[1]
        : null);

    if (!token) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication token is missing. Please sign in.',
        },
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET);
      if (decoded.role) {
        decoded.role = normalizeRole(decoded.role);
      }
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'Session has expired. Please refresh your token or log in again.',
          },
        });
      }
      return res.status(401).json({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Session token is invalid.',
        },
      });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User account associated with this token does not exist.',
        },
      });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({
        error: {
          code: 'ACCOUNT_SUSPENDED',
          message: 'Your account has been suspended. Please contact the administrator.',
        },
      });
    }

    if (user.role) {
      user.role = normalizeRole(user.role);
    }

    req.user = user;
    req.user.userId = user._id.toString();
    req.ability = defineAbilityForUser(user);
    next();
  } catch (error) {
    next(error);
  }
}
