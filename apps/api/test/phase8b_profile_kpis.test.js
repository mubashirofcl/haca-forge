import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/server.js';
import { env } from '../src/config/env.js';
import { Person } from '../src/modules/people/model.js';
import { WorkItem } from '../src/modules/workItems/model.js';
import { Submission, Rating } from '../src/modules/submissions/model.js';
import { Blocker } from '../src/modules/blockers/model.js';
import { RevisionFlag } from '../src/modules/feedback/model.js';
import { ActivityEvent } from '../src/modules/activity/model.js';
import { CalendarPlan } from '../src/modules/calendar/plan.model.js';
import { PersonChangeAudit } from '../src/modules/team/audit.model.js';

const tokenFor = (u) => jwt.sign({ userId: String(u._id), role: u.role }, env.JWT_SECRET, { expiresIn: '1h' });
const HOUR = 3600000;
const D = (s) => new Date(s);
const MAY = 'period=custom&from=2025-05-01&to=2025-05-31';

describe('Phase 8b: profile KPIs', () => {
  const salt = `p8b-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  const people = {};
  const S = {};
  const extra = { subs: [], ratings: [], events: [], plans: [], audits: [] };

  const make = (key, role) =>
    Person.create({ name: `P8b ${key} ${salt}`, email: `${key}.${salt}@p8b.test`, phone: '+919999900000', whatsappNumber: '+919999900001', role, status: 'active' }).then((p) => (people[key] = p));
  const as = (who) => ({ Authorization: `Bearer ${tokenFor(people[who])}` });
  const step = (key, fields) =>
    WorkItem.create({
      title: `P8b ${key} ${salt}`, workType: 'Reel', stageOrder: 1, reviewRequired: true, isLocked: false, calendar: 'sm',
      departmentId: new mongoose.Types.ObjectId(), estimatedEffortHrs: 1, ownerId: people.worker._id, ...fields,
      deadline: fields.due, dueDate: fields.due,
    }).then((w) => (S[key] = w));
  const sub = async (w, version, status, submittedAt, reviewedAt, reviewer = 'head') => {
    const s = await Submission.create({ workItemId: w._id, stageKey: w.stageKey, version, kind: 'document', status, submittedById: w.ownerId, submittedAt: D(submittedAt), reviewedAt: reviewedAt ? D(reviewedAt) : null, reviewedById: reviewedAt ? people[reviewer]._id : null, document: { htmlSnapshot: '<p>x</p>' } });
    extra.subs.push(s._id);
    return s;
  };
  const rate = async (w, s, score, at, rater = 'head') => {
    const r = await Rating.create({ submissionId: s._id, workItemId: w._id, stageKey: w.stageKey, workerId: w.ownerId, raterId: people[rater]._id, score });
    await Rating.collection.updateOne({ _id: r._id }, { $set: { createdAt: D(at) } });
    extra.ratings.push(r._id);
  };

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) await mongoose.connect(env.MONGODB_URI);
    for (const [k, r] of [['worker', 'team_member'], ['other', 'team_member'], ['head', 'creative_head'], ['head2', 'creative_head'], ['sm', 'sm_manager'], ['exec', 'executive'], ['admin', 'admin']]) await make(k, r);

    // The worker's steps, due in May 2025 (IST).
    await step('s1', { stageKey: 'Script', status: 'Approved', due: D('2025-05-05T00:00:00Z'), unlockedAt: D('2025-05-01T00:00:00Z'), startedAt: D('2025-05-04T00:00:00Z'), submittedAt: D('2025-05-04T04:00:00Z'), approvedAt: D('2025-05-04T06:00:00Z'), revisions: 0,
      rounds: [{ roundNumber: 1, startedAt: D('2025-05-04T00:00:00Z'), submittedAt: D('2025-05-04T04:00:00Z'), decision: 'approved', intervals: [{ kind: 'blocked', startedAt: D('2025-05-04T01:00:00Z'), endedAt: D('2025-05-04T02:00:00Z') }] }] });
    await step('s2', { stageKey: 'Shoot', status: 'Approved', due: D('2025-05-06T00:00:00Z'), unlockedAt: D('2025-05-07T00:00:00Z'), startedAt: D('2025-05-07T04:30:00Z'), submittedAt: D('2025-05-08T04:30:00Z'), approvedAt: D('2025-05-08T06:00:00Z'), revisions: 0,
      rounds: [{ roundNumber: 1, startedAt: D('2025-05-07T04:30:00Z'), submittedAt: D('2025-05-08T04:30:00Z'), decision: 'approved', intervals: [] }] });
    await step('s3', { stageKey: 'Edit', status: 'Approved', due: D('2025-05-10T00:00:00Z'), unlockedAt: D('2025-05-09T00:00:00Z'), approvedAt: D('2025-05-13T08:30:00Z'), revisions: 2, rounds: [] });
    await step('s4', { stageKey: 'Post', reviewRequired: false, status: 'Published', due: D('2025-05-14T00:00:00Z'), unlockedAt: D('2025-05-13T09:00:00Z'), postedAt: D('2025-05-14T05:00:00Z'), approvedAt: D('2025-05-14T05:00:00Z'), revisions: 3, rounds: [] });
    await step('s5', { stageKey: 'Design', status: 'Approved', due: D('2025-05-20T00:00:00Z'), unlockedAt: D('2025-05-15T00:00:00Z'), submittedAt: D('2025-05-19T00:00:00Z'), approvedAt: D('2025-05-19T06:00:00Z'), revisions: 0, rounds: [] });
    await step('s6', { stageKey: 'Content', status: 'In Progress', due: D('2025-05-25T00:00:00Z'), unlockedAt: D('2025-05-20T00:00:00Z'), startedAt: D('2025-05-21T00:00:00Z'), rounds: [] });
    await step('s7', { stageKey: 'Content', status: 'Blocked', due: new Date(Date.now() + 30 * 86400000), unlockedAt: new Date(), rounds: [] });
    await step('s0', { stageKey: 'Script', status: 'Approved', due: D('2025-04-10T00:00:00Z'), unlockedAt: D('2025-04-01T00:00:00Z'), submittedAt: D('2025-04-12T00:00:00Z'), approvedAt: D('2025-04-12T06:00:00Z'), rounds: [] });
    await step('headOwn', { stageKey: 'Script', status: 'Approved', due: D('2025-05-08T00:00:00Z'), ownerId: people.head._id, submittedAt: D('2025-05-07T00:00:00Z'), approvedAt: D('2025-05-07T06:00:00Z'), rounds: [] });
    await step('queue', { stageKey: 'Script', status: 'Feedback', due: new Date(Date.now() + 9 * 86400000), ownerId: people.other._id, unlockedAt: new Date(), rounds: [] });

    const s1v1 = await sub(S.s1, 1, 'approved', '2025-05-04T04:00:00Z', '2025-05-04T10:00:00Z');
    await sub(S.s2, 1, 'approved', '2025-05-08T04:30:00Z', '2025-05-08T06:00:00Z', 'head2');
    const s3v1 = await sub(S.s3, 1, 'changes_requested', '2025-05-12T04:30:00Z', '2025-05-12T06:30:00Z');
    const s3v2 = await sub(S.s3, 2, 'approved', '2025-05-13T04:30:00Z', '2025-05-13T08:30:00Z');
    const s5v1 = await sub(S.s5, 1, 'approved', '2025-05-19T00:00:00Z', '2025-05-19T06:00:00Z');
    await sub(S.queue, 1, 'submitted', new Date(Date.now() - 400 * 86400000).toISOString(), null);
    await rate(S.s1, s1v1, 5, '2025-05-04T10:00:00Z');
    await rate(S.s3, s3v1, 1, '2025-05-12T06:30:00Z');
    await rate(S.s3, s3v2, 3, '2025-05-13T08:30:00Z');
    await rate(S.s5, s5v1, 4, '2025-05-19T06:00:00Z');
    extra.events.push((await ActivityEvent.create({ entityType: 'work_item', entityId: String(S.s3._id), actorId: people.worker._id, action: 'work_item.transition', toStatus: 'In Progress', timestamp: D('2025-05-11T04:30:00Z') }))._id);
    // An older direct approval with no review record.
    extra.events.push((await ActivityEvent.create({ entityType: 'work_item', entityId: String(S.s4._id), actorId: people.head._id, action: 'work_item.approved', timestamp: D('2025-05-14T05:00:00Z') }))._id);
    await RevisionFlag.create({ workItemId: S.s3._id, ownerId: people.worker._id, revisionsCount: 2, isFlagged: true, flaggedAt: D('2025-05-12T07:00:00Z'), rootCause: 'Brief unclear', classifiedBy: people.head._id, classifiedAt: D('2025-05-13T09:00:00Z') });
    await Blocker.create({ workItemId: S.s7._id, blockedById: people.worker._id, reason: 'Dependency', status: 'Active', blockedAt: new Date() });
    extra.plans.push((await CalendarPlan.create({ code: `P8B-${salt}`, title: 'P8b plan', kind: 'monthly', periodStart: D('2025-06-01'), periodEnd: D('2025-06-30'), createdById: people.sm._id, approvedById: people.head._id, approvedAt: D('2025-05-15T05:00:00Z') }))._id);
    extra.audits.push((await PersonChangeAudit.create({ personId: people.worker._id, actorId: people.admin._id, field: 'jobRole', oldValue: 'A', newValue: 'B', reason: 'test' }))._id);
  });

  afterAll(async () => {
    const ids = Object.values(S).map((w) => w._id);
    await Rating.deleteMany({ _id: { $in: extra.ratings } });
    await Submission.deleteMany({ _id: { $in: extra.subs } });
    await RevisionFlag.deleteMany({ workItemId: { $in: ids } });
    await Blocker.deleteMany({ workItemId: { $in: ids } });
    await ActivityEvent.deleteMany({ _id: { $in: extra.events } });
    await CalendarPlan.deleteMany({ _id: { $in: extra.plans } });
    await PersonChangeAudit.deleteMany({ _id: { $in: extra.audits } });
    await WorkItem.deleteMany({ _id: { $in: ids } });
    await Person.deleteMany({ email: new RegExp(salt) });
  });

  const kpis = async (who, target, q = MAY) => request(app).get(`/api/team/${people[target]._id}/kpis?${q}`).set(as(who));

  describe('worker KPI formulas (May 2025, by due date)', () => {
    let w;
    beforeAll(async () => {
      const res = await kpis('admin', 'worker');
      expect(res.status).toBe(200);
      w = res.body.data.worker;
    });

    it('totals: assigned and completed in the period; in progress, open overdue and blocked now', () => {
      expect(w.cards).toMatchObject({ assigned: 6, completed: 5, inProgress: 1, openOverdue: 1, blocked: 1 });
    });

    it('on-time leaves out the step delayed by an earlier one; late rate on the same base', () => {
      expect(w.cards.onTime).toMatchObject({ rate: 75, onTime: 3, total: 4, delayedByEarlier: 1, delayedText: '1 step delayed by earlier steps' });
      expect(w.cards.late).toMatchObject({ rate: 25, late: 1, doneLateCount: 2 });
    });

    it('changes requested, rework and first-pass count review steps only (Post excluded)', () => {
      expect(w.cards.changesRequested).toEqual({ rate: 25, withChangeRequest: 1, reviewed: 4 });
      expect(w.cards.rework).toEqual({ rounds: 2, rate: 0.5, reviewed: 4 });
      expect(w.cards.firstPass).toMatchObject({ label: 'Reviewed steps approved first time', rate: 75, approvedFirstTime: 3, total: 4 });
    });

    it('average rating: one rating per step, 3-rating minimum', async () => {
      expect(w.cards.rating).toEqual({ count: 3, average: 4, text: '4.0' });
      const two = await kpis('admin', 'worker', 'period=custom&from=2025-05-01&to=2025-05-10');
      expect(two.body.data.worker.cards.rating).toMatchObject({ count: 2, average: null, text: 'Collecting baseline' });
    });

    it('elapsed work time, total and by step type, history marked partial', () => {
      expect(w.cards.workTime).toMatchObject({ label: 'Elapsed work time', totalMs: 51 * HOUR, steps: 3, fromHistory: 1, partial: true, note: '1 of 3 steps from history' });
      expect(w.cards.workTime.byStepType.map((x) => [x.stepType, x.ms])).toEqual([['Edit', 24 * HOUR], ['Script', 3 * HOUR], ['Shoot', 24 * HOUR]]);
    });

    it('the last period is the same person\'s figures, nothing else', () => {
      expect(w.lastPeriod).toMatchObject({ period: { from: '2025-03-31', to: '2025-04-30' }, completed: 1, onTimeRate: 0 });
    });

    it('period filtering by due date', async () => {
      const april = (await kpis('admin', 'worker', 'period=custom&from=2025-04-01&to=2025-04-30')).body.data.worker;
      expect(april.cards).toMatchObject({ assigned: 1, completed: 1 });
      expect(april.cards.onTime.rate).toBe(0);
    });

    it('charts: ratings, root causes, step types and calendars; monthly trend has 6 months', () => {
      expect(w.charts.ratingDistribution).toEqual([{ score: 1, count: 0 }, { score: 2, count: 0 }, { score: 3, count: 1 }, { score: 4, count: 1 }, { score: 5, count: 1 }]);
      expect(w.charts.rootCauses).toHaveLength(7);
      expect(w.charts.rootCauses.find((c) => c.cause === 'Brief unclear').count).toBe(1);
      expect(w.charts.byStepType.reduce((n, x) => n + x.count, 0)).toBe(6);
      expect(w.charts.byCalendar).toEqual([{ calendar: 'sm', count: 6 }]);
      expect(w.charts.monthlyTrend).toHaveLength(6);
    });
  });

  describe('Creative Head review figures', () => {
    let ch;
    beforeAll(async () => {
      const res = await kpis('head', 'head');
      expect(res.status).toBe(200);
      ch = res.body.data.creativeHead;
    });

    it('reviews, approvals vs changes requested, and average approval wait', () => {
      expect(ch.cards).toMatchObject({ reviews: 4, approvals: 3, changesRequested: 1, planApprovals: 1 });
      expect(ch.cards.avgApprovalWait).toMatchObject({ ms: 4.5 * HOUR, basedOn: 4 });
    });

    it('notes earlier approvals with no review record', () => {
      expect(ch.cards.legacyApprovals).toBe(1);
      expect(ch.cards.legacyNote).toBe('1 earlier approvals have no review record and are not counted.');
    });

    it('the oldest item in the team review queue', () => {
      expect(ch.cards.queue.label).toBe('Oldest item in the team review queue');
      expect(ch.cards.queue.waiting).toBeGreaterThanOrEqual(1);
      expect(ch.cards.queue.oldestMs).toBeGreaterThanOrEqual(399 * 86400000);
    });

    it('charts: reviews per week, ratings given, root causes used', () => {
      expect(ch.charts.reviewsPerWeek.reduce((n, x) => n + x.reviews, 0)).toBe(4);
      expect(ch.charts.ratingsGiven).toEqual([{ score: 1, count: 1 }, { score: 2, count: 0 }, { score: 3, count: 1 }, { score: 4, count: 1 }, { score: 5, count: 1 }]);
      expect(ch.charts.rootCausesUsed.find((c) => c.cause === 'Brief unclear').count).toBe(1);
    });

    it('a Creative Head who owns production steps also gets the worker KPIs', async () => {
      const res = await kpis('head', 'head');
      expect(res.body.data.worker.cards.assigned).toBe(1);
    });
  });

  describe('access for all 5 roles', () => {
    it('team_member: own profile only; others are 404; no download', async () => {
      expect((await kpis('worker', 'worker')).status).toBe(200);
      expect((await kpis('worker', 'other')).status).toBe(404);
      expect((await request(app).get(`/api/team/${people.worker._id}/report?${MAY}`).set(as('worker'))).status).toBe(403);
      expect((await request(app).get(`/api/team/${people.other._id}/report?${MAY}`).set(as('worker'))).status).toBe(404);
    });

    it('sm_manager sees KPIs but cannot download, and never the review section', async () => {
      expect((await kpis('sm', 'worker')).status).toBe(200);
      expect((await request(app).get(`/api/team/${people.worker._id}/report?${MAY}`).set(as('sm'))).status).toBe(403);
      const r = await kpis('sm', 'head');
      expect(r.body.data.creativeHead).toBeNull();
      expect(r.body.data.canDownload).toBe(false);
    });

    it('review section: admin, executive, and the Creative Head on their own profile only', async () => {
      expect((await kpis('admin', 'head')).body.data.creativeHead).not.toBeNull();
      expect((await kpis('exec', 'head')).body.data.creativeHead).not.toBeNull();
      expect((await kpis('head2', 'head')).body.data.creativeHead).toBeNull();
    });

    it('download: admin, creative_head and executive', async () => {
      for (const who of ['admin', 'head', 'exec']) {
        const res = await request(app).get(`/api/team/${people.worker._id}/report?${MAY}`).set(as(who));
        expect([who, res.status]).toEqual([who, 200]);
        expect(res.body.data.worker.steps).toHaveLength(6);
      }
      const k = await kpis('admin', 'worker');
      expect(k.body.data.worker.steps).toBeUndefined();
    });

    it('no contact details in KPIs or downloads for anyone, including the executive', async () => {
      for (const who of ['exec', 'admin']) {
        const k = JSON.stringify((await kpis(who, 'worker')).body);
        const r = JSON.stringify((await request(app).get(`/api/team/${people.worker._id}/report?${MAY}`).set(as(who))).body);
        for (const text of [k, r]) expect(text).not.toMatch(/@p8b\.test|\+9199999|"email"|"phone"|whatsapp/i);
      }
    });

    it('Changes Log: admin and creative_head only; the actor email for admin only', async () => {
      for (const who of ['sm', 'exec']) expect((await request(app).get(`/api/team/${people.worker._id}/changes`).set(as(who))).status).toBe(403);
      expect((await request(app).get(`/api/team/${people.worker._id}/changes`).set(as('worker'))).status).toBe(403);
      const head = await request(app).get(`/api/team/${people.worker._id}/changes`).set(as('head'));
      expect(head.status).toBe(200);
      expect(head.body.data[0].actorId.email).toBeUndefined();
      const admin = await request(app).get(`/api/team/${people.worker._id}/changes`).set(as('admin'));
      expect(admin.body.data[0].actorId.email).toBe(people.admin.email);
    });
  });

  describe('profile fixes and no comparisons', () => {
    it('header average rating uses one rating per step', async () => {
      const res = await request(app).get(`/api/team/${people.worker._id}`).set(as('admin'));
      expect(res.body.data.kpis).toMatchObject({ averageRating: 4, ratingCount: 3 });
    });

    it('Ratings tab: one rating per step; step-type averages only from 3', async () => {
      const res = await request(app).get(`/api/team/${people.worker._id}/ratings`).set(as('admin'));
      const data = res.body.data;
      expect(data.count).toBe(3);
      expect(data.averageAllTime).toBe(4);
      expect(data.averagePerStepType).toEqual({});
    });

    it('Performance: completed by finish date, first-pass without Post, no placeholder flags', async () => {
      const res = await request(app).get(`/api/team/${people.worker._id}/performance?range=custom&customStart=2025-05-01&customEnd=2025-05-31T23:59:59Z`).set(as('admin'));
      const data = res.body.data;
      expect(data.current.completedCount).toBe(5);
      expect(data.current.firstPassApprovalRate).toBe(75);
      expect(data.revisionFlags).toBeUndefined();
    });

    it('no team averages, rankings or comparisons with others', async () => {
      for (const who of ['admin', 'exec']) {
        const body = (await kpis(who, 'worker')).body.data;
        const text = JSON.stringify(body);
        expect(text).not.toContain(`P8b other ${salt}`);
        const keys = text.match(/"([a-zA-Z]+)":/g).map((k) => k.slice(1, -2));
        expect(keys.filter((k) => /team|rank|percentile|peer|compare|benchmark|median/i.test(k))).toEqual([]);
      }
    });
  });
});
