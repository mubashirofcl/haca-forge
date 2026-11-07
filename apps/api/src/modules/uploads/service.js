import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { allowedFileType, fileTypeError } from './fileTypes.js';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../../config/env.js';
import {
  UPLOAD_KINDS,
  UPLOAD_LIMITS_BYTES,
  UPLOAD_ALLOWED_MIME_TYPES,
  UPLOAD_ALLOWED_EXTENSIONS,
} from '@mmp/shared';

/**
 * Normalizes and validates the upload kind and file extension / MIME type
 */
function resolveUploadKind({ kind, fileType, fileName, deliverableType }) {
  const mimeOrType = (fileType || deliverableType || '').toLowerCase();
  const ext = fileName ? path.extname(fileName).toLowerCase() : '';

  if (kind && UPLOAD_KINDS.includes(kind)) {
    return kind;
  }

  // Derive kind from MIME or extension
  if (
    mimeOrType.includes('video') ||
    UPLOAD_ALLOWED_EXTENSIONS.video.includes(ext) ||
    UPLOAD_ALLOWED_MIME_TYPES.video.includes(mimeOrType)
  ) {
    return 'video';
  }

  if (
    mimeOrType.includes('image') ||
    UPLOAD_ALLOWED_EXTENSIONS.image.includes(ext) ||
    UPLOAD_ALLOWED_MIME_TYPES.image.includes(mimeOrType)
  ) {
    return 'image';
  }

  if (
    mimeOrType.includes('pdf') ||
    ext === '.pdf' ||
    mimeOrType === 'application/pdf'
  ) {
    return 'pdf';
  }

  return null;
}

/**
 * Generate signed upload parameters for direct browser-to-Cloudinary upload
 * Enforces strict kinds (video, image, pdf), server-side limits, and unguessable paths.
 */
export async function generateUploadSignature({
  fileName,
  fileSize,
  fileType,
  deliverableType,
  kind,
  pieceId,
  contentPieceId,
  folder,
}) {
  // 1. Resolve and validate upload kind
  const resolvedKind = resolveUploadKind({ kind, fileType, fileName, deliverableType });

  if (!resolvedKind || !UPLOAD_KINDS.includes(resolvedKind)) {
    const err = new Error(
      `Unsupported upload type. Allowed upload kinds are video (mp4, mov, webm), image (png, jpg, webp), or pdf.`
    );
    err.statusCode = 400;
    err.code = 'FILE_TYPE_NOT_ALLOWED';
    err.details = { receivedType: fileType, receivedKind: kind, allowedKinds: UPLOAD_KINDS };
    throw err;
  }

  // 2. Validate MIME type and file extension
  const mime = (fileType || '').toLowerCase();
  const ext = fileName ? path.extname(fileName).toLowerCase() : '';
  const allowedMimes = UPLOAD_ALLOWED_MIME_TYPES[resolvedKind];
  const allowedExts = UPLOAD_ALLOWED_EXTENSIONS[resolvedKind];

  const mimeMatch = !mime || allowedMimes.includes(mime) || allowedMimes.some((m) => mime.includes(m));
  const extMatch = !ext || allowedExts.includes(ext);

  if (!mimeMatch && !extMatch) {
    const err = new Error(
      `Invalid format for ${resolvedKind}. Allowed formats: ${allowedExts.join(', ')} (${allowedMimes.join(', ')})`
    );
    err.statusCode = 400;
    err.code = 'FILE_TYPE_NOT_ALLOWED';
    err.details = { receivedMime: mime, receivedExt: ext, allowedExts, allowedMimes };
    throw err;
  }

  // 3. Validate maximum size limit
  const maxAllowedBytes = UPLOAD_LIMITS_BYTES[resolvedKind];
  if (fileSize && fileSize > maxAllowedBytes) {
    const err = new Error(
      `File size (${Math.round(fileSize / (1024 * 1024))} MB) exceeds maximum allowed limit of ${Math.round(
        maxAllowedBytes / (1024 * 1024)
      )} MB for ${resolvedKind} uploads.`
    );
    err.statusCode = 400;
    err.code = 'FILE_TOO_LARGE';
    err.details = {
      receivedBytes: fileSize,
      maxAllowedBytes,
      kind: resolvedKind,
    };
    throw err;
  }

  const timestamp = Math.round(new Date().getTime() / 1000);

  // 4. Unguessable, per-piece path structure
  const randomSuffix = crypto.randomUUID();
  const targetPieceId = pieceId || contentPieceId;
  const targetFolder = folder
    ? folder
    : targetPieceId
    ? `marketing_portal/pieces/${targetPieceId}/${randomSuffix}`
    : `marketing_portal/general/${randomSuffix}`;

  const resourceType =
    resolvedKind === 'video' ? 'video' : resolvedKind === 'image' ? 'image' : 'raw';

  // 5. Generate Cloudinary signature with non-public listing (type: 'authenticated')
  const cloudName = env.CLOUDINARY_CLOUD_NAME || 'dev_marketing_portal';
  const apiKey = env.CLOUDINARY_API_KEY || 'dev_api_key_123456';
  const apiSecret = env.CLOUDINARY_API_SECRET || 'dev_api_secret_abcdef123456';

  let signature;
  try {
    if (env.CLOUDINARY_API_SECRET) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
      });
      signature = cloudinary.utils.api_sign_request(
        { folder: targetFolder, timestamp, type: 'authenticated' },
        apiSecret
      );
    } else {
      const serialized = `folder=${targetFolder}&timestamp=${timestamp}&type=authenticated${apiSecret}`;
      signature = crypto.createHash('sha1').update(serialized).digest('hex');
    }
  } catch (signErr) {
    const serialized = `folder=${targetFolder}&timestamp=${timestamp}&type=authenticated${apiSecret}`;
    signature = crypto.createHash('sha1').update(serialized).digest('hex');
  }

  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

  return {
    signature,
    timestamp,
    apiKey,
    cloudName,
    folder: targetFolder,
    resourceType,
    uploadUrl,
    kind: resolvedKind,
    maxSizeBytes: maxAllowedBytes,
    accessMode: 'authenticated',
  };
}


/**
 * Record metadata after upload has completed in browser. It describes the file only;
 * it never attaches the file to a submission (that happens through the submission's own
 * routes, which check the step owner).
 */
export async function recordUploadMetadata({
  url,
  size,
  duration,
  width,
  height,
  mime,
  name,
}) {
  if (!url) {
    const err = new Error('File URL is required');
    err.statusCode = 400;
    err.code = 'INVALID_METADATA';
    throw err;
  }

  const metadata = {
    url,
    size: Number(size) || 0,
    duration: Number(duration) || 0,
    width: Number(width) || 0,
    height: Number(height) || 0,
    mime: mime || '',
    name: name || '',
    recordedAt: new Date(),
  };

  return metadata;
}

function removeFile(file) {
  if (file?.path && fs.existsSync(file.path)) {
    try { fs.unlinkSync(file.path); } catch {}
  }
}

/**
 * Validates and processes a locally uploaded file saved via Multer
 */
export async function processLocalUploadedFile(file) {
  if (!file) {
    const err = new Error('No file provided');
    err.statusCode = 400;
    err.code = 'NO_FILE_PROVIDED';
    throw err;
  }

  // The route's file filter has already matched the file to an allowed type.
  const allowed = file.allowedType || allowedFileType(file.originalname, file.mimetype);
  if (!allowed) {
    removeFile(file);
    throw fileTypeError();
  }
  const resolvedKind = allowed.kind;

  // Validate size limit
  const maxAllowedBytes = UPLOAD_LIMITS_BYTES[resolvedKind];
  if (file.size > maxAllowedBytes) {
    removeFile(file);
    const err = new Error(
      `File size (${Math.round(file.size / (1024 * 1024))} MB) exceeds maximum allowed limit of ${Math.round(
        maxAllowedBytes / (1024 * 1024)
      )} MB for ${resolvedKind} uploads.`
    );
    err.statusCode = 400;
    err.code = 'FILE_TOO_LARGE';
    throw err;
  }

  return {
    url: `/uploads/${file.filename}`,
    storageId: file.filename,
    fileName: file.originalname,
    sizeBytes: file.size,
    mimeType: allowed.mimes[0],
    kind: resolvedKind,
  };
}

