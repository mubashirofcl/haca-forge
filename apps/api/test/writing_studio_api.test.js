import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/server.js';
import { env } from '../src/config/env.js';
import { connectDB } from '../src/config/db.js';
import { Person } from '../src/modules/people/model.js';
import { WorkItem } from '../src/modules/workItems/model.js';
import { Submission, SubmissionComment, EditorLock } from '../src/modules/submissions/model.js';

describe('WS2: Writing Studio API & Single-Editor Lock Suite', () => {
  let writerToken;
  let writer2Token;
  let headToken;
  let shooterToken;

  let writerUser;
  let writer2User;
  let headUser;
  let shooterUser;

  let scriptWorkItem;
  let shootWorkItem;
  let deptDoc;
  let profileDoc;

  beforeAll(async () => {
    await connectDB();

    deptDoc = (await mongoose.connection.db.collection('departments').findOne({})) || { _id: new mongoose.Types.ObjectId() };
    profileDoc = (await mongoose.connection.db.collection('profiles').findOne({})) || { _id: new mongoose.Types.ObjectId() };

    // Clean test data
    await Person.deleteMany({ email: { $regex: /@writing-studio-test\.com$/ } });
    await WorkItem.deleteMany({ title: { $regex: /Writing Studio Test/ } });
    await EditorLock.deleteMany({});
    await Submission.deleteMany({});
    await SubmissionComment.deleteMany({});

    // Create users
    writerUser = await Person.create({
      name: 'Ananya Writer',
      email: 'ananya@writing-studio-test.com',
      role: 'team_member',
      department: 'Content',
      jobRole: 'Writer',
      status: 'active',
      authMethod: 'password',
      profileAccess: [profileDoc._id],
    });

    writer2User = await Person.create({
      name: 'Kiran Writer',
      email: 'kiran@writing-studio-test.com',
      role: 'team_member',
      department: 'Content',
      jobRole: 'Writer',
      status: 'active',
      authMethod: 'password',
      profileAccess: [profileDoc._id],
    });

    headUser = await Person.create({
      name: 'Siddharth Head',
      email: 'siddharth@writing-studio-test.com',
      role: 'creative_head',
      department: 'Creative',
      jobRole: 'Creative Manager (TL)',
      status: 'active',
      authMethod: 'password',
      profileAccess: [profileDoc._id],
    });

    shooterUser = await Person.create({
      name: 'Vishnu Videographer',
      email: 'vishnu@writing-studio-test.com',
      role: 'team_member',
      department: 'Video',
      jobRole: 'Videographer',
      status: 'active',
      authMethod: 'password',
      profileAccess: [profileDoc._id],
    });

    const createToken = (user) =>
      jwt.sign(
        { userId: user._id.toString(), email: user.email, role: user.role, name: user.name },
        env.JWT_SECRET,
        { expiresIn: '2h' }
      );

    writerToken = createToken(writerUser);
    writer2Token = createToken(writer2User);
    headToken = createToken(headUser);
    shooterToken = createToken(shooterUser);

    const sharedContentPieceId = new mongoose.Types.ObjectId();

    // Create Script WorkItem
    scriptWorkItem = await WorkItem.create({
      title: 'Writing Studio Test - Script Step',
      workType: 'Copy',
      departmentId: deptDoc._id,
      profileId: profileDoc._id,
      stageKey: 'Script',
      stageLabel: 'Script',
      stageOrder: 1,
      contentPieceId: sharedContentPieceId,
      status: 'In Progress',
      ownerId: writerUser._id,
      assignedBy: headUser._id,
      deadline: new Date(Date.now() + 86400000 * 2),
      isLocked: false,
      reviewRequired: true,
      history: [],
    });

    // Create Shoot WorkItem (downstream sibling stage)
    shootWorkItem = await WorkItem.create({
      title: 'Writing Studio Test - Shoot Step',
      workType: 'Copy',
      departmentId: deptDoc._id,
      profileId: profileDoc._id,
      stageKey: 'Shoot',
      stageLabel: 'Shoot',
      stageOrder: 2,
      contentPieceId: sharedContentPieceId,
      status: 'Not Started',
      ownerId: shooterUser._id,
      assignedBy: headUser._id,
      deadline: new Date(Date.now() + 86400000 * 4),
      isLocked: false,
      reviewRequired: true,
      history: [],
    });
  });

  afterAll(async () => {
    await Person.deleteMany({ email: { $regex: /@writing-studio-test\.com$/ } });
    await WorkItem.deleteMany({ title: { $regex: /Writing Studio Test/ } });
    await EditorLock.deleteMany({});
    await Submission.deleteMany({});
    await SubmissionComment.deleteMany({});
    await mongoose.connection.close();
  });

  describe('1. Single-Editor Session Lock Endpoints', () => {
    it('allows writer to claim editor lock', async () => {
      const res = await request(app)
        .post(`/api/work/${scriptWorkItem._id}/editor-lock`)
        .set('Authorization', `Bearer ${writerToken}`)
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.locked).toBe(false);
      expect(res.body.data.heldBy).toBe(writerUser.name);
      expect(res.body.data.isOwner).toBe(true);
    });

    it('queries active editor lock status for owner', async () => {
      const res = await request(app)
        .get(`/api/work/${scriptWorkItem._id}/editor-lock`)
        .set('Authorization', `Bearer ${writerToken}`)
        .expect(200);

      expect(res.body.data.locked).toBe(false);
      expect(res.body.data.isOwner).toBe(true);
      expect(res.body.data.heldBy).toBe(writerUser.name);
    });

    it('informs a second editor that the document is locked by the first', async () => {
      // Only the step owner or an admin can hold the lock, so the second editor is an admin.
      await Person.updateOne({ _id: writer2User._id }, { role: 'admin' });
      writer2User.role = 'admin';
      writer2Token = jwt.sign(
        { userId: writer2User._id.toString(), email: writer2User.email, role: 'admin', name: writer2User.name },
        env.JWT_SECRET,
        { expiresIn: '2h' }
      );

      const res = await request(app)
        .post(`/api/work/${scriptWorkItem._id}/editor-lock`)
        .set('Authorization', `Bearer ${writer2Token}`)
        .expect(200);

      expect(res.body.data.locked).toBe(true);
      expect(res.body.data.heldBy).toBe(writerUser.name);
      expect(res.body.data.isOwner).toBe(false);
    });

    it('refreshes lock when holding writer sends heartbeat', async () => {
      const res = await request(app)
        .post(`/api/work/${scriptWorkItem._id}/editor-lock`)
        .set('Authorization', `Bearer ${writerToken}`)
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.locked).toBe(false);
      expect(res.body.data.isOwner).toBe(true);
    });

    it('releases lock when holding writer closes session', async () => {
      const delRes = await request(app)
        .delete(`/api/work/${scriptWorkItem._id}/editor-lock`)
        .set('Authorization', `Bearer ${writerToken}`)
        .expect(200);

      expect(delRes.body.data.released).toBe(true);

      const checkRes = await request(app)
        .get(`/api/work/${scriptWorkItem._id}/editor-lock`)
        .set('Authorization', `Bearer ${writerToken}`)
        .expect(200);

      expect(checkRes.body.data.locked).toBe(false);
    });

    it('allows a second editor to claim the lock once the previous lock is released', async () => {
      const res = await request(app)
        .post(`/api/work/${scriptWorkItem._id}/editor-lock`)
        .set('Authorization', `Bearer ${writer2Token}`)
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.locked).toBe(false);
      expect(res.body.data.heldBy).toBe(writer2User.name);
      expect(res.body.data.isOwner).toBe(true);

      // Clean up second writer lock
      await request(app)
        .delete(`/api/work/${scriptWorkItem._id}/editor-lock`)
        .set('Authorization', `Bearer ${writer2Token}`)
        .expect(200);
    });
  });

  describe('2. Work Item Comments & Review Anchors', () => {
    let rootCommentId;

    it('allows creative head to add anchored review comment', async () => {
      const payload = {
        text: 'The hook in scene 1 needs to be stronger for students.',
        anchor: {
          type: 'text',
          range: {
            from: 10,
            to: 35,
            text: 'Are you tired of routine classes?',
          },
        },
      };

      const res = await request(app)
        .post(`/api/work/${scriptWorkItem._id}/comments`)
        .set('Authorization', `Bearer ${headToken}`)
        .send(payload)
        .expect(201);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.text).toBe(payload.text);
      expect(res.body.data.anchor.range.text).toBe('Are you tired of routine classes?');
      expect(res.body.data.resolved).toBe(false);

      rootCommentId = res.body.data._id;
    });

    it('allows writer to reply to the anchored comment', async () => {
      const replyPayload = {
        text: 'Updated the hook with a direct placement statistic!',
        parentId: rootCommentId,
      };

      const res = await request(app)
        .post(`/api/work/${scriptWorkItem._id}/comments`)
        .set('Authorization', `Bearer ${writerToken}`)
        .send(replyPayload)
        .expect(201);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.parentId.toString()).toBe(rootCommentId);
    });

    it('lists comments with nested replies', async () => {
      const res = await request(app)
        .get(`/api/work/${scriptWorkItem._id}/comments`)
        .set('Authorization', `Bearer ${writerToken}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      const rootComment = res.body.data.find((c) => c._id.toString() === rootCommentId);
      expect(rootComment).toBeDefined();
      expect(rootComment.text).toContain('The hook in scene 1');
      expect(rootComment.authorId.name).toBe('Siddharth Head');
    });

    it('allows resolving a comment', async () => {
      const res = await request(app)
        .patch(`/api/work/${scriptWorkItem._id}/comments/${rootCommentId}/resolve`)
        .set('Authorization', `Bearer ${headToken}`)
        .send({ resolved: true })
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.resolved).toBe(true);

      // Verify in listing
      const listRes = await request(app)
        .get(`/api/work/${scriptWorkItem._id}/comments`)
        .set('Authorization', `Bearer ${writerToken}`)
        .expect(200);

      const found = listRes.body.data.find((c) => c._id.toString() === rootCommentId);
      expect(found.resolved).toBe(true);
    });
  });

  describe('3. Writing Studio Autosave Draft & Metadata Preservation', () => {
    it('saves draft with rich script metadata, shotList, and Malayalam text', async () => {
      const malayalamHook = 'നിങ്ങളുടെ കരിയർ മാറ്റാൻ തയ്യാറാണോ? ഹക്കിൽ ചേരൂ!';
      const draftPayload = {
        document: {
          json: {
            type: 'doc',
            content: [
              {
                type: 'heading',
                attrs: { level: 1 },
                content: [{ type: 'text', text: 'Campus Reel Script - November' }],
              },
              {
                type: 'paragraph',
                content: [{ type: 'text', text: malayalamHook }],
              },
            ],
          },
          htmlSnapshot: `<h1>Campus Reel Script - November</h1><p>${malayalamHook}</p>`,
          metadata: {
            title: 'Campus Reel Script - November',
            targetDuration: 30,
            wpm: 130,
            caption: 'Transform your future at HACA. Admissions open now!',
            hashtags: '#HACA #Career #Growth #Marketing',
            shotList: [
              {
                sceneNumber: 1,
                visual: 'Close up of student working on modern design project in lab',
                audio: malayalamHook,
                estimatedSeconds: 4,
              },
              {
                sceneNumber: 2,
                visual: 'Dynamic pan across mentorship discussion table',
                audio: 'One on one coaching from industry professionals.',
                estimatedSeconds: 8,
              },
            ],
          },
        },
      };

      const res = await request(app)
        .put(`/api/work/${scriptWorkItem._id}/draft`)
        .set('Authorization', `Bearer ${writerToken}`)
        .send(draftPayload)
        .expect(200);

      expect(res.body.data).toBeDefined();

      // Verify draft document stored via GET draft endpoint
      const draftRes = await request(app)
        .get(`/api/work/${scriptWorkItem._id}/draft`)
        .set('Authorization', `Bearer ${writerToken}`)
        .expect(200);

      const doc = draftRes.body.data.document;
      expect(doc).toBeDefined();
      expect(doc.htmlSnapshot).toContain('ഹക്കിൽ ചേരൂ');
      expect(doc.metadata).toBeDefined();
      expect(doc.metadata.title).toBe('Campus Reel Script - November');
      expect(doc.metadata.targetDuration).toBe(30);
      expect(doc.metadata.shotList.length).toBe(2);
      expect(doc.metadata.shotList[0].visual).toContain('Close up of student');
      expect(doc.metadata.shotList[0].audio).toBe(malayalamHook);
    });
  });

  describe('4. Empty Document Guard & Submission for Approval', () => {
    it('rejects submission if document is completely empty', async () => {
      // Clear draft
      await Submission.deleteOne({ workItemId: scriptWorkItem._id, version: 0 });

      const res = await request(app)
        .post(`/api/work/${scriptWorkItem._id}/submit`)
        .set('Authorization', `Bearer ${writerToken}`)
        .send({
          deliverableType: 'document',
          document: {
            htmlSnapshot: '',
            json: null,
          },
        })
        .expect(400);

      expect(res.body.error.code).toBe('EMPTY_SUBMISSION');
    });

    it('submits rich script document for approval successfully', async () => {
      const submissionDoc = {
        htmlSnapshot: '<h1>Campus Reel</h1><p>Full production script ready for shoot.</p>',
        json: { type: 'doc' },
        metadata: {
          title: 'Campus Reel',
          targetDuration: 30,
          wpm: 130,
          shotList: [
            { sceneNumber: 1, visual: 'Wide shot of main campus entrance', audio: 'Welcome to HACA', estimatedSeconds: 5 },
            { sceneNumber: 2, visual: 'Student editing video in studio', audio: 'Learn real craft', estimatedSeconds: 10 },
          ],
        },
      };

      const res = await request(app)
        .post(`/api/work/${scriptWorkItem._id}/submit`)
        .set('Authorization', `Bearer ${writerToken}`)
        .send({
          deliverableType: 'document',
          document: submissionDoc,
          notes: 'Script finalized with complete shot list for video team.',
        })
        .expect(201);

      expect(res.body.data).toBeDefined();

      // Verify workItem status changed to 'Feedback' (Waiting for review)
      const updatedItem = await WorkItem.findById(scriptWorkItem._id);
      expect(updatedItem.status).toBe('Feedback');

      // Verify submission version created with metadata
      const sub = await Submission.findOne({ workItemId: scriptWorkItem._id }).sort({ version: -1 });
      expect(sub).toBeDefined();
      expect(sub.version).toBe(1);
      expect(sub.document.metadata.shotList.length).toBe(2);
    });
  });

  describe('5. Shot List Handoff to Downstream Shoot Work Item', () => {
    it('automatically populates scriptShotList when loading Shoot work item', async () => {
      // The Shoot step sees the Script step's approved output.
      await WorkItem.findByIdAndUpdate(scriptWorkItem._id, { status: 'Approved' });
      await Submission.updateMany({ workItemId: scriptWorkItem._id, version: { $gt: 0 } }, { status: 'approved' });

      const res = await request(app)
        .get(`/api/work/${shootWorkItem._id}`)
        .set('Authorization', `Bearer ${shooterToken}`)
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.scriptShotList).toBeDefined();
      expect(Array.isArray(res.body.data.scriptShotList)).toBe(true);
      expect(res.body.data.scriptShotList.length).toBe(2);
      expect(res.body.data.scriptShotList[0].sceneNumber).toBe(1);
      expect(res.body.data.scriptShotList[0].visual).toBe('Wide shot of main campus entrance');
      expect(res.body.data.scriptShotList[1].visual).toBe('Student editing video in studio');
      expect(res.body.data.scriptContent).toContain('Campus Reel');
    });

    it('supports GET /api/submissions?workItemId=:id for workspaces and review studio', async () => {
      // 1. Query script submissions via /api/submissions?workItemId=...
      const res = await request(app)
        .get(`/api/submissions?workItemId=${scriptWorkItem._id}`)
        .set('Authorization', `Bearer ${writerToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].version).toBe(1);

      // 2. Query empty submissions for shootWorkItem returns empty array, not 404
      const shootRes = await request(app)
        .get(`/api/submissions?workItemId=${shootWorkItem._id}`)
        .set('Authorization', `Bearer ${shooterToken}`)
        .expect(200);

      expect(Array.isArray(shootRes.body)).toBe(true);
      expect(shootRes.body.length).toBe(0);
    });

    it('supports POST /api/submissions to submit media footage from Shoot workspace', async () => {
      const res = await request(app)
        .post('/api/submissions')
        .set('Authorization', `Bearer ${shooterToken}`)
        .send({
          workItemId: shootWorkItem._id,
          videoUrls: ['https://drive.google.com/file/d/clips/clip1.mp4', 'https://drive.google.com/file/d/clips/clip2.mp4'],
          notes: 'Raw A-cam and B-cam reels uploaded in 4K.',
          metadata: {
            equipment: 'Sony FX3',
          },
          submit: true,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.version).toBe(1);
      expect(res.body.data.files.length).toBe(2);

      // Verify work item updated to Feedback
      const updatedShoot = await WorkItem.findById(shootWorkItem._id);
      expect(updatedShoot.status).toBe('Feedback');
    });
  });
});

