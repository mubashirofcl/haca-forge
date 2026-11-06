import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/server.js';
import { env } from '../src/config/env.js';
import { connectDB } from '../src/config/db.js';
import { Person } from '../src/modules/people/model.js';
import { WorkItem } from '../src/modules/workItems/model.js';
import { MediaItem } from '../src/modules/media/model.js';
import { Submission, SubmissionComment, Rating } from '../src/modules/submissions/model.js';

describe('Workspaces WS4: End-to-End Journeys Suite (Journeys A through G)', () => {
  let adminUser, creativeHeadUser, executiveUser;
  let writerUser, shooterUser, editorUser, designerUser, posterUser;
  let headToken, execToken, writerToken, shooterToken, editorToken, designerToken, posterToken;

  let scriptWorkItem, shootWorkItem, editWorkItem, designWorkItem, postWorkItem;
  let scriptSubmissionV1Id, scriptSubmissionV2Id;
  let deptId, profId;

  beforeAll(async () => {
    await connectDB();

    const deptDoc = await mongoose.connection.db.collection('departments').findOne({});
    const profileDoc = await mongoose.connection.db.collection('profiles').findOne({});

    deptId = deptDoc?._id || new mongoose.Types.ObjectId();
    profId = profileDoc?._id || new mongoose.Types.ObjectId();

    // Clean any prior test data
    await Person.deleteMany({ email: { $regex: /@ws4-journey\.com$/ } });
    await WorkItem.deleteMany({ title: { $regex: /WS4 Journey/ } });

    // 1. Leadership
    adminUser = await Person.create({
      name: 'Admin Boss WS4J',
      email: 'admin@ws4-journey.com',
      role: 'admin',
      department: 'Creative',
      jobRole: 'Creative Manager (TL)',
      status: 'active',
      authMethod: 'password',
      profileAccess: [profId],
    });

    creativeHeadUser = await Person.create({
      name: 'Creative Head Maya WS4J',
      email: 'ch@ws4-journey.com',
      role: 'creative_head',
      department: 'Creative',
      jobRole: 'Creative Manager (TL)',
      status: 'active',
      authMethod: 'password',
      profileAccess: [profId],
    });

    executiveUser = await Person.create({
      name: 'Executive Roy WS4J',
      email: 'exec@ws4-journey.com',
      role: 'executive',
      department: 'Executive',
      status: 'active',
      authMethod: 'password',
      profileAccess: [profId],
    });

    // 2. Workers
    writerUser = await Person.create({
      name: 'Writer Wendy WS4J',
      email: 'wendy@ws4-journey.com',
      role: 'team_member',
      department: 'Content',
      jobRole: 'Writer',
      status: 'active',
      authMethod: 'password',
      profileAccess: [profId],
    });

    shooterUser = await Person.create({
      name: 'Shooter Sam WS4J',
      email: 'sam@ws4-journey.com',
      role: 'team_member',
      department: 'Video',
      jobRole: 'Videographer',
      status: 'active',
      authMethod: 'password',
      profileAccess: [profId],
    });

    editorUser = await Person.create({
      name: 'Editor Eric WS4J',
      email: 'eric@ws4-journey.com',
      role: 'team_member',
      department: 'Video',
      jobRole: 'Video Editor',
      status: 'active',
      authMethod: 'password',
      profileAccess: [profId],
    });

    designerUser = await Person.create({
      name: 'Designer Dana WS4J',
      email: 'dana@ws4-journey.com',
      role: 'team_member',
      department: 'Design',
      jobRole: 'Designer',
      status: 'active',
      authMethod: 'password',
      profileAccess: [profId],
    });

    posterUser = await Person.create({
      name: 'Poster Paul WS4J',
      email: 'paul@ws4-journey.com',
      role: 'team_member',
      department: 'Social Media',
      jobRole: 'Social Specialist',
      status: 'active',
      authMethod: 'password',
      profileAccess: [profId],
    });

    // Tokens
    headToken = jwt.sign(
      { userId: creativeHeadUser._id.toString(), email: creativeHeadUser.email, role: creativeHeadUser.role, name: creativeHeadUser.name },
      env.JWT_SECRET,
      { expiresIn: '2h' }
    );
    execToken = jwt.sign(
      { userId: executiveUser._id.toString(), email: executiveUser.email, role: executiveUser.role, name: executiveUser.name },
      env.JWT_SECRET,
      { expiresIn: '2h' }
    );
    writerToken = jwt.sign(
      { userId: writerUser._id.toString(), email: writerUser.email, role: writerUser.role, name: writerUser.name },
      env.JWT_SECRET,
      { expiresIn: '2h' }
    );
    shooterToken = jwt.sign(
      { userId: shooterUser._id.toString(), email: shooterUser.email, role: shooterUser.role, name: shooterUser.name },
      env.JWT_SECRET,
      { expiresIn: '2h' }
    );
    editorToken = jwt.sign(
      { userId: editorUser._id.toString(), email: editorUser.email, role: editorUser.role, name: editorUser.name },
      env.JWT_SECRET,
      { expiresIn: '2h' }
    );
    designerToken = jwt.sign(
      { userId: designerUser._id.toString(), email: designerUser.email, role: designerUser.role, name: designerUser.name },
      env.JWT_SECRET,
      { expiresIn: '2h' }
    );
    posterToken = jwt.sign(
      { userId: posterUser._id.toString(), email: posterUser.email, role: posterUser.role, name: posterUser.name },
      env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    // Create Deliverables (Work Items)
    scriptWorkItem = await WorkItem.create({
      title: 'WS4 Journey Masterclass Reel Script',
      workType: 'Reel',
      status: 'In Progress',
      stageKey: 'Script',
      stageOrder: 1,
      departmentId: deptId,
      profileId: profId,
      ownerId: writerUser._id,
      deadline: new Date(Date.now() + 86400000 * 2),
    });

    shootWorkItem = await WorkItem.create({
      title: 'WS4 Journey Masterclass Shoot Footage',
      workType: 'Reel',
      status: 'In Progress',
      stageKey: 'Shoot',
      stageOrder: 2,
      departmentId: deptId,
      profileId: profId,
      ownerId: shooterUser._id,
      deadline: new Date(Date.now() + 86400000 * 3),
    });

    editWorkItem = await WorkItem.create({
      title: 'WS4 Journey Masterclass Rough Cut',
      workType: 'Reel',
      status: 'In Progress',
      stageKey: 'Edit',
      stageOrder: 3,
      departmentId: deptId,
      profileId: profId,
      ownerId: editorUser._id,
      deadline: new Date(Date.now() + 86400000 * 4),
    });

    designWorkItem = await WorkItem.create({
      title: 'WS4 Journey Event Poster Carousel',
      workType: 'Static Post',
      status: 'In Progress',
      stageKey: 'Design',
      stageOrder: 1,
      departmentId: deptId,
      profileId: profId,
      ownerId: designerUser._id,
      deadline: new Date(Date.now() + 86400000 * 2),
    });

    postWorkItem = await WorkItem.create({
      title: 'WS4 Journey Social Release',
      workType: 'Static Post',
      status: 'In Progress',
      stageKey: 'Publishing',
      stageOrder: 2,
      departmentId: deptId,
      profileId: profId,
      ownerId: posterUser._id,
      deadline: new Date(Date.now() + 86400000 * 5),
    });
  });

  afterAll(async () => {
    await Person.deleteMany({ email: { $regex: /@ws4-journey\.com$/ } });
    await WorkItem.deleteMany({ title: { $regex: /WS4 Journey/ } });
    await Rating.deleteMany({ feedback: { $regex: /WS4 Journey/ } });
    await mongoose.connection.close();
  });

  // ---------------------------------------------------------------------------
  // JOURNEY A: Writer writes, submits, gets revision with comments, fixes & is approved with rating
  // ---------------------------------------------------------------------------
  describe('Journey A: Writer Writing Studio, Revision Loop with Anchored Comments, and Approval Rating', () => {
    it('Writer saves draft and submits v1 in Writing Studio', async () => {
      // 1. Writer saves draft
      const draftRes = await request(app)
        .put(`/api/work-items/${scriptWorkItem._id}/draft`)
        .set('Authorization', `Bearer ${writerToken}`)
        .send({
          kind: 'document',
          document: {
            title: 'Masterclass Script Draft 1',
            htmlSnapshot: '<p>HOOK: Did you know that 90% of students choose the wrong major?</p>',
            plainText: 'HOOK: Did you know that 90% of students choose the wrong major?',
            wordCount: 12,
            readingTimeSeconds: 5,
          },
        });

      expect(draftRes.status).toBe(200);

      // 2. Writer submits draft
      const submitRes = await request(app)
        .post(`/api/work-items/${scriptWorkItem._id}/submit`)
        .set('Authorization', `Bearer ${writerToken}`)
        .send({
          kind: 'document',
          notes: 'First draft submitted for review',
        });

      expect([200, 201]).toContain(submitRes.status);
      expect(submitRes.body.data.version).toBe(1);
      expect(submitRes.body.data.status).toBe('submitted');
      scriptSubmissionV1Id = submitRes.body.data._id;
    });

    it('Creative Head inspects Review Queue and requests revision with anchored comment', async () => {
      // 1. Queue check
      const qRes = await request(app)
        .get('/api/submissions/review-queue')
        .set('Authorization', `Bearer ${headToken}`);

      expect(qRes.status).toBe(200);
      const inQueue = qRes.body.data.find(s => s._id?.toString() === scriptSubmissionV1Id?.toString());
      expect(inQueue).toBeDefined();

      // 2. Post anchored comment
      const commentRes = await request(app)
        .post(`/api/submissions/${scriptSubmissionV1Id}/comments`)
        .set('Authorization', `Bearer ${headToken}`)
        .send({
          text: 'Hook stat is too generic. Replace with specific campus graduate placement metric.',
          anchor: {
            type: 'text',
            range: { from: 18, to: 65, text: '90% of students choose the wrong major' },
          },
        });

      expect(commentRes.status).toBe(201);
      expect(commentRes.body.data.text).toContain('Hook stat is too generic');

      // 3. Request revision
      const revRes = await request(app)
        .post(`/api/submissions/${scriptSubmissionV1Id}/request-revision`)
        .set('Authorization', `Bearer ${headToken}`)
        .send({
          comment: 'Please refine the hook stat and resubmit.',
          rootCause: 'Brief unclear',
        });

      expect(revRes.status).toBe(200);
      expect(revRes.body.data.submission.status).toBe('changes_requested');

      // Check WorkItem returned to In Progress
      const itemRes = await request(app)
        .get(`/api/work-items/${scriptWorkItem._id}`)
        .set('Authorization', `Bearer ${writerToken}`);
      expect(itemRes.body.data.status).toBe('In Progress');
      expect(itemRes.body.data.revisions).toBe(1);
    });

    it('Writer resolves comment, updates script, and resubmits v2', async () => {
      // 1. Writer updates draft v2
      await request(app)
        .put(`/api/work-items/${scriptWorkItem._id}/draft`)
        .set('Authorization', `Bearer ${writerToken}`)
        .send({
          kind: 'document',
          document: {
            title: 'Masterclass Script Draft 2',
            htmlSnapshot: '<p>HOOK: 94% of our tech graduates land jobs within 90 days. Here is why.</p>',
            plainText: 'HOOK: 94% of our tech graduates land jobs within 90 days. Here is why.',
            wordCount: 14,
            readingTimeSeconds: 6,
          },
        });

      // 2. Resubmit v2
      const resubmitRes = await request(app)
        .post(`/api/work-items/${scriptWorkItem._id}/submit`)
        .set('Authorization', `Bearer ${writerToken}`)
        .send({
          kind: 'document',
          notes: 'Updated hook with verified graduate employment metric.',
        });

      expect([200, 201]).toContain(resubmitRes.status);
      expect(resubmitRes.body.data.version).toBe(2);
      scriptSubmissionV2Id = resubmitRes.body.data._id;
    });

    it('Creative Head approves v2 with 5★ rating and Great hook tag', async () => {
      const approveRes = await request(app)
        .post(`/api/submissions/${scriptSubmissionV2Id}/approve`)
        .set('Authorization', `Bearer ${headToken}`)
        .send({
          score: 5,
          feedback: 'WS4 Journey Punchy, verified hook with excellent retention pacing.',
          tags: ['Great hook'],
        });

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.rating.score).toBe(5);
      expect(approveRes.body.data.rating.tags).toContain('Great hook');

      // WorkItem advances to Approved
      const itemRes = await request(app)
        .get(`/api/work-items/${scriptWorkItem._id}`)
        .set('Authorization', `Bearer ${writerToken}`);
      expect(itemRes.body.data.status).toBe('Approved');
      expect(itemRes.body.data.rating.score).toBe(5);
    });
  });

  // ---------------------------------------------------------------------------
  // JOURNEY B: Shooter uploads footage, is approved; Editor uploads cut, gets timecode revision, resubmits, approved
  // ---------------------------------------------------------------------------
  describe('Journey B: Shoot Workspace Approval & Edit Workspace Timecode Revision Loop', () => {
    let shootSubId, editSubV1Id, editSubV2Id;

    it('Shooter submits footage in Shoot Workspace and Creative Head approves with 5★ rating', async () => {
      // 1. Shoot submit
      const shootRes = await request(app)
        .post(`/api/work-items/${shootWorkItem._id}/submit`)
        .set('Authorization', `Bearer ${shooterToken}`)
        .send({
          kind: 'video',
          notes: 'Raw A-cam and B-cam reels uploaded in 4K DCI.',
          files: [
            {
              name: 'scene1_take1.mp4',
              url: 'https://storage.local/footage/scene1_take1.mp4',
              size: 104857600,
              mime: 'video/mp4',
            },
          ],
        });

      expect([200, 201]).toContain(shootRes.status);
      shootSubId = shootRes.body.data._id;

      // 2. Creative Head approves the clips, then the Shoot step
      await MediaItem.create({ stageItemId: shootRes.body.data.workItemId, url: 'https://storage.local/footage/scene1_take1.mp4', title: 'WS4 Journey clip', status: 'approved' });
      const approveRes = await request(app)
        .post(`/api/submissions/${shootSubId}/approve`)
        .set('Authorization', `Bearer ${headToken}`)
        .send({
          score: 5,
          feedback: 'WS4 Journey Crisp lighting and clean audio capture.',
          tags: ['Clear message'],
        });

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.rating.score).toBe(5);
    });

    it('Editor submits cut v1, Creative Head adds time-pinned comment at second 4 and requests revision', async () => {
      // 1. Editor submits cut v1
      const cutRes = await request(app)
        .post(`/api/work-items/${editWorkItem._id}/submit`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          kind: 'video',
          notes: 'Rough cut with color grade and captions.',
          files: [
            {
              name: 'cut_v1.mp4',
              url: 'https://storage.local/video/cut_v1.mp4',
              size: 52428800,
              mime: 'video/mp4',
            },
          ],
        });

      expect([200, 201]).toContain(cutRes.status);
      editSubV1Id = cutRes.body.data._id;

      // 2. Creative Head adds time-pinned comment at 4 seconds
      const commentRes = await request(app)
        .post(`/api/submissions/${editSubV1Id}/comments`)
        .set('Authorization', `Bearer ${headToken}`)
        .send({
          text: 'Lower third title card disappears too early. Extend by 1.5 seconds.',
          anchor: {
            type: 'time',
            seconds: 4,
          },
        });

      expect(commentRes.status).toBe(201);
      expect(commentRes.body.data.anchor.seconds).toBe(4);

      // 3. Request revision
      const revRes = await request(app)
        .post(`/api/submissions/${editSubV1Id}/request-revision`)
        .set('Authorization', `Bearer ${headToken}`)
        .send({
          comment: 'Please adjust lower third timing at second 4.',
        });

      expect(revRes.status).toBe(200);
    });

    it('Editor resubmits cut v2 and Creative Head approves with 4★ rating', async () => {
      // 1. Editor submits cut v2
      const cutV2Res = await request(app)
        .post(`/api/work-items/${editWorkItem._id}/submit`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          kind: 'video',
          notes: 'Cut v2 with extended lower third on second 4.',
          files: [
            {
              name: 'cut_v2.mp4',
              url: 'https://storage.local/video/cut_v2.mp4',
              size: 52428800,
              mime: 'video/mp4',
            },
          ],
        });

      expect([200, 201]).toContain(cutV2Res.status);
      editSubV2Id = cutV2Res.body.data._id;

      // 2. Creative Head approves with 4★ rating
      const approveRes = await request(app)
        .post(`/api/submissions/${editSubV2Id}/approve`)
        .set('Authorization', `Bearer ${headToken}`)
        .send({
          score: 4,
          feedback: 'WS4 Journey Smooth pacing and clean typography.',
          tags: ['Clear message'],
        });

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.rating.score).toBe(4);
    });
  });

  // ---------------------------------------------------------------------------
  // JOURNEY C: Designer submits images and is approved with rating
  // ---------------------------------------------------------------------------
  describe('Journey C: Designer Workspace Image Submission & Approval', () => {
    let designSubId;

    it('Designer submits carousel images and Creative Head approves with 5★ rating', async () => {
      // 1. Designer submits image assets
      const designRes = await request(app)
        .post(`/api/work-items/${designWorkItem._id}/submit`)
        .set('Authorization', `Bearer ${designerToken}`)
        .send({
          kind: 'image',
          notes: 'Full 5-slide event carousel exported in PNG 1080x1350.',
          files: [
            {
              name: 'slide1.png',
              url: 'https://storage.local/design/slide1.png',
              size: 2048000,
              mime: 'image/png',
            },
            {
              name: 'slide2.png',
              url: 'https://storage.local/design/slide2.png',
              size: 2048000,
              mime: 'image/png',
            },
          ],
        });

      expect([200, 201]).toContain(designRes.status);
      designSubId = designRes.body.data._id;

      // 2. Creative Head approves Design stage
      const approveRes = await request(app)
        .post(`/api/submissions/${designSubId}/approve`)
        .set('Authorization', `Bearer ${headToken}`)
        .send({
          score: 5,
          feedback: 'WS4 Journey Vibrant color harmony and bold typography hierarchy.',
          tags: ['Great hook'],
        });

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.rating.score).toBe(5);
    });
  });

  // ---------------------------------------------------------------------------
  // JOURNEY D: Posting owner marks as posted
  // ---------------------------------------------------------------------------
  describe('Journey D: Posting Owner Publishes Deliverable', () => {
    it('Posting owner updates live URL and marks stage as Published', async () => {
      const publishRes = await request(app)
        .post(`/api/work-items/${postWorkItem._id}/transition`)
        .set('Authorization', `Bearer ${posterToken}`)
        .send({
          toStatus: 'Published',
          publishedUrl: 'https://instagram.com/p/haca-masterclass-reel-official',
        });

      expect(publishRes.status).toBe(200);
      expect(publishRes.body.data.status).toBe('Published');
    });
  });

  // ---------------------------------------------------------------------------
  // JOURNEY E: Worker Profile Ratings Visibility & Creative Head All-Worker Access
  // ---------------------------------------------------------------------------
  describe('Journey E: Worker Sees Own Ratings & Creative Head Inspects All', () => {
    it('Each worker sees their own ratings in their profile', async () => {
      // Writer checks own ratings
      const writerRatings = await request(app)
        .get(`/api/submissions/ratings/summary/${writerUser._id}`)
        .set('Authorization', `Bearer ${writerToken}`);

      expect(writerRatings.status).toBe(200);
      expect(writerRatings.body.data.count).toBeGreaterThanOrEqual(1);

      // Shooter checks own ratings
      const shooterRatings = await request(app)
        .get(`/api/submissions/ratings/summary/${shooterUser._id}`)
        .set('Authorization', `Bearer ${shooterToken}`);

      expect(shooterRatings.status).toBe(200);
      expect(shooterRatings.body.data.count).toBeGreaterThanOrEqual(1);
    });

    it('Creative Head can open and inspect ratings of any worker', async () => {
      const workers = [writerUser, shooterUser, editorUser, designerUser];

      for (const worker of workers) {
        const res = await request(app)
          .get(`/api/submissions/ratings/summary/${worker._id}`)
          .set('Authorization', `Bearer ${headToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.personId).toBe(worker._id.toString());
      }
    });
  });

  // ---------------------------------------------------------------------------
  // JOURNEY F: Worker cannot see another worker ratings or unrelated deliverables
  // ---------------------------------------------------------------------------
  describe('Journey F: Strict Guardrail - Zero Cross-Worker Ratings Inspection', () => {
    it('Writer cannot view Shooter ratings (HTTP 403 FORBIDDEN_RATINGS_ACCESS)', async () => {
      const res = await request(app)
        .get(`/api/submissions/ratings/summary/${shooterUser._id}`)
        .set('Authorization', `Bearer ${writerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('FORBIDDEN_RATINGS_ACCESS');
    });

    it('Editor cannot view Designer ratings via /api/people/:id/ratings (HTTP 403)', async () => {
      const res = await request(app)
        .get(`/api/people/${designerUser._id}/ratings`)
        .set('Authorization', `Bearer ${editorToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('FORBIDDEN_RATINGS_ACCESS');
    });
  });

  // ---------------------------------------------------------------------------
  // JOURNEY G: Executive sees everything read-only
  // ---------------------------------------------------------------------------
  describe('Journey G: Executive Read-Only Walk Across All Systems', () => {
    it('Executive can inspect any worker ratings', async () => {
      const res = await request(app)
        .get(`/api/submissions/ratings/summary/${writerUser._id}`)
        .set('Authorization', `Bearer ${execToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.personId).toBe(writerUser._id.toString());
    });

    it('Executive is strictly forbidden from approving deliverables (HTTP 403)', async () => {
      const res = await request(app)
        .post(`/api/submissions/${scriptSubmissionV2Id}/approve`)
        .set('Authorization', `Bearer ${execToken}`)
        .send({
          score: 5,
        });

      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('FORBIDDEN_APPROVAL');
    });

    it('Executive is strictly forbidden from editing ratings (HTTP 403)', async () => {
      const rating = await Rating.findOne({ workerId: writerUser._id });
      expect(rating).toBeDefined();

      const res = await request(app)
        .patch(`/api/submissions/ratings/${rating._id}`)
        .set('Authorization', `Bearer ${execToken}`)
        .send({
          score: 4,
          reason: 'Executive trying to modify score',
        });

      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('FORBIDDEN_ACTION');
    });
  });
});
