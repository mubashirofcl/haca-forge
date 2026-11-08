import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { normalizePriority, parsePriorityInput, compareUrgentThenDue, PRIORITIES } from '@mmp/shared';
import { app } from '../src/server.js';
import { env } from '../src/config/env.js';
import { Person } from '../src/modules/people/model.js';
import { WorkItem } from '../src/modules/workItems/model.js';
import { ContentPiece } from '../src/modules/calendar/contentPiece.model.js';
import { Notification } from '../src/modules/notifications/model.js';
import { RevisionFlag } from '../src/modules/feedback/model.js';
import { executeAutomationRule } from '../src/modules/automation/runner.js';
import { checkAndCreateRevisionFlag } from '../src/modules/feedback/service.js';
import { validateImportRows } from '../src/modules/calendar/import.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tokenFor = (u) => jwt.sign({ userId: String(u._id), role: u.role }, env.JWT_SECRET, { expiresIn: '1h' });
const DAY = 86400000;
const ago = (n) => new Date(Date.now() - n * DAY);

describe('Phase 7 close-out', () => {
  const salt = `p7h-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  const people = {};
  const items = {};
  const pieces = [];
  const dept = new mongoose.Types.ObjectId();
  const noSmDept = new mongoose.Types.ObjectId();

  const make = (key, role, extra = {}) =>
    Person.create({ name: `P7h ${key} ${salt}`, email: `${key}.${salt}@p7h.test`, role, status: 'active', ...extra }).then((p) => (people[key] = p));
  const as = (who) => ({ Authorization: `Bearer ${tokenFor(people[who])}` });
  const step = (key, fields) =>
    WorkItem.create({
      title: `P7h ${key} ${salt}`, workType: 'Reel', stageKey: 'Script', stageOrder: 1, reviewRequired: true, isLocked: false,
      departmentId: dept, estimatedEffortHrs: 1, ownerId: people.worker._id, status: 'In Progress', priority: 'Normal',
      deadline: new Date(Date.now() + 10 * DAY), ...fields,
    }).then((w) => (items[key] = w));

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) await mongoose.connect(env.MONGODB_URI);
    await make('worker', 'team_member', { departmentId: dept });
    await make('sm', 'sm_manager', { departmentId: dept });
    await make('head', 'creative_head');
    await make('admin', 'admin');
  });

  afterAll(async () => {
    const ids = Object.values(items).map((w) => w._id);
    await Notification.deleteMany({ 'metadata.workItemId': { $in: ids } });
    await RevisionFlag.deleteMany({ workItemId: { $in: ids } });
    await WorkItem.deleteMany({ $or: [{ _id: { $in: ids } }, { title: new RegExp(salt) }] });
    await ContentPiece.deleteMany({ _id: { $in: pieces } });
    await Person.deleteMany({ email: new RegExp(salt) });
  });

  describe('1. Overdue notice', () => {
    const notes = (w, type) => Notification.find({ 'metadata.workItemId': w._id, 'metadata.type': type }).lean();

    beforeAll(async () => {
      await step('overdue', { deadline: ago(2), dueDate: ago(2), unlockedAt: ago(5) });
      await step('locked', { status: 'Not Started', isLocked: true, deadline: ago(3), dueDate: ago(3) });
      await step('dueToday', { deadline: new Date(), dueDate: new Date(), unlockedAt: ago(2) });
      await step('noSmDept', { departmentId: noSmDept, deadline: ago(1), dueDate: ago(1), unlockedAt: ago(4) });
      await executeAutomationRule('overdue_escalation', null, { force: true });
    });

    it('is sent once to the owner and once to the step department\'s SM manager', async () => {
      const owner = await notes(items.overdue, 'overdue_owner');
      const manager = await notes(items.overdue, 'overdue_manager');
      expect(owner.map((n) => String(n.recipient))).toEqual([String(people.worker._id)]);
      expect(manager.map((n) => String(n.recipient))).toEqual([String(people.sm._id)]);
      expect(owner[0].metadata.dueDay).toBe(manager[0].metadata.dueDay);
    });

    it('a department without an SM manager notifies an active SM manager', async () => {
      const manager = await notes(items.noSmDept, 'overdue_manager');
      expect(manager).toHaveLength(1);
      const recipient = await Person.findById(manager[0].recipient).lean();
      expect(recipient.role).toBe('sm_manager');
    });

    it('is not sent for a locked step or a step due today (IST day)', async () => {
      for (const key of ['locked', 'dueToday']) {
        expect(await notes(items[key], 'overdue_owner')).toHaveLength(0);
        expect(await notes(items[key], 'overdue_manager')).toHaveLength(0);
      }
    });

    it('never repeats, and has no hour-based escalation', async () => {
      const result = await executeAutomationRule('overdue_escalation', null, { force: true });
      await executeAutomationRule('overdue_escalation', null, { force: true });
      expect(await notes(items.overdue, 'overdue_owner')).toHaveLength(1);
      expect(await notes(items.overdue, 'overdue_manager')).toHaveLength(1);
      expect(result).not.toHaveProperty('leadEscalated');
      expect(await Notification.countDocuments({ 'metadata.workItemId': items.overdue._id, 'metadata.type': 'overdue_lead_escalation' })).toBe(0);
      const source = fs.readFileSync(path.resolve(__dirname, '../src/modules/automation/runner.js'), 'utf8');
      expect(source).not.toMatch(/leadEscalationHours|hoursOverdue/);
    });
  });

  describe('2. Revision flag', () => {
    it('is raised when a step reaches round 4, not before', async () => {
      const r3 = await step('round3', { revisions: 2 });
      const r4 = await step('round4', { revisions: 3 });
      expect(await checkAndCreateRevisionFlag(r3.toObject())).toBeNull();
      const flag = await checkAndCreateRevisionFlag(r4.toObject());
      expect(flag).toBeTruthy();
      expect(String(flag.workItemId)).toBe(String(r4._id));
    });

    it("does not compare a step's revisions with the worker's own average", async () => {
      const source = fs.readFileSync(path.resolve(__dirname, '../src/modules/feedback/service.js'), 'utf8');
      expect(source).not.toMatch(/calculateMemberWorkloadMetrics|baselineAvg \+ 1/);
      const note = await Notification.findOne({ type: 'revision.flagged', 'metadata.workItemId': items.round4._id }).lean();
      expect(note.message).not.toMatch(/baseline/i);
    });

    it('the Dashboard lists flags by project and step, never by person', async () => {
      const mk = (topic) => ContentPiece.create({ planId: new mongoose.Types.ObjectId(), topic: `${topic} ${salt}`, contentType: 'Reel', pipeline: 'reel_a', postingDate: new Date(), status: 'In Progress' }).then((p) => (pieces.push(p._id), p));
      const zeta = await mk('Zeta project');
      const alpha = await mk('Alpha project');
      const zStep = await step('flagZ', { revisions: 3, contentPieceId: zeta._id, stageKey: 'Edit', stageOrder: 3 });
      const aStep = await step('flagA', { revisions: 3, contentPieceId: alpha._id, stageKey: 'Shoot', stageOrder: 2, ownerId: people.sm._id });
      await checkAndCreateRevisionFlag(zStep.toObject());
      await checkAndCreateRevisionFlag(aStep.toObject());
      const res = await request(app).get('/api/dashboard/overview').set(as('head'));
      expect(res.status).toBe(200);
      const flags = (res.body.data.issues.revisionFlags || []).filter((f) => String(f.project).includes(salt) && /^(Alpha|Zeta) project/.test(f.project));
      expect(flags.map((f) => [f.project.split(' ')[0], f.stepType])).toEqual([['Alpha', 'Shoot'], ['Zeta', 'Edit']]);
      for (const f of flags) expect(Object.keys(f).filter((k) => /count|group|rank/i.test(k) && k !== 'revisionsCount')).toEqual([]);
      const issueKeys = Object.keys(res.body.data.issues);
      expect(issueKeys.some((k) => /person|owner|worker|member/i.test(k))).toBe(false);
    });
  });

  describe('3. Priority', () => {
    const create = (body) =>
      request(app).post('/api/work-items').set(as('admin')).send({ title: `P7h create ${salt}`, workType: 'Reel', deadline: new Date(Date.now() + 5 * DAY).toISOString(), departmentId: String(dept), ...body });

    it('only Normal and Urgent are accepted', async () => {
      expect(PRIORITIES).toEqual(['Normal', 'Urgent']);
      for (const p of ['Low', 'Medium', 'High', 'Critical']) expect((await create({ priority: p })).status).toBe(400);
      expect((await create({ priority: 'Urgent' })).body.data.priority).toBe('Urgent');
      expect(parsePriorityInput('urgent')).toBe('Urgent');
      expect(parsePriorityInput('High')).toBeNull();
      expect(parsePriorityInput('')).toBeUndefined();
    });

    it('defaults to Normal on every creation path', async () => {
      expect((await create({})).body.data.priority).toBe('Normal');
      const rows = await validateImportRows([{ rowIndex: 2, topic: `P7h import ${salt}`, contentType: 'Static Post', postingDate: new Date(Date.now() + 9 * DAY).toISOString().slice(0, 10) }]);
      expect(rows.rows[0].priority).toBe('Normal');
    });

    it('the Excel upload rejects Low, Medium and High', async () => {
      const rows = await validateImportRows([{ rowIndex: 2, topic: `P7h import2 ${salt}`, contentType: 'Static Post', postingDate: new Date(Date.now() + 9 * DAY).toISOString().slice(0, 10), priority: 'High' }]);
      expect(rows.rows[0].errors.join(' ')).toMatch(/Priority must be Normal or Urgent/);
    });

    it('an existing Low/Medium/High record is left unchanged and shown as Normal', async () => {
      const legacy = await step('legacy', { deadline: new Date(Date.now() + 3 * DAY) });
      await WorkItem.collection.updateOne({ _id: legacy._id }, { $set: { priority: 'High' } });
      expect(normalizePriority('High')).toBe('Normal');
      expect(normalizePriority('Low')).toBe('Normal');
      // Editing another field keeps the stored value.
      const res = await request(app).patch(`/api/work-items/${legacy._id}`).set(as('admin')).send({ title: `P7h legacy edited ${salt}` });
      expect(res.status).toBe(200);
      expect((await WorkItem.collection.findOne({ _id: legacy._id })).priority).toBe('High');
      // Setting an old value is refused.
      expect((await request(app).patch(`/api/work-items/${legacy._id}`).set(as('admin')).send({ priority: 'Low' })).status).toBe(400);
    });

    it('Urgent sorts first, then by due date, in Work Items and My Work', async () => {
      await step('sortNormalEarly', { deadline: new Date(Date.now() + 1 * DAY), dueDate: new Date(Date.now() + 1 * DAY), unlockedAt: ago(1) });
      await step('sortUrgentLate', { priority: 'Urgent', deadline: new Date(Date.now() + 4 * DAY), dueDate: new Date(Date.now() + 4 * DAY), unlockedAt: ago(1) });
      await step('sortUrgentEarly', { priority: 'Urgent', deadline: new Date(Date.now() + 2 * DAY), dueDate: new Date(Date.now() + 2 * DAY), unlockedAt: ago(1) });
      await WorkItem.collection.updateOne({ _id: items.sortNormalEarly._id }, { $set: { priority: 'High' } }); // shown and sorted as Normal
      const list = await request(app).get(`/api/work-items?search=${encodeURIComponent('sort')}`).set(as('head'));
      const order = list.body.data.filter((w) => w.title.includes(salt)).map((w) => w.title.split(' ')[1]);
      expect(order).toEqual(['sortUrgentEarly', 'sortUrgentLate', 'sortNormalEarly']);
      const mine = await request(app).get('/api/work-items/my-work').set(as('worker'));
      const thisWeek = mine.body.data.thisWeek.filter((w) => w.title.includes('sort')).map((w) => w.title.split(' ')[1]);
      expect(thisWeek).toEqual(['sortUrgentEarly', 'sortUrgentLate', 'sortNormalEarly']);
      expect([{ priority: 'Normal', deadline: '2026-01-01' }, { priority: 'Urgent', deadline: '2026-02-01' }].sort(compareUrgentThenDue)[0].priority).toBe('Urgent');
    });
  });
});
