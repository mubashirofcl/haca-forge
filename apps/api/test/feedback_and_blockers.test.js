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
import { Blocker } from '../src/modules/blockers/model.js';
import { ActivityEvent } from '../src/modules/activity/model.js';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';

const makeToken = (user) =>
  jwt.sign(
    { userId: user._id.toString(), role: user.role, email: user.email },
    env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );

describe('Phase 5: Feedback Loops, Revision Flags & Blockers', () => {
  let adminUser, leadUser, memberUser, dependencyOwner;
  let adminToken, leadToken, memberToken, dependencyToken;
  let profileHaca, deptDesign;
  let testTarget, testCampaign, testWorkItem;

  beforeAll(async () => {
    const mongoUri =
      process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/marketing_portal_test';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }

    // Clean test collections
    await FeedbackEntry.deleteMany({});
    await RevisionFlag.deleteMany({});
    await Blocker.deleteMany({});
    await WorkItem.deleteMany({});
    await Campaign.deleteMany({});
    await MonthlyTarget.deleteMany({});
    await ActivityEvent.deleteMany({});
    await Person.deleteMany({ email: /@feedback-test\.com$/ });
    await Department.deleteMany({ code: 'test_feedback_dept' });
    await Profile.deleteMany({ code: 'test_feedback_profile' });

    profileHaca = await Profile.create({
      name: 'Test Profile Phase 5',
      code: 'test_feedback_profile',
      active: true,
    });

    deptDesign = await Department.create({
      name: 'Design',
      code: 'test_feedback_dept',
    });

    adminUser = await Person.create({
      name: 'Admin Reviewer',
      email: 'admin@feedback-test.com',
      role: 'admin',
      departmentId: deptDesign._id,
      profileAccess: [profileHaca._id],
      status: 'active',
      weeklyCapacityHours: 40,
    });

    leadUser = await Person.create({
      name: 'Design Lead Reviewer',
      email: 'lead@feedback-test.com',
      role: 'team_lead',
      jobRole: 'Design Lead (TL)',
      departmentId: deptDesign._id,
      profileAccess: [profileHaca._id],
      status: 'active',
      weeklyCapacityHours: 40,
    });

    memberUser = await Person.create({
      name: 'Creative Owner Member',
      email: 'member@feedback-test.com',
      role: 'team_member',
      jobRole: 'Designer',
      departmentId: deptDesign._id,
      profileAccess: [profileHaca._id],
      status: 'active',
      weeklyCapacityHours: 40,
    });

    dependencyOwner = await Person.create({
      name: 'Content Dependency Owner',
      email: 'content.dep@feedback-test.com',
      role: 'team_member',
      jobRole: 'Writer',
      departmentId: deptDesign._id,
      profileAccess: [profileHaca._id],
      status: 'active',
      weeklyCapacityHours: 40,
    });

    adminToken = makeToken(adminUser);
    leadToken = makeToken(leadUser);
    memberToken = makeToken(memberUser);
    dependencyToken = makeToken(dependencyOwner);

    testTarget = await MonthlyTarget.create({
      month: '2026-11',
      profileId: profileHaca._id,
      revenueTarget: 800000,
      leadsTarget: 150,
      createdBy: adminUser._id,
    });

    testCampaign = await Campaign.create({
      name: 'Design Sprint Campaign P5',
      profileId: profileHaca._id,
      departmentId: deptDesign._id,
      targetId: testTarget._id,
      startDate: new Date('2026-11-01'),
      endDate: new Date('2026-11-30'),
      goalType: 'Leads',
      expectedOutcome: 'Lead Generation',
      budgetAllocated: 50000,
      relatedOKR: 'Double design asset conversions',
      status: 'In Progress',
      ownerId: adminUser._id,
      createdBy: adminUser._id,
    });

    testWorkItem = await WorkItem.create({
      title: 'Phase 5 Carousel Deliverable',
      campaignId: testCampaign._id,
      profileId: profileHaca._id,
      departmentId: deptDesign._id,
      relatedOKR: 'Double design asset conversions',
      relatedTarget: testTarget._id,
      ownerId: memberUser._id,
      workType: 'Carousel',
      deadline: new Date(Date.now() + 5 * 24 * 3600 * 1000),
      estimatedEffortHrs: 4,
      status: 'In Progress',
      priority: 'High',
      revisions: 0,
      createdBy: leadUser._id,
    });
  });

  afterAll(async () => {
    await FeedbackEntry.deleteMany({});
    await RevisionFlag.deleteMany({});
    await Blocker.deleteMany({});
    await WorkItem.deleteMany({});
    await Campaign.deleteMany({});
    await MonthlyTarget.deleteMany({});
    await Person.deleteMany({ email: /@feedback-test\.com$/ });
    await Department.deleteMany({ code: 'test_feedback_dept' });
    await Profile.deleteMany({ code: 'test_feedback_profile' });
  });

  describe('Part A: Structured Two-Entry Feedback Rounds', () => {
    it('allows reviewer to submit Round 1 feedback with "Revision Required"', async () => {
      const res = await request(app)
        .post(`/api/feedback/work-item/${testWorkItem._id}`)
        .set('Authorization', `Bearer ${leadToken}`)
        .send({
          round: 1,
          roundStatus: 'Revision Required',
          text: 'The font size on slide 3 is too small and brand purple is slightly off-palette.',
          isResponse: false,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.round).toBe(1);
      expect(res.body.data.roundStatus).toBe('Revision Required');
      expect(res.body.data.isResponse).toBe(false);

      // Verify work item updated to Feedback and revisions incremented
      const updatedItem = await WorkItem.findById(testWorkItem._id);
      expect(updatedItem.status).toBe('Feedback');
      expect(updatedItem.revisions).toBe(1);
    });

    it('prevents non-owner member from submitting owner response', async () => {
      const res = await request(app)
        .post(`/api/feedback/work-item/${testWorkItem._id}`)
        .set('Authorization', `Bearer ${dependencyToken}`) // different member
        .send({
          round: 1,
          text: 'Attempting to respond on behalf of owner',
          isResponse: true,
        });

      expect(res.status).toBe(403);
    });

    it('allows assigned owner to submit owner response for Round 1', async () => {
      const res = await request(app)
        .post(`/api/feedback/work-item/${testWorkItem._id}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          round: 1,
          text: 'Understood. Fixed slide 3 typography and calibrated to official #7C3AED purple.',
          isResponse: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.round).toBe(1);
      expect(res.body.data.isResponse).toBe(true);
    });

    it('returns grouped rounds and entries in getFeedbackForWorkItem', async () => {
      const res = await request(app)
        .get(`/api/feedback/work-item/${testWorkItem._id}`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rounds).toHaveLength(1);
      expect(res.body.data.rounds[0].roundNumber).toBe(1);
      expect(res.body.data.rounds[0].reviewerFeedback).not.toBeNull();
      expect(res.body.data.rounds[0].ownerResponse).not.toBeNull();
    });

    it('prevents team member from approving deliverables without lead/admin role', async () => {
      const res = await request(app)
        .post(`/api/feedback/work-item/${testWorkItem._id}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          round: 2,
          roundStatus: 'Approved',
          text: 'I approve my own work',
          isResponse: false,
        });

      expect(res.status).toBe(403);
    });
  });

  describe('Part B: Automatic Revision Flagging Engine', () => {
    it('automatically flags RevisionFlag when revisions reach 4', async () => {
      // Simulate rounds 2, 3, 4 with "Revision Required"
      await request(app)
        .post(`/api/feedback/work-item/${testWorkItem._id}`)
        .set('Authorization', `Bearer ${leadToken}`)
        .send({ round: 2, roundStatus: 'Revision Required', text: 'Second round revisions needed', isResponse: false });

      await request(app)
        .post(`/api/feedback/work-item/${testWorkItem._id}`)
        .set('Authorization', `Bearer ${leadToken}`)
        .send({ round: 3, roundStatus: 'Revision Required', text: 'Third round revisions needed', isResponse: false });

      const resRound4 = await request(app)
        .post(`/api/feedback/work-item/${testWorkItem._id}`)
        .set('Authorization', `Bearer ${leadToken}`)
        .send({ round: 4, roundStatus: 'Revision Required', text: 'Fourth round revision: design direction issue', isResponse: false });

      expect(resRound4.status).toBe(201);

      // Verify work item revisions is 4
      const updatedItem = await WorkItem.findById(testWorkItem._id);
      expect(updatedItem.revisions).toBe(4);

      // Verify RevisionFlag was automatically created
      const flag = await RevisionFlag.findOne({ workItemId: testWorkItem._id });
      expect(flag).not.toBeNull();
      expect(flag.isFlagged).toBe(true);
      expect(flag.revisionsCount).toBe(4);
      expect(flag.rootCause).toBeNull(); // unclassified initially

      // Verify ActivityEvent logged
      const activity = await ActivityEvent.findOne({
        entityId: testWorkItem._id,
        action: 'revision.flagged',
      });
      expect(activity).not.toBeNull();
    });

    it('prevents team member from classifying revision root cause', async () => {
      const flag = await RevisionFlag.findOne({ workItemId: testWorkItem._id });
      const res = await request(app)
        .post(`/api/revisions/flags/${flag._id}/classify`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          rootCause: 'Brief unclear',
        });

      expect(res.status).toBe(403);
    });

    it('rejects invalid root causes outside the 7 fixed taxonomies', async () => {
      const flag = await RevisionFlag.findOne({ workItemId: testWorkItem._id });
      const res = await request(app)
        .post(`/api/revisions/flags/${flag._id}/classify`)
        .set('Authorization', `Bearer ${leadToken}`)
        .send({
          rootCause: 'Random Invalid Cause',
        });

      expect(res.status).toBe(400);
    });

    it('allows Team Lead to classify root cause with 1 of 7 fixed values', async () => {
      const flag = await RevisionFlag.findOne({ workItemId: testWorkItem._id });
      const res = await request(app)
        .post(`/api/revisions/flags/${flag._id}/classify`)
        .set('Authorization', `Bearer ${leadToken}`)
        .send({
          rootCause: 'Creative direction unclear',
          rootCauseNotes: 'Client changed tone of voice mid-stream from corporate to playful.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rootCause).toBe('Creative direction unclear');
      expect(res.body.data.rootCauseNotes).toContain('tone of voice');
      expect(res.body.data.classifiedBy).not.toBeNull();

      // Verify ActivityEvent logged
      const classifiedActivity = await ActivityEvent.findOne({
        entityId: testWorkItem._id,
        action: 'revision.classified',
      });
      expect(classifiedActivity).not.toBeNull();
    });

    it('lists revision flags with filters', async () => {
      const res = await request(app)
        .get('/api/revisions/flags?status=classified')
        .set('Authorization', `Bearer ${leadToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].rootCause).toBe('Creative direction unclear');
    });

    it('evaluates escalation window if flag remains unclassified for >48h', async () => {
      // Create a simulated unclassified flag older than 48h
      const pastDate = new Date(Date.now() - 50 * 3600 * 1000);
      const staleWorkItem = await WorkItem.create({
        title: 'Stale Deliverable for Escalation',
        campaignId: testCampaign._id,
        profileId: profileHaca._id,
        departmentId: deptDesign._id,
        relatedOKR: 'Double design asset conversions',
        relatedTarget: testTarget._id,
        ownerId: memberUser._id,
        workType: 'Post',
        deadline: new Date(Date.now() + 2 * 24 * 3600 * 1000),
        status: 'Feedback',
        revisions: 4,
        createdBy: leadUser._id,
      });

      await RevisionFlag.create({
        workItemId: staleWorkItem._id,
        ownerId: memberUser._id,
        revisionsCount: 4,
        baselineAvg: 1.0,
        isFlagged: true,
        flaggedAt: pastDate,
        rootCause: null,
      });

      const res = await request(app)
        .get('/api/revisions/flags?status=escalated')
        .set('Authorization', `Bearer ${leadToken}`);

      expect(res.status).toBe(200);
      const escalatedFlag = res.body.data.find(
        (f) => f.workItemId?._id?.toString() === staleWorkItem._id.toString()
      );
      expect(escalatedFlag).toBeDefined();
      expect(escalatedFlag.isEscalated).toBe(true);
    });
  });

  describe('Part C: Blocker Engine & Dependency Alerting', () => {
    let blockerWorkItem;

    beforeAll(async () => {
      blockerWorkItem = await WorkItem.create({
        title: 'Ad Set Deliverable for Blocker Test',
        campaignId: testCampaign._id,
        profileId: profileHaca._id,
        departmentId: deptDesign._id,
        relatedOKR: 'Double design asset conversions',
        relatedTarget: testTarget._id,
        ownerId: memberUser._id,
        workType: 'Ad Set',
        deadline: new Date(Date.now() + 3 * 24 * 3600 * 1000),
        status: 'In Progress',
        createdBy: leadUser._id,
      });
    });

    it('rejects blocker creation if reason is in BLOCKER_DEPENDENCY_REASONS and dependencyOwnerId is missing', async () => {
      const res = await request(app)
        .post('/api/blockers')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          workItemId: blockerWorkItem._id.toString(),
          reason: 'Waiting for content',
          // Missing dependencyOwnerId!
        });

      expect(res.status).toBe(400);
    });

    it('creates active blocker with dependencyOwnerId and transitions work item to Blocked', async () => {
      const res = await request(app)
        .post('/api/blockers')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          workItemId: blockerWorkItem._id.toString(),
          reason: 'Waiting for content',
          notes: 'Need headline copy and pricing disclosures from Writer.',
          dependencyOwnerId: dependencyOwner._id.toString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.reason).toBe('Waiting for content');
      expect(res.body.data.status).toBe('Active');
      expect(res.body.data.dependencyOwnerId?._id.toString()).toBe(dependencyOwner._id.toString());

      // Verify workItem status is Blocked
      const updatedItem = await WorkItem.findById(blockerWorkItem._id);
      expect(updatedItem.status).toBe('Blocked');
      expect(updatedItem.blockerReason).toBe('Waiting for content');

      // Verify ActivityEvent logged
      const blockerActivity = await ActivityEvent.findOne({
        entityId: blockerWorkItem._id,
        action: 'work_item.blocked',
      });
      expect(blockerActivity).not.toBeNull();
    });

    it('allows sending reminder to dependency owner via /notify endpoint', async () => {
      const blocker = await Blocker.findOne({ workItemId: blockerWorkItem._id, status: 'Active' });
      const res = await request(app)
        .post(`/api/blockers/${blocker._id}/notify`)
        .set('Authorization', `Bearer ${leadToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Reminder sent');

      const updatedBlocker = await Blocker.findById(blocker._id);
      expect(updatedBlocker.lastNotifiedAt).not.toBeNull();
    });

    it('resolves blocker and restores work item status to "In Progress"', async () => {
      const blocker = await Blocker.findOne({ workItemId: blockerWorkItem._id, status: 'Active' });
      const res = await request(app)
        .patch(`/api/blockers/${blocker._id}/resolve`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          resolutionNotes: 'Writer delivered approved headlines.',
          resumeStatus: 'In Progress',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('Resolved');
      expect(res.body.data.resolutionNotes).toContain('Writer delivered');

      // Verify work item restored
      const updatedItem = await WorkItem.findById(blockerWorkItem._id);
      expect(updatedItem.status).toBe('In Progress');
      expect(updatedItem.blockerReason).toBeNull();

      // Verify ActivityEvent logged
      const unblockedActivity = await ActivityEvent.findOne({
        entityId: blockerWorkItem._id,
        action: 'work_item.unblocked',
      });
      expect(unblockedActivity).not.toBeNull();
    });
  });
});
