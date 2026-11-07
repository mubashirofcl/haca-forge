import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/server.js';
import { env } from '../src/config/env.js';
import { Person } from '../src/modules/people/model.js';
import { Profile } from '../src/modules/referenceData/profile.model.js';
import { Department } from '../src/modules/departments/model.js';
import { AccessRequest } from '../src/modules/access/model.js';
import { CalendarPlan } from '../src/modules/calendar/plan.model.js';
import { ContentPiece } from '../src/modules/calendar/contentPiece.model.js';
import { Submission } from '../src/modules/submissions/model.js';
import { MediaItem } from '../src/modules/media/model.js';
import { WorkItem } from '../src/modules/workItems/model.js';
import { Blocker } from '../src/modules/blockers/model.js';
import { Notification } from '../src/modules/notifications/model.js';
import { connectDB } from '../src/config/db.js';

describe('Workflow V2 Role Journeys Verification Suite (Journeys A through G)', () => {
  let adminUser, creativeHeadUser, smManagerUser, execUser;
  let writerUser, designerUser, videographerUser, editorUser, posterUser;
  let adminToken, creativeHeadToken, smManagerToken, execToken;
  let writerToken, designerToken, videographerToken, editorToken, posterToken;
  let profileHaca, deptCreative, deptContent, deptVideo, deptSocial;

  let approvedPlan, approvedRowReelA, approvedRowReelC, approvedRowPostablePoster, approvedRowNonPostablePoster;

  function makeToken(user) {
    return jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      },
      env.JWT_SECRET,
      { expiresIn: '2h' }
    );
  }

  beforeAll(async () => {
    await connectDB();

    // Clean up test collections
    await Person.deleteMany({ email: /@wv2-journey\.com$/ });
    await Profile.deleteMany({ code: 'wv2_haca' });
    await Department.deleteMany({ code: /wv2_/ });
    await CalendarPlan.deleteMany({ title: /WV2 / });
    await ContentPiece.deleteMany({ topic: /WV2 / });
    await WorkItem.deleteMany({ title: /WV2 / });
    await AccessRequest.deleteMany({ email: /@wv2-journey\.com$/ });
    await Blocker.deleteMany({});
    await Notification.deleteMany({});

    // Profile
    profileHaca = await Profile.create({
      name: 'HACA Master Brand',
      code: 'wv2_haca',
      active: true,
    });

    // Departments
    deptCreative = await Department.create({ name: 'WV2 Design', code: 'wv2_design' });
    deptContent = await Department.create({ name: 'WV2 Content', code: 'wv2_content' });
    deptVideo = await Department.create({ name: 'WV2 Video', code: 'wv2_video' });
    deptSocial = await Department.create({ name: 'WV2 Social', code: 'wv2_social' });

    // Seed core users
    adminUser = await Person.create({
      name: 'WV2 Admin',
      email: 'admin@wv2-journey.com',
      role: 'admin',
      passwordHash: 'dummy',
      departmentId: deptCreative._id,
      status: 'active',
    });
    adminToken = makeToken(adminUser);

    creativeHeadUser = await Person.create({
      name: 'WV2 Creative Head',
      email: 'creative.head@wv2-journey.com',
      role: 'creative_head',
      passwordHash: 'dummy',
      departmentId: deptCreative._id,
      status: 'active',
    });
    creativeHeadToken = makeToken(creativeHeadUser);

    smManagerUser = await Person.create({
      name: 'WV2 SM Manager',
      email: 'sm.manager@wv2-journey.com',
      role: 'sm_manager',
      passwordHash: 'dummy',
      departmentId: deptSocial._id,
      status: 'active',
    });
    smManagerToken = makeToken(smManagerUser);

    execUser = await Person.create({
      name: 'WV2 Executive',
      email: 'executive@wv2-journey.com',
      role: 'executive',
      passwordHash: 'dummy',
      departmentId: deptCreative._id,
      status: 'active',
    });
    execToken = makeToken(execUser);

    // Seed workers with specific workPreferences
    writerUser = await Person.create({
      name: 'WV2 Writer',
      email: 'writer@wv2-journey.com',
      role: 'team_member',
      passwordHash: 'dummy',
      departmentId: deptContent._id,
      workPreferences: ['Content', 'Script'],
      weeklyCapacityHours: 40,
      status: 'active',
    });
    writerToken = makeToken(writerUser);

    designerUser = await Person.create({
      name: 'WV2 Designer',
      email: 'designer@wv2-journey.com',
      role: 'team_member',
      passwordHash: 'dummy',
      departmentId: deptCreative._id,
      workPreferences: ['Design'],
      weeklyCapacityHours: 40,
      status: 'active',
    });
    designerToken = makeToken(designerUser);

    videographerUser = await Person.create({
      name: 'WV2 Videographer',
      email: 'videographer@wv2-journey.com',
      role: 'team_member',
      passwordHash: 'dummy',
      departmentId: deptVideo._id,
      workPreferences: ['Shoot'],
      weeklyCapacityHours: 40,
      status: 'active',
    });
    videographerToken = makeToken(videographerUser);

    editorUser = await Person.create({
      name: 'WV2 Editor',
      email: 'editor@wv2-journey.com',
      role: 'team_member',
      passwordHash: 'dummy',
      departmentId: deptVideo._id,
      workPreferences: ['Edit'],
      weeklyCapacityHours: 40,
      status: 'active',
    });
    editorToken = makeToken(editorUser);

    posterUser = await Person.create({
      name: 'WV2 Poster Publisher',
      email: 'poster@wv2-journey.com',
      role: 'team_member',
      passwordHash: 'dummy',
      departmentId: deptSocial._id,
      workPreferences: ['Post'],
      weeklyCapacityHours: 40,
      status: 'active',
    });
    posterToken = makeToken(posterUser);
  });

  afterAll(async () => {
    // Cleanup
    await Person.deleteMany({ email: /@wv2-journey\.com$/ });
    await Profile.deleteMany({ code: 'wv2_haca' });
    await Department.deleteMany({ code: /wv2_/ });
    await CalendarPlan.deleteMany({ title: /WV2 / });
    await ContentPiece.deleteMany({ topic: /WV2 / });
    await WorkItem.deleteMany({ title: /WV2 / });
    await AccessRequest.deleteMany({ email: /@wv2-journey\.com$/ });
    await Blocker.deleteMany({});
    await Notification.deleteMany({});
  });

  // =========================================================================
  // JOURNEY A: Admin approves a user; SM Manager builds a plan with Reel A,
  // Reel C, postable poster & non-postable poster using autofill and one manual
  // date change, then submits.
  // =========================================================================
  describe('Journey A: Admin User Approval & SM Manager Plan Creation with Autofill', () => {
    let approvedCandidate;

    it('Step 1: Inbound Access Request and Admin Approval', async () => {
      // 1. Inbound access request submitted
      const reqRes = await request(app)
        .post('/api/auth/request-access')
        .send({
          name: 'WV2 New Candidate',
          email: 'candidate@wv2-journey.com',
          phone: '9876543210',
          department: deptContent.name,
          jobRole: 'Writer',
          requestedRole: 'team_member',
          requestedProfileCodes: ['wv2_haca'],
          reason: 'Joining marketing copy team to write content.',
        });
      expect(reqRes.status).toBe(201);
      const accessReqId = reqRes.body.requestId || reqRes.body.data?._id;

      // 2. Admin reviews and approves user
      const approveRes = await request(app)
        .post(`/api/admin/access-requests/${accessReqId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'approved',
          assignedRole: 'team_member',
          jobRole: 'Writer',
        });
      expect(approveRes.status).toBe(200);

      // Verify Person was created
      approvedCandidate = await Person.findOne({ email: 'candidate@wv2-journey.com' });
      expect(approvedCandidate).toBeDefined();
      expect(approvedCandidate.role).toBe('team_member');
      expect(approvedCandidate.status).toBe('active');
    });

    it('Step 2: SM Manager builds plan with Reel A, Reel C, Postable Poster, and Non-Postable Poster', async () => {
      // Create draft monthly plan
      const planRes = await request(app)
        .post('/api/calendar-plans')
        .set('Authorization', `Bearer ${smManagerToken}`)
        .send({
          title: 'WV2 Tech School November 2026 Plan',
          kind: 'monthly',
          periodStart: new Date(Date.now() + 5 * 86400000).toISOString(),
          periodEnd: new Date(Date.now() + 35 * 86400000).toISOString(),
          comment: 'November calendar with 4 key variants',
        });
      expect(planRes.status).toBe(201);
      const plan = planRes.body.data;
      expect(plan.code).toBeDefined();

      const postingDate = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10);

      // 1. Autofill Reel A (needsScript: true, needsShoot: true)
      const autofillReelARes = await request(app)
        .post('/api/calendar-plans/autofill')
        .set('Authorization', `Bearer ${smManagerToken}`)
        .send({
          type: 'Reel',
          postingDate,
          needsScript: true,
          needsShoot: true,
        });
      expect(autofillReelARes.status).toBe(200);
      const reelAData = autofillReelARes.body.data;
      expect(reelAData.pipeline).toBe('reel_a');
      expect(reelAData.stages.map((s) => s.stageKey)).toEqual(['Script', 'Shoot', 'Edit', 'Post']);

      // 2. Autofill Reel C (needsScript: false, needsShoot: false)
      const autofillReelCRes = await request(app)
        .post('/api/calendar-plans/autofill')
        .set('Authorization', `Bearer ${smManagerToken}`)
        .send({
          type: 'Reel',
          postingDate,
          needsScript: false,
          needsShoot: false,
        });
      expect(autofillReelCRes.status).toBe(200);
      const reelCData = autofillReelCRes.body.data;
      expect(reelCData.pipeline).toBe('reel_c');
      expect(reelCData.stages.map((s) => s.stageKey)).toEqual(['Edit', 'Post']);

      // 3. Autofill Postable Poster (Static Post)
      const autofillPostableRes = await request(app)
        .post('/api/calendar-plans/autofill')
        .set('Authorization', `Bearer ${smManagerToken}`)
        .send({
          type: 'Static Post',
          postingDate,
        });
      expect(autofillPostableRes.status).toBe(200);
      const postableData = autofillPostableRes.body.data;
      expect(postableData.hasPostStage).toBe(true);

      // 4. Autofill Non-Postable Poster (Poster)
      const autofillNonPostableRes = await request(app)
        .post('/api/calendar-plans/autofill')
        .set('Authorization', `Bearer ${smManagerToken}`)
        .send({
          type: 'Poster',
          postingDate,
        });
      expect(autofillNonPostableRes.status).toBe(200);
      const nonPostableData = autofillNonPostableRes.body.data;
      expect(nonPostableData.hasPostStage).toBe(false);

      // Modify one date manually on Reel A: change Script deadline to 1 day earlier
      const manualReelAStages = reelAData.stages.map((s) => {
        if (s.stageKey === 'Script') {
          const manualDate = new Date(new Date(s.dueDate).getTime() - 86400000).toISOString();
          return {
            ...s,
            dueDate: manualDate,
            dueDateSource: 'manual',
            overrideReason: 'Set earlier for thorough script review',
          };
        }
        return s;
      });

      // Add all 4 rows to the plan
      const addRowsRes = await request(app)
        .post(`/api/calendar-plans/${plan._id}/rows`)
        .set('Authorization', `Bearer ${smManagerToken}`)
        .send({
          rows: [
            {
              postingDate,
              topic: 'WV2 Campus Life Highlights Reel',
              type: 'Reel',
              forTeam: 'Marketing',
              brief: 'Show dynamic campus student interactions and maker spaces.',
              needsScript: true,
              needsShoot: true,
              priority: 'Normal',
              postingOwnerId: posterUser._id.toString(),
              stagePlan: manualReelAStages,
            },
            {
              postingDate,
              topic: 'WV2 Student Testimonial Quick Cut',
              type: 'Reel',
              forTeam: 'Marketing',
              brief: 'Cut highlights from program recording.',
              needsScript: false,
              needsShoot: false,
              sourceVideoLink: 'https://drive.google.com/test-source-video-reel-c',
              priority: 'Normal',
              postingOwnerId: posterUser._id.toString(),
              stagePlan: reelCData.stages,
            },
            {
              postingDate,
              topic: 'WV2 Admissions Open Social Announcement',
              type: 'Static Post',
              forTeam: 'Sales',
              brief: 'Bold graphic announcing Fall 2026 early bird deadlines.',
              priority: 'Urgent',
              postingOwnerId: posterUser._id.toString(),
              stagePlan: postableData.stages,
            },
            {
              postingDate,
              topic: 'WV2 Campus Directional Signage Standee',
              type: 'Poster',
              forTeam: 'Academics',
              brief: 'Large format directional print poster for registration hall.',
              priority: 'Normal',
              stagePlan: nonPostableData.stages,
            },
          ],
        });
      expect(addRowsRes.status).toBe(201);
      expect(addRowsRes.body.data.rows.length).toBe(4);

      // 5. Submit the plan
      const submitRes = await request(app)
        .post(`/api/calendar-plans/${plan._id}/submit`)
        .set('Authorization', `Bearer ${smManagerToken}`);
      expect(submitRes.status).toBe(200);
      expect(submitRes.body.data.status).toBe('Submitted');

      approvedPlan = submitRes.body.data;
    });
  });

  // =========================================================================
  // JOURNEY B: Creative Head requests changes on one row; SM Manager fixes
  // and resubmits; Creative Head approves; stages exist with chosen owners/dates.
  // =========================================================================
  describe('Journey B: Creative Head Review, Row Changes Requested, Resubmission & Approval', () => {
    it('Step 1: Creative Head requests changes on one row without rejecting the plan', async () => {
      const rows = approvedPlan.rows;
      const targetRow = rows[0];

      const reviewRes = await request(app)
        .post(`/api/calendar-plans/${approvedPlan._id}/review`)
        .set('Authorization', `Bearer ${creativeHeadToken}`)
        .send({
          action: 'request_changes',
          changes: [
            {
              rowId: targetRow._id,
              comment: 'Please specify the exact lab spaces and student names in the brief.',
            },
          ],
        });
      expect(reviewRes.status).toBe(200);
      expect(reviewRes.body.data.status).toBe('Changes requested');

      // Verify row status
      const updatedRow = await ContentPiece.findById(targetRow._id);
      expect(updatedRow.rowStatus).toBe('changes_requested');
      expect(updatedRow.reviewComment).toContain('specify the exact lab spaces');
    });

    it('Step 2: SM Manager fixes the flagged row and resubmits the plan', async () => {
      const targetRow = approvedPlan.rows[0];

      // SM Manager updates the brief
      const updateRowRes = await request(app)
        .patch(`/api/calendar-plans/${approvedPlan._id}/rows/${targetRow._id}`)
        .set('Authorization', `Bearer ${smManagerToken}`)
        .send({
          brief: 'Show Robotics Lab, AI Design Studio and students Alex and Maya working on projects.',
          remarks: 'Updated brief per Creative Head review notes.',
        });
      expect(updateRowRes.status).toBe(200);
      expect(updateRowRes.body.data.brief).toContain('Robotics Lab');

      // Resubmit
      const resubmitRes = await request(app)
        .post(`/api/calendar-plans/${approvedPlan._id}/submit`)
        .set('Authorization', `Bearer ${smManagerToken}`);
      expect(resubmitRes.status).toBe(200);
      expect(resubmitRes.body.data.status).toBe('Submitted');
    });

    it('Step 3: Creative Head approves plan; stages exist with chosen owners and dates; Stage 1 unlocked', async () => {
      // Creative Head approves all rows
      const approveRes = await request(app)
        .post(`/api/calendar-plans/${approvedPlan._id}/review`)
        .set('Authorization', `Bearer ${creativeHeadToken}`)
        .send({
          action: 'approve_all',
        });
      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.status).toBe('Approved');

      // Load all ContentPieces
      const planPieces = await ContentPiece.find({ planId: approvedPlan._id }).sort({ createdAt: 1 });
      expect(planPieces.length).toBe(4);

      approvedRowReelA = planPieces[0];
      approvedRowReelC = planPieces[1];
      approvedRowPostablePoster = planPieces[2];
      approvedRowNonPostablePoster = planPieces[3];

      // Verify stages generated for Reel A
      const reelAStages = await WorkItem.find({ contentPieceId: approvedRowReelA._id }).sort({ stageOrder: 1 });
      expect(reelAStages.length).toBe(4);
      expect(reelAStages[0].stageKey).toBe('Script');
      expect(reelAStages[0].isLocked).toBe(false); // Stage 1 UNLOCKED
      expect(reelAStages[0].unlockedAt).toBeDefined();
      expect(reelAStages[1].stageKey).toBe('Shoot');
      expect(reelAStages[1].isLocked).toBe(true);  // Stage 2 LOCKED
      expect(reelAStages[2].stageKey).toBe('Edit');
      expect(reelAStages[2].isLocked).toBe(true);  // Stage 3 LOCKED
      expect(reelAStages[3].stageKey).toBe('Post');
      expect(reelAStages[3].isLocked).toBe(true);  // Stage 4 LOCKED

      // Verify stages generated for Postable Poster (Content -> Design -> Post)
      const postableStages = await WorkItem.find({ contentPieceId: approvedRowPostablePoster._id }).sort({ stageOrder: 1 });
      expect(postableStages.length).toBe(3);
      expect(postableStages[0].stageKey).toBe('Content');
      expect(postableStages[0].isLocked).toBe(false);
      expect(postableStages[1].stageKey).toBe('Design');
      expect(postableStages[1].isLocked).toBe(true);
      expect(postableStages[2].stageKey).toBe('Post');
      expect(postableStages[2].isLocked).toBe(true);

      // Verify stages generated for Non-Postable Poster (Content -> Design; NO Post stage)
      const nonPostableStages = await WorkItem.find({ contentPieceId: approvedRowNonPostablePoster._id }).sort({ stageOrder: 1 });
      expect(nonPostableStages.length).toBe(2);
      expect(nonPostableStages[0].stageKey).toBe('Content');
      expect(nonPostableStages[1].stageKey).toBe('Design');
      expect(nonPostableStages.some((s) => s.stageKey === 'Post')).toBe(false);
    });
  });

  // =========================================================================
  // JOURNEY C: Worker stages: content, design, script, shoot (Done and forward),
  // edit; Creative Head approves each review stage; one revision loop; posting
  // owner publishes; the Tracker shows holder, late by days and the timeline.
  // =========================================================================
  describe('Journey C: Stage Execution, Revision Loop, Shoot Review, Publication & Live Tracker', () => {
    const latestVersion = (id) => Submission.findOne({ workItemId: id, version: { $gt: 0 } }).sort({ version: -1 });
    const reviewApprove = async (id, body = { score: 4 }) => {
      const latest = await latestVersion(id);
      return request(app)
        .post(`/api/submissions/${latest._id}/approve`)
        .set('Authorization', `Bearer ${creativeHeadToken}`)
        .send(body);
    };

    it('Step 1: Content Writer stage with one revision loop', async () => {
      // Find Stage 1 (Content) of Postable Poster
      const contentStage = await WorkItem.findOne({
        contentPieceId: approvedRowPostablePoster._id,
        stageKey: 'Content',
      });
      expect(contentStage).toBeDefined();

      // Ensure stage is assigned to writerUser
      contentStage.ownerId = writerUser._id;
      await contentStage.save();

      // Worker starts work: Not Started -> In Progress
      const startRes = await request(app)
        .post(`/api/work/${contentStage._id}/transition`)
        .set('Authorization', `Bearer ${writerToken}`)
        .send({
          toStatus: 'In Progress',
        });
      expect(startRes.status).toBe(200);

      // Worker submits deliverable for review: In Progress -> Feedback
      const submitRes = await request(app)
        .post(`/api/work/${contentStage._id}/transition`)
        .set('Authorization', `Bearer ${writerToken}`)
        .send({
          toStatus: 'Feedback',
          deliverableUrl: 'https://docs.google.com/document/d/first-draft-copy',
        });
      expect(submitRes.status).toBe(200);

      // Creative Head triggers Revision Loop through the review flow
      const firstVersion = await latestVersion(contentStage._id);
      const revisionRes = await request(app)
        .post(`/api/submissions/${firstVersion._id}/request-revision`)
        .set('Authorization', `Bearer ${creativeHeadToken}`)
        .send({
          comment: 'Tone is too casual for an admissions announcement. Please refine disclosures.',
        });
      expect(revisionRes.status).toBe(200);

      const afterRevisionItem = await WorkItem.findById(contentStage._id);
      expect(afterRevisionItem.status).toBe('In Progress');
      expect(afterRevisionItem.revisions).toBe(1); // Revision count incremented

      // Worker updates deliverable and resubmits
      await request(app)
        .post(`/api/work/${contentStage._id}/transition`)
        .set('Authorization', `Bearer ${writerToken}`)
        .send({
          toStatus: 'Feedback',
          deliverableUrl: 'https://docs.google.com/document/d/revised-draft-copy',
        });

      // Creative Head approves Content stage
      const approveContentRes = await reviewApprove(contentStage._id, { score: 5, feedback: 'Excellent copy. Approved.' });
      expect(approveContentRes.status).toBe(200);

      // Verify Stage 2 (Design) is automatically unlocked
      const designStage = await WorkItem.findOne({
        contentPieceId: approvedRowPostablePoster._id,
        stageKey: 'Design',
      });
      expect(designStage.isLocked).toBe(false);
      expect(designStage.unlockedAt).toBeDefined();
    });

    it('Step 2: Designer completes visual assets and Creative Head approves', async () => {
      const designStage = await WorkItem.findOne({
        contentPieceId: approvedRowPostablePoster._id,
        stageKey: 'Design',
      });
      designStage.ownerId = designerUser._id;
      await designStage.save();

      // Designer starts and submits
      await request(app)
        .post(`/api/work/${designStage._id}/transition`)
        .set('Authorization', `Bearer ${designerToken}`)
        .send({ toStatus: 'In Progress' });

      await request(app)
        .post(`/api/work/${designStage._id}/transition`)
        .set('Authorization', `Bearer ${designerToken}`)
        .send({
          toStatus: 'Feedback',
          deliverableUrl: 'https://drive.google.com/file/d/admissions-poster-design',
        });

      // Creative Head approves Design stage
      const approveDesignRes = await reviewApprove(designStage._id);
      expect(approveDesignRes.status).toBe(200);

      // Verify Stage 3 (Post) is unlocked
      const postStage = await WorkItem.findOne({
        contentPieceId: approvedRowPostablePoster._id,
        stageKey: 'Post',
      });
      expect(postStage.isLocked).toBe(false);
      expect(postStage.unlockedAt).toBeDefined();
    });

    it('Step 3: Reel A Shoot stage cannot skip review; approval unlocks Edit stage', async () => {
      // Complete Script stage on Reel A
      const scriptStage = await WorkItem.findOne({
        contentPieceId: approvedRowReelA._id,
        stageKey: 'Script',
      });
      scriptStage.ownerId = writerUser._id;
      await scriptStage.save();

      await request(app)
        .post(`/api/work/${scriptStage._id}/transition`)
        .set('Authorization', `Bearer ${writerToken}`)
        .send({ toStatus: 'In Progress' });

      await request(app)
        .post(`/api/work/${scriptStage._id}/transition`)
        .set('Authorization', `Bearer ${writerToken}`)
        .send({ toStatus: 'Feedback', deliverableUrl: 'https://docs.google.com/reel-script' });

      expect((await reviewApprove(scriptStage._id)).status).toBe(200);

      // Shoot stage is now unlocked
      const shootStage = await WorkItem.findOne({
        contentPieceId: approvedRowReelA._id,
        stageKey: 'Shoot',
      });
      expect(shootStage.isLocked).toBe(false);

      shootStage.ownerId = videographerUser._id;
      await shootStage.save();

      // Videographer executes the shoot
      const shootForwardRes = await request(app)
        .post(`/api/work/${shootStage._id}/transition`)
        .set('Authorization', `Bearer ${videographerToken}`)
        .send({
          toStatus: 'In Progress',
          deliverableUrl: 'https://drive.google.com/drive/folders/raw-shoot-footage',
        });
      expect(shootForwardRes.status).toBe(200);

      // "Done and forward" is gone: the videographer cannot approve their own step
      const selfApproveRes = await request(app)
        .post(`/api/work/${shootStage._id}/transition`)
        .set('Authorization', `Bearer ${videographerToken}`)
        .send({
          toStatus: 'Approved',
          deliverableUrl: 'https://drive.google.com/drive/folders/raw-shoot-footage',
        });
      expect(selfApproveRes.status).toBe(403);

      // It is submitted with an approved clip, then approved through review
      await MediaItem.create({ stageItemId: shootStage._id, url: 'https://drive.google.com/file/d/clip.mp4', title: 'Reel A clip', status: 'approved' });
      await request(app)
        .post(`/api/work/${shootStage._id}/transition`)
        .set('Authorization', `Bearer ${videographerToken}`)
        .send({ toStatus: 'Feedback', deliverableUrl: 'https://drive.google.com/drive/folders/raw-shoot-footage' });
      expect((await reviewApprove(shootStage._id)).status).toBe(200);

      // Verify Edit stage auto-unlocked
      const editStage = await WorkItem.findOne({
        contentPieceId: approvedRowReelA._id,
        stageKey: 'Edit',
      });
      expect(editStage.isLocked).toBe(false);
      expect(editStage.unlockedAt).toBeDefined();
    });

    it('Step 4: Posting owner publishes deliverable and Content Tracker audits progress', async () => {
      const postStage = await WorkItem.findOne({
        contentPieceId: approvedRowPostablePoster._id,
        stageKey: 'Post',
      });
      postStage.ownerId = posterUser._id;
      await postStage.save();

      // Posting owner starts and publishes
      await request(app)
        .post(`/api/work/${postStage._id}/transition`)
        .set('Authorization', `Bearer ${posterToken}`)
        .send({ toStatus: 'In Progress' });

      // Posting owner marks piece published
      const publishRes = await request(app)
        .post(`/api/work/${postStage._id}/transition`)
        .set('Authorization', `Bearer ${posterToken}`)
        .send({
          toStatus: 'Published',
          publishedUrl: 'https://instagram.com/p/wv2-admissions-live-post',
        });
      expect(publishRes.status).toBe(200);

      // Verify Content Tracker audits
      const trackerRes = await request(app)
        .get('/api/content-pieces')
        .set('Authorization', `Bearer ${smManagerToken}`);
      expect(trackerRes.status).toBe(200);

      const pieces = trackerRes.body.data;
      const auditedPostable = pieces.find((p) => p._id.toString() === approvedRowPostablePoster._id.toString());
      expect(auditedPostable).toBeDefined();
      expect(auditedPostable.holder).toBe('Done');
      expect(auditedPostable.pieceStatus).toBe('Done');
      expect(auditedPostable.lateByDays).toBeDefined();
    });
  });

  // =========================================================================
  // JOURNEY D: Reject the whole plan with a concern; the SM Manager sees it
  // and resubmits.
  // =========================================================================
  describe('Journey D: Whole Plan Rejection with Strategic Concern & Resubmission', () => {
    let rejectablePlan;

    it('Step 1: SM Manager submits plan; Creative Head rejects entire plan with concern', async () => {
      const planRes = await request(app)
        .post('/api/calendar-plans')
        .set('Authorization', `Bearer ${smManagerToken}`)
        .send({
          title: 'WV2 Secondary Campaign Plan',
          kind: 'monthly',
          periodStart: new Date(Date.now() + 10 * 86400000).toISOString(),
          periodEnd: new Date(Date.now() + 40 * 86400000).toISOString(),
        });
      rejectablePlan = planRes.body.data;

      const postingDate = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10);
      await request(app)
        .post(`/api/calendar-plans/${rejectablePlan._id}/rows`)
        .set('Authorization', `Bearer ${smManagerToken}`)
        .send({
          rows: [
            {
              postingDate,
              topic: 'WV2 Generic Promo Banner',
              type: 'Poster',
              forTeam: 'Other',
              brief: 'General brand awareness artwork.',
            },
          ],
        });

      // Submit
      await request(app)
        .post(`/api/calendar-plans/${rejectablePlan._id}/submit`)
        .set('Authorization', `Bearer ${smManagerToken}`);

      // Creative Head rejects whole plan with concern
      const rejectRes = await request(app)
        .post(`/api/calendar-plans/${rejectablePlan._id}/review`)
        .set('Authorization', `Bearer ${creativeHeadToken}`)
        .send({
          action: 'reject',
          rejectionConcern: 'Focus on Admissions campaign topics first before generic branding.',
        });
      expect(rejectRes.status).toBe(200);
      expect(rejectRes.body.data.status).toBe('Changes requested');
      expect(rejectRes.body.data.rejectionConcern).toContain('Focus on Admissions campaign topics');

      // Verify all submitted rows received the concern
      const rows = await ContentPiece.find({ planId: rejectablePlan._id });
      expect(rows[0].rowStatus).toBe('changes_requested');
      expect(rows[0].reviewComment).toContain('Focus on Admissions');
    });

    it('Step 2: SM Manager updates the plan based on concern and resubmits', async () => {
      const rows = await ContentPiece.find({ planId: rejectablePlan._id });

      // Update row
      await request(app)
        .patch(`/api/calendar-plans/${rejectablePlan._id}/rows/${rows[0]._id}`)
        .set('Authorization', `Bearer ${smManagerToken}`)
        .send({
          topic: 'WV2 Admissions Campaign Key Visual Banner',
          forTeam: 'Sales',
          brief: 'Aligned with admissions target: Key visual banner for admissions lobby.',
        });

      // Resubmit
      const resubmitRes = await request(app)
        .post(`/api/calendar-plans/${rejectablePlan._id}/submit`)
        .set('Authorization', `Bearer ${smManagerToken}`);
      expect(resubmitRes.status).toBe(200);
      expect(resubmitRes.body.data.status).toBe('Submitted');
    });
  });

  // =========================================================================
  // JOURNEY E: An Individual Work goes through the same approval.
  // =========================================================================
  describe('Journey E: Individual Work (One Deliverable Plan)', () => {
    it('Step 1: Enforces exactly one row limit on individual plan', async () => {
      // Individual plan with 2 rows should fail validation
      const invalidIndPlan = await request(app)
        .post('/api/calendar-plans')
        .set('Authorization', `Bearer ${smManagerToken}`)
        .send({
          title: 'WV2 Ad-Hoc Workshop Poster (Individual Work)',
          kind: 'individual',
          periodStart: new Date(Date.now() + 5 * 86400000).toISOString(),
          periodEnd: new Date(Date.now() + 20 * 86400000).toISOString(),
        });
      const indPlanId = invalidIndPlan.body.data._id;
      const postingDate = new Date(Date.now() + 12 * 86400000).toISOString().slice(0, 10);

      // Attempt adding 2 rows
      await request(app)
        .post(`/api/calendar-plans/${indPlanId}/rows`)
        .set('Authorization', `Bearer ${smManagerToken}`)
        .send({
          rows: [
            {
              postingDate,
              topic: 'WV2 Row 1',
              type: 'Poster',
              forTeam: 'Academics',
              brief: 'Brief 1',
            },
            {
              postingDate,
              topic: 'WV2 Row 2',
              type: 'Poster',
              forTeam: 'Academics',
              brief: 'Brief 2',
            },
          ],
        });

      // Submit should be BLOCKED because individual plan has 2 rows
      const submitRes = await request(app)
        .post(`/api/calendar-plans/${indPlanId}/submit`)
        .set('Authorization', `Bearer ${smManagerToken}`);
      expect(submitRes.status).toBe(400);
      expect(submitRes.body.error.code).toBe('PLAN_SUBMISSION_BLOCKED');
    });

    it('Step 2: Valid Individual Work with exactly one row passes approval and generates stages', async () => {
      const validIndPlanRes = await request(app)
        .post('/api/calendar-plans')
        .set('Authorization', `Bearer ${smManagerToken}`)
        .send({
          title: 'WV2 Single Ad-Hoc Flyer',
          kind: 'individual',
          periodStart: new Date(Date.now() + 5 * 86400000).toISOString(),
          periodEnd: new Date(Date.now() + 20 * 86400000).toISOString(),
        });
      const validPlanId = validIndPlanRes.body.data._id;
      const postingDate = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);

      // Add exactly 1 row
      await request(app)
        .post(`/api/calendar-plans/${validPlanId}/rows`)
        .set('Authorization', `Bearer ${smManagerToken}`)
        .send({
          rows: [
            {
              postingDate,
              topic: 'WV2 Career Fair Poster',
              type: 'Poster',
              forTeam: 'Academics',
              brief: 'Single page poster for engineering career fair.',
            },
          ],
        });

      // Submit succeeds
      const submitRes = await request(app)
        .post(`/api/calendar-plans/${validPlanId}/submit`)
        .set('Authorization', `Bearer ${smManagerToken}`);
      expect(submitRes.status).toBe(200);
      expect(submitRes.body.data.status).toBe('Submitted');

      // Creative Head approves
      const approveRes = await request(app)
        .post(`/api/calendar-plans/${validPlanId}/review`)
        .set('Authorization', `Bearer ${creativeHeadToken}`)
        .send({ action: 'approve_all' });
      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.status).toBe('Approved');

      // Verify stages generated
      const flyerPiece = await ContentPiece.findOne({ planId: validPlanId });
      const flyerStages = await WorkItem.find({ contentPieceId: flyerPiece._id }).sort({ stageOrder: 1 });
      expect(flyerStages.length).toBe(2); // Content and Design
      expect(flyerStages[0].isLocked).toBe(false);
      expect(flyerStages[1].isLocked).toBe(true);
    });
  });

  // =========================================================================
  // JOURNEY F: A blocker notifies the dependency owner and the SM Manager and
  // shows 'blocked since'; an overdue stage notifies owner and SM Manager once.
  // =========================================================================
  describe('Journey F: Blocker Notifications ("blocked since") and Overdue Stage Alert', () => {
    it('Step 1: Blocker creation notifies dependency owner and SM Manager; shows "blocked since"', async () => {
      // Create a test work item
      const item = await WorkItem.create({
        profileId: profileHaca._id,
        title: 'WV2 Blocker Test Deliverable',
        workType: 'Poster',
        departmentId: deptCreative._id,
        ownerId: designerUser._id,
        deadline: new Date(Date.now() + 5 * 86400000),
        status: 'In Progress',
        priority: 'Normal',
      });

      // Designer marks Blocked with dependency on Writer
      const blockRes = await request(app)
        .post('/api/blockers')
        .set('Authorization', `Bearer ${designerToken}`)
        .send({
          workItemId: item._id.toString(),
          reason: 'Waiting for content',
          notes: 'Waiting for approved pricing bullet points from writer.',
          dependencyOwnerId: writerUser._id.toString(),
        });
      expect(blockRes.status).toBe(201);

      // Verify WorkItem is Blocked
      const updatedItem = await WorkItem.findById(item._id);
      expect(updatedItem.status).toBe('Blocked');

      // Verify notifications sent to dependency owner
      const notif = await Notification.findOne({
        recipient: writerUser._id,
        type: 'work_item.blocked',
      });
      expect(notif).toBeDefined();
      expect(notif.message).toContain('Waiting for content');

      // Verify notification sent to SM Manager
      const smBlockerNotif = await Notification.findOne({
        recipient: smManagerUser._id,
        type: 'work_item.blocked',
      });
      expect(smBlockerNotif).toBeDefined();

      // Verify tracker displays "Blocked since <date>"
      const testPiece = await ContentPiece.create({
        planId: approvedPlan._id,
        topic: 'WV2 Piece with Blocker',
        contentType: 'Poster',
        pipeline: 'design',
        postingDate: new Date(Date.now() + 5 * 86400000),
      });
      updatedItem.contentPieceId = testPiece._id;
      await updatedItem.save();

      const trackerRes = await request(app)
        .get('/api/content-pieces')
        .set('Authorization', `Bearer ${smManagerToken}`);
      expect(trackerRes.status).toBe(200);

      const pieceInTracker = trackerRes.body.data.find((p) => p._id.toString() === testPiece._id.toString());
      expect(pieceInTracker).toBeDefined();
      expect(pieceInTracker.holder).toMatch(/^Blocked since/);
    });

    it('Step 2: Overdue stage notifies owner and SM Manager once', async () => {
      // Stage past its deadline
      const overdueItem = await WorkItem.create({
        profileId: profileHaca._id,
        title: 'WV2 Overdue Stage Item',
        workType: 'Static Post',
        departmentId: deptContent._id,
        ownerId: writerUser._id,
        deadline: new Date(Date.now() - 3 * 86400000), // 3 days ago
        dueDate: new Date(Date.now() - 3 * 86400000),
        status: 'In Progress',
        priority: 'Normal',
      });

      // Run overdue rule
      const { executeAutomationRule } = await import('../src/modules/automation/runner.js');
      const ruleResult = await executeAutomationRule('overdue_escalation', adminUser, { force: true });
      expect(ruleResult.status).toBe('success');

      // Owner received overdue notification
      const ownerNotif = await Notification.findOne({
        recipient: writerUser._id,
        'metadata.workItemId': overdueItem._id,
        'metadata.type': 'overdue_owner',
      });
      expect(ownerNotif).toBeDefined();

      // SM Manager received overdue escalation
      const smOverdueNotif = await Notification.findOne({
        recipient: smManagerUser._id,
        'metadata.workItemId': overdueItem._id,
        'metadata.type': 'overdue_lead_escalation',
      });
      expect(smOverdueNotif).toBeDefined();
    });
  });

  // =========================================================================
  // JOURNEY G: Executive sees everything read-only; route-table walk for the five roles.
  // =========================================================================
  describe('Journey G: Executive Read-Only Access & Route-Table Walk for Five Roles', () => {
    it('Step 1: Executive sees everything read-only and mutations are denied (403)', async () => {
      // Allowed Read-Only routes
      const plansRes = await request(app)
        .get('/api/calendar-plans')
        .set('Authorization', `Bearer ${execToken}`);
      expect(plansRes.status).toBe(200);

      const piecesRes = await request(app)
        .get('/api/content-pieces')
        .set('Authorization', `Bearer ${execToken}`);
      expect(piecesRes.status).toBe(200);

      const reportsRes = await request(app)
        .get('/api/reports/view/monthly_scorecard')
        .set('Authorization', `Bearer ${execToken}`);
      expect(reportsRes.status).toBe(200);

      // Mutation attempt 1: Create Plan -> 403 Forbidden
      const createPlanRes = await request(app)
        .post('/api/calendar-plans')
        .set('Authorization', `Bearer ${execToken}`)
        .send({
          title: 'Executive Illegal Plan',
          periodStart: new Date().toISOString(),
          periodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
        });
      expect(createPlanRes.status).toBe(403);

      // Mutation attempt 2: Approve Plan -> 403 Forbidden
      const approveRes = await request(app)
        .post(`/api/calendar-plans/${approvedPlan._id}/review`)
        .set('Authorization', `Bearer ${execToken}`)
        .send({ action: 'approve_all' });
      expect(approveRes.status).toBe(403);
    });

    it('Step 2: Canonical Route-Table Walk Across All Five Roles', async () => {
      // 1. Admin: full access to user management
      const adminUsersRes = await request(app)
        .get('/api/people')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(adminUsersRes.status).toBe(200);

      // 2. Creative Head: allowed feedback review, denied admin-only access requests
      const chReviewRes = await request(app)
        .get('/api/feedback/threads')
        .set('Authorization', `Bearer ${creativeHeadToken}`);
      expect(chReviewRes.status).toBe(200);

      const chAccessReqRes = await request(app)
        .get('/api/admin/access-requests')
        .set('Authorization', `Bearer ${creativeHeadToken}`);
      expect(chAccessReqRes.status).toBe(403);

      // 3. SM Manager: allowed plan management, denied creative review
      const smPlanRes = await request(app)
        .get('/api/calendar-plans')
        .set('Authorization', `Bearer ${smManagerToken}`);
      expect(smPlanRes.status).toBe(200);

      const smReviewRes = await request(app)
        .post(`/api/calendar-plans/${approvedPlan._id}/review`)
        .set('Authorization', `Bearer ${smManagerToken}`)
        .send({ action: 'approve_all' });
      expect(smReviewRes.status).toBe(403);

      // 4. Team Member: allowed My Work, denied calendar plans and tracker
      const memberMyWorkRes = await request(app)
        .get('/api/work/my-work')
        .set('Authorization', `Bearer ${writerToken}`);
      expect(memberMyWorkRes.status).toBe(200);

      const memberPlansRes = await request(app)
        .get('/api/calendar-plans')
        .set('Authorization', `Bearer ${writerToken}`);
      expect(memberPlansRes.status).toBe(403);

      const memberTrackerRes = await request(app)
        .get('/api/content-pieces')
        .set('Authorization', `Bearer ${writerToken}`);
      expect(memberTrackerRes.status).toBe(403);

      // 5. Executive: allowed dashboard, plans, reports; denied admin access
      const execAdminRes = await request(app)
        .get('/api/admin/access-requests')
        .set('Authorization', `Bearer ${execToken}`);
      expect(execAdminRes.status).toBe(403);
    });
  });

  afterAll(async () => {
    await Person.deleteMany({ email: /@wv2-journey\.com$/ });
    await Profile.deleteMany({ code: 'wv2_haca' });
    await Department.deleteMany({ code: /wv2_/ });
    await CalendarPlan.deleteMany({ title: /WV2 / });
    await ContentPiece.deleteMany({ topic: /WV2 / });
    await WorkItem.deleteMany({ title: /WV2 / });
    await AccessRequest.deleteMany({ email: /@wv2-journey\.com$/ });
    await Blocker.deleteMany({});
  });
});

