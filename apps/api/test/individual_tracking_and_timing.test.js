import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/server.js';
import { env } from '../src/config/env.js';
import { Person } from '../src/modules/people/model.js';
import { Department } from '../src/modules/departments/model.js';
import { CalendarPlan } from '../src/modules/calendar/plan.model.js';
import { WorkItem } from '../src/modules/workItems/model.js';
import { ContentPiece } from '../src/modules/calendar/contentPiece.model.js';
import { connectDB } from '../src/config/db.js';
import { formatDuration, calculateIndividualWorkMeasures } from '@mmp/shared';

describe('INDIVIDUAL TRACKING AND TIMING SUITE', () => {
  let adminUser, smUser, headUser, execUser, workerA, workerB;
  let adminToken, smToken, headToken, execToken, workerAToken, workerBToken;
  let testDept, testPlan;

  function makeToken(user) {
    return jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  }

  beforeAll(async () => {
    await connectDB();

    testDept = await Department.findOne({ code: 'timing_test_dept' });
    if (!testDept) {
      testDept = await Department.create({
        name: 'Timing Test Dept',
        code: 'timing_test_dept',
        status: 'active',
      });
    }

    await Person.deleteMany({ email: /@timing-test\.com$/ });
    await WorkItem.deleteMany({ title: /TimingTest/ });
    await ContentPiece.deleteMany({ topic: /TimingTest/ });

    adminUser = await Person.create({
      name: 'Timing Admin',
      email: 'admin@timing-test.com',
      passwordHash: 'dummy',
      role: 'admin',
      departmentId: testDept._id,
      status: 'active',
    });

    smUser = await Person.create({
      name: 'Timing SM',
      email: 'sm@timing-test.com',
      passwordHash: 'dummy',
      role: 'sm_manager',
      departmentId: testDept._id,
      status: 'active',
    });

    headUser = await Person.create({
      name: 'Timing Head',
      email: 'head@timing-test.com',
      passwordHash: 'dummy',
      role: 'creative_head',
      departmentId: testDept._id,
      status: 'active',
    });

    execUser = await Person.create({
      name: 'Timing Exec',
      email: 'exec@timing-test.com',
      passwordHash: 'dummy',
      role: 'executive',
      departmentId: testDept._id,
      status: 'active',
    });

    workerA = await Person.create({
      name: 'Alice Worker',
      email: 'alice@timing-test.com',
      passwordHash: 'dummy',
      role: 'team_member',
      jobRole: 'Video Editor',
      workPreferences: ['Edit'],
      departmentId: testDept._id,
      status: 'active',
    });

    workerB = await Person.create({
      name: 'Bob Worker',
      email: 'bob@timing-test.com',
      passwordHash: 'dummy',
      role: 'team_member',
      jobRole: 'Designer',
      workPreferences: ['Design'],
      departmentId: testDept._id,
      status: 'active',
    });

    adminToken = makeToken(adminUser);
    smToken = makeToken(smUser);
    headToken = makeToken(headUser);
    execToken = makeToken(execUser);
    workerAToken = makeToken(workerA);
    workerBToken = makeToken(workerB);

    testPlan = await CalendarPlan.create({
      code: 'TIMING-2026-11',
      title: 'Timing Test Plan',
      monthYear: '2026-11',
      periodStart: new Date('2026-11-01T00:00:00.000Z'),
      periodEnd: new Date('2026-11-30T23:59:59.999Z'),
      calendar: 'sm',
      kind: 'monthly',
      status: 'Approved',
      createdById: smUser._id,
    });
  });

  afterAll(async () => {
    await Person.deleteMany({ email: /@timing-test\.com$/ });
    await CalendarPlan.deleteMany({ title: /Timing Test Plan/ });
    await WorkItem.deleteMany({ title: /TimingTest/ });
    await ContentPiece.deleteMany({ topic: /TimingTest/ });
  });

  describe('1. Duration formatting & measures math', () => {
    it('formatDuration handles null, undefined, 0, and compact intervals correctly', () => {
      expect(formatDuration(null)).toBe('—');
      expect(formatDuration(undefined)).toBe('—');
      expect(formatDuration(-100)).toBe('—');
      expect(formatDuration(0)).toBe('0m');
      expect(formatDuration(45 * 60 * 1000)).toBe('45m');
      expect(formatDuration((3 * 60 + 20) * 60 * 1000)).toBe('3h 20m');
      expect(formatDuration((28 * 60) * 60 * 1000)).toBe('1d 4h');
    });

    it('calculateIndividualWorkMeasures correctly calculates net work time excluding paused intervals', () => {
      const unlockedAt = new Date('2026-11-01T08:00:00Z');
      const startedAt = new Date('2026-11-01T10:00:00Z'); // waiting = 2h
      const submittedAt = new Date('2026-11-01T16:00:00Z'); // gross = 6h
      const decisionAt = new Date('2026-11-01T18:30:00Z'); // approval wait = 2h 30m

      // Paused for 1h 30m due to blocker
      const intervals = [
        {
          kind: 'blocked',
          startedAt: new Date('2026-11-01T12:00:00Z'),
          endedAt: new Date('2026-11-01T13:30:00Z'),
          reason: 'Client input delayed',
        },
      ];

      const workItem = {
        unlockedAt,
        startedAt,
        submittedAt,
        decisionAt,
        intervals,
        deadline: new Date('2026-11-01T23:59:59Z'),
        status: 'Approved',
      };

      const measures = calculateIndividualWorkMeasures(workItem);

      expect(measures.waitingToStartFormatted).toBe('2h');
      // Net work time = 6h gross - 1.5h paused = 4.5h (4h 30m)
      expect(measures.workTimeFormatted).toBe('4h 30m');
      expect(measures.approvalWaitFormatted).toBe('2h 30m');
      expect(measures.isLate).toBe(false);
    });

    it('handles legacy records with missing timestamps by displaying dash "—"', () => {
      const legacyItem = {
        status: 'Approved',
        title: 'Legacy Item',
      };

      const measures = calculateIndividualWorkMeasures(legacyItem);
      expect(measures.waitingToStartFormatted).toBe('—');
      expect(measures.workTimeFormatted).toBe('—');
      expect(measures.approvalWaitFormatted).toBe('—');
      expect(measures.lateByFormatted).toBe('—');
    });
  });

  describe('2. Submission start precondition (MUST_START_BEFORE_SUBMIT)', () => {
    it('refuses submission if worker has not started the work item', async () => {
      const piece = await ContentPiece.create({
        planId: testPlan._id,
        topic: 'TimingTest Reel Must Start',
        contentType: 'Reel',
        pipeline: 'reel_c',
        calendar: 'sm',
        postingDate: new Date('2026-11-10'),
      });

      const workItem = await WorkItem.create({
        title: 'TimingTest Edit Step Must Start',
        workType: 'Reel',
        stageKey: 'Edit',
        stageOrder: 1,
        contentPieceId: piece._id,
        departmentId: testDept._id,
        ownerId: workerA._id,
        status: 'Not Started',
        deadline: new Date('2026-11-08'),
      });

      // Attempting direct submission without having started must return HTTP 400 MUST_START_BEFORE_SUBMIT
      const submitRes = await request(app)
        .post(`/api/work-items/${workItem._id}/submit`)
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({
          linkUrl: 'https://drive.google.com/file/d/cut-v1.mp4',
          notes: 'Finished rough cut',
        });

      expect(submitRes.status).toBe(400);
      expect(submitRes.body.code).toBe('MUST_START_BEFORE_SUBMIT');
    });

    it('allows submission once started and records individual timestamps and round', async () => {
      const piece = await ContentPiece.create({
        planId: testPlan._id,
        topic: 'TimingTest Shoot to Edit',
        contentType: 'Reel',
        pipeline: 'reel_c',
        calendar: 'sm',
        postingDate: new Date('2026-11-12'),
      });

      const workItem = await WorkItem.create({
        title: 'TimingTest Edit Step Lifecycle',
        workType: 'Reel',
        stageKey: 'Edit',
        stageOrder: 1,
        contentPieceId: piece._id,
        departmentId: testDept._id,
        ownerId: workerA._id,
        status: 'Not Started',
        deadline: new Date('2026-11-10'),
      });

      // 1. Worker clicks Start
      const startRes = await request(app)
        .post(`/api/work-items/${workItem._id}/transition`)
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({ toStatus: 'In Progress' });

      expect(startRes.status).toBe(200);

      const startedItem = await WorkItem.findById(workItem._id);
      expect(startedItem.status).toBe('In Progress');
      expect(startedItem.startedAt).toBeDefined();
      expect(startedItem.rounds).toHaveLength(1);
      expect(startedItem.rounds[0].roundNumber).toBe(1);

      // 2. Worker submits deliverable
      const submitRes = await request(app)
        .post(`/api/work-items/${workItem._id}/submit`)
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({
          linkUrl: 'https://drive.google.com/file/d/edit-v1.mp4',
          notes: 'Completed edit version 1',
        });

      expect(submitRes.status).toBe(201);

      const submittedItem = await WorkItem.findById(workItem._id);
      expect(submittedItem.status).toBe('Feedback');
      expect(submittedItem.submittedAt).toBeDefined();
      expect(submittedItem.rounds[0].submittedAt).toBeDefined();

      // 3. Creative Head requests a revision
      const revRes = await request(app)
        .post(`/api/submissions/${submitRes.body.data._id}/request-revision`)
        .set('Authorization', `Bearer ${headToken}`)
        .send({
          comment: 'Please punch up the pacing on the hook',
        });

      expect(revRes.status).toBe(200);

      const revisedItem = await WorkItem.findById(workItem._id);
      expect(revisedItem.status).toBe('In Progress');
      expect(revisedItem.revisions).toBe(1);
      expect(revisedItem.changesRequestedAt).toBeDefined();
      expect(revisedItem.rounds).toHaveLength(2); // Round 2 started!
      expect(revisedItem.rounds[0].decision).toBe('changes_requested');
      expect(revisedItem.rounds[1].roundNumber).toBe(2);

      // 4. Worker resubmits for Round 2
      const resubmitRes = await request(app)
        .post(`/api/work-items/${workItem._id}/submit`)
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({
          linkUrl: 'https://drive.google.com/file/d/edit-v2.mp4',
          notes: 'Paced up hook with tighter cuts',
        });

      expect(resubmitRes.status).toBe(201);

      const resubmittedItem = await WorkItem.findById(workItem._id);
      expect(resubmittedItem.resubmittedAt).toBeDefined();
      expect(resubmittedItem.rounds[1].submittedAt).toBeDefined();

      // 5. Creative Head approves with rating
      const approveRes = await request(app)
        .post(`/api/submissions/${resubmitRes.body.data._id}/approve`)
        .set('Authorization', `Bearer ${headToken}`)
        .send({
          score: 5,
          feedback: 'Exceptional pacing and cut precision!',
        });

      expect(approveRes.status).toBe(200);

      const approvedItem = await WorkItem.findById(workItem._id);
      expect(approvedItem.status).toBe('Approved');
      expect(approvedItem.approvedAt).toBeDefined();
      expect(approvedItem.decisionAt).toBeDefined();
      expect(approvedItem.rounds[1].decision).toBe('approved');
    });
  });

  describe('3. Per-person work history endpoint (/api/people/:id/work-history)', () => {
    it('enforces role scoping: team_member can only access their own history', async () => {
      // Alice can view her own
      const aliceRes = await request(app)
        .get(`/api/people/${workerA._id}/work-history`)
        .set('Authorization', `Bearer ${workerAToken}`);

      expect(aliceRes.status).toBe(200);
      expect(aliceRes.body.data.person._id).toBe(workerA._id.toString());
      expect(aliceRes.body.data.now).toBeDefined();
      expect(aliceRes.body.data.next).toBeDefined();
      expect(aliceRes.body.data.done).toBeDefined();
      expect(aliceRes.body.data.summary).toBeDefined();

      // Alice cannot view Bob's work history (HTTP 403)
      const forbidRes = await request(app)
        .get(`/api/people/${workerB._id}/work-history`)
        .set('Authorization', `Bearer ${workerAToken}`);

      expect(forbidRes.status).toBe(403);
    });

    it('elevated roles (admin, head, sm, exec) can view any person work history with zero ranking', async () => {
      // SM Manager can view Alice
      const smRes = await request(app)
        .get(`/api/people/${workerA._id}/work-history`)
        .set('Authorization', `Bearer ${smToken}`);

      expect(smRes.status).toBe(200);
      expect(smRes.body.data.summary.totalCompleted).toBeDefined();
      expect(smRes.body.data.summary.onTimeRate).toBeDefined();

      // Creative Head can view Bob
      const headRes = await request(app)
        .get(`/api/people/${workerB._id}/work-history`)
        .set('Authorization', `Bearer ${headToken}`);

      expect(headRes.status).toBe(200);

      // Executive can view Bob
      const execRes = await request(app)
        .get(`/api/people/${workerB._id}/work-history`)
        .set('Authorization', `Bearer ${execToken}`);

      expect(execRes.status).toBe(200);
    });
  });

  describe('4. Anti-ranking verification in reports', () => {
    it('live reports show team-level figures, with no per-person rows', async () => {
      const people = await Person.find({ role: { $in: ['team_member', 'sm_manager'] } }).select('name').lean();
      for (const name of ['overview', 'production', 'quality', 'projects']) {
        const res = await request(app).get(`/api/reports/${name}`).set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        const text = JSON.stringify(res.body.data);
        for (const p of people) if (p.name) expect(text).not.toContain(`"${p.name}"`);
      }
    });
  });
});
