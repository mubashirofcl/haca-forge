import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';
import { connectDB } from '../src/config/db.js';
import { app } from '../src/server.js';
import { Person } from '../src/modules/people/model.js';
import { Profile } from '../src/modules/referenceData/profile.model.js';
import { Department } from '../src/modules/departments/model.js';
import { Submission } from '../src/modules/submissions/model.js';
import { WorkItem } from '../src/modules/workItems/model.js';
import { CalendarPlan } from '../src/modules/calendar/plan.model.js';
import { ContentPiece } from '../src/modules/calendar/contentPiece.model.js';
import { AssignmentOverride } from '../src/modules/assignment/model.js';
import { Notification } from '../src/modules/notifications/model.js';
import * as transitionService from '../src/modules/workItems/transition.service.js';
import * as importService from '../src/modules/calendar/import.service.js';
import {
  derivePlanStatus,
  calculateStageDueDate,
  getPipelineForContent,
  PIPELINES,
  STAGE_KEYS,
  REVIEW_STAGES,
  STAGE_DUE_OFFSETS,
} from '@mmp/shared';

describe('SCOPE RESET R3: Calendar Plans, Creative Head Approval and Assignment Suite', () => {
  let adminUser, headUser, smUser, execUser, writerUser, designerUser, editorUser;
  let adminToken, headToken, smToken, execToken, writerToken;
  let hacaProfile, contentDept, designDept, videoDept;

  function makeToken(user) {
    return jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
        profileAccess: user.profileAccess || [],
      },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  }

  beforeAll(async () => {
    await connectDB();
    await Person.deleteMany({ email: /@r3-test\.com$/ });
    await CalendarPlan.deleteMany({ $or: [{ code: /^PLAN-R3/ }, { title: /R3/ }] });
    await ContentPiece.deleteMany({ topic: /R3/ });
    await WorkItem.deleteMany({ title: /R3/ });

    hacaProfile = await Profile.findOne({ code: 'haca' });
    if (!hacaProfile) {
      hacaProfile = await Profile.create({ name: 'HACA Parent Brand', code: 'haca', active: true });
    }

    contentDept = await Department.findOne({ $or: [{ code: 'seo_content' }, { name: 'SEO & Content' }] });
    if (!contentDept) {
      contentDept = await Department.create({ name: 'SEO & Content', code: 'seo_content', isActive: true });
    }
    designDept = await Department.findOne({ $or: [{ code: 'design' }, { name: 'Design' }] });
    if (!designDept) {
      designDept = await Department.create({ name: 'Design', code: 'design', isActive: true });
    }
    videoDept = await Department.findOne({ $or: [{ code: 'video_production' }, { name: 'Video Production' }] });
    if (!videoDept) {
      videoDept = await Department.create({ name: 'Video Production', code: 'video_production', isActive: true });
    }

    // 1. Admin
    adminUser = await Person.create({
      name: 'System Admin',
      email: 'admin@r3-test.com',
      role: 'admin',
      status: 'active',
      profileAccess: [hacaProfile._id],
    });
    adminToken = makeToken(adminUser);

    // 2. Creative Head
    headUser = await Person.create({
      name: 'Claire Head',
      email: 'creative.head@r3-test.com',
      role: 'creative_head',
      jobRole: 'Creative Manager (TL)',
      status: 'active',
      profileAccess: [hacaProfile._id],
    });
    headToken = makeToken(headUser);

    // 3. SM Manager
    smUser = await Person.create({
      name: 'Sam Manager',
      email: 'sm.manager@r3-test.com',
      role: 'sm_manager',
      jobRole: 'Social Media Manager',
      status: 'active',
      profileAccess: [hacaProfile._id],
    });
    smToken = makeToken(smUser);

    // 4. Executive
    execUser = await Person.create({
      name: 'Edward Exec',
      email: 'exec@r3-test.com',
      role: 'executive',
      status: 'active',
      profileAccess: [hacaProfile._id],
    });
    execToken = makeToken(execUser);

    // 5. Team Members across departments with work preferences
    writerUser = await Person.create({
      name: 'Wendy Writer',
      email: 'writer@r3-test.com',
      role: 'team_member',
      departmentId: contentDept._id,
      jobRole: 'Writer',
      workPreferences: ['Content', 'Script'],
      weeklyCapacityHours: 40,
      status: 'active',
      profileAccess: [hacaProfile._id],
    });
    writerToken = makeToken(writerUser);

    designerUser = await Person.create({
      name: 'Dan Designer',
      email: 'designer@r3-test.com',
      role: 'team_member',
      departmentId: designDept._id,
      jobRole: 'Designer',
      workPreferences: ['Design'],
      weeklyCapacityHours: 40,
      status: 'active',
      profileAccess: [hacaProfile._id],
    });

    editorUser = await Person.create({
      name: 'Eddie Editor',
      email: 'editor@r3-test.com',
      role: 'team_member',
      departmentId: videoDept._id,
      jobRole: 'Video Editor',
      workPreferences: ['Edit', 'Post'],
      weeklyCapacityHours: 40,
      status: 'active',
      profileAccess: [hacaProfile._id],
    });
  });

  afterAll(async () => {
    await Person.deleteMany({ email: /@r3-test\.com$/ });
    await CalendarPlan.deleteMany({ $or: [{ code: /^PLAN-R3/ }, { title: /R3/ }] });
    await ContentPiece.deleteMany({ topic: /R3/ });
    await WorkItem.deleteMany({ title: /R3/ });
  });

  // ==========================================================================
  // 1. IMPORT & VALIDATION PREVIEW
  // ==========================================================================
  describe('1. Import & Validation Preview', () => {
    it('GET /api/calendar-plans/template -> returns valid Excel template buffer', async () => {
      const res = await request(app)
        .get('/api/calendar-plans/template')
        .set('Authorization', `Bearer ${smToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('spreadsheetml');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.body).toBeDefined();
    });

    it('POST /api/calendar-plans/preview -> detects row errors for bad date, unknown type, past date, duplicates, and non-reel flags', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 14);

      const testRows = [
        // Row 1: Valid
        {
          postingDate: futureDate.toISOString().slice(0, 10),
          topic: 'R3 Valid Reel Piece',
          contentType: 'Reel',
          needsScript: true,
          needsShoot: true,
        },
        // Row 2: Past date
        {
          postingDate: pastDate.toISOString().slice(0, 10),
          topic: 'R3 Past Date Post',
          contentType: 'Static Post',
        },
        // Row 3: Bad unparseable date
        {
          postingDate: 'invalid-not-a-date',
          topic: 'R3 Bad Date Story',
          contentType: 'Story',
        },
        // Row 4: Unknown content type
        {
          postingDate: futureDate.toISOString().slice(0, 10),
          topic: 'R3 Unknown Type',
          contentType: 'NonExistentType123',
        },
        // Row 5: Flags on non-reels
        {
          postingDate: futureDate.toISOString().slice(0, 10),
          topic: 'R3 Static Post With Script Flag',
          contentType: 'Static Post',
          needsScript: true,
        },
        // Row 6: Duplicate of Row 1
        {
          postingDate: futureDate.toISOString().slice(0, 10),
          topic: 'R3 Valid Reel Piece',
          contentType: 'Reel',
        },
      ];

      const res = await request(app)
        .post('/api/calendar-plans/preview')
        .set('Authorization', `Bearer ${smToken}`)
        .send({ rows: testRows });

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.totalRows).toBe(6);
      expect(data.hasErrors).toBe(true);

      // Verify specific errors
      const rPast = data.rows.find((r) => r.topic === 'R3 Past Date Post');
      expect(rPast.isValid).toBe(false);
      expect(rPast.errors.some((e) => e.includes('past'))).toBe(true);

      const rBadDate = data.rows.find((r) => r.topic === 'R3 Bad Date Story');
      expect(rBadDate.isValid).toBe(false);
      expect(rBadDate.errors.some((e) => e.includes('Invalid date'))).toBe(true);

      const rUnknown = data.rows.find((r) => r.topic === 'R3 Unknown Type');
      expect(rUnknown.isValid).toBe(false);
      expect(rUnknown.errors.some((e) => e.includes('Unknown content type'))).toBe(true);

      const rFlag = data.rows.find((r) => r.topic === 'R3 Static Post With Script Flag');
      expect(rFlag.isValid).toBe(false);
      expect(rFlag.errors.some((e) => e.includes('apply only to Reels'))).toBe(true);

      const rDup = data.rows[5];
      expect(rDup.isValid).toBe(false);
      expect(rDup.errors.some((e) => e.includes('Duplicate'))).toBe(true);

      // Check preview saves NOTHING to database
      const dbCheck = await ContentPiece.findOne({ topic: 'R3 Valid Reel Piece' });
      expect(dbCheck).toBeNull();
    });

    it('POST /api/calendar-plans/commit -> commits valid rows as Draft into target plan', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 20);

      const validRows = [
        {
          postingDate: futureDate.toISOString().slice(0, 10),
          topic: 'R3 Committed Reel A',
          contentType: 'Reel',
          needsScript: true,
          needsShoot: true,
        },
        {
          postingDate: futureDate.toISOString().slice(0, 10),
          topic: 'R3 Committed Poster',
          contentType: 'Static Post',
        },
      ];

      const res = await request(app)
        .post('/api/calendar-plans/commit')
        .set('Authorization', `Bearer ${smToken}`)
        .send({
          planData: {
            title: 'R3 Test November Social Plan',
            kind: 'monthly',
            periodStart: new Date(),
            periodEnd: new Date(Date.now() + 30 * 86400000),
          },
          rows: validRows,
        });

      expect(res.status).toBe(201);
      const plan = res.body.data;
      expect(plan._id).toBeDefined();
      expect(plan.status).toBe('Draft');
      expect(plan.rows.length).toBe(2);
      expect(plan.rows.every((r) => r.rowStatus === 'draft')).toBe(true);
    });
  });

  // ==========================================================================
  // 2. PLAN STATUS DERIVATION & ROWS EDITING
  // ==========================================================================
  describe('2. Plan Status Derivation & Rows Editing', () => {
    it('derives all plan statuses cleanly', () => {
      expect(derivePlanStatus([])).toBe('Draft');
      expect(derivePlanStatus([], new Date())).toBe('Draft');

      expect(derivePlanStatus([{ rowStatus: 'draft' }, { rowStatus: 'draft' }])).toBe('Draft');
      expect(derivePlanStatus([{ rowStatus: 'submitted' }, { rowStatus: 'submitted' }])).toBe('Submitted');
      expect(derivePlanStatus([{ rowStatus: 'approved' }, { rowStatus: 'changes_requested' }])).toBe('Approved with pending rows');
      expect(derivePlanStatus([{ rowStatus: 'approved' }, { rowStatus: 'draft' }])).toBe('Approved with pending rows');
      expect(derivePlanStatus([{ rowStatus: 'draft' }, { rowStatus: 'changes_requested' }])).toBe('Changes requested');
      expect(derivePlanStatus([{ rowStatus: 'approved' }, { rowStatus: 'approved' }])).toBe('Approved');
    });

    it('allows editing rows only while Draft or Changes requested', async () => {
      const plan = await CalendarPlan.create({
        code: 'PLAN-R3-EDIT-01',
        title: 'R3 Edit Test Plan',
        kind: 'monthly',
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 30 * 86400000),
        createdById: smUser._id,
      });

      const row1 = await ContentPiece.create({
        planId: plan._id,
        postingDate: new Date(Date.now() + 15 * 86400000),
        topic: 'R3 Original Topic',
        contentType: 'Static Post',
        rowStatus: 'draft',
        pipeline: 'design',
      });

      // Edit while draft -> 200
      const editRes = await request(app)
        .patch(`/api/calendar-plans/${plan._id}/rows/${row1._id}`)
        .set('Authorization', `Bearer ${smToken}`)
        .send({ topic: 'R3 Updated Draft Topic' });

      expect(editRes.status).toBe(200);
      expect(editRes.body.data.topic).toBe('R3 Updated Draft Topic');

      // Set to approved -> edit is blocked (400)
      row1.rowStatus = 'approved';
      await row1.save();

      const blockedRes = await request(app)
        .patch(`/api/calendar-plans/${plan._id}/rows/${row1._id}`)
        .set('Authorization', `Bearer ${smToken}`)
        .send({ topic: 'R3 Attempt Edit Approved' });

      expect(blockedRes.status).toBe(400);
    });
  });

  // ==========================================================================
  // 3. SUBMISSION, CREATIVE HEAD REVIEW & STAGE GENERATION
  // ==========================================================================
  describe('3. Submission, Creative Head Review & Stage Generation', () => {
    let testPlan, rowReelA, rowReelB, rowDesignPostable, rowDesignNonPostable;
    const finalDate = new Date(Date.now() + 25 * 86400000);

    beforeEach(async () => {
      testPlan = await CalendarPlan.create({
        code: `PLAN-R3-REV-${Date.now()}`,
        title: 'R3 Review & Stage Generation Plan',
        kind: 'monthly',
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 30 * 86400000),
        createdById: smUser._id,
      });

      // Row 1: Reel Variant A (needs script + shoot)
      rowReelA = await ContentPiece.create({
        planId: testPlan._id,
        postingDate: finalDate,
        topic: 'R3 Reel A Workshop',
        contentType: 'Reel',
        brief: 'Reel A brief workshop',
        forTeam: 'Marketing',
        postingOwnerId: editorUser._id,
        needsScript: true,
        needsShoot: true,
        rowStatus: 'draft',
        pipeline: 'reel_a',
        hasPostStage: true,
        profileId: hacaProfile._id,
      });

      // Row 2: Reel Variant B (no script + shoot)
      rowReelB = await ContentPiece.create({
        planId: testPlan._id,
        postingDate: finalDate,
        topic: 'R3 Reel B Campus Tour',
        contentType: 'Reel',
        brief: 'Reel B brief campus tour',
        forTeam: 'Marketing',
        postingOwnerId: editorUser._id,
        needsScript: false,
        needsShoot: true,
        rowStatus: 'draft',
        pipeline: 'reel_b',
        hasPostStage: true,
        profileId: hacaProfile._id,
      });

      // Row 3: Design postable (Carousel Post)
      rowDesignPostable = await ContentPiece.create({
        planId: testPlan._id,
        postingDate: finalDate,
        topic: 'R3 Carousel 5 Tips',
        contentType: 'Carousel Post',
        brief: 'Carousel tips brief',
        forTeam: 'Marketing',
        postingOwnerId: editorUser._id,
        rowStatus: 'draft',
        pipeline: 'design',
        hasPostStage: true,
        profileId: hacaProfile._id,
      });

      // Row 4: Design non-postable (Certificate)
      rowDesignNonPostable = await ContentPiece.create({
        planId: testPlan._id,
        postingDate: finalDate,
        topic: 'R3 Certificate Design',
        contentType: 'Certificate',
        brief: 'Certificate design brief',
        forTeam: 'Academics',
        rowStatus: 'draft',
        pipeline: 'design',
        hasPostStage: false,
        profileId: hacaProfile._id,
      });
    });

    it('POST /api/calendar-plans/:id/submit -> moves draft rows to submitted and sets submittedAt', async () => {
      const res = await request(app)
        .post(`/api/calendar-plans/${testPlan._id}/submit`)
        .set('Authorization', `Bearer ${smToken}`);

      expect(res.status).toBe(200);
      const plan = res.body.data;
      expect(plan.status).toBe('Submitted');
      expect(plan.rows.every((r) => r.rowStatus === 'submitted')).toBe(true);

      // Verify ZERO stages generated at submission
      const stagesCount = await WorkItem.countDocuments({ calendarPlanId: testPlan._id });
      expect(stagesCount).toBe(0);
    });

    it('Creative Head reviews plan: approve selected rows & request changes with comments', async () => {
      // 1. Submit plan first
      await request(app)
        .post(`/api/calendar-plans/${testPlan._id}/submit`)
        .set('Authorization', `Bearer ${smToken}`);

      // 2. SM Manager cannot review/approve (403 Forbidden)
      const smReviewRes = await request(app)
        .post(`/api/calendar-plans/${testPlan._id}/review`)
        .set('Authorization', `Bearer ${smToken}`)
        .send({ action: 'approve_all' });
      expect(smReviewRes.status).toBe(403);

      // 3. Creative Head reviews: approve rowReelA and rowDesignPostable; request changes on rowReelB
      const chReviewRes = await request(app)
        .post(`/api/calendar-plans/${testPlan._id}/review`)
        .set('Authorization', `Bearer ${headToken}`)
        .send({
          action: 'approve_selected',
          approvedRowIds: [rowReelA._id.toString(), rowDesignPostable._id.toString()],
        });
      expect(chReviewRes.status).toBe(200);

      // Request changes on rowReelB
      const changeRes = await request(app)
        .post(`/api/calendar-plans/${testPlan._id}/review`)
        .set('Authorization', `Bearer ${headToken}`)
        .send({
          action: 'request_changes',
          changes: [
            { rowId: rowReelB._id.toString(), comment: 'Please change hook topic to student perspective' },
          ],
        });
      expect(changeRes.status).toBe(200);

      // Verify derived plan status is "Approved with pending rows"
      const planStatusRes = await request(app)
        .get(`/api/calendar-plans/${testPlan._id}`)
        .set('Authorization', `Bearer ${smToken}`);
      expect(planStatusRes.body.data.status).toBe('Approved with pending rows');

      // 4. CRUCIAL RULE: Stages generated ONLY for approved rows!
      const reelAStages = await WorkItem.find({ contentPieceId: rowReelA._id }).sort({ stageOrder: 1 });
      expect(reelAStages.length).toBe(4); // Script, Shoot, Edit, Post

      const designStages = await WorkItem.find({ contentPieceId: rowDesignPostable._id }).sort({ stageOrder: 1 });
      expect(designStages.length).toBe(3); // Content, Design, Post

      const reelBStages = await WorkItem.find({ contentPieceId: rowReelB._id });
      expect(reelBStages.length).toBe(0); // Changes requested -> ZERO stages!

      const nonPostableStages = await WorkItem.find({ contentPieceId: rowDesignNonPostable._id });
      expect(nonPostableStages.length).toBe(0); // Still submitted -> ZERO stages!
    });

    it('verifies generated stage offsets, due dates, and locked/unlocked state', async () => {
      // Approve rowReelA
      await request(app)
        .post(`/api/calendar-plans/${testPlan._id}/review`)
        .set('Authorization', `Bearer ${headToken}`)
        .send({
          action: 'approve_selected',
          approvedRowIds: [rowReelA._id.toString()],
        });

      const stages = await WorkItem.find({ contentPieceId: rowReelA._id }).sort({ stageOrder: 1 });
      expect(stages.length).toBe(4);

      // Reel Variant A: Script F-10, Shoot F-7, Edit F-4, Post F
      const [scriptStage, shootStage, editStage, postStage] = stages;

      expect(scriptStage.stageKey).toBe('Script');
      expect(scriptStage.stageOrder).toBe(1);
      expect(scriptStage.isLocked).toBe(false); // Stage 1 UNLOCKED
      expect(scriptStage.unlockedAt).toBeDefined();
      expect(scriptStage.reviewRequired).toBe(true);

      const fTime = finalDate.getTime();
      const scriptDue = new Date(scriptStage.dueDate).getTime();
      const diffDays = Math.round((fTime - scriptDue) / (1000 * 3600 * 24));
      expect([8, 10]).toContain(diffDays); // Workflow V2: F - 8 days (formerly 10)

      expect(shootStage.stageKey).toBe('Shoot');
      expect(shootStage.isLocked).toBe(true); // Stage 2 LOCKED
      expect(shootStage.reviewRequired).toBe(true); // WS1: Shoot is a review step

      expect(editStage.stageKey).toBe('Edit');
      expect(editStage.isLocked).toBe(true); // Stage 3 LOCKED
      expect(editStage.reviewRequired).toBe(true);

      expect(postStage.stageKey).toBe('Post');
      expect(postStage.isLocked).toBe(true); // Stage 4 LOCKED
    });
  });

  // ==========================================================================
  // 4. HAND-OFFS & TRANSITION SERVICE
  // ==========================================================================
  describe('4. Hand-offs & Transition Service', () => {
    let testPiece, s1Script, s2Shoot, s3Edit, s4Post;

    beforeEach(async () => {
      const plan = await CalendarPlan.create({
        code: `PLAN-R3-HO-${Date.now()}`,
        title: 'R3 Hand-off Test Plan',
        kind: 'monthly',
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 30 * 86400000),
        createdById: smUser._id,
      });

      testPiece = await ContentPiece.create({
        planId: plan._id,
        postingDate: new Date(Date.now() + 20 * 86400000),
        topic: 'R3 Hand-off Pipeline Flow',
        contentType: 'Reel',
        rowStatus: 'approved',
        pipeline: 'reel_a',
        hasPostStage: true,
      });

      s1Script = await WorkItem.create({
        title: 'R3 Hand-off - Script',
        workType: 'Reel',
        departmentId: contentDept._id,
        ownerId: writerUser._id,
        deadline: new Date(Date.now() + 5 * 86400000),
        status: 'In Progress',
        contentPieceId: testPiece._id,
        stageKey: 'Script',
        stageOrder: 1,
        reviewRequired: true,
        isLocked: false,
        unlockedAt: new Date(),
        deliverableUrl: 'https://docs.google.com/script-sample',
        profileId: hacaProfile._id,
      });

      s2Shoot = await WorkItem.create({
        title: 'R3 Hand-off - Shoot',
        workType: 'Reel',
        departmentId: videoDept._id,
        ownerId: writerUser._id,
        deadline: new Date(Date.now() + 8 * 86400000),
        status: 'Not Started',
        contentPieceId: testPiece._id,
        stageKey: 'Shoot',
        stageOrder: 2,
        reviewRequired: false,
        isLocked: true,
        profileId: hacaProfile._id,
      });

      s3Edit = await WorkItem.create({
        title: 'R3 Hand-off - Edit',
        workType: 'Reel',
        departmentId: videoDept._id,
        ownerId: editorUser._id,
        deadline: new Date(Date.now() + 12 * 86400000),
        status: 'Not Started',
        contentPieceId: testPiece._id,
        stageKey: 'Edit',
        stageOrder: 3,
        reviewRequired: true,
        isLocked: true,
        profileId: hacaProfile._id,
      });

      s4Post = await WorkItem.create({
        title: 'R3 Hand-off - Post',
        workType: 'Reel',
        departmentId: contentDept._id,
        ownerId: editorUser._id,
        deadline: new Date(Date.now() + 15 * 86400000),
        status: 'Not Started',
        contentPieceId: testPiece._id,
        stageKey: 'Post',
        stageOrder: 4,
        reviewRequired: false,
        isLocked: true,
        profileId: hacaProfile._id,
      });
    });

    it('worker submits review stage to Feedback -> Creative Head approves -> unlocks next stage', async () => {
      // 1. Worker submits Script stage for approval
      await transitionService.transitionWorkItem(
        s1Script._id,
        { toStatus: 'Feedback', deliverableUrl: 'https://docs.google.com/script-v1' },
        writerUser
      );

      const inReviewScript = await WorkItem.findById(s1Script._id);
      expect(inReviewScript.status).toBe('Feedback');

      // 2. Worker cannot self-approve (403)
      await expect(
        transitionService.transitionWorkItem(s1Script._id, { toStatus: 'Approved' }, writerUser)
      ).rejects.toThrow(/The owner can never approve their own stage/);

      // 3. SM Manager cannot approve review stage (403)
      await expect(
        transitionService.transitionWorkItem(s1Script._id, { toStatus: 'Approved' }, smUser)
      ).rejects.toThrow(/Review stages can be approved only by Creative Head and Admin/);

      // 4. Creative Head cannot approve a review stage through /transition
      await expect(
        transitionService.transitionWorkItem(s1Script._id, { toStatus: 'Approved' }, headUser)
      ).rejects.toThrow(/Use the review flow/);

      // 5. Creative Head approves Script stage through the review flow, with a rating
      const { approveWithRating } = await import('../src/modules/submissions/service.js');
      const latest = await Submission.findOne({ workItemId: s1Script._id, version: { $gt: 0 } }).sort({ version: -1 });
      await approveWithRating(latest._id, { score: 4 }, headUser);

      // 6. Stage 2 (Shoot) is now UNLOCKED
      const unlockedShoot = await WorkItem.findById(s2Shoot._id);
      expect(unlockedShoot.isLocked).toBe(false);
      expect(unlockedShoot.unlockedAt).toBeDefined();
    });

    it('non-review stage (Shoot): the owner cannot approve it; a Creative Head can, and the next stage unlocks', async () => {
      // Unlock Shoot stage directly
      s2Shoot.isLocked = false;
      s2Shoot.status = 'In Progress';
      await s2Shoot.save();

      // "Done and forward" is gone: the owner cannot approve their own step
      await expect(
        transitionService.transitionWorkItem(
          s2Shoot._id,
          { toStatus: 'Approved', deliverableUrl: 'https://drive.google.com/raw-footage' },
          writerUser
        )
      ).rejects.toThrow(/The owner can never approve their own stage/);

      await transitionService.transitionWorkItem(s2Shoot._id, { toStatus: 'Approved' }, headUser);

      // Stage 3 (Edit) unlocks immediately
      const unlockedEdit = await WorkItem.findById(s3Edit._id);
      expect(unlockedEdit.isLocked).toBe(false);
      expect(unlockedEdit.unlockedAt).toBeDefined();
    });

    it('Post stage: publish with live URL and date updates ContentPiece and computes turnaround days', async () => {
      s4Post.isLocked = false;
      s4Post.status = 'In Progress';
      await s4Post.save();

      // Worker publishes
      await transitionService.transitionWorkItem(
        s4Post._id,
        { toStatus: 'Published', publishedUrl: 'https://instagram.com/reel/r3-live-123' },
        editorUser
      );

      const updatedPiece = await ContentPiece.findById(testPiece._id);
      expect(updatedPiece.publishedAt).toBeDefined();
      expect(updatedPiece.liveUrl).toBe('https://instagram.com/reel/r3-live-123');
      expect(typeof updatedPiece.turnaroundDays).toBe('number');
    });
  });

  // ==========================================================================
  // 5. ASSIGNMENT ENGINE, WORKLOAD & OVERRIDE LOGGING
  // ==========================================================================
  describe('5. Assignment Engine & Workload', () => {
    it('recommends owners matching workPreferences and excludes members >= 85% capacity', async () => {
      const plan = await CalendarPlan.create({
        code: `PLAN-R3-ASGN-${Date.now()}`,
        title: 'R3 Assignment Test Plan',
        kind: 'monthly',
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 30 * 86400000),
        createdById: smUser._id,
      });

      const piece = await ContentPiece.create({
        planId: plan._id,
        postingDate: new Date(Date.now() + 18 * 86400000),
        topic: 'R3 Assignment Matching Piece',
        contentType: 'Static Post',
        pipeline: 'design',
        hasPostStage: true,
      });

      const stage = await WorkItem.create({
        title: 'R3 Piece - Design Stage',
        workType: 'Static Post',
        departmentId: designDept._id,
        ownerId: adminUser._id,
        deadline: new Date(Date.now() + 10 * 86400000),
        contentPieceId: piece._id,
        stageKey: 'Design',
        stageOrder: 2,
        profileId: hacaProfile._id,
      });

      // Query recommendation via API
      const recRes = await request(app)
        .post('/api/content-pieces/recommend-owners')
        .set('Authorization', `Bearer ${smToken}`)
        .send({ pieceId: piece._id });

      expect(recRes.status).toBe(200);
      const recs = recRes.body.data;
      expect(recs.length).toBe(1);
      // Dan Designer holds 'Design' preference and capacity is healthy (<85%)
      expect(recs[0].recommendedPerson.email).toBe('designer@r3-test.com');

      // Now overload all designers in department (allocated hours >= 35 / 40 -> > 85%)
      const allDesigners = await Person.find({ departmentId: designDept._id, role: 'team_member' });
      for (const d of allDesigners) {
        await WorkItem.create({
          title: `R3 Heavy Workload ${d._id}`,
          workType: 'Static Post',
          departmentId: designDept._id,
          ownerId: d._id,
          deadline: new Date(Date.now() + 5 * 86400000),
          estimatedEffortHrs: 38,
          status: 'In Progress',
          profileId: hacaProfile._id,
        });
      }

      // Re-query recommendations: Overloaded candidate is strictly excluded -> "Needs owner"
      const overloadRecRes = await request(app)
        .post('/api/content-pieces/recommend-owners')
        .set('Authorization', `Bearer ${smToken}`)
        .send({ pieceId: piece._id });

      expect(overloadRecRes.status).toBe(200);
      const overloadedRecs = overloadRecRes.body.data;
      expect(overloadedRecs[0].recommendedPerson).toBeNull();
      expect(overloadedRecs[0].rationale).toContain('Needs owner');
    });

    it('SM Manager assigns stage across departments with override logging', async () => {
      const plan = await CalendarPlan.create({
        code: `PLAN-R3-OVR-${Date.now()}`,
        title: 'R3 Override Plan',
        kind: 'monthly',
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 30 * 86400000),
        createdById: smUser._id,
      });

      const piece = await ContentPiece.create({
        planId: plan._id,
        postingDate: new Date(Date.now() + 20 * 86400000),
        topic: 'R3 Cross Dept Piece',
        contentType: 'Static Post',
        pipeline: 'design',
      });

      const stage = await WorkItem.create({
        title: 'R3 Cross Dept Stage',
        workType: 'Static Post',
        departmentId: designDept._id,
        ownerId: designerUser._id,
        deadline: new Date(Date.now() + 10 * 86400000),
        contentPieceId: piece._id,
        stageKey: 'Content',
        stageOrder: 1,
        profileId: hacaProfile._id,
      });

      // SM Manager reassigns Content stage to writerUser with override reason
      const assignRes = await request(app)
        .post('/api/content-pieces/assign')
        .set('Authorization', `Bearer ${smToken}`)
        .send({
          assignments: [
            {
              workItemId: stage._id.toString(),
              assigneeId: writerUser._id.toString(),
              overrideReason: 'Writer specialized in this specific course domain',
            },
          ],
        });

      expect(assignRes.status).toBe(200);

      // Verify workItem owner updated
      const updatedStage = await WorkItem.findById(stage._id);
      expect(updatedStage.ownerId.toString()).toBe(writerUser._id.toString());

      // Verify AssignmentOverride logged
      const overrideLog = await AssignmentOverride.findOne({ workItemId: stage._id });
      expect(overrideLog).toBeDefined();
      expect(overrideLog.reason).toBe('Writer specialized in this specific course domain');
    });
  });

  // ==========================================================================
  // 6. RESCHEDULING & STAGE SKIPPING
  // ==========================================================================
  describe('6. Rescheduling & Stage Skipping', () => {
    it('reschedules final date and shifts unstarted stage deadlines', async () => {
      const plan = await CalendarPlan.create({
        code: `PLAN-R3-RESCH-${Date.now()}`,
        title: 'R3 Reschedule Plan',
        kind: 'monthly',
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 30 * 86400000),
        createdById: smUser._id,
      });

      const originalPostingDate = new Date(Date.now() + 20 * 86400000);
      const piece = await ContentPiece.create({
        planId: plan._id,
        postingDate: originalPostingDate,
        topic: 'R3 Reschedule Piece',
        contentType: 'Static Post',
        pipeline: 'design',
      });

      const stage = await WorkItem.create({
        title: 'R3 Reschedule Stage',
        workType: 'Static Post',
        departmentId: designDept._id,
        ownerId: designerUser._id,
        deadline: new Date(Date.now() + 14 * 86400000),
        dueDate: new Date(Date.now() + 14 * 86400000),
        status: 'Not Started',
        contentPieceId: piece._id,
        stageKey: 'Design',
        stageOrder: 1,
        profileId: hacaProfile._id,
      });

      // Shift posting date 5 days later
      const newPostingDate = new Date(originalPostingDate.getTime() + 5 * 86400000);

      const res = await request(app)
        .patch(`/api/content-pieces/${piece._id}/reschedule`)
        .set('Authorization', `Bearer ${smToken}`)
        .send({
          postingDate: newPostingDate.toISOString(),
          shiftUnstartedStages: true,
        });

      expect(res.status).toBe(200);

      // Verify stage deadline shifted by 5 days
      const updatedStage = await WorkItem.findById(stage._id);
      const shiftedDiff = Math.round(
        (new Date(updatedStage.dueDate).getTime() - new Date(Date.now() + 14 * 86400000).getTime()) /
          (1000 * 3600 * 24)
      );
      expect(shiftedDiff).toBe(5);
    });

    it('skips a stage before it starts and unlocks next stage', async () => {
      const plan = await CalendarPlan.create({
        code: `PLAN-R3-SKIP-${Date.now()}`,
        title: 'R3 Skip Plan',
        kind: 'monthly',
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 30 * 86400000),
        createdById: smUser._id,
      });

      const piece = await ContentPiece.create({
        planId: plan._id,
        postingDate: new Date(Date.now() + 20 * 86400000),
        topic: 'R3 Skip Stage Piece',
        contentType: 'Reel',
        pipeline: 'reel_a',
      });

      const st1 = await WorkItem.create({
        title: 'R3 Skip - Script',
        workType: 'Reel',
        departmentId: contentDept._id,
        ownerId: writerUser._id,
        deadline: new Date(Date.now() + 10 * 86400000),
        status: 'Not Started',
        contentPieceId: piece._id,
        stageKey: 'Script',
        stageOrder: 1,
        isLocked: false,
        profileId: hacaProfile._id,
      });

      const st2 = await WorkItem.create({
        title: 'R3 Skip - Shoot',
        workType: 'Reel',
        departmentId: videoDept._id,
        ownerId: editorUser._id,
        deadline: new Date(Date.now() + 14 * 86400000),
        status: 'Not Started',
        contentPieceId: piece._id,
        stageKey: 'Shoot',
        stageOrder: 2,
        isLocked: true,
        profileId: hacaProfile._id,
      });

      // Skip Stage 1
      const skipRes = await request(app)
        .patch(`/api/content-pieces/${piece._id}/stages/Script/skip`)
        .set('Authorization', `Bearer ${smToken}`)
        .send({ isSkipped: true });

      expect(skipRes.status).toBe(200);

      // Verify Stage 1 is skipped and Stage 2 is unlocked
      const updatedSt1 = await WorkItem.findById(st1._id);
      expect(updatedSt1.isSkipped).toBe(true);

      const updatedSt2 = await WorkItem.findById(st2._id);
      expect(updatedSt2.isLocked).toBe(false);
      expect(updatedSt2.unlockedAt).toBeDefined();
    });
  });

  // ==========================================================================
  // 7. SCOPE PER ROLE & ROUTE-TABLE PERMISSIONS
  // ==========================================================================
  describe('7. Scope per Role & Permissions Verification', () => {
    it('management roles (admin, creative_head, sm_manager, executive) can view plans and tracker', async () => {
      // 1. Admin
      const adminRes = await request(app)
        .get('/api/calendar-plans')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(adminRes.status).toBe(200);

      // 2. Creative Head
      const headRes = await request(app)
        .get('/api/calendar-plans')
        .set('Authorization', `Bearer ${headToken}`);
      expect(headRes.status).toBe(200);

      // 3. SM Manager
      const smRes = await request(app)
        .get('/api/calendar-plans')
        .set('Authorization', `Bearer ${smToken}`);
      expect(smRes.status).toBe(200);

      // 4. Executive (Read-Only)
      const execRes = await request(app)
        .get('/api/calendar-plans')
        .set('Authorization', `Bearer ${execToken}`);
      expect(execRes.status).toBe(200);

      // Tracker table view
      const trackerRes = await request(app)
        .get('/api/content-pieces')
        .set('Authorization', `Bearer ${execToken}`);
      expect(trackerRes.status).toBe(200);
    });

    it('team_member gets 403 Forbidden on /api/calendar-plans and /api/content-pieces', async () => {
      const plansRes = await request(app)
        .get('/api/calendar-plans')
        .set('Authorization', `Bearer ${writerToken}`);
      expect(plansRes.status).toBe(403);

      const trackerRes = await request(app)
        .get('/api/content-pieces')
        .set('Authorization', `Bearer ${writerToken}`);
      expect(trackerRes.status).toBe(403);
    });

    it('executive receives 403 on mutation endpoints (POST /calendar-plans, review, etc.)', async () => {
      const postRes = await request(app)
        .post('/api/calendar-plans')
        .set('Authorization', `Bearer ${execToken}`)
        .send({
          title: 'Exec Attempted Plan',
          periodStart: new Date(),
          periodEnd: new Date(Date.now() + 30 * 86400000),
        });
      expect(postRes.status).toBe(403);

      const assignRes = await request(app)
        .post('/api/content-pieces/assign')
        .set('Authorization', `Bearer ${execToken}`)
        .send({ assignments: [] });
      expect(assignRes.status).toBe(403);
    });
  });

  // ==========================================================================
  // 8. NOTIFICATIONS, APPROVAL GUARDS & BLOCKER SUGGESTIONS
  // ==========================================================================
  describe('8. Notifications, Approval Guards & Blocker Suggestions', () => {
    it('dispatches plan_submitted notification to creative_heads when submitted', async () => {
      await Notification.deleteMany({});

      const plan = await CalendarPlan.create({
        code: `PLAN-R3-NOTIF-${Date.now()}`,
        title: 'Plan Notif Submit',
        kind: 'monthly',
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 30 * 86400000),
        createdById: smUser._id,
      });

      await ContentPiece.create({
        planId: plan._id,
        postingDate: new Date(Date.now() + 15 * 86400000),
        topic: 'Notif Topic',
        contentType: 'Static Post',
        brief: 'Notif Topic Brief',
        forTeam: 'Marketing',
        postingOwnerId: editorUser._id,
        pipeline: 'design',
        rowStatus: 'draft',
      });

      const res = await request(app)
        .post(`/api/calendar-plans/${plan._id}/submit`)
        .set('Authorization', `Bearer ${smToken}`);

      expect(res.status).toBe(200);

      const notif = await Notification.findOne({
        recipient: headUser._id,
        type: 'plan_submitted',
      });
      expect(notif).toBeDefined();
      expect(notif.title).toContain('Calendar Plan Submitted');
    });

    it('dispatches plan_changes_requested to SM Manager when creative_head requests changes', async () => {
      const plan = await CalendarPlan.create({
        code: `PLAN-R3-CR-${Date.now()}`,
        title: 'Plan Notif Changes Requested',
        kind: 'monthly',
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 30 * 86400000),
        createdById: smUser._id,
        submittedAt: new Date(),
      });

      const row = await ContentPiece.create({
        planId: plan._id,
        postingDate: new Date(Date.now() + 15 * 86400000),
        topic: 'Needs Change Topic',
        contentType: 'Static Post',
        pipeline: 'design',
        rowStatus: 'submitted',
      });

      const res = await request(app)
        .post(`/api/calendar-plans/${plan._id}/review`)
        .set('Authorization', `Bearer ${headToken}`)
        .send({
          action: 'request_changes',
          changes: [{ rowId: row._id.toString(), comment: 'Needs better headline' }],
        });

      expect(res.status).toBe(200);

      const notif = await Notification.findOne({
        recipient: smUser._id,
        type: 'plan_changes_requested',
      });
      expect(notif).toBeDefined();
      expect(notif.message).toContain('Creative Head requested changes');
    });

    it('enforces approval and revision guards on review stages: sm_manager and owner cannot approve or request revisions', async () => {
      const plan = await CalendarPlan.create({
        code: `PLAN-R3-GUARD-${Date.now()}`,
        title: 'Guards Plan',
        kind: 'monthly',
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 30 * 86400000),
        createdById: smUser._id,
      });

      const piece = await ContentPiece.create({
        planId: plan._id,
        postingDate: new Date(Date.now() + 20 * 86400000),
        topic: 'Guards Test Piece',
        contentType: 'Static Post',
        pipeline: 'design',
      });

      const stage = await WorkItem.create({
        title: 'Guards Design Stage',
        workType: 'Static Post',
        departmentId: designDept._id,
        ownerId: designerUser._id,
        deadline: new Date(Date.now() + 10 * 86400000),
        status: 'In Progress',
        contentPieceId: piece._id,
        stageKey: 'Design',
        stageOrder: 1,
        profileId: hacaProfile._id,
      });

      // Designer submits to Feedback
      const submitRes = await request(app)
        .post(`/api/work-items/${stage._id}/transition`)
        .set('Authorization', `Bearer ${makeToken(designerUser)}`)
        .send({
          toStatus: 'Feedback',
          deliverableUrl: 'https://drive.google.com/file/d/guards-test',
        });
      expect(submitRes.status).toBe(200);

      // Verify approval_requested notification was sent to creative_head
      const headNotif = await Notification.findOne({
        recipient: headUser._id,
        type: 'approval_requested',
      });
      expect(headNotif).toBeDefined();

      // Guard 1: Designer (owner) attempts to self-approve -> 403
      const selfApproveRes = await request(app)
        .post(`/api/work-items/${stage._id}/transition`)
        .set('Authorization', `Bearer ${makeToken(designerUser)}`)
        .send({ toStatus: 'Approved' });
      expect(selfApproveRes.status).toBe(403);

      // Guard 2: SM Manager attempts to approve review stage -> 403
      const smApproveRes = await request(app)
        .post(`/api/work-items/${stage._id}/transition`)
        .set('Authorization', `Bearer ${smToken}`)
        .send({ toStatus: 'Approved' });
      expect(smApproveRes.status).toBe(403);

      // Guard 3: SM Manager attempts to request revision (Feedback -> In Progress) -> 403
      const smRevRes = await request(app)
        .post(`/api/work-items/${stage._id}/transition`)
        .set('Authorization', `Bearer ${smToken}`)
        .send({ toStatus: 'In Progress', comment: 'SM Manager wanted change' });
      expect(smRevRes.status).toBe(403);

      // Creative Head requests revision -> 200, increments revisions, sends revision_requested notification
      const headRevRes = await request(app)
        .post(`/api/work-items/${stage._id}/transition`)
        .set('Authorization', `Bearer ${headToken}`)
        .send({ toStatus: 'In Progress', comment: 'Adjust colour contrast' });
      expect(headRevRes.status).toBe(200);

      const revStage = await WorkItem.findById(stage._id);
      expect(revStage.revisions).toBe(1);

      const revNotif = await Notification.findOne({
        recipient: designerUser._id,
        type: 'revision_requested',
      });
      expect(revNotif).toBeDefined();
      expect(revNotif.message).toContain('Adjust colour contrast');
    });

    it('stage unlocking sends stage_unlocked if owner assigned, or needs_owner to SM Manager if unassigned', async () => {
      const plan = await CalendarPlan.create({
        code: `PLAN-R3-NOTIF-UNLOCK-${Date.now()}`,
        title: 'Unlock Notif Plan',
        kind: 'monthly',
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 30 * 86400000),
        createdById: smUser._id,
      });

      const piece = await ContentPiece.create({
        planId: plan._id,
        postingDate: new Date(Date.now() + 20 * 86400000),
        topic: 'Unlock Notif Piece',
        contentType: 'Reel',
        pipeline: 'reel_a',
      });

      const st1 = await WorkItem.create({
        title: 'Unlock Stage 1 - Script',
        workType: 'Reel',
        departmentId: contentDept._id,
        ownerId: writerUser._id,
        deadline: new Date(Date.now() + 5 * 86400000),
        status: 'In Progress',
        contentPieceId: piece._id,
        stageKey: 'Script',
        stageOrder: 1,
        isLocked: false,
        profileId: hacaProfile._id,
      });

      const st2 = await WorkItem.create({
        title: 'Unlock Stage 2 - Shoot (Unassigned)',
        workType: 'Reel',
        departmentId: videoDept._id,
        ownerId: null, // No owner
        deadline: new Date(Date.now() + 10 * 86400000),
        status: 'Not Started',
        contentPieceId: piece._id,
        stageKey: 'Shoot',
        stageOrder: 2,
        isLocked: true,
        profileId: hacaProfile._id,
      });

      // Submit Stage 1 to Feedback and have Creative Head approve it
      await request(app)
        .post(`/api/work-items/${st1._id}/transition`)
        .set('Authorization', `Bearer ${writerToken}`)
        .send({ toStatus: 'Feedback', deliverableUrl: 'https://docs.google.com/script' });

      await request(app)
        .post(`/api/work-items/${st1._id}/transition`)
        .set('Authorization', `Bearer ${headToken}`)
        .send({ toStatus: 'Approved' });

      // Stage 2 unlocked without owner -> needs_owner sent to sm_manager
      const needsOwnerNotif = await Notification.findOne({
        recipient: smUser._id,
        type: 'needs_owner',
      });
      expect(needsOwnerNotif).toBeDefined();
      expect(needsOwnerNotif.title).toContain('Needs Owner');
    });

    it('populates suggestedDependencyOwner and previousStage for blockers', async () => {
      const plan = await CalendarPlan.create({
        code: `PLAN-R3-BLOCKER-${Date.now()}`,
        title: 'Blocker Suggestion Plan',
        kind: 'monthly',
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 30 * 86400000),
        createdById: smUser._id,
      });

      const piece = await ContentPiece.create({
        planId: plan._id,
        postingDate: new Date(Date.now() + 20 * 86400000),
        topic: 'Blocker Piece',
        contentType: 'Reel',
        pipeline: 'reel_a',
      });

      const st1 = await WorkItem.create({
        title: 'Blocker Stage 1 - Script',
        workType: 'Reel',
        departmentId: contentDept._id,
        ownerId: writerUser._id,
        deadline: new Date(Date.now() + 5 * 86400000),
        status: 'Approved',
        deliverableUrl: 'https://docs.google.com/script-done',
        contentPieceId: piece._id,
        stageKey: 'Script',
        stageOrder: 1,
        isLocked: false,
        profileId: hacaProfile._id,
      });

      const st2 = await WorkItem.create({
        title: 'Blocker Stage 2 - Shoot',
        workType: 'Reel',
        departmentId: videoDept._id,
        ownerId: editorUser._id,
        deadline: new Date(Date.now() + 10 * 86400000),
        status: 'In Progress',
        contentPieceId: piece._id,
        stageKey: 'Shoot',
        stageOrder: 2,
        isLocked: false,
        profileId: hacaProfile._id,
      });

      const res = await request(app)
        .get(`/api/work-items/${st2._id}`)
        .set('Authorization', `Bearer ${makeToken(editorUser)}`);

      expect(res.status).toBe(200);
      expect(res.body.data.previousStage).toBeDefined();
      expect(res.body.data.previousStage.stageKey).toBe('Script');
      expect(res.body.data.previousStage.deliverableUrl).toBe('https://docs.google.com/script-done');
      expect(res.body.data.suggestedDependencyOwner).toBeDefined();
      expect(res.body.data.suggestedDependencyOwner._id.toString()).toBe(writerUser._id.toString());
    });
  });

  afterAll(async () => {
    await Person.deleteMany({ email: /@r3-test\.com$/ });
    await CalendarPlan.deleteMany({ $or: [{ code: /^PLAN-R3/ }, { title: /R3/ }] });
    await ContentPiece.deleteMany({ topic: /R3/ });
    await WorkItem.deleteMany({ $or: [{ title: /R3/ }, { title: /Blocker Stage/ }, { title: /Unlock Stage/ }, { title: /Guards/ }] });
    await ContentPiece.deleteMany({ topic: { $in: ['Notif Topic', 'Needs Change Topic', 'Guards Test Piece', 'Unlock Notif Piece', 'Blocker Piece'] } });
    await AssignmentOverride.deleteMany({});
  });
});

