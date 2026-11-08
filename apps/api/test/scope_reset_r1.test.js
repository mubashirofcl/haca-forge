import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/server.js';
import { Person } from '../src/modules/people/model.js';
import { Department } from '../src/modules/departments/model.js';
import { Profile } from '../src/modules/referenceData/profile.model.js';
import { WorkItem } from '../src/modules/workItems/model.js';
import { env } from '../src/config/env.js';

const makeToken = (user) =>
  jwt.sign(
    { userId: user._id.toString(), role: user.role, email: user.email },
    env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );

describe('SCOPE RESET R1 Verification Suite', () => {
  let adminUser, leadUser, memberUser;
  let adminToken, leadToken;
  let profileHaca, testDept;
  let testWorkItem;

  beforeAll(async () => {
    const mongoUri =
      process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/marketing_portal_test';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }

    await WorkItem.deleteMany({ title: /R1 Test/i });
    await Person.deleteMany({ email: /@r1-verify\.com$/ });
    await Profile.deleteMany({ $or: [{ name: 'HACA' }, { code: 'haca' }] });
    await Department.deleteMany({ code: 'r1_creative' });

    profileHaca = await Profile.create({
      name: 'HACA',
      code: 'haca',
      active: true,
    });

    testDept = await Department.create({
      name: 'R1 Creative Dept',
      code: 'r1_creative',
      isActive: true,
    });

    adminUser = await Person.create({
      name: 'R1 Admin',
      email: 'admin@r1-verify.com',
      role: 'admin',
      status: 'active',
      profileAccess: [profileHaca._id],
    });

    leadUser = await Person.create({
      name: 'R1 SM Manager',
      email: 'lead@r1-verify.com',
      role: 'sm_manager',
      jobRole: 'Social Media Manager',
      departmentId: testDept._id,
      status: 'active',
      profileAccess: [profileHaca._id],
    });

    memberUser = await Person.create({
      name: 'R1 Team Member',
      email: 'member@r1-verify.com',
      role: 'team_member',
      departmentId: testDept._id,
      reportsToIds: [leadUser._id],
      status: 'active',
      profileAccess: [profileHaca._id],
    });

    adminToken = makeToken(adminUser);
    leadToken = makeToken(leadUser);

  });

  afterAll(async () => {
    await WorkItem.deleteMany({ title: /R1 Test/i });
    await Person.deleteMany({ email: /@r1-verify\.com$/ });
    await Profile.deleteMany({ code: 'haca' });
    await Department.deleteMany({ code: 'r1_creative' });
  });

  // ---------------------------------------------------------------------------
  // 1. Work items are created without a campaign
  // ---------------------------------------------------------------------------
  describe('1. Work Item Creation Decoupled from Campaigns', () => {
    it('creates a work item without campaignId and defaults to HACA single brand', async () => {
      const res = await request(app)
        .post('/api/work')
        .set('Authorization', `Bearer ${leadToken}`)
        .send({
          title: 'R1 Test: Standalone Creative Deliverable',
          workType: 'Static Post',
          departmentId: testDept._id.toString(),
          ownerId: memberUser._id.toString(),
          deadline: new Date(Date.now() + 86400000 * 2).toISOString(),
          estimatedEffortHrs: 5,
          priority: 'Urgent',
          description: 'A campaign-free deliverable',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      testWorkItem = res.body.data;

      expect(testWorkItem.title).toBe('R1 Test: Standalone Creative Deliverable');
      expect(testWorkItem.campaignId).toBeUndefined();
      expect(testWorkItem.relatedOKR).toBeUndefined();
      expect(testWorkItem.relatedTarget).toBeUndefined();

      // Verify raw database document has no leftover fields
      const rawDoc = await WorkItem.findById(testWorkItem._id).lean();
      expect(rawDoc.campaignId).toBeUndefined();
      expect(rawDoc.relatedOKR).toBeUndefined();
      expect(rawDoc.relatedTarget).toBeUndefined();
      expect(rawDoc.leadsGenerated).toBeUndefined();
      expect(rawDoc.qualifiedLeads).toBeUndefined();
      expect(rawDoc.profileId).toBeUndefined();
    });

    it('creates a work item with omitted departmentId and ownerId (auto-infers department and defaults owner)', async () => {
      const res = await request(app)
        .post('/api/work')
        .set('Authorization', `Bearer ${leadToken}`)
        .send({
          title: 'Quick Create Deliverable (No Dept/Owner Specified)',
          workType: 'Ad Creative',
          deadline: new Date(Date.now() + 86400000 * 3).toISOString(),
          estimatedEffortHrs: 4,
          priority: 'Normal',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Quick Create Deliverable (No Dept/Owner Specified)');
      expect(res.body.data.departmentId).toBeDefined();
      expect(res.body.data.ownerId).toBeDefined();
    });

    it('creates an unassigned work item when ownerId is explicitly null', async () => {
      const res = await request(app)
        .post('/api/work')
        .set('Authorization', `Bearer ${leadToken}`)
        .send({
          title: 'Unassigned Reel Deliverable',
          workType: 'Reel',
          deadline: new Date(Date.now() + 86400000 * 3).toISOString(),
          estimatedEffortHrs: 4,
          priority: 'Normal',
          ownerId: null,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ownerId).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Route-table walk shows no campaign, target, lead or data-center route
  // ---------------------------------------------------------------------------
  describe('2. Route-Table Walk: Removed Endpoints Return 404', () => {
    const removedRoutes = [
      { method: 'get', path: '/api/targets' },
      { method: 'post', path: '/api/targets' },
      { method: 'get', path: '/api/targets/2026-10' },
      { method: 'get', path: '/api/campaigns' },
      { method: 'post', path: '/api/campaigns' },
      { method: 'get', path: '/api/campaigns/507f1f77bcf86cd799439011' },
      { method: 'get', path: '/api/leads' },
      { method: 'get', path: '/api/leads/funnel' },
      { method: 'get', path: '/api/leads/datacenter' },
      { method: 'get', path: '/api/datacenter' },
      { method: 'post', path: '/api/datacenter/sync' },
    ];

    for (const route of removedRoutes) {
      it(`${route.method.toUpperCase()} ${route.path} returns 404 Not Found`, async () => {
        const res = await request(app)
          [route.method](route.path)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({});

        expect(res.status).toBe(404);
      });
    }
  });

  // ---------------------------------------------------------------------------
  // 3. Dashboard, calendar, work list and reports still run
  // ---------------------------------------------------------------------------
  describe('3. Core Operational Suites Functionality', () => {
    it('GET /api/dashboard/overview succeeds and returns 6 canonical sections', async () => {
      const res = await request(app)
        .get('/api/dashboard/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;

      // 6 active sections
      expect(data.kpis).toBeDefined();
      expect(data.priorities).toBeDefined();
      expect(data.creativeStats).toBeDefined();
      expect(data.workload).toBeDefined();
      expect(data.issues).toBeDefined();
      expect(data.recentActivity).toBeDefined();

      // Removed sections must be completely absent
      expect(data.targets).toBeUndefined();
      expect(data.campaigns).toBeUndefined();
      expect(data.leadFunnel).toBeUndefined();
    });

    it('GET /api/work/calendar succeeds and returns calendar deliverables', async () => {
      const res = await request(app)
        .get('/api/work/calendar')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /api/work succeeds and returns work items list', async () => {
      const res = await request(app)
        .get('/api/work')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/reports/overview succeeds (live reports; definitions removed in Phase 7)', async () => {
      const res = await request(app).get('/api/reports/overview').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      const gone = await request(app).get('/api/reports/definitions').set('Authorization', `Bearer ${adminToken}`);
      expect(gone.status).toBe(404);
    });
  });
});

