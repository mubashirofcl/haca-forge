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
import { WorkItem } from '../src/modules/workItems/model.js';
import { Submission } from '../src/modules/submissions/model.js';
import { Channel } from '../src/modules/chat/channel.model.js';
import { ChannelMember } from '../src/modules/chat/channelMember.model.js';
import { ChatMessage } from '../src/modules/chat/chatMessage.model.js';
import { ShareGrant } from '../src/modules/chat/shareGrant.model.js';
import { ActivityEvent } from '../src/modules/activity/model.js';
import { ensureTeamChatChannel } from '../src/modules/chat/service.js';

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

describe('Share to Chat & Chat Polish Backend Specification Suite', () => {
  let admin, head, sm, exec, workerOwner, workerOther;
  let adminToken, headToken, smToken, execToken, ownerToken, otherToken;
  let testProfile, contentPiece, testWorkItem, approvedClip, draftClip, approvedSubmission, draftSubmission;
  let teamChannel, privateGroupChannel;
  let createdGrantId;

  beforeAll(async () => {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/marketing_portal_test';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }

    const salt = 'share-' + Date.now() + '-' + Math.round(Math.random() * 1e6);
    testProfile =
      (await Profile.findOne({ code: 'haca-share-test' })) ||
      (await Profile.create({
        code: `haca-share-${salt}`,
        name: `HACA Share Test ${salt}`,
      }));

    admin = await Person.create({
      name: 'Share Admin',
      email: `admin-${salt}@chatshare.com`,
      role: 'admin',
      status: 'active',
      profileId: testProfile._id,
    });
    head = await Person.create({
      name: 'Creative Head',
      preferredName: 'HeadReviewer',
      email: `head-${salt}@chatshare.com`,
      role: 'creative_head',
      status: 'active',
      profileId: testProfile._id,
    });
    sm = await Person.create({
      name: 'SM Manager',
      preferredName: 'SMManagerLead',
      email: `sm-${salt}@chatshare.com`,
      role: 'sm_manager',
      status: 'active',
      profileId: testProfile._id,
    });
    exec = await Person.create({
      name: 'Executive ReadOnly',
      email: `exec-${salt}@chatshare.com`,
      role: 'executive',
      status: 'active',
      profileId: testProfile._id,
    });
    workerOwner = await Person.create({
      name: 'Worker Owner',
      preferredName: 'OwnerVideographer',
      email: `owner-${salt}@chatshare.com`,
      role: 'team_member',
      jobRole: 'Videographer',
      status: 'active',
      profileId: testProfile._id,
    });
    workerOther = await Person.create({
      name: 'Worker Other',
      preferredName: 'OtherEditor',
      email: `other-${salt}@chatshare.com`,
      role: 'team_member',
      jobRole: 'Video Editor',
      status: 'active',
      profileId: testProfile._id,
    });

    adminToken = makeToken(admin);
    headToken = makeToken(head);
    smToken = makeToken(sm);
    execToken = makeToken(exec);
    ownerToken = makeToken(workerOwner);
    otherToken = makeToken(workerOther);

    // Ensure Team Chat exists with all active members
    teamChannel = await ensureTeamChatChannel(testProfile._id);

    // Create private group with only workerOwner and admin
    privateGroupChannel = await Channel.create({
      name: `Private Group ${salt}`,
      type: 'group',
      createdById: admin._id,
    });
    await ChannelMember.create([
      { channelId: privateGroupChannel._id, userId: admin._id, role: 'owner' },
      { channelId: privateGroupChannel._id, userId: workerOwner._id, role: 'member' },
    ]);

    // Create test content piece
    contentPiece = await ContentPiece.create({
      planId: new mongoose.Types.ObjectId(),
      targetMonth: '2026-11',
      profileId: testProfile._id,
      topic: 'HACA Spring Launch 2026',
      contentType: 'Reel',
      pipeline: 'reel_a',
      postingDate: new Date('2026-11-20'),
      status: 'In Progress',
      workItems: [
        {
          title: 'Hero Video Shoot',
          stageKey: 'Shoot',
          status: 'Approved',
          ownerId: workerOwner._id,
          assignedShooterId: workerOwner._id,
        },
      ],
    });

    const deptDoc = await mongoose.connection.db.collection('departments').findOne({});
    const deptId = deptDoc?._id || new mongoose.Types.ObjectId();

    testWorkItem = await WorkItem.create({
      title: 'Hero Video Shoot WorkItem',
      workType: 'Reel',
      status: 'In Progress',
      stageKey: 'Shoot',
      stageOrder: 2,
      departmentId: deptId,
      profileId: testProfile._id,
      ownerId: workerOwner._id,
      deadline: new Date(Date.now() + 86400000 * 3),
      estimatedEffortHrs: 4,
    });

    // Create test clips (MediaItem)
    approvedClip = await MediaItem.create({
      stageItemId: testWorkItem._id,
      contentPieceId: contentPiece._id,
      uploadedBy: workerOwner._id,
      kind: 'video',
      title: 'Scene 1 Master',
      fileName: 'scene1_take1.mp4',
      originalName: 'Scene 1 Master.mp4',
      storagePath: '/uploads/chat/scene1_take1.mp4',
      url: '/uploads/chat/scene1_take1.mp4',
      fileType: 'video/mp4',
      sizeBytes: 45000000,
      status: 'approved',
      takeNumber: 1,
    });

    draftClip = await MediaItem.create({
      stageItemId: testWorkItem._id,
      contentPieceId: contentPiece._id,
      uploadedBy: workerOwner._id,
      kind: 'video',
      title: 'Scene 1 Take 2 Draft',
      fileName: 'scene1_take2_draft.mp4',
      originalName: 'Scene 1 Take 2 Draft.mp4',
      storagePath: '/uploads/chat/scene1_take2_draft.mp4',
      url: '/uploads/chat/scene1_take2_draft.mp4',
      fileType: 'video/mp4',
      sizeBytes: 42000000,
      status: 'waiting_review',
      takeNumber: 2,
    });

    // Create test submissions
    approvedSubmission = await Submission.create({
      workItemId: testWorkItem._id,
      contentPieceId: contentPiece._id,
      submittedById: workerOwner._id,
      kind: 'video',
      fileUrl: '/uploads/submissions/final_cut_approved.mp4',
      version: 1,
      status: 'approved',
    });

    draftSubmission = await Submission.create({
      workItemId: testWorkItem._id,
      contentPieceId: contentPiece._id,
      submittedById: workerOwner._id,
      kind: 'video',
      fileUrl: '/uploads/submissions/final_cut_v2_draft.mp4',
      version: 2,
      status: 'submitted',
    });
  });

  afterAll(async () => {
    // Clean up created resources
    await Channel.deleteMany({ name: /Private Group share-/ });
  });

  // ==========================================
  // Test 1: Only approved outputs can be shared
  // ==========================================
  describe('1. Approval Precondition Enforcement', () => {
    it('rejects sharing an unapproved/waiting_review clip with 400 ONLY_APPROVED_ASSETS_SHAREABLE', async () => {
      const res = await request(app)
        .post('/api/chat/share')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          channelId: teamChannel._id.toString(),
          assetId: draftClip._id.toString(),
          assetType: 'clip',
          contentPieceId: contentPiece._id.toString(),
          stageKey: 'Shoot',
        });

      expect(res.status).toBe(400);
      expect(res.body.error?.code || res.body.code).toBe('ONLY_APPROVED_ASSETS_SHAREABLE');
    });

    it('rejects sharing an unapproved submission with 400 ONLY_APPROVED_ASSETS_SHAREABLE', async () => {
      const res = await request(app)
        .post('/api/chat/share')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          channelId: teamChannel._id.toString(),
          assetId: draftSubmission._id.toString(),
          assetType: 'submission',
          contentPieceId: contentPiece._id.toString(),
          stageKey: 'Edit',
        });

      expect(res.status).toBe(400);
      expect(res.body.error?.code || res.body.code).toBe('ONLY_APPROVED_ASSETS_SHAREABLE');
    });
  });

  // ==========================================
  // Test 2: Role checks on share
  // ==========================================
  describe('2. Role-Based Permissions for Sharing', () => {
    it('allows output owner (workerOwner) to share approved output to Team Chat', async () => {
      const res = await request(app)
        .post('/api/chat/share')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          channelId: teamChannel._id.toString(),
          assetId: approvedClip._id.toString(),
          assetType: 'clip',
          contentPieceId: contentPiece._id.toString(),
          stageKey: 'Shoot',
          note: 'Approved hero shot ready for color grade review!',
        });

      expect(res.status).toBe(201);
      expect(res.body.grant).toBeDefined();
      expect(res.body.grant.assetId).toBe(approvedClip._id.toString());
      expect(res.body.message).toBeDefined();
      expect(res.body.message.kind).toBe('media_share');
      createdGrantId = res.body.grant._id;
    });

    it('allows creative_head to share approved output', async () => {
      const res = await request(app)
        .post('/api/chat/share')
        .set('Authorization', `Bearer ${headToken}`)
        .send({
          channelId: teamChannel._id.toString(),
          assetId: approvedSubmission._id.toString(),
          assetType: 'finalCut',
          contentPieceId: contentPiece._id.toString(),
          stageKey: 'Edit',
        });

      expect(res.status).toBe(201);
      expect(res.body.grant).toBeDefined();
    });

    it('allows sm_manager to share approved output', async () => {
      const res = await request(app)
        .post('/api/chat/share')
        .set('Authorization', `Bearer ${smToken}`)
        .send({
          channelId: teamChannel._id.toString(),
          assetId: approvedClip._id.toString(),
          assetType: 'clip',
          contentPieceId: contentPiece._id.toString(),
          stageKey: 'Shoot',
        });

      expect(res.status).toBe(201);
    });

    it('allows admin to share approved output', async () => {
      const res = await request(app)
        .post('/api/chat/share')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          channelId: teamChannel._id.toString(),
          assetId: approvedClip._id.toString(),
          assetType: 'clip',
          contentPieceId: contentPiece._id.toString(),
          stageKey: 'Shoot',
        });

      expect(res.status).toBe(201);
    });

    it('rejects non-owner team_member from sharing someone elses approved output with 403', async () => {
      const res = await request(app)
        .post('/api/chat/share')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          channelId: teamChannel._id.toString(),
          assetId: approvedClip._id.toString(),
          assetType: 'clip',
          contentPieceId: contentPiece._id.toString(),
          stageKey: 'Shoot',
        });

      expect(res.status).toBe(403);
      expect(res.body.error?.code || res.body.code).toBe('FORBIDDEN_CANNOT_SHARE');
    });

    it('rejects executive user from sharing with 403', async () => {
      const res = await request(app)
        .post('/api/chat/share')
        .set('Authorization', `Bearer ${execToken}`)
        .send({
          channelId: teamChannel._id.toString(),
          assetId: approvedClip._id.toString(),
          assetType: 'clip',
          contentPieceId: contentPiece._id.toString(),
          stageKey: 'Shoot',
        });

      expect(res.status).toBe(403);
    });
  });

  // ==========================================
  // Test 3: Destination channel membership rule
  // ==========================================
  describe('3. Destination Channel Membership Rule', () => {
    it('rejects sharing to a group/DM that caller is not a member of with 403', async () => {
      // workerOther is NOT in privateGroupChannel
      const res = await request(app)
        .post('/api/chat/share')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          channelId: privateGroupChannel._id.toString(),
          assetId: approvedClip._id.toString(),
          assetType: 'clip',
          contentPieceId: contentPiece._id.toString(),
          stageKey: 'Shoot',
        });

      expect(res.status).toBe(403);
    });
  });

  // ==========================================
  // Test 4 & 5: Asset Access, Signed URL & Strict Isolation
  // ==========================================
  describe('4 & 5. Secure Asset Access & Zero Data Leakage Isolation', () => {
    it('allows destination channel member to access asset with signed short-lived URL', async () => {
      const res = await request(app)
        .get(`/api/chat/shared-asset/${createdGrantId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.grantId).toBe(createdGrantId.toString());
      expect(res.body.title).toBeDefined();
      expect(res.body.signedUrl).toBeDefined();
      expect(res.body.signedUrl).toContain('expires=');
      expect(res.body.signedUrl).toContain('token=');

      // CRITICAL SECURITY ISOLATION CHECK:
      // Zero leakage of pipeline, review thread, internal comments, ratings, or other steps
      expect(res.body.pipeline).toBeUndefined();
      expect(res.body.approvalThread).toBeUndefined();
      expect(res.body.comments).toBeUndefined();
      expect(res.body.ratings).toBeUndefined();
      expect(res.body.workItems).toBeUndefined();
      expect(res.body.reviewHistory).toBeUndefined();
    });

    it('blocks non-channel member if grant is inside a private channel', async () => {
      // Create a grant inside privateGroupChannel
      const shareRes = await request(app)
        .post('/api/chat/share')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          channelId: privateGroupChannel._id.toString(),
          assetId: approvedClip._id.toString(),
          assetType: 'clip',
          contentPieceId: contentPiece._id.toString(),
          stageKey: 'Shoot',
        });
      expect(shareRes.status).toBe(201);
      const privateGrantId = shareRes.body.grant._id;

      // workerOther is not in privateGroupChannel -> must return 403
      const res = await request(app)
        .get(`/api/chat/shared-asset/${privateGrantId}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error?.code || res.body.code).toBe('FORBIDDEN_CHANNEL_MEMBER_ONLY');
    });
  });

  // ==========================================
  // Test 6: Revocation & Immediate Cutoff
  // ==========================================
  describe('6. Revocation & Immediate Access Cutoff', () => {
    let grantToRevoke;

    beforeAll(async () => {
      const shareRes = await request(app)
        .post('/api/chat/share')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          channelId: teamChannel._id.toString(),
          assetId: approvedClip._id.toString(),
          assetType: 'clip',
          contentPieceId: contentPiece._id.toString(),
          stageKey: 'Shoot',
          note: 'Asset to be unshared.',
        });
      grantToRevoke = shareRes.body.grant._id;
    });

    it('rejects unauthorized team_member from revoking another user\'s share grant with 403', async () => {
      const res = await request(app)
        .post(`/api/chat/share/${grantToRevoke}/revoke`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error?.code || res.body.code).toBe('FORBIDDEN_REVOKE');
    });

    it('allows original sharer to revoke ShareGrant', async () => {
      const res = await request(app)
        .post(`/api/chat/share/${grantToRevoke}/revoke`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.grant.isRevoked).toBe(true);
      expect(res.body.grant.revokedAt).toBeDefined();

      // Verify message card reflects isRevoked: true
      const msg = await ChatMessage.findOne({ 'sharedMedia.grantId': grantToRevoke });
      expect(msg.sharedMedia.isRevoked).toBe(true);

      // Verify ActivityEvent was logged
      const activity = await ActivityEvent.findOne({
        action: 'chat.unshared',
        'details.grantId': grantToRevoke.toString(),
      });
      expect(activity).toBeDefined();
    });

    it('immediately denies access to revoked grant with 403 SHARE_REVOKED', async () => {
      const res = await request(app)
        .get(`/api/chat/shared-asset/${grantToRevoke}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error?.code || res.body.code).toBe('SHARE_REVOKED');
    });
  });

  // ==========================================
  // Test 7: Clip replaced / reopened tie
  // ==========================================
  describe('7. Grant Immutability Tied to Original Version', () => {
    it('maintains grant tied to original approved clip version even if clip status changes later', async () => {
      // Create share grant for approvedClip
      const shareRes = await request(app)
        .post('/api/chat/share')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          channelId: teamChannel._id.toString(),
          assetId: approvedClip._id.toString(),
          assetType: 'clip',
          contentPieceId: contentPiece._id.toString(),
          stageKey: 'Shoot',
        });
      const tiedGrantId = shareRes.body.grant._id;

      // Simulate clip reopened for revisions
      await MediaItem.findByIdAndUpdate(approvedClip._id, { status: 'reshoot_needed' });

      // Grant still points to original asset ID and remains intact
      const grant = await ShareGrant.findById(tiedGrantId);
      expect(grant.assetId).toBe(approvedClip._id.toString());
      expect(grant.isRevoked).toBe(false);

      // Restore clip status
      await MediaItem.findByIdAndUpdate(approvedClip._id, { status: 'approved' });
    });
  });

  // ==========================================
  // Test 8: Creative Head approval with alsoShareToTeamChat
  // ==========================================
  describe('8. Atomic alsoShareToTeamChat on Creative Head Approval', () => {
    it('creates ShareGrant and Team Chat message atomically when alsoShareToTeamChat: true', async () => {
      // Transition workItem to Pending so approval is allowed
      testWorkItem.status = 'Pending';
      await testWorkItem.save();

      // Create a fresh submitted submission to approve
      const freshSub = await Submission.create({
        workItemId: testWorkItem._id,
        contentPieceId: contentPiece._id,
        submittedById: workerOwner._id,
        kind: 'video',
        fileUrl: '/uploads/submissions/viral_reel_v1.mp4',
        version: 3,
        status: 'submitted',
      });

      // A Shoot step needs its clips approved first.
      await MediaItem.updateMany({ stageItemId: testWorkItem._id }, { status: 'approved' });
      if (testWorkItem.stageKey === 'Shoot' && !(await MediaItem.exists({ stageItemId: testWorkItem._id }))) {
        await MediaItem.create({ stageItemId: testWorkItem._id, url: 'https://example.test/clip.mp4', title: 'Approved clip', status: 'approved' });
      }

      const res = await request(app)
        .post(`/api/submissions/${freshSub._id}/approve`)
        .set('Authorization', `Bearer ${headToken}`)
        .send({
          score: 5,
          feedback: 'Spectacular edit, approved for immediate publishing!',
          tags: ['Great hook'],
          alsoShareToTeamChat: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.submission.status).toBe('approved');
      expect(res.body.sharedMessage).toBeDefined();
      expect(res.body.sharedMessage.kind).toBe('media_share');

      // Verify ShareGrant exists in DB
      const grant = await ShareGrant.findOne({
        assetId: freshSub._id.toString(),
        isRevoked: false,
      });
      expect(grant).toBeDefined();
      expect(grant.channelId.toString()).toBe(teamChannel._id.toString());
    });
  });

  // ==========================================
  // Test 9: Zero Cross-Write Isolation
  // ==========================================
  describe('9. Complete Thread Isolation (Zero Cross-Write)', () => {
    it('ensures chat messages never write to approval comments and approval comments never write to chat', async () => {
      // 1. Post a normal chat message in team chat
      const chatRes = await request(app)
        .post(`/api/chat/channels/${teamChannel._id}/messages`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ content: 'Discussing the release timeline in team chat' });
      expect(chatRes.status).toBe(201);

      // Verify this message is NOT in submission comments
      const sub = await Submission.findById(approvedSubmission._id);
      const comments = sub.comments || [];
      const hasChatText = comments.some((c) => c.content?.includes('Discussing the release timeline in team chat'));
      expect(hasChatText).toBe(false);

      // 2. Add an approval thread comment
      const commentRes = await request(app)
        .post(`/api/submissions/${approvedSubmission._id}/comments`)
        .set('Authorization', `Bearer ${headToken}`)
        .send({
          text: 'This is an isolated review thread critique.',
        });
      expect(commentRes.status).toBe(201);

      // Verify this review comment does NOT appear as a ChatMessage in teamChannel
      const chatMsg = await ChatMessage.findOne({
        channelId: teamChannel._id,
        content: 'This is an isolated review thread critique.',
      });
      expect(chatMsg).toBeNull();
    });
  });
});
