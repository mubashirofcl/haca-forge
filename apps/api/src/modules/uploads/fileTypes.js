import crypto from 'crypto';
import path from 'path';

/**
 * The file types the general upload route and avatars accept: video, image and PDF.
 * A file must match on both its extension and its declared type. It is stored under a
 * random name and the extension listed here, so what the server serves back always
 * matches one of these types, whatever the uploader called the file.
 */
const ALLOWED = {
  '.mp4': { kind: 'video', mimes: ['video/mp4'], ext: '.mp4' },
  '.mov': { kind: 'video', mimes: ['video/quicktime'], ext: '.mov' },
  '.webm': { kind: 'video', mimes: ['video/webm'], ext: '.webm' },
  '.png': { kind: 'image', mimes: ['image/png'], ext: '.png' },
  '.jpg': { kind: 'image', mimes: ['image/jpeg', 'image/jpg'], ext: '.jpg' },
  '.jpeg': { kind: 'image', mimes: ['image/jpeg', 'image/jpg'], ext: '.jpg' },
  '.webp': { kind: 'image', mimes: ['image/webp'], ext: '.webp' },
  '.pdf': { kind: 'pdf', mimes: ['application/pdf'], ext: '.pdf' },
};

/** The allowed type for this file, or null. `kinds` limits it further, e.g. ['image'] for avatars. */
export function allowedFileType(originalName, mimeType, kinds = null) {
  const entry = ALLOWED[path.extname(originalName || '').toLowerCase()];
  if (!entry) return null;
  if (!entry.mimes.includes(String(mimeType || '').toLowerCase())) return null;
  if (kinds && !kinds.includes(entry.kind)) return null;
  return entry;
}

export function fileTypeError(kinds) {
  const exts = Object.entries(ALLOWED)
    .filter(([, e]) => !kinds || kinds.includes(e.kind))
    .map(([ext]) => ext);
  const err = new Error(`This file type is not allowed. Allowed: ${exts.join(', ')}.`);
  err.statusCode = 400;
  err.code = 'FILE_TYPE_NOT_ALLOWED';
  return err;
}

/** A multer fileFilter that accepts only these types and remembers the matched one on the file. */
export function allowedFileFilter(kinds = null) {
  return (_req, file, cb) => {
    const type = allowedFileType(file.originalname, file.mimetype, kinds);
    if (!type) return cb(fileTypeError(kinds));
    file.allowedType = type;
    return cb(null, true);
  };
}

/** A server-chosen name: random, with the matched type's extension. */
export function storedFileName(file, prefix = '') {
  const ext = file.allowedType?.ext;
  if (!ext) throw fileTypeError();
  return `${prefix}${crypto.randomUUID()}${ext}`;
}

const MEDIA_EXTENSIONS = new Set(['.mp4', '.mov', '.webm', '.png', '.jpg', '.jpeg', '.webp']);

/**
 * Headers for every file served from /uploads. Uploaded files are never run as a page:
 * the sandbox policy blocks scripts even if one is opened directly, and anything that is
 * not an image or video downloads instead of opening.
 */
export function setUploadHeaders(res, filePath) {
  res.setHeader('Content-Security-Policy', 'sandbox');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!MEDIA_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath).replace(/[^\w.-]/g, '_')}"`);
  }
}

/** Links we put in chat: http(s), or a path on this site. Anything else (javascript:, data:, //host) is dropped. */
export function safeLink(url) {
  if (typeof url !== 'string') return '';
  const value = url.trim();
  if (!value) return '';
  if (value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) return value;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? value : '';
  } catch {
    return '';
  }
}
