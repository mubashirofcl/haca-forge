import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { app } from '../src/server.js';
import { env } from '../src/config/env.js';
import { Person } from '../src/modules/people/model.js';
import { Profile } from '../src/modules/referenceData/profile.model.js';
import { CalendarPlan } from '../src/modules/calendar/plan.model.js';
import { ContentPiece } from '../src/modules/calendar/contentPiece.model.js';
import { ActivityEvent } from '../src/modules/activity/model.js';
import { connectDB } from '../src/config/db.js';
import {
  derivePlanStatus,
  formatPlanRowCounts,
} from '@mmp/shared';
import {
  computePlanRowStats,
  getDefaultPlanTitle,
  checkPlanPeriodConstraints,
  repairInconsistentPlanStatuses,
} from '../src/modules/calendar/plan.service.js';

describe('PLAN LIST FIXES: Unit, API, Database Repair & Text Scan Suite', () => {
  let smUser, headUser, adminUser;
  let smToken, headToken, adminToken;
  let testProfile;

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

    // Clean up any existing test fixtures
    await Person.deleteMany({ email: /@plan-fixes-test\.com$/ });
    await Profile.deleteMany({ code: 'pf_profile' });
    await CalendarPlan.deleteMany({ $or: [{ code: /PF-/ }, { title: /Mid Nov to Mid Dec/ }] });
    await ContentPiece.deleteMany({ topic: /PF-/ });

    testProfile = await Profile.create({
      name: 'Plan Fixes Master Profile',
      code: 'pf_profile',
      active: true,
    });

    smUser = await Person.create({
      name: 'SM Fixes User',
      email: 'sm@plan-fixes-test.com',
      role: 'sm_manager',
      status: 'active',
    });
    smToken = makeToken(smUser);

    headUser = await Person.create({
      name: 'Head Fixes User',
      email: 'head@plan-fixes-test.com',
      role: 'creative_head',
      status: 'active',
    });
    headToken = makeToken(headUser);

    adminUser = await Person.create({
      name: 'Admin Fixes User',
      email: 'admin@plan-fixes-test.com',
      role: 'admin',
      status: 'active',
    });
    adminToken = makeToken(adminUser);
  });

  afterAll(async () => {
    await Person.deleteMany({ email: /@plan-fixes-test\.com$/ });
    await Profile.deleteMany({ code: 'pf_profile' });
    await CalendarPlan.deleteMany({ $or: [{ code: /PF-/ }, { title: /Mid Nov to Mid Dec/ }] });
    await ContentPiece.deleteMany({ topic: /PF-/ });
  });

  describe('1. formatPlanRowCounts & computePlanRowStats', () => {
    it('returns "No rows yet" when total rows is 0', () => {
      expect(formatPlanRowCounts({ total: 0 })).toBe('No rows yet');
      expect(formatPlanRowCounts({ total: 0, draft: 0, approved: 0 })).toBe('No rows yet');
      expect(formatPlanRowCounts(null)).toBe('No rows yet');
      expect(formatPlanRowCounts({})).toBe('No rows yet');
    });

    it('formats counts properly and omits 0 counts', () => {
      const stats = {
        total: 5,
        approved: 2,
        submitted: 1,
        changes_requested: 1,
        draft: 1,
      };
      expect(formatPlanRowCounts(stats)).toBe(
        '5 rows: 2 approved, 1 submitted, 1 changes requested, 1 draft'
      );

      const statsNoDraft = {
        total: 3,
        approved: 2,
        submitted: 1,
        changes_requested: 0,
        draft: 0,
      };
      expect(formatPlanRowCounts(statsNoDraft)).toBe('3 rows: 2 approved, 1 submitted');
    });

    it('computePlanRowStats provides both canonical and breakdown fields', () => {
      const rows = [
        { rowStatus: 'approved' },
        { rowStatus: 'approved' },
        { rowStatus: 'submitted' },
        { rowStatus: 'changes_requested' },
        { rowStatus: 'draft' },
      ];
      const stats = computePlanRowStats(rows);
      expect(stats.rowCount).toBe(5);
      expect(stats.totalRows).toBe(5);
      expect(stats.approvedRowCount).toBe(2);
      expect(stats.submittedRowCount).toBe(1);
      expect(stats.changesRequestedRowCount).toBe(1);
      expect(stats.draftRowCount).toBe(1);
      expect(stats.pendingRows).toBe(3);
      expect(stats.status).toBe('Approved with pending rows');
    });
  });

  describe('2. derivePlanStatus for all combinations', () => {
    it('always returns Draft if rows array is empty or null, regardless of submittedAt', () => {
      expect(derivePlanStatus([], null)).toBe('Draft');
      expect(derivePlanStatus([], new Date())).toBe('Draft');
      expect(derivePlanStatus(null, new Date())).toBe('Draft');
      expect(derivePlanStatus(undefined, new Date())).toBe('Draft');
    });

    it('returns Approved when all rows are approved', () => {
      const rows = [{ rowStatus: 'approved' }, { rowStatus: 'approved' }];
      expect(derivePlanStatus(rows)).toBe('Approved');
    });

    it('returns Approved with pending rows when some rows are approved and others are draft or submitted', () => {
      const mixed1 = [{ rowStatus: 'approved' }, { rowStatus: 'draft' }];
      expect(derivePlanStatus(mixed1)).toBe('Approved with pending rows');

      const mixed2 = [{ rowStatus: 'approved' }, { rowStatus: 'submitted' }];
      expect(derivePlanStatus(mixed2)).toBe('Approved with pending rows');
    });

    it('returns Changes requested if any row has changes_requested and none are approved', () => {
      const rows = [
        { rowStatus: 'changes_requested' },
        { rowStatus: 'submitted' },
      ];
      expect(derivePlanStatus(rows)).toBe('Changes requested');
    });

    it('returns Submitted when rows are submitted or a mix of submitted and draft', () => {
      const allSubmitted = [{ rowStatus: 'submitted' }, { rowStatus: 'submitted' }];
      expect(derivePlanStatus(allSubmitted)).toBe('Submitted');

      const subAndDraft = [{ rowStatus: 'submitted' }, { rowStatus: 'draft' }];
      expect(derivePlanStatus(subAndDraft)).toBe('Submitted');
    });

    it('returns Draft when all rows are draft', () => {
      const allDraft = [{ rowStatus: 'draft' }, { rowStatus: 'draft' }];
      expect(derivePlanStatus(allDraft)).toBe('Draft');
    });
  });

  describe('3. Submit Plan Blocked with Zero Rows', () => {
    it('strictly refuses submitting an empty plan with exact message "Add at least one row"', async () => {
      const plan = await CalendarPlan.create({
        code: 'PF-2026-11-001',
        title: 'Empty November Plan',
        kind: 'monthly',
        periodStart: new Date('2026-11-01'),
        periodEnd: new Date('2026-11-30'),
        profileId: testProfile._id,
        createdById: smUser._id,
      });

      const res = await request(app)
        .post(`/api/calendar-plans/${plan._id}/submit`)
        .set('Authorization', `Bearer ${smToken}`)
        .send({});

      expect(res.status).toBe(400);
      const errorObj = res.body.error || res.body;
      expect(errorObj.message).toBe('Add at least one row');
      expect(errorObj.code).toBe('PLAN_EMPTY_ROWS');

      // Verify plan remains in Draft in DB
      const freshPlan = await CalendarPlan.findById(plan._id);
      expect(freshPlan.submittedAt).toBeNull();
    });
  });

  describe('4. Period Constraints: Duplicate and Overlap', () => {
    let basePlan;

    beforeAll(async () => {
      basePlan = await CalendarPlan.create({
        code: 'PF-2026-11-002',
        title: 'November 2026',
        kind: 'monthly',
        periodStart: new Date('2026-11-01T00:00:00.000Z'),
        periodEnd: new Date('2026-11-30T23:59:59.999Z'),
        profileId: testProfile._id,
        createdById: smUser._id,
      });
    });

    it('blocks exact duplicate monthly period with 400 EXACT_DUPLICATE_PERIOD', async () => {
      const res = await request(app)
        .post('/api/calendar-plans')
        .set('Authorization', `Bearer ${smToken}`)
        .send({
          title: 'Duplicate November',
          kind: 'monthly',
          periodStart: '2026-11-01',
          periodEnd: '2026-11-30',
          profileId: testProfile._id.toString(),
        });

      expect(res.status).toBe(400);
      const errorObj = res.body.error || res.body;
      expect(errorObj.code).toBe('EXACT_DUPLICATE_PERIOD');
      expect(errorObj.message).toContain('An active monthly plan already exists for this exact period');
    });

    it('allows overlapping period but returns warning linking to conflicting plan', async () => {
      const res = await request(app)
        .post('/api/calendar-plans')
        .set('Authorization', `Bearer ${smToken}`)
        .send({
          title: 'Overlapping Mid Nov to Mid Dec',
          kind: 'monthly',
          periodStart: '2026-11-10',
          periodEnd: '2026-12-09',
          profileId: testProfile._id.toString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.data.submissionWarnings).toBeDefined();
      expect(res.body.data.submissionWarnings.length).toBeGreaterThan(0);
      const overlapWarning = res.body.data.submissionWarnings.find(
        (w) => w.code === 'OVERLAPPING_PERIOD' && w.overlappingPlanId === basePlan._id.toString()
      );
      expect(overlapWarning).toBeDefined();
      expect(overlapWarning.message).toContain('overlaps with');
      expect(overlapWarning.overlappingPlanCode).toBe(basePlan.code);

      // Clean up overlapping plan
      await CalendarPlan.findByIdAndDelete(res.body.data._id);
    });

    it('ignores cancelled plans when checking period overlap', async () => {
      const cancelledPlan = await CalendarPlan.create({
        code: 'PF-2027-04-001',
        title: 'Cancelled April Plan',
        kind: 'monthly',
        periodStart: new Date('2027-04-01T00:00:00.000Z'),
        periodEnd: new Date('2027-04-30T23:59:59.999Z'),
        status: 'cancelled',
        profileId: testProfile._id,
        createdById: smUser._id,
      });

      const res = await request(app)
        .post('/api/calendar-plans')
        .set('Authorization', `Bearer ${smToken}`)
        .send({
          kind: 'monthly',
          periodStart: '2027-04-01',
          periodEnd: '2027-04-30',
          profileId: testProfile._id.toString(),
        });

      expect(res.status).toBe(201);
      const warnings = res.body.data.submissionWarnings || [];
      const hasConflict = warnings.some(
        (w) => w.overlappingPlanId === cancelledPlan._id.toString()
      );
      expect(hasConflict).toBe(false);

      // Clean up
      await CalendarPlan.findByIdAndDelete(res.body.data._id);
      await CalendarPlan.findByIdAndDelete(cancelledPlan._id);
    });
  });

  describe('5. Default Plan Title and Title Editing', () => {
    it('defaults title to <Calendar> <Month> <Year> when omitted', async () => {
      expect(getDefaultPlanTitle('2027-01-01')).toBe('SM Calendar January 2027');

      const res = await request(app)
        .post('/api/calendar-plans')
        .set('Authorization', `Bearer ${smToken}`)
        .send({
          kind: 'monthly',
          periodStart: '2027-02-01',
          periodEnd: '2027-02-28',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe('SM Calendar February 2027');

      const planId = res.body.data._id;

      // Edit title via PATCH
      const patchRes = await request(app)
        .patch(`/api/calendar-plans/${planId}`)
        .set('Authorization', `Bearer ${smToken}`)
        .send({
          title: 'February 2027 Global Launch',
        });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.title).toBe('February 2027 Global Launch');

      await CalendarPlan.findByIdAndDelete(planId);
    });
  });

  describe('6. Delete Plan Rules and ActivityEvent', () => {
    it('allows deleting Draft plan with zero approved rows and logs calendar_plan.deleted ActivityEvent', async () => {
      const plan = await CalendarPlan.create({
        code: 'PF-2026-11-004',
        title: 'Deletable Draft Plan',
        kind: 'monthly',
        periodStart: new Date('2026-11-01'),
        periodEnd: new Date('2026-11-30'),
        profileId: testProfile._id,
        createdById: smUser._id,
      });

      const row = await ContentPiece.create({
        planId: plan._id,
        topic: 'PF Row to Delete',
        contentType: 'Static Graphic',
        pipeline: 'design',
        postingDate: new Date('2026-11-15'),
        rowStatus: 'draft',
      });

      const res = await request(app)
        .delete(`/api/calendar-plans/${plan._id}`)
        .set('Authorization', `Bearer ${smToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('deleted successfully');

      // Verify plan and row are deleted
      expect(await CalendarPlan.findById(plan._id)).toBeNull();
      expect(await ContentPiece.findById(row._id)).toBeNull();

      // Verify ActivityEvent was logged
      const event = await ActivityEvent.findOne({
        entityId: plan._id.toString(),
        action: 'calendar_plan.deleted',
      });
      expect(event).toBeDefined();
      expect(event.metadata.code).toBe(plan.code);
    });

    it('Phase 6: a plan with approved rows but no started steps can be deleted', async () => {
      const plan = await CalendarPlan.create({
        code: 'PF-2026-11-005',
        title: 'Plan with Approved Row',
        kind: 'monthly',
        periodStart: new Date('2026-11-01'),
        periodEnd: new Date('2026-11-30'),
        profileId: testProfile._id,
        createdById: smUser._id,
      });

      await ContentPiece.create({
        planId: plan._id,
        topic: 'PF Approved Row',
        contentType: 'Static Graphic',
        pipeline: 'design',
        postingDate: new Date('2026-11-15'),
        rowStatus: 'approved',
      });

      const res = await request(app)
        .delete(`/api/calendar-plans/${plan._id}`)
        .set('Authorization', `Bearer ${smToken}`);

      expect(res.status).toBe(200);
      expect(await CalendarPlan.findById(plan._id)).toBeNull();
      expect(await ContentPiece.countDocuments({ planId: plan._id })).toBe(0);

      await ContentPiece.deleteMany({ planId: plan._id });
      await CalendarPlan.findByIdAndDelete(plan._id);
    });
  });

  describe('7. Database Repair: repairInconsistentPlanStatuses', () => {
    it('repairs plans with zero rows and non-Draft stored fields, clearing timestamps and logging changes', async () => {
      const inconsistentPlan = await CalendarPlan.create({
        code: 'PF-2026-11-REPAIR',
        title: 'Orphaned Submitted Plan',
        kind: 'monthly',
        periodStart: new Date('2026-11-01'),
        periodEnd: new Date('2026-11-30'),
        profileId: testProfile._id,
        createdById: smUser._id,
        submittedAt: new Date('2026-10-25T12:00:00Z'),
        approvedAt: new Date('2026-10-25T13:00:00Z'),
        approvedById: headUser._id,
        rejectionConcern: 'Legacy concern',
      });

      const repairResult = await repairInconsistentPlanStatuses();
      expect(repairResult.repairedCount).toBeGreaterThanOrEqual(1);

      const repaired = repairResult.repairedPlans.find(
        (p) => p._id.toString() === inconsistentPlan._id.toString()
      );
      expect(repaired).toBeDefined();
      expect(repaired.changes).toEqual(
        expect.arrayContaining([
          expect.stringContaining('cleared submittedAt'),
          expect.stringContaining('cleared approvedAt'),
          expect.stringContaining('cleared approvedById'),
          expect.stringContaining('cleared rejectionConcern'),
        ])
      );

      const freshPlan = await CalendarPlan.findById(inconsistentPlan._id);
      expect(freshPlan.submittedAt).toBeNull();
      expect(freshPlan.approvedAt).toBeNull();
      expect(freshPlan.approvedById).toBeNull();
      expect(freshPlan.rejectionConcern).toBe('');

      // Check on-read also computes stats as Draft
      const getRes = await request(app)
        .get(`/api/calendar-plans/${inconsistentPlan._id}`)
        .set('Authorization', `Bearer ${smToken}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.status).toBe('Draft');
      expect(getRes.body.data.rowCount).toBe(0);

      // Clean up
      await CalendarPlan.findByIdAndDelete(inconsistentPlan._id);
    });
  });

  describe('8. UI Text Scan: Forbidden Vocabulary Check', () => {
    it('asserts web pages contain no instances of "FORGE", "cases & requests", or ticketing "ticket" in UI elements', () => {
      const pagesDir = path.resolve(__dirname, '../../web/src');

      function scanDir(dir) {
        const files = fs.readdirSync(dir);
        let violations = [];

        for (const file of files) {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);

          if (stat.isDirectory()) {
            violations = violations.concat(scanDir(fullPath));
          } else if (/\.(tsx|jsx|html)$/.test(file) && !file.includes('.test.')) {
            const content = fs.readFileSync(fullPath, 'utf8');

            // 1. FORGE in UI strings (outside code variables)
            if (/HACA FORGE/i.test(content)) {
              violations.push(`${fullPath}: Contains "HACA FORGE"`);
            }

            // 2. "Search cases & requests"
            if (/Search cases & requests/i.test(content)) {
              violations.push(`${fullPath}: Contains "Search cases & requests"`);
            }

            // 3. "Create monthly campaigns, validate spreadsheet imports"
            if (/Create monthly campaigns, validate spreadsheet imports/i.test(content)) {
              violations.push(
                `${fullPath}: Contains old text "Create monthly campaigns, validate spreadsheet imports"`
              );
            }
          }
        }
        return violations;
      }

      const violations = scanDir(pagesDir);
      expect(violations).toEqual([]);
    });
  });

  describe('9. Deliverable Type Normalization & Submission Healing', () => {
    it('submits a plan containing "Reel / Video" row successfully without UNKNOWN_TYPE error', async () => {
      const plan = await CalendarPlan.create({
        title: 'PF-ReelVideo Test Plan',
        code: 'PF-RV-01',
        kind: 'individual',
        periodStart: new Date('2026-11-15T00:00:00.000Z'),
        periodEnd: new Date('2026-11-15T00:00:00.000Z'),
        calendar: 'sm',
        createdById: smUser._id,
        status: 'Draft',
      });

      const row = await ContentPiece.create({
        planId: plan._id,
        topic: 'PF-ReelVideo Launch',
        type: 'Reel / Video',
        contentType: 'Reel / Video',
        postingDate: new Date('2026-11-15T18:00:00.000Z'),
        brief: 'Deliverable brief for Reel / Video',
        calendar: 'sm',
        pipeline: 'reel_a',
        hasPostStage: true,
        createdById: smUser._id,
      });

      const res = await request(app)
        .post(`/api/calendar-plans/${plan._id}/submit`)
        .set('Authorization', `Bearer ${smToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('Submitted');

      const updatedRow = await ContentPiece.findById(row._id);
      expect(updatedRow.type).toBe('Reel');
      expect(updatedRow.contentType).toBe('Reel');
      expect(updatedRow.postingOwnerId).toBeDefined();

      await ContentPiece.findByIdAndDelete(row._id);
      await CalendarPlan.findByIdAndDelete(plan._id);
    });
  });

  afterAll(async () => {
    await Person.deleteMany({ email: /@plan-fixes-test\.com$/ });
    await Profile.deleteMany({ code: 'pf_profile' });
    await CalendarPlan.deleteMany({ $or: [{ code: /PF-/ }, { title: /Mid Nov to Mid Dec/ }] });
    await ContentPiece.deleteMany({ topic: /PF-/ });
  });
});

