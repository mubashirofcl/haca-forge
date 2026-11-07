import { ChannelMember } from './channelMember.model.js';
import { logger } from '../../lib/logger.js';
import { withoutContact } from '../../lib/socketHub.js';

let ioInstance = null;

export function registerChatSocketIO(io) {
  ioInstance = io;
}

export function getChatSocketIO() {
  return ioInstance;
}

/**
 * Configure chat-specific Socket.io event listeners for a connected client.
 */
export function setupChatSocket(io, socket) {
  if (io && !ioInstance) {
    ioInstance = io;
  }
  const userId = socket.user?.userId;

  if (!userId) return;
  const isExecutive = socket.user?.role === 'executive';
  const isMember = async (channelId) =>
    Boolean(channelId) && Boolean(await ChannelMember.exists({ channelId, userId }));

  // 1. Join channel room with DB membership verification
  socket.on('chat:join', async ({ channelId } = {}, callback) => {
    try {
      if (!channelId) return;
      if (!(await isMember(channelId))) {
        if (typeof callback === 'function') callback({ error: 'Not a member of this channel' });
        return;
      }
      socket.join(`channel:${channelId}`);
      if (typeof callback === 'function') callback({ success: true });
    } catch (err) {
      logger.warn({ err: err.message, channelId }, 'Error joining chat channel room');
      if (typeof callback === 'function') callback({ error: 'Could not join channel' });
    }
  });

  // 2. Leave channel room
  socket.on('chat:leave', ({ channelId } = {}) => {
    if (channelId) {
      socket.leave(`channel:${channelId}`);
    }
  });

  // 3-4. Typing indicators: members only, and never from read-only executives
  const typing = (isTyping) => async ({ channelId } = {}) => {
    try {
      if (isExecutive || !(await isMember(channelId))) return;
      socket.to(`channel:${channelId}`).emit('chat:typing', {
        channelId,
        userId,
        ...(isTyping ? { userName: socket.user?.name || 'Someone' } : {}),
        isTyping,
      });
    } catch (err) {
      logger.debug({ err: err.message }, 'Failed to broadcast typing');
    }
  };
  socket.on('chat:typing:start', typing(true));
  socket.on('chat:typing:stop', typing(false));

  // 5. Read receipt emit: members only
  socket.on('chat:read', async ({ channelId, messageId } = {}) => {
    try {
      if (!(await isMember(channelId))) return;
      socket.to(`channel:${channelId}`).emit('chat:read', { channelId, userId, messageId });
    } catch (err) {
      logger.debug({ err: err.message }, 'Failed to broadcast read receipt');
    }
  });
}

/**
 * Broadcast helpers for API mutations
 */
export function emitChatMessageNew(io, channelId, message) {
  if (!io || !channelId) return;
  io.to(`channel:${channelId}`).emit('chat:message:new', withoutContact(message));
}

export function emitChatMessageEdited(io, channelId, message) {
  if (!io || !channelId) return;
  io.to(`channel:${channelId}`).emit('chat:message:edited', withoutContact(message));
}

export function emitChatMessageDeleted(io, channelId, payload) {
  if (!io || !channelId) return;
  io.to(`channel:${channelId}`).emit('chat:message:deleted', withoutContact(payload));
}

export function emitChatReactionToggled(io, channelId, payload) {
  if (!io || !channelId) return;
  io.to(`channel:${channelId}`).emit('chat:reaction:toggled', withoutContact(payload));
}

export function emitChatPinToggled(io, channelId, payload) {
  if (!io || !channelId) return;
  io.to(`channel:${channelId}`).emit('chat:pin:toggled', withoutContact(payload));
}

export function emitChatRead(io, channelId, payload) {
  if (!io || !channelId) return;
  io.to(`channel:${channelId}`).emit('chat:read', withoutContact(payload));
}
