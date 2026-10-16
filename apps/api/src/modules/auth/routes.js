import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import { loginSchema, setPasswordSchema, requestAccessSchema } from '@mmp/shared';
import * as authController from './controller.js';
import * as accessController from '../access/controller.js';

import { env } from '../../config/env.js';

// Login rate limiter: enforces 10 attempts per 15 minutes in production
const authLimiter =
  env.NODE_ENV === 'production'
    ? rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 10,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many login attempts. Please try again after 15 minutes.',
          },
        },
      })
    : (_req, _res, next) => next();

const requestAccessLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 requests per hour
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many access requests from this IP. Please try again later.',
    },
  },
});

const router = Router();

router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.me);
router.post('/request-access', requestAccessLimiter, validate(requestAccessSchema), accessController.submitRequest);
router.post('/set-password', validate(setPasswordSchema), authController.setPassword);
router.post('/forgot-password', authController.forgotPassword);

export default router;
