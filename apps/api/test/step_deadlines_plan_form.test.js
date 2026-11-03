import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import ExcelJS from 'exceljs';
import { app } from '../src/server.js';
import { env } from '../src/config/env.js';
import { Person } from '../src/modules/people/model.js';
import { Department } from '../src/modules/departments/model.js';
import { CalendarPlan } from '../src/modules/calendar/plan.model.js';
import { ContentPiece } from '../src/modules/calendar/contentPiece.model.js';
import { WorkItem } from '../src/modules/workItems/model.js';
import { connectDB } from '../src/config/db.js';

describe('STEP DEADLINES IN THE PLAN ROW FORM SUITE', () => {
  let smUser, headUser, adminUser, scriptUser, shootUser, editUser;
  let smToken, headToken, adminToken;
  let testDept;

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

    testDept = await Department.findOne({
      $or: [{ code: 'step_deadline_dept' }, { name: 'Step Deadline Dept' }],
    });
    if (!testDept) {
      testDept = await Department.create({
        name: 'Step Deadline Dept',
        code: 'step_deadline_dept',
        status: 'active',
      });
    }

    await Person.deleteMany({ email: /@step-test\.com$/ });
    await CalendarPlan.deleteMany({ title: /StepDeadlinesTest/ });
    await ContentPiece.deleteMany({ topic: /StepDeadlinesTest/ });
    await WorkItem.deleteMany({ title: /StepDeadlinesTest/ });

    // Create users with appropriate work preferences
    adminUser = await Person.create({
      name: 'Step Admin',
      email: 'admin@step-test.com',
      passwordHash: 'dummy',
      role: 'admin',
      departmentId: testDept._id,
      status: 'active',
    });

    smUser = await Person.create({
      name: 'Step SM Manager',
      email: 'sm@step-test.com',
      passwordHash: 'dummy',
      role: 'sm_manager',
      departmentId: testDept._id,
      status: 'active',
    });

    headUser = await Person.create({
      name: 'Step Creative Head',
      email: 'head@step-test.com',
      passwordHash: 'dummy',
      role: 'creative_head',
      departmentId: testDept._id,
      status: 'active',
    });

    scriptUser = await Person.create({
      name: 'Step Writer',
      email: 'writer@step-test.com',
      passwordHash: 'dummy',
      role: 'team_member',
      departmentId: testDept._id,
      workPreferences: ['Script'],
      status: 'active',
    });

    shootUser = await Person.create({
      name: 'Step Videographer',
      email: 'video@step-test.com',
      passwordHash: 'dummy',
      role: 'team_member',
      departmentId: testDept._id,
      workPreferences: ['Shoot'],
      status: 'active',
    });

    editUser = await Person.create({
      name: 'Step Editor',
      email: 'editor@step-test.com',
      passwordHash: 'dummy',
      role: 'team_member',
      departmentId: testDept._id,
      workPreferences: ['Edit'],
      status: 'active',
    });

    adminToken = makeToken(adminUser);
    smToken = makeToken(smUser);
    headToken = makeToken(headUser);
  });

  afterAll(async () => {
    await Person.deleteMany({ email: /@step-test\.com$/ });
    await CalendarPlan.deleteMany({ title: /StepDeadlinesTest/ });
    await ContentPiece.deleteMany({ topic: /StepDeadlinesTest/ });
    await WorkItem.deleteMany({ title: /StepDeadlinesTest/ });
  });

  describe('1. Import Template and Column Specifications', () => {
    it('downloads Excel template containing all 23 expected workflow columns', async () => {
      const res = await request(app)
        .get('/api/calendar-plans/template')
        .set('Authorization', `Bearer ${smToken}`)
        .buffer(true)
        .parse((response, callback) => {
          const chunks = [];
          response.on('data', (chunk) => chunks.push(chunk));
          response.on('end', () => callback(null, Buffer.concat(chunks)));
        });

      expect(res.status).toBe(200);
      expect(res.header['content-type']).toContain('openxmlformats-officedocument');

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(res.body);
      const sheet = workbook.worksheets[0];
      expect(sheet).toBeDefined();

      const headers = [];
      sheet.getRow(1).eachCell((cell) => {
        headers.push(cell.value);
      });

      expect(headers.length).toBe(23);
      expect(headers).toContain('Posting Date');
      expect(headers).toContain('Posting Time');
      expect(headers).toContain('Topic');
      expect(headers).toContain('Type');
      expect(headers).toContain('Posting Owner');
      expect(headers).toContain('Content Owner');
      expect(headers).toContain('Content Deadline');
      expect(headers).toContain('Script Owner');
      expect(headers).toContain('Script Deadline');
      expect(headers).toContain('Needs Script');
      expect(headers).toContain('Needs Shoot');
      expect(headers).toContain('Shoot Owner');
      expect(headers).toContain('Shoot Deadline');
      expect(headers).toContain('Edit Owner');
      expect(headers).toContain('Edit Deadline');
      expect(headers).toContain('Design Owner');
      expect(headers).toContain('Design Deadline');
      expect(headers).toContain('Source Video Link');
    });

    it('previews import with blank deadlines and verifies autofilled step deadlines and owners', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 20);
      const postingDateStr = futureDate.toISOString().slice(0, 10);

      const previewRows = [
        {
          postingDate: postingDateStr,
          topic: 'StepDeadlinesTest Blank Row',
          contentType: 'Reel',
          needsScript: true,
          needsShoot: true,
          postingOwner: 'sm@step-test.com',
          // leave step owners and step deadlines blank to trigger suggested offsets
        },
      ];

      const res = await request(app)
        .post('/api/calendar-plans/preview')
        .set('Authorization', `Bearer ${smToken}`)
        .send({ rows: previewRows });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.rows.length).toBe(1);

      const parsedRow = res.body.data.rows[0];
      expect(parsedRow.isValid).toBe(true);
      expect(parsedRow.stagePlan).toBeDefined();
      expect(parsedRow.stagePlan.length).toBe(4); // Script, Shoot, Edit, Post

      // Verify Script is scheduled 8 days before F
      const scriptStage = parsedRow.stagePlan.find((s) => s.stageKey === 'Script');
      expect(scriptStage).toBeDefined();
      expect(scriptStage.isSuggestedDueDate).toBe(true);

      const expectedScriptDate = new Date(futureDate);
      expectedScriptDate.setDate(expectedScriptDate.getDate() - 8);
      expect(scriptStage.dueDate.slice(0, 10)).toBe(expectedScriptDate.toISOString().slice(0, 10));

      // Verify Shoot is scheduled 5 days before F
      const shootStage = parsedRow.stagePlan.find((s) => s.stageKey === 'Shoot');
      expect(shootStage).toBeDefined();
      expect(shootStage.isSuggestedDueDate).toBe(true);

      // Verify Edit is scheduled 2 days before F
      const editStage = parsedRow.stagePlan.find((s) => s.stageKey === 'Edit');
      expect(editStage).toBeDefined();
      expect(editStage.isSuggestedDueDate).toBe(true);

      // Verify Post matches F
      const postStage = parsedRow.stagePlan.find((s) => s.stageKey === 'Post');
      expect(postStage).toBeDefined();
      expect(postStage.dueDate.slice(0, 10)).toBe(postingDateStr);

      // Verify autofilled owner IDs
      expect(scriptStage.ownerId).toBe(scriptUser._id.toString());
      expect(scriptStage.isSuggestedOwner).toBe(true);
      expect(shootStage.ownerId).toBe(shootUser._id.toString());
      expect(shootStage.isSuggestedOwner).toBe(true);
      expect(editStage.ownerId).toBe(editUser._id.toString());
      expect(editStage.isSuggestedOwner).toBe(true);
    });

    it('rejects import row when unknown owner email is supplied', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 15);

      const previewRows = [
        {
          postingDate: futureDate.toISOString().slice(0, 10),
          topic: 'StepDeadlinesTest Unknown Email',
          contentType: 'Reel',
          needsScript: true,
          needsShoot: true,
          scriptOwner: 'unknown-ghost-user@nowhere.com',
        },
      ];

      const res = await request(app)
        .post('/api/calendar-plans/preview')
        .set('Authorization', `Bearer ${smToken}`)
        .send({ rows: previewRows });

      expect(res.status).toBe(200);
      expect(res.body.data.rows.length).toBe(1);
      const invalidRow = res.body.data.rows[0];
      expect(invalidRow.isValid).toBe(false);
      expect(invalidRow.errors.some((e) => e.includes('unknown-ghost-user@nowhere.com') || e.toLowerCase().includes('not an active team member'))).toBe(true);
    });
  });

  describe('2. Plan Row Form Step Validation', () => {
    let testPlan;

    beforeAll(async () => {
      testPlan = await CalendarPlan.create({
        code: 'STEP-DEADLINES-PLAN-1',
        title: 'StepDeadlinesTest Plan 2026',
        calendar: 'sm',
        kind: 'monthly',
        periodStart: new Date('2026-11-01'),
        periodEnd: new Date('2026-11-30'),
        createdById: smUser._id,
        status: 'Draft',
      });
    });

    it('rejects Reel without shoot when sourceVideoLink is missing', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 14);

      const res = await request(app)
        .post(`/api/calendar-plans/${testPlan._id}/rows`)
        .set('Authorization', `Bearer ${smToken}`)
        .send({
          rows: [
            {
              postingDate: futureDate.toISOString().slice(0, 10),
              topic: 'StepDeadlinesTest Reel No Shoot',
              contentType: 'Reel',
              needsScript: false,
              needsShoot: false,
              // sourceVideoLink omitted!
              postingOwnerId: smUser._id.toString(),
            },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('PLAN_VALIDATION_FAILED');
      expect(res.body.error.details.some((e) => e.code === 'MISSING_SOURCE_VIDEO')).toBe(true);
    });

    it('rejects step deadline scheduled after posting date (Deadline > F)', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      const postingDateStr = futureDate.toISOString().slice(0, 10);

      const afterF = new Date(futureDate);
      afterF.setDate(afterF.getDate() + 2);

      const res = await request(app)
        .post(`/api/calendar-plans/${testPlan._id}/rows`)
        .set('Authorization', `Bearer ${smToken}`)
        .send({
          rows: [
            {
              postingDate: postingDateStr,
              topic: 'StepDeadlinesTest Late Stage',
              contentType: 'Reel',
              needsScript: false,
              needsShoot: true,
              postingOwnerId: smUser._id.toString(),
              stagePlan: [
                {
                  stageKey: 'Shoot',
                  ownerId: shootUser._id.toString(),
                  dueDate: afterF.toISOString().slice(0, 10), // Invalid: > F
                },
                {
                  stageKey: 'Edit',
                  ownerId: editUser._id.toString(),
                  dueDate: postingDateStr,
                },
                {
                  stageKey: 'Post',
                  ownerId: smUser._id.toString(),
                  dueDate: postingDateStr,
                },
              ],
            },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('PLAN_VALIDATION_FAILED');
      expect(res.body.error.details.some((e) => e.code === 'DEADLINE_AFTER_POSTING')).toBe(true);
    });

    it('rejects out-of-order stage deadlines (e.g. Edit deadline earlier than Shoot deadline)', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 12);
      const postingDateStr = futureDate.toISOString().slice(0, 10);

      const shootDate = new Date(futureDate);
      shootDate.setDate(shootDate.getDate() - 2);

      const editDate = new Date(futureDate);
      editDate.setDate(editDate.getDate() - 5); // Invalid: Edit earlier than Shoot!

      const res = await request(app)
        .post(`/api/calendar-plans/${testPlan._id}/rows`)
        .set('Authorization', `Bearer ${smToken}`)
        .send({
          rows: [
            {
              postingDate: postingDateStr,
              topic: 'StepDeadlinesTest Out Of Order',
              contentType: 'Reel',
              needsScript: false,
              needsShoot: true,
              postingOwnerId: smUser._id.toString(),
              stagePlan: [
                {
                  stageKey: 'Shoot',
                  ownerId: shootUser._id.toString(),
                  dueDate: shootDate.toISOString().slice(0, 10),
                },
                {
                  stageKey: 'Edit',
                  ownerId: editUser._id.toString(),
                  dueDate: editDate.toISOString().slice(0, 10), // Out of order!
                },
                {
                  stageKey: 'Post',
                  ownerId: smUser._id.toString(),
                  dueDate: postingDateStr,
                },
              ],
            },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('PLAN_VALIDATION_FAILED');
      expect(res.body.error.details.some((e) => e.code === 'OUT_OF_ORDER_DEADLINES')).toBe(true);
    });

    it('accepts valid Reel row with full step deadlines and owners', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 15);
      const postingDateStr = futureDate.toISOString().slice(0, 10);

      const scriptDate = new Date(futureDate);
      scriptDate.setDate(scriptDate.getDate() - 8);

      const shootDate = new Date(futureDate);
      shootDate.setDate(shootDate.getDate() - 5);

      const editDate = new Date(futureDate);
      editDate.setDate(editDate.getDate() - 2);

      const res = await request(app)
        .post(`/api/calendar-plans/${testPlan._id}/rows`)
        .set('Authorization', `Bearer ${smToken}`)
        .send({
          rows: [
            {
              postingDate: postingDateStr,
              postingTime: '17:30',
              topic: 'StepDeadlinesTest Valid Full Reel',
              contentType: 'Reel',
              needsScript: true,
              needsShoot: true,
              postingOwnerId: smUser._id.toString(),
              stagePlan: [
                {
                  stageKey: 'Script',
                  ownerId: scriptUser._id.toString(),
                  dueDate: scriptDate.toISOString().slice(0, 10),
                  dueDateSource: 'manual',
                },
                {
                  stageKey: 'Shoot',
                  ownerId: shootUser._id.toString(),
                  dueDate: shootDate.toISOString().slice(0, 10),
                  dueDateSource: 'auto',
                },
                {
                  stageKey: 'Edit',
                  ownerId: editUser._id.toString(),
                  dueDate: editDate.toISOString().slice(0, 10),
                  dueDateSource: 'auto',
                },
                {
                  stageKey: 'Post',
                  ownerId: smUser._id.toString(),
                  dueDate: postingDateStr,
                  dueDateSource: 'auto',
                },
              ],
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.rows.length).toBe(1);

      const savedRow = res.body.data.rows[0];
      expect(savedRow.topic).toBe('StepDeadlinesTest Valid Full Reel');
      expect(savedRow.stagePlan.length).toBe(4);
      const savedPosterId = typeof savedRow.postingOwnerId === 'object' && savedRow.postingOwnerId !== null
        ? savedRow.postingOwnerId._id.toString()
        : String(savedRow.postingOwnerId);
      expect(savedPosterId).toBe(smUser._id.toString());
    });
  });

  describe('3. Creative Head Review and Stage Work Item Generation', () => {
    let reviewPlan, contentPieceId;

    beforeAll(async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 18);
      const postingDateStr = futureDate.toISOString().slice(0, 10);

      const scriptDate = new Date(futureDate);
      scriptDate.setDate(scriptDate.getDate() - 8);

      const shootDate = new Date(futureDate);
      shootDate.setDate(shootDate.getDate() - 5);

      const editDate = new Date(futureDate);
      editDate.setDate(editDate.getDate() - 2);

      reviewPlan = await CalendarPlan.create({
        code: 'STEP-DEADLINES-PLAN-REVIEW',
        title: 'StepDeadlinesTest Review Plan 2026',
        calendar: 'sm',
        kind: 'monthly',
        periodStart: new Date('2026-11-01'),
        periodEnd: new Date('2026-11-30'),
        createdById: smUser._id,
        status: 'Draft',
      });

      const addRowRes = await request(app)
        .post(`/api/calendar-plans/${reviewPlan._id}/rows`)
        .set('Authorization', `Bearer ${smToken}`)
        .send({
          rows: [
            {
              postingDate: postingDateStr,
              topic: 'StepDeadlinesTest For Approval',
              contentType: 'Reel',
              needsScript: true,
              needsShoot: true,
              brief: 'Complete creative brief for approval generation',
              postingOwnerId: smUser._id.toString(),
              stagePlan: [
                {
                  stageKey: 'Script',
                  ownerId: scriptUser._id.toString(),
                  dueDate: scriptDate.toISOString().slice(0, 10),
                },
                {
                  stageKey: 'Shoot',
                  ownerId: shootUser._id.toString(),
                  dueDate: shootDate.toISOString().slice(0, 10),
                },
                {
                  stageKey: 'Edit',
                  ownerId: editUser._id.toString(),
                  dueDate: editDate.toISOString().slice(0, 10),
                },
                {
                  stageKey: 'Post',
                  ownerId: smUser._id.toString(),
                  dueDate: postingDateStr,
                },
              ],
            },
          ],
        });

      contentPieceId = addRowRes.body.data.rows[0]._id;

      // Submit plan for review
      await request(app)
        .post(`/api/calendar-plans/${reviewPlan._id}/submit`)
        .set('Authorization', `Bearer ${smToken}`);
    });

    it('generates WorkItems with step-specific due dates and assigned owners upon approval', async () => {
      const reviewRes = await request(app)
        .post(`/api/calendar-plans/${reviewPlan._id}/review`)
        .set('Authorization', `Bearer ${headToken}`)
        .send({
          action: 'approve_selected',
          approvedRowIds: [contentPieceId.toString()],
        });

      expect(reviewRes.status).toBe(200);

      // Verify that stage WorkItems were created with proper deadlines and owners
      const workItems = await WorkItem.find({ contentPieceId }).lean();
      expect(workItems.length).toBeGreaterThanOrEqual(3);

      const scriptItem = workItems.find((w) => w.stageKey === 'Script');
      expect(scriptItem).toBeDefined();
      expect(scriptItem.ownerId.toString()).toBe(scriptUser._id.toString());
      expect(scriptItem.deadline).toBeDefined();

      const shootItem = workItems.find((w) => w.stageKey === 'Shoot');
      expect(shootItem).toBeDefined();
      expect(shootItem.ownerId.toString()).toBe(shootUser._id.toString());

      const editItem = workItems.find((w) => w.stageKey === 'Edit');
      expect(editItem).toBeDefined();
      expect(editItem.ownerId.toString()).toBe(editUser._id.toString());
    });

    it('Creative Calendar Month query returns stage items and publish date events', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 1);
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);

      const res = await request(app)
        .get(`/api/work-items/calendar?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`)
        .set('Authorization', `Bearer ${smToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();

      const calendarItems = res.body.data;
      const pieceItems = calendarItems.filter((i) => i.topic?.includes('StepDeadlinesTest For Approval') || i.title?.includes('StepDeadlinesTest For Approval'));
      expect(pieceItems.length).toBeGreaterThan(0);

      // Verify publish event is included
      const publishEvent = pieceItems.find((i) => i.isPublishEvent === true);
      expect(publishEvent).toBeDefined();
      expect(publishEvent.topic).toBe('StepDeadlinesTest For Approval');

      // Verify stage work item is included
      const stageWorkItem = pieceItems.find((i) => !i.isPublishEvent && i.stageKey === 'Script');
      expect(stageWorkItem).toBeDefined();
      expect(stageWorkItem.stageKey).toBe('Script');
    });
  });
});
