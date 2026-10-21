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

describe('Phase 8: LeadSquared (LSQ) Integration & Data Center (Screens 12 & 13)', () => {
  let adminUser, leadUser, waMarketerUser, memberUser;
  let adminToken, leadToken, memberToken;
  let profileAlpha, profileBeta;
  let deptWhatsApp, deptDesign;
  let campaignAlpha;
  let targetAlpha;

  const currentMonth = new Date().toISOString().slice(0, 7);

  beforeAll(async () => {
    const mongoUri =
      process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/marketing_portal_test';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }

    // Clean test collections
    await Lead.deleteMany({});
    await WorkItem.deleteMany({});
    await Campaign.deleteMany({});
    await MonthlyTarget.deleteMany({});
    await Person.deleteMany({ email: /@lsq-test\.com$/ });
    await Department.deleteMany({ code: { $in: ['whatsapp', 'lsq_design'] } });
    await Profile.deleteMany({ code: { $in: ['lsq_alpha', 'lsq_beta'] } });

    // Seed Profiles
    profileAlpha = await Profile.create({
      name: 'LSQ Brand Alpha',
      code: 'lsq_alpha',
      active: true,
    });

    profileBeta = await Profile.create({
      name: 'LSQ Brand Beta',
      code: 'lsq_beta',
      active: true,
    });

    // Seed Departments
    deptWhatsApp = await Department.create({
      name: 'WhatsApp Operations',
      code: 'whatsapp',
      active: true,
    });

    deptDesign = await Department.create({
      name: 'LSQ Design Dept',
      code: 'lsq_design',
      active: true,
    });

    // Seed Users
    adminUser = await Person.create({
      name: 'LSQ Admin',
      email: 'admin@lsq-test.com',
      role: 'admin',
      departmentId: deptDesign._id,
      profileAccess: [profileAlpha._id, profileBeta._id],
      status: 'active',
    });

    leadUser = await Person.create({
      name: 'LSQ Head',
      email: 'head@lsq-test.com',
      role: 'marketing_head',
      departmentId: deptDesign._id,
      profileAccess: [profileAlpha._id, profileBeta._id],
      status: 'active',
    });

    waMarketerUser = await Person.create({
      name: 'Aarav WhatsApp Specialist',
      email: 'wa.marketer@lsq-test.com',
      role: 'team_member',
      jobRole: 'WhatsApp Marketer',
      departmentId: deptWhatsApp._id,
      profileAccess: [profileAlpha._id],
      status: 'active',
    });

    memberUser = await Person.create({
      name: 'Regular Team Member',
      email: 'member@lsq-test.com',
      role: 'team_member',
      jobRole: 'Designer',
      departmentId: deptDesign._id,
      profileAccess: [profileAlpha._id],
      status: 'active',
    });

    adminToken = makeToken(adminUser);
    leadToken = makeToken(leadUser);
    memberToken = makeToken(memberUser);

    // Seed MonthlyTarget for CPL calculation
    targetAlpha = await MonthlyTarget.create({
      profileId: profileAlpha._id,
      month: currentMonth,
      revenueTarget: 150000,
      leadsTarget: 1000,
      qualifiedLeadsTarget: 400,
      budget: 20000,
      createdBy: adminUser._id,
    });

    // Seed Campaign
    campaignAlpha = await Campaign.create({
      name: 'Alpha Inbound Growth Sprint',
      profileId: profileAlpha._id,
      departmentId: deptWhatsApp._id,
      targetId: targetAlpha._id,
      ownerId: leadUser._id,
      status: 'In Progress',
      goalType: 'Leads',
      expectedOutcome: 'Lead Generation',
      relatedOKR: 'Acquire qualified leads through WhatsApp and Social Ads',
      budgetAllocated: 20000,
      budget: 20000,
      spend: 6000,
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 86400000),
      createdBy: adminUser._id,
    });
  });

  afterAll(async () => {
    await Lead.deleteMany({});
    await WorkItem.deleteMany({});
    await Campaign.deleteMany({});
    await MonthlyTarget.deleteMany({});
    await Person.deleteMany({ email: /@lsq-test\.com$/ });
    await Department.deleteMany({ code: { $in: ['whatsapp', 'lsq_design'] } });
    await Profile.deleteMany({ code: { $in: ['lsq_alpha', 'lsq_beta'] } });
  });

  describe('1. Idempotent LSQ Sync & WhatsApp Auto-Task Creation', () => {
    it('Syncs leads from LSQ and triggers auto-task creation for WhatsApp Inbound', async () => {
      const syncResult = await syncLsqLeads({ batchSize: 20, simulateDiscrepancies: true }, adminUser);

      expect(syncResult.success).toBe(true);
      expect(syncResult.totalIngested).toBe(20);
      expect(syncResult.syncedCount).toBeGreaterThan(0);
      expect(syncResult.tasksCreated).toBeGreaterThanOrEqual(1);

      // Verify that WhatsApp Inbound lead spawned a WorkItem
      const waTask = await WorkItem.findOne({ workType: 'WhatsApp Blast' }).populate('ownerId');
      expect(waTask).toBeTruthy();
      expect(waTask.ownerId.jobRole).toBe('WhatsApp Marketer');
      expect(waTask.title).toContain('WhatsApp Inbound');
      expect(waTask.priority).toBe('High');
      expect(waTask.status).toBe('Not Started');
    });

    it('Sync execution is idempotent: second run does not duplicate leads or auto-tasks', async () => {
      const initialLeadsCount = await Lead.countDocuments();
      const initialTasksCount = await WorkItem.countDocuments({ workType: 'WhatsApp Blast' });

      // Run sync again with identical batch
      const repeatSync = await syncLsqLeads({ batchSize: 20, simulateDiscrepancies: true }, adminUser);

      const finalLeadsCount = await Lead.countDocuments();
      const finalTasksCount = await WorkItem.countDocuments({ workType: 'WhatsApp Blast' });

      expect(finalLeadsCount).toBe(initialLeadsCount);
      expect(finalTasksCount).toBe(initialTasksCount);
      expect(repeatSync.tasksCreated).toBe(0); // Deduplicated
    });
  });

  describe('2. Read-Authoritative Constraint Enforcement', () => {
    it('Rejects manual lead creation with HTTP 405 READ_AUTHORITATIVE_CONSTRAINT', async () => {
      const res = await request(app)
        .post('/api/leads')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          lsqLeadId: 'MANUAL-001',
          contactName: 'Unauthorized Lead',
        });

      expect(res.status).toBe(405);
      expect(res.body.error.code).toBe('READ_AUTHORITATIVE_CONSTRAINT');
    });

    it('Rejects direct PUT/PATCH/DELETE on lead status with HTTP 405', async () => {
      const anyLead = await Lead.findOne();
      expect(anyLead).toBeTruthy();

      const patchRes = await request(app)
        .patch(`/api/leads/${anyLead._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stage: 'Payment Received' });

      expect(patchRes.status).toBe(405);
      expect(patchRes.body.error.code).toBe('READ_AUTHORITATIVE_CONSTRAINT');

      const delRes = await request(app)
        .delete(`/api/leads/${anyLead._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(delRes.status).toBe(405);
      expect(delRes.body.error.code).toBe('READ_AUTHORITATIVE_CONSTRAINT');
    });
  });

  describe('3. Lead Funnel Analytics (Screen 12)', () => {
    it('GET /api/leads/funnel returns 12-stage visual funnel, CPL, CPQL and source mix', async () => {
      const res = await request(app)
        .get('/api/leads/funnel')
        .set('Authorization', `Bearer ${leadToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(data.summary).toBeDefined();
      expect(data.summary.totalLeads).toBeGreaterThan(0);
      expect(data.summary.cpl).toBeDefined();
      expect(data.summary.cpql).toBeDefined();
      expect(data.summary.qualifiedPercentage).toBeDefined();

      // Verify all 12 stages are represented
      expect(data.funnelStages.length).toBe(12);
      const stageNames = data.funnelStages.map((s) => s.stage);
      expect(stageNames).toContain('Total Leads');
      expect(stageNames).toContain('Qualified Leads');
      expect(stageNames).toContain('Payment Received');
      expect(stageNames).toContain('Not Interested');

      // Verify 19-source mix
      expect(data.sourceMix.length).toBe(19);
      const sourceNames = data.sourceMix.map((s) => s.source);
      expect(sourceNames).toContain('Facebook Lead Ads');
      expect(sourceNames).toContain('Google Ads');
      expect(sourceNames).toContain('WhatsApp Inbound');
      expect(sourceNames).toContain('Website Leads');
    });

    it('Filtering lead funnel by brand profile respects scoping', async () => {
      const res = await request(app)
        .get(`/api/leads/funnel?profileId=${profileAlpha._id.toString()}`)
        .set('Authorization', `Bearer ${leadToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.summary.totalLeads).toBeGreaterThanOrEqual(1);
    });
  });

  describe('4. Data Center & Hygiene Discrepancy Resolution (Screen 13)', () => {
    it('GET /api/datacenter returns sync health score and lists active discrepancies', async () => {
      const res = await request(app)
        .get('/api/datacenter')
        .set('Authorization', `Bearer ${leadToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(data.healthScore).toBeDefined();
      expect(data.totalIngested).toBeGreaterThan(0);
      expect(data.discrepancyCount).toBeGreaterThan(0);
      expect(data.discrepancies.length).toBeGreaterThanOrEqual(1);

      // Verify discrepancy reasons
      const reasons = data.discrepancies.map((d) => d.discrepancyReason);
      expect(reasons.some((r) => r === 'Missing Brand Profile' || r === 'Unmapped Lead Source')).toBe(true);
    });

    it('Marketing Head resolves missing brand profile discrepancy via PATCH /api/datacenter/discrepancies/:id/resolve', async () => {
      const discrepancy = await Lead.findOne({ syncStatus: 'discrepancy', discrepancyReason: 'Missing Brand Profile' });
      expect(discrepancy).toBeTruthy();

      const res = await request(app)
        .patch(`/api/datacenter/discrepancies/${discrepancy._id}/resolve`)
        .set('Authorization', `Bearer ${leadToken}`)
        .send({ profileId: profileAlpha._id.toString() });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.lead.syncStatus).toBe('synced');
      expect(res.body.lead.discrepancyReason).toBeNull();
      expect(res.body.lead.resolvedAt).toBeTruthy();

      // Verify DB persistence
      const updated = await Lead.findById(discrepancy._id);
      expect(updated.syncStatus).toBe('synced');
      expect(updated.profileId.toString()).toBe(profileAlpha._id.toString());
    });

    it('POST /api/leads/sync triggers manual LSQ sync on demand from Data Center', async () => {
      const res = await request(app)
        .post('/api/leads/sync')
        .set('Authorization', `Bearer ${leadToken}`)
        .send({ batchSize: 10 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.result.totalIngested).toBe(10);
    });
  });
});
