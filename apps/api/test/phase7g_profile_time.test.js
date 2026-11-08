import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/server.js';
import { env } from '../src/config/env.js';
import { Person } from '../src/modules/people/model.js';
import { WorkItem } from '../src/modules/workItems/model.js';
import { Blocker } from '../src/modules/blockers/model.js';

const tokenFor = (u) => jwt.sign({ userId: String(u._id), role: u.role }, env.JWT_SECRET, { expiresIn: '1h' });
const DAY = 86400000;
const ago = (n) => new Date(Date.now() - n * DAY);

describe('Phase 7g: profile overdue, blocked and on-time by the shared rules', () => {
  const salt = `p7g-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  const people = {};
  const ids = [];

  const make = (key, role) =>
    Person.create({ name: `P7g ${key}`, email: `${key}.${salt}@p7g.test`, role, status: 'active' }).then((p) => (people[key] = p));
  const as = (who) => ({ Authorization: `Bearer ${tokenFor(people[who])}` });
  const step = (key, fields) =>
    WorkItem.create({
      title: `P7g ${key} ${salt}`, workType: 'Reel', stageKey: 'Script', stageOrder: 1, reviewRequired: true,
      departmentId: new mongoose.Types.ObjectId(), estimatedEffortHrs: 1, ownerId: people.worker._id, isLocked: false, ...fields,
    }).then((w) => (ids.push(w._id), w));

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) await mongoose.connect(env.MONGODB_URI);
    for (const [k, r] of [['worker', 'team_member'], ['other', 'team_member'], ['head', 'creative_head']]) await make(k, r);
    await step('onTime', { status: 'Approved', deadline: ago(5), unlockedAt: ago(9), submittedAt: ago(6), approvedAt: ago(5) });
    await step('late', { status: 'Approved', deadline: ago(5), unlockedAt: ago(9), submittedAt: ago(3), approvedAt: ago(2) });
    // Unlocked only after its own due date: left out of the on-time rate.
    await step('delayed', { status: 'Approved', deadline: ago(6), unlockedAt: ago(4), submittedAt: ago(2), approvedAt: ago(1) });
    await step('overdue', { status: 'In Progress', deadline: ago(2), unlockedAt: ago(5), startedAt: ago(4) });
    await step('locked', { status: 'Not Started', isLocked: true, deadline: ago(2) });
    const blocked = await step('blocked', { status: 'Blocked', deadline: new Date(Date.now() + 4 * DAY), unlockedAt: ago(3) });
    await Blocker.create({ workItemId: blocked._id, blockedById: people.worker._id, reason: 'Dependency', status: 'Active', blockedAt: ago(1) });
  });

  afterAll(async () => {
    await Blocker.deleteMany({ workItemId: { $in: ids } });
    await WorkItem.deleteMany({ _id: { $in: ids } });
    await Person.deleteMany({ email: new RegExp(salt) });
  });

  it('header: overdue leaves out the locked step; on-time leaves out the step delayed by an earlier one', async () => {
    const res = await request(app).get(`/api/team/${people.worker._id}`).set(as('worker'));
    expect(res.status).toBe(200);
    const k = (res.body.data || res.body).kpis;
    expect(k).toMatchObject({ lateCount: 1, blockedCount: 1, onTimeRate: 50, onTimeCount: 1, onTimeTotal: 2, delayedByEarlier: 1, delayedText: '1 step delayed by earlier steps' });
  });

  it('Overview: open overdue and blocked counts', async () => {
    const res = await request(app).get(`/api/team/${people.worker._id}/overview`).set(as('worker'));
    expect(res.status).toBe(200);
    expect((res.body.data || res.body).timeSummary).toEqual({ openOverdue: 1, blocked: 1 });
  });

  it('Performance: on-time rate by the new rule, with the delayed count', async () => {
    const res = await request(app).get(`/api/team/${people.worker._id}/performance`).set(as('head'));
    expect(res.status).toBe(200);
    const current = (res.body.data || res.body).current;
    expect(current).toMatchObject({ onTimeRate: 50, onTimeCount: 1, onTimeTotal: 2, delayedByEarlier: 1, delayedText: '1 step delayed by earlier steps' });
  });

  it("a worker sees only their own profile data", async () => {
    for (const path of ['', '/overview', '/performance', '/work']) {
      const res = await request(app).get(`/api/team/${people.worker._id}${path}`).set(as('other'));
      expect([path, res.status]).toEqual([path, 404]);
    }
  });
});
