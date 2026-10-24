import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { Person } from '../src/modules/people/model.js';
import { Profile } from '../src/modules/referenceData/profile.model.js';
import { Department } from '../src/modules/departments/model.js';
import { WorkItem } from '../src/modules/workItems/model.js';
import { ActivityEvent } from '../src/modules/activity/model.js';
import * as workItemService from '../src/modules/workItems/service.js';
import * as transitionService from '../src/modules/workItems/transition.service.js';

describe('Phase 3: Work Items, Traceability, Transitions & Dynamic Overdue', () => {
  let adminUser, headUser, leadUser, otherLeadUser, memberUser, otherMemberUser;
  let testProfileAlpha, testProfileBeta, testDept;

  beforeAll(async () => {
    const mongoUri =
      process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/marketing_portal_test';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }

    // Clean test artifacts
    await WorkItem.deleteMany({ title: /P3 Test/i });
    await Person.deleteMany({ email: /@p3-test\.com$/ });
    await Profile.deleteMany({ code: { $in: ['p3_alpha', 'p3_beta'] } });
    await Department.deleteMany({ code: 'p3_design' });
    await ActivityEvent.deleteMany({ 'metadata.title': /P3 Test/i });

    // Seed test reference data
    testProfileAlpha = await Profile.create({ name: 'P3 Alpha Brand', code: 'p3_alpha', active: true });
    testProfileBeta = await Profile.create({ name: 'P3 Beta Brand', code: 'p3_beta', active: true });
    testDept = await Department.create({ name: 'P3 Design Dept', code: 'p3_design', isActive: true });

    // Seed test users
    adminUser = await Person.create({
      name: 'P3 Admin',
      email: 'admin@p3-test.com',
      role: 'admin',
      status: 'active',
      profileAccess: [testProfileAlpha._id, testProfileBeta._id],
    });

    headUser = await Person.create({
      name: 'P3 Creative Head',
      email: 'head@p3-test.com',
      role: 'creative_head',
      status: 'active',
      profileAccess: [testProfileAlpha._id, testProfileBeta._id],
    });

    leadUser = await Person.create({
      name: 'P3 SM Manager Alpha',
      email: 'lead@p3-test.com',
      role: 'sm_manager',
      jobRole: 'Social Media Manager',
      departmentId: testDept._id,
      status: 'active',
      profileAccess: [testProfileAlpha._id],
    });

    otherLeadUser = await Person.create({
      name: 'P3 Other SM Manager Beta',
      email: 'otherlead@p3-test.com',
      role: 'sm_manager',
      jobRole: 'Social Media Manager',
      status: 'active',
      profileAccess: [testProfileBeta._id],
    });

    memberUser = await Person.create({
      name: 'P3 Team Member A',
      email: 'member@p3-test.com',
      role: 'team_member',
      jobRole: 'UI Designer',
      departmentId: testDept._id,
      reportsToIds: [leadUser._id],
      status: 'active',
      profileAccess: [testProfileAlpha._id],
    });

    otherMemberUser = await Person.create({
      name: 'P3 Other Member B',
      email: 'othermember@p3-test.com',
      role: 'team_member',
      jobRole: 'Video Editor',
      status: 'active',
      profileAccess: [testProfileBeta._id],
    });
  });

  afterAll(async () => {
    await WorkItem.deleteMany({ title: /P3 Test/i });
    await Person.deleteMany({ email: /@p3-test\.com$/ });
    await Profile.deleteMany({ code: { $in: ['p3_alpha', 'p3_beta'] } });
    await Department.deleteMany({ code: 'p3_design' });
    await ActivityEvent.deleteMany({ 'metadata.title': /P3 Test/i });
  });

  describe('WorkItem Creation & Scoping', () => {
    it('CREATES work item without campaignId and attaches profileId', async () => {
      const deadline = new Date(Date.now() + 3 * 86400000);
      const item = await workItemService.createWorkItem(
        {
          profileId: testProfileAlpha._id,
          title: 'P3 Test: Hero Banner Creative',
          workType: 'Ad Creative',
          departmentId: testDept._id,
          ownerId: memberUser._id,
          deadline,
          estimatedEffortHrs: 6,
          priority: 'High',
          description: 'Create high-converting hero banner for Spring admission.',
        },
        leadUser
      );

      expect(item).toBeDefined();
      expect(item.title).toBe('P3 Test: Hero Banner Creative');
      expect(item.profileId._id.toString()).toBe(testProfileAlpha._id.toString());
      expect(item.status).toBe('Not Started');
      expect(item.isOverdue).toBe(false);
    });

    it('REJECTS work item creation by a lead in an unauthorized brand profile (HTTP 403)', async () => {
      await expect(
        workItemService.createWorkItem(
          {
            profileId: testProfileAlpha._id,
            title: 'P3 Test: Cross-Brand Breach',
            workType: 'Reel',
            departmentId: testDept._id,
            ownerId: otherMemberUser._id,
            deadline: new Date(Date.now() + 86400000),
          },
          otherLeadUser // Only has access to p3_beta
        )
      ).rejects.toThrow(/permission to create work items for this brand profile/);
    });
  });

  describe('Central State Machine & Transition Rules', () => {
    let testItem;

    beforeAll(async () => {
      testItem = await workItemService.createWorkItem(
        {
          profileId: testProfileAlpha._id,
          title: 'P3 Test: Transition Workflow Item',
          workType: 'Landing Page',
          departmentId: testDept._id,
          ownerId: memberUser._id,
          deadline: new Date(Date.now() + 5 * 86400000),
          estimatedEffortHrs: 8,
        },
        leadUser
      );
    });

    it('ALLOWS valid status transition: Not Started -> In Progress', async () => {
      const updated = await transitionService.transitionWorkItem(
        testItem._id,
        { toStatus: 'In Progress' },
        memberUser
      );

      expect(updated.status).toBe('In Progress');
    });

    it('REJECTS invalid transition: In Progress -> Not Started (HTTP 400)', async () => {
      await expect(
        transitionService.transitionWorkItem(
          testItem._id,
          { toStatus: 'Not Started' },
          memberUser
        )
      ).rejects.toThrow(/Invalid transition from "In Progress" to "Not Started"/);
    });

    it('REJECTS transition to Blocked without blockerReason (HTTP 400)', async () => {
      await expect(
        transitionService.transitionWorkItem(
          testItem._id,
          { toStatus: 'Blocked' }, // No blockerReason
          memberUser
        )
      ).rejects.toThrow(/A valid blockerReason is strictly required/);
    });

    it('ALLOWS transition to Blocked with valid blockerReason and records it', async () => {
      const blocked = await transitionService.transitionWorkItem(
        testItem._id,
        {
          toStatus: 'Blocked',
          blockerReason: 'Waiting for feedback',
          blockerNote: 'Waiting for marketing lead to confirm copy copy-deck',
        },
        memberUser
      );

      expect(blocked.status).toBe('Blocked');
      expect(blocked.blockerReason).toBe('Waiting for feedback');
      expect(blocked.blockerNote).toBe('Waiting for marketing lead to confirm copy copy-deck');
    });

    it('ALLOWS transition from Blocked back to In Progress and clears blocker reason', async () => {
      const unblocked = await transitionService.transitionWorkItem(
        testItem._id,
        { toStatus: 'In Progress' },
        memberUser
      );

      expect(unblocked.status).toBe('In Progress');
      expect(unblocked.blockerReason).toBeNull();
    });

    it('ALLOWS transition: In Progress -> Feedback and increments revision count on rework', async () => {
      // Move to Feedback
      await transitionService.transitionWorkItem(
        testItem._id,
        { toStatus: 'Feedback' },
        memberUser
      );

      // Move back to In Progress for revision (Creative Head or Admin required)
      const reworked = await transitionService.transitionWorkItem(
        testItem._id,
        { toStatus: 'In Progress' },
        headUser
      );

      expect(reworked.status).toBe('In Progress');
      expect(reworked.revisions).toBe(1);
    });

    it('BLOCKS team_member from self-approving deliverable (HTTP 403)', async () => {
      // First move to Pending
      await transitionService.transitionWorkItem(
        testItem._id,
        { toStatus: 'Pending' },
        memberUser
      );

      // Attempt approval by member (owner)
      await expect(
        transitionService.transitionWorkItem(
          testItem._id,
          { toStatus: 'Approved' },
          memberUser
        )
      ).rejects.toThrow(/The owner can never approve/);
    });

    it('BLOCKS SM Manager from approving deliverable (HTTP 403)', async () => {
      await expect(
        transitionService.transitionWorkItem(
          testItem._id,
          { toStatus: 'Approved' },
          leadUser
        )
      ).rejects.toThrow(/Review stages can be approved only by Creative Head and Admin/);
    });

    it('ALLOWS Creative Head to approve deliverable and move to Approved', async () => {
      const approved = await transitionService.transitionWorkItem(
        testItem._id,
        { toStatus: 'Approved' },
        headUser
      );

      expect(approved.status).toBe('Approved');
    });

    it('ALLOWS transition: Approved -> Published', async () => {
      const published = await transitionService.transitionWorkItem(
        testItem._id,
        {
          toStatus: 'Published',
          publishedUrl: 'https://haca.edu/live-landing-page',
        },
        leadUser
      );

      expect(published.status).toBe('Published');
      expect(published.publishedUrl).toBe('https://haca.edu/live-landing-page');
    });

    it('BLOCKS unauthorized team member from transitioning someone else\'s item (HTTP 403)', async () => {
      await expect(
        transitionService.transitionWorkItem(
          testItem._id,
          { toStatus: 'In Progress' },
          otherMemberUser
        )
      ).rejects.toThrow(/You can only update status for work items assigned to you/);
    });
  });

  describe('Dynamic Overdue Computation (Never Stored State)', () => {
    let overdueItem, completedPastItem;

    beforeAll(async () => {
      const pastDate = new Date(Date.now() - 2 * 86400000); // 2 days ago

      overdueItem = await workItemService.createWorkItem(
        {
          profileId: testProfileAlpha._id,
          title: 'P3 Test: Dynamic Overdue Item',
          workType: 'Post',
          departmentId: testDept._id,
          ownerId: memberUser._id,
          deadline: pastDate,
          status: 'In Progress',
        },
        leadUser
      );

      completedPastItem = await workItemService.createWorkItem(
        {
          profileId: testProfileAlpha._id,
          title: 'P3 Test: Completed Past Item',
          workType: 'Post',
          departmentId: testDept._id,
          ownerId: memberUser._id,
          deadline: pastDate,
          status: 'Approved',
        },
        leadUser
      );
    });

    it('evaluates isOverdue as TRUE when deadline < now and status is not Approved/Published', async () => {
      const fetched = await workItemService.getWorkItemById(overdueItem._id, leadUser);
      expect(fetched.isOverdue).toBe(true);
    });

    it('evaluates isOverdue as FALSE when deadline < now but status IS Approved', async () => {
      const fetched = await workItemService.getWorkItemById(completedPastItem._id, leadUser);
      expect(fetched.isOverdue).toBe(false);
    });

    it('filters overdue items in listWorkItems using isOverdue filter', async () => {
      const overdueList = await workItemService.listWorkItems({ isOverdue: true }, leadUser);
      const found = overdueList.some((i) => i._id.toString() === overdueItem._id.toString());
      const notFoundApproved = overdueList.some(
        (i) => i._id.toString() === completedPastItem._id.toString()
      );

      expect(found).toBe(true);
      expect(notFoundApproved).toBe(false);
    });
  });

  describe('My Work Personal Partitioning & Priorities', () => {
    it('partitions work items for current user into overdue, today, thisWeek, and upcoming', async () => {
      const myWork = await workItemService.getMyWork(memberUser);

      expect(myWork).toBeDefined();
      expect(Array.isArray(myWork.overdue)).toBe(true);
      expect(Array.isArray(myWork.today)).toBe(true);
      expect(Array.isArray(myWork.thisWeek)).toBe(true);
      expect(Array.isArray(myWork.upcoming)).toBe(true);
      expect(Array.isArray(myWork.completed)).toBe(true);
      expect(myWork.stats).toBeDefined();
      expect(typeof myWork.stats.activeCount).toBe('number');
      expect(typeof myWork.stats.avgRevisions).toBe('number');
    });

    it('returns role-scoped todo priorities', async () => {
      const todo = await workItemService.getTodoItems(memberUser);

      expect(todo).toBeDefined();
      expect(Array.isArray(todo.overdue)).toBe(true);
      expect(Array.isArray(todo.today)).toBe(true);
      expect(Array.isArray(todo.upcoming)).toBe(true);
      expect(typeof todo.total).toBe('number');
    });
  });

  describe('Content Flow Delta: Extended Work Types, Poster Alias, Stage Fields & Brief Links', () => {
    const designRequirementTypes = [
      'Static Post',
      'Carousel Post',
      'Story',
      'Cover Image',
      'Thumbnail',
      'Meta Ad Creative',
      'Class Announcement',
      'Orientation Creative',
      'Graduation Creative',
      'Brochure',
      'Certificate',
      'Offer Creative',
      'Custom Request',
      'Placement Poster',
    ];

    it('creates work items with each of the 14 design requirement types and Reel', async () => {
      for (const wt of [...designRequirementTypes, 'Reel']) {
        const item = await workItemService.createWorkItem(
          {
            profileId: testProfileAlpha._id,
            title: `P3 Test: Design Type ${wt}`,
            workType: wt,
            departmentId: testDept._id,
            ownerId: memberUser._id,
            deadline: new Date(Date.now() + 86400000 * 3),
          },
          leadUser
        );
        expect(item.workType).toBe(wt);
      }
    });

    it('handles Poster as an alias of Static Post and normalizes appropriately', async () => {
      const posterItem = await workItemService.createWorkItem(
        {
          profileId: testProfileAlpha._id,
          title: 'P3 Test: Poster Alias Item',
          workType: 'Poster',
          departmentId: testDept._id,
          ownerId: memberUser._id,
          deadline: new Date(Date.now() + 86400000 * 4),
        },
        leadUser
      );

      expect(posterItem.workType).toBe('Static Post');
    });

    it('supports stage fields: nullable contentPieceId, stageKey, stageOrder, reviewRequired, unlockedAt, isSkipped', async () => {
      const fakeContentPieceId = new mongoose.Types.ObjectId();
      const unlockedDate = new Date();

      const stageItem = await workItemService.createWorkItem(
        {
          profileId: testProfileAlpha._id,
          title: 'P3 Test: Stage Item with Pipeline Metadata',
          workType: 'Static Post',
          departmentId: testDept._id,
          ownerId: memberUser._id,
          deadline: new Date(Date.now() + 86400000 * 5),
          contentPieceId: fakeContentPieceId,
          stageKey: 'Design',
          stageOrder: 2,
          reviewRequired: true,
          unlockedAt: unlockedDate,
          isSkipped: false,
        },
        leadUser
      );

      expect(stageItem.contentPieceId.toString()).toBe(fakeContentPieceId.toString());
      expect(stageItem.stageKey).toBe('Design');
      expect(stageItem.stageOrder).toBe(2);
      expect(stageItem.reviewRequired).toBe(true);
      expect(new Date(stageItem.unlockedAt).toISOString()).toBe(unlockedDate.toISOString());
      expect(stageItem.isSkipped).toBe(false);

      // Verify querying by contentPieceId and stageKey
      const queried = await workItemService.listWorkItems(
        { contentPieceId: fakeContentPieceId.toString(), stageKey: 'Design' },
        leadUser
      );
      expect(queried.length).toBeGreaterThan(0);
      expect(queried.some((q) => q._id.toString() === stageItem._id.toString())).toBe(true);
    });

    it('stores brief with contentLink and assetsLink, syncing to top-level fields', async () => {
      const contentDocUrl = 'https://writer.zoho.com/doc/123456';
      const assetsDriveUrl = 'https://drive.google.com/drive/folders/abcdef';

      // 1. Creation with direct links
      const itemWithLinks = await workItemService.createWorkItem(
        {
          profileId: testProfileAlpha._id,
          title: 'P3 Test: Deliverable Links Direct',
          workType: 'Carousel Post',
          departmentId: testDept._id,
          ownerId: memberUser._id,
          deadline: new Date(Date.now() + 86400000 * 2),
          contentLink: contentDocUrl,
          assetsLink: assetsDriveUrl,
          description: 'Execution brief for Carousel Post',
        },
        leadUser
      );

      expect(itemWithLinks.contentLink).toBe(contentDocUrl);
      expect(itemWithLinks.assetsLink).toBe(assetsDriveUrl);
      expect(itemWithLinks.brief).toBeDefined();
      expect(itemWithLinks.brief.contentLink).toBe(contentDocUrl);
      expect(itemWithLinks.brief.assetsLink).toBe(assetsDriveUrl);
      expect(itemWithLinks.brief.description).toBe('Execution brief for Carousel Post');

      // 2. Creation with brief object
      const itemWithBriefObject = await workItemService.createWorkItem(
        {
          profileId: testProfileAlpha._id,
          title: 'P3 Test: Deliverable Links via Brief Subdocument',
          workType: 'Story',
          departmentId: testDept._id,
          ownerId: memberUser._id,
          deadline: new Date(Date.now() + 86400000 * 2),
          brief: {
            description: 'Story specs with swipe up',
            contentLink: 'https://docs.google.com/document/d/987654',
            assetsLink: 'https://drive.google.com/drive/folders/storyassets',
          },
        },
        leadUser
      );

      expect(itemWithBriefObject.brief.description).toBe('Story specs with swipe up');
      expect(itemWithBriefObject.brief.contentLink).toBe('https://docs.google.com/document/d/987654');
      expect(itemWithBriefObject.brief.assetsLink).toBe('https://drive.google.com/drive/folders/storyassets');
      expect(itemWithBriefObject.contentLink).toBe('https://docs.google.com/document/d/987654');
      expect(itemWithBriefObject.assetsLink).toBe('https://drive.google.com/drive/folders/storyassets');

      // 3. Update via updateWorkItem
      const updatedItem = await workItemService.updateWorkItem(
        itemWithBriefObject._id,
        {
          contentLink: 'https://writer.zoho.com/doc/updated-doc',
          assetsLink: 'https://drive.google.com/drive/folders/updated-assets',
        },
        leadUser
      );

      expect(updatedItem.contentLink).toBe('https://writer.zoho.com/doc/updated-doc');
      expect(updatedItem.assetsLink).toBe('https://drive.google.com/drive/folders/updated-assets');
      expect(updatedItem.brief.contentLink).toBe('https://writer.zoho.com/doc/updated-doc');
      expect(updatedItem.brief.assetsLink).toBe('https://drive.google.com/drive/folders/updated-assets');
    });

    it('keeps standalone work items backward compatible with null contentPieceId', async () => {
      const standalone = await workItemService.createWorkItem(
        {
          profileId: testProfileAlpha._id,
          title: 'P3 Test: Standalone Ad Creative',
          workType: 'Ad Creative',
          departmentId: testDept._id,
          ownerId: memberUser._id,
          deadline: new Date(Date.now() + 86400000 * 2),
        },
        leadUser
      );

      expect(standalone.contentPieceId).toBeNull();
      expect(standalone.stageKey).toBeNull();
      expect(standalone.stageOrder).toBeNull();
      expect(standalone.reviewRequired).toBe(false);
      expect(standalone.isSkipped).toBe(false);
    });
  });
});
