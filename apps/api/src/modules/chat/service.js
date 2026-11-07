import crypto from 'crypto';
import mongoose from 'mongoose';
import { Channel } from './channel.model.js';
import { ChannelMember } from './channelMember.model.js';
import { ChatMessage } from './chatMessage.model.js';
import { ShareGrant } from './shareGrant.model.js';
import { Person } from '../people/model.js';
import { ContentPiece } from '../calendar/contentPiece.model.js';
import { MediaItem } from '../media/model.js';
import { WorkItem } from '../workItems/model.js';
import { Submission } from '../submissions/model.js';
import { logActivity } from '../activity/service.js';
import { createNotification } from '../notifications/service.js';
import { logger } from '../../lib/logger.js';
import { buildChatAttachments } from './attachments.js';
import { safeLink } from '../uploads/fileTypes.js';
import {
  CHAT_REACTION_EMOJIS,
  CHAT_ATTACHMENT_CONFIG,
} from '@mmp/shared';

// Helper to strip executable HTML tags (XSS guard)
export function sanitizeChatContent(content = '') {
  if (typeof content !== 'string') return '';
  return content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}

/**
 * 1. Ensure the system singleton Team Chat channel exists and all active users are members.
 */
export async function ensureTeamChatChannel(profileId = null) {
  let teamChannel = await Channel.findOne({ type: 'team', systemSlug: 'team-chat' });
  if (!teamChannel) {
    teamChannel = await Channel.create({
      type: 'team',
      name: 'Team Chat',
      description: 'System-wide team communication channel for all active members.',
      systemSlug: 'team-chat',
      profileId,
      isArchived: false,
    });
    logger.info({ channelId: teamChannel._id }, 'Created system Team Chat channel');
  }

  // Find all active users
  const activeUsers = await Person.find({ status: 'active' }).select('_id');
  const activeUserIds = activeUsers.map((u) => u._id);

  // Upsert membership for active users
  const existingMembers = await ChannelMember.find({
    channelId: teamChannel._id,
  }).select('userId');
  const existingUserIds = new Set(existingMembers.map((m) => m.userId.toString()));

  const newMembers = activeUserIds
    .filter((id) => !existingUserIds.has(id.toString()))
    .map((id) => ({
      channelId: teamChannel._id,
      userId: id,
      role: 'member',
      joinedAt: new Date(),
    }));

  if (newMembers.length > 0) {
    await ChannelMember.insertMany(newMembers, { ordered: false });
    logger.info({ addedCount: newMembers.length }, 'Added active users to Team Chat');
  }

  // Remove suspended users from Team Chat
  const suspendedUsers = await Person.find({ status: 'suspended' }).select('_id');
  if (suspendedUsers.length > 0) {
    const suspendedIds = suspendedUsers.map((u) => u._id);
    await ChannelMember.deleteMany({
      channelId: teamChannel._id,
      userId: { $in: suspendedIds },
    });
  }

  return teamChannel;
}

/**
 * Sync user membership in Team Chat on activation/suspension.
 */
export async function syncUserTeamChatMembership(userId) {
  const user = await Person.findById(userId);
  if (!user) return;

  const teamChannel = await ensureTeamChatChannel(user.profileId);

  if (user.status === 'active') {
    await ChannelMember.updateOne(
      { channelId: teamChannel._id, userId: user._id },
      { $setOnInsert: { channelId: teamChannel._id, userId: user._id, role: 'member', joinedAt: new Date() } },
      { upsert: true }
    );
  } else if (user.status === 'suspended') {
    await ChannelMember.deleteMany({ userId: user._id });
  }
}

/**
 * 2. List channels accessible by a user.
 */
export async function listUserChannels(userId, userRole) {
  // Always guarantee Team Chat membership for active user
  await syncUserTeamChatMembership(userId);

  const memberships = await ChannelMember.find({ userId });
  const channelIds = memberships.map((m) => m.channelId);

  const channels = await Channel.find({ _id: { $in: channelIds } })
    .populate('createdById', 'name preferredName avatarUrl role jobRole')
    .sort({ lastMessageAt: -1 });

  // Compute unread counts and enrich channels
  const memberMap = new Map(memberships.map((m) => [m.channelId.toString(), m]));

  const enriched = await Promise.all(
    channels.map(async (c) => {
      const member = memberMap.get(c._id.toString());
      const lastReadAt = member?.lastReadAt || member?.joinedAt || new Date(0);

      const unreadCount = await ChatMessage.countDocuments({
        channelId: c._id,
        createdAt: { $gt: lastReadAt },
        authorId: { $ne: userId },
        isDeleted: false,
      });

      const membersCount = await ChannelMember.countDocuments({ channelId: c._id });

      let otherUser = null;
      if (c.type === 'dm') {
        const otherMember = await ChannelMember.findOne({
          channelId: c._id,
          userId: { $ne: userId },
        }).populate('userId', 'name preferredName avatarUrl role jobRole status');

        if (otherMember?.userId) {
          otherUser = otherMember.userId;
        }
      }

      return {
        _id: c._id.toString(),
        id: c._id.toString(),
        type: c.type,
        name: c.type === 'dm' && otherUser ? (otherUser.preferredName || otherUser.name) : c.name,
        description: c.description,
        systemSlug: c.systemSlug,
        createdById: c.createdById,
        isArchived: c.isArchived,
        archivedAt: c.archivedAt,
        lastMessageAt: c.lastMessageAt,
        lastMessageSnippet: c.lastMessageSnippet,
        unreadCount,
        membersCount,
        isMuted: member?.isMuted || false,
        otherUser,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      };
    })
  );

  // Team chat pinned to top, followed by active channels sorted by lastMessageAt descending
  enriched.sort((a, b) => {
    if (a.type === 'team') return -1;
    if (b.type === 'team') return 1;
    if (a.isArchived && !b.isArchived) return 1;
    if (!a.isArchived && b.isArchived) return -1;
    return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
  });

  return enriched;
}

/**
 * 3. Get channel details including members and pinned messages.
 */
export async function getChannelDetails(channelId, userId) {
  const member = await ChannelMember.findOne({ channelId, userId });
  if (!member) {
    const error = new Error('Access denied: You are not a member of this channel');
    error.statusCode = 403;
    error.code = 'NOT_A_CHANNEL_MEMBER';
    throw error;
  }

  const channel = await Channel.findById(channelId).populate('createdById', 'name preferredName avatarUrl role jobRole');
  if (!channel) {
    const error = new Error('Channel not found');
    error.statusCode = 404;
    error.code = 'CHANNEL_NOT_FOUND';
    throw error;
  }

  const members = await ChannelMember.find({ channelId })
    .populate('userId', 'name preferredName avatarUrl role jobRole status email phone')
    .sort({ role: 1, joinedAt: 1 });

  const pinnedMessages = await ChatMessage.find({
    channelId,
    isPinned: true,
    isDeleted: false,
  })
    .populate('authorId', 'name preferredName avatarUrl role jobRole')
    .sort({ pinnedAt: -1 })
    .limit(10);

  return {
    channel,
    members,
    pinnedMessages,
    isMuted: member.isMuted,
    myRole: member.role,
  };
}

/**
 * 4. Create Group Channel (creative_head, sm_manager, admin).
 */
export async function createGroupChannel(user, { name, description = '', memberIds = [] }) {
  const trimmedName = name.trim();

  // Name uniqueness check among active groups
  const existing = await Channel.findOne({
    type: 'group',
    name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
    isArchived: false,
  });

  if (existing) {
    const error = new Error(`An active group with the name "${trimmedName}" already exists.`);
    error.statusCode = 400;
    error.code = 'DUPLICATE_GROUP_NAME';
    throw error;
  }

  const group = await Channel.create({
    type: 'group',
    name: trimmedName,
    description: description.trim(),
    createdById: user.userId,
    profileId: user.profileId,
  });

  // Creator is owner
  const membersToInsert = [
    {
      channelId: group._id,
      userId: user.userId,
      role: 'owner',
      joinedAt: new Date(),
    },
  ];

  // Add other selected active members
  const uniqueMemberIds = Array.from(new Set(memberIds.map((id) => id.toString()))).filter(
    (id) => id !== user.userId.toString()
  );

  const activeUsers = await Person.find({
    _id: { $in: uniqueMemberIds },
    status: 'active',
  }).select('_id');

  for (const u of activeUsers) {
    membersToInsert.push({
      channelId: group._id,
      userId: u._id,
      role: 'member',
      joinedAt: new Date(),
    });
  }

  await ChannelMember.insertMany(membersToInsert);

  return group;
}

/**
 * 5. Update Group Channel (owner or admin).
 */
export async function updateGroupChannel(channelId, user, { name, description }) {
  const channel = await Channel.findById(channelId);
  if (!channel || channel.type !== 'group') {
    const error = new Error('Group channel not found');
    error.statusCode = 404;
    error.code = 'GROUP_NOT_FOUND';
    throw error;
  }

  const member = await ChannelMember.findOne({ channelId, userId: user.userId });
  const isOwner = member?.role === 'owner';
  const isAdmin = user.role === 'admin';

  if (!isOwner && !isAdmin) {
    const error = new Error('Only the group owner or an administrator can update group settings.');
    error.statusCode = 403;
    error.code = 'INSUFFICIENT_PERMISSIONS';
    throw error;
  }

  if (name && name.trim() !== channel.name) {
    const trimmed = name.trim();
    const existing = await Channel.findOne({
      _id: { $ne: channelId },
      type: 'group',
      name: { $regex: new RegExp(`^${trimmed}$`, 'i') },
      isArchived: false,
    });
    if (existing) {
      const error = new Error(`An active group named "${trimmed}" already exists.`);
      error.statusCode = 400;
      error.code = 'DUPLICATE_GROUP_NAME';
      throw error;
    }
    channel.name = trimmed;
  }

  if (description !== undefined) {
    channel.description = description.trim();
  }

  await channel.save();
  return channel;
}

/**
 * 6. Archive Group Channel (owner or admin).
 */
export async function archiveGroupChannel(channelId, user) {
  const channel = await Channel.findById(channelId);
  if (!channel || channel.type !== 'group') {
    const error = new Error('Group not found');
    error.statusCode = 404;
    throw error;
  }

  const member = await ChannelMember.findOne({ channelId, userId: user.userId });
  const isOwner = member?.role === 'owner';
  const isAdmin = user.role === 'admin';

  if (!isOwner && !isAdmin) {
    const error = new Error('Only the group owner or an administrator can archive this group.');
    error.statusCode = 403;
    throw error;
  }

  channel.isArchived = true;
  channel.archivedAt = new Date();
  channel.archivedById = user.userId;
  await channel.save();

  return channel;
}

/**
 * 7. Unarchive Group Channel (admin only).
 */
export async function unarchiveGroupChannel(channelId, user) {
  if (user.role !== 'admin') {
    const error = new Error('Only an administrator can unarchive a group.');
    error.statusCode = 403;
    throw error;
  }

  const channel = await Channel.findById(channelId);
  if (!channel || channel.type !== 'group') {
    const error = new Error('Group not found');
    error.statusCode = 404;
    throw error;
  }

  channel.isArchived = false;
  channel.archivedAt = null;
  channel.archivedById = null;
  await channel.save();

  return channel;
}

/**
 * 8. Add members to group.
 */
export async function addGroupMembers(channelId, user, memberIds = []) {
  const channel = await Channel.findById(channelId);
  if (!channel || channel.type !== 'group' || channel.isArchived) {
    const error = new Error('Active group channel not found');
    error.statusCode = 404;
    throw error;
  }

  const callerMember = await ChannelMember.findOne({ channelId, userId: user.userId });
  if (callerMember?.role !== 'owner' && user.role !== 'admin') {
    const error = new Error('Only the group owner or an administrator can add members.');
    error.statusCode = 403;
    throw error;
  }

  const activeUsers = await Person.find({
    _id: { $in: memberIds },
    status: 'active',
  }).select('_id');

  const existing = await ChannelMember.find({ channelId }).select('userId');
  const existingIds = new Set(existing.map((m) => m.userId.toString()));

  const newMembers = activeUsers
    .filter((u) => !existingIds.has(u._id.toString()))
    .map((u) => ({
      channelId,
      userId: u._id,
      role: 'member',
      joinedAt: new Date(),
    }));

  if (newMembers.length > 0) {
    await ChannelMember.insertMany(newMembers);
  }

  return ChannelMember.find({ channelId }).populate('userId', 'name preferredName avatarUrl role jobRole status');
}

/**
 * 9. Remove group member or leave group.
 */
export async function removeGroupMember(channelId, user, targetUserId) {
  const channel = await Channel.findById(channelId);
  if (!channel || channel.type !== 'group') {
    const error = new Error('Group channel not found');
    error.statusCode = 404;
    throw error;
  }

  const callerMember = await ChannelMember.findOne({ channelId, userId: user.userId });
  const isLeaving = user.userId.toString() === targetUserId.toString();
  const isOwner = callerMember?.role === 'owner';
  const isAdmin = user.role === 'admin';

  if (!isLeaving && !isOwner && !isAdmin) {
    const error = new Error('You do not have permission to remove members from this group.');
    error.statusCode = 403;
    throw error;
  }

  const targetMember = await ChannelMember.findOne({ channelId, userId: targetUserId });
  if (!targetMember) {
    const error = new Error('Member not found in channel');
    error.statusCode = 404;
    throw error;
  }

  if (isLeaving && targetMember.role === 'owner') {
    // Check if other members exist
    const otherMembers = await ChannelMember.find({
      channelId,
      userId: { $ne: targetUserId },
    });

    if (otherMembers.length > 0) {
      const error = new Error('Group owners must transfer ownership or archive the group before leaving.');
      error.statusCode = 400;
      error.code = 'OWNER_CANNOT_LEAVE_WITHOUT_TRANSFER';
      throw error;
    } else {
      // Last member leaving auto-archives
      channel.isArchived = true;
      channel.archivedAt = new Date();
      channel.archivedById = user.userId;
      await channel.save();
    }
  }

  await ChannelMember.deleteOne({ _id: targetMember._id });
  return { success: true };
}

/**
 * 10. Direct Messages: Get or create 1:1 conversation between two active non-executive users.
 */
export async function getOrCreateDMChannel(user, targetUserId) {
  if (user.role === 'executive') {
    const error = new Error('Executives are read-only viewers and cannot participate in direct messages.');
    error.statusCode = 403;
    error.code = 'EXECUTIVE_CANNOT_DM';
    throw error;
  }

  const target = await Person.findById(targetUserId);
  if (!target || target.status !== 'active') {
    const error = new Error('Target user is not active.');
    error.statusCode = 400;
    error.code = 'TARGET_USER_NOT_ACTIVE';
    throw error;
  }

  if (target.role === 'executive') {
    const error = new Error('Executives cannot be messaged directly.');
    error.statusCode = 403;
    error.code = 'EXECUTIVE_CANNOT_DM';
    throw error;
  }

  if (user.userId.toString() === targetUserId.toString()) {
    const error = new Error('Cannot start a direct message with yourself.');
    error.statusCode = 400;
    throw error;
  }

  // Find existing DM channel shared between these two users
  const userMemberships = await ChannelMember.find({ userId: user.userId });
  const userChannelIds = userMemberships.map((m) => m.channelId);

  const sharedDMMembership = await ChannelMember.findOne({
    userId: targetUserId,
    channelId: { $in: userChannelIds },
  });

  if (sharedDMMembership) {
    const existingChannel = await Channel.findOne({
      _id: sharedDMMembership.channelId,
      type: 'dm',
    });
    if (existingChannel) {
      return existingChannel;
    }
  }

  // Create new DM channel
  const dmChannel = await Channel.create({
    type: 'dm',
    name: 'Direct Message',
    createdById: user.userId,
    profileId: user.profileId,
  });

  await ChannelMember.insertMany([
    { channelId: dmChannel._id, userId: user.userId, role: 'member', joinedAt: new Date() },
    { channelId: dmChannel._id, userId: target._id, role: 'member', joinedAt: new Date() },
  ]);

  return dmChannel;
}

/**
 * 11. List paginated messages in a channel.
 */
export async function listMessages(channelId, userId, { cursor, limit = 50, aroundMessageId }) {
  const member = await ChannelMember.findOne({ channelId, userId });
  if (!member) {
    const error = new Error('Access denied: You are not a member of this channel');
    error.statusCode = 403;
    throw error;
  }

  const filter = { channelId };

  if (aroundMessageId) {
    // Deep-linking context fetch: find 25 before and 25 after aroundMessageId
    const targetMsg = await ChatMessage.findById(aroundMessageId);
    if (targetMsg && targetMsg.channelId.toString() === channelId.toString()) {
      const before = await ChatMessage.find({
        channelId,
        createdAt: { $lt: targetMsg.createdAt },
      })
        .populate('authorId', 'name preferredName avatarUrl role jobRole')
        .sort({ createdAt: -1 })
        .limit(25);

      const after = await ChatMessage.find({
        channelId,
        createdAt: { $gte: targetMsg.createdAt },
      })
        .populate('authorId', 'name preferredName avatarUrl role jobRole')
        .sort({ createdAt: 1 })
        .limit(25);

      const combined = [...before.reverse(), ...after];
      return {
        messages: combined,
        hasMore: before.length === 25,
      };
    }
  }

  if (cursor) {
    filter.createdAt = { $lt: new Date(cursor) };
  }

  const messages = await ChatMessage.find(filter)
    .populate('authorId', 'name preferredName avatarUrl role jobRole')
    .sort({ createdAt: -1 })
    .limit(limit);

  const hasMore = messages.length === limit;
  messages.reverse(); // Return in chronological order

  return {
    messages,
    hasMore,
    nextCursor: messages.length > 0 ? messages[0].createdAt : null,
  };
}

/**
 * 12. Send a message to a channel.
 */
export async function sendMessage(channelId, user, { content = '', replyToId = null, attachments = [], sharedMedia = null }) {
  if (user.role === 'executive') {
    const error = new Error('Executives are read-only viewers and cannot post messages.');
    error.statusCode = 403;
    error.code = 'EXECUTIVE_READ_ONLY';
    throw error;
  }

  let member = await ChannelMember.findOne({ channelId, userId: user.userId });
  const channel = await Channel.findById(channelId);
  if (!member && channel && channel.type === 'team') {
    const person = await Person.findById(user.userId);
    if (person && person.status === 'active') {
      member = await ChannelMember.create({
        channelId: channel._id,
        userId: person._id,
        role: person.role === 'executive' ? 'viewer' : 'member',
      });
    }
  }

  if (!member) {
    const error = new Error('Access denied: You are not a member of this channel');
    error.statusCode = 403;
    throw error;
  }
  if (!channel || channel.isArchived) {
    const error = new Error('Cannot send messages to an archived channel.');
    error.statusCode = 400;
    error.code = 'CHANNEL_ARCHIVED';
    throw error;
  }

  const sanitized = sanitizeChatContent(content);
  // Built from the files on disk; the client's own name, size, type or link are not used.
  const builtAttachments = buildChatAttachments(channel._id, attachments);

  if (!sanitized && builtAttachments.length === 0 && !sharedMedia) {
    const error = new Error('Message content or an attachment is required.');
    error.statusCode = 400;
    throw error;
  }

  // Permission check for @everyone
  const hasEveryoneMention = /@everyone\b/i.test(sanitized);
  if (hasEveryoneMention) {
    const canMentionEveryone = ['admin', 'creative_head', 'sm_manager'].includes(user.role);
    if (!canMentionEveryone) {
      const error = new Error('Only the Creative Head, SM Manager, or Administrator can mention @everyone.');
      error.statusCode = 403;
      error.code = 'UNAUTHORIZED_EVERYONE_MENTION';
      throw error;
    }
  }

  // Build reply preview if replying
  let replyPreview = null;
  if (replyToId) {
    const parent = await ChatMessage.findById(replyToId).populate('authorId', 'name preferredName');
    if (parent && parent.channelId.toString() === channelId.toString()) {
      replyPreview = {
        _id: parent._id.toString(),
        authorName: parent.authorId?.preferredName || parent.authorId?.name || 'Someone',
        content: parent.content.slice(0, 100),
      };
    }
  }

  const message = await ChatMessage.create({
    channelId,
    authorId: user.userId,
    kind: sharedMedia ? 'media_share' : 'text',
    content: sanitized,
    replyToId: replyToId || null,
    attachments: builtAttachments,
    sharedMedia: sharedMedia || null,
    seenBy: [{ userId: user.userId, seenAt: new Date() }],
  });

  const snippet = sanitized ? sanitized.slice(0, 80) : (sharedMedia ? `[Shared ${sharedMedia.title}]` : '[Attachment]');
  channel.lastMessageAt = new Date();
  channel.lastMessageSnippet = snippet;
  channel.lastMessageId = message._id;
  await channel.save();

  // Update sender's read marker
  member.lastReadMessageId = message._id;
  member.lastReadAt = new Date();
  await member.save();

  const populated = await ChatMessage.findById(message._id).populate('authorId', 'name preferredName avatarUrl role jobRole');

  // Asynchronous notification fan-out
  notifyChannelMembers(channel, populated, user).catch((err) => {
    logger.warn({ err: err.message }, 'Failed to dispatch chat notifications');
  });

  return populated;
}

/**
 * 13. Edit message (own message within 24h).
 */
export async function editMessage(channelId, messageId, user, { content }) {
  const message = await ChatMessage.findById(messageId);
  if (!message || message.channelId.toString() !== channelId.toString()) {
    const error = new Error('Message not found');
    error.statusCode = 404;
    throw error;
  }

  if (message.isDeleted) {
    const error = new Error('Cannot edit a deleted message.');
    error.statusCode = 400;
    throw error;
  }

  if (message.authorId.toString() !== user.userId.toString()) {
    const error = new Error('You can only edit your own messages.');
    error.statusCode = 403;
    throw error;
  }

  // 24 hour edit window
  const now = new Date();
  const diffHours = (now.getTime() - new Date(message.createdAt).getTime()) / (1000 * 60 * 60);
  if (diffHours > 24) {
    const error = new Error('Messages cannot be edited after 24 hours.');
    error.statusCode = 400;
    error.code = 'EDIT_WINDOW_EXPIRED';
    throw error;
  }

  const sanitized = sanitizeChatContent(content);
  if (!sanitized) {
    const error = new Error('Message content cannot be empty.');
    error.statusCode = 400;
    throw error;
  }

  message.content = sanitized;
  message.isEdited = true;
  message.editedAt = new Date();
  await message.save();

  return ChatMessage.findById(message._id).populate('authorId', 'name preferredName avatarUrl role jobRole');
}

/**
 * 14. Delete message (own message or admin moderation).
 */
export async function deleteMessage(channelId, messageId, user) {
  const message = await ChatMessage.findById(messageId);
  if (!message || message.channelId.toString() !== channelId.toString()) {
    const error = new Error('Message not found');
    error.statusCode = 404;
    throw error;
  }

  const isAuthor = message.authorId.toString() === user.userId.toString();
  const isAdmin = user.role === 'admin';

  if (!isAuthor && !isAdmin) {
    const error = new Error('You do not have permission to delete this message.');
    error.statusCode = 403;
    throw error;
  }

  message.isDeleted = true;
  message.deletedAt = new Date();
  message.deletedById = user.userId;
  message.content = isAuthor ? 'Message deleted' : 'Message removed by admin';
  message.attachments = [];
  await message.save();

  if (isAdmin && !isAuthor) {
    await logActivity({
      actor: user,
      action: 'chat.message.deleted',
      entityType: 'chat_message',
      entityId: message._id,
      metadata: { channelId, originalAuthorId: message.authorId },
    });
  }

  return message;
}

/**
 * 15. Toggle emoji reaction on a message.
 */
export async function toggleReaction(channelId, messageId, user, emoji) {
  if (user.role === 'executive') {
    const error = new Error('Executives cannot react to messages.');
    error.statusCode = 403;
    throw error;
  }

  const member = await ChannelMember.findOne({ channelId, userId: user.userId });
  if (!member) {
    const error = new Error('Access denied: Not a channel member');
    error.statusCode = 403;
    throw error;
  }

  if (!CHAT_REACTION_EMOJIS.includes(emoji)) {
    const error = new Error(`Invalid reaction emoji: ${emoji}`);
    error.statusCode = 400;
    throw error;
  }

  const message = await ChatMessage.findById(messageId);
  if (!message || message.channelId.toString() !== channelId.toString() || message.isDeleted) {
    const error = new Error('Message not found');
    error.statusCode = 404;
    throw error;
  }

  let reactionEntry = message.reactions.find((r) => r.emoji === emoji);
  const userIdStr = user.userId.toString();

  if (!reactionEntry) {
    message.reactions.push({ emoji, userIds: [user.userId] });
  } else {
    const userIndex = reactionEntry.userIds.findIndex((id) => id.toString() === userIdStr);
    if (userIndex > -1) {
      reactionEntry.userIds.splice(userIndex, 1);
    } else {
      reactionEntry.userIds.push(user.userId);
    }
  }

  // Filter out empty reactions
  message.reactions = message.reactions.filter((r) => r.userIds.length > 0);
  await message.save();

  return message;
}

/**
 * 16. Toggle pin status on a message (leaders, admin, group owner).
 */
export async function togglePinMessage(channelId, messageId, user) {
  const channel = await Channel.findById(channelId);
  if (!channel) {
    const error = new Error('Channel not found');
    error.statusCode = 404;
    throw error;
  }

  const member = await ChannelMember.findOne({ channelId, userId: user.userId });
  const isOwner = member?.role === 'owner';
  const isLeader = ['admin', 'creative_head', 'sm_manager'].includes(user.role);

  if (!isOwner && !isLeader) {
    const error = new Error('Only channel owners, leaders, or administrators can pin messages.');
    error.statusCode = 403;
    throw error;
  }

  const message = await ChatMessage.findById(messageId);
  if (!message || message.channelId.toString() !== channelId.toString() || message.isDeleted) {
    const error = new Error('Message not found');
    error.statusCode = 404;
    throw error;
  }

  if (!message.isPinned) {
    // Check max 10 pins
    const pinCount = await ChatMessage.countDocuments({ channelId, isPinned: true, isDeleted: false });
    if (pinCount >= 10) {
      const error = new Error('A channel can have a maximum of 10 pinned messages.');
      error.statusCode = 400;
      error.code = 'MAX_PINS_REACHED';
      throw error;
    }
    message.isPinned = true;
    message.pinnedAt = new Date();
    message.pinnedById = user.userId;
  } else {
    message.isPinned = false;
    message.pinnedAt = null;
    message.pinnedById = null;
  }

  await message.save();
  return message;
}

/**
 * 17. Mark channel as read.
 */
export async function markChannelAsRead(channelId, userId, messageId = null) {
  const member = await ChannelMember.findOne({ channelId, userId });
  if (!member) return;

  member.lastReadAt = new Date();
  if (messageId) {
    member.lastReadMessageId = messageId;
    await ChatMessage.updateOne(
      { _id: messageId, channelId, 'seenBy.userId': { $ne: userId } },
      { $push: { seenBy: { userId, seenAt: new Date() } } }
    );
  }
  await member.save();
  return { success: true };
}

/**
 * 18. Toggle channel mute.
 */
export async function setChannelMute(channelId, userId, isMuted) {
  const member = await ChannelMember.findOne({ channelId, userId });
  if (!member) {
    const error = new Error('Channel membership not found');
    error.statusCode = 404;
    throw error;
  }
  member.isMuted = !!isMuted;
  await member.save();
  return member;
}

/**
 * 19. Share approved asset to chat with scoped ShareGrant.
 */
export async function shareAssetToChat(user, { channelId, assetId, mediaItemId, assetType, contentPieceId, stageKey, note = '' }) {
  if (user.role === 'executive') {
    const error = new Error('Executives cannot share assets.');
    error.statusCode = 403;
    throw error;
  }

  const targetAssetId = (assetId || mediaItemId)?.toString();
  if (!targetAssetId) {
    const error = new Error('Asset ID or MediaItem ID is required.');
    error.statusCode = 400;
    throw error;
  }

  const channel = await Channel.findById(channelId);
  if (!channel || channel.isArchived) {
    const error = new Error('Destination channel is unavailable or archived.');
    error.statusCode = 400;
    throw error;
  }

  // Check that sharer belongs to destination channel
  if (channel.type === 'team') {
    const person = await Person.findById(user.userId);
    if (!person || person.status !== 'active') {
      const error = new Error('Active user account required to share to Team Chat.');
      error.statusCode = 403;
      throw error;
    }
  } else {
    const membership = await ChannelMember.findOne({
      channelId: channel._id,
      userId: user.userId,
    });
    if (!membership) {
      const error = new Error('You must be a member of the destination channel to share assets.');
      error.statusCode = 403;
      throw error;
    }
  }

  let piece = contentPieceId ? await ContentPiece.findById(contentPieceId) : null;
  let title = piece?.topic || 'Approved Asset';
  let thumbnailUrl = '';
  let previewUrl = '';
  let downloadUrl = '';
  let resolvedStageKey = stageKey || 'Review';
  let resolvedAssetType = assetType || 'clip';
  let isOwner = false;
  let clipDoc = null;
  let subDoc = null;

  // Try finding MediaItem (clip) first
  clipDoc = await MediaItem.findById(targetAssetId);
  if (clipDoc) {
    if (clipDoc.status !== 'approved') {
      const error = new Error('Only approved clips can be shared to chat.');
      error.statusCode = 400;
      error.code = 'ONLY_APPROVED_ASSETS_SHAREABLE';
      throw error;
    }
    resolvedAssetType = 'clip';
    resolvedStageKey = stageKey || 'Shoot';
    title = clipDoc.title || 'Approved Clip';
    thumbnailUrl = safeLink(clipDoc.thumbnailUrl);
    previewUrl = safeLink(clipDoc.url);
    downloadUrl = previewUrl;
    if (!piece && clipDoc.contentPieceId) {
      piece = await ContentPiece.findById(clipDoc.contentPieceId);
    }
    const stageItem = clipDoc.stageItemId ? await WorkItem.findById(clipDoc.stageItemId) : null;
    const clipOwnerIds = [
      clipDoc.uploadedBy,
      clipDoc.shooterId,
      clipDoc.createdBy,
      stageItem?.ownerId,
      stageItem?.assignedShooterId,
      piece?.assignedShooterId,
      piece?.assignedTeamMemberId,
    ]
      .filter(Boolean)
      .map((id) => id.toString());
    isOwner = clipOwnerIds.includes(user.userId.toString());
  } else {
    // Stage submission verification
    subDoc = await Submission.findById(targetAssetId);
    if (!subDoc || subDoc.status !== 'approved') {
      const error = new Error('Only approved submissions can be shared to chat.');
      error.statusCode = 400;
      error.code = 'ONLY_APPROVED_ASSETS_SHAREABLE';
      throw error;
    }
    resolvedAssetType = assetType || subDoc.assetType || 'finalCut';
    resolvedStageKey = stageKey || subDoc.stageKey || 'Review';
    if (!piece && subDoc.contentPieceId) {
      piece = await ContentPiece.findById(subDoc.contentPieceId);
    }
    title = subDoc.title || (piece ? `${piece.topic} - ${resolvedStageKey}` : 'Approved Deliverable');
    thumbnailUrl = safeLink(subDoc.thumbnailUrl);
    previewUrl = safeLink(subDoc.deliverableUrl || subDoc.fileUrl || (subDoc.files?.[0]?.url));
    downloadUrl = previewUrl;

    const subOwnerIds = [
      subDoc.submittedBy,
      subDoc.submittedById,
      subDoc.assignedTo,
      subDoc.workerId,
      piece?.assignedTeamMemberId,
    ]
      .filter(Boolean)
      .map((id) => id.toString());
    isOwner = subOwnerIds.includes(user.userId.toString());
  }

  // Permission check: only output owner, creative_head, sm_manager, and admin can share
  const isPrivilegedRole = ['admin', 'creative_head', 'sm_manager'].includes(user.role);
  if (!isPrivilegedRole && !isOwner) {
    const error = new Error('Only the asset owner, Creative Head, SM Manager, or Admin can share this asset.');
    error.statusCode = 403;
    error.code = 'FORBIDDEN_CANNOT_SHARE';
    throw error;
  }

  // Create or reuse active ShareGrant
  let grant = await ShareGrant.findOne({
    channelId: channel._id,
    assetId: targetAssetId,
    isRevoked: false,
  });

  if (!grant) {
    grant = await ShareGrant.create({
      channelId: channel._id,
      channel: channel._id,
      assetId: targetAssetId,
      mediaItem: clipDoc ? clipDoc._id : null,
      assetType: resolvedAssetType,
      contentPieceId: piece?._id || null,
      stageKey: resolvedStageKey,
      sharedById: user.userId,
      grantedBy: user.userId,
      isRevoked: false,
      revokedAt: null,
    });
  }

  const author = await Person.findById(user.userId).select('name preferredName avatarUrl');

  const sharedMedia = {
    grantId: grant._id,
    assetId: targetAssetId,
    assetType: resolvedAssetType,
    contentPieceId: piece?._id || null,
    contentPieceTitle: piece?.topic || 'Creative Piece',
    stageKey: resolvedStageKey,
    title,
    thumbnailUrl,
    previewUrl,
    downloadUrl,
    owner: {
      _id: author._id,
      name: author.name,
      preferredName: author.preferredName,
      avatarUrl: safeLink(author.avatarUrl),
    },
    note: sanitizeChatContent(note),
    isRevoked: false,
  };

  const message = await sendMessage(channelId, user, {
    content: note ? `${note}\n[Shared: ${title}]` : `Shared approved asset: ${title}`,
    sharedMedia,
  });

  // Link message ref in grant
  grant.message = message._id;
  await grant.save();

  // ActivityEvent for shared
  await logActivity({
    entityType: 'chat_share',
    entityId: grant._id,
    actor: user,
    action: 'chat.shared',
    metadata: {
      channelId: channel._id,
      channelName: channel.name,
      assetId: targetAssetId,
      title,
      contentPieceId: piece?._id || null,
    },
  }).catch(() => {});

  return { message, grant };
}

/**
 * 20. Revoke a ShareGrant.
 */
export async function revokeShareGrant(grantId, user) {
  const grant = await ShareGrant.findById(grantId);
  if (!grant) {
    const error = new Error('Share grant not found');
    error.statusCode = 404;
    throw error;
  }

  const sharerId = (grant.grantedBy || grant.sharedById)?.toString();
  const isSharer = sharerId === user.userId?.toString();
  const isLeader = ['admin', 'creative_head'].includes(user.role);

  if (!isSharer && !isLeader) {
    const error = new Error('Only the sharer, Creative Head, or an Administrator can revoke this share.');
    error.statusCode = 403;
    error.code = 'FORBIDDEN_REVOKE';
    throw error;
  }

  grant.isRevoked = true;
  grant.revokedAt = new Date();
  grant.revokedById = user.userId;
  await grant.save();

  // Mark message card revoked
  await ChatMessage.updateMany(
    { 'sharedMedia.grantId': grant._id },
    { $set: { 'sharedMedia.isRevoked': true, 'sharedMedia.revokedAt': new Date() } }
  );

  // ActivityEvent for unshared
  await logActivity({
    entityType: 'chat_share',
    entityId: grant._id,
    actor: user,
    action: 'chat.unshared',
    metadata: {
      channelId: grant.channelId || grant.channel,
      assetId: grant.assetId,
      grantId: grant._id,
    },
  }).catch(() => {});

  return grant;
}

/**
 * 21. Access shared media asset via ShareGrant with checked, signed short-lived URL.
 */
export async function getSharedAssetAccess(grantId, user) {
  const grant = await ShareGrant.findById(grantId);
  if (!grant || grant.isRevoked || grant.revokedAt) {
    const error = new Error('Asset access has been revoked or is no longer shared.');
    error.statusCode = 403;
    error.code = 'SHARE_REVOKED';
    throw error;
  }

  const channelId = grant.channelId || grant.channel;
  const channel = await Channel.findById(channelId);
  if (!channel) {
    const error = new Error('Channel no longer exists.');
    error.statusCode = 404;
    throw error;
  }

  let isMember = false;
  if (channel.type === 'team') {
    const person = await Person.findById(user.userId);
    isMember = person && person.status === 'active';
  } else {
    const membership = await ChannelMember.findOne({
      channelId: channel._id,
      userId: user.userId,
    });
    isMember = !!membership;
  }

  if (!isMember) {
    const error = new Error('Channel membership required to access this shared asset.');
    error.statusCode = 403;
    error.code = 'FORBIDDEN_CHANNEL_MEMBER_ONLY';
    throw error;
  }

  // Resolve ONLY that asset - never expose pipeline, reviews, comments, or ratings
  let title = 'Shared Media';
  let previewUrl = '';
  let downloadUrl = '';
  let mimeType = 'video/mp4';

  if (grant.assetType === 'clip') {
    const clip = await MediaItem.findById(grant.assetId);
    if (!clip) {
      const error = new Error('Shared asset no longer exists.');
      error.statusCode = 404;
      throw error;
    }
    title = clip.title;
    previewUrl = safeLink(clip.url);
    downloadUrl = previewUrl;
    mimeType = clip.mimeType || 'video/mp4';
  } else {
    const sub = await Submission.findById(grant.assetId);
    if (!sub) {
      const error = new Error('Shared deliverable no longer exists.');
      error.statusCode = 404;
      throw error;
    }
    title = sub.title || 'Deliverable';
    previewUrl = safeLink(sub.deliverableUrl || sub.fileUrl || (sub.files && sub.files[0]?.url));
    downloadUrl = previewUrl;
    mimeType = 'video/mp4';
  }

  // Short-lived signed signature (15 min)
  const expiresAt = Date.now() + 15 * 60 * 1000;
  const signature = crypto
    .createHmac('sha256', process.env.JWT_SECRET || 'haca-jwt-secret')
    .update(`${grant._id}:${user.userId}:${expiresAt}`)
    .digest('hex');

  const signedUrl = `/api/chat/shared-asset/${grant._id}?token=${signature}&expires=${expiresAt}`;

  return {
    grantId: grant._id,
    title,
    assetType: grant.assetType,
    stageKey: grant.stageKey,
    previewUrl,
    downloadUrl,
    signedUrl,
    mimeType,
    isRevoked: false,
  };
}

/**
 * 21. Search messages within user's accessible channels.
 */
export async function searchChatMessages(userId, { query = '', channelId = null }) {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const memberships = await ChannelMember.find({ userId });
  let channelIds = memberships.map((m) => m.channelId);

  if (channelId) {
    const hasAccess = channelIds.some((id) => id.toString() === channelId.toString());
    if (!hasAccess) {
      const error = new Error('Access denied to specified channel');
      error.statusCode = 403;
      throw error;
    }
    channelIds = [new mongoose.Types.ObjectId(channelId)];
  }

  // Escape regex special chars
  const safeRegex = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const messages = await ChatMessage.find({
    channelId: { $in: channelIds },
    content: { $regex: new RegExp(safeRegex, 'i') },
    isDeleted: false,
  })
    .populate('authorId', 'name preferredName avatarUrl role jobRole')
    .populate('channelId', 'name type')
    .sort({ createdAt: -1 })
    .limit(50);

  return messages;
}

/**
 * Helper to dispatch in-app notifications for new chat messages.
 */
async function notifyChannelMembers(channel, message, sender) {
  const members = await ChannelMember.find({
    channelId: channel._id,
    userId: { $ne: sender.userId },
  }).populate('userId', 'notificationPrefs preferredName name');

  const senderName = sender.preferredName || sender.name || 'Teammate';
  const channelLabel = channel.type === 'dm' ? 'Direct Message' : channel.name;

  for (const m of members) {
    const recipient = m.userId;
    if (!recipient) continue;

    // Check if channel is muted
    if (m.isMuted) continue;

    const chatPrefs = recipient.notificationPrefs?.chat;
    const mentionsOnly = chatPrefs?.mentionsOnly;

    // Check for @mention
    const isMentioned =
      message.content.includes(`@${recipient.preferredName}`) ||
      message.content.includes(`@${recipient.name}`) ||
      /@everyone\b/i.test(message.content);

    if (mentionsOnly && !isMentioned) continue;
    if (chatPrefs && chatPrefs.inApp === false && !isMentioned) continue;

    await createNotification({
      recipient: recipient._id,
      type: 'chat_message',
      title: isMentioned ? `${senderName} mentioned you in ${channelLabel}` : `New message from ${senderName}`,
      message: message.content.slice(0, 150),
      link: `/chat/${channel._id}?m=${message._id}`,
      metadata: { channelId: channel._id, messageId: message._id },
    }).catch(() => {});
  }
}
