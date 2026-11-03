/**
 * Sanitizer and payload size limiter for Submissions documents & HTML snapshots.
 * Enforces a strict 1 MB maximum payload limit and strips all executable/unsafe HTML.
 */

const MAX_DOCUMENT_BYTES = 1024 * 1024; // 1 MB

/**
 * Strips script tags, iframes, objects, embeds, event handlers, and unsafe URI schemes.
 * @param {string} html
 * @returns {string} sanitized HTML
 */
export function sanitizeHtmlSnapshot(html) {
  if (!html || typeof html !== 'string') return '';

  let sanitized = html;

  // 1. Remove dangerous blocks: <script>...</script>, <style>...</style>, <iframe>...</iframe>, <object>...</object>, <embed>, <applet>
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  sanitized = sanitized.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '');
  sanitized = sanitized.replace(/<embed\b[^>]*\/?>/gi, '');
  sanitized = sanitized.replace(/<applet\b[^<]*(?:(?!<\/applet>)<[^<]*)*<\/applet>/gi, '');
  sanitized = sanitized.replace(/<link\b[^>]*\/?>/gi, '');
  sanitized = sanitized.replace(/<meta\b[^>]*\/?>/gi, '');
  sanitized = sanitized.replace(/<base\b[^>]*\/?>/gi, '');

  // 2. Remove inline event handlers (e.g. onload=, onclick=, onerror=, onmouseover=)
  sanitized = sanitized.replace(/\son[a-z]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '');

  // 3. Remove javascript:, vbscript:, and data:text/html in href/src attributes
  sanitized = sanitized.replace(
    /(href|src)\s*=\s*['"]\s*(?:javascript|vbscript|data:\s*text\/html):[^'"]*['"]/gi,
    '$1=""'
  );
  sanitized = sanitized.replace(
    /(href|src)\s*=\s*(?:javascript|vbscript|data:\s*text\/html):[^\s>]+/gi,
    '$1=""'
  );

  return sanitized;
}

/**
 * Validates that document JSON and HTML snapshot combined do not exceed 1 MB.
 * Throws 400 error if exceeded.
 * @param {{ json?: any, htmlSnapshot?: string }} document
 * @returns {{ json?: any, htmlSnapshot?: string }} sanitized document
 */
export function sanitizeDocumentPayload(document) {
  if (!document) return document;

  let totalBytes = 0;
  let jsonString = '';

  if (document.json) {
    jsonString = typeof document.json === 'string' ? document.json : JSON.stringify(document.json);
    totalBytes += Buffer.byteLength(jsonString, 'utf8');
  }

  let htmlSnapshot = '';
  if (document.htmlSnapshot) {
    htmlSnapshot = sanitizeHtmlSnapshot(document.htmlSnapshot);
    totalBytes += Buffer.byteLength(htmlSnapshot, 'utf8');
  }

  if (totalBytes > MAX_DOCUMENT_BYTES) {
    const error = new Error(
      `Document payload size (${(totalBytes / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit of 1 MB.`
    );
    error.statusCode = 400;
    error.code = 'DOCUMENT_TOO_LARGE';
    error.details = { totalBytes, maxAllowedBytes: MAX_DOCUMENT_BYTES };
    throw error;
  }

  return {
    json: document.json || null,
    htmlSnapshot,
    metadata: document.metadata || null,
  };
}
