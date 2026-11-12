// Tracker list: the month filter uses the IST day of the publish date, and each role sees the
// same rows as before (leadership all; a team member only posts where they own a step, and
// only those steps). Disposable test DB.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/server.js';
import { env } from '../src/config/env.js';
import { Person } from '../src/modules/people/model.js';
import { WorkItem } from '../src/modules/workItems/model.js';
import { ContentPiece } from '../src/modules/calendar/contentPiece.model.js';

const tokenFor = (u) => jwt.sign({ userId: String(u._id), role: u.role }, env.JWT_SECRET, { expiresIn: '1h' });

describe('Tracker list: IST month and role scoping', () => {
  const salt = `trk-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  const people = {};
  const pieces = {};
  const as = (who) => ({ Authorization: `Bearer ${tokenFor(people[who])}` });
  const mine = (res) => res.body.data.filter((p) => p.topic.includes(salt));

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) await mongoose.connect(env.MONGODB_URI);
    for (const [k, r] of [['admin', 'admin'], ['sm', 'sm_manager'], ['head', 'creative_head'], ['exec', 'executive'], ['writer', 'team_member'], ['editor', 'team_member']]) {
      people[k] = await Person.create({ name: `TRK ${k}`, email: `${k}.${salt}@trk.test`, role: r, status: 'active' });
    }
    const planId = new mongoose.Types.ObjectId();
    const mk = (key, postingDate) =>
      ContentPiece.create({ planId, topic: `${key} ${salt}`, contentType: 'Reel', pipeline: 'reel_a', postingDate: new Date(postingDate), rowStatus: 'approved', needsScript: true, needsShoot: true }).then((p) => (pieces[key] = p));
    await mk('nov30', '2026-11-30T00:00:00Z'); // 30 Nov IST
    await mk('dec1', '2026-11-30T20:00:00Z'); // 1 Dec, 01:30 IST
    await mk('nov1', '2026-10-31T19:00:00Z'); // 1 Nov, 00:30 IST
    await mk('oct31', '2026-10-31T00:00:00Z'); // 31 Oct IST
    const step = (piece, stageKey, order, owner) =>
      WorkItem.create({
        title: `${stageKey} ${salt}`, workType: 'Reel', stageKey, stageOrder: order, status: 'Not Started', isLocked: order !== 1,
        contentPieceId: piece._id, calendarPlanId: planId, departmentId: new mongoose.Types.ObjectId(), ownerId: people[owner]._id,
        deadline: new Date('2026-11-20'), estimatedEffortHrs: 1,
      });
    await step(pieces.nov30, 'Script', 1, 'writer');
    await step(pieces.nov30, 'Edit', 2, 'editor');
    await step(pieces.nov1, 'Edit', 1, 'editor');
  });

  afterAll(async () => {
    const ids = Object.values(pieces).map((p) => p._id);
    await WorkItem.deleteMany({ contentPieceId: { $in: ids } });
    await ContentPiece.deleteMany({ _id: { $in: ids } });
    await Person.deleteMany({ email: new RegExp(salt) });
  });

  it('month is the IST calendar month of the publish date', async () => {
    const nov = await request(app).get('/api/content-pieces').query({ month: '2026-11' }).set(as('admin'));
    expect(nov.status).toBe(200);
    expect(mine(nov).map((p) => p.topic.split(' ')[0]).sort()).toEqual(['nov1', 'nov30']);
    const dec = await request(app).get('/api/content-pieces').query({ month: '2026-12' }).set(as('admin'));
    expect(mine(dec).map((p) => p.topic.split(' ')[0])).toEqual(['dec1']);
    const oct = await request(app).get('/api/content-pieces').query({ month: '2026-10' }).set(as('admin'));
    expect(mine(oct).map((p) => p.topic.split(' ')[0])).toEqual(['oct31']);
    // An invalid month is ignored (all months), not an error.
    const bad = await request(app).get('/api/content-pieces').query({ month: 'Nov' }).set(as('admin'));
    expect(mine(bad)).toHaveLength(4);
  });

  it('admin, SM manager, Creative Head and executive see every row and step; team members have no Tracker (403, as before)', async () => {
    for (const who of ['admin', 'sm', 'head', 'exec']) {
      const res = await request(app).get('/api/content-pieces').set(as(who));
      expect(res.status, who).toBe(200);
      const rows = mine(res);
      expect(rows, who).toHaveLength(4);
      expect(rows.find((p) => p.topic.startsWith('nov30')).stages.map((s) => s.stageKey), who).toEqual(['Script', 'Edit']);
    }
    for (const who of ['writer', 'editor']) {
      expect((await request(app).get('/api/content-pieces').set(as(who))).status, who).toBe(403);
    }
  });

  it('Needs owner = an open step with no owner; Waiting for approval = a step waiting on the reviewer', async () => {
    const list = async (q) => mine(await request(app).get('/api/content-pieces').query(q).set(as('admin'))).map((p) => p.topic.split(' ')[0]).sort();
    // Every seeded step has an owner and none is waiting.
    expect(await list({ needsOwner: 'true' })).toEqual([]);
    expect(await list({ waitingApproval: 'true' })).toEqual([]);
    const [script] = await WorkItem.find({ contentPieceId: pieces.nov30._id, stageKey: 'Script' });
    await WorkItem.updateOne({ _id: script._id }, { $set: { ownerId: null } });
    const [edit] = await WorkItem.find({ contentPieceId: pieces.nov1._id });
    await WorkItem.updateOne({ _id: edit._id }, { $set: { status: 'Pending', submittedAt: new Date() } });
    expect(await list({ needsOwner: 'true' })).toEqual(['nov30']);
    expect(await list({ waitingApproval: 'true' })).toEqual(['nov1']);
    // Submitted with a link: saved as Feedback with its latest version still with the reviewer.
    const { Submission } = await import('../src/modules/submissions/model.js');
    await WorkItem.updateOne({ _id: edit._id }, { $set: { status: 'Feedback' } });
    const v1 = await Submission.create({ workItemId: edit._id, stageKey: edit.stageKey, version: 1, kind: 'link', status: 'submitted', submittedAt: new Date(), linkUrl: 'https://drive.google.com/file/d/t' });
    expect(await list({ waitingApproval: 'true' })).toEqual(['nov1']);
    // Changes requested is not waiting for approval; a done step without an owner does not need one.
    await Submission.updateOne({ _id: v1._id }, { $set: { status: 'changes_requested' } });
    await WorkItem.updateOne({ _id: edit._id }, { $set: { revisions: 1 } });
    await WorkItem.updateOne({ _id: script._id }, { $set: { status: 'Approved', approvedAt: new Date() } });
    expect(await list({ waitingApproval: 'true' })).toEqual([]);
    expect(await list({ needsOwner: 'true' })).toEqual([]);
    await Submission.deleteMany({ workItemId: edit._id });
  });
});
