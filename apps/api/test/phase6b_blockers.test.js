import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { getAvailableActions } from '@mmp/shared';
import { app } from '../src/server.js';
import { env } from '../src/config/env.js';
import { Person } from '../src/modules/people/model.js';
import { WorkItem } from '../src/modules/workItems/model.js';
import { Blocker } from '../src/modules/blockers/model.js';
import { ContentPiece } from '../src/modules/calendar/contentPiece.model.js';

const tokenFor = (u) => jwt.sign({ userId: String(u._id), role: u.role }, env.JWT_SECRET, { expiresIn: '1h' });

describe('Phase 6b: blockers', () => {
  const salt = `p6b-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  const people = {};
  const pieces = [];

  const make = (key, role) =>
    Person.create({ name: `P6b ${key}`, email: `${key}.${salt}@p6b.test`, role, status: 'active' }).then((p) => (people[key] = p));

  // A piece with an Edit step (owner) and a later Post step (another participant).
  async function step(status = 'In Progress') {
    const p = await ContentPiece.create({ planId: new mongoose.Types.ObjectId(), topic: `P6b ${salt}`, contentType: 'Reel', pipeline: 'reel_c', postingDate: new Date(Date.now() + 9 * 86400000), status: 'In Progress' });
    pieces.push(p._id);
    const base = { workType: 'Reel', isLocked: false, contentPieceId: p._id, departmentId: new mongoose.Types.ObjectId(), deadline: new Date(Date.now() + 9 * 86400000), estimatedEffortHrs: 1, startedAt: new Date() };
    const edit = await WorkItem.create({ ...base, title: `P6b Edit ${salt}`, stageKey: 'Edit', stageOrder: 1, status, reviewRequired: true, ownerId: people.owner._id });
    await WorkItem.create({ ...base, title: `P6b Post ${salt}`, stageKey: 'Post', stageOrder: 2, status: 'Not Started', isLocked: true, ownerId: people.poster._id });
    return edit;
  }
  const as = (who) => ({ Authorization: `Bearer ${tokenFor(people[who])}` });
  const activeBlocker = (w) => Blocker.findOne({ workItemId: w._id, status: 'Active' }).lean();

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) await mongoose.connect(env.MONGODB_URI);
    for (const [k, r] of [['owner', 'team_member'], ['poster', 'team_member'], ['outsider', 'team_member'], ['sm', 'sm_manager'], ['admin', 'admin'], ['head', 'creative_head']]) await make(k, r);
  });

  afterAll(async () => {
    const items = await WorkItem.find({ contentPieceId: { $in: pieces } }).select('_id').lean();
    await Blocker.deleteMany({ workItemId: { $in: items.map((w) => w._id) } });
    await WorkItem.deleteMany({ contentPieceId: { $in: pieces } });
    await ContentPiece.deleteMany({ _id: { $in: pieces } });
    await Person.deleteMany({ email: new RegExp(salt) });
  });

  const blockByTransition = (w) =>
    request(app).post(`/api/work-items/${w._id}/transition`).set(as('owner')).send({ toStatus: 'Blocked', blockerReason: 'Other', blockerNote: 'Waiting on assets' });

  it('marking blocked from My Work (a transition) leaves a blocker record and pauses work time', async () => {
    const w = await step();
    expect((await blockByTransition(w)).status).toBe(200);
    const blocker = await activeBlocker(w);
    expect(blocker).toMatchObject({ status: 'Active', reason: 'Other', statusBefore: 'In Progress' });
    const after = await WorkItem.findById(w._id).lean();
    expect(after.intervals.filter((iv) => iv.kind === 'blocked' && !iv.endedAt)).toHaveLength(1);
  });

  it('the owner resolves it from My Work: the record becomes Resolved and the step returns to its previous status', async () => {
    const w = await step();
    await blockByTransition(w);
    const blocker = await activeBlocker(w);
    const list = await request(app).get(`/api/blockers?workItemId=${w._id}&status=Active`).set(as('owner'));
    expect(list.status).toBe(200);
    expect((list.body.data || list.body).map((b) => String(b._id))).toEqual([String(blocker._id)]);
    const res = await request(app).patch(`/api/blockers/${blocker._id}/resolve`).set(as('owner')).send({});
    expect(res.status).toBe(200);
    const record = await Blocker.findById(blocker._id).lean();
    expect(record.status).toBe('Resolved');
    expect(String(record.resolvedById)).toBe(String(people.owner._id));
    const after = await WorkItem.findById(w._id).lean();
    expect(after.status).toBe('In Progress');
    expect(after.intervals.filter((iv) => iv.kind === 'blocked' && !iv.endedAt)).toHaveLength(0);
  });

  it('a step blocked while in review returns to review', async () => {
    const w = await step('Feedback');
    const res = await request(app).post('/api/blockers').set(as('sm')).send({ workItemId: String(w._id), reason: 'Other', notes: 'x' });
    expect(res.status).toBeLessThan(300);
    const blocker = await activeBlocker(w);
    expect(blocker.statusBefore).toBe('Feedback');
    expect((await WorkItem.findById(w._id).lean()).intervals.some((iv) => iv.kind === 'blocked' && !iv.endedAt)).toBe(true);
    await request(app).patch(`/api/blockers/${blocker._id}/resolve`).set(as('sm')).send({}).expect(200);
    expect((await WorkItem.findById(w._id).lean()).status).toBe('Feedback');
  });

  it('an explicit resume status from the Issues page is still honoured', async () => {
    const w = await step();
    await blockByTransition(w);
    const blocker = await activeBlocker(w);
    await request(app).patch(`/api/blockers/${blocker._id}/resolve`).set(as('admin')).send({ resumeStatus: 'Not Started' }).expect(200);
    expect((await WorkItem.findById(w._id).lean()).status).toBe('Not Started');
  });

  it('leaving Blocked through a transition also resolves the record', async () => {
    const w = await step();
    await blockByTransition(w);
    const res = await request(app).post(`/api/work-items/${w._id}/transition`).set(as('sm')).send({ toStatus: 'In Progress' });
    expect(res.status).toBe(200);
    expect(await activeBlocker(w)).toBeNull();
    expect(await Blocker.countDocuments({ workItemId: w._id, status: 'Resolved' })).toBe(1);
  });

  describe('who may resolve', () => {
    for (const [who, expected] of [['owner', 200], ['sm', 200], ['admin', 200], ['head', 403], ['poster', 403], ['outsider', 404]]) {
      it(`${who}: ${expected}`, async () => {
        const w = await step();
        await blockByTransition(w);
        const blocker = await activeBlocker(w);
        const res = await request(app).patch(`/api/blockers/${blocker._id}/resolve`).set(as(who)).send({});
        expect(res.status).toBe(expected);
        expect((await Blocker.findById(blocker._id).lean()).status).toBe(expected === 200 ? 'Resolved' : 'Active');
      });
    }
  });

  it('a team member listing by step sees only steps they are on', async () => {
    const w = await step();
    await blockByTransition(w);
    const own = await request(app).get(`/api/blockers?workItemId=${w._id}`).set(as('owner'));
    expect((own.body.data || own.body)).toHaveLength(1);
    const other = await request(app).get(`/api/blockers?workItemId=${w._id}`).set(as('outsider'));
    expect((other.body.data || other.body)).toHaveLength(0);
  });

  it('Resolve shows only to the owner, sm_manager and admin', () => {
    const stage = { _id: 's1', ownerId: 'owner-1', status: 'Blocked', stageKey: 'Edit', isLocked: false };
    const has = (user) => getAvailableActions(user, stage).actions.includes('resolve_blocker');
    expect(has({ _id: 'owner-1', role: 'team_member' })).toBe(true);
    expect(has({ _id: 'sm-1', role: 'sm_manager' })).toBe(true);
    expect(has({ _id: 'admin-1', role: 'admin' })).toBe(true);
    expect(has({ _id: 'head-1', role: 'creative_head' })).toBe(false);
    expect(has({ _id: 'exec-1', role: 'executive' })).toBe(false);
    expect(has({ _id: 'other-1', role: 'team_member' })).toBe(false);
  });
});
