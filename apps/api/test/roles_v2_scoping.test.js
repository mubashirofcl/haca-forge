import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { app } from '../src/server.js';
import { connectDB } from '../src/config/db.js';
import { User } from '../src/modules/users/model.js';
import { TeamAssignment } from '../src/modules/teamAssignments/model.js';
import { Task } from '../src/modules/tasks/model.js';
import { ContentItem } from '../src/modules/content/model.js';
import { Deliverable } from '../src/modules/deliverables/model.js';
import { LeaveRequest } from '../src/modules/leave/model.js';
import { TimeEntry } from '../src/modules/time/model.js';
import { Department } from '../src/modules/departments/model.js';
import { assignWorker } from '../src/modules/teamAssignments/service.js';
import { getScopingFilter, getIndividualReport } from '../src/modules/reports/service.js';
import { getDashboardSummaryByRole } from '../src/modules/reports/dashboard.service.js';

describe('Roles v2 Scoping & Governance Integration Tests', () => {
  const testPrefix = 'sc_test_' + Date.now();
  let adminCookie;
  let headCookie;
  let leadACookie;
  let leadBCookie;
  let worker1Cookie;
  let worker2Cookie;
  let worker3Cookie;

  let adminUser;
  let headUser;
  let leadA;
  let leadB;
  let worker1;
  let worker2;
  let worker3;
  let testContentItem;

  beforeAll(async () => {
    await connectDB();

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('Password123!', salt);

    const login = async (email, password = 'Password123!') => {
      const res = await request(app).post('/api/auth/login').send({ email, password });
      expect(res.status).toBe(200);
      return res.headers['set-cookie'];
    };

    // Ensure Admin
    adminUser = await User.findOne({ email: 'admin@marketingportal.com' });
    if (!adminUser) {
      adminUser = await User.create({
        name: 'Scoping Admin',
        email: `${testPrefix}_admin@example.com`,
        role: 'admin',
        passwordHash,
        status: 'active',
      });
      adminCookie = await login(adminUser.email, 'Password123!');
    } else {
      adminCookie = await login(adminUser.email, 'Admin1212');
    }

    // Create Head
    headUser = await User.create({
      name: 'Scoping Head',
      email: `${testPrefix}_head@example.com`,
      role: 'head',
      passwordHash,
      status: 'active',
    });
    headCookie = await login(headUser.email);

    // Create Team Leads
    leadA = await User.create({
      name: 'Lead A',
      email: `${testPrefix}_leada@example.com`,
      role: 'team_lead',
      teamId: 'editor',
      passwordHash,
      status: 'active',
    });
    leadACookie = await login(leadA.email);

    leadB = await User.create({
      name: 'Lead B',
      email: `${testPrefix}_leadb@example.com`,
      role: 'team_lead',
      teamId: 'graphics',
      passwordHash,
      status: 'active',
    });
    leadBCookie = await login(leadB.email);

    // Create Workers in valid teams: 'editor', 'content', 'graphics'
    worker1 = await User.create({
      name: 'Worker 1 Editor',
      email: `${testPrefix}_worker1@example.com`,
      role: 'worker',
      teamId: 'editor',
      passwordHash,
      status: 'active',
    });
    worker1Cookie = await login(worker1.email);

    worker2 = await User.create({
      name: 'Worker 2 Content',
      email: `${testPrefix}_worker2@example.com`,
      role: 'worker',
      teamId: 'content',
      passwordHash,
      status: 'active',
    });
    worker2Cookie = await login(worker2.email);

    worker3 = await User.create({
      name: 'Worker 3 Graphics',
      email: `${testPrefix}_worker3@example.com`,
      role: 'worker',
      teamId: 'graphics',
      passwordHash,
      status: 'active',
    });
    worker3Cookie = await login(worker3.email);

    // Lead A manages worker1 (editor) and worker2 (content)
    await assignWorker(leadA._id, worker1._id, adminUser);
    await assignWorker(leadA._id, worker2._id, adminUser);

    // Lead B manages worker3 (graphics)
    await assignWorker(leadB._id, worker3._id, adminUser);

    // Shared Content Item for test tasks
    let dept = await Department.findOne();
    if (!dept) {
      dept = await Department.create({ name: 'Marketing Dept', code: 'MKT' });
    }

    testContentItem = await ContentItem.create({
      contentId: `CNT-${Date.now()}`,
      title: 'Scoping Test Content Item',
      format: 'reel',
      platform: 'instagram',
      platforms: ['Instagram'],
      sourceDepartment: dept._id,
      requester: adminUser._id,
      publishDate: new Date(Date.now() + 864000000),
      status: 'in_production',
    });
  });

  afterAll(async () => {
    // Teardown test documents
    if (adminUser) {
      await User.deleteMany({ email: { $regex: `^${testPrefix}` } });
      await TeamAssignment.deleteMany({
        $or: [
          { teamLeadId: { $in: [leadA?._id, leadB?._id] } },
          { workerId: { $in: [worker1?._id, worker2?._id, worker3?._id] } },
        ],
      });
      if (testContentItem) {
        await ContentItem.findByIdAndDelete(testContentItem._id);
        await Task.deleteMany({ contentItemId: testContentItem._id });
        await Deliverable.deleteMany({ contentItemId: testContentItem._id });
      }
    }
  });

  it('1. Team Dashboard Scoping: team_lead can view teams with managed workers, blocked on teams without managed workers', async () => {
    // Lead A manages worker1 in editor -> 200
    const editorRes = await request(app).get('/api/teams/editor/dashboard').set('Cookie', leadACookie);
    expect(editorRes.status).toBe(200);
    expect(editorRes.body.data.team.name).toBe('editor');
    const memberIds = editorRes.body.data.members.map((m) => m._id.toString());
    expect(memberIds).toContain(worker1._id.toString());

    // Lead A manages worker2 in content -> 200
    const contentRes = await request(app).get('/api/teams/content/dashboard').set('Cookie', leadACookie);
    expect(contentRes.status).toBe(200);
    expect(contentRes.body.data.team.name).toBe('content');

    // Lead A manages NO workers in graphics -> 403 Forbidden
    const graphicsRes = await request(app).get('/api/teams/graphics/dashboard').set('Cookie', leadACookie);
    expect(graphicsRes.status).toBe(403);
    expect(graphicsRes.body.error?.message || graphicsRes.body.error).toContain('at least one worker');

    // Head can view all teams
    const headRes = await request(app).get('/api/teams/graphics/dashboard').set('Cookie', headCookie);
    expect(headRes.status).toBe(200);
  });

  it('2. Task Reassignment Scoping: team_lead can only reassign between managed workers and sets assignedBy', async () => {
    // Create task assigned to worker1
    const task = await Task.create({
      taskId: `TSK-${Date.now()}-1`,
      title: 'Scoping Reassign Task',
      contentItemId: testContentItem._id,
      assignee: worker1._id,
      stageKey: 'editing',
      team: 'editor',
      status: 'assigned',
      dueDate: new Date(Date.now() + 86400000),
    });

    // Lead A reassigns worker1 -> worker2 (both managed by Lead A) -> 200
    const successRes = await request(app)
      .post('/api/teams/reassign-task')
      .set('Cookie', leadACookie)
      .send({
        taskId: task._id.toString(),
        targetWorkerId: worker2._id.toString(),
        reason: 'Workload leveling',
      });

    expect(successRes.status).toBe(200);
    expect(successRes.body.data.task.assignee._id.toString()).toBe(worker2._id.toString());
    expect(successRes.body.data.task.assignedBy.toString()).toBe(leadA._id.toString());

    // Lead A attempts to reassign to worker3 (managed by Lead B) -> 403
    const failTargetRes = await request(app)
      .post('/api/teams/reassign-task')
      .set('Cookie', leadACookie)
      .send({
        taskId: task._id.toString(),
        targetWorkerId: worker3._id.toString(),
        reason: 'Invalid assignment',
      });

    expect(failTargetRes.status).toBe(403);
    expect(failTargetRes.body.error?.message || failTargetRes.body.error).toContain('workers they manage');

    // Lead B attempts to reassign task currently assigned to worker2 (not managed by Lead B) -> 403
    const failCurrentRes = await request(app)
      .post('/api/teams/reassign-task')
      .set('Cookie', leadBCookie)
      .send({
        taskId: task._id.toString(),
        targetWorkerId: worker3._id.toString(),
        reason: 'Invalid theft',
      });

    expect(failCurrentRes.status).toBe(403);
    expect(failCurrentRes.body.error?.message || failCurrentRes.body.error).toContain('workers they manage');
  });

  it('3. Leave Request Scoping: team_lead can only list and approve leave requests for managed workers', async () => {
    // worker1 requests leave
    const leaveReq = await LeaveRequest.create({
      userId: worker1._id,
      startDate: new Date(Date.now() + 86400000),
      endDate: new Date(Date.now() + 172800000),
      reason: 'Personal time off',
      status: 'pending',
    });

    // Lead A lists leave requests -> sees worker1
    const listResA = await request(app).get('/api/leave').set('Cookie', leadACookie);
    expect(listResA.status).toBe(200);
    const leaveIdsA = listResA.body.data.map((l) => l._id.toString());
    expect(leaveIdsA).toContain(leaveReq._id.toString());

    // Lead B lists leave requests -> does NOT see worker1
    const listResB = await request(app).get('/api/leave').set('Cookie', leadBCookie);
    expect(listResB.status).toBe(200);
    const leaveIdsB = listResB.body.data.map((l) => l._id.toString());
    expect(leaveIdsB).not.toContain(leaveReq._id.toString());

    // Lead B attempts to review worker1's leave via PATCH -> 403
    const reviewResB = await request(app)
      .patch(`/api/leave/${leaveReq._id}/review`)
      .set('Cookie', leadBCookie)
      .send({
        status: 'approved',
        reviewComment: 'Unauthorized approval',
      });
    expect(reviewResB.status).toBe(403);
    expect(reviewResB.body.error?.message || reviewResB.body.error).toContain('workers they manage');

    // Lead A reviews and approves worker1's leave -> 200
    const reviewResA = await request(app)
      .patch(`/api/leave/${leaveReq._id}/review`)
      .set('Cookie', leadACookie)
      .send({
        status: 'approved',
        reviewComment: 'Approved by assigned lead',
      });
    expect(reviewResA.status).toBe(200);
    expect(reviewResA.body.data.status).toBe('approved');
  });

  it('4. Timesheet Scoping: team_lead can only list and approve time entries for managed workers', async () => {
    // worker1 logs time
    const timeEntry = await TimeEntry.create({
      taskId: new mongoose.Types.ObjectId(),
      userId: worker1._id,
      date: new Date(),
      minutes: 120,
      note: 'Editing draft cut',
      status: 'submitted',
    });

    // Lead A lists entries -> contains worker1
    const listA = await request(app).get('/api/time').set('Cookie', leadACookie);
    expect(listA.status).toBe(200);
    const entryIdsA = listA.body.data.map((e) => e._id.toString());
    expect(entryIdsA).toContain(timeEntry._id.toString());

    // Lead B lists entries -> does NOT contain worker1
    const listB = await request(app).get('/api/time').set('Cookie', leadBCookie);
    expect(listB.status).toBe(200);
    const entryIdsB = listB.body.data.map((e) => e._id.toString());
    expect(entryIdsB).not.toContain(timeEntry._id.toString());

    // Lead B attempts approval via /api/time/timesheet/approve -> 403
    const approveFail = await request(app)
      .post('/api/time/timesheet/approve')
      .set('Cookie', leadBCookie)
      .send({
        entryIds: [timeEntry._id.toString()],
        status: 'approved',
      });
    expect(approveFail.status).toBe(403);
    expect(approveFail.body.error?.message || approveFail.body.error).toContain('workers they manage');

    // Lead A approves -> 200
    const approveSuccess = await request(app)
      .post('/api/time/timesheet/approve')
      .set('Cookie', leadACookie)
      .send({
        entryIds: [timeEntry._id.toString()],
        status: 'approved',
      });
    expect(approveSuccess.status).toBe(200);
    expect(approveSuccess.body.data.updatedCount).toBe(1);
  });

  it('5. Deliverable Review Governance: enforces worker management and assignedBy ownership', async () => {
    // Task 1: Assigned to worker1 by Lead A
    const task1 = await Task.create({
      taskId: `TSK-${Date.now()}-DEL1`,
      title: 'Deliverable Review Task 1',
      contentItemId: testContentItem._id,
      assignee: worker1._id,
      assignedBy: leadA._id,
      stageKey: 'editing',
      team: 'editor',
      status: 'in_progress',
    });

    const deliverable1 = await Deliverable.create({
      taskId: task1._id,
      contentItemId: testContentItem._id,
      version: 1,
      type: 'video',
      fileUrl: 'https://example.com/v1.mp4',
      uploadedBy: worker1._id,
      status: 'submitted',
    });

    // Lead B attempts to review deliverable1 (worker1 not managed by Lead B) -> 403
    const reviewFailUnmanaged = await request(app)
      .post(`/api/deliverables/${deliverable1._id}/review`)
      .set('Cookie', leadBCookie)
      .send({
        decision: 'approved',
        notes: 'Unauthorized approval attempt',
      });
    expect(reviewFailUnmanaged.status).toBe(403);
    expect(reviewFailUnmanaged.body.error?.message || reviewFailUnmanaged.body.error).toContain('only review deliverables for workers you manage');

    // Lead A reviews deliverable1 -> 200
    const reviewSuccessLeadA = await request(app)
      .post(`/api/deliverables/${deliverable1._id}/review`)
      .set('Cookie', leadACookie)
      .send({
        decision: 'approved',
        notes: 'Great work v1',
      });
    expect(reviewSuccessLeadA.status).toBe(200);
    expect(reviewSuccessLeadA.body.data.status).toBe('approved');

    // Task 2: Assigned to worker3 by Lead B
    const task2 = await Task.create({
      taskId: `TSK-${Date.now()}-DEL2`,
      title: 'Deliverable Review Task 2',
      contentItemId: testContentItem._id,
      assignee: worker3._id,
      assignedBy: leadB._id,
      stageKey: 'thumbnail',
      team: 'graphics',
      status: 'in_progress',
    });

    const deliverable2 = await Deliverable.create({
      taskId: task2._id,
      contentItemId: testContentItem._id,
      version: 1,
      type: 'image',
      fileUrl: 'https://example.com/thumb.png',
      uploadedBy: worker3._id,
      status: 'submitted',
    });

    // Now, assign worker3 to Lead A as well (multi-lead assignment)
    await assignWorker(leadA._id, worker3._id, adminUser);

    // Lead A attempts to review deliverable2, but task2 was assigned by Lead B -> 403
    const reviewFailAssignedBy = await request(app)
      .post(`/api/deliverables/${deliverable2._id}/review`)
      .set('Cookie', leadACookie)
      .send({
        decision: 'approved',
        notes: 'Trying to approve task assigned by another lead',
      });
    expect(reviewFailAssignedBy.status).toBe(403);
    expect(reviewFailAssignedBy.body.error?.message || reviewFailAssignedBy.body.error).toContain('assigned by another team lead');

    // Marketing Head bypasses assignedBy restriction -> 200
    const headReviewRes = await request(app)
      .post(`/api/deliverables/${deliverable2._id}/review`)
      .set('Cookie', headCookie)
      .send({
        decision: 'approved',
        notes: 'Head overriding review',
      });
    expect(headReviewRes.status).toBe(200);
    expect(headReviewRes.body.data.status).toBe('approved');
  });

  it('6. Reports & Dashboard Scoping: team_lead metrics scoped to managed workers', async () => {
    // Verify getScopingFilter
    const taskFilter = await getScopingFilter(leadA, 'task');
    expect(taskFilter.assignee.$in.map((id) => id.toString())).toContain(worker1._id.toString());
    expect(taskFilter.assignee.$in.map((id) => id.toString())).toContain(worker2._id.toString());

    // Verify getIndividualReport scoping
    const reportWorker1 = await getIndividualReport(worker1._id.toString(), {}, leadA);
    expect(reportWorker1.worker.id.toString()).toBe(worker1._id.toString());

    // Worker 3 currently assigned to Lead A as well from test 5, so let's check a completely unmanaged user
    const unmanagedWorker = await User.create({
      name: 'Unmanaged Worker',
      email: `${testPrefix}_unmanaged@example.com`,
      role: 'worker',
      passwordHash: 'dummy',
      status: 'active',
    });

    await expect(getIndividualReport(unmanagedWorker._id.toString(), {}, leadA)).rejects.toThrow(
      'Worker is not assigned to you'
    );

    // Verify getDashboardSummaryByRole
    const dashboard = await getDashboardSummaryByRole('team_lead', leadA);
    expect(dashboard.role).toBe('team_lead');
    const memberIds = dashboard.teamMembers.map((m) => m._id.toString());
    expect(memberIds).toContain(worker1._id.toString());
    expect(memberIds).toContain(worker2._id.toString());
    expect(memberIds).not.toContain(unmanagedWorker._id.toString());
  });
});
