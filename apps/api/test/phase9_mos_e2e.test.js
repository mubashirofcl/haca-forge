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
import { FeedbackEntry, RevisionFlag } from '../src/modules/feedback/model.js';
import { Lead } from '../src/modules/leads/model.js';
import { syncLsqLeads } from '../src/modules/leads/service.js';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';

const makeToken = (user) =>
  jwt.sign(
    { userId: user._id.toString(), role: user.role, email: user.email },
    env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );

describe('Phase 9: Comprehensive Marketing OS End-to-End & Performance Dimensions', () => {
  let adminUser, headUser, tlUser, designerUser, writerUser;
  let headToken, tlToken, designerToken, writerToken;
  let profileHaca, deptDesign, deptContent;
  let createdTarget, createdCampaign, createdWorkItem;

  const currentMonth = new Date().toISOString().slice(0, 7);

  beforeAll(async () => {
    const mongoUri =
      process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/marketing_portal_test';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }

    // Clean test state
    await Lead.deleteMany({});
    await WorkItem.deleteMany({});
    await FeedbackEntry.deleteMany({});
    await RevisionFlag.deleteMany({});
    await Campaign.deleteMany({});
    await MonthlyTarget.deleteMany({});
    await Person.deleteMany({ email: /@e2e-test\.com$/ });
    await Department.deleteMany({ code: { $in: ['e2e_design', 'e2e_content'] } });
    await Profile.deleteMany({ code: 'e2e_haca' });

    // 1. Seed Reference Data
    profileHaca = await Profile.create({
      name: 'E2E HACA Brand',
      code: 'e2e_haca',
      active: true,
    });

    deptDesign = await Department.create({
      name: 'E2E Design',
      code: 'e2e_design',
    });

    deptContent = await Department.create({
      name: 'E2E Content',
      code: 'e2e_content',
    });

    // 2. Seed Actors
    adminUser = await Person.create({
      name: 'E2E Admin User',
      email: 'admin@e2e-test.com',
      role: 'admin',
      jobRole: 'Creative Manager (TL)',
      departmentId: deptDesign._id,
      profileAccess: [profileHaca._id],
      status: 'active',
    });

    headUser = await Person.create({
      name: 'E2E Marketing Head',
      email: 'head@e2e-test.com',
      role: 'marketing_head',
      jobRole: 'Creative Manager (TL)',
      departmentId: deptDesign._id,
      profileAccess: [profileHaca._id],
      status: 'active',
    });

    tlUser = await Person.create({
      name: 'E2E Team Lead',
      email: 'tl@e2e-test.com',
      role: 'team_lead',
      jobRole: 'Design Lead (TL)',
      departmentId: deptDesign._id,
      profileAccess: [profileHaca._id],
      status: 'active',
    });

    designerUser = await Person.create({
      name: 'E2E Senior Designer',
      email: 'designer@e2e-test.com',
      role: 'team_member',
      jobRole: 'Designer',
      departmentId: deptDesign._id,
      profileAccess: [profileHaca._id],
      status: 'active',
    });

    writerUser = await Person.create({
      name: 'E2E Copywriter',
      email: 'writer@e2e-test.com',
      role: 'team_member',
      jobRole: 'Writer',
      departmentId: deptContent._id,
      profileAccess: [profileHaca._id],
      status: 'active',
    });

    headToken = makeToken(headUser);
    tlToken = makeToken(tlUser);
    designerToken = makeToken(designerUser);
    writerToken = makeToken(writerUser);
  });

  afterAll(async () => {
    await Lead.deleteMany({});
    await WorkItem.deleteMany({});
    await FeedbackEntry.deleteMany({});
    await RevisionFlag.deleteMany({});
    await Campaign.deleteMany({});
    await MonthlyTarget.deleteMany({});
    await Person.deleteMany({ email: /@e2e-test\.com$/ });
    await Department.deleteMany({ code: { $in: ['e2e_design', 'e2e_content'] } });
    await Profile.deleteMany({ code: 'e2e_haca' });
  });

  describe('1. Full Lifecycle Workflow: Target → Campaign → WorkItem → Feedback → Blocker', () => {
    it('Step 1: Marketing Head sets Monthly Target for brand profile', async () => {
      const res = await request(app)
        .post('/api/targets')
        .set('Authorization', `Bearer ${headToken}`)
        .send({
          month: currentMonth,
          profileId: profileHaca._id.toString(),
          revenueTarget: 2500000,
          leadsTarget: 600,
          qualifiedLeadsTarget: 180,
          budget: 75000,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.month).toBe(currentMonth);
      expect(res.body.data.budget).toBe(75000);
      createdTarget = res.body.data;
    });

    it('Step 2: Team Lead creates Campaign linked to Monthly Target', async () => {
      const res = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${tlToken}`)
        .send({
          name: 'E2E Brand Launch Sprint',
          profileId: profileHaca._id.toString(),
          targetId: createdTarget._id.toString(),
          departmentId: deptDesign._id.toString(),
          ownerId: tlUser._id.toString(),
          goalType: 'Leads',
          expectedOutcome: 'Lead Generation',
          relatedOKR: 'Scale brand leads through creative ad sets',
          status: 'In Progress',
          budget: 50000,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 14 * 86400000).toISOString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('E2E Brand Launch Sprint');
      expect(res.body.data.status).toBe('In Progress');
      createdCampaign = res.body.data;
    });

    it('Step 3: WorkItem is created and assigned to Senior Designer', async () => {
      const res = await request(app)
        .post('/api/work')
        .set('Authorization', `Bearer ${tlToken}`)
        .send({
          title: 'High-Impact Brand Ad Creative Set',
          workType: 'Ad Creative',
          profileId: profileHaca._id.toString(),
          departmentId: deptDesign._id.toString(),
          campaignId: createdCampaign._id.toString(),
          ownerId: designerUser._id.toString(),
          priority: 'High',
          status: 'In Progress',
          deadline: new Date(Date.now() + 48 * 3600000).toISOString(),
          estimatedEffortHrs: 4,
          relatedOKR: 'High-converting ad sets for brand campaign',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe('High-Impact Brand Ad Creative Set');
      expect(res.body.data.ownerId._id || res.body.data.ownerId).toBe(designerUser._id.toString());
      createdWorkItem = res.body.data;
    });

    it('Step 4: Designer requests feedback and Team Lead approves deliverable', async () => {
      // 1. Move to Feedback
      const reqRes = await request(app)
        .post(`/api/work/${createdWorkItem._id}/transition`)
        .set('Authorization', `Bearer ${designerToken}`)
        .send({ toStatus: 'Feedback' });

      expect(reqRes.status).toBe(200);

      // 2. Team Lead submits feedback entry approving deliverable
      const fbRes = await request(app)
        .post(`/api/feedback/work-item/${createdWorkItem._id}`)
        .set('Authorization', `Bearer ${tlToken}`)
        .send({
          round: 1,
          roundStatus: 'Approved',
          text: 'Flawless typography and visual hierarchy. Approved for publication.',
        });

      expect(fbRes.status).toBe(201);

      // 3. Transition to Approved and then Published
      const appRes = await request(app)
        .post(`/api/work/${createdWorkItem._id}/transition`)
        .set('Authorization', `Bearer ${designerToken}`)
        .send({ toStatus: 'Approved' });

      expect(appRes.status).toBe(200);

      const pubRes = await request(app)
        .post(`/api/work/${createdWorkItem._id}/transition`)
        .set('Authorization', `Bearer ${designerToken}`)
        .send({ toStatus: 'Published' });

      expect(pubRes.status).toBe(200);
      expect(pubRes.body.data.status).toBe('Published');
    });

    it('Step 5: Second deliverable encounters blocker waiting on Copywriter input', async () => {
      // Create deliverable
      const item2Res = await request(app)
        .post('/api/work')
        .set('Authorization', `Bearer ${tlToken}`)
        .send({
          title: 'Brand Showcase Reel',
          workType: 'Reel',
          profileId: profileHaca._id.toString(),
          departmentId: deptDesign._id.toString(),
          campaignId: createdCampaign._id.toString(),
          ownerId: designerUser._id.toString(),
          priority: 'Medium',
          status: 'In Progress',
          deadline: new Date(Date.now() + 24 * 3600000).toISOString(),
          estimatedEffortHrs: 3,
        });

      expect(item2Res.status).toBe(201);
      const item2 = item2Res.body.data;

      // Mark blocked waiting for copy
      const blockRes = await request(app)
        .post('/api/blockers')
        .set('Authorization', `Bearer ${designerToken}`)
        .send({
          workItemId: item2._id.toString(),
          reason: 'Waiting for content',
          dependencyOwnerId: writerUser._id.toString(),
          notes: 'Awaiting voiceover hook and closing CTA script.',
        });

      expect(blockRes.status).toBe(201);
      const createdBlocker = blockRes.body.data;
      expect(createdBlocker.status).toBe('Active');
      expect(createdBlocker.reason).toBe('Waiting for content');

      // Unblock deliverable once copy is supplied
      const unblockRes = await request(app)
        .patch(`/api/blockers/${createdBlocker._id}/resolve`)
        .set('Authorization', `Bearer ${designerToken}`)
        .send({ resolutionNotes: 'Script delivered by Copywriter. Resuming edit.' });

      expect(unblockRes.status).toBe(200);
      expect(unblockRes.body.data.status).toBe('Resolved');
      expect(unblockRes.body.data.resolvedAt).toBeDefined();
    });
  });

  describe('2. Lead Funnel, LSQ Authoritative Guard & Report Generation', () => {
    it('Syncs LSQ leads idempotently and computes CPL & CPQL', async () => {
      const syncResult = await syncLsqLeads({ batchSize: 30 });
      expect(syncResult.syncedCount).toBeGreaterThanOrEqual(1);

      const funnelRes = await request(app)
        .get(`/api/leads/funnel?profileId=${profileHaca._id.toString()}`)
        .set('Authorization', `Bearer ${headToken}`);

      expect(funnelRes.status).toBe(200);
      const { summary, funnelStages, sourceMix } = funnelRes.body.data;
      expect(summary.totalLeads).toBeGreaterThanOrEqual(1);
      expect(summary.cpl).toBeDefined();
      expect(summary.cpql).toBeDefined();
      expect(funnelStages.length).toBe(12);
      expect(sourceMix.length).toBe(19);
    });

    it('Enforces Read-Authoritative rule: direct POST /api/leads returns HTTP 405', async () => {
      const res = await request(app)
        .post('/api/leads')
        .set('Authorization', `Bearer ${headToken}`)
        .send({ contactName: 'Manual Hacker', stage: 'Total Leads' });

      expect(res.status).toBe(405);
      expect(res.body.error.code).toBe('READ_AUTHORITATIVE_CONSTRAINT');
    });

    it('Generates Monthly Scorecard Report aggregating campaign progress and spend', async () => {
      const reportRes = await request(app)
        .post('/api/reports/definitions/monthly_scorecard/generate')
        .set('Authorization', `Bearer ${headToken}`)
        .send({ month: currentMonth });

      expect(reportRes.status).toBe(200);
      expect(reportRes.body.report.reportKey).toBe('monthly_scorecard');
      expect(reportRes.body.report.html).toContain('Monthly Performance Scorecard');
      expect(reportRes.body.report.summary).toBeDefined();
    });
  });

  describe('3. Five Performance Dimensions Verification (Section 8.7)', () => {
    it('GET /api/people/:id/performance computes all 5 performance dimensions for Senior Designer', async () => {
      const res = await request(app)
        .get(`/api/people/${designerUser._id.toString()}/performance`)
        .set('Authorization', `Bearer ${headToken}`);

      expect(res.status).toBe(200);
      const { person, overallScore, dimensions } = res.body.data;

      expect(person._id).toBe(designerUser._id.toString());
      expect(overallScore).toBeGreaterThanOrEqual(0);
      expect(overallScore).toBeLessThanOrEqual(100);

      // Dimension 1: Output
      expect(dimensions.output).toBeDefined();
      expect(dimensions.output.workCompleted).toBeGreaterThanOrEqual(1);
      expect(dimensions.output.creativeOutputVolume).toBeGreaterThanOrEqual(1);
      expect(dimensions.output.campaignsExecuted).toBeGreaterThanOrEqual(1);

      // Dimension 2: Efficiency
      expect(dimensions.efficiency).toBeDefined();
      expect(dimensions.efficiency.deadlineAdherencePct).toBeGreaterThanOrEqual(0);
      expect(dimensions.efficiency.avgCompletionTimeHrs).toBeGreaterThanOrEqual(0);
      expect(dimensions.efficiency.revisionRatePct).toBeDefined();

      // Dimension 3: Quality
      expect(dimensions.quality).toBeDefined();
      expect(dimensions.quality.approvalRatePct).toBeGreaterThanOrEqual(0);
      expect(dimensions.quality.qualityIndex).toBeGreaterThanOrEqual(1);
      expect(dimensions.quality.rejectionRatePct).toBeDefined();

      // Dimension 4: Collaboration
      expect(dimensions.collaboration).toBeDefined();
      expect(dimensions.collaboration.avgBlockerResolutionTimeHrs).toBeDefined();
      expect(dimensions.collaboration.dependencyDelaysCausedCount).toBe(0);

      // Dimension 5: Business Impact
      expect(dimensions.businessImpact).toBeDefined();
      expect(dimensions.businessImpact.attributedLeads).toBeDefined();
      expect(dimensions.businessImpact.attributedQualifiedLeads).toBeDefined();
    });

    it('GET /api/people/performance/team computes aggregate team performance', async () => {
      const res = await request(app)
        .get('/api/people/performance/team')
        .set('Authorization', `Bearer ${headToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalMembersEvaluated).toBeGreaterThanOrEqual(2);
      expect(res.body.data.overallTeamScore).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(res.body.data.members)).toBe(true);
    });

    it('Member cannot access performance metrics of another user outside their scope', async () => {
      const res = await request(app)
        .get(`/api/people/${headUser._id.toString()}/performance`)
        .set('Authorization', `Bearer ${designerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });
});
