import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/server.js';
import {
  ROLE_KEYS,
  PERMISSION_KEYS,
  ROLE_PERMISSIONS,
  LEGACY_ROLE_ALIASES,
  REQUESTABLE_ROLES,
} from '@mmp/shared';
import { resolveScope } from '../src/lib/scope.js';
import { Person } from '../src/modules/people/model.js';
import { Department } from '../src/modules/departments/model.js';
import { Profile } from '../src/modules/referenceData/profile.model.js';
import { MonthlyTarget } from '../src/modules/targets/model.js';
import { Campaign } from '../src/modules/campaigns/model.js';
import { WorkItem } from '../src/modules/workItems/model.js';
import { AutomationRule } from '../src/modules/automation/model.js';
import { AccessRequest } from '../src/modules/access/model.js';
import * as peopleService from '../src/modules/people/service.js';
import * as assignmentService from '../src/modules/assignment/service.js';
import { env } from '../src/config/env.js';

const makeToken = (user) =>
  jwt.sign(
    { userId: user._id.toString(), role: user.role, email: user.email },
    env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );

describe('Phase Executive: Fifth Role (Company Management)', () => {
  let adminUser, headUser, execUser, execRestrictedUser, leadUser, memberUser;
  let adminToken, headToken, execToken, execRestrictedToken, leadToken;
  let profileAlpha, profileBeta;
  let testDept;
  let testCampaign, testWorkItem, testTarget, testRule;

  const currentMonth = new Date().toISOString().slice(0, 7);

  beforeAll(async () => {
    const mongoUri =
      process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/marketing_portal_test';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }

    // Clean test data
    await Person.deleteMany({ email: /@exec-test\.com$/ });
    await Profile.deleteMany({ code: { $in: ['exec_alpha', 'exec_beta'] } });
    await Department.deleteMany({ code: 'exec_design' });
    await Campaign.deleteMany({ name: /Exec Test/ });
    await WorkItem.deleteMany({ title: /Exec Work/ });
    await MonthlyTarget.deleteMany({ month: currentMonth, profileId: { $exists: true } });
    await AutomationRule.deleteMany({ ruleKey: 'exec_test_rule' });
    await AccessRequest.deleteMany({ email: /@exec-test\.com$/ });

    // 1. Create reference profiles & department
    profileAlpha = await Profile.create({ name: 'Exec Alpha Brand', code: 'exec_alpha', active: true });
    profileBeta = await Profile.create({ name: 'Exec Beta Brand', code: 'exec_beta', active: true });
    testDept = await Department.create({ name: 'Exec Design Dept', code: 'exec_design' });

    // 2. Create users
    adminUser = await Person.create({
      name: 'Exec Admin',
      email: 'admin@exec-test.com',
      role: 'admin',
      status: 'active',
      profileAccess: [profileAlpha._id, profileBeta._id],
    });

    headUser = await Person.create({
      name: 'Exec Marketing Head',
      email: 'head@exec-test.com',
      role: 'marketing_head',
      status: 'active',
      profileAccess: [profileAlpha._id, profileBeta._id],
    });

    execUser = await Person.create({
      name: 'Exec Full Leader',
      email: 'exec@exec-test.com',
      role: 'executive',
      status: 'active',
      phone: '+91 99999 88888',
      profileAccess: [profileAlpha._id, profileBeta._id],
    });

    execRestrictedUser = await Person.create({
      name: 'Exec Restricted',
      email: 'exec.restricted@exec-test.com',
      role: 'executive',
      status: 'active',
      profileAccess: [profileAlpha._id], // restricted to Alpha only
    });

    leadUser = await Person.create({
      name: 'Exec Team Lead',
      email: 'lead@exec-test.com',
      role: 'team_lead',
      status: 'active',
      departmentId: testDept._id,
      profileAccess: [profileAlpha._id, profileBeta._id],
    });

    memberUser = await Person.create({
      name: 'Exec Member',
      email: 'member@exec-test.com',
      phone: '+91 99999 77777',
      role: 'team_member',
      status: 'active',
      departmentId: testDept._id,
      reportsToIds: [leadUser._id],
      profileAccess: [profileAlpha._id, profileBeta._id],
    });

    adminToken = makeToken(adminUser);
    headToken = makeToken(headUser);
    execToken = makeToken(execUser);
    execRestrictedToken = makeToken(execRestrictedUser);
    leadToken = makeToken(leadUser);

    // 3. Seed operational fixtures
    testTarget = await MonthlyTarget.create({
      month: currentMonth,
      profileId: profileAlpha._id,
      revenueTarget: 500000,
      leadsTarget: 100,
      qualifiedLeadsTarget: 40,
      budget: 50000,
    });

    testCampaign = await Campaign.create({
      name: 'Exec Test Campaign Alpha',
      profileId: profileAlpha._id,
      targetId: testTarget._id,
      departmentId: testDept._id,
      ownerId: leadUser._id,
      goalType: 'Leads',
      expectedOutcome: 'Lead Generation',
      relatedOKR: 'Scale brand leads through creative ad sets',
      status: 'In Progress',
      budget: 25000,
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    testWorkItem = await WorkItem.create({
      title: 'Exec Work Item Alpha',
      workType: 'Ad Creative',
      campaignId: testCampaign._id,
      profileId: profileAlpha._id,
      departmentId: testDept._id,
      ownerId: memberUser._id,
      relatedOKR: 'Scale brand leads through creative ad sets',
      deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      estimatedEffortHrs: 4,
      status: 'In Progress',
      priority: 'High',
    });

    await AutomationRule.deleteMany({ ruleKey: 'overdue_escalation' });
    testRule = await AutomationRule.create({
      ruleKey: 'overdue_escalation',
      name: 'Exec Overdue Rule',
      description: 'Rule for testing executive read-only behavior',
      trigger: 'cron',
      schedule: '0 9 * * *',
      action: 'escalate_overdue',
      active: true,
      lastRunStatus: 'idle',
    });
  });

  afterAll(async () => {
    await Person.deleteMany({ email: /@exec-test\.com$/ });
    await Profile.deleteMany({ code: { $in: ['exec_alpha', 'exec_beta'] } });
    await Department.deleteMany({ code: 'exec_design' });
    await Campaign.deleteMany({ name: /Exec Test/ });
    await WorkItem.deleteMany({ title: /Exec Work/ });
    await MonthlyTarget.deleteMany({ month: currentMonth, profileId: { $exists: true } });
    await AutomationRule.deleteMany({ ruleKey: 'exec_test_rule' });
    await AccessRequest.deleteMany({ email: /@exec-test\.com$/ });
  });

  // -------------------------------------------------------------
  // Part 1: Schema & Permission Contract
  // -------------------------------------------------------------
  describe('Part 1: Contract & Permissions Snapshot', () => {
    it('defines executive in ROLE_KEYS with exactly 5 roles', () => {
      expect(ROLE_KEYS).toEqual(['admin', 'marketing_head', 'executive', 'team_lead', 'team_member']);
    });

    it('contains portal.view and people.view in PERMISSION_KEYS', () => {
      expect(PERMISSION_KEYS).toContain('portal.view');
      expect(PERMISSION_KEYS).toContain('people.view');
    });

    it('grants executive read-only portal permissions snapshot', () => {
      expect(ROLE_PERMISSIONS.executive).toEqual([
        'portal.view',
        'people.view',
        'target.view',
        'lead.view',
        'datacenter.view',
        'analytics.team',
        'report.view',
      ]);
    });

    it('grants marketing_head portal.view and people.view', () => {
      expect(ROLE_PERMISSIONS.marketing_head).toContain('portal.view');
      expect(ROLE_PERMISSIONS.marketing_head).toContain('people.view');
    });

    it('maps legacy management and viewer roles to executive', () => {
      expect(LEGACY_ROLE_ALIASES.management).toBe('executive');
      expect(LEGACY_ROLE_ALIASES.viewer).toBe('executive');
    });

    it('excludes executive from public REQUESTABLE_ROLES', () => {
      expect(REQUESTABLE_ROLES).not.toContain('executive');
      expect(REQUESTABLE_ROLES).toEqual(['team_member', 'team_lead']);
    });
  });

  // -------------------------------------------------------------
  // Part 2: Scope Resolution
  // -------------------------------------------------------------
  describe('Part 2: Scoping (resolveScope)', () => {
    it('resolves executive with all profileAccess as scopeType: all and allowedPersonIds: null', async () => {
      const scope = await resolveScope(execUser);
      expect(scope.scopeType).toBe('all');
      expect(scope.allowedPersonIds).toBeNull();
      expect(scope.canAccessPerson(memberUser._id)).toBe(true);
      expect(scope.canAccessPerson(new mongoose.Types.ObjectId())).toBe(true);
      expect(scope.canAccessProfile(profileAlpha._id)).toBe(true);
      expect(scope.canAccessProfile(profileBeta._id)).toBe(true);
    });

    it('restricts executive profile scope when admin restricts userProfileAccess', async () => {
      const scope = await resolveScope(execRestrictedUser);
      expect(scope.scopeType).toBe('all');
      expect(scope.canAccessProfile(profileAlpha._id)).toBe(true);
      expect(scope.canAccessProfile(profileBeta._id)).toBe(false);
      expect(scope.allowedProfileIds).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------
  // Part 3: Route Walker (200 on Reads, 403 on Mutations)
  // -------------------------------------------------------------
  describe('Part 3: Route Walker - Complete Read Access (200 OK)', () => {
    it('GET /api/dashboard/overview -> 200', async () => {
      const res = await request(app)
        .get('/api/dashboard/overview')
        .set('Authorization', `Bearer ${execToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('GET /api/dashboard/summary -> 200', async () => {
      const res = await request(app)
        .get('/api/dashboard/summary')
        .set('Authorization', `Bearer ${execToken}`);
      expect(res.status).toBe(200);
    });

    it('GET /api/targets -> 200', async () => {
      const res = await request(app)
        .get('/api/targets')
        .set('Authorization', `Bearer ${execToken}`);
      expect(res.status).toBe(200);
    });

    it('GET /api/campaigns -> 200', async () => {
      const res = await request(app)
        .get('/api/campaigns')
        .set('Authorization', `Bearer ${execToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('GET /api/work-items -> 200', async () => {
      const res = await request(app)
        .get('/api/work-items')
        .set('Authorization', `Bearer ${execToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('GET /api/calendar -> 200', async () => {
      const res = await request(app)
        .get('/api/calendar')
        .set('Authorization', `Bearer ${execToken}`);
      expect(res.status).toBe(200);
    });

    it('GET /api/work-items/todo -> 200', async () => {
      const res = await request(app)
        .get('/api/work-items/todo')
        .set('Authorization', `Bearer ${execToken}`);
      expect(res.status).toBe(200);
    });

    it('GET /api/feedback/threads -> 200', async () => {
      const res = await request(app)
        .get('/api/feedback/threads')
        .set('Authorization', `Bearer ${execToken}`);
      expect(res.status).toBe(200);
    });

    it('GET /api/revisions/flags -> 200', async () => {
      const res = await request(app)
        .get('/api/revisions/flags')
        .set('Authorization', `Bearer ${execToken}`);
      expect(res.status).toBe(200);
    });

    it('GET /api/blockers -> 200', async () => {
      const res = await request(app)
        .get('/api/blockers')
        .set('Authorization', `Bearer ${execToken}`);
      expect(res.status).toBe(200);
    });

    it('GET /api/reports/definitions -> 200', async () => {
      const res = await request(app)
        .get('/api/reports/definitions')
        .set('Authorization', `Bearer ${execToken}`);
      expect(res.status).toBe(200);
    });

    it('GET /api/reports/view/weekly_marketing -> 200', async () => {
      const res = await request(app)
        .get('/api/reports/view/weekly_marketing')
        .set('Authorization', `Bearer ${execToken}`);
      expect(res.status).toBe(200);
    });

    it('GET /api/automation/rules -> 200', async () => {
      const res = await request(app)
        .get('/api/automation/rules')
        .set('Authorization', `Bearer ${execToken}`);
      expect(res.status).toBe(200);
    });

    it('GET /api/people -> 200', async () => {
      const res = await request(app)
        .get('/api/people')
        .set('Authorization', `Bearer ${execToken}`);
      expect(res.status).toBe(200);
    });

    it('GET /api/leads/datacenter -> 200', async () => {
      const res = await request(app)
        .get('/api/leads/datacenter')
        .set('Authorization', `Bearer ${execToken}`);
      expect(res.status).toBe(200);
    });

    it('GET /api/leads/funnel -> 200', async () => {
      const res = await request(app)
        .get('/api/leads/funnel')
        .set('Authorization', `Bearer ${execToken}`);
      expect(res.status).toBe(200);
    });

    it('GET /api/assignment/overrides -> 200', async () => {
      const res = await request(app)
        .get('/api/assignment/overrides')
        .set('Authorization', `Bearer ${execToken}`);
      expect(res.status).toBe(200);
    });
  });

  describe('Part 3: Route Walker - Write Mutations Strictly Blocked (403 Forbidden)', () => {
    it('POST /api/work-items -> 403', async () => {
      const res = await request(app)
        .post('/api/work-items')
        .set('Authorization', `Bearer ${execToken}`)
        .send({
          title: 'Forbidden Exec Work',
          workType: 'Ad Creative',
          campaignId: testCampaign._id.toString(),
          deadline: new Date().toISOString(),
        });
      expect(res.status).toBe(403);
    });

    it('PATCH /api/work-items/:id -> 403', async () => {
      const res = await request(app)
        .patch(`/api/work-items/${testWorkItem._id}`)
        .set('Authorization', `Bearer ${execToken}`)
        .send({ estimatedEffortHrs: 8 });
      expect(res.status).toBe(403);
    });

    it('POST /api/work-items/:id/transition -> 403', async () => {
      const res = await request(app)
        .post(`/api/work-items/${testWorkItem._id}/transition`)
        .set('Authorization', `Bearer ${execToken}`)
        .send({ toStatus: 'Approved' });
      expect(res.status).toBe(403);
    });

    it('POST /api/calendar -> 403', async () => {
      const res = await request(app)
        .post('/api/calendar')
        .set('Authorization', `Bearer ${execToken}`)
        .send({
          title: 'Forbidden Calendar Event',
          deadline: new Date().toISOString(),
          campaignId: testCampaign._id.toString(),
          workType: 'Ad Creative',
        });
      expect(res.status).toBe(403);
    });

    it('POST /api/campaigns -> 403', async () => {
      const res = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${execToken}`)
        .send({
          name: 'Forbidden Campaign',
          profileId: profileAlpha._id.toString(),
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
          budget: 1000,
        });
      expect(res.status).toBe(403);
    });

    it('POST /api/targets -> 403', async () => {
      const res = await request(app)
        .post('/api/targets')
        .set('Authorization', `Bearer ${execToken}`)
        .send({
          month: '2027-01',
          profileId: profileAlpha._id.toString(),
          revenueTarget: 1000,
          leadsTarget: 10,
        });
      expect(res.status).toBe(403);
    });

    it('POST /api/people -> 403', async () => {
      const res = await request(app)
        .post('/api/people')
        .set('Authorization', `Bearer ${execToken}`)
        .send({
          name: 'Forbidden Person',
          email: 'forbidden@exec-test.com',
          role: 'team_member',
        });
      expect(res.status).toBe(403);
    });

    it('PATCH /api/people/:id -> 403', async () => {
      const res = await request(app)
        .patch(`/api/people/${memberUser._id}`)
        .set('Authorization', `Bearer ${execToken}`)
        .send({ weeklyCapacityHours: 35 });
      expect(res.status).toBe(403);
    });

    it('POST /api/feedback -> 403', async () => {
      const res = await request(app)
        .post('/api/feedback')
        .set('Authorization', `Bearer ${execToken}`)
        .send({
          workItemId: testWorkItem._id.toString(),
          comment: 'Forbidden executive feedback',
        });
      expect(res.status).toBe(403);
    });

    it('POST /api/revisions/flags/:id/classify -> 403', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .post(`/api/revisions/flags/${fakeId}/classify`)
        .set('Authorization', `Bearer ${execToken}`)
        .send({ classification: 'Direction Shift' });
      expect(res.status).toBe(403);
    });

    it('POST /api/blockers -> 403', async () => {
      const res = await request(app)
        .post('/api/blockers')
        .set('Authorization', `Bearer ${execToken}`)
        .send({
          workItemId: testWorkItem._id.toString(),
          reason: 'Waiting for content',
        });
      expect(res.status).toBe(403);
    });

    it('POST /api/assignment/recommend -> 403', async () => {
      const res = await request(app)
        .post('/api/assignment/recommend')
        .set('Authorization', `Bearer ${execToken}`)
        .send({
          workType: 'Ad Creative',
          departmentId: testDept._id.toString(),
          profileId: profileAlpha._id.toString(),
          estimatedEffortHrs: 4,
          deadline: new Date(Date.now() + 86400000).toISOString(),
        });
      expect(res.status).toBe(403);
    });

    it('POST /api/assignment/override -> 403', async () => {
      const res = await request(app)
        .post('/api/assignment/override')
        .set('Authorization', `Bearer ${execToken}`)
        .send({
          workItemId: testWorkItem._id.toString(),
          assignedPersonId: memberUser._id.toString(),
          reason: 'Emergency assignment',
        });
      expect(res.status).toBe(403);
    });

    it('POST /api/reports/definitions/:key/generate -> 403', async () => {
      const res = await request(app)
        .post('/api/reports/definitions/weekly_marketing/generate')
        .set('Authorization', `Bearer ${execToken}`)
        .send({ sendEmail: false });
      expect(res.status).toBe(403);
    });

    it('POST /api/automation/rules/:id/run -> 403', async () => {
      const res = await request(app)
        .post(`/api/automation/rules/${testRule._id}/run`)
        .set('Authorization', `Bearer ${execToken}`)
        .send({ force: true });
      expect(res.status).toBe(403);
    });

    it('POST /api/datacenter/sync -> 403', async () => {
      const res = await request(app)
        .post('/api/datacenter/sync')
        .set('Authorization', `Bearer ${execToken}`)
        .send({});
      expect(res.status).toBe(403);
    });

    it('POST /api/uploads/sign -> 403', async () => {
      const res = await request(app)
        .post('/api/uploads/sign')
        .set('Authorization', `Bearer ${execToken}`)
        .send({
          filename: 'test.png',
          contentType: 'image/png',
          fileSize: 1024,
        });
      expect(res.status).toBe(403);
    });

    it('POST /api/departments -> 403', async () => {
      const res = await request(app)
        .post('/api/departments')
        .set('Authorization', `Bearer ${execToken}`)
        .send({
          name: 'Forbidden Dept',
          code: 'forbidden_dept',
        });
      expect(res.status).toBe(403);
    });

    it('GET /api/work-items/my-work -> 403 (executive lacks personal queue)', async () => {
      const res = await request(app)
        .get('/api/work-items/my-work')
        .set('Authorization', `Bearer ${execToken}`);
      expect(res.status).toBe(403);
    });
  });

  // -------------------------------------------------------------
  // Part 4: People API Sanitization
  // -------------------------------------------------------------
  describe('Part 4: People API Sanitization', () => {
    it('omits email and phone for executive on GET /api/people list', async () => {
      const res = await request(app)
        .get('/api/people')
        .set('Authorization', `Bearer ${execToken}`);
      expect(res.status).toBe(200);

      const items = res.body.data;
      expect(items.length).toBeGreaterThan(0);

      for (const p of items) {
        expect(p.email).toBeUndefined();
        expect(p.phone).toBeUndefined();
      }
    });

    it('omits email and phone for executive on GET /api/people/:id', async () => {
      const res = await request(app)
        .get(`/api/people/${memberUser._id}`)
        .set('Authorization', `Bearer ${execToken}`);
      expect(res.status).toBe(200);

      const person = res.body.data;
      expect(person.name).toBe(memberUser.name);
      expect(person.email).toBeUndefined();
      expect(person.phone).toBeUndefined();

      // Ensure nested reportsToIds are also sanitized
      if (Array.isArray(person.reportsToIds)) {
        for (const rep of person.reportsToIds) {
          if (typeof rep === 'object' && rep !== null) {
            expect(rep.email).toBeUndefined();
            expect(rep.phone).toBeUndefined();
          }
        }
      }
    });

    it('includes email and phone for admin users on GET /api/people', async () => {
      const res = await request(app)
        .get(`/api/people/${memberUser._id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe(memberUser.email);
    });
  });

  // -------------------------------------------------------------
  // Part 5: Candidate Pools & Workload Exclusion
  // -------------------------------------------------------------
  describe('Part 5: Candidate Pools & Workload Exclusion', () => {
    it('excludes executive from getAssignmentCandidates', async () => {
      const candidates = await peopleService.getAssignmentCandidates({
        departmentId: testDept._id,
        profileId: profileAlpha._id,
        workType: 'Ad Creative',
      });

      const candidateIds = candidates.map((c) => c._id.toString());
      expect(candidateIds).not.toContain(execUser._id.toString());
      expect(candidateIds).not.toContain(execRestrictedUser._id.toString());
      expect(candidateIds).not.toContain(adminUser._id.toString());
    });

    it('excludes executive from getTeamWorkload report', async () => {
      const workload = await assignmentService.getTeamWorkload({}, adminUser);
      const allMembers = workload.departments.flatMap((d) => d.members);
      const memberIds = allMembers.map((m) => m.person._id.toString());
      expect(memberIds).not.toContain(execUser._id.toString());
      expect(memberIds).not.toContain(execRestrictedUser._id.toString());
      expect(memberIds).not.toContain(adminUser._id.toString());
    });
  });

  // -------------------------------------------------------------
  // Part 6: Grant & Approval Security Guards
  // -------------------------------------------------------------
  describe('Part 6: Grant & Approval Security Guards', () => {
    it('public request-access with requestedRole executive returns 400', async () => {
      const res = await request(app)
        .post('/api/auth/request-access')
        .send({
          name: 'Applicant Exec',
          email: 'applicant.exec@exec-test.com',
          phone: '+91 99999 55555',
          department: 'Executive Board',
          jobRole: 'Managing Director',
          requestedRole: 'executive',
          requestedProfileCodes: ['haca'],
          reason: 'Requesting executive portal view credentials',
        });

      expect(res.status).toBe(400);
    });

    it('Marketing Head CANNOT modify executive accounts', async () => {
      await expect(
        peopleService.updatePerson(
          execUser._id,
          { weeklyCapacityHours: 30 },
          headUser
        )
      ).rejects.toThrow(/Marketing Head cannot modify executive accounts/);
    });

    it('Marketing Head CANNOT approve access requests with executive role', async () => {
      const req = await AccessRequest.create({
        name: 'Pending Exec Applicant',
        email: 'applicant.pending@exec-test.com',
        phone: '+91 99999 44444',
        department: 'Tech',
        jobRole: 'Director',
        requestedRole: 'team_lead',
        requestedProfileCodes: ['haca'],
        reason: 'Evaluating access',
        status: 'pending',
      });

      // Marketing head tries to assign executive
      const res = await request(app)
        .patch(`/api/admin/access-requests/${req._id}/approve`)
        .set('Authorization', `Bearer ${headToken}`)
        .send({ assignedRole: 'executive' });
      expect(res.status).toBe(403);
    });

    it('Admin CAN successfully create executive person', async () => {
      const newExec = await peopleService.createPerson(
        {
          name: 'Created Executive',
          email: 'created.exec@exec-test.com',
          role: 'executive',
          profileAccess: [profileAlpha._id, profileBeta._id],
        },
        adminUser
      );

      expect(newExec).toBeDefined();
      expect(newExec.role).toBe('executive');
      expect(newExec.status).toBe('active');
    });
  });
});
