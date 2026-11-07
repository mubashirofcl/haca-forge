import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  profileUpdateSchema,
  sendPhoneOtpSchema,
  verifyPhoneOtpSchema,
  settingsUpdateSchema,
  changePasswordStrictSchema,
  changeRequestSchema,
  welcomeCompleteSchema,
  signUploadSchema,
} from '@mmp/shared';
import * as profileController from './controller.js';
import { allowedFileFilter, storedFileName } from '../uploads/fileTypes.js';
import { env } from '../../config/env.js';

const uploadDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  // Random name with the server's extension for the matched image type.
  filename: (_req, file, cb) => {
    try {
      cb(null, storedFileName(file, 'avatar-'));
    } catch (err) {
      cb(err);
    }
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: allowedFileFilter(['image']),
});

// Password rate limiter: 5 attempts per 15 minutes
const passwordLimiter = env.NODE_ENV === 'test'
  ? (_req, _res, next) => next()
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 5,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many password update attempts. Please try again after 15 minutes.',
        },
      },
    });

const router = Router();

// All routes require authentication
router.use(authenticate);

// Profile
router.get('/profile', profileController.getProfileHandler);
router.patch('/profile', validate(profileUpdateSchema), profileController.updateProfileHandler);

// Phone OTP Verification
router.post('/phone-otp/send', validate(sendPhoneOtpSchema), profileController.sendPhoneOtpHandler);
router.post('/phone-otp/verify', validate(verifyPhoneOtpSchema), profileController.verifyPhoneOtpHandler);

// Avatar
router.post('/avatar/sign', validate(signUploadSchema), profileController.signAvatarHandler);
router.post(
  '/avatar',
  upload.fields([{ name: 'file', maxCount: 1 }, { name: 'avatar', maxCount: 1 }]),
  profileController.uploadAvatarHandler
);
router.delete('/avatar', profileController.deleteAvatarHandler);

// Settings
router.get('/settings', profileController.getSettingsHandler);
router.patch('/settings', validate(settingsUpdateSchema), profileController.updateSettingsHandler);

// Password
router.post('/password', passwordLimiter, validate(changePasswordStrictSchema), profileController.changePasswordHandler);

// Sessions
router.get('/sessions', profileController.listSessionsHandler);
router.delete('/sessions/:id', profileController.revokeSessionHandler);
router.post('/sessions/revoke-others', profileController.revokeOthersHandler);

// Change Request
router.post('/change-request', validate(changeRequestSchema), profileController.submitChangeRequestHandler);

// Welcome Step Completion
router.post('/welcome', validate(welcomeCompleteSchema), profileController.completeWelcomeHandler);

export default router;

