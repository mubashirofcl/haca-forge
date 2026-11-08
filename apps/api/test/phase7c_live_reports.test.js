import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/server.js';
import { env } from '../src/config/env.js';
import { Person } from '../src/modules/people/model.js';
import { WorkItem } from '../src/modules/workItems/model.js';
import { Submission, Rating } from '../src/modules/submissions/model.js';
import { ContentPiece } from '../src/modules/calendar/contentPiece.model.js';
import { Blocker } from '../src/modules/blockers/model.js';
import { RevisionFlag } from '../src/modules/feedback/model.js';
import { ActivityEvent } from '../src/modules/activity/model.js';

const tokenFor = (u) => jwt.sign({ userId: String(u._id), role: u.role }, env.JWT_SECRET, { expiresIn: '1h' });
const HOUR = 3600000;
const D = (s) => new Date(s);
const MONTH = '2025-03';

describe('Phase 7c: live reports', () => {
  const salt = `p7c-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  const people = {};
  const ids = { pieces: [], steps: [] };
  const P = {};

  const make = (key, role) =>
    Person.create({ name: `P7c ${key} ${salt}`, email: `${key}.${salt}@p7c.test`, role, status: 'active' }).then((p) => (people[key] = p));
  const as = (who) => ({ Authorization: `Bearer ${tokenFor(people[who])}` });

  async function piece(key, { calendar, contentType, pipeline, postingDate, hasPostStage = true, publishedAt = null }) {
    const p = await ContentPiece.create({ planId: new mongoose.Types.ObjectId(), topic: `P7c ${key} ${salt}`, contentType, pipeline, postingDate: D(postingDate), calendar, hasPostStage, publishedAt: publishedAt ? D(publishedAt) : null, status: 'In Progress' });
    ids.pieces.push(p._id);
    P[key] = { piece: p, steps: {} };
    return p;
  }
  async function step(key, stageKey, order, fields) {
    const owner = fields.owner || 'worker';
    const w = await WorkItem.create({
      title: `P7c ${key} ${stageKey} ${salt}`, workType: P[key].piece.contentType, stageKey, stageOrder: order,
      reviewRequired: stageKey !== 'Post', isLocked: false, contentPieceId: P[key].piece._id, calendar: P[key].piece.calendar,
      departmentId: new mongoose.Types.ObjectId(), ownerId: people[owner]._id, estimatedEffortHrs: 1,
      deadline: D(fields.due), dueDate: D(fields.due), ...fields.set,
    });
    ids.steps.push(w._id);
    P[key].steps[stageKey] = w;
    return w;
  }
  const sub = (w, version, status, submittedAt) =>
    Submission.create({ workItemId: w._id, stageKey: w.stageKey, version, kind: 'document', status, submittedById: w.ownerId, submittedAt: D(submittedAt), document: { htmlSnapshot: '<p>x</p>' } });
  const rate = (w, s, score, createdAt) =>
    Rating.create({ submissionId: s._id, workItemId: w._id, stageKey: w.stageKey, workerId: w.ownerId, raterId: people.head._id, score, createdAt: D(createdAt) });

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) await mongoose.connect(env.MONGODB_URI);
    for (const [k, r] of [['head', 'creative_head'], ['sm', 'sm_manager'], ['exec', 'executive'], ['admin', 'admin'], ['worker', 'team_member'], ['other', 'team_member']]) await make(k, r);

    // A: Reel (ads), publish 10 Mar, posted 12 Mar (completed 2 days late).
    await piece('A', { calendar: 'ads', contentType: 'Reel', pipeline: 'reel_a', postingDate: '2025-03-10T00:00:00Z', publishedAt: '2025-03-12T05:00:00Z' });
    const aScript = await step('A', 'Script', 1, { due: '2025-03-06T00:00:00Z', set: {
      status: 'Approved', unlockedAt: D('2025-03-01T04:30:00Z'), startedAt: D('2025-03-04T04:30:00Z'), submittedAt: D('2025-03-05T04:30:00Z'), approvedAt: D('2025-03-05T10:00:00Z'), revisions: 0,
      rounds: [{ roundNumber: 1, startedAt: D('2025-03-04T04:30:00Z'), submittedAt: D('2025-03-05T04:30:00Z'), decision: 'approved', intervals: [
        { kind: 'blocked', startedAt: D('2025-03-04T06:00:00Z'), endedAt: D('2025-03-04T08:00:00Z') },
        { kind: 'paused', startedAt: D('2025-03-04T10:00:00Z'), endedAt: D('2025-03-04T11:00:00Z') },
      ] }],
    } });
    const aShoot = await step('A', 'Shoot', 2, { owner: 'other', due: '2025-03-07T00:00:00Z', set: {
      status: 'Approved', unlockedAt: D('2025-03-08T04:30:00Z'), startedAt: D('2025-03-08T04:30:00Z'), submittedAt: D('2025-03-09T04:30:00Z'), revisions: 0,
      rounds: [{ roundNumber: 1, startedAt: D('2025-03-08T04:30:00Z'), submittedAt: D('2025-03-09T04:30:00Z'), decision: 'approved', intervals: [] }],
    } });
    // Edit: an older step with no recorded times; history has them.
    const aEdit = await step('A', 'Edit', 3, { due: '2025-03-08T00:00:00Z', set: { status: 'Approved', unlockedAt: D('2025-03-08T00:00:00Z'), revisions: 1, rounds: [] } });
    await step('A', 'Post', 4, { due: '2025-03-10T00:00:00Z', set: { status: 'Published', unlockedAt: D('2025-03-10T00:00:00Z'), rounds: [] } });
    const s1 = await sub(aScript, 1, 'approved', '2025-03-05T04:30:00Z');
    await rate(aScript, s1, 5, '2025-03-05T10:00:00Z');
    const s2 = await sub(aShoot, 1, 'approved', '2025-03-09T04:30:00Z');
    await rate(aShoot, s2, 4, '2025-03-09T10:00:00Z');
    const e1 = await sub(aEdit, 1, 'changes_requested', '2025-03-12T04:30:00Z');
    const e2 = await sub(aEdit, 2, 'approved', '2025-03-13T04:30:00Z');
    await rate(aEdit, e1, 1, '2025-03-12T10:00:00Z');
    await rate(aEdit, e2, 3, '2025-03-13T10:00:00Z');
    await ActivityEvent.create({ entityType: 'work_item', entityId: String(aEdit._id), actorId: people.worker._id, action: 'work_item.transition', toStatus: 'In Progress', timestamp: D('2025-03-11T04:30:00Z') });
    await RevisionFlag.create({ workItemId: aEdit._id, ownerId: people.worker._id, revisionsCount: 1, isFlagged: true, flaggedAt: D('2025-03-12T10:00:00Z'), rootCause: 'Technical error' });

    // B: Static Post (ads), publish 20 Mar, not delivered; Design overdue and blocked; Post locked.
    await piece('B', { calendar: 'ads', contentType: 'Static Post', pipeline: 'design', postingDate: '2025-03-20T00:00:00Z' });
    await step('B', 'Content', 1, { due: '2025-03-15T00:00:00Z', set: { status: 'Approved', unlockedAt: D('2025-03-10T00:00:00Z'), submittedAt: D('2025-03-14T05:00:00Z'), revisions: 0, rounds: [] } });
    const bDesign = await step('B', 'Design', 2, { due: '2025-03-18T00:00:00Z', set: { status: 'Blocked', unlockedAt: D('2025-03-15T00:00:00Z'), startedAt: D('2025-03-16T00:00:00Z'), rounds: [] } });
    await step('B', 'Post', 3, { due: '2025-03-20T00:00:00Z', set: { status: 'Not Started', isLocked: true, rounds: [] } });
    await Blocker.create({ workItemId: bDesign._id, blockedById: people.worker._id, reason: 'Waiting for data', status: 'Active', blockedAt: D('2025-03-19T05:00:00Z') });

    // C: Poster (sales), non-postable, handed over on time.
    await piece('C', { calendar: 'sales', contentType: 'Poster', pipeline: 'design', postingDate: '2025-03-15T00:00:00Z', hasPostStage: false });
    await step('C', 'Content', 1, { due: '2025-03-10T00:00:00Z', set: { status: 'Approved', submittedAt: D('2025-03-09T05:00:00Z'), rounds: [] } });
    await step('C', 'Design', 2, { due: '2025-03-13T00:00:00Z', set: { status: 'Approved', unlockedAt: D('2025-03-10T00:00:00Z'), submittedAt: D('2025-03-12T05:00:00Z'), approvedAt: D('2025-03-14T05:00:00Z'), rounds: [] } });

    // F: publish 1 Mar IST (stored 28 Feb 18:30Z): in March. E: 1 Apr IST (stored 31 Mar 18:30Z): not in March.
    await piece('F', { calendar: 'ads', contentType: 'Reel', pipeline: 'reel_a', postingDate: '2025-02-28T18:30:00Z' });
    await step('F', 'Script', 1, { due: '2025-02-25T00:00:00Z', set: { status: 'Approved', submittedAt: D('2025-02-24T05:00:00Z'), revisions: 0, rounds: [] } });
    await step('F', 'Post', 2, { due: '2025-02-28T18:30:00Z', set: { status: 'Published', unlockedAt: D('2025-02-25T00:00:00Z'), postedAt: D('2025-03-01T10:00:00Z'), rounds: [] } });
    await piece('E', { calendar: 'ads', contentType: 'Reel', pipeline: 'reel_a', postingDate: '2025-03-31T18:30:00Z' });
    await step('E', 'Script', 1, { due: '2025-03-25T00:00:00Z', set: { status: 'In Progress', unlockedAt: D('2025-03-20T00:00:00Z'), rounds: [] } });
  });

  afterAll(async () => {
    await Rating.deleteMany({ workItemId: { $in: ids.steps } });
    await Submission.deleteMany({ workItemId: { $in: ids.steps } });
    await RevisionFlag.deleteMany({ workItemId: { $in: ids.steps } });
    await Blocker.deleteMany({ workItemId: { $in: ids.steps } });
    await ActivityEvent.deleteMany({ entityId: { $in: ids.steps.map(String) } });
    await WorkItem.deleteMany({ _id: { $in: ids.steps } });
    await ContentPiece.deleteMany({ _id: { $in: ids.pieces } });
    await Person.deleteMany({ email: new RegExp(salt) });
  });

  const get = (who, path) => request(app).get(path).set(as(who));
  const report = async (name, query = '', who = 'head') => {
    const res = await get(who, `/api/reports/${name}?month=${MONTH}${query}`);
    expect(res.status).toBe(200);
    return res.body.data;
  };
  const mine = (topics) => topics.filter((t) => t.includes(salt)).map((t) => t.split(' ')[1]).sort();

  it('the month filter follows the publish date in IST', async () => {
    const ads = await report('projects', '&calendar=ads');
    expect(mine(ads.projects.map((p) => p.topic))).toEqual(['A', 'B', 'F']);
  });

  it('the calendar filter', async () => {
    const sales = await report('projects', '&calendar=sales');
    expect(mine(sales.projects.map((p) => p.topic))).toEqual(['C']);
  });

  it('Overview cards and weekly series', async () => {
    const o = await report('overview', '&calendar=ads');
    expect(o.cards).toMatchObject({ planned: 3, delivered: 2, onTime: 1, onTimeRate: 50, overdueSteps: 1, overdueProjects: 1, blocked: 1 });
    expect(o.weekly.reduce((n, w) => n + w.delivered, 0)).toBe(2);
    expect(o.weekly.reduce((n, w) => n + w.onTime, 0)).toBe(1);
    expect(o.weekly[0].week).toBe('2025-02-24');
  });

  it('Overdue and Issues: lists sorted by due date with owners, and team-level charts', async () => {
    const r = await report('overdue', '&calendar=ads');
    expect(r.openOverdue.map((x) => x.stepType)).toEqual(['Design']);
    expect(r.openOverdue[0].owner).toBe(`P7c worker ${salt}`);
    expect(r.doneLate.map((x) => `${x.project.split(' ')[1]}:${x.stepType}`)).toEqual(['A:Shoot', 'A:Edit', 'A:Post']);
    expect(r.doneLate.find((x) => x.stepType === 'Edit')).toMatchObject({ fromHistory: true, daysLate: 4 });
    expect(r.doneLate.find((x) => x.stepType === 'Shoot').labels).toContain('Late: earlier step');
    expect(r.blockers).toHaveLength(1);
    expect(r.blockers[0]).toMatchObject({ stepType: 'Design', reason: 'Waiting for data' });
    expect(r.byStepType.find((x) => x.stepType === 'Design')).toMatchObject({ overdue: 1, doneLate: 0 });
    expect(r.byCalendar).toEqual([{ calendar: expect.any(String), overdue: 1, doneLate: 3 }]);
  });

  it('the step type filter narrows the step lists', async () => {
    const r = await report('overdue', '&calendar=ads&stepType=Edit');
    expect(r.openOverdue).toHaveLength(0);
    expect(r.doneLate.map((x) => x.stepType)).toEqual(['Edit']);
  });

  it('a locked past-due step is not counted as overdue', async () => {
    const r = await report('overdue', '&calendar=ads&stepType=Post');
    expect(r.openOverdue).toHaveLength(0);
  });

  it('Production: planned vs delivered by calendar and type, and per week', async () => {
    const r = await report('production', '&calendar=ads');
    expect(r.byType).toEqual([{ contentType: 'Reel', planned: 2, delivered: 2 }, { contentType: 'Static Post', planned: 1, delivered: 0 }]);
    expect(r.weekly.reduce((n, w) => n + w.planned, 0)).toBe(3);
    expect(r.weekly.reduce((n, w) => n + w.posted, 0)).toBe(2);
    const sales = await report('production', '&calendar=sales');
    expect(sales.byType).toEqual([{ contentType: 'Poster', planned: 1, delivered: 1 }]);
  });

  it('Quality: one rating per step, first-pass excludes Post, root causes', async () => {
    const r = await report('quality', '&calendar=ads');
    expect(r.ratingDistribution).toEqual([{ score: 1, count: 0 }, { score: 2, count: 0 }, { score: 3, count: 1 }, { score: 4, count: 1 }, { score: 5, count: 1 }]);
    expect(r.rating).toEqual({ count: 3, average: 4, text: '4.0' });
    expect(r.firstPass).toMatchObject({ label: 'Reviewed steps approved first time', approvedFirstTime: 4, total: 5, rate: 80 });
    expect(r.rootCauses).toHaveLength(7);
    expect(r.rootCauses.find((c) => c.cause === 'Technical error').count).toBe(1);
  });

  it('Projects: per-project KPIs', async () => {
    const r = await report('projects', '&calendar=ads');
    const a = r.projects.find((p) => p.topic.includes(' A '));
    expect(a.label).toMatchObject({ kind: 'completed_late', text: 'Completed 2 days late' });
    expect(a.kpis.onTime).toMatchObject({ onTime: 1, total: 4, rate: 25, delayedByEarlier: 1 });
    expect(a.kpis.rating).toMatchObject({ count: 3, text: '4.0' });
    expect(a.kpis.firstPass).toMatchObject({ approvedFirstTime: 2, total: 3 });
    // Script 24h - 2h blocked - 1h paused = 21h; Shoot 24h; Edit 24h from history; Post has no times.
    expect(a.kpis.workTime).toMatchObject({ label: 'Elapsed work time', totalMs: 69 * HOUR, steps: 3, fromHistory: 1, partial: true, note: '1 of 3 steps from history' });
    const b = r.projects.find((p) => p.topic.includes(' B '));
    expect(b.label.kind).toBe('overdue');
    expect(b.kpis.rating.text).toBe('Collecting baseline');
  });

  it('a non-postable design counts as handed over when its Design step is approved', async () => {
    const r = await report('projects', '&calendar=sales');
    expect(r.projects[0]).toMatchObject({ delivered: true, label: null });
  });

  describe('Project KPI page', () => {
    it('shows step rows with the owner and hours, history marked', async () => {
      const res = await get('exec', `/api/reports/projects/${P.A.piece._id}`);
      expect(res.status).toBe(200);
      const { project, steps, kpis } = res.body.data;
      expect(project).toMatchObject({ deliveredVia: 'post', label: { kind: 'completed_late' } });
      expect(steps.map((s) => s.stepType)).toEqual(['Script', 'Shoot', 'Edit', 'Post']);
      expect(steps[0]).toMatchObject({ owner: `P7c worker ${salt}`, elapsedMs: 21 * HOUR, elapsedFromHistory: false, rating: 5 });
      expect(steps[2]).toMatchObject({ elapsedMs: 24 * HOUR, elapsedFromHistory: true, firstSubmittedFromHistory: true, rating: 3 });
      expect(steps[1].labels.map((l) => l.text)).toEqual(['Done 2 days late', 'Late: earlier step']);
      expect(kpis.workTime.note).toBe('1 of 3 steps from history');
    });

    it('admin, creative head and SM manager can open it', async () => {
      for (const who of ['admin', 'head', 'sm']) expect((await get(who, `/api/reports/projects/${P.A.piece._id}`)).status).toBe(200);
    });

    it('a team member gets 404, the same as an unknown project', async () => {
      const a = await get('worker', `/api/reports/projects/${P.A.piece._id}`);
      const b = await get('head', `/api/reports/projects/${new mongoose.Types.ObjectId()}`);
      const c = await get('head', '/api/reports/projects/not-an-id');
      expect([a.status, b.status, c.status]).toEqual([404, 404, 404]);
    });
  });

  describe('access and team-level only', () => {
    it('a team member gets 403 on every report', async () => {
      for (const name of ['overview', 'overdue', 'production', 'quality', 'projects']) {
        expect((await get('worker', `/api/reports/${name}?month=${MONTH}`)).status).toBe(403);
      }
    });

    it('the executive can read every report', async () => {
      for (const name of ['overview', 'overdue', 'production', 'quality', 'projects']) {
        expect((await get('exec', `/api/reports/${name}?month=${MONTH}`)).status).toBe(200);
      }
    });

    it('no report groups, counts or sorts by person', async () => {
      const names = [`P7c worker ${salt}`, `P7c other ${salt}`];
      for (const name of ['overview', 'production', 'quality', 'projects']) {
        const body = JSON.stringify(await report(name, '&calendar=ads'));
        for (const n of names) expect(body).not.toContain(n);
      }
      const overdue = await report('overdue', '&calendar=ads');
      expect(JSON.stringify({ a: overdue.byCalendar, b: overdue.byStepType })).not.toMatch(/P7c (worker|other)/);
      // Owner names appear only on list rows, which are ordered by due date.
      const dues = overdue.doneLate.map((x) => x.dueDate);
      expect([...dues].sort()).toEqual(dues);
      for (const key of Object.keys(overdue)) expect(key).not.toMatch(/owner|person|worker|member/i);
    });
  });
});
