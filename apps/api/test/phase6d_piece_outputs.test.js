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

const tokenFor = (u) => jwt.sign({ userId: String(u._id), role: u.role }, env.JWT_SECRET, { expiresIn: '1h' });
const DRIVE = (x) => `https://drive.google.com/file/d/${x}/view`;

describe('Phase 6d: piece outputs and the approved output on Work Detail', () => {
  const salt = `p6d-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  const people = {};
  let piece;
  const steps = {};

  const make = (key, role) =>
    Person.create({ name: `P6d ${key}`, email: `${key}.${salt}@p6d.test`, role, status: 'active' }).then((p) => (people[key] = p));
  const as = (who) => ({ Authorization: `Bearer ${tokenFor(people[who])}` });
  const sub = (w, version, status, url) =>
    Submission.create({ workItemId: w._id, stageKey: w.stageKey, version, kind: 'video', status, submittedById: w.ownerId, files: [{ url }] });

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) await mongoose.connect(env.MONGODB_URI);
    for (const [k, r] of [['writer', 'team_member'], ['shooter', 'team_member'], ['editor', 'team_member'], ['outsider', 'team_member'], ['head', 'creative_head'], ['exec', 'executive']]) await make(k, r);
    piece = await ContentPiece.create({ planId: new mongoose.Types.ObjectId(), topic: `P6d ${salt}`, contentType: 'Reel', pipeline: 'reel_a', postingDate: new Date(Date.now() + 9 * 86400000), status: 'In Progress' });
    let order = 1;
    for (const [stageKey, status, owner] of [['Script', 'Approved', 'writer'], ['Shoot', 'Approved', 'shooter'], ['Edit', 'Feedback', 'editor']]) {
      steps[stageKey] = await WorkItem.create({ title: `P6d ${stageKey} ${salt}`, workType: 'Reel', stageKey, stageOrder: order++, status, reviewRequired: true, isLocked: false, contentPieceId: piece._id, departmentId: new mongoose.Types.ObjectId(), ownerId: people[owner]._id, deadline: new Date(Date.now() + 9 * 86400000), estimatedEffortHrs: 1, startedAt: new Date() });
    }
    await sub(steps.Script, 1, 'changes_requested', DRIVE('script-v1'));
    await sub(steps.Script, 2, 'approved', DRIVE('script-v2'));
    await sub(steps.Script, 3, 'submitted', DRIVE('script-v3-unreviewed'));
    await sub(steps.Shoot, 1, 'approved', DRIVE('shoot-v1'));
    await sub(steps.Edit, 1, 'submitted', DRIVE('edit-v1'));
  });

  afterAll(async () => {
    await Submission.deleteMany({ workItemId: { $in: Object.values(steps).map((w) => w._id) } });
    await WorkItem.deleteMany({ contentPieceId: piece._id });
    await ContentPiece.deleteMany({ _id: piece._id });
    await Person.deleteMany({ email: new RegExp(salt) });
  });

  const get = (who, id = piece._id) => request(app).get(`/api/content-pieces/${id}`).set(as(who));
  const outputOf = (body, stageKey) => body.workItems.find((w) => w.stageKey === stageKey).approvedOutput;

  describe('GET /api/content-pieces/:id', () => {
    it('a creative head gets every finished step with its latest approved output', async () => {
      const res = await get('head');
      expect(res.status).toBe(200);
      expect(res.body.workItems.map((w) => w.stageKey)).toEqual(['Script', 'Shoot', 'Edit']);
      expect(outputOf(res.body, 'Script')).toMatchObject({ version: 2, items: [{ url: DRIVE('script-v2'), kind: 'drive' }] });
      expect(outputOf(res.body, 'Shoot').items[0].url).toBe(DRIVE('shoot-v1'));
      expect(outputOf(res.body, 'Edit')).toBeNull();
      expect(JSON.stringify(res.body)).not.toMatch(/script-v1|script-v3|edit-v1/);
    });

    it('the executive can read it', async () => {
      expect((await get('exec')).status).toBe(200);
    });

    it('a participant sees earlier finished steps only', async () => {
      const editor = (await get('editor')).body;
      expect(outputOf(editor, 'Script').version).toBe(2);
      expect(outputOf(editor, 'Shoot')).not.toBeNull();
      const writer = (await get('writer')).body;
      expect(outputOf(writer, 'Script').version).toBe(2);
      expect(outputOf(writer, 'Shoot')).toBeNull();
    });

    it('returns the same 404 to a team member not on the piece, an unknown id and a bad id', async () => {
      const a = await get('outsider');
      const b = await get('head', new mongoose.Types.ObjectId());
      const c = await get('head', 'not-an-id');
      expect([a.status, b.status, c.status]).toEqual([404, 404, 404]);
    });
  });

  describe('Work Detail approved output', () => {
    const detail = async (who, w) => (await request(app).get(`/api/work-items/${w._id}`).set(as(who))).body.data;

    it('shows the approved version, not the latest submitted one', async () => {
      const item = await detail('head', steps.Script);
      expect(item.approvedOutput).toMatchObject({ version: 2, items: [{ url: DRIVE('script-v2') }] });
    });

    it('is empty for a step not approved yet', async () => {
      expect((await detail('head', steps.Edit)).approvedOutput).toBeNull();
    });

    it('a participant gets it for an earlier finished step, and not for a later one', async () => {
      expect((await detail('editor', steps.Script)).approvedOutput.version).toBe(2);
      expect((await detail('writer', steps.Shoot)).approvedOutput).toBeUndefined();
    });
  });
});
