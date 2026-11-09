import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { app } from '../src/server.js';
import { env } from '../src/config/env.js';
import { Person } from '../src/modules/people/model.js';
import { Department } from '../src/modules/departments/model.js';
import { CalendarPlan } from '../src/modules/calendar/plan.model.js';
import { ContentPiece } from '../src/modules/calendar/contentPiece.model.js';
import { WorkItem } from '../src/modules/workItems/model.js';
import { ActivityEvent } from '../src/modules/activity/model.js';
import { connectDB } from '../src/config/db.js';
import {
  CALENDAR_KEYS,
  CALENDAR_LIST,
  getCalendarDefinition,
} from '@mmp/shared';
import {
  checkPlanPeriodConstraints,
  getDefaultPlanTitle,
} from '../src/modules/calendar/plan.service.js';

describe('CREATIVE CALENDAR AND MULTIPLE CALENDARS SUITE', () => {
  let smUser, headUser, adminUser, workerUser;
  let smToken, headToken, adminToken, workerToken;
  let testDept;

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

    testDept = await Department.findOne({
      $or: [{ code: 'multical_test_dept' }, { name: 'MultiCal Testing Dept' }],
    });
    if (!testDept) {
      testDept = await Department.create({
        name: 'MultiCal Testing Dept',
        code: 'multical_test_dept',
        status: 'active',
      });
    }

    await Person.deleteMany({ email: /@multical-test\.com$/ });
    await CalendarPlan.deleteMany({ title: /MultiCalTest/ });
    await ContentPiece.deleteMany({ topic: /MultiCalTest/ });
    await WorkItem.deleteMany({ title: /MultiCalTest/ });
    await ActivityEvent.deleteMany({ 'entity.title': /MultiCalTest/ });

    smUser = await Person.create({
      name: 'SM Manager MultiCal',
      email: 'sm@multical-test.com',
      role: 'sm_manager',
      status: 'active',
      passwordHash: 'dummy',
    });

    headUser = await Person.create({
      name: 'Creative Head MultiCal',
      email: 'head@multical-test.com',
      role: 'creative_head',
      status: 'active',
      passwordHash: 'dummy',
    });

    adminUser = await Person.create({
      name: 'Admin MultiCal',
      email: 'admin@multical-test.com',
      role: 'admin',
      status: 'active',
      passwordHash: 'dummy',
    });

    workerUser = await Person.create({
      name: 'Worker MultiCal',
      email: 'worker@multical-test.com',
      role: 'team_member',
      status: 'active',
      passwordHash: 'dummy',
    });

    smToken = makeToken(smUser);
    headToken = makeToken(headUser);
    adminToken = makeToken(adminUser);
    workerToken = makeToken(workerUser);
  });

  afterAll(async () => {
    await Person.deleteMany({ email: /@multical-test\.com$/ });
    await CalendarPlan.deleteMany({ title: /MultiCalTest/ });
    await ContentPiece.deleteMany({ topic: /MultiCalTest/ });
    await WorkItem.deleteMany({ title: /MultiCalTest/ });
    await ActivityEvent.deleteMany({ 'entity.title': /MultiCalTest/ });
  });

  describe('1. Calendar Definition and Default Titles', () => {
    it('should have the five canonical calendars defined with colors', () => {
      expect(CALENDAR_KEYS).toEqual(['sm', 'sales', 'ads', 'academics_management', 'other']);
      expect(CALENDAR_LIST).toHaveLength(5);

      const smDef = getCalendarDefinition('sm');
      expect(smDef.name).toBe('SM Calendar');
      expect(smDef.color).toBe('#7a6af6');

      const salesDef = getCalendarDefinition('sales');
      expect(salesDef.name).toBe('Sales Calendar');
      expect(salesDef.color).toBe('#10b981');

      const adsDef = getCalendarDefinition('ads');
      expect(adsDef.name).toBe('Ads Calendar');
      expect(adsDef.color).toBe('#f59e0b');

      const acDef = getCalendarDefinition('academics_management');
      expect(acDef.name).toBe('Academics & Management Calendar');
      expect(acDef.color).toBe('#0284c7');

      const otherDef = getCalendarDefinition('other');
      expect(otherDef.name).toBe('Other');
      expect(otherDef.color).toBe('#64748b');
    });

    it('getDefaultPlanTitle should generate <Calendar> <Month Year>', () => {
      const novDate = new Date('2026-11-01T00:00:00Z');
      expect(getDefaultPlanTitle(novDate, 'sales')).toBe('Sales Calendar November 2026');
      expect(getDefaultPlanTitle(novDate, 'sm')).toBe('SM Calendar November 2026');
      expect(getDefaultPlanTitle(novDate, 'ads')).toBe('Ads Calendar November 2026');
    });
  });

  describe('2. Overlap and Exact Duplicate Checking per Calendar', () => {
    it('exact duplicate monthly plan in the same calendar is blocked (EXACT_DUPLICATE_PERIOD)', async () => {
      await CalendarPlan.create({
        code: 'MC-SALES-NOV-A',
        title: 'MultiCalTest Sales Nov 2026 A',
        kind: 'monthly',
        calendar: 'sales',
        periodStart: new Date('2026-11-01T00:00:00Z'),
        periodEnd: new Date('2026-11-30T23:59:59Z'),
        status: 'Draft',
        createdById: smUser._id,
      });

      // Checking constraints for exact duplicate on same calendar 'sales'
      let duplicateError;
      try {
        await checkPlanPeriodConstraints({
          kind: 'monthly',
          periodStart: new Date('2026-11-01T00:00:00Z'),
          periodEnd: new Date('2026-11-30T23:59:59Z'),
          calendar: 'sales',
        });
      } catch (err) {
        duplicateError = err;
      }
      expect(duplicateError).toBeDefined();
      expect(duplicateError.code).toBe('EXACT_DUPLICATE_PERIOD');

      // But on a DIFFERENT calendar ('ads'), the exact same month is allowed!
      const checkDiffCal = await checkPlanPeriodConstraints({
        kind: 'monthly',
        periodStart: new Date('2026-11-01T00:00:00Z'),
        periodEnd: new Date('2026-11-30T23:59:59Z'),
        calendar: 'ads',
      });
      expect(checkDiffCal.warnings).toEqual([]);

      // Attempting to create duplicate via API should fail with 400
      const res = await request(app)
        .post('/api/calendar-plans')
        .set('Authorization', `Bearer ${smToken}`)
        .send({
          title: 'MultiCalTest Sales Nov 2026 Duplicate',
          kind: 'monthly',
          calendar: 'sales',
          periodStart: '2026-11-01',
          periodEnd: '2026-11-30',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('EXACT_DUPLICATE_PERIOD');
    });

    it('distinct calendars can have monthly plans in the same period without conflict', async () => {
      const resAds = await request(app)
        .post('/api/calendar-plans')
        .set('Authorization', `Bearer ${smToken}`)
        .send({
          title: 'MultiCalTest Ads Nov 2026',
          kind: 'monthly',
          calendar: 'ads',
          periodStart: '2026-11-01',
          periodEnd: '2026-11-30',
        });

      expect(resAds.status).toBe(201);
      expect(resAds.body.data.calendar).toBe('ads');
    });
  });

  describe('3. Individual Work Creation and Calendar Assignment', () => {
    it('creates an individual work plan with rows inheriting the chosen calendar', async () => {
      const res = await request(app)
        .post('/api/calendar-plans')
        .set('Authorization', `Bearer ${smToken}`)
        .send({
          title: 'MultiCalTest Academics Individual Work',
          kind: 'individual',
          calendar: 'academics_management',
          periodStart: '2026-11-15',
          periodEnd: '2026-11-15',
          rows: [
            {
              topic: 'MultiCalTest Faculty Spotlight',
              type: 'Static Post',
              postingDate: '2026-11-15',
              brief: 'Interview snippet with professor',
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.kind).toBe('individual');
      expect(res.body.data.calendar).toBe('academics_management');

      // Verify created ContentPiece has matching calendar
      const pieces = await ContentPiece.find({ planId: res.body.data._id });
      expect(pieces).toHaveLength(1);
      expect(pieces[0].calendar).toBe('academics_management');
    });
  });

  describe('4. Moving Plan Calendar: Permissions & Notification', () => {
    let draftPlan, approvedPlan;

    beforeAll(async () => {
      draftPlan = await CalendarPlan.create({
        code: 'MC-MOVE-DRAFT',
        title: 'MultiCalTest Move Draft Plan',
        kind: 'individual',
        calendar: 'other',
        periodStart: new Date('2026-11-20'),
        periodEnd: new Date('2026-11-20'),
        status: 'Draft',
        createdById: smUser._id,
      });

      approvedPlan = await CalendarPlan.create({
        code: 'MC-MOVE-APPR',
        title: 'MultiCalTest Move Approved Plan',
        kind: 'individual',
        calendar: 'sm',
        periodStart: new Date('2026-11-22'),
        periodEnd: new Date('2026-11-22'),
        status: 'Approved',
        createdById: smUser._id,
      });
    });

    it('allows moving calendar while plan is in Draft status', async () => {
      const res = await request(app)
        .patch(`/api/calendar-plans/${draftPlan._id}/calendar`)
        .set('Authorization', `Bearer ${smToken}`)
        .send({ calendar: 'sales' });

      expect(res.status).toBe(200);
      expect(res.body.data.calendar).toBe('sales');

      const updated = await CalendarPlan.findById(draftPlan._id);
      expect(updated.calendar).toBe('sales');
    });

    it('prevents non-sm_manager team member from moving approved plan calendar', async () => {
      const res = await request(app)
        .patch(`/api/calendar-plans/${approvedPlan._id}/calendar`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ calendar: 'ads' });

      expect(res.status).toBe(403);
    });

    it('allows SM Manager and Admin to move approved plan calendar and logs activity', async () => {
      const res = await request(app)
        .patch(`/api/calendar-plans/${approvedPlan._id}/calendar`)
        .set('Authorization', `Bearer ${smToken}`)
        .send({ calendar: 'ads' });

      expect(res.status).toBe(200);
      expect(res.body.data.calendar).toBe('ads');

      // Check ActivityEvent was logged
      const event = await ActivityEvent.findOne({
        action: 'plan.calendar_moved',
        entityId: approvedPlan._id,
      });
      expect(event).not.toBeNull();
      expect(event.metadata.fromCalendar).toBe('sm');
      expect(event.metadata.toCalendar).toBe('ads');
    });
  });

  describe('5. Calendar Filtering across APIs', () => {
    it('filters /api/calendar-plans by ?calendar=', async () => {
      const res = await request(app)
        .get('/api/calendar-plans?calendar=sales')
        .set('Authorization', `Bearer ${smToken}`);

      expect(res.status).toBe(200);
      const allSales = res.body.data.every((p) => p.calendar === 'sales');
      expect(allSales).toBe(true);
    });

    it('filters /api/content-pieces by ?calendar=', async () => {
      const res = await request(app)
        .get('/api/content-pieces?calendar=ads')
        .set('Authorization', `Bearer ${smToken}`);

      expect(res.status).toBe(200);
      const allAds = res.body.data.every((p) => p.calendar === 'ads');
      expect(allAds).toBe(true);
    });
  });

  describe('6. Worker Stage Item Visibility in Calendar (/api/work/calendar)', () => {
    it('worker sees only stage work items assigned to them in /api/work/calendar', async () => {
      // Create a work item assigned to worker
      const myWorkItem = await WorkItem.create({
        title: 'MultiCalTest Worker Task',
        workType: 'Reel',
        stage: 'edit',
        status: 'In Progress',
        departmentId: testDept._id,
        deadline: new Date('2026-11-25T12:00:00Z'),
        estimatedEffortHrs: 4,
        ownerId: workerUser._id,
        calendar: 'sm',
      });

      // Create a work item assigned to someone else
      const otherWorkItem = await WorkItem.create({
        title: 'MultiCalTest Other Task',
        workType: 'Reel',
        stage: 'shoot',
        status: 'In Progress',
        departmentId: testDept._id,
        deadline: new Date('2026-11-25T12:00:00Z'),
        estimatedEffortHrs: 4,
        ownerId: smUser._id,
        calendar: 'sm',
      });

      const res = await request(app)
        .get('/api/work/calendar?start=2026-11-20T00:00:00Z&end=2026-11-30T00:00:00Z')
        .set('Authorization', `Bearer ${workerToken}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((item) => item._id.toString());
      expect(ids).toContain(myWorkItem._id.toString());
      expect(ids).not.toContain(otherWorkItem._id.toString());
    });
  });
});

