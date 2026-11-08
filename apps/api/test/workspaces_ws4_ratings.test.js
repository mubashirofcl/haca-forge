import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/server.js';
import { env } from '../src/config/env.js';
import { connectDB } from '../src/config/db.js';
import { Person } from '../src/modules/people/model.js';
import { WorkItem } from '../src/modules/workItems/model.js';
import { Submission, Rating } from '../src/modules/submissions/model.js';

describe('Workspaces WS4: Ratings in Profiles, Guardrails, and Reports', () => {
  let adminUser, creativeHeadUser, smManagerUser, executiveUser, workerAUser, workerBUser, workerUnratedUser, workerFewUser;
  let adminToken, headToken, smToken, execToken, workerAToken, workerBToken, workerUnratedToken, workerFewToken;
  let testWorkItemA, testWorkItemB;
  let testRating1, testRating2, testRating3, testRatingOld;
  let deptId, profId;

  beforeAll(async () => {
    await connectDB();

    const deptDoc = await mongoose.connection.db.collection('departments').findOne({});
    const profileDoc = await mongoose.connection.db.collection('profiles').findOne({});

    deptId = deptDoc?._id || new mongoose.Types.ObjectId();
    profId = profileDoc?._id || new mongoose.Types.ObjectId();

    // Clean any previous test artifacts
    await Person.deleteMany({ email: { $regex: /@ws4-test\.com$/ } });
    await WorkItem.deleteMany({ title: { $regex: /WS4 Test/ } });
    await Rating.deleteMany({ feedback: { $regex: /WS4/ } });

    // Create users for each role
    adminUser = await Person.create({
      name: 'Admin Boss WS4',
      email: 'admin@ws4-test.com',
      role: 'admin',
      department: 'Creative',
      jobRole: 'Creative Manager (TL)',
      status: 'active',
      authMethod: 'password',
      profileAccess: [profId],
    });

    creativeHeadUser = await Person.create({
      name: 'Creative Head WS4',
      email: 'ch@ws4-test.com',
      role: 'creative_head',
      department: 'Creative',
      jobRole: 'Creative Manager (TL)',
      status: 'active',
      authMethod: 'password',
      profileAccess: [profId],
    });

    smManagerUser = await Person.create({
      name: 'SM Manager WS4',
      email: 'sm@ws4-test.com',
      role: 'sm_manager',
      department: 'Social Media',
      jobRole: 'Social Media Manager',
      status: 'active',
      authMethod: 'password',
      profileAccess: [profId],
    });

    executiveUser = await Person.create({
      name: 'Executive Viewer WS4',
      email: 'exec@ws4-test.com',
      role: 'executive',
      department: 'Executive',
      status: 'active',
      authMethod: 'password',
      profileAccess: [profId],
    });

    workerAUser = await Person.create({
      name: 'Writer Alice WS4',
      email: 'alice@ws4-test.com',
      role: 'team_member',
      department: 'Content',
      jobRole: 'Writer',
      status: 'active',
      authMethod: 'password',
      profileAccess: [profId],
    });

    workerBUser = await Person.create({
      name: 'Designer Bob WS4',
      email: 'bob@ws4-test.com',
      role: 'team_member',
      department: 'Design',
      jobRole: 'Designer',
      status: 'active',
      authMethod: 'password',
      profileAccess: [profId],
    });

    workerUnratedUser = await Person.create({
      name: 'Unrated Worker WS4',
      email: 'unrated@ws4-test.com',
      role: 'team_member',
      department: 'Content',
      jobRole: 'Writer',
      status: 'active',
      authMethod: 'password',
      profileAccess: [profId],
    });

    workerFewUser = await Person.create({
      name: 'Few Ratings Worker WS4',
      email: 'few@ws4-test.com',
      role: 'team_member',
      department: 'Content',
      jobRole: 'Writer',
      status: 'active',
      authMethod: 'password',
      profileAccess: [profId],
    });

    // Create JWT tokens
    adminToken = jwt.sign(
      { userId: adminUser._id.toString(), email: adminUser.email, role: adminUser.role, name: adminUser.name },
      env.JWT_SECRET,
      { expiresIn: '2h' }
    );
    headToken = jwt.sign(
      { userId: creativeHeadUser._id.toString(), email: creativeHeadUser.email, role: creativeHeadUser.role, name: creativeHeadUser.name },
      env.JWT_SECRET,
      { expiresIn: '2h' }
    );
    smToken = jwt.sign(
      { userId: smManagerUser._id.toString(), email: smManagerUser.email, role: smManagerUser.role, name: smManagerUser.name },
      env.JWT_SECRET,
      { expiresIn: '2h' }
    );
    execToken = jwt.sign(
      { userId: executiveUser._id.toString(), email: executiveUser.email, role: executiveUser.role, name: executiveUser.name },
      env.JWT_SECRET,
      { expiresIn: '2h' }
    );
    workerAToken = jwt.sign(
      { userId: workerAUser._id.toString(), email: workerAUser.email, role: workerAUser.role, name: workerAUser.name },
      env.JWT_SECRET,
      { expiresIn: '2h' }
    );
    workerBToken = jwt.sign(
      { userId: workerBUser._id.toString(), email: workerBUser.email, role: workerBUser.role, name: workerBUser.name },
      env.JWT_SECRET,
      { expiresIn: '2h' }
    );
    workerUnratedToken = jwt.sign(
      { userId: workerUnratedUser._id.toString(), email: workerUnratedUser.email, role: workerUnratedUser.role, name: workerUnratedUser.name },
      env.JWT_SECRET,
      { expiresIn: '2h' }
    );
    workerFewToken = jwt.sign(
      { userId: workerFewUser._id.toString(), email: workerFewUser.email, role: workerFewUser.role, name: workerFewUser.name },
      env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    // Create test work items
    testWorkItemA = await WorkItem.create({
      title: 'WS4 Test Script Deliverable',
      workType: 'Reel',
      status: 'Approved',
      stageKey: 'Script',
      stageOrder: 1,
      departmentId: deptId,
      profileId: profId,
      ownerId: workerAUser._id,
      deadline: new Date(),
    });

    testWorkItemB = await WorkItem.create({
      title: 'WS4 Test Design Deliverable',
      workType: 'Static Post',
      status: 'In Progress',
      stageKey: 'Design',
      stageOrder: 1,
      departmentId: deptId,
      profileId: profId,
      ownerId: workerBUser._id,
      deadline: new Date(),
    });

    const testWorkItemFew = await WorkItem.create({
      title: 'WS4 Test Few Deliverable',
      workType: 'Reel',
      status: 'Approved',
      stageKey: 'Script',
      stageOrder: 1,
      departmentId: deptId,
      profileId: profId,
      ownerId: workerFewUser._id,
      deadline: new Date(),
    });

    // Seed Submissions and Ratings for WorkerFew
    const subFew1 = await Submission.create({
      workItemId: testWorkItemFew._id,
      stageKey: 'Script',
      version: 1,
      kind: 'document',
      status: 'approved',
      submittedById: workerFewUser._id,
    });
    await Rating.create({
      submissionId: subFew1._id,
      workItemId: testWorkItemFew._id,
      stageKey: 'Script',
      workerId: workerFewUser._id,
      raterId: creativeHeadUser._id,
      score: 5,
      feedback: 'WS4 Solid draft from few user',
      tags: ['Great hook'],
      createdAt: new Date(),
    });

    const subFew2 = await Submission.create({
      workItemId: testWorkItemFew._id,
      stageKey: 'Script',
      version: 2,
      kind: 'document',
      status: 'approved',
      submittedById: workerFewUser._id,
    });
    await Rating.create({
      submissionId: subFew2._id,
      workItemId: testWorkItemFew._id,
      stageKey: 'Script',
      workerId: workerFewUser._id,
      raterId: creativeHeadUser._id,
      score: 4,
      feedback: 'WS4 Good baseline',
      tags: ['Clear message'],
      createdAt: new Date(),
    });

    // Seed 4 submissions and ratings for Worker A (Alice)
    // Rating 1: 5 days ago (score 5)
    const subA1 = await Submission.create({
      workItemId: testWorkItemA._id,
      stageKey: 'Script',
      version: 1,
      kind: 'document',
      status: 'approved',
      submittedById: workerAUser._id,
    });
    testRating1 = await Rating.create({
      submissionId: subA1._id,
      workItemId: testWorkItemA._id,
      stageKey: 'Script',
      workerId: workerAUser._id,
      raterId: creativeHeadUser._id,
      score: 5,
      feedback: 'WS4 Outstanding hook and pacing',
      tags: ['Great hook', 'Clear message'],
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    });

    // Rating 2: 15 days ago (score 4)
    const subA2 = await Submission.create({
      workItemId: testWorkItemA._id,
      stageKey: 'Script',
      version: 2,
      kind: 'document',
      status: 'approved',
      submittedById: workerAUser._id,
    });
    testRating2 = await Rating.create({
      submissionId: subA2._id,
      workItemId: testWorkItemA._id,
      stageKey: 'Script',
      workerId: workerAUser._id,
      raterId: creativeHeadUser._id,
      score: 4,
      feedback: 'WS4 Good structure, minor edits needed',
      tags: ['Clear message'],
      createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
    });

    // Rating 3: 40 days ago (score 3)
    const subA3 = await Submission.create({
      workItemId: testWorkItemA._id,
      stageKey: 'Script',
      version: 3,
      kind: 'document',
      status: 'approved',
      submittedById: workerAUser._id,
    });
    testRating3 = await Rating.create({
      submissionId: subA3._id,
      workItemId: testWorkItemA._id,
      stageKey: 'Script',
      workerId: workerAUser._id,
      raterId: creativeHeadUser._id,
      score: 3,
      feedback: 'WS4 Decent script, had some technical terms to fix',
      tags: ['Needs polish'],
      createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000), // 40 days ago
    });

    // Rating 4: 100 days ago (score 4)
    const subA4 = await Submission.create({
      workItemId: testWorkItemA._id,
      stageKey: 'Script',
      version: 4,
      kind: 'document',
      status: 'approved',
      submittedById: workerAUser._id,
    });
    testRatingOld = await Rating.create({
      submissionId: subA4._id,
      workItemId: testWorkItemA._id,
      stageKey: 'Script',
      workerId: workerAUser._id,
      raterId: creativeHeadUser._id,
      score: 4,
      feedback: 'WS4 Good baseline copy',
      tags: ['Clear message'],
      createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000), // 100 days ago
    });
  });

  afterAll(async () => {
    await Person.deleteMany({ email: { $regex: /@ws4-test\.com$/ } });
    await WorkItem.deleteMany({ title: { $regex: /WS4 Test/ } });
    await Rating.deleteMany({ feedback: { $regex: /WS4/ } });
    await mongoose.connection.close();
  });

  describe('Task 1: 3-Rating Minimum Threshold & Privacy Scoping', () => {
    it('returns "Not enough ratings yet" when worker has 0 ratings', async () => {
      const res = await request(app)
        .get(`/api/submissions/ratings/summary/${workerUnratedUser._id}`)
        .set('Authorization', `Bearer ${workerUnratedToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.thresholdMet).toBe(false);
      expect(res.body.data.message).toBe('Not enough ratings yet');
      expect(res.body.data.count).toBe(0);
      expect(res.body.data.averageAllTime).toBeNull();
    });

    it('returns "Not enough ratings yet" when worker has only 2 ratings', async () => {
      const res = await request(app)
        .get(`/api/submissions/ratings/summary/${workerFewUser._id}`)
        .set('Authorization', `Bearer ${workerFewToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.thresholdMet).toBe(false);
      expect(res.body.data.message).toBe('Not enough ratings yet');
      expect(res.body.data.count).toBe(2);
      expect(res.body.data.averageAllTime).toBeNull();
    });

    it('enforces privacy guardrail: worker cannot see another worker ratings (HTTP 403)', async () => {
      const res = await request(app)
        .get(`/api/submissions/ratings/summary/${workerAUser._id}`)
        .set('Authorization', `Bearer ${workerBToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('FORBIDDEN_RATINGS_ACCESS');
    });

    it('enforces privacy guardrail on /api/people/:id/ratings route as well', async () => {
      const res = await request(app)
        .get(`/api/people/${workerAUser._id}/ratings`)
        .set('Authorization', `Bearer ${workerBToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('FORBIDDEN_RATINGS_ACCESS');
    });

    it('allows leadership roles (creative_head, sm_manager, admin, executive) to inspect worker ratings', async () => {
      for (const token of [headToken, smToken, adminToken, execToken]) {
        const res = await request(app)
          .get(`/api/submissions/ratings/summary/${workerAUser._id}`)
          .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data.personId).toBe(workerAUser._id.toString());
      }
    });
  });

  describe('Task 1: Profile Window Maths (All-Time, 30d, 90d, Distribution, Monthly Trend, Step Types)', () => {
    it('computes correct averages across 30d, 90d, and all-time windows', async () => {
      const res = await request(app)
        .get(`/api/submissions/ratings/summary/${workerAUser._id}`)
        .set('Authorization', `Bearer ${workerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.thresholdMet).toBe(true);
      expect(res.body.data.count).toBe(4);

      // All-time: scores [5, 4, 3, 4] -> sum = 16 / 4 = 4.00
      expect(res.body.data.averageAllTime).toBe(4.0);

      // 30 days: scores [5 (5d ago), 4 (15d ago)] -> sum = 9 / 2 = 4.50
      expect(res.body.data.average30Days).toBe(4.5);

      // 90 days: scores [5 (5d ago), 4 (15d ago), 3 (40d ago)] -> sum = 12 / 3 = 4.00
      expect(res.body.data.average90Days).toBe(4.0);
    });

    it('returns score distribution (1 to 5 bars)', async () => {
      const res = await request(app)
        .get(`/api/submissions/ratings/summary/${workerAUser._id}`)
        .set('Authorization', `Bearer ${workerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.distribution).toEqual({
        1: 0,
        2: 0,
        3: 1, // one 3-star
        4: 2, // two 4-stars
        5: 1, // one 5-star
      });
    });

    it('returns average per step type', async () => {
      const res = await request(app)
        .get(`/api/submissions/ratings/summary/${workerAUser._id}`)
        .set('Authorization', `Bearer ${workerAToken}`);

      expect(res.status).toBe(200);
      // Script: [5, 4, 3, 4] -> sum 16 / 4 = 4.00
      expect(res.body.data.averagePerStepType['Script']).toBe(4.0);
    });

    it('returns monthly trend with valid averages', async () => {
      const res = await request(app)
        .get(`/api/submissions/ratings/summary/${workerAUser._id}`)
        .set('Authorization', `Bearer ${workerAToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.monthlyTrend)).toBe(true);
      expect(res.body.data.monthlyTrend.length).toBeGreaterThan(0);
      for (const m of res.body.data.monthlyTrend) {
        expect(m.month).toMatch(/^\d{4}-\d{2}$/);
        expect(m.average).toBeGreaterThanOrEqual(1);
        expect(m.average).toBeLessThanOrEqual(5);
      }
    });

    it('returns recent feedback items with content title, date, rater, and seen status', async () => {
      const res = await request(app)
        .get(`/api/submissions/ratings/summary/${workerAUser._id}`)
        .set('Authorization', `Bearer ${workerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.recentFeedback.length).toBe(4);
      const first = res.body.data.recentFeedback[0];
      expect(first.ratingId).toBeDefined();
      expect(first.score).toBeDefined();
      expect(first.feedback).toBeDefined();
      expect(first.stageKey).toBeDefined();
      expect(first.deliverableTitle).toBe('WS4 Test Script Deliverable');
      expect(first.raterName).toBe('Creative Head WS4');
      expect(first.seenAt).toBeNull();
    });
  });

  describe('Task 1: Worker Mark Feedback as Seen', () => {
    it('allows worker to mark their own rating as seen', async () => {
      const res = await request(app)
        .post(`/api/submissions/ratings/${testRating1._id}/seen`)
        .set('Authorization', `Bearer ${workerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.seenAt).toBeDefined();

      const updated = await Rating.findById(testRating1._id);
      expect(updated.seenAt).toBeDefined();
    });

    it('another worker cannot mark a rating as seen, or learn it exists (HTTP 404)', async () => {
      const res = await request(app)
        .post(`/api/submissions/ratings/${testRating2._id}/seen`)
        .set('Authorization', `Bearer ${workerBToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error?.message).not.toContain('You can only mark your own rating as seen');
    });
  });

  describe('Task 2: Rating Edit with Mandatory Reason & Audit Trail', () => {
    it('rejects rating edit without a reason', async () => {
      const res = await request(app)
        .patch(`/api/submissions/ratings/${testRating1._id}`)
        .set('Authorization', `Bearer ${headToken}`)
        .send({
          score: 4,
          reason: '',
        });

      expect(res.status).toBe(400);
      expect(['REASON_REQUIRED', 'VALIDATION_ERROR']).toContain(res.body.error?.code);
    });

    it('rejects non-rater and non-admin from editing a rating (HTTP 403)', async () => {
      const res = await request(app)
        .patch(`/api/submissions/ratings/${testRating1._id}`)
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({
          score: 4,
          reason: 'Worker trying to boost score',
        });

      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('FORBIDDEN_ACTION');
    });

    it('allows Creative Head (the original rater) to edit rating and logs edit history', async () => {
      const res = await request(app)
        .patch(`/api/submissions/ratings/${testRating1._id}`)
        .set('Authorization', `Bearer ${headToken}`)
        .send({
          score: 4,
          feedback: 'WS4 Adjusted feedback after director notes review',
          tags: ['Clear message'],
          reason: 'Calibrated score with senior creative director notes',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.score).toBe(4);
      expect(res.body.data.feedback).toBe('WS4 Adjusted feedback after director notes review');
      expect(res.body.data.tags).toContain('Clear message');
      expect(res.body.data.editedLog).toHaveLength(1);

      const log = res.body.data.editedLog[0];
      expect(log.oldScore).toBe(5);
      expect(log.newScore).toBe(4);
      expect(log.reason).toBe('Calibrated score with senior creative director notes');
      expect(log.editedBy.toString()).toBe(creativeHeadUser._id.toString());
      expect(log.editedAt).toBeDefined();
    });

    it('allows Admin to edit rating and appends second entry to editedLog', async () => {
      const res = await request(app)
        .patch(`/api/submissions/ratings/${testRating1._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          score: 5,
          reason: 'Admin reinstated 5 stars upon review of full creative suite',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.score).toBe(5);
      expect(res.body.data.editedLog).toHaveLength(2);
      expect(res.body.data.editedLog[1].reason).toBe('Admin reinstated 5 stars upon review of full creative suite');
    });
  });

  describe('Task 2: Step Page Rating Visibility', () => {
    it('work item detail endpoint populates rating information', async () => {
      const res = await request(app)
        .get(`/api/work-items/${testWorkItemA._id}`)
        .set('Authorization', `Bearer ${workerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.rating).toBeDefined();
      expect(res.body.data.rating.score).toBe(5);
      expect(res.body.data.rating.raterId).toBeDefined();
      expect(res.body.data.rating.editedLog).toHaveLength(2);
    });
  });

  describe('Task 3 & 4: Guardrails & Aggregated Reports', () => {
    it('guarantees NO leaderboard or ranking endpoints exist', async () => {
      const forbiddenEndpoints = [
        '/api/submissions/ratings/leaderboard',
        '/api/submissions/ratings/rankings',
        '/api/ratings/leaderboard',
        '/api/people/rankings',
        '/api/reports/leaderboard',
      ];

      for (const endpoint of forbiddenEndpoints) {
        const res = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${headToken}`);
        // Endpoint should be 400 (invalid ObjectId) or 404 (not found)
        expect([400, 404]).toContain(res.status);
      }
    });

    it('the Quality report gives team-level figures without personal ranking', async () => {
      const res = await request(app).get('/api/reports/quality').set('Authorization', `Bearer ${headToken}`);
      expect(res.status).toBe(200);
      const report = res.body.data;
      expect(report.ratingDistribution).toHaveLength(5);
      expect(report.rating.text).toBeDefined();
      expect(report.firstPass.label).toBe('Reviewed steps approved first time');
      expect(Object.keys(report).some((k) => /leaderboard|rank|person|worker/i.test(k))).toBe(false);
    });
  });
});
