import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/server.js';
import {
  ROLE_KEYS,
  ROLE_LABELS,
  PERMISSION_KEYS,
  ROLE_PERMISSIONS,
  REQUESTABLE_ROLES,
} from '@mmp/shared';
import { defineAbilityForUser } from '../src/lib/permissions.js';
import { resolveScope } from '../src/lib/scope.js';
import { Person } from '../src/modules/people/model.js';
import { Profile } from '../src/modules/referenceData/profile.model.js';
import { Department } from '../src/modules/departments/model.js';
import { WorkItem } from '../src/modules/workItems/model.js';
import { AccessRequest } from '../src/modules/access/model.js';
import { CalendarPlan } from '../src/modules/calendar/plan.model.js';
import * as peopleService from '../src/modules/people/service.js';
import * as transitionService from '../src/modules/workItems/transition.service.js';
import * as accessService from '../src/modules/access/service.js';
import { runRoleMigrationR2 } from '../../../scripts/migrate-roles-r2.js';
import { env } from '../src/config/env.js';

const makeToken = (user) =>
  jwt.sign(
    { userId: user._id.toString(), role: user.role, email: user.email },
    env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );

describe('SCOPE RESET R2: Role Model Change & Permissions Verification Suite', () => {
  let adminUser, headUser, execUser, smUser, memberUser, otherMemberUser;
  let adminToken, headToken, execToken, smToken, memberToken, otherMemberToken;
  let profileHaca, deptCreative;
  let memberWorkItem, otherWorkItem, testCalEntry;
  let backupColName;

  beforeAll(async () => {
    const mongoUri =
      process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/marketing_portal_test';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }

    // Clean test records
    await Person.deleteMany({ email: /@r2-test\.com$/ });
    await Profile.deleteMany({ code: 'r2_haca' });
    await Department.deleteMany({ code: 'r2_creative' });
    await WorkItem.deleteMany({ title: /R2 Deliverable/i });
    await AccessRequest.deleteMany({ email: /@r2-test\.com$/ });

    // Seed Profile & Department
    profileHaca = await Profile.create({
      name: 'HACA R2 Brand',
      code: 'r2_haca',
      active: true,
    });

    deptCreative = await Department.create({
      name: 'Creative Production',
      code: 'r2_creative',
      isActive: true,
    });

    // Seed the 5 Canonical Roles
    adminUser = await Person.create({
      name: 'R2 Admin',
      email: 'admin@r2-test.com',
      role: 'admin',
      status: 'active',
      profileAccess: [profileHaca._id],
    });

    headUser = await Person.create({
      name: 'R2 Creative Head',
      email: 'head@r2-test.com',
      role: 'creative_head',
      status: 'active',
      profileAccess: [profileHaca._id],
      weeklyCapacityHours: 40,
    });

    execUser = await Person.create({
      name: 'R2 Executive',
      email: 'exec@r2-test.com',
      role: 'executive',
      status: 'active',
      profileAccess: [profileHaca._id],
    });

    smUser = await Person.create({
      name: 'R2 SM Manager',
      email: 'sm@r2-test.com',
      role: 'sm_manager',
      jobRole: 'Social Media Manager',
      departmentId: deptCreative._id,
      status: 'active',
      profileAccess: [profileHaca._id],
      weeklyCapacityHours: 40,
    });

    memberUser = await Person.create({
      name: 'R2 Member Alice',
      email: 'alice@r2-test.com',
      role: 'team_member',
      jobRole: 'UI Designer',
      departmentId: deptCreative._id,
      status: 'active',
      profileAccess: [profileHaca._id],
      weeklyCapacityHours: 40,
    });

    otherMemberUser = await Person.create({
      name: 'R2 Member Bob',
      email: 'bob@r2-test.com',
      role: 'team_member',
      jobRole: 'Video Editor',
      departmentId: deptCreative._id,
      status: 'active',
      profileAccess: [profileHaca._id],
      weeklyCapacityHours: 40,
    });

    adminToken = makeToken(adminUser);
    headToken = makeToken(headUser);
    execToken = makeToken(execUser);
    smToken = makeToken(smUser);
    memberToken = makeToken(memberUser);
    otherMemberToken = makeToken(otherMemberUser);

    // Seed work items for approval & transition tests
    memberWorkItem = await WorkItem.create({
      title: 'R2 Deliverable Alice Script',
      workType: 'Post',
      stageKey: 'Script',
      profileId: profileHaca._id,
      departmentId: deptCreative._id,
      ownerId: memberUser._id,
      deadline: new Date(Date.now() + 5 * 86400000),
      estimatedEffortHrs: 4,
      status: 'Pending',
      revisions: 0,
      createdBy: smUser._id,
    });

    otherWorkItem = await WorkItem.create({
      title: 'R2 Deliverable Bob Edit',
      workType: 'Reel',
      stageKey: 'Edit',
      profileId: profileHaca._id,
      departmentId: deptCreative._id,
      ownerId: otherMemberUser._id,
      deadline: new Date(Date.now() + 5 * 86400000),
      estimatedEffortHrs: 6,
      status: 'In Progress',
      revisions: 0,
      createdBy: smUser._id,
    });

    await CalendarPlan.deleteMany({ title: /R2 Plan/i });
    testCalEntry = await CalendarPlan.create({
      code: 'R2-PLAN-001',
      title: 'R2 Plan Row Reel',
      kind: 'monthly',
      periodStart: new Date(),
      periodEnd: new Date(Date.now() + 30 * 86400000),
      profileId: profileHaca._id,
      createdById: smUser._id,
      submittedAt: new Date(),
    });
  });

  afterAll(async () => {
    await Person.deleteMany({ email: /@r2-test\.com$/ });
    await Profile.deleteMany({ code: 'r2_haca' });
    await Department.deleteMany({ code: 'r2_creative' });
    await WorkItem.deleteMany({ title: /R2 Deliverable/i });
    await AccessRequest.deleteMany({ email: /@r2-test\.com$/ });
  });

  // =========================================================================
  // TASK 1 & 2: Permission Map Snapshot for the Five Roles
  // =========================================================================
  describe('1. Permission Map Snapshot & Canonical Contracts', () => {
    it('defines exactly the 5 canonical roles in ROLE_KEYS', () => {
      expect(ROLE_KEYS).toEqual(['admin', 'creative_head', 'executive', 'sm_manager', 'team_member']);
    });

    it('exports ROLE_LABELS with Creative Head and SM Manager', () => {
      expect(ROLE_LABELS.creative_head).toBe('Creative Head');
      expect(ROLE_LABELS.sm_manager).toBe('SM Manager');
      expect(ROLE_LABELS.executive).toBe('Executive');
      expect(ROLE_LABELS.team_member).toBe('Team Member');
    });

    it('PERMISSION_KEYS contains calendar.plan and calendar.approve, and deleted reference.manage', () => {
      expect(PERMISSION_KEYS).toContain('calendar.plan');
      expect(PERMISSION_KEYS).toContain('calendar.approve');
      expect(PERMISSION_KEYS).not.toContain('reference.manage');
      expect(PERMISSION_KEYS).not.toContain('target.view');
      expect(PERMISSION_KEYS).not.toContain('campaign.view');
      expect(PERMISSION_KEYS).not.toContain('lead.view');
    });

    it('admin role derives all keys dynamically from PERMISSION_KEYS', () => {
      expect(ROLE_PERMISSIONS.admin).toEqual([...PERMISSION_KEYS]);
      expect(ROLE_PERMISSIONS.admin).toContain('calendar.plan');
      expect(ROLE_PERMISSIONS.admin).toContain('calendar.approve');
      expect(ROLE_PERMISSIONS.admin).toContain('portal.view');
      expect(ROLE_PERMISSIONS.admin).toContain('people.view');
      expect(ROLE_PERMISSIONS.admin).toContain('people.assign');
      expect(ROLE_PERMISSIONS.admin).toContain('user.manage');
      expect(ROLE_PERMISSIONS.admin).toContain('user.approve');
    });

    it('creative_head role has exact 13 authoritative creative & people ops keys', () => {
      const expectedKeys = [
        'portal.view',
        'people.view',
        'people.assign',
        'calendar.approve',
        'feedback.give',
        'feedback.respond',
        'revision.classify',
        'assignment.override',
        'work.update.own',
        'analytics.team',
        'report.view',
        'report.configure',
        'automation.manage',
      ];
      expect(ROLE_PERMISSIONS.creative_head).toEqual(expectedKeys);
      expect(ROLE_PERMISSIONS.creative_head).not.toContain('calendar.plan');
      expect(ROLE_PERMISSIONS.creative_head).not.toContain('work.create');
      expect(ROLE_PERMISSIONS.creative_head).not.toContain('user.manage');
      expect(ROLE_PERMISSIONS.creative_head).not.toContain('user.approve');
    });

    it('sm_manager role has exact 8 operational planning and tracking keys', () => {
      const expectedKeys = [
        'calendar.plan',
        'work.create',
        'assignment.override',
        'work.update.own',
        'feedback.respond',
        'analytics.team',
        'report.view',
        'people.view',
      ];
      expect(ROLE_PERMISSIONS.sm_manager).toEqual(expectedKeys);
      expect(ROLE_PERMISSIONS.sm_manager).not.toContain('calendar.approve');
      expect(ROLE_PERMISSIONS.sm_manager).not.toContain('people.assign');
      expect(ROLE_PERMISSIONS.sm_manager).not.toContain('feedback.give');
      expect(ROLE_PERMISSIONS.sm_manager).not.toContain('revision.classify');
      expect(ROLE_PERMISSIONS.sm_manager).not.toContain('report.configure');
      expect(ROLE_PERMISSIONS.sm_manager).not.toContain('automation.manage');
      expect(ROLE_PERMISSIONS.sm_manager).not.toContain('user.manage');
    });

    it('executive role has exact 4 read-only keys with zero write keys', () => {
      const expectedKeys = ['portal.view', 'people.view', 'analytics.team', 'report.view'];
      expect(ROLE_PERMISSIONS.executive).toEqual(expectedKeys);
      expect(ROLE_PERMISSIONS.executive).not.toContain('work.create');
      expect(ROLE_PERMISSIONS.executive).not.toContain('work.update.own');
      expect(ROLE_PERMISSIONS.executive).not.toContain('assignment.override');
      expect(ROLE_PERMISSIONS.executive).not.toContain('calendar.plan');
      expect(ROLE_PERMISSIONS.executive).not.toContain('calendar.approve');
      expect(ROLE_PERMISSIONS.executive).not.toContain('feedback.give');
      expect(ROLE_PERMISSIONS.executive).not.toContain('feedback.respond');
    });

    it('team_member role has exact 3 personal contributor keys', () => {
      const expectedKeys = ['work.update.own', 'work.request', 'feedback.respond'];
      expect(ROLE_PERMISSIONS.team_member).toEqual(expectedKeys);
      expect(ROLE_PERMISSIONS.team_member).not.toContain('portal.view');
      expect(ROLE_PERMISSIONS.team_member).not.toContain('people.view');
      expect(ROLE_PERMISSIONS.team_member).not.toContain('calendar.plan');
      expect(ROLE_PERMISSIONS.team_member).not.toContain('calendar.approve');
      expect(ROLE_PERMISSIONS.team_member).not.toContain('work.create');
      expect(ROLE_PERMISSIONS.team_member).not.toContain('feedback.give');
    });
  });

  // =========================================================================
  // TASK 3: Scoping (resolveScope) & Navigation
  // =========================================================================
  describe('2. resolveScope across Roles', () => {
    it('admin, creative_head, executive, and sm_manager see all people and all work', async () => {
      for (const user of [adminUser, headUser, execUser, smUser]) {
        const scope = await resolveScope(user);
        expect(scope.isAllowed).toBe(true);
        expect(scope.scopeType).toBe('all');
        expect(scope.allowedPersonIds).toBeNull();
        expect(scope.canAccessPerson(memberUser._id)).toBe(true);
        expect(scope.canAccessPerson(otherMemberUser._id)).toBe(true);
      }
    });

    it('team_member sees self only and cannot access other members', async () => {
      const scope = await resolveScope(memberUser);
      expect(scope.isAllowed).toBe(true);
      expect(scope.scopeType).toBe('self');
      expect(scope.allowedPersonIds).toEqual([memberUser._id.toString()]);
      expect(scope.canAccessPerson(memberUser._id)).toBe(true);
      expect(scope.canAccessPerson(otherMemberUser._id)).toBe(false);
    });

    it('reportsToIds is NOT used to restrict scope for management roles', async () => {
      // Create user with reportsToIds set to admin
      const reportedUser = await Person.create({
        name: 'Reported SM Manager',
        email: 'reported.sm@r2-test.com',
        role: 'sm_manager',
        status: 'active',
        reportsToIds: [adminUser._id],
        profileAccess: [profileHaca._id],
      });

      const scope = await resolveScope(reportedUser);
      expect(scope.scopeType).toBe('all');
      expect(scope.allowedPersonIds).toBeNull();
      await Person.deleteOne({ _id: reportedUser._id });
    });
  });

  // =========================================================================
  // TASK 2 & 4: Route-Table Walk Per Role
  // =========================================================================
  describe('3. Route-Table Walk Per Role', () => {
    describe('A. Executive: 403 on Every Write Mutation', () => {
      it('POST /api/work -> 403', async () => {
        const res = await request(app)
          .post('/api/work')
          .set('Authorization', `Bearer ${execToken}`)
          .send({ title: 'Illegal Exec Work', workType: 'Post' });
        expect(res.status).toBe(403);
      });

      it('PATCH /api/work/:id -> 403', async () => {
        const res = await request(app)
          .patch(`/api/work/${memberWorkItem._id}`)
          .set('Authorization', `Bearer ${execToken}`)
          .send({ title: 'Illegal Edit' });
        expect(res.status).toBe(403);
      });

      it('POST /api/work/:id/transition -> 403', async () => {
        const res = await request(app)
          .post(`/api/work/${memberWorkItem._id}/transition`)
          .set('Authorization', `Bearer ${execToken}`)
          .send({ toStatus: 'In Progress' });
        expect(res.status).toBe(403);
      });

      it('DELETE /api/work/:id -> 403', async () => {
        const res = await request(app)
          .delete(`/api/work/${memberWorkItem._id}`)
          .set('Authorization', `Bearer ${execToken}`);
        expect(res.status).toBe(403);
      });

      it('POST /api/calendar-plans -> 403', async () => {
        const res = await request(app)
          .post('/api/calendar-plans')
          .set('Authorization', `Bearer ${execToken}`)
          .send({ title: 'Exec Plan', kind: 'monthly', profileId: profileHaca._id });
        expect(res.status).toBe(403);
      });

      it('POST /api/calendar-plans/:id/review -> 403', async () => {
        const res = await request(app)
          .post(`/api/calendar-plans/${testCalEntry._id}/review`)
          .set('Authorization', `Bearer ${execToken}`)
          .send({ action: 'approve_all' });
        expect(res.status).toBe(403);
      });

      it('POST /api/feedback/work-item/:id -> 403', async () => {
        const res = await request(app)
          .post(`/api/feedback/work-item/${memberWorkItem._id}`)
          .set('Authorization', `Bearer ${execToken}`)
          .send({ round: 1, text: 'Exec feedback', isResponse: false });
        expect(res.status).toBe(403);
      });

      it('POST /api/revisions/flags/:id/classify -> 403', async () => {
        const res = await request(app)
          .post('/api/revisions/flags/600000000000000000000000/classify')
          .set('Authorization', `Bearer ${execToken}`)
          .send({ rootCause: 'Brief unclear' });
        expect(res.status).toBe(403);
      });

      it('POST /api/people -> 403', async () => {
        const res = await request(app)
          .post('/api/people')
          .set('Authorization', `Bearer ${execToken}`)
          .send({ name: 'Illegal Person', email: 'illegal@r2-test.com', role: 'team_member' });
        expect(res.status).toBe(403);
      });
    });

    describe('B. Team Member: 403 Outside Own Work Items', () => {
      it('GET /api/dashboard/overview -> 403 (Member lands on /my-work, no dashboard access)', async () => {
        const res = await request(app)
          .get('/api/dashboard/overview')
          .set('Authorization', `Bearer ${memberToken}`);
        expect(res.status).toBe(403);
      });

      it('POST /api/work -> 403 (Cannot create raw work items)', async () => {
        const res = await request(app)
          .post('/api/work')
          .set('Authorization', `Bearer ${memberToken}`)
          .send({ title: 'Member Work Item', workType: 'Post' });
        expect(res.status).toBe(403);
      });

      it('POST /api/calendar-plans -> 403 (Cannot create calendar plans)', async () => {
        const res = await request(app)
          .post('/api/calendar-plans')
          .set('Authorization', `Bearer ${memberToken}`)
          .send({ title: 'Member Plan', kind: 'monthly', profileId: profileHaca._id });
        expect(res.status).toBe(403);
      });

      it('POST /api/calendar-plans/:id/review -> 403 (Cannot approve calendar plans)', async () => {
        const res = await request(app)
          .post(`/api/calendar-plans/${testCalEntry._id}/review`)
          .set('Authorization', `Bearer ${memberToken}`)
          .send({ action: 'approve_all' });
        expect(res.status).toBe(403);
      });

      it('POST /api/people -> 403 (Cannot create or manage users)', async () => {
        const res = await request(app)
          .post('/api/people')
          .set('Authorization', `Bearer ${memberToken}`)
          .send({ name: 'Member Friend', email: 'friend@r2-test.com', role: 'team_member' });
        expect(res.status).toBe(403);
      });

      it('POST /api/work/:id/transition -> 403 when updating someone else deliverable', async () => {
        const res = await request(app)
          .post(`/api/work/${otherWorkItem._id}/transition`)
          .set('Authorization', `Bearer ${memberToken}`)
          .send({ toStatus: 'Blocked', blockerReason: 'Waiting for feedback' });
        expect(res.status).toBe(403);
      });
    });

    describe('C. SM Manager: Planning Allowed, Approval Forbidden', () => {
      it('POST /api/calendar-plans -> 201 (Has calendar.plan)', async () => {
        const res = await request(app)
          .post('/api/calendar-plans')
          .set('Authorization', `Bearer ${smToken}`)
          .send({
            title: 'November Social Calendar Plan',
            kind: 'monthly',
            periodStart: new Date(),
            periodEnd: new Date(Date.now() + 30 * 86400000),
            profileId: profileHaca._id,
          });
        expect(res.status).toBe(201);
        expect(res.body.data).toBeDefined();
      });

      it('POST /api/calendar-plans/:id/review -> 403 (Cannot approve calendar plans)', async () => {
        const res = await request(app)
          .post(`/api/calendar-plans/${testCalEntry._id}/review`)
          .set('Authorization', `Bearer ${smToken}`)
          .send({ action: 'approve_all' });
        expect(res.status).toBe(403);
      });

      it('Cannot approve review stage deliverable (403 Forbidden)', async () => {
        await expect(
          transitionService.transitionWorkItem(
            memberWorkItem._id,
            { toStatus: 'Approved' },
            smUser
          )
        ).rejects.toThrow(/Review stages can be approved only by Creative Head and Admin/);
      });

      it('POST /api/people -> 403 (Cannot create users)', async () => {
        const res = await request(app)
          .post('/api/people')
          .set('Authorization', `Bearer ${smToken}`)
          .send({ name: 'New Hire', email: 'hire@r2-test.com', role: 'team_member' });
        expect(res.status).toBe(403);
      });
    });

    describe('D. Creative Head: Approvals Allowed, User/Plan Creation Forbidden', () => {
      it('POST /api/calendar-plans/:id/review -> 200 (Has calendar.approve)', async () => {
        const res = await request(app)
          .post(`/api/calendar-plans/${testCalEntry._id}/review`)
          .set('Authorization', `Bearer ${headToken}`)
          .send({ action: 'approve_all' });
        expect(res.status).toBe(200);
        expect(res.body.data).toBeDefined();
      });

      it('POST /api/calendar-plans -> 403 (Cannot create calendar plans)', async () => {
        const res = await request(app)
          .post('/api/calendar-plans')
          .set('Authorization', `Bearer ${headToken}`)
          .send({ title: 'Creative Head Plan', kind: 'monthly', profileId: profileHaca._id });
        expect(res.status).toBe(403);
      });

      it('POST /api/work -> 403 (Cannot create raw work items)', async () => {
        const res = await request(app)
          .post('/api/work')
          .set('Authorization', `Bearer ${headToken}`)
          .send({ title: 'Creative Work', workType: 'Post' });
        expect(res.status).toBe(403);
      });

      it('POST /api/people -> 403 (Cannot create users)', async () => {
        const res = await request(app)
          .post('/api/people')
          .set('Authorization', `Bearer ${headToken}`)
          .send({ name: 'New Head Member', email: 'headmember@r2-test.com', role: 'team_member' });
        expect(res.status).toBe(403);
      });
    });
  });

  // =========================================================================
  // TASK 4: Approver and Self-Approval Guards
  // =========================================================================
  describe('4. Approver & Self-Approval Guards', () => {
    it('blocks deliverable owner from self-approving review stage', async () => {
      await expect(
        transitionService.transitionWorkItem(
          memberWorkItem._id,
          { toStatus: 'Approved' },
          memberUser
        )
      ).rejects.toThrow(/The owner can never approve their own stage/);
    });

    it('blocks SM Manager from approving review stage', async () => {
      await expect(
        transitionService.transitionWorkItem(
          memberWorkItem._id,
          { toStatus: 'Approved' },
          smUser
        )
      ).rejects.toThrow(/Review stages can be approved only by Creative Head and Admin/);
    });

    it('allows Creative Head to approve review stage deliverable', async () => {
      const approved = await transitionService.transitionWorkItem(
        memberWorkItem._id,
        { toStatus: 'Approved' },
        headUser
      );
      expect(approved.status).toBe('Approved');
    });

    it('allows Admin to approve review stage deliverable', async () => {
      // Move Bob deliverable to Pending
      await WorkItem.updateOne({ _id: otherWorkItem._id }, { $set: { status: 'Pending' } });

      const approved = await transitionService.transitionWorkItem(
        otherWorkItem._id,
        { toStatus: 'Approved' },
        adminUser
      );
      expect(approved.status).toBe('Approved');
    });
  });

  // =========================================================================
  // TASK 4: People Ops Editing Guardrails
  // =========================================================================
  describe('5. People Ops Editing Guardrails', () => {
    it('creative_head can edit departmentId, jobRole, workPreferences, and weeklyCapacityHours of sm_manager and team_member', async () => {
      const updated = await peopleService.updatePerson(
        memberUser._id,
        {
          jobRole: 'UI Designer',
          workPreferences: ['Design'],
          weeklyCapacityHours: 35,
        },
        headUser
      );

      expect(updated.jobRole).toBe('UI Designer');
      expect(updated.weeklyCapacityHours).toBe(35);
      expect(updated.workPreferences).toEqual(['Design']);
    });

    it('creative_head CANNOT modify admin, executive, or other creative_head accounts (403 Forbidden)', async () => {
      // Attempt on admin
      await expect(
        peopleService.updatePerson(adminUser._id, { weeklyCapacityHours: 30 }, headUser)
      ).rejects.toThrow(/Creative Head cannot modify admin, executive, or other creative_head accounts/);

      // Attempt on executive
      await expect(
        peopleService.updatePerson(execUser._id, { weeklyCapacityHours: 30 }, headUser)
      ).rejects.toThrow(/Creative Head cannot modify admin, executive, or other creative_head accounts/);

      // Attempt on other creative_head
      const otherHead = await Person.create({
        name: 'Other Creative Head',
        email: 'otherhead@r2-test.com',
        role: 'creative_head',
        status: 'active',
      });

      await expect(
        peopleService.updatePerson(otherHead._id, { weeklyCapacityHours: 30 }, headUser)
      ).rejects.toThrow(/Creative Head cannot modify admin, executive, or other creative_head accounts/);

      await Person.deleteOne({ _id: otherHead._id });
    });

    it('only admin can grant elevated roles: admin, creative_head, executive', async () => {
      // Head tries to promote member to sm_manager -> rejected
      await expect(
        peopleService.updatePerson(memberUser._id, { role: 'sm_manager' }, headUser)
      ).rejects.toThrow(/Creative Head cannot change user roles/);

      // Admin promotes member to sm_manager -> allowed
      const promoted = await peopleService.updatePerson(
        memberUser._id,
        { role: 'sm_manager' },
        adminUser
      );
      expect(promoted.role).toBe('sm_manager');

      // Reset back to team_member
      await Person.updateOne({ _id: memberUser._id }, { $set: { role: 'team_member' } });
    });
  });

  // =========================================================================
  // TASK 4: Request Access Role Options
  // =========================================================================
  describe('6. Request Access Role Options', () => {
    it('REQUESTABLE_ROLES strictly contains team_member and sm_manager only', () => {
      expect(REQUESTABLE_ROLES).toEqual(['team_member', 'sm_manager']);
    });

    it('accepts public access request with requestedRole team_member or sm_manager', async () => {
      const req1 = await accessService.submitAccessRequest({
        name: 'Applicant Member',
        email: 'applicant.member@r2-test.com',
        phone: '+1 555 111 2222',
        department: 'Creative Production',
        jobRole: 'Writer',
        requestedRole: 'team_member',
        requestedProfileCodes: ['r2_haca'],
        reason: 'Applying as creative writer for HACA campaigns',
      });
      expect(req1.requestedRole).toBe('team_member');

      const req2 = await accessService.submitAccessRequest({
        name: 'Applicant SM Manager',
        email: 'applicant.sm@r2-test.com',
        phone: '+1 555 111 3333',
        department: 'Creative Production',
        jobRole: 'Social Media Manager',
        requestedRole: 'sm_manager',
        requestedProfileCodes: ['r2_haca'],
        reason: 'Applying as operational planner for HACA channels',
      });
      expect(req2.requestedRole).toBe('sm_manager');
    });

    it('rejects public access request with privileged role (admin, creative_head, executive) with 400', async () => {
      for (const role of ['admin', 'creative_head', 'executive']) {
        await expect(
          accessService.submitAccessRequest({
            name: 'Privilege Seeker',
            email: `seeker.${role}@r2-test.com`,
            phone: '+1 555 999 8888',
            department: 'Creative Production',
            jobRole: 'Writer',
            requestedRole: role,
            requestedProfileCodes: ['r2_haca'],
            reason: 'Attempting to self-request elevated role',
          })
        ).rejects.toThrow('Only Team Member or SM Manager can be requested');
      }
    });
  });

  // =========================================================================
  // TASK 5: Migration Script scripts/migrate-roles-r2.js
  // =========================================================================
  describe('7. Migration Script (scripts/migrate-roles-r2.js)', () => {
    let testMigrateUsersCol;

    beforeAll(async () => {
      testMigrateUsersCol = mongoose.connection.db.collection('users');

      // Seed mock legacy users directly in mongo collection
      await testMigrateUsersCol.deleteMany({ email: /@migration-test\.com$/ });

      await testMigrateUsersCol.insertMany([
        {
          name: 'Legacy Marketing Head',
          email: 'head@migration-test.com',
          role: 'marketing_head',
          status: 'active',
          refreshTokenHash: 'hash123',
        },
        {
          name: 'Legacy Creative Manager TL',
          email: 'cm.tl@migration-test.com',
          role: 'team_lead',
          jobRole: 'Creative Manager (TL)',
          status: 'active',
          refreshTokenHash: 'hash456',
        },
        {
          name: 'Legacy Design Lead TL',
          email: 'design.tl@migration-test.com',
          role: 'team_lead',
          jobRole: 'Design Lead (TL)',
          status: 'active',
          refreshTokenHash: 'hash789',
        },
        {
          name: 'Existing Admin',
          email: 'admin@migration-test.com',
          role: 'admin',
          status: 'active',
          refreshTokenHash: 'hashAdmin',
        },
        {
          name: 'Existing Executive',
          email: 'exec@migration-test.com',
          role: 'executive',
          status: 'active',
          refreshTokenHash: 'hashExec',
        },
        {
          name: 'Existing Member',
          email: 'member@migration-test.com',
          role: 'team_member',
          status: 'active',
          refreshTokenHash: 'hashMember',
        },
      ]);
    });

    afterAll(async () => {
      await testMigrateUsersCol.deleteMany({ email: /@migration-test\.com$/ });
      // Clean up any test backup collections created
      const cols = await mongoose.connection.db.listCollections().toArray();
      for (const col of cols) {
        if (col.name.startsWith('users_backup_r2_')) {
          await mongoose.connection.db.collection(col.name).drop();
        }
      }
    });

    it('A. Dry Run by default: identifies planned mutations and makes zero DB changes', async () => {
      const res = await runRoleMigrationR2([], mongoose.connection.db);
      expect(res.mode).toBe('dry-run');

      // Verify users in DB remain with old roles
      const headDoc = await testMigrateUsersCol.findOne({ email: 'head@migration-test.com' });
      expect(headDoc.role).toBe('marketing_head'); // NOT mutated

      const cmDoc = await testMigrateUsersCol.findOne({ email: 'cm.tl@migration-test.com' });
      expect(cmDoc.role).toBe('team_lead'); // NOT mutated

      const designDoc = await testMigrateUsersCol.findOne({ email: 'design.tl@migration-test.com' });
      expect(designDoc.role).toBe('team_lead'); // NOT mutated
    });

    it('B. Refuses mutation if --db-name does not match connected database', async () => {
      await expect(
        runRoleMigrationR2(['--confirm', '--db-name=wrong_db_name'], mongoose.connection.db)
      ).rejects.toThrow(/--db-name is required/i);
    });

    it('C. Confirmed execution: migrates roles, creates backup, and invalidates refresh tokens', async () => {
      const currentDbName = mongoose.connection.db.databaseName;
      const res = await runRoleMigrationR2(
        ['--confirm', `--db-name=${currentDbName}`],
        mongoose.connection.db
      );

      expect(res.mode).toBe('confirmed');
      expect(res.backupCollection).toBeDefined();
      backupColName = res.backupCollection;

      // Check migration outcomes in collection:
      // 1. marketing_head -> creative_head
      const headDoc = await testMigrateUsersCol.findOne({ email: 'head@migration-test.com' });
      expect(headDoc.role).toBe('creative_head');
      expect(headDoc.refreshTokenHash).toBeUndefined(); // Token invalidated

      // 2. team_lead with 'Creative Manager (TL)' -> creative_head
      const cmDoc = await testMigrateUsersCol.findOne({ email: 'cm.tl@migration-test.com' });
      expect(cmDoc.role).toBe('creative_head');
      expect(cmDoc.refreshTokenHash).toBeUndefined();

      // 3. other team_lead -> sm_manager
      const designDoc = await testMigrateUsersCol.findOne({ email: 'design.tl@migration-test.com' });
      expect(designDoc.role).toBe('sm_manager');
      expect(designDoc.refreshTokenHash).toBeUndefined();

      // 4. Admin, Executive, Team Member unchanged
      const adminDoc = await testMigrateUsersCol.findOne({ email: 'admin@migration-test.com' });
      expect(adminDoc.role).toBe('admin');

      const execDoc = await testMigrateUsersCol.findOne({ email: 'exec@migration-test.com' });
      expect(execDoc.role).toBe('executive');

      const memberDoc = await testMigrateUsersCol.findOne({ email: 'member@migration-test.com' });
      expect(memberDoc.role).toBe('team_member');
    });

    it('D. Idempotency: running migration a second time reports 0 pending updates', async () => {
      const currentDbName = mongoose.connection.db.databaseName;
      const res = await runRoleMigrationR2(
        ['--confirm', `--db-name=${currentDbName}`],
        mongoose.connection.db
      );

      expect(res.mode).toBe('confirmed');
      expect(res.updatedCount).toBe(0); // All users already in canonical roles
    });

    it('E. Rollback (--rollback): restores original roles from backup collection', async () => {
      const currentDbName = mongoose.connection.db.databaseName;
      const res = await runRoleMigrationR2(
        ['--rollback', `--db-name=${currentDbName}`, `--backup-col=${backupColName}`],
        mongoose.connection.db
      );

      expect(res.mode).toBe('rollback');
      expect(res.restoredCount).toBeGreaterThanOrEqual(6);

      // Verify original roles restored
      const headDoc = await testMigrateUsersCol.findOne({ email: 'head@migration-test.com' });
      expect(headDoc.role).toBe('marketing_head');

      const cmDoc = await testMigrateUsersCol.findOne({ email: 'cm.tl@migration-test.com' });
      expect(cmDoc.role).toBe('team_lead');

      const designDoc = await testMigrateUsersCol.findOne({ email: 'design.tl@migration-test.com' });
      expect(designDoc.role).toBe('team_lead');
    });
  });
});
