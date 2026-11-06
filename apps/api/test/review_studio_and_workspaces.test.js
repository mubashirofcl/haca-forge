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
import { Submission, SubmissionComment } from '../src/modules/submissions/model.js';
import * as submissionService from '../src/modules/submissions/service.js';

describe('Review Studio & Workspaces API Tests (WS3)', () => {
  let adminUser;
  let creativeHeadUser;
  let writerUser;
  let videographerUser;
  let adminToken;
  let headToken;
  let shooterToken;

  let shootWorkItem;
  let editWorkItem;
  let deptDoc;
  let profileDoc;

  beforeAll(async () => {
    await connectDB();

    deptDoc = await mongoose.connection.db.collection('departments').findOne({});
    profileDoc = await mongoose.connection.db.collection('profiles').findOne({});

    const deptId = deptDoc?._id || new mongoose.Types.ObjectId();
    const profId = profileDoc?._id || new mongoose.Types.ObjectId();

    // Clean test data
    await Person.deleteMany({ email: { $regex: /@ws3-test\.com$/ } });
    await WorkItem.deleteMany({ title: { $regex: /WS3 Test/ } });

    adminUser = await Person.create({
      name: 'Admin Boss',
      email: 'admin@ws3-test.com',
      role: 'admin',
      department: 'Creative',
      jobRole: 'Creative Manager (TL)',
      status: 'active',
      authMethod: 'password',
      profileAccess: [profId],
    });

    creativeHeadUser = await Person.create({
      name: 'Creative Head',
      email: 'ch@ws3-test.com',
      role: 'creative_head',
      department: 'Creative',
      jobRole: 'Creative Manager (TL)',
      status: 'active',
      authMethod: 'password',
      profileAccess: [profId],
    });

    writerUser = await Person.create({
      name: 'Script Writer',
      email: 'writer@ws3-test.com',
      role: 'team_member',
      department: 'Content',
      jobRole: 'Writer',
      status: 'active',
      authMethod: 'password',
      profileAccess: [profId],
    });

    videographerUser = await Person.create({
      name: 'Videographer Pro',
      email: 'shooter@ws3-test.com',
      role: 'team_member',
      department: 'Video',
      jobRole: 'Videographer',
      status: 'active',
      authMethod: 'password',
      profileAccess: [profId],
    });

    adminToken = jwt.sign(
      { userId: adminUser._id.toString(), email: adminUser.email, role: adminUser.role, name: adminUser.name },
      env.JWT_SECRET,
      { expiresIn: '2h' }
    );
    headToken = jwt.sign(
      { userId: creativeHeadUser._id.toString(), email: creativeHeadUser.email, role: creativeHeadUser.role, name: creativeHeadUser.name },
      env.JWT_SECRET,
      { expiresIn: '2h' }
    );
    shooterToken = jwt.sign(
      { userId: videographerUser._id.toString(), email: videographerUser.email, role: videographerUser.role, name: videographerUser.name },
      env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    shootWorkItem = await WorkItem.create({
      title: 'WS3 Test Shoot Item',
      workType: 'Reel',
      status: 'In Progress',
      stageKey: 'Shoot',
      stageOrder: 2,
      departmentId: deptId,
      profileId: profId,
      ownerId: videographerUser._id,
      deadline: new Date(Date.now() + 86400000 * 3),
      estimatedEffortHrs: 4,
    });

    editWorkItem = await WorkItem.create({
      title: 'WS3 Test Edit Item',
      workType: 'Reel',
      status: 'In Progress',
      stageKey: 'Edit',
      stageOrder: 3,
      departmentId: deptId,
      profileId: profId,
      ownerId: videographerUser._id,
      deadline: new Date(Date.now() + 86400000 * 5),
      estimatedEffortHrs: 6,
    });
  });

  afterAll(async () => {
    await Person.deleteMany({ email: { $regex: /@ws3-test\.com$/ } });
    await WorkItem.deleteMany({ title: { $regex: /WS3 Test/ } });
    if (shootWorkItem && editWorkItem) {
      await Submission.deleteMany({ workItemId: { $in: [shootWorkItem._id, editWorkItem._id] } });
      await MediaItem.deleteMany({ stageItemId: shootWorkItem._id });
    }
  });

  it('1. FIFO Review Queue: orders oldest first with calculated waitingDays', async () => {
    const olderDate = new Date(Date.now() - 86400000 * 4); // 4 days ago
    const newerDate = new Date(Date.now() - 86400000 * 1); // 1 day ago

    // The queue lists a version only while its step is awaiting review.
    await WorkItem.updateMany({ _id: { $in: [shootWorkItem._id, editWorkItem._id] } }, { status: 'Pending' });

    const subOlder = await Submission.create({
      workItemId: shootWorkItem._id,
      kind: 'video',
      version: 1,
      status: 'submitted',
      files: [{ url: 'https://cdn.haca.test/footage/raw1.mp4' }],
      submittedById: videographerUser._id,
      submittedAt: olderDate,
    });

    const subNewer = await Submission.create({
      workItemId: editWorkItem._id,
      kind: 'video',
      version: 1,
      status: 'submitted',
      files: [{ url: 'https://cdn.haca.test/cuts/cut1.mp4' }],
      submittedById: videographerUser._id,
      submittedAt: newerDate,
    });

    const res = await request(app)
      .get('/api/submissions/review-queue')
      .set('Authorization', `Bearer ${headToken}`)
      .expect(200);

    const queue = res.body.data;
    expect(Array.isArray(queue)).toBe(true);

    const olderIdx = queue.findIndex((q) => q._id.toString() === subOlder._id.toString());
    const newerIdx = queue.findIndex((q) => q._id.toString() === subNewer._id.toString());

    expect(olderIdx).not.toBe(-1);
    expect(newerIdx).not.toBe(-1);
    expect(olderIdx).toBeLessThan(newerIdx); // FIFO: older is first
    expect(queue[olderIdx].waitingDays).toBeGreaterThanOrEqual(3);
  });

  it('2. Anchored Comments: text, timecode second, and coordinate point comments', async () => {
    const sub = await Submission.findOne({ workItemId: shootWorkItem._id });
    expect(sub).toBeDefined();

    // Add time comment
    const timecodeRes = await request(app)
      .post(`/api/submissions/${sub._id}/comments`)
      .set('Authorization', `Bearer ${headToken}`)
      .send({
        text: 'Cut 1 second earlier here',
        anchor: {
          type: 'time',
          seconds: 24,
        },
      })
      .expect(201);

    expect(timecodeRes.body.data.anchor.type).toBe('time');
    expect(timecodeRes.body.data.anchor.seconds).toBe(24);

    // Add point comment
    const pointRes = await request(app)
      .post(`/api/submissions/${sub._id}/comments`)
      .set('Authorization', `Bearer ${headToken}`)
      .send({
        text: 'Check logo alignment',
        anchor: {
          type: 'point',
          x: 50.5,
          y: 75.0,
        },
      })
      .expect(201);

    expect(pointRes.body.data.anchor.type).toBe('point');
    expect(pointRes.body.data.anchor.x).toBe(50.5);

    // Resolve comment
    const commentId = pointRes.body.data._id;
    const resolveRes = await request(app)
      .post(`/api/submissions/comments/${commentId}/resolve`)
      .set('Authorization', `Bearer ${headToken}`)
      .send({ resolved: true })
      .expect(200);

    expect(resolveRes.body.data.resolved).toBe(true);
  });

  it('3. Decision Bar Rules: Approve requires 1-5 rating, records feedback and tags', async () => {
    // Transition shootWorkItem to Pending so approve action is available
    shootWorkItem.status = 'Pending';
    await shootWorkItem.save();
    // A Shoot step needs its clips approved first.
    await MediaItem.create({ stageItemId: shootWorkItem._id, url: 'https://example.test/clip.mp4', title: 'WS3 clip', status: 'approved' });

    const sub = await Submission.findOne({ workItemId: shootWorkItem._id });

    // Missing score should fail
    await request(app)
      .post(`/api/submissions/${sub._id}/approve`)
      .set('Authorization', `Bearer ${headToken}`)
      .send({ feedback: 'Good job' })
      .expect(400);

    // Score 0 should fail
    await request(app)
      .post(`/api/submissions/${sub._id}/approve`)
      .set('Authorization', `Bearer ${headToken}`)
      .send({ score: 0 })
      .expect(400);

    // Valid approval with score 4 and quality tags
    const approveRes = await request(app)
      .post(`/api/submissions/${sub._id}/approve`)
      .set('Authorization', `Bearer ${headToken}`)
      .send({
        score: 4,
        feedback: 'Great framing and lighting on campus interview.',
        tags: ['Great hook', 'Clear message'],
      })
      .expect(200);

    expect(approveRes.body.data.submission.status).toBe('approved');
    expect(approveRes.body.data.rating.score).toBe(4);
    expect(approveRes.body.data.rating.tags).toContain('Great hook');
  });

  it('4. Decision Bar Rules: Request Revision requires note or comment and root cause', async () => {
    const sub = await Submission.findOne({ workItemId: editWorkItem._id });

    // Missing comment/note should fail
    await request(app)
      .post(`/api/submissions/${sub._id}/request-revision`)
      .set('Authorization', `Bearer ${headToken}`)
      .send({
        comment: '',
      })
      .expect(400);

    // Valid revision request
    const revisionRes = await request(app)
      .post(`/api/submissions/${sub._id}/request-revision`)
      .set('Authorization', `Bearer ${headToken}`)
      .send({
        comment: 'Pacing slows down in middle section. Trim 5s.',
        rootCause: 'Creative Choice',
      })
      .expect(200);

    expect(revisionRes.body.data.submission.status).toBe('changes_requested');
  });

  it('5. Upload Signing: validates MIME types and limits', async () => {
    // Valid video upload sign
    const signRes = await request(app)
      .post('/api/uploads/sign')
      .set('Authorization', `Bearer ${shooterToken}`)
      .send({
        fileName: 'campus_b_roll.mp4',
        fileSize: 150 * 1024 * 1024, // 150 MB (< 500 MB limit)
        fileType: 'video/mp4',
        kind: 'video',
      })
      .expect(200);

    expect(signRes.body.data).toBeDefined();

    // Rejection of oversized file (> 500 MB for video)
    await request(app)
      .post('/api/uploads/sign')
      .set('Authorization', `Bearer ${shooterToken}`)
      .send({
        fileName: 'huge_raw.mov',
        fileSize: 550 * 1024 * 1024, // 550 MB
        fileType: 'video/quicktime',
        kind: 'video',
      })
      .expect(400);
  });

  it('6. Mark as Posted: validates live URL and updates status to Published', async () => {
    const postItem = await WorkItem.create({
      title: 'WS3 Test Post Item',
      workType: 'Reel',
      status: 'In Progress',
      stageKey: 'Post',
      stageOrder: 4,
      departmentId: shootWorkItem.departmentId,
      profileId: shootWorkItem.profileId,
      ownerId: videographerUser._id,
      deadline: new Date(Date.now() + 86400000),
      estimatedEffortHrs: 1,
    });

    const markRes = await request(app)
      .post(`/api/work-items/${postItem._id}/transition`)
      .set('Authorization', `Bearer ${shooterToken}`)
      .send({
        toStatus: 'Published',
        publishedUrl: 'https://www.instagram.com/p/C3x918abc/',
        comment: 'Cross-posted to IG and Facebook',
      })
      .expect(200);

    expect(markRes.body.data.status).toBe('Published');
    expect(markRes.body.data.publishedUrl).toBe('https://www.instagram.com/p/C3x918abc/');

    await WorkItem.findByIdAndDelete(postItem._id);
  });
});
