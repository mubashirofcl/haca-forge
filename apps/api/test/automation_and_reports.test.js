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
      deadline: new Date(Date.now() - 2 * 86400000), // overdue by IST day (Phase 7 close-out)
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
    it('Phase 7: the removed report and automation routes return 404', async () => {
      const routes = [
        ['get', '/api/reports/definitions'],
        ['get', '/api/reports/definitions/weekly_marketing'],
        ['patch', '/api/reports/definitions/weekly_marketing'],
        ['post', '/api/reports/definitions/weekly_marketing/generate'],
        ['post', '/api/reports/weekly_marketing/generate'],
        ['get', '/api/reports/view/weekly_marketing'],
        ['get', '/api/reports/department'],
        ['get', '/api/reports/team'],
        ['get', '/api/reports/content'],
        ['get', '/api/reports/bottlenecks'],
        ['get', '/api/reports/scorecard'],
        ['get', '/api/reports/export?format=html'],
        ['get', '/api/reports/scheduled'],
        ['post', '/api/reports/scheduled'],
        ['delete', `/api/reports/scheduled/${new mongoose.Types.ObjectId()}`],
        ['get', '/api/automation/rules'],
        ['get', '/api/automation'],
        ['patch', `/api/automation/rules/${new mongoose.Types.ObjectId()}/toggle`],
        ['post', `/api/automation/rules/${new mongoose.Types.ObjectId()}/run`],
      ];
      for (const [method, url] of routes) {
        const res = await request(app)[method](url).set('Authorization', `Bearer ${adminToken}`).send({});
        expect([url, res.status]).toEqual([url, 404]);
      }
    });

    it('Executes overdue_escalation rule: dispatches owner warning and SM Manager escalation', async () => {
      const rule = await AutomationRule.findOne({ ruleKey: 'overdue_escalation' });

      const res = { body: { result: await executeAutomationRule(rule.ruleKey, null, { force: true }) } };
      expect(res.body.result.status).toBe('success');
      expect(res.body.result.ownerNotified).toBeGreaterThanOrEqual(1);
      expect(res.body.result.managerNotified).toBeGreaterThanOrEqual(1);

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
      const rerunRes = { body: { result: await executeAutomationRule(rule.ruleKey, null, { force: true }) } };
      expect(rerunRes.body.result.ownerNotified).toBe(0); // Deduplicated
      expect(rerunRes.body.result.managerNotified).toBe(0); // Sent once only
    });

    it('Executes todo_escalation rule: flags stagnant items without status change', async () => {
      const rule = await AutomationRule.findOne({ ruleKey: 'todo_escalation' });

      const res = { body: { result: await executeAutomationRule(rule.ruleKey, null, { force: true }) } };
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

      const res = { body: { result: await executeAutomationRule(rule.ruleKey, null, { force: true }) } };
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

  describe('2. Reports (Phase 7: live only)', () => {
    it('the live overview report answers for the creative head', async () => {
      const res = await request(app).get('/api/reports/overview').set('Authorization', `Bearer ${headToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.cards).toBeDefined();
    });
  });
});
