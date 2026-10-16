import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { app } from '../src/server.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/modules/users/model.js';
import { AccessRequest } from '../src/modules/access/model.js';
import { Request as MarketingRequest } from '../src/modules/requests/model.js';
import { ContentItem } from '../src/modules/content/model.js';
import { Task } from '../src/modules/tasks/model.js';
import { Deliverable } from '../src/modules/deliverables/model.js';
import { Shoot } from '../src/modules/shoots/model.js';
import { Department } from '../src/modules/departments/model.js';
import { Team } from '../src/modules/teams/model.js';
import { CalendarEntry } from '../src/modules/calendar/model.js';
import { LeaveRequest } from '../src/modules/leave/model.js';
import { openApiSpec } from '../src/modules/docs/openapi.js';

let adminCookie = '';
let leadCookie = '';
let workerCookie = '';
let smCookie = '';
let salesLeadCookie = '';
let salesStaffCookie = '';
let acadLeadCookie = '';

let adminUser = null;
let leadUser = null;
let workerUser = null;
let smUser = null;
let salesLeadUser = null;
let salesStaffUser = null;
let acadLeadUser = null;

let salesDept = null;
let smDept = null;
let contentTeam = null;
let editorTeam = null;
let sharedContentItemId = '';

describe('Phase 10: Hardening, QA, and End-to-End Core Journeys', () => {
  beforeAll(async () => {
    await connectDB();

    // 1. Ensure test departments exist
    salesDept = await Department.findOneAndUpdate(
      { name: 'Sales' },
      { name: 'Sales', type: 'sales' },
      { upsert: true, new: true }
    );
    smDept = await Department.findOneAndUpdate(
      { name: 'Social Media' },
      { name: 'Social Media', type: 'social_media' },
      { upsert: true, new: true }
    );

    // 2. Ensure test teams exist
    contentTeam = await Team.findOneAndUpdate(
      { name: 'content' },
      { name: 'content', displayName: 'Content Writing' },
      { upsert: true, new: true }
    );
    editorTeam = await Team.findOneAndUpdate(
      { name: 'editor' },
      { name: 'editor', displayName: 'Video Editing' },
      { upsert: true, new: true }
    );

    // 3. Login or setup core personas
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('Password123!', salt);

    async function getAuthCookie(email, password, role, extra = {}) {
      let u = await User.findOne({ email });
      if (!u) {
        u = await User.create({
          name: email.split('@')[0],
          email,
          role,
          passwordHash: passwordHash,
          status: 'active',
          ...extra,
        });
      } else {
        u.passwordHash = passwordHash;
        await u.save();
      }
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'Password123!' });
      return { cookie: res.headers['set-cookie'], user: u };
    }

    const adminAuth = await getAuthCookie('admin.p10@example.com', 'Password123!', 'admin');
    adminCookie = adminAuth.cookie;
    adminUser = adminAuth.user;

    const leadAuth = await getAuthCookie('lead.p10@example.com', 'Password123!', 'lead');
    leadCookie = leadAuth.cookie;
    leadUser = leadAuth.user;

    const workerAuth = await getAuthCookie('worker.p10@example.com', 'Password123!', 'worker', {
      team: 'editor',
      teamId: 'editor',
    });
    workerCookie = workerAuth.cookie;
    workerUser = workerAuth.user;

    const smAuth = await getAuthCookie('sm.p10@example.com', 'Password123!', 'sm_manager', {
      department: 'Social Media',
    });
    smCookie = smAuth.cookie;
    smUser = smAuth.user;

    const salesLeadAuth = await getAuthCookie('saleslead.p10@example.com', 'Password123!', 'dept_lead', {
      department: 'Sales',
    });
    salesLeadCookie = salesLeadAuth.cookie;
    salesLeadUser = salesLeadAuth.user;

    const salesStaffAuth = await getAuthCookie('salesstaff.p10@example.com', 'Password123!', 'dept_staff', {
      department: 'Sales',
    });
    salesStaffCookie = salesStaffAuth.cookie;
    salesStaffUser = salesStaffAuth.user;

    const acadLeadAuth = await getAuthCookie('acadlead.p10@example.com', 'Password123!', 'dept_lead', {
      department: 'Academics',
    });
    acadLeadCookie = acadLeadAuth.cookie;
    acadLeadUser = acadLeadAuth.user;
  });

  afterAll(async () => {
    // Clean up test records
    await User.deleteMany({ email: /.*\.p10@example\.com$/ });
    await MarketingRequest.deleteMany({ title: /^P10 / });
    await ContentItem.deleteMany({ title: /^P10 / });
    await Task.deleteMany({ title: /^P10 / });
    await Shoot.deleteMany({ title: /^P10 / });
    await CalendarEntry.deleteMany({ theme: /^P10 / });
    await AccessRequest.deleteMany({ email: /^new\.applicant\.p10@/ });
    await disconnectDB();
  });

  // =========================================================================
  // 1. SYSTEM OBSERVABILITY, HEALTH, READINESS & CORRELATION
  // =========================================================================
  describe('1. Observability, Health, Readiness & Correlation Tracing', () => {
    it('1.1 GET /api/status returns 200 with service information and uptime', async () => {
      const res = await request(app).get('/api/status');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('marketing-workflow-api');
      expect(typeof res.body.uptime).toBe('number');
    });

    it('1.2 GET /api/health acts as a fast liveness probe', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(typeof res.body.uptime).toBe('number');
    });

    it('1.3 GET /api/ready verifies database connectivity state', async () => {
      const res = await request(app).get('/api/ready');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ready');
      expect(res.body.checks.database).toBe('connected');
    });

    it('1.4 Injects X-Request-Id correlation header and respects inbound client tracing ID', async () => {
      // Automatic generation
      const res1 = await request(app).get('/api/health');
      expect(res1.headers['x-request-id']).toBeDefined();
      expect(res1.headers['x-request-id'].length).toBeGreaterThan(10);

      // Inbound preservation
      const clientTraceId = 'trace-client-custom-uuid-12345';
      const res2 = await request(app)
        .get('/api/health')
        .set('X-Request-Id', clientTraceId);
      expect(res2.headers['x-request-id']).toBe(clientTraceId);
    });

    it('1.5 GET /api/docs/openapi.json serves valid OpenAPI 3.0 specification', async () => {
      const res = await request(app).get('/api/docs/openapi.json');
      expect(res.status).toBe(200);
      expect(res.body.openapi).toBe('3.0.3');
      expect(res.body.info.title).toContain('Marketing Workflow');
      expect(res.body.paths['/auth/login']).toBeDefined();
      expect(res.body.paths['/requests']).toBeDefined();
    });
  });

  // =========================================================================
  // 2. JOURNEY A: ONBOARDING & ACCESS REQUEST FLOW
  // =========================================================================
  describe('2. Journey A: Request Access -> Admin Approval -> Set Password -> Login', () => {
    const applicantEmail = `new.applicant.p10@example.com`;
    let inviteToken = '';

    it('2.1 Prospective worker submits access request', async () => {
      const res = await request(app)
        .post('/api/auth/request-access')
        .send({
          name: 'Jordan Applicant',
          email: applicantEmail,
          phone: '+1 555-0199',
          department: 'Sales',
          requestedRole: 'worker',
          skillType: 'video_editing',
          reason: 'Joining the video production crew for Fall campaigns.',
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toContain('Access request submitted');
    });

    it('2.2 Admin lists and inspects pending access requests', async () => {
      const res = await request(app)
        .get('/api/admin/access-requests?status=pending')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      const target = res.body.data.find((r) => r.email === applicantEmail);
      expect(target).toBeDefined();
      expect(target.status).toBe('pending');
    });

    it('2.3 Admin approves access request with assigned team and generates invite link', async () => {
      const pendingReq = await AccessRequest.findOne({ email: applicantEmail });
      expect(pendingReq).toBeDefined();

      const res = await request(app)
        .patch(`/api/admin/access-requests/${pendingReq._id}/approve`)
        .set('Cookie', adminCookie)
        .send({
          status: 'approved',
          assignedRole: 'worker',
          teamId: 'editor',
          skills: ['Premiere Pro', 'DaVinci'],
          capacity: 40,
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('approved');
      expect(res.body.inviteLink).toBeDefined();

      // Extract token from invite link or direct token field
      inviteToken = res.body.inviteToken;
      if (!inviteToken && res.body.inviteLink) {
        const url = new URL(res.body.inviteLink, 'http://localhost');
        inviteToken = url.searchParams.get('token');
      }
      expect(inviteToken).toBeTruthy();
    });

    it('2.4 User activates account via invite token and sets secure password', async () => {
      const res = await request(app)
        .post('/api/auth/set-password')
        .send({
          token: inviteToken,
          password: 'NewStrongPassword123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('2.5 User logs in successfully and receives session cookie and CASL permissions', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: applicantEmail,
          password: 'NewStrongPassword123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(applicantEmail);
      expect(res.body.user.role).toBe('worker');
      expect(res.body.permissions).toContain('task.update.own');

      // Verify me endpoint with session cookie
      const cookie = res.headers['set-cookie']?.[0];
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Cookie', cookie);

      expect(meRes.status).toBe(200);
      expect(meRes.body.user.name).toBe('Jordan Applicant');
    });
  });

  // =========================================================================
  // 3. JOURNEY B: FULL CONTENT INTAKE TO PUBLISHING LIFECYCLE
  // =========================================================================
  describe('3. Journey B: Sales Request -> Triage -> Pipeline -> Handoffs -> Review -> Confirmation -> Publish', () => {
    let createdRequestId = '';
    let contentItemId = '';
    let editorTaskId = '';
    let deliverableId = '';

    it('3.1 Sales Lead raises a new marketing deliverable request', async () => {
      const res = await request(app)
        .post('/api/requests')
        .set('Cookie', salesLeadCookie)
        .send({
          title: 'P10 Enterprise Sales Launch Video',
          sourceDepartment: 'Sales',
          requestType: 'Social Video Reel',
          priority: 'urgent',
          deadline: new Date(Date.now() + 10 * 86400000).toISOString(),
          dynamicFields: {
            targetAudience: 'B2B Enterprise Leaders',
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.request.title).toBe('P10 Enterprise Sales Launch Video');
      expect(res.body.request.status).toBe('submitted');
      createdRequestId = res.body.request._id;
    });

    it('3.2 Marketing Lead triages and accepts the request', async () => {
      const res = await request(app)
        .post(`/api/requests/${createdRequestId}/triage/accept`)
        .set('Cookie', leadCookie)
        .send({
          notes: 'High commercial impact for enterprise quarter. Approved.',
          priority: 'urgent',
        });

      expect(res.status).toBe(200);
      expect(res.body.request.status).toBe('accepted');
    });

    it('3.3 Marketing Lead converts request to Content Item using Reel pipeline template', async () => {
      const res = await request(app)
        .post(`/api/requests/${createdRequestId}/triage/convert`)
        .set('Cookie', leadCookie)
        .send({
          format: 'reel',
          publishDate: new Date(Date.now() + 10 * 86400000).toISOString(),
        });

      expect(res.status).toBe(200);
      const item = res.body.contentItem || res.body.data;
      expect(item).toBeDefined();
      expect(item.format).toBe('reel');
      contentItemId = item._id;
      sharedContentItemId = item._id;

      // Find created editor task
      const tasks = await Task.find({ contentItemId });
      expect(tasks.length).toBeGreaterThan(0);
      const editorTask = tasks.find((t) => t.team === 'editor');
      if (editorTask) {
        editorTaskId = editorTask._id.toString();
        // Assign to our test worker
        editorTask.assignee = workerUser._id;
        await editorTask.save();
      }
    });

    it('3.4 Worker submits Deliverable Version 1 for the editing task', async () => {
      const res = await request(app)
        .post('/api/deliverables')
        .set('Cookie', workerCookie)
        .send({
          taskId: editorTaskId,
          contentItemId,
          version: 1,
          type: 'video',
          fileUrl: 'https://res.cloudinary.com/mmp/video/upload/v1/p10_rough_cut.mp4',
          notes: 'Rough assembly with background score synced.',
        });

      expect(res.status).toBe(201);
      const del = res.body.data || res.body.deliverable;
      expect(del.version).toBe(1);
      expect(del.status).toBe('submitted');
      deliverableId = del._id;
    });

    it('3.5 Marketing Lead reviews Deliverable v1 and requests revisions with timestamped feedback', async () => {
      const res = await request(app)
        .post(`/api/deliverables/${deliverableId}/review`)
        .set('Cookie', leadCookie)
        .send({
          decision: 'changes_requested',
          notes: 'Pacing too slow during opening 5 seconds. Re-cut hook.',
          comments: [
            { text: 'Tighten jump cut here', mediaTimestamp: 4.5 },
          ],
        });

      expect(res.status).toBe(200);
      const del = res.body.data || res.body.deliverable;
      expect(del.status).toBe('changes_requested');

      // Verify task revisionCount incremented
      const task = await Task.findById(editorTaskId);
      expect(task.revisionCount).toBe(1);
      expect(task.status).toBe('changes_requested');
    });

    it('3.6 Worker uploads Deliverable Version 2 addressing revisions', async () => {
      const res = await request(app)
        .post('/api/deliverables')
        .set('Cookie', workerCookie)
        .send({
          taskId: editorTaskId,
          contentItemId,
          version: 2,
          type: 'video',
          fileUrl: 'https://res.cloudinary.com/mmp/video/upload/v2/p10_final_cut.mp4',
          notes: 'Opening tightened, revised audio mix applied.',
        });

      expect(res.status).toBe(201);
      const del = res.body.data || res.body.deliverable;
      expect(del.version).toBe(2);
      deliverableId = del._id;
    });

    it('3.7 Marketing Lead approves Deliverable Version 2', async () => {
      const res = await request(app)
        .post(`/api/deliverables/${deliverableId}/review`)
        .set('Cookie', leadCookie)
        .send({
          decision: 'approved',
          notes: 'Excellent cut! Ready for Sales requester confirmation.',
        });

      expect(res.status).toBe(200);
      const del = res.body.data || res.body.deliverable;
      expect(del.status).toBe('approved');
    });

    it('3.8 Sales Requester gives final sign-off confirmation', async () => {
      const res = await request(app)
        .post(`/api/deliverables/confirm/${contentItemId}`)
        .set('Cookie', salesLeadCookie)
        .send({
          decision: 'confirm',
          feedback: 'Sales leadership confirms output meets client campaign goals.',
        });

      expect(res.status).toBe(200);
      const item = res.body.data || res.body.contentItem;
      expect(item.status).toBe('scheduled');
    });

    it('3.9 Social Media Manager marks deliverable as Published with live post URL', async () => {
      const res = await request(app)
        .patch(`/api/content/${contentItemId}/publish`)
        .set('Cookie', smCookie)
        .send({
          publishedUrl: 'https://youtube.com/watch?v=p10_demo_sales_video',
          publishedDate: new Date().toISOString(),
          notes: 'Published live across official company YouTube and LinkedIn channels.',
        });

      expect(res.status).toBe(200);
      const item = res.body.data || res.body.contentItem;
      expect(item.status).toBe('published');
      expect(item.publishedUrl).toContain('youtube.com');
    });
  });

  // =========================================================================
  // 4. JOURNEY C: CALENDAR PLANNING, CAPACITY CHECK & CONTENT GENERATION
  // =========================================================================
  describe('4. Journey C: SM Calendar Planning, Capacity Warning & Content Generation', () => {
    let entryId = '';

    it('4.1 SM Manager adds future calendar entries for upcoming campaign', async () => {
      const res = await request(app)
        .post('/api/calendar')
        .set('Cookie', smCookie)
        .send({
          date: new Date(Date.now() + 14 * 86400000).toISOString(),
          platform: 'instagram',
          format: 'Reel or video',
          theme: 'P10 Student Campus Life Highlight',
          captionBrief: 'Showcase dorms and maker spaces.',
          contentPillar: 'Student Experience',
        });

      expect(res.status).toBe(201);
      const entry = res.body.data || res.body.entry;
      expect(entry).toBeDefined();
      expect(entry.status).toBe('draft');
      entryId = entry._id;
    });

    it('4.2 GET /api/calendar/capacity evaluates team capacity against scheduled demand', async () => {
      const res = await request(app)
        .get('/api/calendar/capacity')
        .set('Cookie', smCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('4.3 SM Manager batch approves entries and generates ContentItems with auto deadlines', async () => {
      // Approve entry first
      await request(app)
        .post('/api/calendar/approve')
        .set('Cookie', smCookie)
        .send({ ids: [entryId] });

      const res = await request(app)
        .post('/api/calendar/generate-content')
        .set('Cookie', smCookie)
        .send({
          entryIds: [entryId],
        });

      expect(res.status).toBe(200);
      expect(res.body.data || res.body.success).toBeDefined();

      const updatedEntry = await CalendarEntry.findById(entryId);
      expect(updatedEntry.status).toBe('converted');
      expect(updatedEntry.linkedContentItemId).toBeDefined();
    });
  });

  // =========================================================================
  // 5. JOURNEY D: SHOOT PLANNER LIFECYCLE & FOOTAGE RELEASE
  // =========================================================================
  describe('5. Journey D: Shoot Planner -> Mark Done -> Release Footage to Editors', () => {
    let shootId = '';

    it('5.1 Marketing Lead creates a multi-talent shoot plan', async () => {
      const res = await request(app)
        .post('/api/shoots')
        .set('Cookie', leadCookie)
        .send({
          title: 'P10 Innovation Lab Studio Shoot',
          date: new Date(Date.now() + 2 * 86400000).toISOString(),
          location: 'Lab Soundstage Studio A',
          crew: [leadUser._id.toString()],
          equipment: ['Sony FX6', 'Wireless Lavs', 'Aputure Nova'],
          talentNotes: 'Dr. Sarah Adams, Student VP',
          contentItems: [sharedContentItemId],
          notes: 'Two live demonstrations and lab overview.',
          overrideWarning: true,
        });

      expect(res.status).toBe(201);
      const shoot = res.body.data || res.body.shoot;
      expect(shoot.title).toBe('P10 Innovation Lab Studio Shoot');
      expect(shoot.status).toBe('scheduled');
      shootId = shoot._id;
    });

    it('5.2 Cinematography marks shoot Done and records cloud footage URL', async () => {
      const res = await request(app)
        .post(`/api/shoots/${shootId}/transition`)
        .set('Cookie', leadCookie)
        .send({
          status: 'done',
          notes: 'Audio clean, 4K ProRes 422 offloaded to master drive. Footage URL: https://storage.googleapis.com/mmp-raw-footage/p10_lab_footage.zip',
        });

      expect(res.status).toBe(200);
      const shoot = res.body.data || res.body.shoot;
      expect(shoot.status).toBe('done');
    });
  });

  // =========================================================================
  // 6. JOURNEY E: ROLE-BASED ACCESS CONTROL & SCOPING VIOLATION REJECTIONS
  // =========================================================================
  describe('6. Journey E: Security Checks & Role Scoping Enforcement', () => {
    it('6.1 Workers CANNOT approve deliverables (returns 403 Forbidden)', async () => {
      const fakeDeliverableId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .post(`/api/deliverables/${fakeDeliverableId}/review`)
        .set('Cookie', workerCookie)
        .send({ decision: 'approve' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('6.2 Requesters (dept_staff) CANNOT access internal production task pipelines (returns 403 Forbidden)', async () => {
      const task = await Task.findOne();
      const res = await request(app)
        .get(`/api/tasks/${task._id}`)
        .set('Cookie', salesStaffCookie);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('6.3 Department staff CANNOT view other departments requests (returns 403 Forbidden)', async () => {
      // Academics lead creates a request
      const acadReq = await MarketingRequest.create({
        requestId: 'MKT-P10-ACAD-001',
        title: 'P10 Confidential Academic Syllabus Guide',
        sourceDepartment: 'Academics',
        requestTypeName: 'Academic Brochure',
        requester: acadLeadUser._id,
        deadline: new Date(Date.now() + 5 * 86400000),
        status: 'submitted',
      });

      // Sales staff tries to open it
      const res = await request(app)
        .get(`/api/requests/${acadReq._id}`)
        .set('Cookie', salesStaffCookie);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('6.4 Workers CANNOT approve or review leave requests (returns 403 Forbidden)', async () => {
      const fakeLeaveId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .patch(`/api/leave/${fakeLeaveId}/review`)
        .set('Cookie', workerCookie)
        .send({ status: 'approved' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('6.5 Non-performance users CANNOT mark ad creatives as Live (returns 403 Forbidden)', async () => {
      const fakeContentId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .post(`/api/deliverables/performance/${fakeContentId}/live`)
        .set('Cookie', salesStaffCookie)
        .send({ liveUrl: 'https://ad.meta.com/123' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  // =========================================================================
  // 7. JOURNEY F: REPORTING SCOPING & STREAMING EXPORTS
  // =========================================================================
  describe('7. Journey F: Reports Scoping & Streaming Data Exports', () => {
    it('7.1 Worker can query own individual report, but is FORBIDDEN from viewing other workers', async () => {
      // Self query
      const selfRes = await request(app)
        .get(`/api/reports/individual/${workerUser._id}`)
        .set('Cookie', workerCookie);
      expect(selfRes.status).toBe(200);
      expect(selfRes.body.data.worker.name).toBe(workerUser.name);

      // Other query
      const otherRes = await request(app)
        .get(`/api/reports/individual/${leadUser._id}`)
        .set('Cookie', workerCookie);
      expect(otherRes.status).toBe(403);
      expect(otherRes.body.error.code).toBe('FORBIDDEN');
    });

    it('7.2 Department Lead department report is automatically scoped to their department', async () => {
      const res = await request(app)
        .get('/api/reports/department')
        .set('Cookie', salesLeadCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.scopedDepartment || res.body.data.department).toBe('Sales');
    });

    it('7.3 Admin streams binary Excel export for analytics', async () => {
      const res = await request(app)
        .get('/api/reports/export?type=department&format=xlsx')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('spreadsheetml');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.body).toBeDefined();
    });
  });
});
