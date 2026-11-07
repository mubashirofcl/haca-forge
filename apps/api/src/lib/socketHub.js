/**
 * The Socket.IO server, reachable from anywhere that ends a session or changes access.
 * Kept free of model imports so models can use it without a cycle.
 */
let io = null;

export function setSocketServer(server) {
  io = server;
}

export function getSocketServer() {
  return io;
}

/**
 * Close every socket the user has open. Used on logout, suspension, forced logout,
 * revoked sessions and role or status changes. A client that may still connect will
 * reconnect, and the handshake checks the user again.
 */
export function disconnectUserSockets(userId) {
  if (!io || !userId) return;
  io.in(`user:${String(userId)}`).disconnectSockets(true);
}

/** Take all of a user's sockets out of a room, e.g. a chat channel they left. */
export function removeUserFromRoom(userId, room) {
  if (!io || !userId || !room) return;
  io.in(`user:${String(userId)}`).socketsLeave(room);
}

const CONTACT_KEYS = new Set(['email', 'phone', 'phoneNumber', 'whatsapp', 'whatsappNumber', 'mobile']);

function strip(value) {
  if (Array.isArray(value)) return value.map(strip);
  if (!value || typeof value !== 'object') return value;
  const result = {};
  for (const [key, entry] of Object.entries(value)) {
    if (CONTACT_KEYS.has(key) && typeof entry === 'string') continue;
    result[key] = strip(entry);
  }
  return result;
}

/**
 * A socket payload without anyone's email, phone or WhatsApp. Socket events go to rooms
 * of mixed roles and skip the REST contact filter, so contact details are never sent.
 */
export function withoutContact(payload) {
  if (payload == null) return payload;
  return strip(JSON.parse(JSON.stringify(payload)));
}
