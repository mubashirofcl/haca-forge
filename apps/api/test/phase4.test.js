import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/server.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { ContentItem } from '../src/modules/content/model.js';
import { Task } from '../src/modules/tasks/model.js';
import { Request } from '../src/modules/requests/model.js';
import { User } from '../src/modules/users/model.js';
import { Department } from '../src/modules/departments/model.js';
import { seedPipelineTemplates } from '../src/modules/pipelines/service.js';

let adminCookie = '';
let leadCookie = '';
let salesStaffCookie = '';
let contentWorkerCookie = '';
let graphicsWorkerCookie = '';

let testDeptId = '';
let testContentItemId = '';
let testRequestId = '';
let testStage1TaskId = '';
let testStage2TaskId = '';

beforeAll(async () => {
  await connectDB();
  await seedPipelineTemplates();

  const login = async (email, password = 'Password123!') => {
    const res = await request(app).post('/api/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    return res.headers['set-cookie'];
  };

  [adminCookie, leadCookie, salesStaffCookie] = await Promise.all([
    login('admin@marketingportal.com', 'Admin1212'),
    login('marcus.lead@marketingportal.com'),
    login('jessica.sales@marketingportal.com'),
  ]);

  const salesDept = await Department.findOne({ type: 'sales' });
  testDeptId = salesDept?._id.toString();

  // Find or create test workers for content and graphics
  const contentWorker = await User.findOne({ team: 'content', role: { $in: ['worker', 'team_lead'] } });
  if (contentWorker) {
    const res = await request(app).post('/api/auth/login').send({ email: contentWorker.email, password: 'Password123!' });
    if (res.status === 200) contentWorkerCookie = res.headers['set-cookie'];
  }

  const graphicsWorker = await User.findOne({ team: 'graphics', role: { $in: ['worker', 'team_lead'] } });
  if (graphicsWorker) {
    const res = await request(app).post('/api/auth/login').send({ email: graphicsWorker.email, password: 'Password123!' });
    if (res.status === 200) graphicsWorkerCookie = res.headers['set-cookie'];
  }
}, 30000);

afterAll(async () => {
  await ContentItem.deleteMany({ title: { $regex: /Phase 4 Test/i } });
  await Task.deleteMany({ title: { $regex: /Phase 4 Test/i } });
  await Request.deleteMany({ title: { $regex: /Phase 4 Test/i } });
  await disconnectDB();
}, 30000);

describe('Phase 4: Content Core, Pipelines & Handoffs Engine', () => {
  // ----------------------------------------------------
  // 1. Content Item Creation & Pipeline Generation
  // ----------------------------------------------------
  it('creates ContentItem with automatically derived productionDeadline and pipeline tasks', async () => {
    const publishDate = new Date(Date.now() + 14 * 86400000).toISOString();

    const res = await request(app)
      .post('/api/content')
      .set('Cookie', leadCookie)
      .send({
        title: 'Phase 4 Test - Q4 Strategy Static Post',
        format: 'static_post',
        sourceDepartment: testDeptId,
        platforms: ['instagram', 'linkedin'],
        publishDate,
        priority: 'high',
        brief: 'Deliver an engaging brand stat infographic for enterprise audience.',
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.contentId).toMatch(/^CNT-\d{4}-\d{4}$/);
    expect(res.body.data.status).toBe('in_production');

    testContentItemId = res.body.data._id;

    // Check production deadline was automatically set to publishDate minus 3 days
    const pubTime = new Date(publishDate).getTime();
    const prodTime = new Date(res.body.data.productionDeadline).getTime();
    const diffDays = Math.round((pubTime - prodTime) / (24 * 3600 * 1000));
    expect(diffDays).toBe(3);

    // Check pipeline stages created
    const tasksRes = await request(app)
      .get(`/api/tasks?contentItemId=${testContentItemId}`)
      .set('Cookie', leadCookie);

    expect(tasksRes.status).toBe(200);
    expect(tasksRes.body.data.length).toBe(3); // static_post has 3 stages (content, graphics, lead_review)

    const stage1 = tasksRes.body.data.find((t) => t.stageOrder === 1);
    const stage2 = tasksRes.body.data.find((t) => t.stageOrder === 2);

    expect(stage1).toBeDefined();
    expect(stage1.team).toBe('content');
    expect(stage1.taskId).toMatch(/^TSK-\d{4}-\d{4}$/);

    expect(stage2).toBeDefined();
    expect(stage2.team).toBe('graphics');
    expect(stage2.dependencies.length).toBe(1);

    testStage1TaskId = stage1._id;
    testStage2TaskId = stage2._id;
  });

  // ----------------------------------------------------
  // 2. Dependency Checking & Blocking
  // ----------------------------------------------------
  it('blocks starting stage 2 task until stage 1 prerequisite task is done', async () => {
    const res = await request(app)
      .post(`/api/tasks/${testStage2TaskId}/transition`)
      .set('Cookie', leadCookie)
      .send({ status: 'in_progress' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('DEPENDENCY_BLOCKED');
  });

  // ----------------------------------------------------
  // 3. Automated Stage Handoff Trigger
  // ----------------------------------------------------
  it('completing stage 1 task unblocks and triggers handoff to stage 2', async () => {
    // 1. Move stage 1 to in_progress
    const progressRes = await request(app)
      .post(`/api/tasks/${testStage1TaskId}/transition`)
      .set('Cookie', leadCookie)
      .send({ status: 'in_progress' });
    expect(progressRes.status).toBe(200);

    // 2. Mark stage 1 as done
    const doneRes = await request(app)
      .post(`/api/tasks/${testStage1TaskId}/transition`)
      .set('Cookie', leadCookie)
      .send({ status: 'done' });
    expect(doneRes.status).toBe(200);
    expect(doneRes.body.data.status).toBe('done');

    // 3. Now stage 2 can be transitioned to in_progress
    const stage2Res = await request(app)
      .post(`/api/tasks/${testStage2TaskId}/transition`)
      .set('Cookie', leadCookie)
      .send({ status: 'in_progress' });
    expect(stage2Res.status).toBe(200);
    expect(stage2Res.body.data.status).toBe('in_progress');
  });

  // ----------------------------------------------------
  // 4. Mandatory Reason Code on Hold / Blocked
  // ----------------------------------------------------
  it('requires a mandatory holdReason when transitioning task to blocked or on_hold', async () => {
    const invalidRes = await request(app)
      .post(`/api/tasks/${testStage2TaskId}/transition`)
      .set('Cookie', leadCookie)
      .send({ status: 'blocked' }); // Missing holdReason

    expect(invalidRes.status).toBe(400);
    expect(invalidRes.body.error.code).toBe('REASON_CODE_REQUIRED');

    const validRes = await request(app)
      .post(`/api/tasks/${testStage2TaskId}/transition`)
      .set('Cookie', leadCookie)
      .send({
        status: 'blocked',
        holdReason: 'waiting_for_content',
        holdComment: 'Awaiting high-res brand vector logo from client',
      });

    expect(validRes.status).toBe(200);
    expect(validRes.body.data.status).toBe('blocked');
    expect(validRes.body.data.holdReason).toBe('waiting_for_content');
  });

  // ----------------------------------------------------
  // 5. Intelligent Workload & Leave-Aware Suggestions
  // ----------------------------------------------------
  it('returns workload metrics and excludes workers on leave from suggestions', async () => {
    // Put one content worker on leave temporarily
    const worker = await User.findOne({ team: 'content', role: 'worker' });
    if (worker) {
      worker.onLeave = true;
      await worker.save();
    }

    const workloadRes = await request(app)
      .get('/api/tasks/workload?team=content')
      .set('Cookie', leadCookie);

    expect(workloadRes.status).toBe(200);
    expect(Array.isArray(workloadRes.body.data)).toBe(true);

    const onLeaveWorker = workloadRes.body.data.find((w) => w.user.email === worker?.email);
    if (onLeaveWorker) {
      expect(onLeaveWorker.user.onLeave).toBe(true);
      expect(onLeaveWorker.status).toBe('on_leave');
    }

    // Check suggestions endpoint
    const suggestionsRes = await request(app)
      .get('/api/tasks/workload/suggestions?team=content')
      .set('Cookie', leadCookie);

    expect(suggestionsRes.status).toBe(200);
    // Worker on leave MUST NOT be present in suggestions
    const suggestedEmails = suggestionsRes.body.data.map((s) => s.user.email);
    if (worker) {
      expect(suggestedEmails).not.toContain(worker.email);
    }

    // Restore worker leave status
    if (worker) {
      worker.onLeave = false;
      await worker.save();
    }
  });

  // ----------------------------------------------------
  // 6. Complete Request Conversion Flow
  // ----------------------------------------------------
  it('converts an accepted request into a ContentItem and updates request to converted', async () => {
    // 1. Create a request as staff
    const reqRes = await request(app)
      .post('/api/requests')
      .set('Cookie', salesStaffCookie)
      .send({
        title: 'Phase 4 Test - Sales Launch Pitch Deck',
        sourceDepartment: testDeptId,
        requestType: 'General',
        priority: 'high',
        deadline: new Date(Date.now() + 10 * 86400000).toISOString(),
        dynamicFields: { clientName: 'Enterprise Client' },
      });

    expect(reqRes.status).toBe(201);
    testRequestId = reqRes.body.request._id;

    // 2. Accept it as lead
    const acceptRes = await request(app)
      .post(`/api/requests/${testRequestId}/triage/accept`)
      .set('Cookie', leadCookie)
      .send({ priority: 'high', comment: 'Approved for Q4 production pipeline.' });
    expect(acceptRes.status).toBe(200);

    // 3. Convert request to ContentItem with Reel format
    const convertRes = await request(app)
      .post(`/api/requests/${testRequestId}/triage/convert`)
      .set('Cookie', leadCookie)
      .send({
        format: 'reel',
        platforms: ['instagram', 'youtube'],
        publishDate: new Date(Date.now() + 14 * 86400000).toISOString(),
        priority: 'high',
        pillar: 'Brand Story',
      });

    expect(convertRes.status).toBe(200);
    expect(convertRes.body.contentItem).toBeDefined();
    expect(convertRes.body.contentItem.contentId).toMatch(/^CNT-\d{4}-\d{4}$/);
    expect(convertRes.body.contentItem.format).toBe('reel');
    expect(convertRes.body.contentItem.tasks.length).toBe(4); // Reel pipeline has 4 stages

    // Check request transitioned to converted
    const verifyReqRes = await request(app)
      .get(`/api/requests/${testRequestId}`)
      .set('Cookie', salesStaffCookie);

    expect(verifyReqRes.status).toBe(200);
    expect(verifyReqRes.body.request.status).toBe('converted');
  });

  // ----------------------------------------------------
  // 7. Comments Thread Support
  // ----------------------------------------------------
  it('supports threaded comments on content items and tasks', async () => {
    const commentRes = await request(app)
      .post('/api/comments')
      .set('Cookie', leadCookie)
      .send({
        entityType: 'content',
        entityId: testContentItemId,
        text: 'Initial review looks very promising, please proceed with graphics export.',
      });

    expect(commentRes.status).toBe(201);
    expect(commentRes.body.data.text).toContain('Initial review looks very promising');

    const listRes = await request(app)
      .get(`/api/comments?entityType=content&entityId=${testContentItemId}`)
      .set('Cookie', leadCookie);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);
  });
});
