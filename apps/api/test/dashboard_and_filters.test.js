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
import { Blocker } from '../src/modules/blockers/model.js';
import { RevisionFlag } from '../src/modules/feedback/model.js';
import { ActivityEvent } from '../src/modules/activity/model.js';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';

const makeToken = (user) =>
  jwt.sign(
    { userId: user._id.toString(), role: user.role, email: user.email },
    env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );

describe('Phase 6: Global Filter Bar & Team Dashboard (Screen 2)', () => {
  let adminUser, leadUser, memberUser;
  let adminToken, leadToken, memberToken;
  let profileAlpha, profileBeta;
  let deptDesign, deptVideo;
  let targetAlpha, targetBeta;
  let campaignAlpha;
  let workItemAlpha1, workItemAlpha2, workItemBeta;

  const currentMonth = new Date().toISOString().slice(0, 7);

  beforeAll(async () => {
    const mongoUri =
      process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/marketing_portal_test';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }

    // Clean test collections
    await WorkItem.deleteMany({});
    await Campaign.deleteMany({});
    await MonthlyTarget.deleteMany({});
    await Blocker.deleteMany({});
    await RevisionFlag.deleteMany({});
    await ActivityEvent.deleteMany({});
    await Person.deleteMany({ email: /@dashboard-test\.com$/ });
    await Department.deleteMany({ code: { $in: ['test_dash_design', 'test_dash_video'] } });
    await Profile.deleteMany({ code: { $in: ['test_dash_alpha', 'test_dash_beta'] } });

    // Seed 2 Profiles
    profileAlpha = await Profile.create({
      name: 'Brand Alpha P6',
      code: 'test_dash_alpha',
      active: true,
    });

    profileBeta = await Profile.create({
      name: 'Brand Beta P6',
      code: 'test_dash_beta',
      active: true,
    });

    // Seed 2 Departments
    deptDesign = await Department.create({
      name: 'Design P6',
      code: 'test_dash_design',
    });

    deptVideo = await Department.create({
      name: 'Video P6',
      code: 'test_dash_video',
    });

    // Seed Persons
    adminUser = await Person.create({
      name: 'Admin Dashboard User',
      email: 'admin@dashboard-test.com',
      role: 'admin',
      departmentId: deptDesign._id,
      profileAccess: [profileAlpha._id, profileBeta._id],
      status: 'active',
      weeklyCapacityHours: 40,
    });

    leadUser = await Person.create({
      name: 'Design Lead P6',
      email: 'lead@dashboard-test.com',
      role: 'team_lead',
      jobRole: 'Design Lead (TL)',
      departmentId: deptDesign._id,
      profileAccess: [profileAlpha._id],
      status: 'active',
      weeklyCapacityHours: 40,
    });

    memberUser = await Person.create({
      name: 'Designer Member P6',
      email: 'member@dashboard-test.com',
      role: 'team_member',
      jobRole: 'Designer',
      departmentId: deptDesign._id,
      profileAccess: [profileAlpha._id],
      status: 'active',
      weeklyCapacityHours: 40,
    });

    adminToken = makeToken(adminUser);
    leadToken = makeToken(leadUser);
    memberToken = makeToken(memberUser);

    // Seed Targets
    targetAlpha = await MonthlyTarget.create({
      month: currentMonth,
      profileId: profileAlpha._id,
      revenueTarget: 500000,
      leadsTarget: 200,
      qualifiedLeadsTarget: 80,
      budget: 30000,
      createdBy: adminUser._id,
    });

    targetBeta = await MonthlyTarget.create({
      month: currentMonth,
      profileId: profileBeta._id,
      revenueTarget: 300000,
      leadsTarget: 100,
      qualifiedLeadsTarget: 40,
      budget: 15000,
      createdBy: adminUser._id,
    });

    // Seed Campaign
    campaignAlpha = await Campaign.create({
      name: 'Alpha Q4 Growth Sprint',
      profileId: profileAlpha._id,
      departmentId: deptDesign._id,
      targetId: targetAlpha._id,
      startDate: new Date('2026-11-01'),
      endDate: new Date('2026-11-30'),
      goalType: 'Leads',
      expectedOutcome: 'Lead Generation',
      budgetAllocated: 25000,
      relatedOKR: 'Increase organic lead capture',
      status: 'In Progress',
      ownerId: leadUser._id,
      createdBy: adminUser._id,
    });

    // Seed Work Items
    workItemAlpha1 = await WorkItem.create({
      title: 'Alpha Reel Video',
      campaignId: campaignAlpha._id,
      profileId: profileAlpha._id,
      departmentId: deptDesign._id,
      relatedOKR: 'Increase organic lead capture',
      relatedTarget: targetAlpha._id,
      ownerId: memberUser._id,
      workType: 'Reel',
      deadline: new Date(Date.now() - 24 * 3600 * 1000), // Overdue!
      estimatedEffortHrs: 6,
      status: 'In Progress',
      priority: 'High',
      revisions: 1,
      createdBy: leadUser._id,
    });

    workItemAlpha2 = await WorkItem.create({
      title: 'Alpha Carousel Post',
      campaignId: campaignAlpha._id,
      profileId: profileAlpha._id,
      departmentId: deptDesign._id,
      relatedOKR: 'Increase organic lead capture',
      relatedTarget: targetAlpha._id,
      ownerId: memberUser._id,
      workType: 'Carousel',
      deadline: new Date(Date.now() + 2 * 24 * 3600 * 1000),
      estimatedEffortHrs: 4,
      status: 'Approved',
      priority: 'Medium',
      revisions: 0,
      createdBy: leadUser._id,
    });

    workItemBeta = await WorkItem.create({
      title: 'Beta Ad Creative',
      campaignId: campaignAlpha._id,
      profileId: profileBeta._id,
      departmentId: deptVideo._id,
      relatedOKR: 'Increase organic lead capture',
      relatedTarget: targetBeta._id,
      ownerId: adminUser._id,
      workType: 'Ad Creative',
      deadline: new Date(Date.now() + 4 * 24 * 3600 * 1000),
      estimatedEffortHrs: 8,
      status: 'In Progress',
      priority: 'Low',
      revisions: 0,
      createdBy: adminUser._id,
    });

    // Seed Active Blocker on Alpha Reel
    await Blocker.create({
      workItemId: workItemAlpha1._id,
      blockedById: memberUser._id,
      reason: 'Technical issue',
      notes: 'Rendering engine glitch',
      status: 'Active',
      blockedAt: new Date(Date.now() - 3 * 3600 * 1000),
    });

    // Seed Revision Flag
    await RevisionFlag.create({
      workItemId: workItemAlpha1._id,
      ownerId: memberUser._id,
      revisionsCount: 4,
      baselineAvg: 1.0,
      isFlagged: true,
      flaggedAt: new Date(),
    });

    // Seed Activity Event
    await ActivityEvent.create({
      entityType: 'work_item',
      entityId: workItemAlpha1._id,
      profileId: profileAlpha._id,
      actorId: memberUser._id,
      action: 'work_item.status_changed',
      fromStatus: 'Not Started',
      toStatus: 'In Progress',
      timestamp: new Date(),
    });
  });

  afterAll(async () => {
    await WorkItem.deleteMany({});
    await Campaign.deleteMany({});
    await MonthlyTarget.deleteMany({});
    await Blocker.deleteMany({});
    await RevisionFlag.deleteMany({});
    await ActivityEvent.deleteMany({});
    await Person.deleteMany({ email: /@dashboard-test\.com$/ });
    await Department.deleteMany({ code: { $in: ['test_dash_design', 'test_dash_video'] } });
    await Profile.deleteMany({ code: { $in: ['test_dash_alpha', 'test_dash_beta'] } });
  });

  it('GET /api/dashboard/overview returns all 9 sections for authenticated admin', async () => {
    const res = await request(app)
      .get('/api/dashboard/overview')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const d = res.body.data;
    // Verify 9 sections are present
    expect(d.targets).toBeDefined();
    expect(d.kpis).toBeDefined();
    expect(d.priorities).toBeDefined();
    expect(d.creativeStats).toBeDefined();
    expect(d.campaigns).toBeDefined();
    expect(d.workload).toBeDefined();
    expect(d.leadFunnel).toBeDefined();
    expect(d.issues).toBeDefined();
    expect(d.recentActivity).toBeDefined();

    // Verify Section 1: Targets aggregation
    expect(d.targets.targetCount).toBe(2);
    expect(d.targets.revenueTarget).toBe(800000); // 500k + 300k
    expect(d.targets.leadsTarget).toBe(300); // 200 + 100

    // Verify Section 2: KPIs strip
    expect(d.kpis.totalWorkItems).toBe(3);
    expect(d.kpis.inProgress).toBe(2);
    expect(d.kpis.approved).toBe(1);
    expect(d.kpis.overdue).toBe(1); // workItemAlpha1 has passed deadline

    // Verify Section 8: Issues
    expect(d.issues.activeBlockersCount).toBeGreaterThanOrEqual(1);
    expect(d.issues.activeFlagsCount).toBeGreaterThanOrEqual(1);

    // Verify Section 9: Recent Activity
    expect(d.recentActivity.length).toBeGreaterThanOrEqual(1);
  });

  it('updates all 9 widgets simultaneously when changing Profile filter to Brand Alpha', async () => {
    const res = await request(app)
      .get(`/api/dashboard/overview?profileId=${profileAlpha._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const d = res.body.data;

    // Targets strip should only reflect Brand Alpha
    expect(d.targets.targetCount).toBe(1);
    expect(d.targets.revenueTarget).toBe(500000);
    expect(d.targets.leadsTarget).toBe(200);

    // KPIs should only reflect the 2 Brand Alpha items
    expect(d.kpis.totalWorkItems).toBe(2);
    expect(d.kpis.inProgress).toBe(1);
    expect(d.kpis.approved).toBe(1);

    // Priorities list items must all belong to Brand Alpha
    for (const item of d.priorities) {
      expect(item.profileId?._id?.toString() || item.profileId?.toString()).toBe(
        profileAlpha._id.toString()
      );
    }
  });

  it('scopes team member overview to assigned deliverables', async () => {
    const res = await request(app)
      .get('/api/dashboard/overview')
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(200);
    const d = res.body.data;

    // Team member should only see deliverables assigned to them (2 items)
    expect(d.kpis.totalWorkItems).toBe(2);
  });
});
