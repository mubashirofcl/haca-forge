import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/server.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { Deliverable } from '../src/modules/deliverables/model.js';
import { ContentItem } from '../src/modules/content/model.js';
import { Task } from '../src/modules/tasks/model.js';
import { User } from '../src/modules/users/model.js';
import { Department } from '../src/modules/departments/model.js';
import { Request as MarketingRequest } from '../src/modules/requests/model.js';
import { Comment } from '../src/modules/comments/model.js';
import { RequestType } from '../src/modules/masterData/models.js';
import { runDeliverableMigration } from '../src/modules/deliverables/migration.js';
import { initializeContentPipeline, seedPipelineTemplates } from '../src/modules/pipelines/service.js';

let adminCookie = '';
let leadCookie = '';
let workerCookie = '';
let smCookie = '';
let requesterCookie = '';
let testContentItem = null;
let testCalendarContentItem = null;
let testTask = null;
let testDeliverableId = '';
let testDepartment = null;
let testRequester = null;
let testWorker = null;

beforeAll(async () => {
  await connectDB();
  await seedPipelineTemplates();

  // Clean up any prior test records for idempotency
  await MarketingRequest.deleteMany({ requestId: 'MKT-2026-TEST-7001' });
  await ContentItem.deleteMany({ contentId: { $in: ['CNT-2026-TEST-7001', 'CNT-2026-TEST-7002'] } });

  const login = async (email, password = 'Password123!') => {
    const res = await request(app).post('/api/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    return res.headers['set-cookie'];
  };

  const [leadUser, smUser] = await Promise.all([
    User.findOne({ role: { $in: ['head', 'lead'] }, status: 'active' }),
    User.findOne({ role: 'sm_manager', status: 'active' }),
  ]);

  adminCookie = await login('admin@marketingportal.com', 'Admin1212');
  leadCookie = leadUser ? await login(leadUser.email) : adminCookie;
  smCookie = smUser ? await login(smUser.email) : adminCookie;

  testWorker = await User.findOne({ role: 'worker', status: 'active' });
  if (testWorker) {
    workerCookie = await login(testWorker.email);
  } else {
    workerCookie = leadCookie;
  }

  testRequester = await User.findOne({ role: 'dept_lead', status: 'active' });
  if (testRequester) {
    requesterCookie = await login(testRequester.email);
  } else {
    requesterCookie = leadCookie;
  }

  testDepartment = await Department.findOne({ code: 'PERF' }) || (await Department.findOne({}));

  // Create a test request-originating ContentItem with a pipeline
  const reqType = (await RequestType.findOne({})) || { _id: new mongoose.Types.ObjectId(), name: 'Video Request' };
  const testReq = await MarketingRequest.create({
    requestId: 'MKT-2026-TEST-7001',
    title: 'Phase 7 Test Promotional Video',
    sourceDepartment: testDepartment._id,
    requestType: reqType._id,
    requestTypeName: reqType.name,
    requester: testRequester._id,
    priority: 'high',
    deadline: new Date(Date.now() + 7 * 86400000),
    status: 'converted',
  });

  testContentItem = await ContentItem.create({
    contentId: 'CNT-2026-TEST-7001',
    title: 'Phase 7 Test Promotional Video',
    format: 'reel',
    sourceDepartment: testDepartment._id,
    requester: testRequester._id,
    requestId: testReq._id,
    pillar: 'Marketing',
    platforms: ['Instagram', 'YouTube'],
    publishDate: new Date(Date.now() + 10 * 86400000),
    productionDeadline: new Date(Date.now() + 3 * 86400000),
    status: 'in_production',
  });

  const tasks = await initializeContentPipeline(testContentItem);
  testTask = tasks[0];
  testTask.assignee = testWorker._id;
  await testTask.save();

  // Also create a test calendar-originating ContentItem (no requestId)
  testCalendarContentItem = await ContentItem.create({
    contentId: 'CNT-2026-TEST-7002',
    title: 'Phase 7 Calendar Social Post',
    format: 'static_post',
    sourceDepartment: testDepartment._id,
    requester: testWorker._id,
    pillar: 'Branding',
    platforms: ['Instagram'],
    publishDate: new Date(Date.now() + 5 * 86400000),
    productionDeadline: new Date(Date.now() + 2 * 86400000),
    status: 'in_production',
  });
  await initializeContentPipeline(testCalendarContentItem);
});

afterAll(async () => {
  if (testContentItem) {
    await Deliverable.deleteMany({ contentItemId: testContentItem._id });
    await Task.deleteMany({ contentItemId: testContentItem._id });
    await ContentItem.deleteOne({ _id: testContentItem._id });
  }
  if (testCalendarContentItem) {
    await Deliverable.deleteMany({ contentItemId: testCalendarContentItem._id });
    await Task.deleteMany({ contentItemId: testCalendarContentItem._id });
    await ContentItem.deleteOne({ _id: testCalendarContentItem._id });
  }
  await disconnectDB();
});

describe('Phase 7: Review, Files, Deliverables and Publishing Flow', () => {
  it('1. Migration idempotency: maps legacy Submission and Feedback docs and prevents duplicates on rerun', async () => {
    const db = mongoose.connection.db;

    // Seed dummy legacy submission and feedback
    const fakeTaskId = new mongoose.Types.ObjectId();
    const fakeContentId = new mongoose.Types.ObjectId();
    const fakeUserId = testWorker._id;

    await db.collection('submissions').insertOne({
      taskId: fakeTaskId,
      contentItemId: fakeContentId,
      version: 1,
      type: 'video',
      fileUrl: 'https://cloudinary.com/dummy/legacy_video.mp4',
      notes: 'Initial legacy video cut',
      status: 'submitted',
      uploadedBy: fakeUserId,
      createdAt: new Date(),
    });

    await db.collection('feedbacks').insertOne({
      submissionId: fakeTaskId,
      author: fakeUserId,
      feedback: 'Please enhance color grading at 00:30',
      mediaTimestamp: 30,
      createdAt: new Date(),
    });

    // Run migration 1st time
    const res1 = await runDeliverableMigration(db);
    expect(res1.status).toBe('success');
    expect(res1.migratedDeliverables).toBeGreaterThanOrEqual(1);
    expect(res1.migratedComments).toBeGreaterThanOrEqual(1);

    const deliverableCount1 = await Deliverable.countDocuments({ taskId: fakeTaskId });
    const commentCount1 = await Comment.countDocuments({ entityId: fakeTaskId });

    // Run migration 2nd time (must be idempotent: no new documents created)
    const res2 = await runDeliverableMigration(db);
    expect(res2.status).toBe('success');
    expect(res2.migratedDeliverables).toBe(0);
    expect(res2.migratedComments).toBe(0);

    const deliverableCount2 = await Deliverable.countDocuments({ taskId: fakeTaskId });
    const commentCount2 = await Comment.countDocuments({ entityId: fakeTaskId });

    expect(deliverableCount2).toBe(deliverableCount1);
    expect(commentCount2).toBe(commentCount1);

    // Clean up dummy legacy collections
    await db.collection('submissions').drop().catch(() => {});
    await db.collection('feedbacks').drop().catch(() => {});
    await db.collection('backup_submissions').drop().catch(() => {});
    await db.collection('backup_feedbacks').drop().catch(() => {});
  });

  it('2. Signature endpoint validation: enforces file type and size limits (rejects > 500MB, allows valid video)', async () => {
    // 2.1 File larger than 500 MB (e.g. 550 MB = 576,716,800 bytes)
    const oversizedRes = await request(app)
      .post('/api/uploads/sign')
      .set('Cookie', workerCookie)
      .send({
        fileName: 'huge_raw_shoot_footage.mp4',
        fileSize: 580 * 1024 * 1024, // 580 MB
        fileType: 'video/mp4',
        deliverableType: 'video',
      });

    expect(oversizedRes.status).toBe(400);
    expect(oversizedRes.body.error.code).toBe('FILE_TOO_LARGE');

    // 2.2 Allowed video size (e.g. 150 MB)
    const validRes = await request(app)
      .post('/api/uploads/sign')
      .set('Cookie', workerCookie)
      .send({
        fileName: 'edited_reel_final.mp4',
        fileSize: 150 * 1024 * 1024,
        fileType: 'video/mp4',
        deliverableType: 'video',
      });

    expect(validRes.status).toBe(200);
    expect(validRes.body.data).toHaveProperty('signature');
    expect(validRes.body.data).toHaveProperty('apiKey');
    expect(validRes.body.data).toHaveProperty('cloudName');
    expect(validRes.body.data).toHaveProperty('timestamp');
    expect(validRes.body.data).toHaveProperty('uploadUrl');
    expect(validRes.body.data.resourceType).toBe('video');
  });

  it('3. Worker upload & submission: creates Deliverable v1 and transitions Task to submitted', async () => {
    const res = await request(app)
      .post('/api/deliverables')
      .set('Cookie', workerCookie)
      .send({
        taskId: String(testTask._id),
        type: 'video',
        fileUrl: 'https://res.cloudinary.com/demo/video/upload/v1/sample_reel_v1.mp4',
        externalLink: 'https://youtube.com/draft/sample-v1',
        notes: 'Version 1 rough cut with sound effects',
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('_id');
    expect(res.body.data.version).toBe(1);
    expect(res.body.data.status).toBe('submitted');

    testDeliverableId = res.body.data._id;

    // Check task status
    const updatedTask = await Task.findById(testTask._id);
    expect(updatedTask.status).toBe('submitted');

    // Check content item moved to in_review
    const updatedContent = await ContentItem.findById(testContentItem._id);
    expect(updatedContent.status).toBe('in_review');
  });

  it('4. Review decision (changes requested): increments revisionCount, creates timestamped comments, returns task to assignee', async () => {
    const initialTask = await Task.findById(testTask._id);
    expect(initialTask.revisionCount).toBe(0);

    const reviewRes = await request(app)
      .post(`/api/deliverables/${testDeliverableId}/review`)
      .set('Cookie', leadCookie)
      .send({
        decision: 'changes_requested',
        notes: 'Please tighten pacing and fix audio balance at 00:14',
        comments: [
          { text: 'Cut extra pause before logo appears', mediaTimestamp: 14.5 },
          { text: 'Increase background music fade', mediaTimestamp: 28.0 },
        ],
      });

    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.data.status).toBe('changes_requested');
    expect(reviewRes.body.data.taskId.revisionCount).toBe(1);

    // Verify task state in database
    const revisedTask = await Task.findById(testTask._id);
    expect(revisedTask.revisionCount).toBe(1);
    expect(revisedTask.status).toBe('changes_requested');

    // Verify timestamped comments persisted
    const comments = await Comment.find({ entityId: testDeliverableId }).sort({ mediaTimestamp: 1 });
    expect(comments.length).toBe(2);
    expect(comments[0].mediaTimestamp).toBe(14.5);
    expect(comments[1].mediaTimestamp).toBe(28.0);
  });

  it('5. Worker upload revision: creates Deliverable v2 with incremented version', async () => {
    const res = await request(app)
      .post('/api/deliverables')
      .set('Cookie', workerCookie)
      .send({
        taskId: String(testTask._id),
        type: 'video',
        fileUrl: 'https://res.cloudinary.com/demo/video/upload/v2/sample_reel_v2.mp4',
        notes: 'Version 2 with pacing tightened and audio balanced',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.version).toBe(2);
    expect(res.body.data.status).toBe('submitted');

    const v2Id = res.body.data._id;

    // Check version list for this task
    const versionsRes = await request(app)
      .get(`/api/deliverables/task/${testTask._id}`)
      .set('Cookie', leadCookie);

    expect(versionsRes.status).toBe(200);
    expect(versionsRes.body.data.length).toBe(2);
    expect(versionsRes.body.data[0].version).toBe(2);
    expect(versionsRes.body.data[1].version).toBe(1);

    // Compare versions endpoint
    const compareRes = await request(app)
      .get(`/api/deliverables/compare?v1=${testDeliverableId}&v2=${v2Id}`)
      .set('Cookie', leadCookie);

    expect(compareRes.status).toBe(200);
    expect(compareRes.body.data.v1.version).toBe(1);
    expect(compareRes.body.data.v2.version).toBe(2);
    expect(compareRes.body.data.v1.comments.length).toBe(2);
  });

  it('6. Review approval & Requester confirmation loop: requires requester confirmation for request-originating item', async () => {
    // Find latest v2 deliverable
    const v2Deliverable = await Deliverable.findOne({ taskId: testTask._id, version: 2 });
    expect(v2Deliverable).not.toBeNull();

    // Mark other tasks of this content item as approved/done so all tasks finish
    await Task.updateMany(
      { contentItemId: testContentItem._id, _id: { $ne: testTask._id } },
      { status: 'done' }
    );

    // Lead approves v2
    const approveRes = await request(app)
      .post(`/api/deliverables/${v2Deliverable._id}/review`)
      .set('Cookie', leadCookie)
      .send({
        decision: 'approved',
        notes: 'Excellent revision. Audio and cuts are clean.',
      });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe('approved');

    // ContentItem originated from a Request -> requesterConfirmation must be pending
    const contentAfterApproval = await ContentItem.findById(testContentItem._id);
    expect(contentAfterApproval.requesterConfirmation.status).toBe('pending');

    // Requester confirms output
    const confirmRes = await request(app)
      .post(`/api/deliverables/confirm/${testContentItem._id}`)
      .set('Cookie', requesterCookie)
      .send({
        decision: 'confirm',
      });

    if (confirmRes.status !== 200) {
      console.log('CONFIRM_RES_ERROR:', confirmRes.status, confirmRes.body);
    }

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data.requesterConfirmation.status).toBe('confirmed');
    expect(confirmRes.body.data.status).toBe('scheduled');
  });

  it('7. Calendar-originating item skips requester confirmation and becomes scheduled immediately upon Lead approval', async () => {
    // Get task for calendar content item
    const calTask = await Task.findOne({ contentItemId: testCalendarContentItem._id });
    expect(calTask).not.toBeNull();

    // Mark other tasks as done
    await Task.updateMany(
      { contentItemId: testCalendarContentItem._id, _id: { $ne: calTask._id } },
      { status: 'done' }
    );

    // Upload deliverable
    const calDeliverable = await Deliverable.create({
      taskId: calTask._id,
      contentItemId: testCalendarContentItem._id,
      version: 1,
      type: 'image',
      fileUrl: 'https://res.cloudinary.com/demo/image/upload/sample_social_post.png',
      uploadedBy: testWorker._id,
      status: 'submitted',
    });
    calTask.status = 'submitted';
    await calTask.save();

    // Lead approves deliverable
    const approveRes = await request(app)
      .post(`/api/deliverables/${calDeliverable._id}/review`)
      .set('Cookie', leadCookie)
      .send({
        decision: 'approved',
        notes: 'Great visual design, approved for scheduling.',
      });

    if (approveRes.status !== 200) {
      console.log('TEST7_APPROVE_ERROR:', approveRes.status, approveRes.body);
    }
    expect(approveRes.status).toBe(200);

    // Check calendar content item: skipped confirmation and moved straight to scheduled
    const updatedCalContent = await ContentItem.findById(testCalendarContentItem._id);
    expect(updatedCalContent.requesterConfirmation.status).toBe('not_required');
    expect(updatedCalContent.status).toBe('scheduled');
  });

  it('8. Permission enforcement: workers cannot approve deliverables, only sm_manager/admin can publish', async () => {
    const deliv = await Deliverable.findOne({ status: 'submitted' }) || (await Deliverable.findOne());

    // Worker attempts to approve deliverable -> 403 Forbidden
    const workerApproveRes = await request(app)
      .post(`/api/deliverables/${deliv._id}/review`)
      .set('Cookie', workerCookie)
      .send({ decision: 'approved' });

    expect(workerApproveRes.status).toBe(403);

    // SM Manager publishes scheduled calendar deliverable -> 200
    const publishRes = await request(app)
      .patch(`/api/content/${testCalendarContentItem._id}/publish`)
      .set('Cookie', smCookie)
      .send({
        publishedUrl: 'https://instagram.com/p/test_published_phase7',
        metrics: { reach: 1200, views: 950 },
      });

    expect(publishRes.status).toBe(200);
    expect(publishRes.body.data.status).toBe('published');
  });

  it('9. Performance hand-off and File library query test', async () => {
    // Hand to performance
    const handRes = await request(app)
      .post(`/api/deliverables/performance/${testContentItem._id}/hand`)
      .set('Cookie', leadCookie);

    expect(handRes.status).toBe(200);
    expect(handRes.body.data.performanceStatus).toBe('handed_to_performance');

    // Launch live
    const liveRes = await request(app)
      .post(`/api/deliverables/performance/${testContentItem._id}/live`)
      .set('Cookie', leadCookie)
      .send({
        liveUrl: 'https://facebook.com/ads/test_ad_live_01',
      });

    expect(liveRes.status).toBe(200);
    expect(liveRes.body.data.performanceStatus).toBe('live');
    expect(liveRes.body.data.status).toBe('live');

    // Query file library
    const fileLibRes = await request(app)
      .get('/api/files?type=video')
      .set('Cookie', leadCookie);

    expect(fileLibRes.status).toBe(200);
    expect(Array.isArray(fileLibRes.body.data)).toBe(true);
    expect(fileLibRes.body.total).toBeGreaterThanOrEqual(1);
  });
});
