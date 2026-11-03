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
import { WorkItem } from '../src/modules/workItems/model.js';
import { Blocker } from '../src/modules/blockers/model.js';
import { FeedbackEntry, RevisionFlag } from '../src/modules/feedback/model.js';
import { ReportDefinition } from '../src/modules/reports/model.js';
import { AutomationRule } from '../src/modules/automation/model.js';
import { ensureAutomationRules, executeAutomationRule } from '../src/modules/automation/runner.js';
import { ensureReportDefinitions } from '../src/modules/reports/service.js';
import { connectDB } from '../src/config/db.js';

describe('SCOPE RESET R4: Dashboard, Reports, Automation, Journey & Route-Table Walk Suite', () => {
  let adminUser, headUser, smUser, memberUser, execUser;
  let adminToken, headToken, smToken, memberToken, execToken;
  let profileHaca, deptCreative, deptContent, deptVideo;
  let testPlan, testPiece, testStageItem;

  function makeToken(user) {
    return jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  }

  beforeAll(async () => {
    await connectDB();
    // Clean up test data
    await Person.deleteMany({ email: /@r4-test\.com$/ });
    await Profile.deleteMany({ code: 'r4_haca' });
    await Department.deleteMany({ code: /r4_/ });
    await CalendarPlan.deleteMany({ $or: [{ code: /R4-/ }, { title: /R4/ }] });
    await ContentPiece.deleteMany({ topic: /R4/ });
    await WorkItem.deleteMany({ title: /R4/ });
    await AccessRequest.deleteMany({ email: /@r4-test\.com$/ });

    // Seed Profile
    profileHaca = await Profile.create({
      name: 'HACA R4 Master Brand',
      code: 'r4_haca',
      active: true,
    });

    // Seed Departments
    deptCreative = await Department.create({
      name: 'R4 Creative Design',
      code: 'r4_design',
      isActive: true,
    });

    deptContent = await Department.create({
      name: 'R4 Content & Copy',
      code: 'r4_content',
      isActive: true,
    });

    deptVideo = await Department.create({
      name: 'R4 Video Production',
      code: 'r4_video',
      isActive: true,
    });

    // Seed the 5 Canonical Roles
    adminUser = await Person.create({
      name: 'R4 System Admin',
      email: 'admin@r4-test.com',
      role: 'admin',
      status: 'active',
      profileAccess: [profileHaca._id],
      departmentId: deptCreative._id,
      weeklyCapacityHours: 40,
    });
    adminToken = makeToken(adminUser);

    headUser = await Person.create({
      name: 'R4 Creative Head',
      email: 'head@r4-test.com',
      role: 'creative_head',
      status: 'active',
      profileAccess: [profileHaca._id],
      departmentId: deptCreative._id,
      weeklyCapacityHours: 40,
    });
    headToken = makeToken(headUser);

    smUser = await Person.create({
      name: 'R4 SM Manager',
      email: 'sm@r4-test.com',
      role: 'sm_manager',
      status: 'active',
      profileAccess: [profileHaca._id],
      departmentId: deptCreative._id,
      weeklyCapacityHours: 40,
    });
    smToken = makeToken(smUser);

    memberUser = await Person.create({
      name: 'R4 Specialist Worker',
      email: 'worker@r4-test.com',
      role: 'team_member',
      status: 'active',
      profileAccess: [profileHaca._id],
      departmentId: deptContent._id,
      jobRole: 'Writer',
      workPreferences: ['Content', 'Script'],
      weeklyCapacityHours: 40,
    });
    memberToken = makeToken(memberUser);

    execUser = await Person.create({
      name: 'R4 Executive Director',
      email: 'exec@r4-test.com',
      role: 'executive',
      status: 'active',
      profileAccess: [profileHaca._id],
      weeklyCapacityHours: 40,
    });
    execToken = makeToken(execUser);

    // Initialize report definitions and automation rules
    await ensureReportDefinitions();
    await ensureAutomationRules();
  });

  afterAll(async () => {
    await Person.deleteMany({ email: /@r4-test\.com$/ });
    await Profile.deleteMany({ code: 'r4_haca' });
    await Department.deleteMany({ code: /r4_/ });
    await CalendarPlan.deleteMany({ $or: [{ code: /R4-/ }, { title: /R4/ }] });
    await ContentPiece.deleteMany({ topic: /R4/ });
    await WorkItem.deleteMany({ title: /R4/ });
    await AccessRequest.deleteMany({ email: /@r4-test\.com$/ });
  });

  // =========================================================================
  // TASK 7: FULL END-TO-END JOURNEY ACROSS ALL 5 ROLES
  // =========================================================================
  describe('1. Full End-to-End Lifecycle Journey Across 5 Roles', () => {
    let newApplicantId;
    let createdPlanId;
    let approvedPieceId;
    let stageScriptId;

    it('Step 1: Admin reviews and approves user access request', async () => {
      const accessReq = await AccessRequest.create({
        name: 'New Junior Editor',
        email: 'junior.editor@r4-test.com',
        phone: '+91 99999 11111',
        department: 'Video Production',
        departmentId: deptVideo._id,
        jobRole: 'Video Editor',
        requestedRole: 'team_member',
        requestedProfileCodes: ['r4_haca'],
        requestedProfileIds: [profileHaca._id],
        reason: 'Hired as junior video editor',
        status: 'pending',
      });
      newApplicantId = accessReq._id;

      // Admin approves
      const res = await request(app)
        .post(`/api/admin/access-requests/${newApplicantId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'team_member' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user).toBeDefined();

      const createdPerson = await Person.findOne({ email: 'junior.editor@r4-test.com' });
      expect(createdPerson).toBeDefined();
      expect(createdPerson.role).toBe('team_member');
      expect(createdPerson.status).toBe('active');
    });

    it('Step 2: SM Manager uploads and submits monthly calendar plan', async () => {
      // Create monthly plan
      const createRes = await request(app)
        .post('/api/calendar-plans')
        .set('Authorization', `Bearer ${smToken}`)
        .send({
          title: 'R4 November Social Grid',
          kind: 'monthly',
          periodStart: new Date(),
          periodEnd: new Date(Date.now() + 30 * 86400000),
          profileId: profileHaca._id,
        });

      expect(createRes.status).toBe(201);
      createdPlanId = createRes.body.data._id;
      testPlan = createRes.body.data;

      // Add a Reel A content piece row
      const addRowRes = await request(app)
        .post(`/api/calendar-plans/${createdPlanId}/rows`)
        .set('Authorization', `Bearer ${smToken}`)
        .send({
          rows: [
            {
              topic: 'R4 Product Feature Reel',
              type: 'Reel',
              contentType: 'Reel',
              pipeline: 'reel_a',
              brief: 'Detailed brief for R4 Product Feature Reel',
              forTeam: 'Marketing',
              postingOwnerId: memberUser._id,
              postingDate: new Date(Date.now() + 7 * 86400000),
              needsScript: true,
              needsShoot: true,
              contentLink: 'https://instagram.com/p/r4-test',
            },
          ],
        });

      expect(addRowRes.status).toBe(201);
      const piece = await ContentPiece.findOne({ planId: createdPlanId });
      expect(piece).toBeDefined();
      approvedPieceId = piece._id;
      testPiece = piece;

      // SM Manager submits plan for Creative Head review
      const submitRes = await request(app)
        .post(`/api/calendar-plans/${createdPlanId}/submit`)
        .set('Authorization', `Bearer ${smToken}`);

      expect(submitRes.status).toBe(200);
      expect(submitRes.body.data.status).toBe('Submitted');
    });

    it('Step 3: Creative Head reviews and approves plan; stages are created', async () => {
      const reviewRes = await request(app)
        .post(`/api/calendar-plans/${createdPlanId}/review`)
        .set('Authorization', `Bearer ${headToken}`)
        .send({
          action: 'approve_all',
        });

      expect(reviewRes.status).toBe(200);
      expect(reviewRes.body.data.approvedAt).toBeDefined();

      // Verify row status is approved
      const updatedPiece = await ContentPiece.findById(approvedPieceId);
      expect(updatedPiece.rowStatus).toBe('approved');

      // Verify stages were automatically generated with backwards scheduling
      const stages = await WorkItem.find({ contentPieceId: approvedPieceId }).sort({ stageOrder: 1 });
      expect(stages.length).toBeGreaterThanOrEqual(3); // Script, Shoot, Edit, Post

      const scriptStage = stages.find((s) => s.stageKey?.toLowerCase().includes('script'));
      expect(scriptStage).toBeDefined();
      expect(scriptStage.status).toBe('Not Started');
      expect(scriptStage.isLocked).toBe(false); // First stage is unlocked

      stageScriptId = scriptStage._id;
      testStageItem = scriptStage;
    });

    it('Step 4: SM Manager confirms stage assignment to worker', async () => {
      const assignRes = await request(app)
        .post('/api/content-pieces/confirm-assignments')
        .set('Authorization', `Bearer ${smToken}`)
        .send({
          assignments: [
            {
              workItemId: stageScriptId.toString(),
              assigneeId: memberUser._id.toString(),
            },
          ],
        });

      expect(assignRes.status).toBe(200);
      expect(assignRes.body.success).toBe(true);

      const assignedStage = await WorkItem.findById(stageScriptId);
      expect(assignedStage.ownerId.toString()).toBe(memberUser._id.toString());
    });

    it('Step 5: Worker sees stage in My Work and submits deliverable for creative approval', async () => {
      // Worker checks My Work
      const myWorkRes = await request(app)
        .get('/api/work-items/my-work')
        .set('Authorization', `Bearer ${memberToken}`);

      expect(myWorkRes.status).toBe(200);
      const workData = myWorkRes.body.data;
      const allItems = [
        ...(workData.today || []),
        ...(workData.thisWeek || []),
        ...(workData.upcoming || []),
        ...(workData.overdue || []),
      ];
      const found = allItems.find((i) => (i._id || i.id).toString() === stageScriptId.toString());
      expect(found).toBeDefined();

      // Worker starts stage
      await request(app)
        .post(`/api/work/${stageScriptId}/transition`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          toStatus: 'In Progress',
        });

      // Worker transitions stage to Pending Approval with deliverable URL
      const submitRes = await request(app)
        .post(`/api/work/${stageScriptId}/transition`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          toStatus: 'Pending',
          deliverableUrl: 'https://docs.google.com/document/d/r4-test-script',
        });

      expect(submitRes.status).toBe(200);
      expect(submitRes.body.data.status).toBe('Pending');
    });

    it('Step 6: Creative Head reviews deliverable and approves it; unlocks next stage', async () => {
      const approveRes = await request(app)
        .post(`/api/work/${stageScriptId}/transition`)
        .set('Authorization', `Bearer ${headToken}`)
        .send({
          toStatus: 'Approved',
        });

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.status).toBe('Approved');

      // Verify that next stage (Shoot or Edit) is now unlocked
      const nextStage = await WorkItem.findOne({
        contentPieceId: approvedPieceId,
        stageOrder: 2,
      });
      if (nextStage) {
        expect(nextStage.isLocked).toBe(false);
      }
    });

    it('Step 7: Posting owner publishes deliverable and records live URL', async () => {
      // Create a posting work item
      const postStage = await WorkItem.create({
        title: 'R4 Posting Stage',
        workType: 'Post',
        contentPieceId: approvedPieceId,
        stageKey: 'post',
        stageOrder: 4,
        status: 'In Progress',
        ownerId: smUser._id,
        departmentId: deptCreative._id,
        profileId: profileHaca._id,
        deadline: new Date(Date.now() + 86400000),
        estimatedEffortHrs: 1,
      });

      const publishRes = await request(app)
        .post(`/api/work/${postStage._id}/transition`)
        .set('Authorization', `Bearer ${smToken}`)
        .send({
          toStatus: 'Published',
          publishedUrl: 'https://instagram.com/reel/r4-published-live',
        });

      expect(publishRes.status).toBe(200);
      expect(publishRes.body.data.status).toBe('Published');
      expect(publishRes.body.data.publishedUrl).toBe('https://instagram.com/reel/r4-published-live');
    });

    it('Step 8: Executive sees everything read-only; all mutation attempts return 403', async () => {
      // Executive reads dashboard overview: 200 OK
      const dashRes = await request(app)
        .get('/api/dashboard/overview')
        .set('Authorization', `Bearer ${execToken}`);
      expect(dashRes.status).toBe(200);
      expect(dashRes.body.data).toBeDefined();

      // Executive reads calendar plans: 200 OK
      const planRes = await request(app)
        .get('/api/calendar-plans')
        .set('Authorization', `Bearer ${execToken}`);
      expect(planRes.status).toBe(200);

      // Executive reads tracker: 200 OK
      const trackerRes = await request(app)
        .get('/api/content-pieces')
        .set('Authorization', `Bearer ${execToken}`);
      expect(trackerRes.status).toBe(200);

      // Executive attempts to create calendar plan -> 403 Forbidden
      const createPlanRes = await request(app)
        .post('/api/calendar-plans')
        .set('Authorization', `Bearer ${execToken}`)
        .send({
          title: 'Illegal Exec Plan',
          kind: 'monthly',
          periodStart: new Date(),
          periodEnd: new Date(Date.now() + 30 * 86400000),
          profileId: profileHaca._id,
        });
      expect(createPlanRes.status).toBe(403);

      // Executive attempts to create raw deliverable -> 403 Forbidden
      const createWorkRes = await request(app)
        .post('/api/work')
        .set('Authorization', `Bearer ${execToken}`)
        .send({
          title: 'Illegal Exec Work',
          workType: 'Post',
          departmentId: deptCreative._id,
          profileId: profileHaca._id,
          deadline: new Date(),
        });
      expect(createWorkRes.status).toBe(403);

      // Executive attempts to transition deliverable -> 403 Forbidden
      const transRes = await request(app)
        .post(`/api/work/${stageScriptId}/transition`)
        .set('Authorization', `Bearer ${execToken}`)
        .send({ toStatus: 'In Progress' });
      expect(transRes.status).toBe(403);
    });
  });

  // =========================================================================
  // TASK 1 & 4: DASHBOARD SECTIONS & TEAM WORKLOAD REAL PERCENTAGE BANDS
  // =========================================================================
  describe('2. Dashboard Sections & Team Workload Bounded Bands', () => {
    it('GET /api/dashboard/overview -> returns all 8 required sections without target, funnel, or campaign sections', async () => {
      const res = await request(app)
        .get('/api/dashboard/overview')
        .set('Authorization', `Bearer ${headToken}`);

      expect(res.status).toBe(200);
      const data = res.body.data;

      // 1. Month plan status
      expect(data.monthPlanStatus).toBeDefined();
      expect(data.monthPlanStatus).toHaveProperty('planned');
      expect(data.monthPlanStatus).toHaveProperty('done');

      // 2. KPI strip (7 metrics)
      expect(data.kpis).toBeDefined();
      expect(data.kpis).toHaveProperty('planned');
      expect(data.kpis).toHaveProperty('completed');
      expect(data.kpis).toHaveProperty('inProgress');
      expect(data.kpis).toHaveProperty('atRisk');
      expect(data.kpis).toHaveProperty('blocked');
      expect(data.kpis).toHaveProperty('pendingApproval');
      expect(data.kpis).toHaveProperty('overdue');

      // 3. Priorities, 4. Production stats, 5. Team workload, 6. Issues, 7. Waiting, 8. Activity
      expect(data.todaysPriorities).toBeDefined();
      expect(data.productionStats).toBeDefined();
      expect(data.teamWorkload).toBeDefined();
      expect(data.issuesAndBlockers).toBeDefined();
      expect(data.waitingForApproval).toBeDefined();
      expect(data.recentActivity).toBeDefined();

      // Zero target, funnel, or campaign sections
      expect(data.targets).toBeUndefined();
      expect(data.funnel).toBeUndefined();
      expect(data.campaigns).toBeUndefined();
    });

    it('team_member is rejected from /api/dashboard/overview (lands on /my-work)', async () => {
      const res = await request(app)
        .get('/api/dashboard/overview')
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(403);
    });

    it('calculates real workload percentage uncapped with capacity bands <65, 65-85, >85', async () => {
      // Overload worker to 50 hours on 40 hour capacity -> 125% real percentage
      await WorkItem.create({
        title: 'R4 Giant Task',
        workType: 'Post',
        departmentId: deptContent._id,
        ownerId: memberUser._id,
        profileId: profileHaca._id,
        deadline: new Date(Date.now() + 3 * 86400000),
        estimatedEffortHrs: 50,
        status: 'In Progress',
      });

      const res = await request(app)
        .get('/api/workload')
        .set('Authorization', `Bearer ${headToken}`);

      expect(res.status).toBe(200);
      const members = res.body.data.members || res.body.data.team || res.body.data;
      const workerWorkload = members.find((m) => (m.person?._id || m._id).toString() === memberUser._id.toString());
      expect(workerWorkload).toBeDefined();

      // Real percentage exceeds 100%
      expect(workerWorkload.workloadPct).toBeGreaterThanOrEqual(100);
      expect(workerWorkload.capacityBand || workerWorkload.band).toBe('Overloaded'); // > 85% is Overloaded
    });
  });

  // =========================================================================
  // TASK 2: FOUR SAVED REPORTS & RECIPIENTS CONFIGURATION
  // =========================================================================
  describe('3. Four Saved Report Definitions & Recipients Management', () => {
    it('GET /api/reports/definitions -> lists the four canonical reports', async () => {
      const res = await request(app)
        .get('/api/reports/definitions')
        .set('Authorization', `Bearer ${execToken}`);

      expect(res.status).toBe(200);
      const defs = res.body.definitions;
      expect(defs.length).toBeGreaterThanOrEqual(4);

      const keys = defs.map((d) => d.reportKey);
      expect(keys).toContain('weekly_marketing');
      expect(keys).toContain('monthly_scorecard');
      expect(keys).toContain('creative_production');
      expect(keys).toContain('team_performance');
    });

    it('Generate Now: allowed for creative_head and admin; forbidden for executive', async () => {
      // Executive attempts generate -> 403 Forbidden
      const execGenRes = await request(app)
        .post('/api/reports/definitions/weekly_marketing/generate')
        .set('Authorization', `Bearer ${execToken}`)
        .send({});
      expect(execGenRes.status).toBe(403);

      // Creative Head generates -> 200 OK
      const headGenRes = await request(app)
        .post('/api/reports/definitions/weekly_marketing/generate')
        .set('Authorization', `Bearer ${headToken}`)
        .send({ sendEmail: false });
      expect(headGenRes.status).toBe(200);
      expect(headGenRes.body.report).toBeDefined();
    });

    it('Monthly Scorecard has no targets (reports planned vs published, on-time rate, revision rate)', async () => {
      const res = await request(app)
        .get('/api/reports/view/monthly_scorecard')
        .set('Authorization', `Bearer ${headToken}`);

      expect(res.status).toBe(200);
      const summary = res.body.report.summary;
      expect(summary).toHaveProperty('plannedCount');
      expect(summary).toHaveProperty('publishedCount');
      expect(summary).toHaveProperty('onTimeRate');
      expect(summary).toHaveProperty('revisionRate');
      expect(summary).toHaveProperty('avgTurnaroundHours');
      expect(summary.targets).toBeUndefined();
    });

    it('PATCH /api/reports/definitions/:key -> updates report recipients with emails or people IDs', async () => {
      const patchRes = await request(app)
        .patch('/api/reports/definitions/weekly_marketing')
        .set('Authorization', `Bearer ${headToken}`)
        .send({
          recipients: ['custom.executive@demo.haca.local', headUser._id.toString()],
        });

      if (patchRes.status !== 200) {
        console.error('PATCH DEFINITION FAILED:', patchRes.status, patchRes.body);
      }
      expect(patchRes.status).toBe(200);
      const def = patchRes.body.definition || patchRes.body.data;
      expect(def.recipients).toContain('custom.executive@demo.haca.local');
    });
  });

  // =========================================================================
  // TASK 3: AUTOMATION RULES (6 SCHEDULED RULES & UI LAST RUN)
  // =========================================================================
  describe('4. Six Marketing OS Automation Rules & Dispatcher', () => {
    it('GET /api/automation/rules -> lists all 6 rules with status and schedules', async () => {
      const res = await request(app)
        .get('/api/automation/rules')
        .set('Authorization', `Bearer ${headToken}`);

      expect(res.status).toBe(200);
      const rules = res.body.rules || res.body.data;
      expect(rules.length).toBe(6);

      const keys = rules.map((r) => r.ruleKey);
      expect(keys).toContain('month_end_report');
      expect(keys).toContain('overdue_escalation');
      expect(keys).toContain('todo_escalation');
      expect(keys).toContain('blocker_dependency_alert');
      expect(keys).toContain('revision_pattern_flag');
      expect(keys).toContain('weekly_report');
    });

    it('executes overdue_escalation rule and updates lastRun timestamp in database', async () => {
      const result = await executeAutomationRule('overdue_escalation', adminUser);
      expect(result).toBeDefined();

      const rule = await AutomationRule.findOne({ ruleKey: 'overdue_escalation' });
      expect(rule.lastRunAt).toBeDefined();
      expect(rule.lastRunStatus).toBe('success');
    });

    it('executes revision_pattern_flag rule and audits unclassified flags', async () => {
      const result = await executeAutomationRule('revision_pattern_flag', adminUser);
      expect(result).toBeDefined();

      const rule = await AutomationRule.findOne({ ruleKey: 'revision_pattern_flag' });
      expect(rule.lastRunAt).toBeDefined();
      expect(rule.lastRunStatus).toBe('success');
    });

    it('PATCH /api/automation/rules/:id/toggle -> toggles rule active state', async () => {
      const rule = await AutomationRule.findOne({ ruleKey: 'weekly_report' });
      const currentActive = rule.active;

      const toggleRes = await request(app)
        .patch(`/api/automation/rules/${rule._id}/toggle`)
        .set('Authorization', `Bearer ${headToken}`)
        .send({ active: !currentActive });

      expect(toggleRes.status).toBe(200);
      const updatedActive = toggleRes.body.rule ? toggleRes.body.rule.active : toggleRes.body.data.active;
      expect(updatedActive).toBe(!currentActive);
    });
  });

  // =========================================================================
  // TASK 6: SESSION & SOCKET AUTHENTICATION SECURITY
  // =========================================================================
  describe('5. Session Token Verification & Socket Authentication Guard', () => {
    it('rejects API request with missing authorization header', async () => {
      const res = await request(app).get('/api/people');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects API request with invalid or corrupted JWT token', async () => {
      const res = await request(app)
        .get('/api/people')
        .set('Authorization', 'Bearer invalid.bogus.token');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });
  });

  // =========================================================================
  // TASK 7: COMPREHENSIVE ROUTE-TABLE WALK FOR THE FIVE ROLES
  // =========================================================================
  describe('6. Route-Table Walk Across the Five Canonical Roles', () => {
    it('Admin route walk: full administrative, plan, report, and automation access', async () => {
      const accessRes = await request(app).get('/api/admin/access-requests').set('Authorization', `Bearer ${adminToken}`);
      expect(accessRes.status).toBe(200);

      const deptRes = await request(app).get('/api/departments').set('Authorization', `Bearer ${adminToken}`);
      expect(deptRes.status).toBe(200);

      const rulesRes = await request(app).get('/api/automation/rules').set('Authorization', `Bearer ${adminToken}`);
      expect(rulesRes.status).toBe(200);

      const reportsRes = await request(app).get('/api/reports/definitions').set('Authorization', `Bearer ${adminToken}`);
      expect(reportsRes.status).toBe(200);

      const dashRes = await request(app).get('/api/dashboard/overview').set('Authorization', `Bearer ${adminToken}`);
      expect(dashRes.status).toBe(200);
    });

    it('Creative Head route walk: creative approvals, plans, reports; denied admin console', async () => {
      const adminDenied = await request(app).get('/api/admin/access-requests').set('Authorization', `Bearer ${headToken}`);
      expect(adminDenied.status).toBe(403);

      const dashRes = await request(app).get('/api/dashboard/overview').set('Authorization', `Bearer ${headToken}`);
      expect(dashRes.status).toBe(200);

      const plansRes = await request(app).get('/api/calendar-plans').set('Authorization', `Bearer ${headToken}`);
      expect(plansRes.status).toBe(200);

      const trackerRes = await request(app).get('/api/content-pieces').set('Authorization', `Bearer ${headToken}`);
      expect(trackerRes.status).toBe(200);

      const reportsRes = await request(app).get('/api/reports/definitions').set('Authorization', `Bearer ${headToken}`);
      expect(reportsRes.status).toBe(200);
    });

    it('SM Manager route walk: plan management, content tracking, reports; denied admin console', async () => {
      const adminDenied = await request(app).get('/api/admin/access-requests').set('Authorization', `Bearer ${smToken}`);
      expect(adminDenied.status).toBe(403);

      const dashRes = await request(app).get('/api/dashboard/overview').set('Authorization', `Bearer ${smToken}`);
      expect(dashRes.status).toBe(200);

      const plansRes = await request(app).get('/api/calendar-plans').set('Authorization', `Bearer ${smToken}`);
      expect(plansRes.status).toBe(200);

      const trackerRes = await request(app).get('/api/content-pieces').set('Authorization', `Bearer ${smToken}`);
      expect(trackerRes.status).toBe(200);

      const reportsRes = await request(app).get('/api/reports/definitions').set('Authorization', `Bearer ${smToken}`);
      expect(reportsRes.status).toBe(200);
    });

    it('Team Member route walk: focused on My Work; denied admin console and calendar plan editing', async () => {
      const myWorkRes = await request(app).get('/api/work-items/my-work').set('Authorization', `Bearer ${memberToken}`);
      expect(myWorkRes.status).toBe(200);

      const adminDenied = await request(app).get('/api/admin/access-requests').set('Authorization', `Bearer ${memberToken}`);
      expect(adminDenied.status).toBe(403);

      const plansDenied = await request(app).get('/api/calendar-plans').set('Authorization', `Bearer ${memberToken}`);
      expect(plansDenied.status).toBe(403);
    });

    it('Executive route walk: read-only access to dashboard, plans, reports, tracker; denied admin console & mutations', async () => {
      const adminDenied = await request(app).get('/api/admin/access-requests').set('Authorization', `Bearer ${execToken}`);
      expect(adminDenied.status).toBe(403);

      const dashRes = await request(app).get('/api/dashboard/overview').set('Authorization', `Bearer ${execToken}`);
      expect(dashRes.status).toBe(200);

      const plansRes = await request(app).get('/api/calendar-plans').set('Authorization', `Bearer ${execToken}`);
      expect(plansRes.status).toBe(200);

      const reportsRes = await request(app).get('/api/reports/definitions').set('Authorization', `Bearer ${execToken}`);
      expect(reportsRes.status).toBe(200);

      const trackerRes = await request(app).get('/api/content-pieces').set('Authorization', `Bearer ${execToken}`);
      expect(trackerRes.status).toBe(200);

      const postPlanDenied = await request(app).post('/api/calendar-plans').set('Authorization', `Bearer ${execToken}`).send({ title: 'X' });
      expect(postPlanDenied.status).toBe(403);
    });
  });

  afterAll(async () => {
    await Person.deleteMany({ email: /@r4-test\.com$/ });
    await Profile.deleteMany({ code: 'r4_haca' });
    await Department.deleteMany({ code: /r4_/ });
    await CalendarPlan.deleteMany({ $or: [{ code: /R4-/ }, { title: /R4/ }] });
    await ContentPiece.deleteMany({ topic: /R4/ });
    await WorkItem.deleteMany({ title: /R4/ });
    await AccessRequest.deleteMany({ email: /@r4-test\.com$/ });
  });
});

