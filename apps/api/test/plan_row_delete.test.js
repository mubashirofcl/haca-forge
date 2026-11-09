// Delete a plan row: SM Manager and Admin only. Unapproved rows are removed; an approved row
// only while none of its steps has started (then its piece and unstarted steps go too, and
// their owners are notified). Started work: 409, nothing removed. Disposable test DB.
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
import { Notification } from '../src/modules/notifications/model.js';
import { ActivityEvent } from '../src/modules/activity/model.js';

const tokenFor = (u) => jwt.sign({ userId: String(u._id), role: u.role }, env.JWT_SECRET, { expiresIn: '1h' });
const CAL = 'other';
const MONTH = '2032-03';
const STARTED_MESSAGE = "This post has started work and can't be deleted.";

describe('Delete a plan row', () => {
  const salt = `rowdel-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  const people = {};
  const planIds = [];
  const pieceIds = [];
  let seq = 0;

  const as = (who) => ({ Authorization: `Bearer ${tokenFor(people[who])}` });

  async function makePlan() {
    seq += 1;
    const plan = await CalendarPlan.create({
      code: `RD-${salt}-${seq}`,
      title: `Row delete plan ${seq}`,
      kind: 'monthly',
      calendar: CAL,
      periodStart: new Date('2032-03-01'),
      periodEnd: new Date('2032-03-31'),
      createdById: people.sm._id,
    });
    planIds.push(plan._id);
    return plan;
  }

  async function makeRow(plan, rowStatus = 'draft', topic = `Row ${salt} ${seq}`) {
    const piece = await ContentPiece.create({
      planId: plan._id, calendar: CAL, topic, contentType: 'Reel', pipeline: 'reel_a', postingDate: new Date('2032-03-20T00:00:00Z'), rowStatus,
    });
    pieceIds.push(piece._id);
    return piece;
  }

  async function makeStep(piece, stageKey, stageOrder, owner, extra = {}) {
    return WorkItem.create({
      title: `RD ${stageKey} ${salt}`,
      workType: 'Reel',
      stageKey,
      stageOrder,
      status: 'Not Started',
      isLocked: stageOrder !== 1,
      reviewRequired: stageKey !== 'Post',
      contentPieceId: piece._id,
      calendarPlanId: piece.planId,
      departmentId: new mongoose.Types.ObjectId(),
      ownerId: owner ? people[owner]._id : null,
      deadline: new Date('2032-03-10'),
      estimatedEffortHrs: 1,
      ...extra,
    });
  }

  const del = (plan, piece, who = 'sm') => request(app).delete(`/api/calendar-plans/${plan._id}/rows/${piece._id}`).set(as(who));
  const state = async (piece) => ({
    piece: Boolean(await ContentPiece.exists({ _id: piece._id })),
    steps: await WorkItem.countDocuments({ contentPieceId: piece._id }),
  });
  const notices = (who, piece) => Notification.find({ recipient: people[who]._id, type: 'step_removed', 'metadata.contentPieceId': piece._id }).lean();

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) await mongoose.connect(env.MONGODB_URI);
    for (const [k, r] of [
      ['sm', 'sm_manager'], ['admin', 'admin'], ['head', 'creative_head'], ['exec', 'executive'],
      ['worker', 'team_member'], ['writer', 'team_member'], ['poster', 'team_member'],
    ]) {
      people[k] = await Person.create({ name: `RD ${k}`, email: `${k}.${salt}@rowdel.test`, role: r, status: 'active' });
    }
  });

  afterAll(async () => {
    const items = await WorkItem.find({ contentPieceId: { $in: pieceIds } }).select('_id').lean();
    await Submission.deleteMany({ workItemId: { $in: items.map((w) => w._id) } });
    await WorkItem.deleteMany({ _id: { $in: items.map((w) => w._id) } });
    await ContentPiece.deleteMany({ _id: { $in: pieceIds } });
    await Notification.deleteMany({ recipient: { $in: Object.values(people).map((p) => p._id) } });
    await ActivityEvent.deleteMany({ entityId: { $in: planIds.map(String) } }).catch(() => {});
    await CalendarPlan.deleteMany({ _id: { $in: planIds } });
    await Person.deleteMany({ email: new RegExp(salt) });
  });

  it('a draft row is deleted and the delete is logged', async () => {
    const plan = await makePlan();
    const keep = await makeRow(plan, 'draft', `Keep ${salt}`);
    const piece = await makeRow(plan, 'draft');
    const res = await del(plan, piece);
    expect(res.status).toBe(200);
    expect(await state(piece)).toEqual({ piece: false, steps: 0 });
    expect(await ContentPiece.exists({ _id: keep._id })).toBeTruthy();
    const ev = await ActivityEvent.findOne({ action: 'calendar_plan.row_deleted', 'metadata.rowId': String(piece._id) }).lean();
    expect(ev).toBeTruthy();
    expect(ev.metadata).toMatchObject({ topic: piece.topic, postingDate: '2032-03-20', rowStatus: 'draft', deletedWorkItemsCount: 0 });
  });

  it('rows waiting for review or sent back are deleted too', async () => {
    const plan = await makePlan();
    for (const status of ['submitted', 'changes_requested']) {
      const piece = await makeRow(plan, status);
      expect((await del(plan, piece)).status).toBe(200);
      expect(await state(piece)).toEqual({ piece: false, steps: 0 });
    }
  });

  it('an approved row with no started steps is deleted with its piece and steps; owners are notified once each', async () => {
    const plan = await makePlan();
    const piece = await makeRow(plan, 'approved');
    await makeStep(piece, 'Script', 1, 'writer');
    await makeStep(piece, 'Shoot', 2, 'worker');
    await makeStep(piece, 'Edit', 3, 'worker');
    await makeStep(piece, 'Post', 4, null);

    const grid = await request(app).get('/api/calendar-plans/grid').query({ calendar: CAL, month: MONTH, planId: String(plan._id) }).set(as('sm'));
    expect(grid.status).toBe(200);
    expect(grid.body.data.rows.find((r) => r.rowId === String(piece._id))).toMatchObject({ editable: false, deletable: true });

    const res = await del(plan, piece, 'admin');
    expect(res.status).toBe(200);
    expect(await state(piece)).toEqual({ piece: false, steps: 0 });

    const [w] = await notices('writer', piece);
    expect(w.title).toBe('Post removed from the plan');
    expect(w.message).toContain(piece.topic);
    expect(w.message).toContain('20 Mar 2032');
    expect(w.message).toMatch(/Your Script step/);
    const worker = await notices('worker', piece);
    expect(worker).toHaveLength(1);
    expect(worker[0].message).toMatch(/Your Shoot, Edit steps/);
    const ev = await ActivityEvent.findOne({ action: 'calendar_plan.row_deleted', 'metadata.rowId': String(piece._id) }).lean();
    expect(ev.metadata).toMatchObject({ rowStatus: 'approved', deletedWorkItemsCount: 4 });
  });

  it('the person deleting is not notified about their own step', async () => {
    const plan = await makePlan();
    const piece = await makeRow(plan, 'approved');
    await makeStep(piece, 'Post', 1, 'sm');
    expect((await del(plan, piece)).status).toBe(200);
    expect(await notices('sm', piece)).toHaveLength(0);
  });

  const startedCases = [
    ['a step in progress', { status: 'In Progress', startedAt: new Date() }],
    ['a step with a start time', { startedAt: new Date() }],
    ['a step that was submitted', 'submission'],
  ];
  for (const [label, change] of startedCases) {
    it(`an approved row with ${label}: 409, nothing deleted, no notices, and the grid hides delete`, async () => {
      const plan = await makePlan();
      const piece = await makeRow(plan, 'approved');
      const first = await makeStep(piece, 'Script', 1, 'writer', change === 'submission' ? {} : change);
      await makeStep(piece, 'Shoot', 2, 'worker');
      if (change === 'submission') {
        await Submission.create({ workItemId: first._id, stageKey: 'Script', version: 1, kind: 'document', status: 'submitted', submittedById: people.writer._id });
      }
      const res = await del(plan, piece);
      expect(res.status).toBe(409);
      expect(res.body.error).toMatchObject({ code: 'ROW_HAS_STARTED_WORK', message: STARTED_MESSAGE });
      expect(await state(piece)).toEqual({ piece: true, steps: 2 });
      expect(await notices('writer', piece)).toHaveLength(0);
      expect(await notices('worker', piece)).toHaveLength(0);

      const grid = await request(app).get('/api/calendar-plans/grid').query({ calendar: CAL, month: MONTH, planId: String(plan._id) }).set(as('sm'));
      expect(grid.body.data.rows.find((r) => r.rowId === String(piece._id)).deletable).toBe(false);
    });
  }

  it('role access: SM Manager and Admin delete; Creative Head, Executive and team member get 403', async () => {
    const plan = await makePlan();
    for (const who of ['head', 'exec', 'worker']) {
      const piece = await makeRow(plan, 'draft');
      const res = await del(plan, piece, who);
      expect(res.status, who).toBe(403);
      expect(await state(piece)).toEqual({ piece: true, steps: 0 });
    }
    for (const who of ['sm', 'admin']) {
      const piece = await makeRow(plan, 'draft');
      expect((await del(plan, piece, who)).status, who).toBe(200);
      expect(await state(piece)).toEqual({ piece: false, steps: 0 });
    }
  });

  it('a row from another plan is not found', async () => {
    const a = await makePlan();
    const b = await makePlan();
    const piece = await makeRow(b, 'draft');
    expect((await del(a, piece)).status).toBe(404);
    expect(await state(piece)).toEqual({ piece: true, steps: 0 });
  });
});
