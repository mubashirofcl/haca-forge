import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { app } from '../src/server.js';
import { Person } from '../src/modules/people/model.js';
import { Department } from '../src/modules/departments/model.js';
import { Profile } from '../src/modules/referenceData/profile.model.js';
import { MonthlyTarget } from '../src/modules/targets/model.js';
import { Campaign } from '../src/modules/campaigns/model.js';
import { WorkItem } from '../src/modules/workItems/model.js';
import { AssignmentOverride } from '../src/modules/assignment/model.js';
import { ActivityEvent } from '../src/modules/activity/model.js';
import { recommendAssignee, calculateMemberWorkloadMetrics } from '../src/modules/assignment/service.js';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';

const makeToken = (user) =>
  jwt.sign(
    { userId: user._id.toString(), role: user.role, email: user.email },
    env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );

describe('Phase 4: Auto-Assignment Engine & Team Workload', () => {
  let adminUser, leadUser, memberDesignA, memberDesignB, memberVideoA;
  let adminToken, leadToken, memberToken;
  let profileHaca;
  let deptDesign, deptVideo;
  let testTarget, testCampaign;

  beforeAll(async () => {
    const mongoUri =
      process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/marketing_portal_test';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }

    // Clean test collections
    await AssignmentOverride.deleteMany({});
    await WorkItem.deleteMany({});
    await Campaign.deleteMany({});
    await MonthlyTarget.deleteMany({});
    await ActivityEvent.deleteMany({});
    await Person.deleteMany({ email: /@assignment-test\.com$/ });
    await Department.deleteMany({ code: { $in: ['test_design', 'test_video'] } });
    await Profile.deleteMany({ code: 'test_brand_p4' });

    // Seed Profile
    profileHaca = await Profile.create({
      name: 'Test Brand Phase 4',
      code: 'test_brand_p4',
      active: true,
    });

    // Seed Departments
    deptDesign = await Department.create({
      name: 'Design',
      code: 'test_design',
    });

    deptVideo = await Department.create({
      name: 'Video Production',
      code: 'test_video',
    });

    // Seed Admin
    adminUser = await Person.create({
      name: 'Super Admin P4',
      email: 'admin@assignment-test.com',
      role: 'admin',
      departmentId: deptDesign._id,
      profileAccess: [profileHaca._id],
      status: 'active',
      weeklyCapacityHours: 40,
    });

    // Seed Team Lead
    leadUser = await Person.create({
      name: 'Design Lead P4',
      email: 'lead@assignment-test.com',
      role: 'team_lead',
      jobRole: 'Design Lead (TL)',
      departmentId: deptDesign._id,
      profileAccess: [profileHaca._id],
      status: 'active',
      weeklyCapacityHours: 40,
    });

    // Seed Member Design A (Will have 10h allocated -> 25% workload -> Healthy)
    memberDesignA = await Person.create({
      name: 'Designer Alice',
      email: 'alice@assignment-test.com',
      role: 'team_member',
      jobRole: 'Designer',
      departmentId: deptDesign._id,
      profileAccess: [profileHaca._id],
      reportsToIds: [leadUser._id],
      status: 'active',
      weeklyCapacityHours: 40,
    });

    // Seed Member Design B (Will have 36h allocated -> 90% workload -> Overloaded)
    memberDesignB = await Person.create({
      name: 'Designer Bob',
      email: 'bob@assignment-test.com',
      role: 'team_member',
      jobRole: 'Designer',
      departmentId: deptDesign._id,
      profileAccess: [profileHaca._id],
      reportsToIds: [leadUser._id],
      status: 'active',
      weeklyCapacityHours: 40,
    });

    // Seed Member Video A
    memberVideoA = await Person.create({
      name: 'Editor Charlie',
      email: 'charlie@assignment-test.com',
      role: 'team_member',
      jobRole: 'Video Editor',
      departmentId: deptVideo._id,
      profileAccess: [profileHaca._id],
      status: 'active',
      weeklyCapacityHours: 40,
    });

    // Generate tokens
    adminToken = makeToken(adminUser);
    leadToken = makeToken(leadUser);
    memberToken = makeToken(memberDesignA);

    // Seed Baseline Target & Campaign
    testTarget = await MonthlyTarget.create({
      month: '2026-11',
      profileId: profileHaca._id,
      revenueTarget: 100000,
      leadsTarget: 500,
      qualifiedLeadsTarget: 200,
      budget: 20000,
      createdBy: adminUser._id,
    });

    testCampaign = await Campaign.create({
      name: 'November Admission Sprint P4',
      profileId: profileHaca._id,
      targetId: testTarget._id,
      relatedOKR: 'Increase Q4 qualified admissions by 25%',
      startDate: new Date('2026-11-01'),
      endDate: new Date('2026-11-30'),
      status: 'In Progress',
      goalType: 'Leads',
      expectedOutcome: 'Lead Generation',
      budgetAllocated: 15000,
      ownerId: adminUser._id,
      createdBy: adminUser._id,
    });

    // Seed initial work items for memberDesignA (10h)
    await WorkItem.create({
      campaignId: testCampaign._id,
      profileId: profileHaca._id,
      relatedOKR: testCampaign.relatedOKR,
      relatedTarget: testTarget._id,
      title: 'Alice Task 1',
      workType: 'Ad Creative',
      departmentId: deptDesign._id,
      ownerId: memberDesignA._id,
      deadline: new Date('2026-11-15'),
      estimatedEffortHrs: 10,
      status: 'In Progress',
      priority: 'Medium',
      createdBy: leadUser._id,
    });

    // Seed initial work items for memberDesignB (36h -> Overloaded)
    await WorkItem.create({
      campaignId: testCampaign._id,
      profileId: profileHaca._id,
      relatedOKR: testCampaign.relatedOKR,
      relatedTarget: testTarget._id,
      title: 'Bob Heavy Task 1',
      workType: 'Carousel',
      departmentId: deptDesign._id,
      ownerId: memberDesignB._id,
      deadline: new Date('2026-11-10'),
      estimatedEffortHrs: 20,
      status: 'In Progress',
      priority: 'High',
      createdBy: leadUser._id,
    });

    await WorkItem.create({
      campaignId: testCampaign._id,
      profileId: profileHaca._id,
      relatedOKR: testCampaign.relatedOKR,
      relatedTarget: testTarget._id,
      title: 'Bob Heavy Task 2',
      workType: 'Landing Page',
      departmentId: deptDesign._id,
      ownerId: memberDesignB._id,
      deadline: new Date('2026-11-12'),
      estimatedEffortHrs: 16,
      status: 'In Progress',
      priority: 'Medium',
      createdBy: leadUser._id,
    });
  });

  afterAll(async () => {
    await AssignmentOverride.deleteMany({});
    await WorkItem.deleteMany({});
    await Campaign.deleteMany({});
    await MonthlyTarget.deleteMany({});
    await ActivityEvent.deleteMany({});
    await Person.deleteMany({ email: /@assignment-test\.com$/ });
    await Department.deleteMany({ code: { $in: ['test_design', 'test_video'] } });
    await Profile.deleteMany({ code: 'test_brand_p4' });
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  // ==========================================
  // Part A: Workload Metric Calculation & Capacity Bands
  // ==========================================
  describe('Workload Metric Calculation', () => {
    it('calculates correct workload percentage and Healthy band (<65%) for Alice', async () => {
      const metrics = await calculateMemberWorkloadMetrics(memberDesignA._id);
      expect(metrics.allocatedHours).toBe(10);
      expect(metrics.capacity).toBe(40);
      expect(metrics.workloadPct).toBe(25);
      expect(metrics.capacityBand).toBe('Healthy');
      expect(metrics.availableHours).toBe(30);
    });

    it('calculates correct workload percentage and Overloaded band (>85%) for Bob', async () => {
      const metrics = await calculateMemberWorkloadMetrics(memberDesignB._id);
      expect(metrics.allocatedHours).toBe(36);
      expect(metrics.capacity).toBe(40);
      expect(metrics.workloadPct).toBe(90);
      expect(metrics.capacityBand).toBe('Overloaded');
      expect(metrics.availableHours).toBe(4);
    });

    it('excludes Approved and Published items from active workload', async () => {
      // Create completed item
      await WorkItem.create({
        campaignId: testCampaign._id,
        profileId: profileHaca._id,
        relatedOKR: testCampaign.relatedOKR,
        relatedTarget: testTarget._id,
        title: 'Alice Completed Task',
        workType: 'Ad Creative',
        departmentId: deptDesign._id,
        ownerId: memberDesignA._id,
        deadline: new Date('2026-11-05'),
        estimatedEffortHrs: 15,
        status: 'Approved',
        priority: 'Medium',
        createdBy: leadUser._id,
      });

      const metrics = await calculateMemberWorkloadMetrics(memberDesignA._id);
      expect(metrics.allocatedHours).toBe(10); // Still 10, approved not counted!
      expect(metrics.workloadPct).toBe(25);
    });
  });

  // ==========================================
  // Part B: Auto-Assignment Recommendation Engine
  // ==========================================
  describe('Auto-Assignment Recommendation Engine', () => {
    it('recommends least-loaded candidate in department and provides explainable rationale', async () => {
      const rec = await recommendAssignee(
        {
          departmentId: deptDesign._id.toString(),
          workType: 'Ad Creative',
          profileId: profileHaca._id.toString(),
          estimatedEffortHrs: 6,
        },
        leadUser
      );

      expect(rec.recommendedPerson).toBeDefined();
      expect(rec.recommendedPerson._id.toString()).toBe(memberDesignA._id.toString());
      expect(rec.isOverloadWarning).toBe(false);
      expect(rec.rationale).toContain('Designer Alice');
      expect(rec.rationale).toContain('lowest current workload (25%)');
      expect(rec.rationale).toContain('available bandwidth');
    });

    it('strictly excludes admin users from candidate recommendation pool', async () => {
      const rec = await recommendAssignee(
        {
          departmentId: deptDesign._id.toString(),
          workType: 'Ad Creative',
          profileId: profileHaca._id.toString(),
        },
        leadUser
      );

      const candidateIds = rec.candidatePool.map((c) => c.person._id.toString());
      expect(candidateIds).not.toContain(adminUser._id.toString());
    });

    it('recommends candidate by mapping workType to department when departmentId is omitted', async () => {
      // Map 'Reel' -> video_production
      const rec = await recommendAssignee(
        {
          workType: 'Reel',
          estimatedEffortHrs: 4,
        },
        leadUser
      );

      expect(rec.recommendedPerson).toBeDefined();
    });

    it('flags overload warning when all available candidates are overloaded', async () => {
      // Overload memberDesignA as well
      const tempTask1 = await WorkItem.create({
        campaignId: testCampaign._id,
        profileId: profileHaca._id,
        relatedOKR: testCampaign.relatedOKR,
        relatedTarget: testTarget._id,
        title: 'Alice Overload Task',
        workType: 'Ad Creative',
        departmentId: deptDesign._id,
        ownerId: memberDesignA._id,
        deadline: new Date('2026-11-20'),
        estimatedEffortHrs: 30, // Now 10 + 30 = 40h = 100%
        status: 'In Progress',
        priority: 'High',
        createdBy: leadUser._id,
      });

      // Overload leadUser as well so all candidates in dept are > 85%
      const tempTask2 = await WorkItem.create({
        campaignId: testCampaign._id,
        profileId: profileHaca._id,
        relatedOKR: testCampaign.relatedOKR,
        relatedTarget: testTarget._id,
        title: 'Lead Overload Task',
        workType: 'Ad Creative',
        departmentId: deptDesign._id,
        ownerId: leadUser._id,
        deadline: new Date('2026-11-20'),
        estimatedEffortHrs: 40, // 40h = 100%
        status: 'In Progress',
        priority: 'High',
        createdBy: leadUser._id,
      });

      const rec = await recommendAssignee(
        {
          departmentId: deptDesign._id.toString(),
          workType: 'Ad Creative',
          profileId: profileHaca._id.toString(),
          estimatedEffortHrs: 8,
        },
        leadUser
      );

      expect(rec.isOverloadWarning).toBe(true);
      expect(rec.rationale).toContain('Capacity Warning');

      // Cleanup temp tasks
      await WorkItem.deleteMany({ _id: { $in: [tempTask1._id, tempTask2._id] } });
    });
  });

  // ==========================================
  // Part C: Assignment Override Tracking
  // ==========================================
  describe('Assignment Override Logging', () => {
    it('records an assignment override when choosing someone other than recommendation', async () => {
      // Create work item initially unassigned or with Alice
      const item = await WorkItem.create({
        campaignId: testCampaign._id,
        profileId: profileHaca._id,
        relatedOKR: testCampaign.relatedOKR,
        relatedTarget: testTarget._id,
        title: 'Special VIP Brochure',
        workType: 'Ad Creative',
        departmentId: deptDesign._id,
        ownerId: memberDesignA._id,
        deadline: new Date('2026-11-25'),
        estimatedEffortHrs: 8,
        status: 'Not Started',
        priority: 'High',
        createdBy: leadUser._id,
      });

      const res = await request(app)
        .post('/api/assignment/override')
        .set('Authorization', `Bearer ${leadToken}`)
        .send({
          workItemId: item._id.toString(),
          recommendedPersonId: memberDesignA._id.toString(),
          chosenPersonId: memberDesignB._id.toString(),
          reason: 'Bob has specialized luxury branding expertise required for this VIP brochure',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.chosenPersonId.toString()).toBe(memberDesignB._id.toString());
      expect(res.body.data.overriddenById.toString()).toBe(leadUser._id.toString());

      // Verify workItem owner updated
      const updatedItem = await WorkItem.findById(item._id);
      expect(updatedItem.ownerId.toString()).toBe(memberDesignB._id.toString());

      // Verify ActivityEvent logged
      const activity = await ActivityEvent.findOne({
        action: 'assignment.overridden',
      });
      expect(activity).toBeDefined();
      expect(activity.metadata.fromPersonId.toString()).toBe(memberDesignA._id.toString());
      expect(activity.metadata.toPersonId.toString()).toBe(memberDesignB._id.toString());
    });

    it('rejects assignment override from unauthorized team member without permission', async () => {
      const res = await request(app)
        .post('/api/assignment/override')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          workItemId: new mongoose.Types.ObjectId().toString(),
          recommendedPersonId: memberDesignA._id.toString(),
          chosenPersonId: memberDesignB._id.toString(),
          reason: 'Unauthorized attempt',
        });

      expect(res.status).toBe(403);
    });

    it('lists historical overrides via GET /api/assignment/overrides', async () => {
      const res = await request(app)
        .get('/api/assignment/overrides')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].reason).toContain('luxury branding');
    });
  });

  // ==========================================
  // Part D: Team Workload Aggregation Endpoint
  // ==========================================
  describe('GET /api/workload (Team Workload Monitor)', () => {
    it('returns structured department groupings with capacity metrics and bands', async () => {
      const res = await request(app)
        .get('/api/workload')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.summary).toBeDefined();
      expect(res.body.data.summary.totalMembers).toBeGreaterThan(0);
      expect(res.body.data.summary.overallAvgWorkload).toBeDefined();

      const depts = res.body.data.departments;
      expect(Array.isArray(depts)).toBe(true);

      const designDept = depts.find((d) => d._id.toString() === deptDesign._id.toString());
      expect(designDept).toBeDefined();
      expect(designDept.totalMembers).toBeGreaterThanOrEqual(2);
      expect(designDept.bandCounts.overloaded).toBeGreaterThanOrEqual(1); // Bob is overloaded
    });

    it('filters team workload by departmentId query param', async () => {
      const res = await request(app)
        .get(`/api/workload?departmentId=${deptVideo._id.toString()}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const depts = res.body.data.departments;
      expect(depts.length).toBe(1);
      expect(depts[0]._id.toString()).toBe(deptVideo._id.toString());
    });

    it('allows Team Lead to view their team workload', async () => {
      const res = await request(app)
        .get('/api/workload')
        .set('Authorization', `Bearer ${leadToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.departments).toBeDefined();
    });
  });
});
