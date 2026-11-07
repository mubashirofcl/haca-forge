import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { isAppUploadPath, isDriveLink, OUTPUT_URL_ERROR } from '@mmp/shared';

const UPLOADS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../uploads');

/** Does this /uploads/... path point at a file that was actually uploaded here? */
function uploadExists(url) {
  const filePath = path.resolve(UPLOADS_DIR, url.replace(/^\/uploads\//, ''));
  if (!filePath.startsWith(UPLOADS_DIR + path.sep)) return false;
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function invalid(field) {
  const err = new Error(`${field}: ${OUTPUT_URL_ERROR}`);
  err.statusCode = 400;
  err.code = 'INVALID_OUTPUT_URL';
  err.details = { field };
  return err;
}

/**
 * A clip or submission URL being saved must be a file uploaded through the app, or an
 * https Google Drive / Docs link. Empty means "not set" and is allowed. `uploadsOnly`
 * is for thumbnails, which must be real images.
 */
export function assertOutputUrl(url, field = 'url', { uploadsOnly = false } = {}) {
  if (url === undefined || url === null || url === '') return;
  const value = String(url).trim();
  if (!uploadsOnly && isDriveLink(value)) return;
  if (isAppUploadPath(value) && uploadExists(value)) return;
  throw invalid(field);
}

/** Every file entry in a submission. */
export function assertOutputFiles(files, field = 'files') {
  (Array.isArray(files) ? files : []).forEach((file, i) => assertOutputUrl(file?.url, `${field}[${i}].url`));
}

/**
 * For fields that may still hold a value saved before Phase 5: only a new value is checked,
 * so re-sending the existing one never fails.
 */
export function assertChangedOutputUrl(url, current, field) {
  if (url === undefined || url === null || url === '') return;
  if (String(url).trim() === String(current || '').trim()) return;
  assertOutputUrl(url, field);
}

export { isDriveLink };
