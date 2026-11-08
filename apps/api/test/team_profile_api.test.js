import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/server.js';
import { Person } from '../src/modules/people/model.js';
import { Department } from '../src/modules/departments/model.js';
import { WorkItem } from '../src/modules/workItems/model.js';
import { CalendarPlan } from '../src/modules/calendar/plan.model.js';
import { ContentPiece } from '../src/modules/calendar/contentPiece.model.js';
import { Rating, Submission } from '../src/modules/submissions/model.js';
import { PersonChangeAudit } from '../src/modules/team/audit.model.js';
import { env } from '../src/config/env.js';

const makeToken = (user) =>
  jwt.sign(
    { userId: user._id.toString(), role: user.role, email: user.email },
    env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );

describe('Team Directory and Worker Profile API Suite', () => {
  let admin, creativeHead, smManager, executive, worker1, worker2;
  let adminToken, headToken, smToken, execToken, worker1Token, worker2Token;
  let dept;
  let testPiece, workItem1, workItem2;

  beforeAll(async () => {
    const mongoUri =
      process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/marketing_portal_test';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }

    // Clean test data
    await Person.deleteMany({ email: /@team-profile-test\.local$/ });
    await Department.deleteMany({ code: 'tp_dept' });
    await CalendarPlan.deleteMany({ title: /TP Plan/ });
    await ContentPiece.deleteMany({ topic: 'TP Test Piece' });
    await WorkItem.deleteMany({ title: /TP Test/ });
    await Rating.deleteMany({});
    await PersonChangeAudit.deleteMany({});

    dept = await Department.create({
      name: 'Content & Media Dept',
      code: 'tp_dept',
      isActive: true,
    });

    admin = await Person.create({
      name: 'TP Admin',
      email: 'admin@team-profile-test.local',
      role: 'admin',
      status: 'active',
      phone: '9000000001',
    });

    creativeHead = await Person.create({
      name: 'TP Creative Head',
      email: 'head@team-profile-test.local',
      role: 'creative_head',
      jobRole: 'Creative Manager (TL)',
      departmentId: dept._id,
      status: 'active',
      phone: '9000000002',
    });

    smManager = await Person.create({
      name: 'TP SM Manager',
      email: 'sm@team-profile-test.local',
      role: 'sm_manager',
      jobRole: 'Social Media Manager',
      departmentId: dept._id,
      status: 'active',
      phone: '9000000003',
    });

    executive = await Person.create({
      name: 'TP Executive',
      email: 'exec@team-profile-test.local',
      role: 'executive',
      status: 'active',
      phone: '9000000004',
    });

    worker1 = await Person.create({
      name: 'TP Writer One',
      preferredName: 'Alex Writer',
      email: 'writer1@team-profile-test.local',
      role: 'team_member',
      jobRole: 'Writer',
      departmentId: dept._id,
      weeklyCapacityHours: 40,
      workPreferences: ['Content', 'Script'],
      skills: ['Copywriting', 'SEO'],
      status: 'active',
      phone: '9000000011',
      whatsappNumber: '9000000011',
    });

    worker2 = await Person.create({
      name: 'TP Designer Two',
      preferredName: 'Bella Design',
      email: 'designer2@team-profile-test.local',
      role: 'team_member',
      jobRole: 'Designer',
      departmentId: dept._id,
      weeklyCapacityHours: 40,
      workPreferences: ['Design'],
      skills: ['Photoshop', 'Illustrator'],
      status: 'active',
      phone: '9000000012',
    });

    adminToken = makeToken(admin);
    headToken = makeToken(creativeHead);
    smToken = makeToken(smManager);
    execToken = makeToken(executive);
    worker1Token = makeToken(worker1);
    worker2Token = makeToken(worker2);

    const plan = await CalendarPlan.create({
      title: 'TP Plan Nov 2026',
      code: 'TP-PLAN-001',
      calendar: 'sm',
      kind: 'monthly',
      month: 11,
      year: 2026,
      periodStart: new Date('2026-11-01'),
      periodEnd: new Date('2026-11-30'),
      createdById: smManager._id,
      status: 'Approved',
    });

    testPiece = await ContentPiece.create({
      planId: plan._id,
      topic: 'TP Test Piece',
      code: 'TP-001',
      channel: 'sm',
      calendar: 'sm',
      contentType: 'Reel',
      pipeline: 'reel_a',
      postingDate: new Date(Date.now() + 5 * 86400000),
      rowStatus: 'approved',
    });

    workItem1 = await WorkItem.create({
      title: 'TP Test Content Step',
      contentPieceId: testPiece._id,
      departmentId: dept._id,
      ownerId: worker1._id,
      stageKey: 'Content',
      workType: 'Reel',
      status: 'In Progress',
      deadline: new Date(Date.now() + 3 * 86400000),
      estimatedEffortHrs: 4,
      startedAt: new Date(Date.now() - 3600000),
      unlockedAt: new Date(Date.now() - 7200000),
    });

    workItem2 = await WorkItem.create({
      title: 'TP Test Review Step',
      contentPieceId: testPiece._id,
      departmentId: dept._id,
      ownerId: worker1._id,
      stageKey: 'Script',
      workType: 'Reel',
      status: 'Feedback',
      deadline: new Date(Date.now() - 86400000), // Late
      estimatedEffortHrs: 4,
      startedAt: new Date(Date.now() - 86400000),
      // 30 minutes ago, but never before this week's Monday 00:00 (local), so the step still
      // counts in this week's load when the suite runs just after midnight on a Monday.
      submittedAt: (() => {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() + ((weekStart.getDay() === 0 ? -6 : 1) - weekStart.getDay()));
        weekStart.setHours(0, 0, 0, 0);
        return new Date(Math.max(Date.now() - 1800000, weekStart.getTime() + 60000));
      })(),
    });
  });

  afterAll(async () => {
    await Person.deleteMany({ email: /@team-profile-test\.local$/ });
    await Department.deleteMany({ code: 'tp_dept' });
    await CalendarPlan.deleteMany({ title: /TP Plan/ });
    await ContentPiece.deleteMany({ topic: 'TP Test Piece' });
    await WorkItem.deleteMany({ title: /TP Test/ });
    await Rating.deleteMany({});
    await PersonChangeAudit.deleteMany({});
  });

  describe('1. Team Directory Access and RBAC', () => {
    it('admin, creative_head, sm_manager, and executive can list the directory', async () => {
      for (const token of [adminToken, headToken, smToken, execToken]) {
        const res = await request(app)
          .get('/api/team')
          .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data.items)).toBe(true);
      }
    });

    it('team_member is denied access to /api/team with 404 Not Found', async () => {
      const res = await request(app)
        .get('/api/team')
        .set('Authorization', `Bearer ${worker1Token}`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.data).toBeUndefined();
    });

    it("team_member gets 404 for another member's changes log", async () => {
      const res = await request(app)
        .get(`/api/team/${worker2._id}/changes`)
        .set('Authorization', `Bearer ${worker1Token}`);
      expect(res.status).toBe(404);
      expect(res.body.data).toBeUndefined();
    });

    it("team_member gets 404 for every read of another member's profile", async () => {
      for (const sub of ['', '/overview', '/work', '/performance', '/ratings', '/activity']) {
        const res = await request(app)
          .get(`/api/team/${worker2._id}${sub}`)
          .set('Authorization', `Bearer ${worker1Token}`);
        expect(res.status, `GET /api/team/:id${sub}`).toBe(404);
        expect(res.body.data).toBeUndefined();
      }
    });

    it('creative_head still lists the directory (access unchanged)', async () => {
      const res = await request(app)
        .get('/api/team')
        .set('Authorization', `Bearer ${headToken}`);
      expect(res.status).toBe(200);
    });

    it('directory items include load percentage, band, active counts, and current step', async () => {
      const res = await request(app)
        .get('/api/team?search=TP Writer One')
        .set('Authorization', `Bearer ${headToken}`);
      expect(res.status).toBe(200);
      const writer = res.body.data.items.find((i) => i._id === worker1._id.toString());
      expect(writer).toBeDefined();
      expect(writer.loadPct).toBeGreaterThan(0);
      expect(writer.capacityBand).toBe('Healthy');
      expect(writer.counts.inProgress).toBe(1);
      expect(writer.counts.waitingApproval).toBe(1);
      expect(writer.counts.late).toBe(1);
      expect(writer.currentStep).toBeDefined();
      expect(writer.currentStep.stageKey).toBe('Content');
    });

    it('directory enforces whitelist sorting and ignores performance/speed ranking keys', async () => {
      const res = await request(app)
        .get('/api/team?sortBy=rating&sortDir=desc')
        .set('Authorization', `Bearer ${headToken}`);
      expect(res.status).toBe(200);
      // Defaults gracefully to name sort without error
      expect(res.body.data.items.length).toBeGreaterThan(0);
    });
  });

  describe('2. Worker Profile Access & Privacy Scoping', () => {
    it('worker accessing another member profile receives HTTP 404 Not Found', async () => {
      const res = await request(app)
        .get(`/api/team/${worker2._id}`)
        .set('Authorization', `Bearer ${worker1Token}`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('worker accessing their own profile receives 200 OK', async () => {
      const res = await request(app)
        .get(`/api/team/${worker1._id}`)
        .set('Authorization', `Bearer ${worker1Token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('TP Writer One');
      expect(res.body.data.preferredName).toBe('Alex Writer');
    });

    it('executive accessing member profile has contact details redacted (null)', async () => {
      const res = await request(app)
        .get(`/api/team/${worker1._id}`)
        .set('Authorization', `Bearer ${execToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.email).toBeNull();
      expect(res.body.data.phone).toBeNull();
      expect(res.body.data.whatsappNumber).toBeNull();
    });

    it('creative_head accessing member profile sees full contact details', async () => {
      const res = await request(app)
        .get(`/api/team/${worker1._id}`)
        .set('Authorization', `Bearer ${headToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe('writer1@team-profile-test.local');
      expect(res.body.data.phone).toBe('9000000011');
      expect(res.body.data.whatsappNumber).toBe('9000000011');
    });
  });

  describe('3. Tab Endpoints & 8-Week Load History', () => {
    it('GET /api/team/:id/overview returns rightNow, nextUp, and 8-week loadTrend array', async () => {
      const res = await request(app)
        .get(`/api/team/${worker1._id}/overview`)
        .set('Authorization', `Bearer ${headToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.rightNow.length).toBe(2);
      expect(res.body.data.loadTrend).toBeInstanceOf(Array);
      expect(res.body.data.loadTrend.length).toBe(8);
      const currentWeek = res.body.data.loadTrend[7];
      expect(currentWeek.allocatedHours).toBe(8); // workItem1 (4) + workItem2 (4)
      expect(currentWeek.capacityHours).toBe(40);
      expect(currentWeek.loadPct).toBe(20);
    });

    it('GET /api/team/:id/work returns paginated steps with timeline timestamps', async () => {
      const res = await request(app)
        .get(`/api/team/${worker1._id}/work`)
        .set('Authorization', `Bearer ${headToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(2);
      const item = res.body.data.items[0];
      expect(item.measures).toBeDefined();
    });

    it('GET /api/team/:id/performance returns craft metrics and 6-month output trend', async () => {
      const res = await request(app)
        .get(`/api/team/${worker1._id}/performance`)
        .set('Authorization', `Bearer ${headToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.monthlyOutputTrend.length).toBe(6);
      expect(res.body.data.current).toBeDefined();
    });
  });

  describe('4. 3-Rating Minimum Threshold Rule', () => {
    it('worker with fewer than 3 ratings returns averageRating as null', async () => {
      const res = await request(app)
        .get(`/api/team/${worker1._id}`)
        .set('Authorization', `Bearer ${headToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.kpis.averageRating).toBeNull();
      expect(res.body.data.kpis.ratingCount).toBe(0);
    });

    it('worker with 3 or more ratings returns calculated numeric averageRating', async () => {
      const sub1 = await Submission.create({
        workItemId: workItem1._id,
        stageKey: 'Content',
        kind: 'document',
        version: 1,
        document: { htmlSnapshot: 'doc1' },
      });
      const sub2 = await Submission.create({
        workItemId: workItem2._id,
        stageKey: 'Script',
        kind: 'document',
        version: 1,
        document: { htmlSnapshot: 'doc2' },
      });
      // Phase 8: one rating per step, so the third rating is on a third step.
      const workItem3 = await WorkItem.create({
        title: 'TP Test Third Step',
        contentPieceId: testPiece._id,
        departmentId: dept._id,
        ownerId: worker1._id,
        stageKey: 'Content',
        workType: 'Reel',
        status: 'Approved',
        deadline: new Date(Date.now() + 3 * 86400000),
        estimatedEffortHrs: 4,
      });
      const sub3 = await Submission.create({
        workItemId: workItem3._id,
        stageKey: 'Content',
        kind: 'document',
        version: 1,
        document: { htmlSnapshot: 'doc3' },
      });

      await Rating.create([
        {
          submissionId: sub1._id,
          workItemId: workItem1._id,
          stageKey: 'Content',
          workerId: worker1._id,
          raterId: creativeHead._id,
          score: 5,
          feedback: 'Excellent work',
        },
        {
          submissionId: sub2._id,
          workItemId: workItem2._id,
          stageKey: 'Script',
          workerId: worker1._id,
          raterId: creativeHead._id,
          score: 4,
          feedback: 'Good script',
        },
        {
          submissionId: sub3._id,
          workItemId: workItem3._id,
          stageKey: 'Content',
          workerId: worker1._id,
          raterId: creativeHead._id,
          score: 4,
          feedback: 'Solid delivery',
        },
      ]);

      const res = await request(app)
        .get(`/api/team/${worker1._id}`)
        .set('Authorization', `Bearer ${headToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.kpis.ratingCount).toBe(3);
      expect(res.body.data.kpis.averageRating).toBe(4.3); // (5+4+4)/3 = 4.33
    });
  });

  describe('5. Operational Changes Audit Logging', () => {
    it('editing capacity or jobRole logs an entry in PersonChangeAudit', async () => {
      const res = await request(app)
        .patch(`/api/team/${worker1._id}`)
        .set('Authorization', `Bearer ${headToken}`)
        .send({
          weeklyCapacityHours: 35,
          jobRole: 'Designer',
          reason: 'Promoted to Designer',
        });
      expect(res.status).toBe(200);

      const logsRes = await request(app)
        .get(`/api/team/${worker1._id}/changes`)
        .set('Authorization', `Bearer ${headToken}`);
      expect(logsRes.status).toBe(200);
      expect(logsRes.body.data.length).toBe(2);
      const fields = logsRes.body.data.map((l) => l.field);
      expect(fields).toContain('weeklyCapacityHours');
      expect(fields).toContain('jobRole');
    });

    it('sm_manager and executive are forbidden from accessing changes audit log', async () => {
      const smRes = await request(app)
        .get(`/api/team/${worker1._id}/changes`)
        .set('Authorization', `Bearer ${smToken}`);
      // sm_manager does not have admin/creative_head permission for changes log
      expect(smRes.status).toBe(403);

      const execRes = await request(app)
        .get(`/api/team/${worker1._id}/changes`)
        .set('Authorization', `Bearer ${execToken}`);
      expect(execRes.status).toBe(403);
    });
  });

  describe('6. Reassign Steps Action', () => {
    it('SM Manager can reassign steps from one worker to another', async () => {
      const res = await request(app)
        .post(`/api/team/${worker1._id}/reassign`)
        .set('Authorization', `Bearer ${smToken}`)
        .send({
          targetPersonId: worker2._id.toString(),
          workItemIds: [workItem1._id.toString()],
        });
      expect(res.status).toBe(200);
      expect(res.body.data.reassignedCount).toBe(1);

      const updated = await WorkItem.findById(workItem1._id);
      expect(updated.ownerId.toString()).toBe(worker2._id.toString());
    });
  });
});
