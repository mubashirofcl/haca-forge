import * as chatService from './service.js';
import * as chatSocket from './socket.js';
import {
  createGroupSchema,
  updateGroupSchema,
  addGroupMembersSchema,
  sendMessageSchema,
  editMessageSchema,
  toggleReactionSchema,
  shareToChatSchema,
} from '@mmp/shared';

function getIO(req) {
  return req.app.get('io') || chatSocket.getChatSocketIO();
}

export async function listChannels(req, res, next) {
  try {
    const channels = await chatService.listUserChannels(req.user.userId, req.user.role);
    res.json({ channels });
  } catch (err) {
    next(err);
  }
}

export async function getChannel(req, res, next) {
  try {
    const details = await chatService.getChannelDetails(req.params.channelId, req.user.userId);
    res.json(details);
  } catch (err) {
    next(err);
  }
}

export async function createGroup(req, res, next) {
  try {
    const data = createGroupSchema.parse(req.body);
    const channel = await chatService.createGroupChannel(req.user, data);
    res.status(201).json({ channel });
  } catch (err) {
    next(err);
  }
}

export async function updateGroup(req, res, next) {
  try {
    const data = updateGroupSchema.parse(req.body);
    const channel = await chatService.updateGroupChannel(req.params.channelId, req.user, data);
    res.json({ channel });
  } catch (err) {
    next(err);
  }
}

export async function archiveGroup(req, res, next) {
  try {
    const channel = await chatService.archiveGroupChannel(req.params.channelId, req.user);
    res.json({ success: true, channel });
  } catch (err) {
    next(err);
  }
}

export async function unarchiveGroup(req, res, next) {
  try {
    const channel = await chatService.unarchiveGroupChannel(req.params.channelId, req.user);
    res.json({ success: true, channel });
  } catch (err) {
    next(err);
  }
}

export async function addGroupMembers(req, res, next) {
  try {
    const data = addGroupMembersSchema.parse(req.body);
    const members = await chatService.addGroupMembers(req.params.channelId, req.user, data.memberIds);
    res.json({ members });
  } catch (err) {
    next(err);
  }
}

export async function removeGroupMember(req, res, next) {
  try {
    const result = await chatService.removeGroupMember(
      req.params.channelId,
      req.user,
      req.params.memberId
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getOrCreateDM(req, res, next) {
  try {
    const { targetUserId } = req.body;
    if (!targetUserId) {
      return res.status(400).json({ error: { code: 'TARGET_USER_REQUIRED', message: 'Target user ID is required' } });
    }
    const channel = await chatService.getOrCreateDMChannel(req.user, targetUserId);
    res.json({ channel });
  } catch (err) {
    next(err);
  }
}

export async function listMessages(req, res, next) {
  try {
    const result = await chatService.listMessages(req.params.channelId, req.user.userId, {
      cursor: req.query.cursor,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : 50,
      aroundMessageId: req.query.aroundMessageId,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function sendMessage(req, res, next) {
  try {
    const data = sendMessageSchema.parse(req.body);
    const message = await chatService.sendMessage(req.params.channelId, req.user, data);

    const io = getIO(req);
    chatSocket.emitChatMessageNew(io, req.params.channelId, message);

    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
}

export async function editMessage(req, res, next) {
  try {
    const data = editMessageSchema.parse(req.body);
    const message = await chatService.editMessage(
      req.params.channelId,
      req.params.messageId,
      req.user,
      data
    );

    const io = getIO(req);
    chatSocket.emitChatMessageEdited(io, req.params.channelId, message);

    res.json({ message });
  } catch (err) {
    next(err);
  }
}

export async function deleteMessage(req, res, next) {
  try {
    const message = await chatService.deleteMessage(
      req.params.channelId,
      req.params.messageId,
      req.user
    );

    const io = getIO(req);
    chatSocket.emitChatMessageDeleted(io, req.params.channelId, {
      channelId: req.params.channelId,
      messageId: req.params.messageId,
      isDeleted: true,
      content: message.content,
    });

    res.json({ success: true, messageId: req.params.messageId });
  } catch (err) {
    next(err);
  }
}

export async function toggleReaction(req, res, next) {
  try {
    const data = toggleReactionSchema.parse(req.body);
    const message = await chatService.toggleReaction(
      req.params.channelId,
      req.params.messageId,
      req.user,
      data.emoji
    );

    const io = getIO(req);
    chatSocket.emitChatReactionToggled(io, req.params.channelId, {
      channelId: req.params.channelId,
      messageId: req.params.messageId,
      reactions: message.reactions,
    });

    res.json({ message });
  } catch (err) {
    next(err);
  }
}

export async function togglePin(req, res, next) {
  try {
    const message = await chatService.togglePinMessage(
      req.params.channelId,
      req.params.messageId,
      req.user
    );

    const io = getIO(req);
    chatSocket.emitChatPinToggled(io, req.params.channelId, {
      channelId: req.params.channelId,
      messageId: req.params.messageId,
      isPinned: message.isPinned,
    });

    res.json({ message });
  } catch (err) {
    next(err);
  }
}

export async function markRead(req, res, next) {
  try {
    await chatService.markChannelAsRead(
      req.params.channelId,
      req.user.userId,
      req.body.messageId
    );

    const io = getIO(req);
    chatSocket.emitChatRead(io, req.params.channelId, {
      channelId: req.params.channelId,
      userId: req.user.userId,
      messageId: req.body.messageId,
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function muteChannel(req, res, next) {
  try {
    const member = await chatService.setChannelMute(
      req.params.channelId,
      req.user.userId,
      req.body.isMuted
    );
    res.json({ member });
  } catch (err) {
    next(err);
  }
}

export async function shareAsset(req, res, next) {
  try {
    const data = shareToChatSchema.parse(req.body);
    const result = await chatService.shareAssetToChat(req.user, data);
    const message = result.message || result;
    const grant = result.grant || null;

    const io = getIO(req);
    chatSocket.emitChatMessageNew(io, data.channelId, message);

    res.status(201).json({ message, grant });
  } catch (err) {
    next(err);
  }
}

export async function revokeShare(req, res, next) {
  try {
    const grant = await chatService.revokeShareGrant(req.params.grantId, req.user);
    res.json({ success: true, grant });
  } catch (err) {
    next(err);
  }
}

export async function getSharedAsset(req, res, next) {
  try {
    const result = await chatService.getSharedAssetAccess(req.params.grantId, req.user);

    if (req.query.download === '1' || req.query.stream === '1') {
      res.setHeader('Content-Type', result.mimeType || 'video/mp4');
      if (req.query.download === '1') {
        res.setHeader('Content-Disposition', `attachment; filename="${result.title}"`);
      }
      return res.redirect(result.downloadUrl || result.previewUrl);
    }

    res.json({ sharedAsset: result, ...result });
  } catch (err) {
    next(err);
  }
}

export async function searchMessages(req, res, next) {
  try {
    const results = await chatService.searchChatMessages(req.user.userId, {
      query: req.query.q || '',
      channelId: req.query.channelId,
    });
    res.json({ results });
  } catch (err) {
    next(err);
  }
}

