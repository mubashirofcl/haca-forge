import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { calculateIndividualWorkMeasures } from '@mmp/shared';
import { app } from '../src/server.js';
import { env } from '../src/config/env.js';
import { Person } from '../src/modules/people/model.js';
import { WorkItem } from '../src/modules/workItems/model.js';
import { Submission, Rating } from '../src/modules/submissions/model.js';
import { ContentPiece } from '../src/modules/calendar/contentPiece.model.js';
import { Notification } from '../src/modules/notifications/model.js';

const tokenFor = (u) => jwt.sign({ userId: String(u._id), role: u.role }, env.JWT_SECRET, { expiresIn: '1h' });
const HOUR = 3600000;

describe('Phase 6c: reopening a step pauses later steps', () => {
  const salt = `p6c-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  const people = {};
  const pieces = [];

  const make = (key, role) =>
    Person.create({ name: `P6c ${key}`, email: `${key}.${salt}@p6c.test`, role, status: 'active' }).then((p) => (people[key] = p));
  const as = (who) => ({ Authorization: `Bearer ${tokenFor(people[who])}` });

  /** stages: [stageKey, status, owner, extra] */
  async function piece(contentType, stages) {
    const p = await ContentPiece.create({ planId: new mongoose.Types.ObjectId(), topic: `P6c ${salt}`, contentType, pipeline: contentType === 'Reel' ? 'reel_a' : 'design', postingDate: new Date(Date.now() + 9 * 86400000), status: 'In Progress' });
    pieces.push(p._id);
    const out = {};
    let order = 1;
    for (const [stageKey, status, owner, extra = {}] of stages) {
      const finished = ['Approved', 'Published'].includes(status);
      out[stageKey] = await WorkItem.create({
        title: `P6c ${contentType} ${stageKey} ${salt}`, workType: contentType, stageKey, stageOrder: order++, status,
        isLocked: false, reviewRequired: stageKey !== 'Post', contentPieceId: p._id, departmentId: new mongoose.Types.ObjectId(),
        ownerId: people[owner]._id, deadline: new Date(Date.now() + 9 * 86400000), estimatedEffortHrs: 1,
        startedAt: status === 'Not Started' ? null : new Date(Date.now() - 5 * HOUR), approvedAt: finished ? new Date() : null, ...extra,
      });
      if (finished && stageKey !== 'Post') {
        await Submission.create({ workItemId: out[stageKey]._id, stageKey, version: 1, kind: 'document', status: 'approved', submittedById: people[owner]._id, document: { htmlSnapshot: '<p>v1</p>' } });
      }
    }
    return out;
  }
  const reopen = (w, who) => request(app).post(`/api/work-items/${w._id}/transition`).set(as(who)).send({ toStatus: 'In Progress', comment: 'Needs changes' });
  // The owner submits a new version and the creative head approves it.
  async function approveAgain(w, owner) {
    await request(app).post(`/api/work/${w._id}/submit`).set(as(owner)).send({ kind: 'document', document: { htmlSnapshot: '<p>v2</p>' } }).expect((r) => expect(r.status).toBeLessThan(300));
    const v = await Submission.findOne({ workItemId: w._id, version: { $gt: 0 } }).sort({ version: -1 });
    const res = await request(app).post(`/api/submissions/${v._id}/approve`).set(as('head')).send({ score: 4 });
    expect(res.status).toBeLessThan(300);
  }
  const fresh = (w) => WorkItem.findById(w._id).lean();

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) await mongoose.connect(env.MONGODB_URI);
    for (const [k, r] of [['writer', 'team_member'], ['shooter', 'team_member'], ['editor', 'team_member'], ['poster', 'team_member'], ['designer', 'team_member'], ['head', 'creative_head'], ['head2', 'creative_head'], ['admin', 'admin'], ['sm', 'sm_manager']]) await make(k, r);
  });

  afterAll(async () => {
    const items = await WorkItem.find({ contentPieceId: { $in: pieces } }).select('_id').lean();
    const ids = items.map((w) => w._id);
    await Rating.deleteMany({ workItemId: { $in: ids } });
    await Submission.deleteMany({ workItemId: { $in: ids } });
    await WorkItem.deleteMany({ _id: { $in: ids } });
    await ContentPiece.deleteMany({ _id: { $in: pieces } });
    await Notification.deleteMany({ recipient: { $in: Object.values(people).map((p) => p._id) } });
    await Person.deleteMany({ email: new RegExp(salt) });
  });

  it('the shared work-time calculator subtracts paused time like blocked time', () => {
    const start = new Date('2026-11-01T08:00:00Z');
    const end = new Date('2026-11-01T14:00:00Z');
    const base = { status: 'Feedback', startedAt: start, submittedAt: end, rounds: [{ startedAt: start, submittedAt: end, intervals: [] }] };
    const paused = { kind: 'paused', startedAt: new Date('2026-11-01T09:00:00Z'), endedAt: new Date('2026-11-01T11:00:00Z') };
    const blocked = { ...paused, kind: 'blocked' };
    const plain = calculateIndividualWorkMeasures(base).workTimeMs;
    const withPause = calculateIndividualWorkMeasures({ ...base, rounds: [{ ...base.rounds[0], intervals: [paused] }] }).workTimeMs;
    const withBlock = calculateIndividualWorkMeasures({ ...base, rounds: [{ ...base.rounds[0], intervals: [blocked] }] }).workTimeMs;
    expect(plain).toBe(6 * HOUR);
    expect(withPause).toBe(4 * HOUR);
    expect(withPause).toBe(withBlock);
  });

  describe('who and when', () => {
    for (const [who, expected] of [['head', 200], ['admin', 200], ['sm', 403], ['writer', 403], ['shooter', 403]]) {
      it(`${who}: ${expected}`, async () => {
        const p = await piece('Reel', [['Script', 'Approved', 'writer'], ['Shoot', 'In Progress', 'shooter']]);
        expect((await reopen(p.Script, who)).status).toBe(expected);
      });
    }

    it('a creative head cannot reopen their own step', async () => {
      const p = await piece('Reel', [['Script', 'Approved', 'head'], ['Shoot', 'In Progress', 'shooter']]);
      expect((await reopen(p.Script, 'head')).status).toBe(403);
    });

    it('only review steps can be reopened', async () => {
      const p = await piece('Reel', [['Edit', 'Approved', 'editor'], ['Post', 'Approved', 'poster']]);
      const res = await reopen(p.Post, 'head');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('REOPEN_NOT_REVIEW_STEP');
    });

    it('blocked once the deliverable is posted', async () => {
      const p = await piece('Reel', [['Edit', 'Approved', 'editor'], ['Post', 'Published', 'poster']]);
      const res = await reopen(p.Edit, 'head');
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DELIVERABLE_DELIVERED');
      expect((await fresh(p.Edit)).status).toBe('Approved');
    });

    it('blocked once a non-postable design is handed over', async () => {
      const p = await piece('Poster', [['Content', 'Approved', 'writer'], ['Design', 'Approved', 'designer']]);
      for (const step of [p.Content, p.Design]) {
        const res = await reopen(step, 'admin');
        expect(res.status).toBe(409);
      }
    });

    it('Work Detail offers Reopen only to those who may', async () => {
      const p = await piece('Reel', [['Script', 'Approved', 'writer'], ['Shoot', 'In Progress', 'shooter']]);
      const flag = async (who) => (await request(app).get(`/api/work-items/${p.Script._id}`).set(as(who))).body.data.canReopen;
      expect(await flag('head')).toBe(true);
      expect(await flag('admin')).toBe(true);
      expect(await flag('sm')).toBe(false);
      expect(await flag('writer')).toBe(false);
      const posted = await piece('Reel', [['Edit', 'Approved', 'editor'], ['Post', 'Published', 'poster']]);
      expect((await request(app).get(`/api/work-items/${posted.Edit._id}`).set(as('head'))).body.data.canReopen).toBe(false);
    });
  });

  describe('pause and resume', () => {
    it('pauses unfinished later steps exactly as they are, notifies their owners, and resumes them', async () => {
      const startedAt = new Date(Date.now() - 5 * HOUR);
      const rounds = [{ roundNumber: 1, startedAt, intervals: [] }];
      const p = await piece('Reel', [
        ['Script', 'Approved', 'writer'],
        ['Shoot', 'In Progress', 'shooter', { startedAt, rounds }],
        ['Edit', 'Not Started', 'editor', { isLocked: true }],
      ]);
      expect((await reopen(p.Script, 'head')).status).toBe(200);

      const shoot = await fresh(p.Shoot);
      expect(shoot.status).toBe('In Progress');
      expect(shoot.isLocked).toBe(true);
      expect(shoot.pausedBy.map(String)).toEqual([String(p.Script._id)]);
      expect(shoot.intervals.filter((iv) => iv.kind === 'paused' && !iv.endedAt)).toHaveLength(1);
      expect(shoot.rounds[0].intervals.filter((iv) => iv.kind === 'paused' && !iv.endedAt)).toHaveLength(1);
      expect((await fresh(p.Edit)).pausedBy.map(String)).toEqual([String(p.Script._id)]);
      expect(await Notification.countDocuments({ recipient: people.shooter._id, type: 'step_paused', 'metadata.workItemId': p.Shoot._id })).toBe(1);

      // The shooter cannot carry on while paused.
      const work = await request(app).post(`/api/work/${p.Shoot._id}/submit`).set(as('shooter')).send({ kind: 'video', files: [{ url: 'https://drive.google.com/file/d/x' }] });
      expect(work.status).toBe(403);

      await approveAgain(p.Script, 'writer');
      const resumed = await fresh(p.Shoot);
      expect(resumed.pausedBy).toEqual([]);
      expect(resumed.status).toBe('In Progress');
      expect(new Date(resumed.startedAt).getTime()).toBe(startedAt.getTime());
      expect(resumed.rounds).toHaveLength(1);
      expect(resumed.isLocked).toBe(false);
      expect(resumed.intervals.filter((iv) => iv.kind === 'paused' && !iv.endedAt)).toHaveLength(0);
      expect(await Notification.countDocuments({ recipient: people.shooter._id, type: 'step_resumed', 'metadata.workItemId': p.Shoot._id })).toBe(1);
      const edit = await fresh(p.Edit);
      expect(edit.pausedBy).toEqual([]);
      expect(edit.status).toBe('Not Started');
    });

    it('a later step awaiting review pauses too, and refuses review decisions until it resumes', async () => {
      const p = await piece('Reel', [['Script', 'Approved', 'writer'], ['Edit', 'Feedback', 'editor', { submittedAt: new Date() }]]);
      const waiting = await Submission.create({ workItemId: p.Edit._id, stageKey: 'Edit', version: 1, kind: 'video', status: 'submitted', submittedById: people.editor._id, submittedAt: new Date(), files: [{ url: 'https://drive.google.com/file/d/y' }] });
      expect((await reopen(p.Script, 'head')).status).toBe(200);
      expect((await fresh(p.Edit)).pausedBy).toHaveLength(1);

      const approve = await request(app).post(`/api/submissions/${waiting._id}/approve`).set(as('head')).send({ score: 5 });
      expect(approve.status).toBe(409);
      expect(approve.body.error.code).toBe('STEP_PAUSED');
      const revise = await request(app).post(`/api/submissions/${waiting._id}/request-revision`).set(as('head')).send({ comment: 'x', rootCause: 'Other' });
      expect(revise.status).toBe(409);
      expect((await fresh(p.Edit)).status).toBe('Feedback');

      await approveAgain(p.Script, 'writer');
      expect((await fresh(p.Edit)).status).toBe('Feedback');
      const ok = await request(app).post(`/api/submissions/${waiting._id}/approve`).set(as('head')).send({ score: 5 });
      expect(ok.status, JSON.stringify(ok.body)).toBeLessThan(300);
    });

    it('with two reopened earlier steps, a later step resumes only when both are approved again', async () => {
      const p = await piece('Reel', [
        ['Script', 'Approved', 'writer'],
        ['Edit', 'Approved', 'editor'],
        ['Post', 'In Progress', 'poster'],
      ]);
      expect((await reopen(p.Script, 'head')).status).toBe(200);
      expect((await reopen(p.Edit, 'head2')).status).toBe(200);
      expect((await fresh(p.Post)).pausedBy).toHaveLength(2);

      await approveAgain(p.Script, 'writer');
      const stillPaused = await fresh(p.Post);
      expect(stillPaused.pausedBy.map(String)).toEqual([String(p.Edit._id)]);
      expect(stillPaused.isLocked).toBe(true);
      expect(await Notification.countDocuments({ recipient: people.poster._id, type: 'step_resumed', 'metadata.workItemId': p.Post._id })).toBe(0);

      await approveAgain(p.Edit, 'editor');
      const resumed = await fresh(p.Post);
      expect(resumed.pausedBy).toEqual([]);
      expect(resumed.status).toBe('In Progress');
      expect(resumed.isLocked).toBe(false);
      expect(await Notification.countDocuments({ recipient: people.poster._id, type: 'step_resumed', 'metadata.workItemId': p.Post._id })).toBe(1);
    });
  });
});
