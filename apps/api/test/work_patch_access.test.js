import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/server.js';
import { env } from '../src/config/env.js';
import { connectDB } from '../src/config/db.js';
import { Person } from '../src/modules/people/model.js';
import { WorkItem } from '../src/modules/workItems/model.js';
import { ActivityEvent } from '../src/modules/activity/model.js';

const TITLE = 'PatchAccess step';
const DUE = new Date('2031-05-10T00:00:00.000Z');
const NEW_DUE = '2031-06-20T00:00:00.000Z';
const ROLES = {
  admin: 'admin',
  sm: 'sm_manager',
  head: 'creative_head',
  exec: 'executive',
  owner: 'team_member',
  teammate: 'team_member',
  outsider: 'team_member',
  headOwner: 'creative_head',
};
const EMAIL = (key) => `patch.access.${key.toLowerCase()}@example.com`;

// Every path the route is mounted on.
describe.each(['/api/work', '/api/work-items'])('PATCH %s/:id access', (base) => {
  const people = {};
  const pieceId = new mongoose.Types.ObjectId();
  let step;

  const tokenFor = (key) =>
    jwt.sign({ userId: people[key]._id.toString(), email: people[key].email, role: people[key].role }, env.JWT_SECRET, { expiresIn: '1h' });
  const patch = (key, body, id = step._id) => request(app).patch(`${base}/${id}`).set('Authorization', `Bearer ${tokenFor(key)}`).send(body);
  const stored = () => WorkItem.findById(step._id).lean();
  const makeStep = (extra = {}) =>
    WorkItem.create({
      title: TITLE,
      workType: 'Reel',
      contentPieceId: pieceId,
      stageKey: 'Edit',
      stageOrder: 2,
      status: 'In Progress',
      isLocked: false,
      ownerId: people.owner._id,
      deadline: DUE,
      dueDate: DUE,
      priority: 'Urgent',
      estimatedEffortHrs: 7,
      departmentId: new mongoose.Types.ObjectId(),
      profileId: new mongoose.Types.ObjectId(),
      ...extra,
    });

  const clearSteps = async () => {
    const ids = (await WorkItem.find({ title: new RegExp(`^${TITLE}`) }).select('_id').lean()).map((s) => s._id);
    await ActivityEvent.deleteMany({ entityId: { $in: ids } });
    await WorkItem.deleteMany({ _id: { $in: ids } });
  };

  const removeLeftovers = async () => {
    await clearSteps();
    await Person.deleteMany({ email: { $in: Object.keys(ROLES).map(EMAIL) } });
  };

  beforeAll(async () => {
    await connectDB();
    await removeLeftovers();
    for (const [key, role] of Object.entries(ROLES)) {
      people[key] = await Person.create({ name: `Patch ${key}`, email: EMAIL(key), role, status: 'active' });
    }
  });

  beforeEach(async () => {
    await clearSteps();
    step = await makeStep();
    // The teammate is on the deliverable because they own another step of the same piece.
    await makeStep({ stageKey: 'Script', stageOrder: 1, ownerId: people.teammate._id, title: `${TITLE} sibling` });
  });

  afterAll(removeLeftovers);

  const MANAGEMENT_FIELDS = {
    title: 'Changed title',
    workType: 'Poster',
    priority: 'Normal',
    estimatedEffortHrs: 3,
    ownerId: new mongoose.Types.ObjectId().toString(),
    deadline: NEW_DUE,
    isSkipped: true,
    departmentId: new mongoose.Types.ObjectId().toString(),
    description: 'Changed',
    publishedUrl: 'https://example.test/live',
    contentLink: 'https://example.test/content',
    assetsLink: 'https://example.test/assets',
    brief: { description: 'Changed' },
    contentPieceId: new mongoose.Types.ObjectId().toString(),
    stageKey: 'Post',
    stageOrder: 9,
    reviewRequired: true,
    unlockedAt: NEW_DUE,
  };

  describe('admin and sm_manager keep full access', () => {
    it.each(['admin', 'sm'])('%s can edit management fields on a step they do not own', async (key) => {
      const res = await patch(key, { title: 'Managed title', priority: 'Normal', estimatedEffortHrs: 3, isSkipped: true });
      expect(res.status).toBe(200);
      const after = await stored();
      expect(after).toMatchObject({ title: 'Managed title', priority: 'Normal', estimatedEffortHrs: 3, isSkipped: true });
    });

    it.each(['admin', 'sm'])('%s can change the owner and the deliverable link after approval', async (key) => {
      await WorkItem.updateOne({ _id: step._id }, { status: 'Approved' });
      const res = await patch(key, { ownerId: people.teammate._id.toString(), deliverableUrl: 'https://example.test/managed' });
      expect(res.status).toBe(200);
      const after = await stored();
      expect(String(after.ownerId)).toBe(String(people.teammate._id));
      expect(after.deliverableUrl).toBe('https://example.test/managed');
    });
  });

  describe('executive stays read-only', () => {
    it.each(Object.keys(MANAGEMENT_FIELDS))('403 and unchanged for %s', async (field) => {
      const before = await stored();
      const res = await patch('exec', { [field]: MANAGEMENT_FIELDS[field] });
      expect(res.status).toBe(403);
      expect((await stored()).updatedAt).toEqual(before.updatedAt);
    });

    it('403 for the deliverable link too', async () => {
      expect((await patch('exec', { deliverableUrl: 'https://example.test/x' })).status).toBe(403);
    });
  });

  describe('creative_head has no management access', () => {
    it.each(Object.keys(MANAGEMENT_FIELDS))('403 and unchanged for %s', async (field) => {
      const before = await stored();
      const res = await patch('head', { [field]: MANAGEMENT_FIELDS[field] });
      expect(res.status).toBe(403);
      expect((await stored()).updatedAt).toEqual(before.updatedAt);
    });

    it('403 for the deliverable link on a step they do not own', async () => {
      expect((await patch('head', { deliverableUrl: 'https://example.test/x' })).status).toBe(403);
    });

    it('gets the same owner access as anyone on a step they own', async () => {
      await WorkItem.updateOne({ _id: step._id }, { ownerId: people.headOwner._id });
      expect((await patch('headOwner', { deliverableUrl: 'https://example.test/head' })).status).toBe(200);
      expect((await stored()).deliverableUrl).toBe('https://example.test/head');
      expect((await patch('headOwner', { priority: 'Normal' })).status).toBe(403);
    });
  });

  describe('the step owner keeps the deliverable flow only', () => {
    it('can set the deliverable link while the step is awaiting review', async () => {
      await WorkItem.updateOne({ _id: step._id }, { status: 'Feedback' });
      const res = await patch('owner', { deliverableUrl: 'https://example.test/cut' });
      expect(res.status).toBe(200);
      expect((await stored()).deliverableUrl).toBe('https://example.test/cut');
    });

    it('an empty body from the deliverable flow still succeeds and changes nothing', async () => {
      const res = await patch('owner', {});
      expect(res.status).toBe(200);
      expect((await stored()).priority).toBe('Urgent');
    });

    it.each(['owner', 'sm', 'admin'])('an empty PATCH from %s saves nothing and logs no update event', async (key) => {
      const before = await stored();
      const eventsBefore = await ActivityEvent.countDocuments({ entityId: step._id, action: 'work_item.updated' });
      const res = await patch(key, {});
      expect(res.status).toBe(200);
      expect(String(res.body.data._id)).toBe(String(step._id));
      expect((await stored()).updatedAt).toEqual(before.updatedAt);
      expect(await ActivityEvent.countDocuments({ entityId: step._id, action: 'work_item.updated' })).toBe(eventsBefore);
    });

    it('a real change does log an update event', async () => {
      expect((await patch('owner', { deliverableUrl: 'https://example.test/cut' })).status).toBe(200);
      expect(await ActivityEvent.countDocuments({ entityId: step._id, action: 'work_item.updated' })).toBe(1);
    });

    it.each(['Approved', 'Published'])('cannot change the link once the step is %s', async (status) => {
      await WorkItem.updateOne({ _id: step._id }, { status, deliverableUrl: 'https://example.test/final' });
      const res = await patch('owner', { deliverableUrl: 'https://example.test/swapped' });
      expect(res.status).toBe(403);
      expect((await stored()).deliverableUrl).toBe('https://example.test/final');
    });

    it.each(Object.keys(MANAGEMENT_FIELDS))('403 and unchanged for %s', async (field) => {
      const before = await stored();
      const res = await patch('owner', { [field]: MANAGEMENT_FIELDS[field] });
      expect(res.status).toBe(403);
      expect((await stored()).updatedAt).toEqual(before.updatedAt);
    });

    it('a restricted field alongside the link rejects the whole request', async () => {
      const res = await patch('owner', { deliverableUrl: 'https://example.test/cut', priority: 'Normal' });
      expect(res.status).toBe(403);
      const after = await stored();
      expect(after.deliverableUrl || '').toBe('');
      expect(after.priority).toBe('Urgent');
    });
  });

  describe('team_member on the same piece but not this step gets 403', () => {
    it.each(['deliverableUrl', ...Object.keys(MANAGEMENT_FIELDS)])('403 and unchanged for %s', async (field) => {
      const before = await stored();
      const res = await patch('teammate', { [field]: MANAGEMENT_FIELDS[field] || 'https://example.test/x' });
      expect(res.status).toBe(403);
      expect((await stored()).updatedAt).toEqual(before.updatedAt);
    });
  });

  describe('team_member not on the deliverable gets 404', () => {
    it.each(['deliverableUrl', ...Object.keys(MANAGEMENT_FIELDS)])('404 and unchanged for %s', async (field) => {
      const before = await stored();
      const res = await patch('outsider', { [field]: MANAGEMENT_FIELDS[field] || 'https://example.test/x' });
      expect(res.status).toBe(404);
      expect((await stored()).updatedAt).toEqual(before.updatedAt);
    });

    it('a non-participant item, a missing item and an invalid id give an identical response', async () => {
      const body = { title: 'Nope' };
      const nonParticipant = await patch('outsider', body);
      const missing = await patch('outsider', body, new mongoose.Types.ObjectId());
      const invalid = await patch('outsider', body, 'not-an-id');
      expect(nonParticipant.status).toBe(404);
      expect(missing.status).toBe(404);
      expect(invalid.status).toBe(404);
      expect(missing.body).toEqual(nonParticipant.body);
      expect(invalid.body).toEqual(nonParticipant.body);
    });

    it('a body that would fail validation still gets 404, not a validation error', async () => {
      const res = await patch('outsider', { title: 'x', estimatedEffortHrs: -5 });
      expect(res.status).toBe(404);
    });

    it('owner values in the request are ignored: ownership comes from the stored step', async () => {
      const res = await patch('outsider', { ownerId: people.outsider._id.toString(), owner: people.outsider._id.toString() });
      expect(res.status).toBe(404);
      expect(String((await stored()).ownerId)).toBe(String(people.owner._id));
    });

    it('a step with no owner and no piece is not on anyone\'s deliverable', async () => {
      const lone = await makeStep({ ownerId: null, contentPieceId: null, title: `${TITLE} lone` });
      expect((await patch('outsider', { title: 'Nope' }, lone._id)).status).toBe(404);
    });
  });

  describe('deadline and dueDate', () => {
    it('a deadline change moves deadline, dueDate and dueDateSource together', async () => {
      const res = await patch('sm', { deadline: NEW_DUE });
      expect(res.status).toBe(200);
      const after = await stored();
      expect(after.deadline.toISOString()).toBe(NEW_DUE);
      expect(after.dueDate.toISOString()).toBe(NEW_DUE);
      expect(after.dueDateSource).toBe('manual');
    });

    it('a PATCH without a deadline leaves all three alone', async () => {
      await WorkItem.updateOne({ _id: step._id }, { dueDateSource: 'auto' });
      expect((await patch('sm', { title: 'No date change' })).status).toBe(200);
      const after = await stored();
      expect(after.deadline.toISOString()).toBe(DUE.toISOString());
      expect(after.dueDate.toISOString()).toBe(DUE.toISOString());
      expect(after.dueDateSource).toBe('auto');
    });

    it("the owner's deliverable update leaves the dates alone", async () => {
      expect((await patch('owner', { deliverableUrl: 'https://example.test/cut' })).status).toBe(200);
      const after = await stored();
      expect(after.dueDate.toISOString()).toBe(DUE.toISOString());
      expect(after.dueDateSource ?? null).toBeNull();
    });
  });
});
