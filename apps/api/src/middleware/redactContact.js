import { normalizeRole } from '@mmp/shared';

/**
 * Contact details in REST responses. A team_member or executive sees only their own:
 * email, phone and WhatsApp are removed from every other person, however deeply nested.
 * admin, creative_head and sm_manager are not affected.
 *
 * Only text values are removed. Settings such as `{ inApp: true, email: true }` stay, and so
 * does an existing null, which is how a masked contact field already reads on screens.
 * This covers res.json only. Socket.IO payloads do not pass through here.
 */
const CONTACT_KEYS = new Set(['email', 'phone', 'phoneNumber', 'whatsapp', 'whatsappNumber', 'mobile']);

export function stripContact(value, viewerId) {
  if (Array.isArray(value)) return value.map((entry) => stripContact(entry, viewerId));
  if (!value || typeof value !== 'object') return value;
  const isViewer = String(value._id ?? value.id ?? '') === viewerId;
  const result = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!isViewer && CONTACT_KEYS.has(key) && typeof entry === 'string') continue;
    result[key] = stripContact(entry, viewerId);
  }
  return result;
}

export function redactContact(req, res, next) {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    const role = normalizeRole(req.user?.role);
    if (role !== 'team_member' && role !== 'executive') return originalJson(body);
    const viewerId = (req.user._id || req.user.id || req.user.userId)?.toString();
    // Through JSON first, so documents, ids and dates are plain values, as res.json would send them.
    return originalJson(stripContact(JSON.parse(JSON.stringify(body ?? null)), viewerId));
  };
  next();
}
