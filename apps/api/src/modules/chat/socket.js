import { ChannelMember } from './channelMember.model.js';
import { logger } from '../../lib/logger.js';

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

  // 1. Join channel room with DB membership verification
  socket.on('chat:join', async ({ channelId }, callback) => {
    try {
      if (!channelId) return;
      const isMember = await ChannelMember.exists({ channelId, userId });
      if (!isMember) {
        if (typeof callback === 'function') callback({ error: 'Not a member of this channel' });
        return;
      }
      socket.join(`channel:${channelId}`);
      if (typeof callback === 'function') callback({ success: true });
    } catch (err) {
      logger.warn({ err: err.message, channelId }, 'Error joining chat channel room');
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  // 2. Leave channel room
  socket.on('chat:leave', ({ channelId }) => {
    if (channelId) {
      socket.leave(`channel:${channelId}`);
    }
  });

  // 3. Typing indicator start
  socket.on('chat:typing:start', async ({ channelId }) => {
    try {
      if (!channelId) return;
      const isMember = await ChannelMember.exists({ channelId, userId });
      if (!isMember) return;

      socket.to(`channel:${channelId}`).emit('chat:typing', {
        channelId,
        userId,
        userName: socket.user?.name || socket.user?.preferredName || 'Someone',
        isTyping: true,
      });
    } catch (err) {
      logger.debug({ err: err.message }, 'Failed to broadcast typing start');
    }
  });

  // 4. Typing indicator stop
  socket.on('chat:typing:stop', ({ channelId }) => {
    if (channelId) {
      socket.to(`channel:${channelId}`).emit('chat:typing', {
        channelId,
        userId,
        isTyping: false,
      });
    }
  });

  // 5. Read receipt emit
  socket.on('chat:read', ({ channelId, messageId }) => {
    if (channelId) {
      socket.to(`channel:${channelId}`).emit('chat:read', {
        channelId,
        userId,
        messageId,
      });
    }
  });
}

/**
 * Broadcast helpers for API mutations
 */
export function emitChatMessageNew(io, channelId, message) {
  if (!io || !channelId) return;
  io.to(`channel:${channelId}`).emit('chat:message:new', message);
}

export function emitChatMessageEdited(io, channelId, message) {
  if (!io || !channelId) return;
  io.to(`channel:${channelId}`).emit('chat:message:edited', message);
}

export function emitChatMessageDeleted(io, channelId, payload) {
  if (!io || !channelId) return;
  io.to(`channel:${channelId}`).emit('chat:message:deleted', payload);
}

export function emitChatReactionToggled(io, channelId, payload) {
  if (!io || !channelId) return;
  io.to(`channel:${channelId}`).emit('chat:reaction:toggled', payload);
}

export function emitChatPinToggled(io, channelId, payload) {
  if (!io || !channelId) return;
  io.to(`channel:${channelId}`).emit('chat:pin:toggled', payload);
}

export function emitChatRead(io, channelId, payload) {
  if (!io || !channelId) return;
  io.to(`channel:${channelId}`).emit('chat:read', payload);
}
