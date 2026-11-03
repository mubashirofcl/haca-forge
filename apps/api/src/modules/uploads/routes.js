import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { authenticate } from '../../middleware/auth.js';
import { requireAnyPermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { signUploadSchema } from '@mmp/shared';
import * as uploadController from './controller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.resolve(__dirname, '../../../uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${safeBase}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB max
});

const router = Router();

router.use(authenticate);

// Multipart direct local file upload endpoint
router.post(
  '/file',
  requireAnyPermission('work.create', 'work.request', 'work.update.own'),
  upload.single('file'),
  uploadController.localUploadHandler
);

router.post(
  '/',
  requireAnyPermission('work.create', 'work.request', 'work.update.own'),
  upload.single('file'),
  uploadController.localUploadHandler
);

router.post(
  '/sign',
  requireAnyPermission('work.create', 'work.request', 'work.update.own'),
  validate(signUploadSchema),
  uploadController.signUploadHandler
);

router.post(
  '/metadata',
  requireAnyPermission('work.create', 'work.request', 'work.update.own'),
  uploadController.recordMetadataHandler
);

export default router;

