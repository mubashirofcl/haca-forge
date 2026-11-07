import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { app } from '../src/server.js';
import { Person } from '../src/modules/people/model.js';
import { Department } from '../src/modules/departments/model.js';
import { Profile } from '../src/modules/referenceData/profile.model.js';
import { WorkItem } from '../src/modules/workItems/model.js';
import { Blocker } from '../src/modules/blockers/model.js';
import { FeedbackEntry, RevisionFlag } from '../src/modules/feedback/model.js';
import { Notification } from '../src/modules/notifications/model.js';
import { AutomationRule } from '../src/modules/automation/model.js';
import { ReportDefinition } from '../src/modules/reports/model.js';
import { ensureAutomationRules, executeAutomationRule } from '../src/modules/automation/runner.js';
import { ensureReportDefinitions, generateReport } from '../src/modules/reports/service.js';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';

const makeToken = (user) =>
  jwt.sign(
    { userId: user._id.toString(), role: user.role, email: user.email },
    env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );

describe('Phase 7: Automation Rules, Reports & Notifications (Screen 14)', () => {
  let adminUser, headUser, leadUser, memberUser, depOwnerUser;
  let adminToken, headToken, leadToken, memberToken;
  let profileAlpha;
  let deptDesign;
  let overdueItem, staleItem;

  beforeAll(async () => {
    const mongoUri =
      process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/marketing_portal_test';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }

    // Clean test data
    await AutomationRule.deleteMany({});
    await ReportDefinition.deleteMany({});
    await WorkItem.deleteMany({});
    await Blocker.deleteMany({});
    await FeedbackEntry.deleteMany({});
    await RevisionFlag.deleteMany({});
    await Notification.deleteMany({});
    await Person.deleteMany({ email: /@auto-test\.com$/ });
    await Department.deleteMany({ code: 'auto_design' });
    await Profile.deleteMany({ code: 'auto_alpha' });

    // Seed Profile & Department
    profileAlpha = await Profile.create({
      name: 'Auto Brand Alpha',
      code: 'auto_alpha',
      active: true,
    });

    deptDesign = await Department.create({
      name: 'Auto Design Dept',
      code: 'auto_design',
      active: true,
    });

    // Seed Users
    adminUser = await Person.create({
      name: 'Auto Admin',
      email: 'admin@auto-test.com',
      role: 'admin',
      departmentId: deptDesign._id,
      profileAccess: [profileAlpha._id],
      active: true,
    });

    leadUser = await Person.create({
      name: 'Auto Lead',
      email: 'lead@auto-test.com',
      role: 'sm_manager',
      departmentId: deptDesign._id,
      profileAccess: [profileAlpha._id],
      active: true,
    });

    headUser = await Person.create({
      name: 'Auto Head',
      email: 'head@auto-test.com',
      role: 'creative_head',
      profileAccess: [profileAlpha._id],
      active: true,
    });

    memberUser = await Person.create({
      name: 'Auto Member',
      email: 'member@auto-test.com',
      role: 'team_member',
      departmentId: deptDesign._id,
      profileAccess: [profileAlpha._id],
      reportsToIds: [leadUser._id],
      active: true,
    });

    depOwnerUser = await Person.create({
      name: 'Dep Owner Member',
      email: 'dep.owner@auto-test.com',
      role: 'team_member',
      departmentId: deptDesign._id,
      profileAccess: [profileAlpha._id],
      reportsToIds: [leadUser._id],
      active: true,
    });

    adminToken = makeToken(adminUser);
    headToken = makeToken(headUser);
    leadToken = makeToken(leadUser);
    memberToken = makeToken(memberUser);

    // Seed Overdue WorkItem (deadline 6 hours ago)
    overdueItem = await WorkItem.create({
      title: 'Overdue Banner Deliverable',
      workType: 'Ad Creative',
      profileId: profileAlpha._id,
      departmentId: deptDesign._id,
      ownerId: memberUser._id,
      status: 'In Progress',
      deadline: new Date(Date.now() - 6 * 3600000),
      estimatedEffortHrs: 6,
    });

    // Seed Stale WorkItem (updated 5 days ago)
    staleItem = await WorkItem.create({
      title: 'Stale Landing Page Wireframe',
      workType: 'Landing Page',
      profileId: profileAlpha._id,
      departmentId: deptDesign._id,
      ownerId: memberUser._id,
      status: 'In Progress',
      deadline: new Date(Date.now() + 5 * 86400000),
      estimatedEffortHrs: 8,
    });
    // Force updatedAt back 5 days
    await WorkItem.updateOne(
      { _id: staleItem._id },
      { $set: { updatedAt: new Date(Date.now() - 5 * 86400000) } },
      { timestamps: false }
    );

    // Seed standard rules and reports
    await ensureAutomationRules();
    await ensureReportDefinitions();
  });

  afterAll(async () => {
    await AutomationRule.deleteMany({});
    await ReportDefinition.deleteMany({});
    await WorkItem.deleteMany({});
    await Blocker.deleteMany({});
    await FeedbackEntry.deleteMany({});
    await RevisionFlag.deleteMany({});
    await Notification.deleteMany({});
    await Person.deleteMany({ email: /@auto-test\.com$/ });
    await Department.deleteMany({ code: 'auto_design' });
    await Profile.deleteMany({ code: 'auto_alpha' });
  });

  describe('1. Automation Rules API & Runner', () => {
    it('GET /api/automation/rules returns the 6 standard automation rules', async () => {
      const res = await request(app)
        .get('/api/automation/rules')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.rules).toBeDefined();
      expect(res.body.rules.length).toBe(6);

      const ruleKeys = res.body.rules.map((r) => r.ruleKey);
      expect(ruleKeys).toContain('month_end_report');
      expect(ruleKeys).toContain('overdue_escalation');
      expect(ruleKeys).toContain('todo_escalation');
      expect(ruleKeys).toContain('blocker_dependency_alert');
      expect(ruleKeys).toContain('revision_pattern_flag');
      expect(ruleKeys).toContain('weekly_report');
    });

    it('PATCH /api/automation/rules/:id/toggle pauses and resumes a rule', async () => {
      const rule = await AutomationRule.findOne({ ruleKey: 'overdue_escalation' });
      expect(rule.active).toBe(true);

      // Pause rule
      const pauseRes = await request(app)
        .patch(`/api/automation/rules/${rule._id}/toggle`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ active: false });

      expect(pauseRes.status).toBe(200);
      expect(pauseRes.body.rule.active).toBe(false);

      // Resume rule
      const resumeRes = await request(app)
        .patch(`/api/automation/rules/${rule._id}/toggle`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ active: true });

      expect(resumeRes.status).toBe(200);
      expect(resumeRes.body.rule.active).toBe(true);
    });

    it('Executes overdue_escalation rule: dispatches owner warning and SM Manager escalation', async () => {
      const rule = await AutomationRule.findOne({ ruleKey: 'overdue_escalation' });

      const res = await request(app)
        .post(`/api/automation/rules/${rule._id}/run`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ force: true });

      expect(res.status).toBe(200);
      expect(res.body.result.status).toBe('success');
      expect(res.body.result.ownerNotified).toBeGreaterThanOrEqual(1);
      expect(res.body.result.leadEscalated).toBeGreaterThanOrEqual(1);

      // Verify owner received notification
      const ownerNotif = await Notification.findOne({
        recipient: memberUser._id,
        'metadata.workItemId': overdueItem._id,
      });
      expect(ownerNotif).toBeTruthy();
      expect(ownerNotif.type).toBe('warning');

      // Verify SM Manager received escalation notification (>4h overdue)
      const leadNotif = await Notification.findOne({
        recipient: leadUser._id,
        'metadata.workItemId': overdueItem._id,
      });
      expect(leadNotif).toBeTruthy();
      expect(leadNotif.type).toBe('alert');

      // Assert Idempotency: re-running immediately does NOT duplicate notifications
      const rerunRes = await request(app)
        .post(`/api/automation/rules/${rule._id}/run`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ force: true });

      expect(rerunRes.status).toBe(200);
      expect(rerunRes.body.result.ownerNotified).toBe(0); // Deduplicated
      expect(rerunRes.body.result.leadEscalated).toBe(0); // Deduplicated
    });

    it('Executes todo_escalation rule: flags stagnant items without status change', async () => {
      const rule = await AutomationRule.findOne({ ruleKey: 'todo_escalation' });

      const res = await request(app)
        .post(`/api/automation/rules/${rule._id}/run`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ force: true });

      expect(res.status).toBe(200);
      expect(res.body.result.status).toBe('success');
      expect(res.body.result.notifiedCount).toBeGreaterThanOrEqual(1);

      const staleNotif = await Notification.findOne({
        recipient: memberUser._id,
        'metadata.type': 'stale_todo',
      });
      expect(staleNotif).toBeTruthy();
      expect(staleNotif.message.toLowerCase()).toContain('stale');
    });

    it('Executes blocker_dependency_alert rule: alerts cross-functional dependency owner', async () => {
      // Create blocker older than 24 hours
      const blocker = await Blocker.create({
        workItemId: overdueItem._id,
        blockedById: memberUser._id,
        reason: 'Waiting for feedback',
        dependencyOwnerId: depOwnerUser._id,
        notes: 'Awaiting creative brief signoff',
        status: 'Active',
        createdAt: new Date(Date.now() - 36 * 3600000),
      });

      const rule = await AutomationRule.findOne({ ruleKey: 'blocker_dependency_alert' });

      const res = await request(app)
        .post(`/api/automation/rules/${rule._id}/run`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ force: true });

      expect(res.status).toBe(200);
      expect(res.body.result.status).toBe('success');
      expect(res.body.result.remindedCount).toBeGreaterThanOrEqual(1);

      const depNotif = await Notification.findOne({
        recipient: depOwnerUser._id,
        'metadata.blockerId': blocker._id,
      });
      expect(depNotif).toBeTruthy();
      expect(depNotif.title).toContain('Dependency Blocker');
    });
  });

  describe('2. Report Definitions API & Generation', () => {
    it('GET /api/reports/definitions returns the 4 standard report definitions', async () => {
      const res = await request(app)
        .get('/api/reports/definitions')
        .set('Authorization', `Bearer ${leadToken}`);

      expect(res.status).toBe(200);
      expect(res.body.definitions).toBeDefined();
      expect(res.body.definitions.length).toBe(4);

      const reportKeys = res.body.definitions.map((d) => d.reportKey);
      expect(reportKeys).toContain('weekly_marketing');
      expect(reportKeys).toContain('monthly_scorecard');
      expect(reportKeys).toContain('creative_production');
      expect(reportKeys).toContain('team_performance');
    });

    it('Generates Weekly Creative Report on demand via POST /api/reports/definitions/:key/generate', async () => {
      const res = await request(app)
        .post('/api/reports/definitions/weekly_marketing/generate')
        .set('Authorization', `Bearer ${headToken}`)
        .send({ sendEmail: false });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.report).toBeDefined();
      expect(res.body.report.reportKey).toBe('weekly_marketing');
      expect(res.body.report.summary.totalWorkItems).toBeGreaterThanOrEqual(2);
      expect(res.body.report.tables.length).toBeGreaterThanOrEqual(2);
      expect(res.body.report.html).toContain('Weekly Creative Report');

      // Verify ReportDefinition record updated with lastGeneratedAt
      const def = await ReportDefinition.findOne({ reportKey: 'weekly_marketing' });
      expect(def.lastGeneratedAt).toBeTruthy();
      expect(def.lastGeneratedSummary).toBeTruthy();
    });

    it('Generates Monthly Performance Scorecard with deliverable throughput and HTML preview', async () => {
      const res = await request(app)
        .post('/api/reports/definitions/monthly_scorecard/generate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.report.reportKey).toBe('monthly_scorecard');
      expect(res.body.report.summary.totalDeliverables).toBeGreaterThanOrEqual(2);
      expect(res.body.report.html).toContain('Monthly Performance Scorecard');
    });

    it('Refuses report generation for SM Manager with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/reports/definitions/creative_production/generate')
        .set('Authorization', `Bearer ${leadToken}`)
        .send({});

      expect(res.status).toBe(403);
    });

    it('Generates Creative Production Report with work type throughput (Creative Head)', async () => {
      const res = await request(app)
        .post('/api/reports/definitions/creative_production/generate')
        .set('Authorization', `Bearer ${headToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.report.reportKey).toBe('creative_production');
      expect(res.body.report.summary.totalDeliverables).toBeGreaterThanOrEqual(2);
      expect(res.body.report.tables[0].columns).toContain('Work Type');
    });

    it('Generates Team Performance Digest as team-level totals, with no per-person rows', async () => {
      const res = await request(app)
        .post('/api/reports/definitions/team_performance/generate')
        .set('Authorization', `Bearer ${headToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.report.reportKey).toBe('team_performance');
      expect(res.body.report.tables[0].title).toBe('Team Totals');
      expect(res.body.report.tables[0].columns).toEqual(['Figure', 'Value', 'Based on']);
      expect(res.body.report.tables[0].columns).not.toContain('Team Member');
      // Workload has no reliable calculation yet, so no band is shown.
      const workload = res.body.report.tables[0].rows.find((r) => r[0] === 'Workload');
      expect(workload[1]).toBe('Not available yet');
    });

    it('GET /api/reports/view/:key returns interactive live report', async () => {
      const res = await request(app)
        .get('/api/reports/view/weekly_marketing')
        .set('Authorization', `Bearer ${leadToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.report.reportKey).toBe('weekly_marketing');
    });
  });
});
