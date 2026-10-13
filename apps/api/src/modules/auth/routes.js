import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import { loginSchema, setPasswordSchema, requestAccessSchema } from '@mmp/shared';
import * as authController from './controller.js';
import * as accessController from '../access/controller.js';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts. Please try again after 15 minutes.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

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

export default router;
