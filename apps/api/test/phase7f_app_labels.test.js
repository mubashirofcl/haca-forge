import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/server.js';
import { env } from '../src/config/env.js';
import { Person } from '../src/modules/people/model.js';
import { WorkItem } from '../src/modules/workItems/model.js';
import { ContentPiece } from '../src/modules/calendar/contentPiece.model.js';
import { Blocker } from '../src/modules/blockers/model.js';

const tokenFor = (u) => jwt.sign({ userId: String(u._id), role: u.role }, env.JWT_SECRET, { expiresIn: '1h' });
const DAY = 86400000;
const daysAgo = (n) => new Date(Date.now() - n * DAY);
const kinds = (item) => (item?.timeLabels || []).map((l) => l.kind);

describe('Phase 7f: time labels across the app', () => {
  const salt = `p7f-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  const people = {};
  const S = {};
  let piece, futurePiece;

  const make = (key, role) =>
    Person.create({ name: `P7f ${key}`, email: `${key}.${salt}@p7f.test`, role, status: 'active' }).then((p) => (people[key] = p));
  const as = (who) => ({ Authorization: `Bearer ${tokenFor(people[who])}` });
  const step = (key, p, stageKey, order, fields) =>
    WorkItem.create({
      title: `P7f ${key} ${salt}`, workType: 'Reel', stageKey, stageOrder: order, reviewRequired: true,
      contentPieceId: p._id, calendar: 'sm', departmentId: new mongoose.Types.ObjectId(), estimatedEffortHrs: 1,
      ownerId: people.worker._id, ...fields,
    }).then((w) => (S[key] = w));

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) await mongoose.connect(env.MONGODB_URI);
    for (const [k, r] of [['worker', 'team_member'], ['other', 'team_member'], ['head', 'creative_head'], ['sm', 'sm_manager']]) await make(k, r);
    piece = await ContentPiece.create({ planId: new mongoose.Types.ObjectId(), topic: `P7f piece ${salt}`, contentType: 'Reel', pipeline: 'reel_a', postingDate: new Date(Date.now() + 20 * DAY), calendar: 'sm', status: 'In Progress' });
    // Done late (first submitted 2 days after its due date), then an unlocked overdue step,
    // a blocked step, and a locked step past its due date.
    await step('late', piece, 'Script', 1, { status: 'Approved', isLocked: false, deadline: daysAgo(10), dueDate: daysAgo(10), unlockedAt: daysAgo(12), submittedAt: daysAgo(8), approvedAt: daysAgo(7) });
    await step('overdue', piece, 'Shoot', 2, { status: 'In Progress', isLocked: false, deadline: daysAgo(3), dueDate: daysAgo(3), unlockedAt: daysAgo(7), startedAt: daysAgo(6), ownerId: people.other._id });
    await step('blocked', piece, 'Edit', 3, { status: 'Blocked', isLocked: false, deadline: new Date(Date.now() + 5 * DAY), dueDate: new Date(Date.now() + 5 * DAY), unlockedAt: daysAgo(2) });
    await Blocker.create({ workItemId: S.blocked._id, blockedById: people.worker._id, reason: 'Dependency', status: 'Active', blockedAt: daysAgo(2) });
    // A piece whose only past-due step is locked: never Overdue.
    futurePiece = await ContentPiece.create({ planId: new mongoose.Types.ObjectId(), topic: `P7f locked ${salt}`, contentType: 'Reel', pipeline: 'reel_a', postingDate: new Date(Date.now() + 20 * DAY), calendar: 'sm', status: 'In Progress' });
    await step('first', futurePiece, 'Script', 1, { status: 'In Progress', isLocked: false, deadline: new Date(Date.now() + 2 * DAY), dueDate: new Date(Date.now() + 2 * DAY), unlockedAt: daysAgo(1) });
    await step('locked', futurePiece, 'Shoot', 2, { status: 'Not Started', isLocked: true, deadline: daysAgo(2), dueDate: daysAgo(2) });
  });

  afterAll(async () => {
    const ids = Object.values(S).map((w) => w._id);
    await Blocker.deleteMany({ workItemId: { $in: ids } });
    await WorkItem.deleteMany({ _id: { $in: ids } });
    await ContentPiece.deleteMany({ _id: { $in: [piece._id, futurePiece._id] } });
    await Person.deleteMany({ email: new RegExp(salt) });
  });

  const list = async (query) => {
    const res = await request(app).get(`/api/work-items?${query}`).set(as('head'));
    expect(res.status).toBe(200);
    return res.body.data.filter((w) => w.title.includes(salt));
  };
  const titles = (items) => items.map((w) => w.title.split(' ')[1]).sort();

  describe('Work Items', () => {
    it('every item carries its labels', async () => {
      const items = await list('');
      const by = Object.fromEntries(items.map((w) => [w.title.split(' ')[1], kinds(w)]));
      expect(by.late).toEqual(['done_late']);
      expect(by.overdue).toEqual(['overdue']);
      expect(by.blocked).toEqual(['blocked']);
      expect(by.locked).toEqual(['waiting_earlier_step_late']);
      expect(by.first).toEqual([]);
    });

    it('the Overdue filter leaves out a locked past-due step', async () => {
      expect(titles(await list('timeLabel=overdue'))).toEqual(['overdue']);
      expect(titles(await list('isOverdue=true'))).toEqual(['overdue']);
    });

    it('Done late and Blocked filters', async () => {
      expect(titles(await list('timeLabel=done_late'))).toEqual(['late']);
      expect(titles(await list('timeLabel=blocked'))).toEqual(['blocked']);
    });
  });

  describe('Work Detail', () => {
    it('the owner sees the labels', async () => {
      const res = await request(app).get(`/api/work-items/${S.late._id}`).set(as('worker'));
      expect(kinds(res.body.data)).toEqual(['done_late']);
      expect(res.body.data.timeLabels[0].text).toBe('Done 2 days late');
    });

    it("another participant does not see someone else's labels", async () => {
      const res = await request(app).get(`/api/work-items/${S.overdue._id}`).set(as('worker'));
      expect(res.status).toBe(200);
      expect(res.body.data.timeLabels).toBeUndefined();
    });

    it('leadership sees them', async () => {
      const res = await request(app).get(`/api/work-items/${S.overdue._id}`).set(as('head'));
      expect(kinds(res.body.data)).toEqual(['overdue']);
    });
  });

  it('My Work items carry labels', async () => {
    const res = await request(app).get('/api/work-items/my-work').set(as('worker'));
    expect(res.status).toBe(200);
    const all = [...res.body.data.overdue, ...res.body.data.today, ...res.body.data.thisWeek, ...res.body.data.upcoming, ...res.body.data.completed];
    const mine = Object.fromEntries(all.filter((w) => w.title.includes(salt)).map((w) => [w.title.split(' ')[1], kinds(w)]));
    expect(mine.blocked).toEqual(['blocked']);
    expect(mine.locked).toEqual(['waiting_earlier_step_late']);
  });

  describe('Tracker', () => {
    const pieces = async (query = '') => {
      const res = await request(app).get(`/api/content-pieces?${query}`).set(as('sm'));
      expect(res.status).toBe(200);
      return (res.body.data || []).filter((p) => p.topic.includes(salt));
    };

    it('steps carry labels; a piece with only a locked past-due step is not overdue', async () => {
      const all = await pieces();
      const main = all.find((p) => p._id === String(piece._id));
      const locked = all.find((p) => p._id === String(futurePiece._id));
      expect(main.stages.map((s) => kinds(s))).toEqual([['done_late'], ['overdue'], ['blocked']]);
      expect(main).toMatchObject({ hasOverdue: true, hasDoneLate: true, hasBlocked: true, projectLabel: null });
      expect(locked.hasOverdue).toBe(false);
      expect(locked.stages[1].timeLabels.map((l) => l.text)).toEqual(['Waiting: earlier step late']);
    });

    it('Overdue and Done late filters', async () => {
      expect((await pieces('overdue=true')).map((p) => p._id)).toEqual([String(piece._id)]);
      expect((await pieces('doneLate=true')).map((p) => p._id)).toEqual([String(piece._id)]);
    });
  });

  it('the profile Work tab carries labels; a worker sees only their own profile', async () => {
    const res = await request(app).get(`/api/team/${people.worker._id}/work?limit=100`).set(as('worker'));
    expect(res.status).toBe(200);
    const mine = Object.fromEntries(res.body.data.items.filter((w) => w.title.includes(salt)).map((w) => [w.title.split(' ')[1], kinds(w)]));
    expect(mine.late).toEqual(['done_late']);
    expect(mine.locked).toEqual(['waiting_earlier_step_late']);
    const other = await request(app).get(`/api/team/${people.other._id}/work`).set(as('worker'));
    expect(other.status).toBe(404);
  });
});
