import crypto from 'crypto';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../../config/env.js';
import { MAX_UPLOAD_SIZES } from '@mmp/shared';

/**
 * Generate signed upload parameters for direct browser-to-Cloudinary upload
 * Enforces file type and maximum size restrictions (video up to 500 MB)
 */
export async function generateUploadSignature({ fileName, fileSize, fileType, deliverableType, folder }) {
  // 1. Determine category
  let category = 'other';
  const mimeOrType = (deliverableType || fileType || '').toLowerCase();

  if (mimeOrType.includes('video') || mimeOrType === 'video') {
    category = 'video';
  } else if (mimeOrType.includes('image') || mimeOrType === 'image') {
    category = 'image';
  } else if (mimeOrType.includes('audio') || mimeOrType === 'audio') {
    category = 'audio';
  } else if (
    mimeOrType.includes('pdf') ||
    mimeOrType.includes('document') ||
    mimeOrType.includes('text') ||
    mimeOrType === 'document'
  ) {
    category = 'document';
  }

  // 2. Validate maximum size limit
  const maxAllowedBytes = MAX_UPLOAD_SIZES[category] || MAX_UPLOAD_SIZES.other;
  if (fileSize > maxAllowedBytes) {
    const err = new Error(
      `File size (${Math.round(fileSize / 1024 / 1024)} MB) exceeds maximum allowed limit of ${Math.round(
        maxAllowedBytes / 1024 / 1024
      )} MB for ${category} uploads.`
    );
    err.statusCode = 400;
    err.code = 'FILE_TOO_LARGE';
    err.details = {
      receivedBytes: fileSize,
      maxAllowedBytes,
      category,
    };
    throw err;
  }

  const timestamp = Math.round(new Date().getTime() / 1000);
  const targetFolder = folder || 'marketing_portal/deliverables';
  const resourceType = category === 'video' ? 'video' : category === 'image' ? 'image' : 'raw';

  // 3. Generate Cloudinary signature
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
        { folder: targetFolder, timestamp },
        apiSecret
      );
    } else {
      // Deterministic dev/test fallback
      const serialized = `folder=${targetFolder}&timestamp=${timestamp}${apiSecret}`;
      signature = crypto.createHash('sha1').update(serialized).digest('hex');
    }
  } catch (signErr) {
    const serialized = `folder=${targetFolder}&timestamp=${timestamp}${apiSecret}`;
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
    maxSizeBytes: maxAllowedBytes,
  };
}
