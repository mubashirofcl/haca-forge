import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/server.js';
import { env } from '../src/config/env.js';
import { Person } from '../src/modules/people/model.js';
import { WorkItem } from '../src/modules/workItems/model.js';
import { Submission } from '../src/modules/submissions/model.js';
import { ContentPiece } from '../src/modules/calendar/contentPiece.model.js';
import { CalendarPlan } from '../src/modules/calendar/plan.model.js';

const tokenFor = (u) => jwt.sign({ userId: String(u._id), role: u.role }, env.JWT_SECRET, { expiresIn: '1h' });
const LIVE = 'https://instagram.com/p/p6e-live';

describe('Phase 6e: plan delete and publishing an invalid piece', () => {
  const salt = `p6e-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  const people = {};
  const planIds = [];
  const pieceIds = [];
  const extraItemIds = [];
  let seq = 0;

  const make = (key, role) =>
    Person.create({ name: `P6e ${key}`, email: `${key}.${salt}@p6e.test`, role, status: 'active' }).then((p) => (people[key] = p));
  const as = (who) => ({ Authorization: `Bearer ${tokenFor(people[who])}` });

  async function makePlan(rowStatus = 'draft') {
    seq += 1;
    const plan = await CalendarPlan.create({
      code: `P6E-${salt}-${seq}`,
      title: `P6e plan ${seq}`,
      kind: 'monthly',
      periodStart: new Date('2026-12-01'),
      periodEnd: new Date('2026-12-31'),
      createdById: people.sm._id,
    });
    planIds.push(plan._id);
    const piece = await ContentPiece.create({ planId: plan._id, topic: `P6e ${salt} ${seq}`, contentType: 'Reel', pipeline: 'reel_a', postingDate: new Date('2026-12-15'), rowStatus });
    pieceIds.push(piece._id);
    return { plan, piece };
  }

  async function makeStep(piece, stageKey, stageOrder, extra = {}) {
    return WorkItem.create({
      title: `P6e ${stageKey} ${salt}`,
      workType: 'Reel',
      stageKey,
      stageOrder,
      status: 'Not Started',
      isLocked: stageOrder !== 1,
      reviewRequired: stageKey !== 'Post',
      contentPieceId: piece._id,
      calendarPlanId: piece.planId,
      departmentId: new mongoose.Types.ObjectId(),
      ownerId: people.worker._id,
      deadline: new Date('2026-12-10'),
      estimatedEffortHrs: 1,
      ...extra,
    });
  }

  const del = (plan, who = 'sm') => request(app).delete(`/api/calendar-plans/${plan._id}`).set(as(who));
  const exists = async (plan, piece) => ({
    plan: Boolean(await CalendarPlan.exists({ _id: plan._id })),
    piece: Boolean(await ContentPiece.exists({ _id: piece._id })),
    steps: await WorkItem.countDocuments({ contentPieceId: piece._id }),
  });

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) await mongoose.connect(env.MONGODB_URI);
    for (const [k, r] of [['sm', 'sm_manager'], ['admin', 'admin'], ['head', 'creative_head'], ['worker', 'team_member'], ['poster', 'team_member']]) await make(k, r);
  });

  afterAll(async () => {
    const items = await WorkItem.find({ $or: [{ contentPieceId: { $in: pieceIds } }, { _id: { $in: extraItemIds } }] }).select('_id').lean();
    await Submission.deleteMany({ workItemId: { $in: items.map((w) => w._id) } });
    await WorkItem.deleteMany({ _id: { $in: items.map((w) => w._id) } });
    await ContentPiece.deleteMany({ _id: { $in: pieceIds } });
    await CalendarPlan.deleteMany({ _id: { $in: planIds } });
    await Person.deleteMany({ email: new RegExp(salt) });
  });

  describe('plan delete', () => {
    it('a draft plan deletes with its rows', async () => {
      const { plan, piece } = await makePlan('draft');
      const res = await del(plan);
      expect(res.status).toBe(200);
      expect(await exists(plan, piece)).toEqual({ plan: false, piece: false, steps: 0 });
    });

    it('an approved plan whose steps have not started deletes with its unstarted steps', async () => {
      const { plan, piece } = await makePlan('approved');
      await makeStep(piece, 'Script', 1);
      await makeStep(piece, 'Shoot', 2);
      const detail = await request(app).get(`/api/calendar-plans/${plan._id}`).set(as('sm'));
      expect(detail.body.data.hasStartedWork).toBe(false);
      const res = await del(plan, 'admin');
      expect(res.status).toBe(200);
      expect(await exists(plan, piece)).toEqual({ plan: false, piece: false, steps: 0 });
    });

    const startedCases = [
      ['a step in progress', { status: 'In Progress', startedAt: new Date() }],
      ['a step with a start time', { startedAt: new Date() }],
      ['a step that was submitted', 'submission'],
    ];
    for (const [label, change] of startedCases) {
      it(`is blocked once ${label}, and nothing is removed`, async () => {
        const { plan, piece } = await makePlan('approved');
        const first = await makeStep(piece, 'Script', 1, change === 'submission' ? {} : change);
        await makeStep(piece, 'Shoot', 2);
        if (change === 'submission') {
          await Submission.create({ workItemId: first._id, stageKey: 'Script', version: 1, kind: 'document', status: 'submitted', submittedById: people.worker._id });
        }
        const detail = await request(app).get(`/api/calendar-plans/${plan._id}`).set(as('sm'));
        expect(detail.body.data.hasStartedWork).toBe(true);
        const res = await del(plan);
        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('PLAN_HAS_STARTED_WORK');
        expect(await exists(plan, piece)).toEqual({ plan: true, piece: true, steps: 2 });
      });
    }

    it('only SM Manager and Admin can delete', async () => {
      const { plan, piece } = await makePlan('draft');
      expect((await del(plan, 'head')).status).toBe(403);
      expect((await del(plan, 'worker')).status).toBe(403);
      expect(await exists(plan, piece)).toEqual({ plan: true, piece: true, steps: 0 });
    });

    it('leaves existing orphaned records alone', async () => {
      const { plan } = await makePlan('draft');
      const orphan = await WorkItem.create({
        title: `P6e orphan ${salt}`, workType: 'Reel', stageKey: 'Script', stageOrder: 1, status: 'Not Started',
        contentPieceId: new mongoose.Types.ObjectId(), calendarPlanId: plan._id,
        departmentId: new mongoose.Types.ObjectId(), deadline: new Date('2026-12-10'), estimatedEffortHrs: 1,
      });
      extraItemIds.push(orphan._id);
      expect((await del(plan)).status).toBe(200);
      expect(await WorkItem.exists({ _id: orphan._id })).toBeTruthy();
    });
  });

  describe('publishing a Post step', () => {
    async function postStep() {
      const { piece } = await makePlan('approved');
      const w = await makeStep(piece, 'Post', 1, { status: 'In Progress', startedAt: new Date(), ownerId: people.poster._id });
      return { piece, w };
    }
    const publish = (w) =>
      request(app).post(`/api/work-items/${w._id}/transition`).set(as('poster')).send({ toStatus: 'Published', publishedUrl: LIVE, caption: 'Launch day' });

    it('an invalid content piece is a 400 and nothing changes', async () => {
      const { piece, w } = await postStep();
      // A stored piece that no longer passes validation (written around the model, as legacy data was).
      await ContentPiece.collection.updateOne({ _id: piece._id }, { $set: { pipeline: 'not-a-pipeline' } });
      const res = await publish(w);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CONTENT_PIECE_INVALID');
      const after = await WorkItem.findById(w._id).lean();
      expect(after.status).toBe('In Progress');
      expect(after.postedAt || null).toBeNull();
      expect(after.publishedUrl || '').toBe('');
      expect(after.postCaption || '').toBe('');
      const pieceAfter = await ContentPiece.collection.findOne({ _id: piece._id });
      expect(pieceAfter.publishedAt || null).toBeNull();
      expect(pieceAfter.liveUrl || '').toBe('');
    });

    it('a valid piece still publishes and records the live link', async () => {
      const { piece, w } = await postStep();
      const res = await publish(w);
      expect(res.status).toBe(200);
      expect((await WorkItem.findById(w._id).lean()).status).toBe('Published');
      const pieceAfter = await ContentPiece.findById(piece._id).lean();
      expect(pieceAfter.publishedAt).toBeTruthy();
      expect(pieceAfter.liveUrl).toBe(LIVE);
    });
  });
});
