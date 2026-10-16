import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/server.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/modules/users/model.js';
import { Task } from '../src/modules/tasks/model.js';
import { ContentItem } from '../src/modules/content/model.js';
import { Request as MarketingRequest } from '../src/modules/requests/model.js';
import { TimeEntry } from '../src/modules/time/model.js';
import { StatusHistory } from '../src/modules/statusHistory/model.js';
import { LeaveRequest } from '../src/modules/leave/model.js';
import { Department } from '../src/modules/departments/model.js';
import { ScheduledReport } from '../src/modules/reports/model.js';
import { runScheduledReportsJob } from '../src/modules/jobs/processors.js';
import {
  calculateOnTimeRate,
  calculateFirstPassRate,
  calculateSpeedScore,
  calculateVolumeScore,
  calculateEfficiencyScore,
} from '../src/modules/reports/metrics.js';

let adminCookie = '';
let leadCookie = '';
let workerCookie = '';
let worker2Cookie = '';
let deptLeadCookie = '';

let adminUser = null;
let leadUser = null;
let workerUser = null;
let workerUser2 = null;
let deptLeadUser = null;

let testRequestId = '';
let testContentItemId = '';
let testTaskId = '';
let testScheduledReportId = '';

beforeAll(async () => {
  await connectDB();

  const login = async (email, password = 'Password123!') => {
    const res = await request(app).post('/api/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    return res.headers['set-cookie'];
  };

  adminUser = await User.findOne({ email: 'admin@marketingportal.com' });
  leadUser = await User.findOne({ role: { $in: ['lead', 'marketing_lead'] }, status: 'active' });
  workerUser = await User.findOne({ role: 'worker', status: 'active' });
  workerUser2 = await User.findOne({ role: 'worker', _id: { $ne: workerUser?._id }, status: 'active' });
  deptLeadUser = await User.findOne({ role: 'dept_lead', status: 'active' });

  adminCookie = await login('admin@marketingportal.com', 'Admin1212');
  if (leadUser) leadCookie = await login(leadUser.email);
  if (workerUser) workerCookie = await login(workerUser.email);
  if (workerUser2) worker2Cookie = await login(workerUser2.email);
  if (deptLeadUser) deptLeadCookie = await login(deptLeadUser.email);

  // Seed Controlled Test Fixture Dataset for Phase 9
  const now = new Date();
  const pastWeek = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
  const futureWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // 1. Seed Request
  const testReq = await MarketingRequest.create({
    requestId: 'MKT-2026-P9-9901',
    title: 'Phase 9 Analytics Test Marketing Request',
    sourceDepartment: 'Sales',
    requester: adminUser._id,
    requestTypeName: 'Sales Deck & Demo Reel',
    priority: 'high',
    deadline: futureWeek,
    status: 'submitted',
    createdAt: pastWeek,
  });
  testRequestId = testReq._id.toString();

  // 2. Seed ContentItem
  let salesDept = await Department.findOne({ name: 'Sales' });
  if (!salesDept) {
    salesDept = await Department.create({ name: 'Sales', type: 'sales' });
  }

  const testContent = await ContentItem.create({
    contentId: 'CNT-2026-P9-9901',
    title: 'Phase 9 Analytics Test Content Item',
    format: 'video_reel',
    platform: 'instagram',
    platforms: ['instagram'],
    sourceDepartment: salesDept._id,
    requester: adminUser._id,
    status: 'published',
    publishDate: futureWeek,
    publishedAt: now,
    createdAt: pastWeek,
  });
  testContentItemId = testContent._id.toString();

  // 3. Seed Task for workerUser
  const testTask = await Task.create({
    taskId: 'TSK-P9-9901',
    contentItemId: testContent._id,
    stageKey: 'editing',
    title: 'Phase 9 Video Reel Edit Task',
    team: 'editor',
    assignee: workerUser._id,
    status: 'done',
    estimateHours: 8,
    actualHours: 8,
    revisionCount: 0,
    dueDate: futureWeek,
    createdAt: pastWeek,
    updatedAt: now,
  });
  testTaskId = testTask._id.toString();

  // 4. Seed TimeEntry
  await TimeEntry.create({
    taskId: testTask._id,
    userId: workerUser._id,
    date: now,
    minutes: 480, // 8 hours
    status: 'approved',
  });

  // 5. Seed StatusHistory
  await StatusHistory.create([
    {
      entityType: 'Task',
      entityId: testTask._id,
      fromStatus: 'assigned',
      toStatus: 'in_progress',
      changedBy: workerUser._id,
      timestamp: pastWeek,
    },
    {
      entityType: 'Task',
      entityId: testTask._id,
      fromStatus: 'in_progress',
      toStatus: 'blocked',
      reasonCode: 'waiting_for_content',
      reason: 'Awaiting raw b-roll footage from client',
      changedBy: workerUser._id,
      timestamp: new Date(pastWeek.getTime() + 2 * 60 * 60 * 1000),
    },
    {
      entityType: 'Task',
      entityId: testTask._id,
      fromStatus: 'blocked',
      toStatus: 'done',
      changedBy: workerUser._id,
      timestamp: now,
    },
  ]);

  // 6. Seed LeaveRequest
  await LeaveRequest.create({
    userId: workerUser._id,
    startDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
    endDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
    type: 'vacation',
    reason: 'Approved annual leave',
    status: 'approved',
    reviewedBy: adminUser._id,
    reviewedAt: now,
  });
});

afterAll(async () => {
  // Clean up test records
  if (testRequestId) await MarketingRequest.findByIdAndDelete(testRequestId);
  if (testContentItemId) await ContentItem.findByIdAndDelete(testContentItemId);
  if (testTaskId) {
    await Task.findByIdAndDelete(testTaskId);
    await TimeEntry.deleteMany({ taskId: testTaskId });
    await StatusHistory.deleteMany({ entityId: testTaskId });
  }
  if (workerUser) {
    await LeaveRequest.deleteMany({ userId: workerUser._id, reason: 'Approved annual leave' });
  }
  if (testScheduledReportId) {
    await ScheduledReport.findByIdAndDelete(testScheduledReportId);
  }
  await disconnectDB();
});

describe('Phase 9: Reports & Analytics Suite', () => {
  // ----------------------------------------------------
  // 1. Metric Formula Unit Tests
  // ----------------------------------------------------
  describe('Metric Engine & Formulas (metrics.js)', () => {
    it('calculates on-time delivery rate correctly with 0 denominator protection', () => {
      expect(calculateOnTimeRate(10, 10)).toBe(100.0);
      expect(calculateOnTimeRate(8, 10)).toBe(80.0);
      expect(calculateOnTimeRate(0, 0)).toBe(100.0);
    });

    it('calculates first-pass approval rate properly', () => {
      expect(calculateFirstPassRate(9, 10)).toBe(90.0);
      expect(calculateFirstPassRate(0, 0)).toBe(100.0);
    });

    it('calculates speed vs estimate score correctly (caps at 100% when under estimate)', () => {
      // Completed in 6h vs 8h estimate -> 100%
      expect(calculateSpeedScore(8, 6)).toBe(100.0);
      // Completed in 10h vs 8h estimate -> 80%
      expect(calculateSpeedScore(8, 10)).toBe(80.0);
      expect(calculateSpeedScore(0, 0)).toBe(100.0);
    });

    it('calculates volume / utilization score correctly', () => {
      // 32h logged on 32h net capacity -> 100%
      expect(calculateVolumeScore(32, 32)).toBe(100.0);
      // 16h logged on 32h net capacity -> 50%
      expect(calculateVolumeScore(16, 32)).toBe(50.0);
    });

    it('computes composite worker efficiency score using 40/30/20/10 weighting', () => {
      // All 100% -> 100.0
      expect(
        calculateEfficiencyScore({
          onTimeRate: 100,
          firstPassRate: 100,
          speedScore: 100,
          volumeScore: 100,
        })
      ).toBe(100.0);

      // (0.4 * 80) + (0.3 * 90) + (0.2 * 100) + (0.1 * 70) = 32 + 27 + 20 + 7 = 86.0
      const score = calculateEfficiencyScore({
        onTimeRate: 80,
        firstPassRate: 90,
        speedScore: 100,
        volumeScore: 70,
        weights: { onTime: 0.4, firstPass: 0.3, speedVsEstimate: 0.2, volumeUtilization: 0.1 },
      });
      expect(score).toBe(86.0);
    });
  });

  // ----------------------------------------------------
  // 2. Department Report Endpoint
  // ----------------------------------------------------
  describe('GET /api/reports/department', () => {
    it('returns department throughput, turnaround, on-time rate, and aging buckets', async () => {
      const res = await request(app)
        .get('/api/reports/department?department=Sales')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.department).toBe('Sales');
      expect(res.body.data.summary.totalContent).toBeGreaterThanOrEqual(1);
      expect(res.body.data.summary.onTimeDeliveryRate).toBeGreaterThanOrEqual(0);
      expect(res.body.data.agingBuckets).toBeDefined();
      expect(Array.isArray(res.body.data.hoursConsumed)).toBe(true);
    });
  });

  // ----------------------------------------------------
  // 3. Team Report Endpoint
  // ----------------------------------------------------
  describe('GET /api/reports/team', () => {
    it('returns team throughput, backlog, utilization, and rework rate', async () => {
      const res = await request(app)
        .get('/api/reports/team?team=editor')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.team).toBe('editor');
      expect(res.body.data.summary.throughput).toBeGreaterThanOrEqual(1);
      expect(res.body.data.summary.reworkRate).toBeGreaterThanOrEqual(0);
      expect(res.body.data.summary.utilizationRate).toBeGreaterThanOrEqual(0);
      expect(res.body.data.tasksByStatus).toBeDefined();
    });
  });

  // ----------------------------------------------------
  // 4. Individual Worker Report Endpoint
  // ----------------------------------------------------
  describe('GET /api/reports/individual/:userId', () => {
    it('returns individual worker performance with efficiency score breakdown', async () => {
      const res = await request(app)
        .get(`/api/reports/individual/${workerUser._id}`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.worker.name).toBe(workerUser.name);
      expect(res.body.data.metrics.efficiencyScore).toBeGreaterThanOrEqual(0);
      expect(res.body.data.metrics.onTimeRate).toBeGreaterThanOrEqual(0);
      expect(res.body.data.metrics.firstPassRate).toBeGreaterThanOrEqual(0);
      expect(res.body.data.metrics.completedCount).toBeGreaterThanOrEqual(1);
      expect(res.body.data.metrics.leaveDays).toBeGreaterThanOrEqual(1);
      expect(res.body.data.weightsUsed).toBeDefined();
    });
  });

  // ----------------------------------------------------
  // 5. Content Report Endpoint
  // ----------------------------------------------------
  describe('GET /api/reports/content', () => {
    it('aggregates content by format, platform, and pipeline stage', async () => {
      const res = await request(app)
        .get('/api/reports/content')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.summary.totalPlanned).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(res.body.data.outputByFormatPlatform)).toBe(true);
      expect(Array.isArray(res.body.data.pipelineByStage)).toBe(true);
    });
  });

  // ----------------------------------------------------
  // 6. Bottlenecks & Hold Radar Report
  // ----------------------------------------------------
  describe('GET /api/reports/bottlenecks', () => {
    it('returns holds and blocks by reason code and current blocked items', async () => {
      const res = await request(app)
        .get('/api/reports/bottlenecks')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.holdsAndBlocks)).toBe(true);
      expect(Array.isArray(res.body.data.statusTransitions)).toBe(true);

      const waitingForContent = res.body.data.holdsAndBlocks.find(
        (h) => h.reasonCode === 'waiting_for_content'
      );
      expect(waitingForContent).toBeDefined();
    });
  });

  // ----------------------------------------------------
  // 7. Management Scorecard Report
  // ----------------------------------------------------
  describe('GET /api/reports/scorecard', () => {
    it('returns executive scorecard with MoM comparison and demand vs capacity forecast', async () => {
      const res = await request(app)
        .get('/api/reports/scorecard')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.scorecard.totalRequests).toBeDefined();
      expect(res.body.data.scorecard.onTimeDeliveryRate).toBeDefined();
      expect(res.body.data.forecast.weeklyCapacityHours).toBeGreaterThanOrEqual(0);
      expect(res.body.data.forecast.status).toBeDefined();
    });
  });

  // ----------------------------------------------------
  // 8. Scoping & Privacy Access Control
  // ----------------------------------------------------
  describe('Scoping and Access Control Enforcement', () => {
    it('allows a worker to access their own individual report', async () => {
      const res = await request(app)
        .get(`/api/reports/individual/${workerUser._id}`)
        .set('Cookie', workerCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.worker.id).toBe(workerUser._id.toString());
    });

    it('denies a worker from accessing another worker individual report (403 Forbidden)', async () => {
      if (workerUser2) {
        const res = await request(app)
          .get(`/api/reports/individual/${workerUser2._id}`)
          .set('Cookie', workerCookie);

        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
      }
    });

    it('scopes department lead queries strictly to their own department', async () => {
      if (deptLeadUser) {
        const res = await request(app)
          .get('/api/reports/department?department=NonExistentOrOther')
          .set('Cookie', deptLeadCookie);

        expect(res.status).toBe(200);
        // Overridden by service to deptLeadUser's department
        expect(res.body.data.department).toBe(deptLeadUser.department);
      }
    });

    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/reports/scorecard');
      expect(res.status).toBe(401);
    });
  });

  // ----------------------------------------------------
  // 9. Streaming Exports (XLSX & CSV)
  // ----------------------------------------------------
  describe('GET /api/reports/export', () => {
    it('streams Excel spreadsheet (.xlsx) with proper headers', async () => {
      const res = await request(app)
        .get('/api/reports/export?report=department&format=xlsx&department=Sales')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(res.headers['content-disposition']).toContain('.xlsx');
      expect(res.body).toBeDefined();
    });

    it('streams CSV export (.csv) with text/csv content type', async () => {
      const res = await request(app)
        .get('/api/reports/export?report=team&format=csv&team=editor')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('.csv');
    });
  });

  // ----------------------------------------------------
  // 10. Scheduled Reports & BullMQ Job
  // ----------------------------------------------------
  describe('Scheduled Reports & Automated Job Dispatch', () => {
    it('creates a new recurring scheduled report', async () => {
      const res = await request(app)
        .post('/api/reports/scheduled')
        .set('Cookie', adminCookie)
        .send({
          name: 'Weekly Executive Marketing Scorecard',
          reportType: 'scorecard',
          frequency: 'weekly',
          format: 'xlsx',
          recipients: ['executives@marketingportal.com'],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Weekly Executive Marketing Scorecard');
      testScheduledReportId = res.body.data._id;
    });

    it('lists active scheduled reports', async () => {
      const res = await request(app)
        .get('/api/reports/scheduled')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.some((r) => r._id === testScheduledReportId)).toBe(true);
    });

    it('executes runScheduledReportsJob successfully without error', async () => {
      // Force nextRunAt to past so job processes it
      if (testScheduledReportId) {
        await ScheduledReport.findByIdAndUpdate(testScheduledReportId, {
          nextRunAt: new Date(Date.now() - 60000),
        });
      }

      const processed = await runScheduledReportsJob();
      expect(Array.isArray(processed)).toBe(true);
      expect(processed.length).toBeGreaterThanOrEqual(1);

      const updated = await ScheduledReport.findById(testScheduledReportId);
      expect(updated.lastSentAt).toBeDefined();
      expect(new Date(updated.nextRunAt).getTime()).toBeGreaterThan(Date.now());
    });

    it('deletes/cancels a scheduled report', async () => {
      const res = await request(app)
        .delete(`/api/reports/scheduled/${testScheduledReportId}`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const check = await ScheduledReport.findById(testScheduledReportId);
      expect(check).toBeNull();
      testScheduledReportId = '';
    });
  });

  // ----------------------------------------------------
  // 11. Role Dashboards
  // ----------------------------------------------------
  describe('Role-Specific Dashboard Summaries (/api/dashboard)', () => {
    it('returns auto-resolved summary for current user role', async () => {
      const res = await request(app)
        .get('/api/dashboard/summary')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('admin');
      expect(res.body.data.widgets.awaitingTriageCount).toBeDefined();
    });

    it('returns worker dashboard with today tasks, revisions, and personal efficiency', async () => {
      const res = await request(app)
        .get('/api/dashboard/worker')
        .set('Cookie', workerCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('worker');
      expect(res.body.data.widgets.efficiencyScore).toBeDefined();
      expect(res.body.data.widgets.hoursLoggedThisWeek).toBeDefined();
    });
  });

  // ----------------------------------------------------
  // 12. Performance Acceptance Test (< 2 seconds response)
  // ----------------------------------------------------
  describe('Performance Benchmark (< 2000ms response)', () => {
    it('executes department report aggregation in under 2000ms', async () => {
      const start = Date.now();
      const res = await request(app)
        .get('/api/reports/department')
        .set('Cookie', adminCookie);
      const elapsed = Date.now() - start;

      expect(res.status).toBe(200);
      expect(elapsed).toBeLessThan(2000);
    });
  });
});
