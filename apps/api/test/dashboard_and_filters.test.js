import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { app } from '../src/server.js';
import { Person } from '../src/modules/people/model.js';
import { Department } from '../src/modules/departments/model.js';
import { Profile } from '../src/modules/referenceData/profile.model.js';
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
      role: 'sm_manager',
      jobRole: 'Social Media Manager',
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

    // Seed Work Items
    workItemAlpha1 = await WorkItem.create({
      title: 'Alpha Reel Video',
      profileId: profileAlpha._id,
      departmentId: deptDesign._id,
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
      profileId: profileAlpha._id,
      departmentId: deptDesign._id,
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
      profileId: profileBeta._id,
      departmentId: deptVideo._id,
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
    await Blocker.deleteMany({});
    await RevisionFlag.deleteMany({});
    await ActivityEvent.deleteMany({});
    await Person.deleteMany({ email: /@dashboard-test\.com$/ });
    await Department.deleteMany({ code: { $in: ['test_dash_design', 'test_dash_video'] } });
    await Profile.deleteMany({ code: { $in: ['test_dash_alpha', 'test_dash_beta'] } });
  });

  it('GET /api/dashboard/overview returns all 6 sections for authenticated admin', async () => {
    const res = await request(app)
      .get('/api/dashboard/overview')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const d = res.body.data;
    // Verify 6 active sections are present
    expect(d.kpis).toBeDefined();
    expect(d.priorities).toBeDefined();
    expect(d.creativeStats).toBeDefined();
    expect(d.workload).toBeDefined();
    expect(d.issues).toBeDefined();
    expect(d.recentActivity).toBeDefined();

    // Verify removed sections are absent
    expect(d.targets).toBeUndefined();
    expect(d.campaigns).toBeUndefined();
    expect(d.leadFunnel).toBeUndefined();

    // Verify KPIs strip
    expect(d.kpis.totalWorkItems).toBe(3);
    expect(d.kpis.inProgress).toBe(2);
    expect(d.kpis.approved).toBe(1);
    expect(d.kpis.overdue).toBe(1); // workItemAlpha1 has passed deadline

    // Verify Issues
    expect(d.issues.activeBlockersCount).toBeGreaterThanOrEqual(1);
    expect(d.issues.activeFlagsCount).toBeGreaterThanOrEqual(1);

    // Verify Recent Activity
    expect(d.recentActivity.length).toBeGreaterThanOrEqual(1);
  });

  it('updates widgets when changing Profile filter to Brand Alpha', async () => {
    const res = await request(app)
      .get(`/api/dashboard/overview?profileId=${profileAlpha._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const d = res.body.data;

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

  it('denies team member access to team dashboard with 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/dashboard/overview')
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(403);
  });
});
