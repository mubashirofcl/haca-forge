import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { app } from '../src/server.js';
import { env } from '../src/config/env.js';
import { User } from '../src/modules/people/model.js';
import { WorkItem } from '../src/modules/workItems/model.js';
import { ContentPiece } from '../src/modules/calendar/contentPiece.model.js';
import { Profile } from '../src/modules/referenceData/profile.model.js';
import { Department } from '../src/modules/departments/model.js';
import { Submission, Rating } from '../src/modules/submissions/model.js';
import { MediaItem, MediaMessage } from '../src/modules/media/model.js';

describe('Media & Shoot Workspace Backend Engine', () => {
  let adminToken, shooterToken, creativeHeadToken, smManagerToken, execToken, otherWorkerToken;
  let adminUser, shooterUser, creativeHeadUser, smManagerUser, execUser, otherWorkerUser;
  let testProfile, videoDept;
  let testPiece, shootStage, editStage;

  function makeToken(user) {
    return jwt.sign(
      {
        userId: user._id.toString(),
        role: user.role,
        email: user.email,
        name: user.name,
      },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  }

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(env.MONGODB_URI);
    }

    testProfile = await Profile.findOne({ code: 'HACA' });
    if (!testProfile) {
      testProfile = await Profile.create({ name: 'HACA', code: 'HACA', active: true });
    }

    videoDept = await Department.findOne({ name: 'Video Production' });
    if (!videoDept) {
      videoDept = await Department.create({ name: 'Video Production', code: 'VIDEO' });
    }

    // 1. Create test users
    adminUser = await User.create({
      name: 'System Admin',
      email: `admin_${Date.now()}@haca.local`,
      role: 'admin',
      jobRole: 'Creative Manager (TL)',
      departmentId: videoDept._id,
      profileAccess: [testProfile._id],
      status: 'active',
      password: 'password123',
    });
    adminToken = makeToken(adminUser);

    shooterUser = await User.create({
      name: 'Test Shooter',
      email: `shooter_${Date.now()}@haca.local`,
      role: 'team_member',
      jobRole: 'Videographer',
      departmentId: videoDept._id,
      profileAccess: [testProfile._id],
      status: 'active',
      password: 'password123',
    });
    shooterToken = makeToken(shooterUser);

    creativeHeadUser = await User.create({
      name: 'Test Creative Head',
      email: `head_${Date.now()}@haca.local`,
      role: 'creative_head',
      jobRole: 'Creative Manager (TL)',
      departmentId: videoDept._id,
      profileAccess: [testProfile._id],
      status: 'active',
      password: 'password123',
    });
    creativeHeadToken = makeToken(creativeHeadUser);

    smManagerUser = await User.create({
      name: 'Test SM Manager',
      email: `sm_${Date.now()}@haca.local`,
      role: 'sm_manager',
      jobRole: 'Social Media Manager',
      departmentId: videoDept._id,
      profileAccess: [testProfile._id],
      status: 'active',
      password: 'password123',
    });
    smManagerToken = makeToken(smManagerUser);

    execUser = await User.create({
      name: 'Test Executive',
      email: `exec_${Date.now()}@haca.local`,
      role: 'executive',
      jobRole: 'Creative Manager (TL)',
      departmentId: videoDept._id,
      profileAccess: [testProfile._id],
      status: 'active',
      password: 'password123',
    });
    execToken = makeToken(execUser);

    otherWorkerUser = await User.create({
      name: 'Other Worker',
      email: `other_${Date.now()}@haca.local`,
      role: 'team_member',
      jobRole: 'Writer',
      departmentId: videoDept._id,
      profileAccess: [testProfile._id],
      status: 'active',
      password: 'password123',
    });
    otherWorkerToken = makeToken(otherWorkerUser);
  });

  beforeEach(async () => {
    await MediaMessage.deleteMany({});
    await MediaItem.deleteMany({});
    await Submission.deleteMany({});
    await Rating.deleteMany({});
    await WorkItem.deleteMany({});
    await ContentPiece.deleteMany({});

    // Create ContentPiece
    testPiece = await ContentPiece.create({
      planId: new mongoose.Types.ObjectId(),
      targetMonth: '2026-11',
      profileId: testProfile._id,
      topic: 'Campus Tour Video Reel',
      contentType: 'Reel',
      pipeline: 'reel_a',
      postingDate: new Date('2026-11-20'),
      status: 'In Progress',
    });

    // Create Script stage with shotList
    const scriptStage = await WorkItem.create({
      contentPieceId: testPiece._id,
      profileId: testProfile._id,
      departmentId: videoDept._id,
      ownerId: otherWorkerUser._id,
      title: 'Script Stage',
      workType: 'Reel',
      deadline: new Date('2026-11-20'),
      stageKey: 'Script',
      stageOrder: 1,
      status: 'Approved',
      isLocked: false,
    });

    await Submission.create({
      workItemId: scriptStage._id,
      authorId: otherWorkerUser._id,
      kind: 'document',
      deliverableType: 'document',
      version: 1,
      document: {
        plainText: 'Scene 1: Campus entrance\nScene 2: Robotics lab',
        metadata: {
          shotList: [
            { sceneNumber: 1, visual: 'Main gate entrance exterior', shotRef: 'Scene 1' },
            { sceneNumber: 2, visual: 'Robotics lab close up of arm', shotRef: 'Scene 2' },
            { sceneNumber: 3, visual: 'Student laughing with drone', shotRef: 'Scene 3' },
          ],
        },
      },
    });

    // Create Shoot stage owned by shooterUser
    shootStage = await WorkItem.create({
      contentPieceId: testPiece._id,
      profileId: testProfile._id,
      departmentId: videoDept._id,
      ownerId: shooterUser._id,
      title: 'Shoot Raw Footage',
      workType: 'Reel',
      deadline: new Date('2026-11-20'),
      stageKey: 'Shoot',
      stageOrder: 2,
      status: 'In Progress',
      isLocked: false,
    });

    // Create Edit stage
    editStage = await WorkItem.create({
      contentPieceId: testPiece._id,
      profileId: testProfile._id,
      departmentId: videoDept._id,
      ownerId: otherWorkerUser._id,
      title: 'Edit Master Cut',
      workType: 'Reel',
      deadline: new Date('2026-11-20'),
      stageKey: 'Edit',
      stageOrder: 3,
      status: 'Not Started',
      isLocked: true,
    });
  });

  afterAll(async () => {
    await MediaMessage.deleteMany({});
    await MediaItem.deleteMany({});
    await WorkItem.deleteMany({});
    const userIds = [adminUser?._id, shooterUser?._id, creativeHeadUser?._id, smManagerUser?._id, execUser?._id, otherWorkerUser?._id].filter(Boolean);
    if (userIds.length > 0) {
      await User.deleteMany({ _id: { $in: userIds } });
    }
  });

  describe('1. Clip CRUD, 9:16 Orientation & Approved Locking', () => {
    it('creates clips with duration, dimensions and calculates 9:16 orientation', async () => {
      // 1080x1920 is standard 9:16 (height / width = 1.777)
      const res = await request(app)
        .post(`/api/work/${shootStage._id}/clips`)
        .set('Authorization', `Bearer ${shooterToken}`)
        .send({
          url: 'https://storage.local/raw_clip1.mp4',
          title: 'Campus Gate Wide',
          shotRef: 'Scene 1',
          take: 1,
          tags: ['A-roll'],
          notes: 'Sunny daylight, 4k 60fps',
          width: 1080,
          height: 1920,
          durationSeconds: 15,
          sizeBytes: 15000000,
        })
        .expect(201);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.title).toBe('Campus Gate Wide');
      expect(res.body.data.orientationOk).toBe(true);
      expect(res.body.data.take).toBe(1);
      expect(res.body.data.version).toBe(1);
      expect(res.body.data.status).toBe('uploaded');

      // Landscape 1920x1080 should have orientationOk = false
      const landRes = await request(app)
        .post(`/api/work/${shootStage._id}/clips`)
        .set('Authorization', `Bearer ${shooterToken}`)
        .send({
          url: 'https://storage.local/raw_clip2.mp4',
          title: 'Campus Gate Landscape',
          take: 2,
          width: 1920,
          height: 1080,
          durationSeconds: 20,
          sizeBytes: 18000000,
        })
        .expect(201);

      expect(landRes.body.data.orientationOk).toBe(false);
    });

    it('enforces maximum clip limit of 10 per step', async () => {
      // Create 10 clips
      for (let i = 1; i <= 10; i++) {
        await MediaItem.create({
          stageItemId: shootStage._id,
          url: `https://storage.local/clip_${i}.mp4`,
          title: `Clip ${i}`,
          width: 1080,
          height: 1920,
        });
      }

      // 11th clip should be rejected with 400 MAX_CLIPS_EXCEEDED
      const res = await request(app)
        .post(`/api/work/${shootStage._id}/clips`)
        .set('Authorization', `Bearer ${shooterToken}`)
        .send({
          url: 'https://storage.local/clip_11.mp4',
          title: 'Clip 11',
          width: 1080,
          height: 1920,
        })
        .expect(400);

      expect(res.body.error.code).toBe('MAX_CLIPS_EXCEEDED');
    });

    it('rejects files exceeding size limits (500MB for video)', async () => {
      const res = await request(app)
        .post(`/api/work/${shootStage._id}/clips`)
        .set('Authorization', `Bearer ${shooterToken}`)
        .send({
          url: 'https://storage.local/huge_video.mp4',
          title: 'Huge Video',
          kind: 'video',
          sizeBytes: 550 * 1024 * 1024, // 550 MB
        })
        .expect(400);

      expect(res.body.error.code).toBe('FILE_TOO_LARGE');
    });

    it('updates clip metadata while not approved and editable', async () => {
      const clip = await MediaItem.create({
        stageItemId: shootStage._id,
        url: 'https://storage.local/clip.mp4',
        title: 'Initial Title',
        take: 1,
      });

      const res = await request(app)
        .patch(`/api/clips/${clip._id}`)
        .set('Authorization', `Bearer ${shooterToken}`)
        .send({
          title: 'Updated Title',
          take: 2,
          notes: 'Re-labeled for editor',
          favourite: true,
        })
        .expect(200);

      expect(res.body.data.title).toBe('Updated Title');
      expect(res.body.data.take).toBe(2);
      expect(res.body.data.favourite).toBe(true);
    });

    it('locks approved clips against update and deletion', async () => {
      const approvedClip = await MediaItem.create({
        stageItemId: shootStage._id,
        url: 'https://storage.local/approved_clip.mp4',
        title: 'Approved Clip',
        status: 'approved',
      });

      // Update should fail with 400 CLIP_LOCKED
      const updateRes = await request(app)
        .patch(`/api/clips/${approvedClip._id}`)
        .set('Authorization', `Bearer ${shooterToken}`)
        .send({ title: 'Hacked Title' })
        .expect(400);

      expect(updateRes.body.error.code).toBe('CLIP_LOCKED');

      // Delete should fail with 400 CLIP_LOCKED
      const deleteRes = await request(app)
        .delete(`/api/clips/${approvedClip._id}`)
        .set('Authorization', `Bearer ${shooterToken}`)
        .expect(400);

      expect(deleteRes.body.error.code).toBe('CLIP_LOCKED');
    });

    it('allows non-approved clip deletion by the owner', async () => {
      const clip = await MediaItem.create({
        stageItemId: shootStage._id,
        url: 'https://storage.local/temp_clip.mp4',
        title: 'Temp Clip',
        status: 'uploaded',
      });

      await request(app)
        .delete(`/api/clips/${clip._id}`)
        .set('Authorization', `Bearer ${shooterToken}`)
        .expect(200);

      const found = await MediaItem.findById(clip._id);
      expect(found).toBeNull();
    });

    it('reorders clips using PUT /api/work/:stageItemId/clips/reorder', async () => {
      const c1 = await MediaItem.create({ stageItemId: shootStage._id, url: 'c1', title: 'C1', order: 0 });
      const c2 = await MediaItem.create({ stageItemId: shootStage._id, url: 'c2', title: 'C2', order: 1 });

      await request(app)
        .put(`/api/work/${shootStage._id}/clips/reorder`)
        .set('Authorization', `Bearer ${shooterToken}`)
        .send({ clipIds: [c2._id.toString(), c1._id.toString()] })
        .expect(200);

      const updatedC1 = await MediaItem.findById(c1._id);
      const updatedC2 = await MediaItem.findById(c2._id);
      expect(updatedC2.order).toBe(0);
      expect(updatedC1.order).toBe(1);
    });
  });

  describe('2. Shot Checklist & Coverage Maths', () => {
    it('calculates shot coverage against Script scenes and warns on uncovered shots', async () => {
      // Script has 3 scenes: Scene 1, Scene 2, Scene 3
      // We link 2 clips to Scene 1 and Scene 2
      await MediaItem.create({
        stageItemId: shootStage._id,
        url: 'c1',
        title: 'Clip 1',
        shotRef: 'Scene 1',
        status: 'uploaded',
      });

      await MediaItem.create({
        stageItemId: shootStage._id,
        url: 'c2',
        title: 'Clip 2',
        shotRef: 'Scene 2',
        status: 'uploaded',
      });

      const res = await request(app)
        .get(`/api/work/${shootStage._id}/clips`)
        .set('Authorization', `Bearer ${shooterToken}`)
        .expect(200);

      expect(res.body.data.totalShots).toBe(3);
      expect(res.body.data.coveredShots).toBe(2);
      expect(res.body.data.coverage).toBe('2 of 3 shots covered');
    });
  });

  describe('3. Messages Thread: Permissions, Timecode, Replies, Seen, Done & Reopen', () => {
    let clip;

    beforeEach(async () => {
      clip = await MediaItem.create({
        stageItemId: shootStage._id,
        url: 'https://storage.local/clip.mp4',
        title: 'Hero Shot',
        status: 'uploaded',
      });
    });

    it('allows owner, creative_head, and admin to post messages with timecodes and replies', async () => {
      // Shooter posts message with time reference
      const post1 = await request(app)
        .post(`/api/clips/${clip._id}/messages`)
        .set('Authorization', `Bearer ${shooterToken}`)
        .send({
          text: 'Notice the lighting shift here at 0:04',
          timeSeconds: 4,
        })
        .expect(201);

      expect(post1.body.data.text).toContain('0:04');
      expect(post1.body.data.timeSeconds).toBe(4);
      expect(post1.body.data.authorId._id).toBe(shooterUser._id.toString());

      // Creative Head posts quoted reply
      const post2 = await request(app)
        .post(`/api/clips/${clip._id}/messages`)
        .set('Authorization', `Bearer ${creativeHeadToken}`)
        .send({
          text: 'Agreed, need a bounce card next time.',
          replyToId: post1.body.data._id,
        })
        .expect(201);

      expect(post2.body.data.replyToId).toBeDefined();
      expect(post2.body.data.replyToId._id).toBe(post1.body.data._id);
    });

    it('allows sm_manager and executive to read messages, but forbids posting', async () => {
      await MediaMessage.create({
        mediaItemId: clip._id,
        authorId: shooterUser._id,
        text: 'Initial shooter note',
      });

      // sm_manager reads: OK
      const readRes = await request(app)
        .get(`/api/clips/${clip._id}/messages`)
        .set('Authorization', `Bearer ${smManagerToken}`)
        .expect(200);

      expect(readRes.body.data.length).toBe(1);

      // sm_manager tries to post: 403 Forbidden
      const postRes = await request(app)
        .post(`/api/clips/${clip._id}/messages`)
        .set('Authorization', `Bearer ${smManagerToken}`)
        .send({ text: 'SM manager trying to post' })
        .expect(403);

      expect(postRes.body.error.code).toBe('FORBIDDEN_ACTION');

      // exec tries to post: 403 Forbidden
      await request(app)
        .post(`/api/clips/${clip._id}/messages`)
        .set('Authorization', `Bearer ${execToken}`)
        .send({ text: 'Exec trying to post' })
        .expect(403);
    });

    it('tracks unread counts and marks messages as seen', async () => {
      // Creative Head posts feedback message
      await request(app)
        .post(`/api/clips/${clip._id}/messages`)
        .set('Authorization', `Bearer ${creativeHeadToken}`)
        .send({ text: 'Please check framing at 0:10' })
        .expect(201);

      // Shooter queries clips -> unreadCount should be 1
      const listRes = await request(app)
        .get(`/api/work/${shootStage._id}/clips`)
        .set('Authorization', `Bearer ${shooterToken}`)
        .expect(200);

      const targetClip = listRes.body.data.clips.find((c) => c._id.toString() === clip._id.toString());
      expect(targetClip.unreadCount).toBe(1);

      // Shooter opens thread and marks seen
      await request(app)
        .post(`/api/clips/${clip._id}/messages/seen`)
        .set('Authorization', `Bearer ${shooterToken}`)
        .expect(200);

      // Re-query: unreadCount should now be 0
      const afterRes = await request(app)
        .get(`/api/work/${shootStage._id}/clips`)
        .set('Authorization', `Bearer ${shooterToken}`)
        .expect(200);

      const afterClip = afterRes.body.data.clips.find((c) => c._id.toString() === clip._id.toString());
      expect(afterClip.unreadCount).toBe(0);
    });

    it('handles feedback done tick and restricts reopen to reviewers', async () => {
      const msg = await MediaMessage.create({
        mediaItemId: clip._id,
        authorId: creativeHeadUser._id,
        text: 'Fix the color cast',
      });

      // Shooter marks feedback as done
      const doneRes = await request(app)
        .patch(`/api/clips/${clip._id}/messages/${msg._id}/toggle-done`)
        .set('Authorization', `Bearer ${shooterToken}`)
        .send({ done: true })
        .expect(200);

      expect(doneRes.body.data.doneAt).toBeDefined();

      // Shooter attempts to reopen -> 403 Forbidden (reviewers only)
      const reopenShooter = await request(app)
        .patch(`/api/clips/${clip._id}/messages/${msg._id}/toggle-done`)
        .set('Authorization', `Bearer ${shooterToken}`)
        .send({ done: false })
        .expect(403);

      expect(reopenShooter.body.error.code).toBe('FORBIDDEN_ACTION');

      // Creative Head reopens -> 200 OK
      const reopenCH = await request(app)
        .patch(`/api/clips/${clip._id}/messages/${msg._id}/toggle-done`)
        .set('Authorization', `Bearer ${creativeHeadToken}`)
        .send({ done: false })
        .expect(200);

      expect(reopenCH.body.data.doneAt).toBeNull();
    });
  });

  describe('4. Per-Clip Review & Shoot Step Approval Outcomes', () => {
    let clip1, clip2;

    beforeEach(async () => {
      // Each case starts on a step awaiting review, with one submitted version.
      await WorkItem.findByIdAndUpdate(shootStage._id, { status: 'Pending', revisions: 0, approvedAt: null, decisionAt: null, changesRequestedAt: null });
      await Rating.deleteMany({ workItemId: shootStage._id });
      await Submission.deleteMany({ workItemId: shootStage._id });
      await Submission.create({
        workItemId: shootStage._id,
        kind: 'video',
        version: 1,
        status: 'submitted',
        submittedById: shootStage.ownerId,
        submittedAt: new Date(),
        linkUrl: 'https://example.test/footage',
      });

      clip1 = await MediaItem.create({
        stageItemId: shootStage._id,
        url: 'c1',
        title: 'Clip 1',
        status: 'waiting_review',
      });
      clip2 = await MediaItem.create({
        stageItemId: shootStage._id,
        url: 'c2',
        title: 'Clip 2',
        status: 'waiting_review',
      });
      shootStage.status = 'Pending';
      await shootStage.save();
    });

    it('requires a message when requesting a reshoot', async () => {
      const res = await request(app)
        .post(`/api/clips/${clip1._id}/review`)
        .set('Authorization', `Bearer ${creativeHeadToken}`)
        .send({ action: 'reshoot_needed' }) // Missing message
        .expect(400);

      expect(res.body.error.code).toBe('FEEDBACK_MESSAGE_REQUIRED');
    });

    it('flags clip for reshoot and posts required message to thread', async () => {
      const res = await request(app)
        .post(`/api/clips/${clip1._id}/review`)
        .set('Authorization', `Bearer ${creativeHeadToken}`)
        .send({
          action: 'reshoot_needed',
          message: 'The camera was too shaky during the pan.',
        })
        .expect(200);

      expect(res.body.data.status).toBe('reshoot_needed');

      const messages = await MediaMessage.find({ mediaItemId: clip1._id });
      expect(messages.length).toBe(1);
      expect(messages[0].text).toContain('camera was too shaky');
    });

    it('blocks finish review if any clip is still waiting_review', async () => {
      // clip1 approved, clip2 still waiting_review
      await MediaItem.findByIdAndUpdate(clip1._id, { status: 'approved' });

      const res = await request(app)
        .post(`/api/work/${shootStage._id}/shoot-review`)
        .set('Authorization', `Bearer ${creativeHeadToken}`)
        .send({ score: 4, feedback: 'Almost done' })
        .expect(400);

      expect(res.body.error.code).toBe('CLIPS_WAITING_REVIEW');
    });

    it('returns the step to In Progress when any clip needs reshoot', async () => {
      await MediaItem.findByIdAndUpdate(clip1._id, { status: 'approved' });
      await MediaItem.findByIdAndUpdate(clip2._id, { status: 'reshoot_needed' });

      const res = await request(app)
        .post(`/api/work/${shootStage._id}/shoot-review`)
        .set('Authorization', `Bearer ${creativeHeadToken}`)
        .send({ note: 'Clip 2 needs reshoot before approval' })
        .expect(200);

      expect(res.body.data.outcome).toBe('changes_requested');

      const updatedStage = await WorkItem.findById(shootStage._id);
      expect(updatedStage.status).toBe('In Progress');
      expect(updatedStage.revisions).toBe(1);
    });

    it('approves step with 1-5 rating when all clips are approved and unlocks Edit stage', async () => {
      await MediaItem.findByIdAndUpdate(clip1._id, { status: 'approved' });
      await MediaItem.findByIdAndUpdate(clip2._id, { status: 'approved' });

      // Approval without rating score should fail
      await request(app)
        .post(`/api/work/${shootStage._id}/shoot-review`)
        .set('Authorization', `Bearer ${creativeHeadToken}`)
        .send({ feedback: 'Good job' })
        .expect(400);

      // Approval with 5-star rating
      const res = await request(app)
        .post(`/api/work/${shootStage._id}/shoot-review`)
        .set('Authorization', `Bearer ${creativeHeadToken}`)
        .send({
          score: 5,
          feedback: 'Stunning footage and excellent coverage!',
          tags: ['Great hook', 'Clear message'],
        })
        .expect(200);

      expect(res.body.data.outcome).toBe('approved');

      const updatedShoot = await WorkItem.findById(shootStage._id);
      expect(updatedShoot.status).toBe('Approved');

      // Verify Rating record created
      const rating = await Rating.findOne({ workItemId: shootStage._id });
      expect(rating.score).toBe(5);

      // Verify Edit stage unlocked!
      const updatedEdit = await WorkItem.findById(editStage._id);
      expect(updatedEdit.isLocked).toBe(false);
    });
  });

  describe('5. Submit for Approval Validation (Empty, In-Progress Uploads, Revision Handoff)', () => {
    it('blocks submission when 0 clips exist', async () => {
      const res = await request(app)
        .post(`/api/work/${shootStage._id}/submit-clips`)
        .set('Authorization', `Bearer ${shooterToken}`)
        .expect(400);

      expect(res.body.error.code).toBe('NO_CLIPS');
    });

    it('blocks submission while any clip is still uploading', async () => {
      await MediaItem.create({
        stageItemId: shootStage._id,
        url: 'c1',
        title: 'Clip 1',
        status: 'uploading',
      });

      const res = await request(app)
        .post(`/api/work/${shootStage._id}/submit-clips`)
        .set('Authorization', `Bearer ${shooterToken}`)
        .expect(400);

      expect(res.body.error.code).toBe('UPLOADS_IN_PROGRESS');
    });

    it('blocks submission after a revision if a flagged clip has not been replaced', async () => {
      shootStage.status = 'Feedback';
      await shootStage.save();

      const flagged = await MediaItem.create({
        stageItemId: shootStage._id,
        url: 'bad_clip',
        title: 'Shaky Clip',
        status: 'reshoot_needed',
      });

      // Submit without replacing flagged clip
      const res = await request(app)
        .post(`/api/work/${shootStage._id}/submit-clips`)
        .set('Authorization', `Bearer ${shooterToken}`)
        .expect(400);

      expect(res.body.error.code).toBe('FLAGGED_CLIPS_NOT_REPLACED');

      // Replace flagged clip using replaceClip endpoint
      await request(app)
        .post(`/api/clips/${flagged._id}/replace`)
        .set('Authorization', `Bearer ${shooterToken}`)
        .send({
          url: 'new_smooth_clip.mp4',
          title: 'Smooth Clip v2',
          durationSeconds: 12,
        })
        .expect(201);

      // Now submission succeeds!
      const successRes = await request(app)
        .post(`/api/work/${shootStage._id}/submit-clips`)
        .set('Authorization', `Bearer ${shooterToken}`)
        .expect(200);

      expect(successRes.body.success).toBe(true);

      const updatedStage = await WorkItem.findById(shootStage._id);
      expect(updatedStage.status).toBe('Pending');
    });
  });

  describe('6. Downstream Edit Stage receives ONLY approved clips', () => {
    it('populates approved clips from Shoot stage on getWorkItemById for Edit step', async () => {
      // Edit only sees the clips of a finished Shoot step.
      await WorkItem.findByIdAndUpdate(shootStage._id, { status: 'Approved' });

      // 1 approved clip, 1 rejected clip
      await MediaItem.create({
        stageItemId: shootStage._id,
        url: 'https://storage.local/approved.mp4',
        title: 'Approved Final Take',
        shotRef: 'Scene 1',
        take: 3,
        tags: ['A-roll'],
        status: 'approved',
      });

      await MediaItem.create({
        stageItemId: shootStage._id,
        url: 'https://storage.local/bad.mp4',
        title: 'Bad Take',
        status: 'reshoot_needed',
      });

      const res = await request(app)
        .get(`/api/work/${editStage._id}`)
        .set('Authorization', `Bearer ${otherWorkerToken}`)
        .expect(200);

      expect(res.body.data.approvedClips).toBeDefined();
      expect(res.body.data.approvedClips.length).toBe(1);
      expect(res.body.data.approvedClips[0].title).toBe('Approved Final Take');
      expect(res.body.data.approvedClips[0].shotRef).toBe('Scene 1');
      expect(res.body.data.approvedClips[0].status).toBeUndefined(); // select excludes non-essential internal fields
    });
  });
});
