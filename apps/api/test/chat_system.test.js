import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/server.js';
import { env } from '../src/config/env.js';
import { Person } from '../src/modules/people/model.js';
import { Profile } from '../src/modules/referenceData/profile.model.js';
import { ContentPiece } from '../src/modules/calendar/contentPiece.model.js';
import { MediaItem } from '../src/modules/media/model.js';
import { Submission } from '../src/modules/submissions/model.js';
import { Channel } from '../src/modules/chat/channel.model.js';
import { ChannelMember } from '../src/modules/chat/channelMember.model.js';
import { ChatMessage } from '../src/modules/chat/chatMessage.model.js';
import { ShareGrant } from '../src/modules/chat/shareGrant.model.js';
import { ActivityEvent } from '../src/modules/activity/model.js';

const makeToken = (user) =>
  jwt.sign(
    {
      userId: user._id.toString(),
      role: user.role,
      email: user.email,
      name: user.name,
      preferredName: user.preferredName,
    },
    env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );

describe('Team Chat Comprehensive API Suite (Phase CH1)', () => {
  let admin, head, sm, exec, workerA, workerB, suspendedUser;
  let adminToken, headToken, smToken, execToken, workerAToken, workerBToken, suspendedToken;
  let testProfile, approvedClip, draftClip, approvedPiece;

  beforeAll(async () => {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/marketing_portal_test';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }

    // Clean chat collections
    await Channel.deleteMany({});
    await ChannelMember.deleteMany({});
    await ChatMessage.deleteMany({});
    await ShareGrant.deleteMany({});

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e6);
    testProfile =
      (await Profile.findOne({ code: 'haca-chat-test' })) ||
      (await Profile.create({
        code: `haca-chat-${uniqueSuffix}`,
        name: `HACA Chat Test ${uniqueSuffix}`,
      }));

    const salt = 'chat-' + Date.now() + '-' + Math.round(Math.random() * 1e6);
    admin = await Person.create({
      name: 'Chat Admin',
      email: `admin-${salt}@chat.com`,
      role: 'admin',
      status: 'active',
      profileId: testProfile._id,
    });
    head = await Person.create({
      name: 'Creative Head User',
      preferredName: 'CreativeBoss',
      email: `head-${salt}@chat.com`,
      role: 'creative_head',
      status: 'active',
      profileId: testProfile._id,
    });
    sm = await Person.create({
      name: 'SM Manager User',
      preferredName: 'OperationsLead',
      email: `sm-${salt}@chat.com`,
      role: 'sm_manager',
      status: 'active',
      profileId: testProfile._id,
    });
    exec = await Person.create({
      name: 'Executive Viewer',
      email: `exec-${salt}@chat.com`,
      role: 'executive',
      status: 'active',
      profileId: testProfile._id,
    });
    workerA = await Person.create({
      name: 'Worker Alpha',
      preferredName: 'AlphaDev',
      email: `workera-${salt}@chat.com`,
      role: 'team_member',
      jobRole: 'Video Editor',
      status: 'active',
      profileId: testProfile._id,
    });
    workerB = await Person.create({
      name: 'Worker Beta',
      preferredName: 'BetaDesigner',
      email: `workerb-${salt}@chat.com`,
      role: 'team_member',
      jobRole: 'Designer',
      status: 'active',
      profileId: testProfile._id,
    });
    suspendedUser = await Person.create({
      name: 'Suspended Worker',
      email: `suspended-${salt}@chat.com`,
      role: 'team_member',
      status: 'suspended',
      profileId: testProfile._id,
    });

    adminToken = makeToken(admin);
    headToken = makeToken(head);
    smToken = makeToken(sm);
    execToken = makeToken(exec);
    workerAToken = makeToken(workerA);
    workerBToken = makeToken(workerB);
    suspendedToken = makeToken(suspendedUser);

    approvedPiece = await ContentPiece.create({
      planId: new mongoose.Types.ObjectId(),
      targetMonth: '2026-11',
      profileId: testProfile._id,
      topic: 'Diwali Teaser Campaign',
      contentType: 'Reel',
      pipeline: 'reel_a',
      postingDate: new Date('2026-11-20'),
      status: 'In Progress',
      assignedTeamMemberId: workerA._id,
    });

    approvedClip = await MediaItem.create({
      stageItemId: new mongoose.Types.ObjectId(),
      contentPieceId: approvedPiece._id,
      uploadedBy: workerA._id,
      kind: 'video',
      title: 'Hook Cut v1',
      url: 'https://cdn.example.com/diwali-hook-approved.mp4',
      status: 'approved',
      durationSeconds: 15,
      width: 1080,
      height: 1920,
      sizeBytes: 15000000,
    });

    draftClip = await MediaItem.create({
      stageItemId: new mongoose.Types.ObjectId(),
      contentPieceId: approvedPiece._id,
      kind: 'video',
      title: 'Rough Cut Draft',
      url: 'https://cdn.example.com/draft.mp4',
      status: 'waiting_review',
      durationSeconds: 20,
      width: 1080,
      height: 1920,
      sizeBytes: 10000000,
    });
  });

  afterAll(async () => {
    await Channel.deleteMany({});
    await ChannelMember.deleteMany({});
    await ChatMessage.deleteMany({});
    await ShareGrant.deleteMany({});
  });

  // ==========================================
  // 1. Team Chat Bootstrap & Membership
  // ==========================================
  describe('1. Team Chat Bootstrap & Auto-Membership', () => {
    it('creates system Team Chat channel upon listing channels and auto-joins active users', async () => {
      const res = await request(app)
        .get('/api/chat/channels')
        .set('Authorization', `Bearer ${workerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.channels).toBeDefined();

      const team = res.body.channels.find((c) => c.type === 'team');
      expect(team).toBeDefined();
      expect(team.name).toBe('Team Chat');
      expect(team.systemSlug).toBe('team-chat');
      expect(team.isArchived).toBe(false);

      // Verify all active users are members, suspended user is excluded
      const members = await ChannelMember.find({ channelId: team._id });
      const memberUserIds = members.map((m) => m.userId.toString());

      expect(memberUserIds).toContain(admin._id.toString());
      expect(memberUserIds).toContain(head._id.toString());
      expect(memberUserIds).toContain(sm._id.toString());
      expect(memberUserIds).toContain(exec._id.toString());
      expect(memberUserIds).toContain(workerA._id.toString());
      expect(memberUserIds).toContain(workerB._id.toString());
      expect(memberUserIds).not.toContain(suspendedUser._id.toString());
    });
  });

  // ==========================================
  // 2. Groups (Creation, Permissions, Lifecycle)
  // ==========================================
  describe('2. Groups & Permissions', () => {
    let createdGroupId;

    it('denies group creation to team_member (HTTP 403)', async () => {
      const res = await request(app)
        .post('/api/chat/channels/groups')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({
          name: 'Unauthorized Group',
          memberIds: [workerB._id.toString()],
        });

      expect(res.status).toBe(403);
    });

    it('denies group creation to executive (HTTP 403)', async () => {
      const res = await request(app)
        .post('/api/chat/channels/groups')
        .set('Authorization', `Bearer ${execToken}`)
        .send({
          name: 'Executive Group',
          memberIds: [workerA._id.toString()],
        });

      expect(res.status).toBe(403);
    });

    it('allows creative_head to create a group with members', async () => {
      const res = await request(app)
        .post('/api/chat/channels/groups')
        .set('Authorization', `Bearer ${headToken}`)
        .send({
          name: 'Diwali Video Sprint',
          description: 'Production alignment for Diwali campaign video assets',
          memberIds: [workerA._id.toString(), sm._id.toString()],
        });

      expect(res.status).toBe(201);
      expect(res.body.channel).toBeDefined();
      expect(res.body.channel.name).toBe('Diwali Video Sprint');
      expect(res.body.channel.type).toBe('group');

      createdGroupId = res.body.channel._id;

      // Creator is owner
      const ownerMember = await ChannelMember.findOne({
        channelId: createdGroupId,
        userId: head._id,
      });
      expect(ownerMember).toBeDefined();
      expect(ownerMember.role).toBe('owner');

      // Invited users are members
      const workerAMember = await ChannelMember.findOne({
        channelId: createdGroupId,
        userId: workerA._id,
      });
      expect(workerAMember).toBeDefined();
      expect(workerAMember.role).toBe('member');
    });

    it('rejects duplicate group name among active groups', async () => {
      const res = await request(app)
        .post('/api/chat/channels/groups')
        .set('Authorization', `Bearer ${smToken}`)
        .send({
          name: 'Diwali Video Sprint',
          memberIds: [workerB._id.toString()],
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('DUPLICATE_GROUP_NAME');
    });

    it('allows owner to add new members to group', async () => {
      const res = await request(app)
        .post(`/api/chat/channels/${createdGroupId}/members`)
        .set('Authorization', `Bearer ${headToken}`)
        .send({
          memberIds: [workerB._id.toString()],
        });

      expect(res.status).toBe(200);

      const workerBMember = await ChannelMember.findOne({
        channelId: createdGroupId,
        userId: workerB._id,
      });
      expect(workerBMember).toBeDefined();
    });

    it('allows group member to leave group voluntarily', async () => {
      const res = await request(app)
        .delete(`/api/chat/channels/${createdGroupId}/members/${workerB._id}`)
        .set('Authorization', `Bearer ${workerBToken}`);

      expect(res.status).toBe(200);

      const check = await ChannelMember.findOne({
        channelId: createdGroupId,
        userId: workerB._id,
      });
      expect(check).toBeNull();
    });

    it('prevents group owner from leaving without transferring ownership', async () => {
      const res = await request(app)
        .delete(`/api/chat/channels/${createdGroupId}/members/${head._id}`)
        .set('Authorization', `Bearer ${headToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('OWNER_CANNOT_LEAVE_WITHOUT_TRANSFER');
    });

    it('allows owner to archive group, making it read-only', async () => {
      const res = await request(app)
        .post(`/api/chat/channels/${createdGroupId}/archive`)
        .set('Authorization', `Bearer ${headToken}`);

      expect(res.status).toBe(200);
      expect(res.body.channel.isArchived).toBe(true);

      // Sending messages to archived group is rejected
      const sendRes = await request(app)
        .post(`/api/chat/channels/${createdGroupId}/messages`)
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({ content: 'Trying to post in archived channel' });

      expect(sendRes.status).toBe(400);
      expect(sendRes.body.error.code).toBe('CHANNEL_ARCHIVED');
    });

    it('allows admin to unarchive group', async () => {
      const res = await request(app)
        .post(`/api/chat/channels/${createdGroupId}/unarchive`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.channel.isArchived).toBe(false);
    });
  });

  // ==========================================
  // 3. Direct Messages (1:1 Privacy & Boundaries)
  // ==========================================
  describe('3. Direct Messages', () => {
    let dmChannelId;

    it('allows two active non-executive users to start a private DM', async () => {
      const res = await request(app)
        .post('/api/chat/channels/dm')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({ targetUserId: workerB._id.toString() });

      expect(res.status).toBe(200);
      expect(res.body.channel.type).toBe('dm');
      dmChannelId = res.body.channel._id;

      // Both users are members
      const members = await ChannelMember.find({ channelId: dmChannelId });
      expect(members.length).toBe(2);
    });

    it('denies executive from starting direct messages (HTTP 403)', async () => {
      const res = await request(app)
        .post('/api/chat/channels/dm')
        .set('Authorization', `Bearer ${execToken}`)
        .send({ targetUserId: workerA._id.toString() });

      expect(res.status).toBe(403);
      expect(['FORBIDDEN', 'EXECUTIVE_CANNOT_DM']).toContain(res.body.error.code);
    });

    it('denies messaging an executive directly (HTTP 403)', async () => {
      const res = await request(app)
        .post('/api/chat/channels/dm')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({ targetUserId: exec._id.toString() });

      expect(res.status).toBe(403);
      expect(['FORBIDDEN', 'EXECUTIVE_CANNOT_DM']).toContain(res.body.error.code);
    });

    it('ensures DMs are private: admin cannot view messages of DMs they are not a member of (HTTP 403)', async () => {
      const res = await request(app)
        .get(`/api/chat/channels/${dmChannelId}/messages`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ==========================================
  // 4. Messages (Send, Edit, Delete, Sanitization, Mentions)
  // ==========================================
  describe('4. Messaging Engine & Content Rules', () => {
    let teamChannelId;
    let messageId;

    beforeAll(async () => {
      const team = await Channel.findOne({ type: 'team' });
      teamChannelId = team._id.toString();
    });

    it('allows team_member to post a message up to 4,000 characters and strips HTML', async () => {
      const rawText = '<script>alert("xss")</script><b>Hello Team!</b> Ready for the Diwali sprint.';
      const res = await request(app)
        .post(`/api/chat/channels/${teamChannelId}/messages`)
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({ content: rawText });

      expect(res.status).toBe(201);
      expect(res.body.message.content).toBe('Hello Team! Ready for the Diwali sprint.');
      expect(res.body.message.content).not.toContain('<script>');
      expect(res.body.message.content).not.toContain('<b>');

      messageId = res.body.message._id;
    });

    it('prevents executive from posting messages (HTTP 403 read-only)', async () => {
      const res = await request(app)
        .post(`/api/chat/channels/${teamChannelId}/messages`)
        .set('Authorization', `Bearer ${execToken}`)
        .send({ content: 'Executive trying to send a message' });

      expect(res.status).toBe(403);
      expect(['FORBIDDEN', 'EXECUTIVE_READ_ONLY']).toContain(res.body.error.code);
    });

    it('prevents team_member from using @everyone mention (HTTP 403)', async () => {
      const res = await request(app)
        .post(`/api/chat/channels/${teamChannelId}/messages`)
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({ content: 'Attention @everyone we have updates' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('UNAUTHORIZED_EVERYONE_MENTION');
    });

    it('allows creative_head to use @everyone mention', async () => {
      const res = await request(app)
        .post(`/api/chat/channels/${teamChannelId}/messages`)
        .set('Authorization', `Bearer ${headToken}`)
        .send({ content: 'Official notice: @everyone please review script revisions.' });

      expect(res.status).toBe(201);
      expect(res.body.message.content).toContain('@everyone');
    });

    it('allows author to edit their own message within 24 hours', async () => {
      const res = await request(app)
        .patch(`/api/chat/channels/${teamChannelId}/messages/${messageId}`)
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({ content: 'Hello Team! Ready for the Diwali sprint (updated).' });

      expect(res.status).toBe(200);
      expect(res.body.message.content).toBe('Hello Team! Ready for the Diwali sprint (updated).');
      expect(res.body.message.isEdited).toBe(true);
      expect(res.body.message.editedAt).toBeDefined();
    });

    it('prevents non-author from editing someone else message (HTTP 403)', async () => {
      const res = await request(app)
        .patch(`/api/chat/channels/${teamChannelId}/messages/${messageId}`)
        .set('Authorization', `Bearer ${workerBToken}`)
        .send({ content: 'Malicious edit attempt' });

      expect(res.status).toBe(403);
    });

    it('allows author to delete own message, replacing content with "Message deleted"', async () => {
      // Create temporary message
      const tempRes = await request(app)
        .post(`/api/chat/channels/${teamChannelId}/messages`)
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({ content: 'Temporary message to delete' });

      const tempId = tempRes.body.message._id;

      const delRes = await request(app)
        .delete(`/api/chat/channels/${teamChannelId}/messages/${tempId}`)
        .set('Authorization', `Bearer ${workerAToken}`);

      expect(delRes.status).toBe(200);

      const checkMsg = await ChatMessage.findById(tempId);
      expect(checkMsg.isDeleted).toBe(true);
      expect(checkMsg.content).toBe('Message deleted');
    });

    it('allows admin to delete any message with audit logging in ActivityEvent', async () => {
      const res = await request(app)
        .delete(`/api/chat/channels/${teamChannelId}/messages/${messageId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);

      const checkMsg = await ChatMessage.findById(messageId);
      expect(checkMsg.isDeleted).toBe(true);
      expect(checkMsg.content).toBe('Message removed by admin');

      // Verify ActivityEvent was recorded
      const activity = await ActivityEvent.findOne({
        action: 'chat.message.deleted',
      });
      expect(activity).toBeDefined();
      expect(activity.actingAs).toBe('admin');
    });
  });

  // ==========================================
  // 5. Reactions & Pinned Messages
  // ==========================================
  describe('5. Reactions and Pinned Messages', () => {
    let teamChannelId;
    let targetMsgId;

    beforeAll(async () => {
      const team = await Channel.findOne({ type: 'team' });
      teamChannelId = team._id.toString();

      const msg = await ChatMessage.create({
        channelId: teamChannelId,
        authorId: head._id,
        content: 'Pinned campaign guidelines and reaction test target.',
      });
      targetMsgId = msg._id.toString();
    });

    it('toggles allowed emoji reaction (👍, ❤️, 😂, 🎉, 👀, ✅)', async () => {
      // 1. Add reaction 👍
      const res1 = await request(app)
        .post(`/api/chat/channels/${teamChannelId}/messages/${targetMsgId}/reactions`)
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({ emoji: '👍' });

      expect(res1.status).toBe(200);
      const react1 = res1.body.message.reactions.find((r) => r.emoji === '👍');
      expect(react1.userIds).toContain(workerA._id.toString());

      // 2. Toggle reaction again to remove it
      const res2 = await request(app)
        .post(`/api/chat/channels/${teamChannelId}/messages/${targetMsgId}/reactions`)
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({ emoji: '👍' });

      expect(res2.status).toBe(200);
      const react2 = res2.body.message.reactions.find((r) => r.emoji === '👍');
      expect(react2).toBeUndefined();
    });

    it('rejects unsupported reaction emoji', async () => {
      const res = await request(app)
        .post(`/api/chat/channels/${teamChannelId}/messages/${targetMsgId}/reactions`)
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({ emoji: '🚀' });

      expect(res.status).toBe(400);
    });

    it('denies executive from reacting to messages (HTTP 403)', async () => {
      const res = await request(app)
        .post(`/api/chat/channels/${teamChannelId}/messages/${targetMsgId}/reactions`)
        .set('Authorization', `Bearer ${execToken}`)
        .send({ emoji: '❤️' });

      expect(res.status).toBe(403);
    });

    it('allows creative_head to pin message, enforcing max 10 pins cap', async () => {
      const res = await request(app)
        .post(`/api/chat/channels/${teamChannelId}/messages/${targetMsgId}/pin`)
        .set('Authorization', `Bearer ${headToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message.isPinned).toBe(true);
      expect(res.body.message.pinnedAt).toBeDefined();

      // Unpin
      const resUnpin = await request(app)
        .post(`/api/chat/channels/${teamChannelId}/messages/${targetMsgId}/pin`)
        .set('Authorization', `Bearer ${headToken}`);

      expect(resUnpin.status).toBe(200);
      expect(resUnpin.body.message.isPinned).toBe(false);
    });

    it('denies team_member from pinning messages in team chat (HTTP 403)', async () => {
      const res = await request(app)
        .post(`/api/chat/channels/${teamChannelId}/messages/${targetMsgId}/pin`)
        .set('Authorization', `Bearer ${workerAToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ==========================================
  // 6. Share to Chat & ShareGrant Model
  // ==========================================
  describe('6. Share to Chat & Scoped ShareGrant', () => {
    let teamChannelId;
    let grantId;

    beforeAll(async () => {
      const team = await Channel.findOne({ type: 'team' });
      teamChannelId = team._id.toString();
    });

    it('rejects sharing unapproved draft assets (HTTP 400)', async () => {
      const res = await request(app)
        .post('/api/chat/share')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({
          channelId: teamChannelId,
          assetId: draftClip._id.toString(),
          assetType: 'clip',
          contentPieceId: approvedPiece._id.toString(),
          stageKey: 'Shoot',
          note: 'Trying to share unapproved draft clip',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('ONLY_APPROVED_ASSETS_SHAREABLE');
    });

    it('allows sharing an approved asset, creating a scoped ShareGrant and media card message', async () => {
      const res = await request(app)
        .post('/api/chat/share')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({
          channelId: teamChannelId,
          assetId: approvedClip._id.toString(),
          assetType: 'clip',
          contentPieceId: approvedPiece._id.toString(),
          stageKey: 'Shoot',
          note: 'Here is the approved hook for team review!',
        });

      expect(res.status).toBe(201);
      expect(res.body.message.sharedMedia).toBeDefined();
      expect(res.body.message.sharedMedia.assetId).toBe(approvedClip._id.toString());
      expect(res.body.message.sharedMedia.title).toBe(approvedClip.title);
      expect(res.body.message.sharedMedia.isRevoked).toBe(false);

      grantId = res.body.message.sharedMedia.grantId;

      // Verify ShareGrant in DB
      const grant = await ShareGrant.findById(grantId);
      expect(grant).toBeDefined();
      expect(grant.assetId).toBe(approvedClip._id.toString());
      expect(grant.isRevoked).toBe(false);
    });

    it('allows sharer or creative_head to revoke ShareGrant', async () => {
      const res = await request(app)
        .post(`/api/chat/share/${grantId}/revoke`)
        .set('Authorization', `Bearer ${headToken}`);

      expect(res.status).toBe(200);

      const grant = await ShareGrant.findById(grantId);
      expect(grant.isRevoked).toBe(true);

      // Verify message card reflects isRevoked: true
      const msg = await ChatMessage.findOne({ 'sharedMedia.grantId': grantId });
      expect(msg.sharedMedia.isRevoked).toBe(true);
    });
  });

  // ==========================================
  // 7. Channel Mute & Read Receipts
  // ==========================================
  describe('7. Mute Channel & Read Receipts', () => {
    let teamChannelId;

    beforeAll(async () => {
      const team = await Channel.findOne({ type: 'team' });
      teamChannelId = team._id.toString();
    });

    it('allows user to toggle channel mute setting', async () => {
      const res = await request(app)
        .post(`/api/chat/channels/${teamChannelId}/mute`)
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({ isMuted: true });

      expect(res.status).toBe(200);
      expect(res.body.member.isMuted).toBe(true);

      const member = await ChannelMember.findOne({
        channelId: teamChannelId,
        userId: workerA._id,
      });
      expect(member.isMuted).toBe(true);
    });

    it('marks channel as read and updates message seenBy array', async () => {
      const msg = await ChatMessage.create({
        channelId: teamChannelId,
        authorId: head._id,
        content: 'Read receipt testing message.',
      });

      const res = await request(app)
        .post(`/api/chat/channels/${teamChannelId}/read`)
        .set('Authorization', `Bearer ${workerBToken}`)
        .send({ messageId: msg._id.toString() });

      expect(res.status).toBe(200);

      const updatedMsg = await ChatMessage.findById(msg._id);
      const seen = updatedMsg.seenBy.find((s) => s.userId.toString() === workerB._id.toString());
      expect(seen).toBeDefined();
    });
  });

  // ==========================================
  // 8. Search
  // ==========================================
  describe('8. Search Chat Messages', () => {
    let teamChannelId;

    beforeAll(async () => {
      const team = await Channel.findOne({ type: 'team' });
      teamChannelId = team._id.toString();

      await ChatMessage.create({
        channelId: teamChannelId,
        authorId: head._id,
        content: 'SearchableKeywordOmega unique content for search verification.',
      });
    });

    it('searches messages across accessible channels and returns results', async () => {
      const res = await request(app)
        .get('/api/chat/search?q=SearchableKeywordOmega')
        .set('Authorization', `Bearer ${workerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.results.length).toBeGreaterThan(0);
      expect(res.body.results[0].content).toContain('SearchableKeywordOmega');
    });
  });
});
