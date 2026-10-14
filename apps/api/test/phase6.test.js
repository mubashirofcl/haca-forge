import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/server.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { Shoot } from '../src/modules/shoots/model.js';
import { TimeEntry } from '../src/modules/time/model.js';
import { LeaveRequest } from '../src/modules/leave/model.js';
import { ContentItem } from '../src/modules/content/model.js';
import { Task } from '../src/modules/tasks/model.js';
import { User } from '../src/modules/users/model.js';
import { Department } from '../src/modules/departments/model.js';
import { initializeContentPipeline, seedPipelineTemplates } from '../src/modules/pipelines/service.js';

let adminCookie = '';
let leadCookie = '';
let workerCookie = '';
let cinemaWorkerCookie = '';
let teamLeadCinemaCookie = '';
let testReelContentItem = null;
let testShootId = '';
let testTaskId = '';
let cinemaWorker = null;
let editorWorker = null;
let testDepartment = null;

beforeAll(async () => {
  await connectDB();
  await seedPipelineTemplates();

  const login = async (email, password = 'Password123!') => {
    const res = await request(app).post('/api/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    return res.headers['set-cookie'];
  };

  [adminCookie, leadCookie] = await Promise.all([
    login('admin@marketingportal.com', 'Admin1212'),
    login('marcus.lead@marketingportal.com'),
  ]);

  // Find cinema worker, editor worker, and a general worker
  cinemaWorker = await User.findOne({
    $or: [{ teamId: 'cinematography' }, { team: 'cinematography' }, { skills: 'cinematography' }],
    status: 'active',
  });
  if (cinemaWorker) {
    cinemaWorkerCookie = await login(cinemaWorker.email);
  } else {
    cinemaWorkerCookie = leadCookie;
  }

  editorWorker = await User.findOne({
    $or: [{ teamId: 'editor' }, { team: 'editor' }, { skills: 'editor' }],
    status: 'active',
  });

  const worker = await User.findOne({ role: 'worker', status: 'active' });
  if (worker) {
    workerCookie = await login(worker.email);
  }

  // Find or create team_lead for cinematography
  let teamLeadCinema = await User.findOne({ role: 'team_lead', teamId: 'cinematography' });
  if (!teamLeadCinema) {
    teamLeadCinema = await User.findOne({ role: 'team_lead' });
    if (teamLeadCinema) {
      teamLeadCinema.teamId = 'cinematography';
      await teamLeadCinema.save();
    }
  }
  if (teamLeadCinema) {
    teamLeadCinemaCookie = await login(teamLeadCinema.email);
  } else {
    teamLeadCinemaCookie = leadCookie;
  }

  testDepartment = await Department.findOne();

  // Create a test Reel ContentItem with pipeline
  testReelContentItem = await ContentItem.create({
    contentId: `CNT-2026-TEST-${Date.now().toString().slice(-4)}`,
    title: 'Phase 6 Test Reel for Shoot Planner',
    format: 'reel',
    sourceDepartment: testDepartment?._id,
    requester: cinemaWorker?._id,
    publishDate: new Date(Date.now() + 14 * 86400000),
    status: 'in_production',
  });

  const createdTasks = await initializeContentPipeline(testReelContentItem, { _id: cinemaWorker?._id });
  testTaskId = createdTasks[0]?._id?.toString();
}, 30000);

afterAll(async () => {
  await Shoot.deleteMany({ title: { $regex: /Phase 6 Test/i } });
  await TimeEntry.deleteMany({ note: { $regex: /Phase 6/i } });
  await LeaveRequest.deleteMany({ reason: { $regex: /Phase 6/i } });
  if (testReelContentItem) {
    await Task.deleteMany({ contentItemId: testReelContentItem._id });
    await ContentItem.findByIdAndDelete(testReelContentItem._id);
  }
  await disconnectDB();
}, 30000);

describe('Phase 6: Team Management, Shoots, Time Tracking & Attendance', () => {
  // ----------------------------------------------------
  // 1. Shoot Creation, Format & Script Ready Validation
  // ----------------------------------------------------
  it('rejects shoot creation if script is not ready without override', async () => {
    const shootDate = new Date(Date.now() + 2 * 86400000).toISOString();

    const res = await request(app)
      .post('/api/shoots')
      .set('Cookie', leadCookie)
      .send({
        title: 'Phase 6 Test Shoot Day #1',
        date: shootDate,
        location: 'Studio A - Main Set',
        crew: cinemaWorker ? [cinemaWorker._id] : [],
        equipment: ['Sony FX6', 'Aputure 600d', 'Wireless Mics'],
        talentNotes: 'Main presenter requires lapel mic and teleprompter setup.',
        contentItems: [testReelContentItem._id],
        notes: 'Filming hook, b-roll and product demonstrations.',
        overrideWarning: false,
      });

    // Script task is still 'assigned' / not 'done', so it must return SCRIPT_NOT_READY
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('SCRIPT_NOT_READY');
  });

  it('allows shoot creation when lead enables overrideWarning', async () => {
    const shootDate = new Date(Date.now() + 2 * 86400000).toISOString();

    const res = await request(app)
      .post('/api/shoots')
      .set('Cookie', leadCookie)
      .send({
        title: 'Phase 6 Test Shoot Day #1',
        date: shootDate,
        location: 'Studio A - Main Set',
        crew: cinemaWorker ? [cinemaWorker._id] : [],
        equipment: ['Sony FX6', 'Aputure 600d', 'Wireless Mics'],
        talentNotes: 'Main presenter requires teleprompter.',
        contentItems: [testReelContentItem._id],
        notes: 'Lead approved shooting preliminary b-roll.',
        overrideWarning: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.shootId).toMatch(/^SHT-\d{4}-\d{4}$/);
    expect(res.body.data.status).toBe('scheduled');
    testShootId = res.body.data._id;
  });

  // ----------------------------------------------------
  // 2. Shoot Completion Unblocks Editor Queue
  // ----------------------------------------------------
  it('marking shoot Done releases footage to Editor queue', async () => {
    const res = await request(app)
      .post(`/api/shoots/${testShootId}/transition`)
      .set('Cookie', leadCookie)
      .send({
        status: 'done',
        notes: 'Footage captured, transferred to NAS /raw/2026/test-reel-01.',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('done');

    // Verify linked ContentItem tasks
    const tasks = await Task.find({ contentItemId: testReelContentItem._id });
    const cinemaTask = tasks.find((t) => t.team === 'cinematography');
    const editorTask = tasks.find((t) => t.team === 'editor');

    expect(cinemaTask.status).toBe('done');
    expect(editorTask.status).toBe('assigned');
    expect(editorTask.assignee).toBeTruthy();
  });

  // ----------------------------------------------------
  // 3. Reshoot Flow returns item to Cinematography
  // ----------------------------------------------------
  it('marking shoot reshoot_needed requires reason and resets cinematography task', async () => {
    // Failing without reason
    const failRes = await request(app)
      .post(`/api/shoots/${testShootId}/transition`)
      .set('Cookie', leadCookie)
      .send({
        status: 'reshoot_needed',
      });

    expect(failRes.status).toBe(400);
    expect(failRes.body.error.code).toBe('REASON_REQUIRED');

    // Succeeds with reason
    const successRes = await request(app)
      .post(`/api/shoots/${testShootId}/transition`)
      .set('Cookie', leadCookie)
      .send({
        status: 'reshoot_needed',
        reshootReason: 'Audio clipping on dialogue channel; needs clean audio pickup.',
      });

    expect(successRes.status).toBe(200);
    expect(successRes.body.data.status).toBe('reshoot_needed');
    expect(successRes.body.data.reshootCount).toBeGreaterThanOrEqual(1);

    // Cinematography task must be returned to in_progress with hold comment
    const cinemaTask = await Task.findOne({
      contentItemId: testReelContentItem._id,
      team: 'cinematography',
    });
    expect(cinemaTask.status).toBe('in_progress');
    expect(cinemaTask.holdComment).toContain('Audio clipping');
  });

  // ----------------------------------------------------
  // 4. Attendance & Leave Management
  // ----------------------------------------------------
  it('creates and approves leave request, setting attendance onLeave', async () => {
    const startDate = new Date();
    const endDate = new Date(Date.now() + 4 * 86400000);

    // Worker creates leave request
    const createRes = await request(app)
      .post('/api/leave')
      .set('Cookie', cinemaWorkerCookie)
      .send({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        type: 'vacation',
        reason: 'Phase 6 Test Family Vacation',
      });

    expect(createRes.status).toBe(201);
    const leaveId = createRes.body.data._id;
    expect(createRes.body.data.status).toBe('pending');

    // Lead approves leave request
    const reviewRes = await request(app)
      .patch(`/api/leave/${leaveId}/review`)
      .set('Cookie', leadCookie)
      .send({
        status: 'approved',
        reviewComment: 'Approved, enjoy your time off!',
      });

    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.data.status).toBe('approved');

    // Verify worker attendance is now on_leave
    const updatedWorker = await User.findById(cinemaWorker._id);
    expect(updatedWorker.attendance).toBe('on_leave');
    expect(updatedWorker.onLeave).toBe(true);

    // Verify calendar capacity comparison discounts worker
    const capRes = await request(app)
      .get('/api/calendar/capacity')
      .set('Cookie', leadCookie);

    expect(capRes.status).toBe(200);
    const cinemaCap = capRes.body.data.teams.find((t) => t.team === 'cinematography');
    expect(cinemaCap).toBeTruthy();
    expect(cinemaCap.onLeaveMembers).toBeGreaterThanOrEqual(1);
  });

  // ----------------------------------------------------
  // 5. Time Tracking, Timer, Timesheet & Task Actual Hours
  // ----------------------------------------------------
  it('handles timer start/stop, manual entry, submission, and approval updating task actualHours', async () => {
    // 1. Start timer
    const startRes = await request(app)
      .post('/api/time/timer/start')
      .set('Cookie', workerCookie)
      .send({
        taskId: testTaskId,
        note: 'Phase 6 Test Timer Session',
      });

    expect(startRes.status).toBe(201);
    expect(startRes.body.data.start).toBeTruthy();
    expect(startRes.body.data.status).toBe('draft');
    const timerEntryId = startRes.body.data._id;

    // 2. Stop timer
    const stopRes = await request(app)
      .post('/api/time/timer/stop')
      .set('Cookie', workerCookie)
      .send({
        timeEntryId: timerEntryId,
        note: 'Phase 6 Test Finished first draft',
      });

    expect(stopRes.status).toBe(200);
    expect(stopRes.body.data.end).toBeTruthy();
    expect(stopRes.body.data.minutes).toBeGreaterThanOrEqual(1);

    // 3. Log manual entry (90 minutes)
    const manualRes = await request(app)
      .post('/api/time/manual')
      .set('Cookie', workerCookie)
      .send({
        taskId: testTaskId,
        minutes: 90,
        note: 'Phase 6 Test Manual 90 mins work',
      });

    expect(manualRes.status).toBe(201);
    const manualEntryId = manualRes.body.data._id;

    // 4. Submit timesheet
    const submitRes = await request(app)
      .post('/api/time/timesheet/submit')
      .set('Cookie', workerCookie)
      .send({
        entryIds: [timerEntryId, manualEntryId],
      });

    expect(submitRes.status).toBe(200);
    expect(submitRes.body.data.submittedCount).toBe(2);

    // 5. Lead approves timesheet
    const approveRes = await request(app)
      .post('/api/time/timesheet/approve')
      .set('Cookie', leadCookie)
      .send({
        entryIds: [timerEntryId, manualEntryId],
        status: 'approved',
        comment: 'Great work, all logged hours verified.',
      });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.updatedCount).toBe(2);

    // 6. Verify task actualHours derived correctly (>= 1.5 hours)
    const updatedTask = await Task.findById(testTaskId);
    expect(updatedTask.actualHours).toBeGreaterThanOrEqual(1.5);
  });

  // ----------------------------------------------------
  // 6. Team Lead Scoping & Team Dashboard Data
  // ----------------------------------------------------
  it('enforces team_lead scoping on team dashboards and timesheet approvals', async () => {
    // Team lead for cinematography queries their own team dashboard -> succeeds
    const teamRes = await request(app)
      .get('/api/teams/cinematography/dashboard')
      .set('Cookie', teamLeadCinemaCookie);

    expect(teamRes.status).toBe(200);
    expect(teamRes.body.data.members).toBeInstanceOf(Array);
    expect(teamRes.body.data.skillsMatrix).toBeInstanceOf(Array);

    // Team lead for cinematography attempts to query editor dashboard -> 403 Forbidden
    const forbiddenRes = await request(app)
      .get('/api/teams/editor/dashboard')
      .set('Cookie', teamLeadCinemaCookie);

    expect(forbiddenRes.status).toBe(403);
    expect(forbiddenRes.body.error.code).toBe('FORBIDDEN');

    // Lead can view all teams and queues
    const queuesRes = await request(app)
      .get('/api/teams/queues')
      .set('Cookie', leadCookie);

    expect(queuesRes.status).toBe(200);
    expect(queuesRes.body.data.editor).toHaveProperty('title');
    expect(queuesRes.body.data.graphics).toHaveProperty('title');
    expect(queuesRes.body.data.cinematography).toHaveProperty('title');
  });
});
