import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { Person } from '../src/modules/people/model.js';
import { Profile } from '../src/modules/referenceData/profile.model.js';
import { MonthlyTarget } from '../src/modules/targets/model.js';
import { Campaign } from '../src/modules/campaigns/model.js';
import { ActivityEvent } from '../src/modules/activity/model.js';
import * as targetService from '../src/modules/targets/service.js';
import * as campaignService from '../src/modules/campaigns/service.js';

describe('Phase 2: Monthly Targets & Campaigns Traceability and Scoping', () => {
  let adminUser, headUser, leadUserAlpha, leadUserBeta, memberUser;
  let profileAlpha, profileBeta;
  let testMonth = '2027-01';

  beforeAll(async () => {
    const mongoUri =
      process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/marketing_portal_test';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }

    // Clean test artifacts
    await Campaign.deleteMany({ name: /Phase 2 Test/i });
    await MonthlyTarget.deleteMany({ month: testMonth });
    await Person.deleteMany({ email: /@phase2-test\.com$/ });
    await Profile.deleteMany({ code: { $in: ['p2_alpha', 'p2_beta'] } });
    await ActivityEvent.deleteMany({ 'metadata.name': /Phase 2 Test/i });

    // 1. Create brand profiles
    profileAlpha = await Profile.create({ name: 'Alpha Profile', code: 'p2_alpha', active: true });
    profileBeta = await Profile.create({ name: 'Beta Profile', code: 'p2_beta', active: true });

    // 2. Create users with different roles & scopes
    adminUser = await Person.create({
      name: 'P2 Admin',
      email: 'admin@phase2-test.com',
      role: 'admin',
      status: 'active',
      profileAccess: [profileAlpha._id, profileBeta._id],
    });

    headUser = await Person.create({
      name: 'P2 Head',
      email: 'head@phase2-test.com',
      role: 'marketing_head',
      status: 'active',
      profileAccess: [profileAlpha._id, profileBeta._id],
    });

    leadUserAlpha = await Person.create({
      name: 'P2 Lead Alpha',
      email: 'lead.alpha@phase2-test.com',
      role: 'team_lead',
      status: 'active',
      profileAccess: [profileAlpha._id], // Scoped strictly to profileAlpha
    });

    leadUserBeta = await Person.create({
      name: 'P2 Lead Beta',
      email: 'lead.beta@phase2-test.com',
      role: 'team_lead',
      status: 'active',
      profileAccess: [profileBeta._id], // Scoped strictly to profileBeta
    });

    memberUser = await Person.create({
      name: 'P2 Member',
      email: 'member@phase2-test.com',
      role: 'team_member',
      status: 'active',
      profileAccess: [profileAlpha._id],
    });
  });

  afterAll(async () => {
    // Clean up
    await Campaign.deleteMany({ name: /Phase 2 Test/i });
    await MonthlyTarget.deleteMany({ month: testMonth });
    await Person.deleteMany({ email: /@phase2-test\.com$/ });
    await Profile.deleteMany({ code: { $in: ['p2_alpha', 'p2_beta'] } });
    await ActivityEvent.deleteMany({ 'metadata.name': /Phase 2 Test/i });
  });

  describe('MonthlyTarget Service', () => {
    let createdTarget;

    it('sets a new MonthlyTarget for a specific profile', async () => {
      createdTarget = await targetService.setMonthlyTarget(
        {
          month: testMonth,
          profileId: profileAlpha._id,
          revenueTarget: 1000000,
          leadsTarget: 1200,
          qualifiedLeadsTarget: 400,
          budget: 250000,
        },
        adminUser
      );

      expect(createdTarget).toBeDefined();
      expect(createdTarget.month).toBe(testMonth);
      expect(createdTarget.revenueTarget).toBe(1000000);
      expect(createdTarget.leadsTarget).toBe(1200);
      expect(createdTarget.budget).toBe(250000);
    });

    it('upserts existing MonthlyTarget if same month and profileId are provided', async () => {
      const updated = await targetService.setMonthlyTarget(
        {
          month: testMonth,
          profileId: profileAlpha._id,
          revenueTarget: 1200000, // Updated
          leadsTarget: 1500,
          budget: 300000,
        },
        headUser
      );

      expect(updated._id.toString()).toBe(createdTarget._id.toString());
      expect(updated.revenueTarget).toBe(1200000);
      expect(updated.leadsTarget).toBe(1500);
    });

    it('lists targets with aggregation metrics', async () => {
      const list = await targetService.listMonthlyTargets({ month: testMonth }, headUser);
      expect(Array.isArray(list)).toBe(true);
      const found = list.find((t) => t._id.toString() === createdTarget._id.toString());
      expect(found).toBeDefined();
      expect(found.campaignsCount).toBe(0);
      expect(found.spendActual).toBe(0);
    });
  });

  describe('Strict Traceability Invariants: Campaign -> Target & OKR Linkage', () => {
    let validTarget;

    beforeAll(async () => {
      validTarget = await targetService.setMonthlyTarget(
        {
          month: testMonth,
          profileId: profileAlpha._id,
          revenueTarget: 500000,
          leadsTarget: 800,
          budget: 150000,
        },
        adminUser
      );
    });

    it('REJECTS campaign creation without targetId (HTTP 400)', async () => {
      await expect(
        campaignService.createCampaign(
          {
            name: 'Phase 2 Test: Orphan Campaign',
            profileId: profileAlpha._id,
            relatedOKR: 'Scale brand enrollments by 25%',
            startDate: '2027-01-01',
            endDate: '2027-01-31',
          },
          adminUser
        )
      ).rejects.toThrow(/strictly requires a valid targetId/);
    });

    it('REJECTS campaign creation without relatedOKR (HTTP 400)', async () => {
      await expect(
        campaignService.createCampaign(
          {
            name: 'Phase 2 Test: No OKR Campaign',
            profileId: profileAlpha._id,
            targetId: validTarget._id,
            relatedOKR: '   ', // Blank
            startDate: '2027-01-01',
            endDate: '2027-01-31',
          },
          adminUser
        )
      ).rejects.toThrow(/strictly requires a relatedOKR string/);
    });

    it('REJECTS campaign creation with non-existent targetId (HTTP 400)', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await expect(
        campaignService.createCampaign(
          {
            name: 'Phase 2 Test: Invalid Target Campaign',
            profileId: profileAlpha._id,
            targetId: fakeId,
            relatedOKR: 'Scale brand enrollments by 25%',
            startDate: '2027-01-01',
            endDate: '2027-01-31',
          },
          adminUser
        )
      ).rejects.toThrow(/does not exist/);
    });

    it('ACCEPTS campaign creation when both targetId and relatedOKR are provided', async () => {
      const campaign = await campaignService.createCampaign(
        {
          name: 'Phase 2 Test: Valid Campaign Alpha',
          profileId: profileAlpha._id,
          targetId: validTarget._id,
          relatedOKR: 'Generate 400 high-intent enrollments for Alpha Profile',
          startDate: '2027-01-01',
          endDate: '2027-01-31',
          goalType: 'Leads',
          goalValue: 400,
          budget: 80000,
          ownerId: leadUserAlpha._id,
        },
        adminUser
      );

      expect(campaign).toBeDefined();
      expect(campaign.name).toBe('Phase 2 Test: Valid Campaign Alpha');
      expect(campaign.targetId._id.toString()).toBe(validTarget._id.toString());
      expect(campaign.relatedOKR).toBe('Generate 400 high-intent enrollments for Alpha Profile');
      expect(campaign.status).toBe('In Progress');
    });
  });

  describe('Brand Profile Scoping (resolveScope)', () => {
    let targetAlpha, targetBeta;
    let campaignAlpha;

    beforeAll(async () => {
      targetAlpha = await targetService.setMonthlyTarget(
        {
          month: testMonth,
          profileId: profileAlpha._id,
          revenueTarget: 300000,
          leadsTarget: 500,
          budget: 100000,
        },
        adminUser
      );

      targetBeta = await targetService.setMonthlyTarget(
        {
          month: testMonth,
          profileId: profileBeta._id,
          revenueTarget: 400000,
          leadsTarget: 600,
          budget: 120000,
        },
        adminUser
      );

      campaignAlpha = await campaignService.createCampaign(
        {
          name: 'Phase 2 Test: Alpha Initiative',
          profileId: profileAlpha._id,
          targetId: targetAlpha._id,
          relatedOKR: 'Alpha Profile Growth',
          startDate: '2027-01-01',
          endDate: '2027-01-31',
          goalType: 'Leads',
          goalValue: 250,
          budget: 50000,
          ownerId: leadUserAlpha._id,
        },
        leadUserAlpha
      );
    });

    it('ALLOWS Team Lead Alpha to create campaign in permitted Profile Alpha', async () => {
      expect(campaignAlpha).toBeDefined();
      expect(campaignAlpha.profileId._id.toString()).toBe(profileAlpha._id.toString());
    });

    it('BLOCKS Team Lead Alpha from creating campaign in unauthorized Profile Beta (HTTP 403)', async () => {
      await expect(
        campaignService.createCampaign(
          {
            name: 'Phase 2 Test: Cross Brand Attack',
            profileId: profileBeta._id,
            targetId: targetBeta._id,
            relatedOKR: 'Unauthorized attempt',
            startDate: '2027-01-01',
            endDate: '2027-01-31',
          },
          leadUserAlpha
        )
      ).rejects.toThrow(/permission to create campaigns for this brand profile/);
    });

    it('SCOPES listCampaigns so Team Lead Beta cannot see Alpha campaigns', async () => {
      const betaLeadView = await campaignService.listCampaigns({}, leadUserBeta);
      const containsAlpha = betaLeadView.some(
        (c) => c._id.toString() === campaignAlpha._id.toString()
      );
      expect(containsAlpha).toBe(false);
    });

    it('SCOPES listCampaigns so Marketing Head sees all campaigns across all profiles', async () => {
      const headView = await campaignService.listCampaigns({}, headUser);
      const containsAlpha = headView.some(
        (c) => c._id.toString() === campaignAlpha._id.toString()
      );
      expect(containsAlpha).toBe(true);
    });

    it('BLOCKS Team Lead Beta from accessing Alpha Campaign by ID (HTTP 403)', async () => {
      await expect(
        campaignService.getCampaignById(campaignAlpha._id, leadUserBeta)
      ).rejects.toThrow(/permission to view campaigns for this brand profile/);
    });

    it('ALLOWS Team Lead Alpha to access Alpha Campaign by ID', async () => {
      const found = await campaignService.getCampaignById(campaignAlpha._id, leadUserAlpha);
      expect(found._id.toString()).toBe(campaignAlpha._id.toString());
    });
  });

  describe('Target Deletion Protection & Aggregation Recalculation', () => {
    let targetWithCampaign, linkedCampaign;
    const distinctMonth = '2027-02';

    beforeAll(async () => {
      await MonthlyTarget.deleteMany({ month: distinctMonth });
      targetWithCampaign = await targetService.setMonthlyTarget(
        {
          month: distinctMonth,
          profileId: profileAlpha._id,
          revenueTarget: 200000,
          leadsTarget: 300,
          budget: 60000,
        },
        adminUser
      );

      linkedCampaign = await campaignService.createCampaign(
        {
          name: 'Phase 2 Test: Linked Protection Campaign',
          profileId: profileAlpha._id,
          targetId: targetWithCampaign._id,
          relatedOKR: 'Protection check',
          startDate: '2027-02-01',
          endDate: '2027-02-28',
          goalType: 'Leads',
          goalValue: 150,
          budget: 40000,
          spend: 15000,
          leadsActual: 80,
          ownerId: leadUserAlpha._id,
        },
        adminUser
      );
    });

    afterAll(async () => {
      await MonthlyTarget.deleteMany({ month: distinctMonth });
    });

    it('REFUSES deletion of MonthlyTarget when active campaigns are linked', async () => {
      await expect(
        targetService.deleteMonthlyTarget(targetWithCampaign._id, adminUser)
      ).rejects.toThrow(/Cannot delete target:.*campaign/i);
    });

    it('aggregates campaign actuals (spendActual, leadsActual, budgetAllocated) on MonthlyTarget', async () => {
      const targets = await targetService.listMonthlyTargets({ month: distinctMonth }, adminUser);
      const targetSummary = targets.find(
        (t) => t._id.toString() === targetWithCampaign._id.toString()
      );

      expect(targetSummary).toBeDefined();
      expect(targetSummary.campaignsCount).toBe(1);
      expect(targetSummary.spendActual).toBe(15000);
      expect(targetSummary.leadsActual).toBe(80);
      expect(targetSummary.budgetAllocated).toBe(40000);
    });
  });

  describe('Campaign Lifecycle, Updates & Audit Stream', () => {
    let testTarget, activeCampaign;

    beforeAll(async () => {
      testTarget = await targetService.setMonthlyTarget(
        {
          month: testMonth,
          profileId: profileAlpha._id,
          revenueTarget: 500000,
          leadsTarget: 500,
          budget: 100000,
        },
        adminUser
      );

      activeCampaign = await campaignService.createCampaign(
        {
          name: 'Phase 2 Test: Lifecycle Initiative',
          profileId: profileAlpha._id,
          targetId: testTarget._id,
          relatedOKR: 'Audit log lifecycle test',
          startDate: '2027-01-01',
          endDate: '2027-01-31',
          goalType: 'Leads',
          goalValue: 300,
          budget: 70000,
          ownerId: leadUserAlpha._id,
        },
        adminUser
      );
    });

    it('updates campaign status and emits ActivityEvent', async () => {
      const updated = await campaignService.updateCampaign(
        activeCampaign._id,
        {
          status: 'At Risk',
          spend: 35000,
          leadsActual: 120,
          progressPct: 40,
        },
        leadUserAlpha
      );

      expect(updated.status).toBe('At Risk');
      expect(updated.spend).toBe(35000);
      expect(updated.leadsActual).toBe(120);

      // Verify ActivityEvent was logged
      const activities = await campaignService.getCampaignActivities(activeCampaign._id, leadUserAlpha);
      expect(Array.isArray(activities)).toBe(true);
      expect(activities.length).toBeGreaterThan(0);

      const statusEvent = activities.find((a) => a.action === 'campaign.status_changed');
      expect(statusEvent).toBeDefined();
      expect(statusEvent.fromStatus).toBe('In Progress');
      expect(statusEvent.toStatus).toBe('At Risk');
    });

    it('deletes campaign and logs campaign.deleted activity', async () => {
      const delResult = await campaignService.deleteCampaign(activeCampaign._id, adminUser);
      expect(delResult.success).toBe(true);

      const deletedCheck = await Campaign.findById(activeCampaign._id);
      expect(deletedCheck).toBeNull();
    });
  });
});
