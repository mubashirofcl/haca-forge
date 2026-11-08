import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { app } from '../src/server.js';
import { env } from '../src/config/env.js';
import { Person } from '../src/modules/people/model.js';
import { WorkItem } from '../src/modules/workItems/model.js';
import { Submission, Rating } from '../src/modules/submissions/model.js';
import { Blocker } from '../src/modules/blockers/model.js';
import { MediaItem } from '../src/modules/media/model.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS = path.resolve(__dirname, '../uploads');
const HOUR = 3600000;
const DAY = 24 * HOUR;
const tokenFor = (u) => jwt.sign({ userId: String(u._id), role: u.role }, env.JWT_SECRET, { expiresIn: '1h' });

describe('Phase 4e: reports and upload metadata', () => {
  const salt = `p4e-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  const dept = new mongoose.Types.ObjectId();
  const fewRatingsDept = new mongoose.Types.ObjectId();
  const otherDept = new mongoose.Types.ObjectId();
  const people = {};
  const steps = {};
  const files = [];
  let headToken;

  const make = (key, role, extra = {}) =>
    Person.create({ name: `P4e ${key} ${salt}`, email: `${key}.${salt}@p4e.test`, role, status: 'active', ...extra }).then((p) => (people[key] = p));

  const step = (key, fields) =>
    WorkItem.create({
      title: `P4e ${key} ${salt}`,
      workType: 'Reel',
      stageKey: 'Edit',
      stageOrder: 3,
      departmentId: dept,
      ownerId: people.worker._id,
      estimatedEffortHrs: 1,
      ...fields,
    }).then((w) => (steps[key] = w));

  const approvedWithRating = async (w, score, version = 1) => {
    const sub = await Submission.create({ workItemId: w._id, stageKey: w.stageKey, version, kind: 'video', status: 'approved', submittedById: people.worker._id, fileUrl: '/uploads/x.mp4' });
    await Rating.create({ submissionId: sub._id, workItemId: w._id, stageKey: w.stageKey, workerId: people.worker._id, raterId: people.head._id, score });
    return sub;
  };

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) await mongoose.connect(env.MONGODB_URI);
    await make('head', 'creative_head');
    await make('worker', 'team_member');
    await make('inactive', 'team_member', { status: 'suspended' });
    headToken = tokenFor(people.head);

    const due = new Date('2026-10-10T00:00:00Z');
    const now = Date.now();
    // On time by submission; 2h submitted round; decided 1h after submission.
    await step('onTime', { status: 'Approved', deadline: due, startedAt: new Date('2026-10-08T08:00:00Z'), submittedAt: new Date('2026-10-09T10:00:00Z'), decisionAt: new Date('2026-10-09T11:00:00Z'), approvedAt: new Date('2026-10-09T11:00:00Z'), rounds: [{ roundNumber: 1, startedAt: new Date('2026-10-09T08:00:00Z'), submittedAt: new Date('2026-10-09T10:00:00Z'), intervals: [] }] });
    // Late by submission; 1h of work (no rounds); decided 3h after submission.
    await step('late', { status: 'Approved', deadline: due, startedAt: new Date('2026-10-13T09:00:00Z'), submittedAt: new Date('2026-10-13T10:00:00Z'), decisionAt: new Date('2026-10-13T13:00:00Z'), approvedAt: new Date('2026-10-13T13:00:00Z') });
    // Finished with no recorded submit or post time: left out of on-time, not judged against today.
    await step('noTime', { status: 'Approved', deadline: due });
    // A post step, on time by its post time.
    await step('posted', { stageKey: 'Post', stageOrder: 4, status: 'Published', deadline: due, postedAt: new Date('2026-10-10T09:00:00Z') });
    // One submitted round of 1h, then a live round that must not count.
    await step('liveRound', { status: 'In Progress', deadline: new Date(now + 5 * DAY), startedAt: new Date(now - 10 * HOUR), rounds: [{ roundNumber: 1, startedAt: new Date(now - 10 * HOUR), submittedAt: new Date(now - 9 * HOUR), intervals: [] }, { roundNumber: 2, startedAt: new Date(now - 5 * HOUR), intervals: [] }] });
    // Only a live round: no work time yet.
    await step('liveOnly', { status: 'In Progress', deadline: new Date(now + 5 * DAY), startedAt: new Date(now - 3 * HOUR), rounds: [{ roundNumber: 1, startedAt: new Date(now - 3 * HOUR), intervals: [] }] });
    // Waiting for a decision: its approval wait is still growing, so it is left out.
    await step('pending', { status: 'Feedback', deadline: new Date(now + 5 * DAY), submittedAt: new Date(now - 2 * HOUR) });

    // Ratings: the onTime step's earlier version was rated 1, but only the latest approved counts.
    const early = await Submission.create({ workItemId: steps.onTime._id, stageKey: 'Edit', version: 1, kind: 'video', status: 'changes_requested', submittedById: people.worker._id, fileUrl: '/uploads/old.mp4' });
    await Rating.create({ submissionId: early._id, workItemId: steps.onTime._id, stageKey: 'Edit', workerId: people.worker._id, raterId: people.head._id, score: 1 });
    await approvedWithRating(steps.onTime, 5, 2);
    await approvedWithRating(steps.late, 4);
    await approvedWithRating(steps.posted, 3);

    // A department with only 2 rated steps: no average yet.
    for (const [i, score] of [[1, 5], [2, 4]]) {
      const w = await WorkItem.create({ title: `P4e few ${i} ${salt}`, workType: 'Reel', stageKey: 'Edit', stageOrder: 3, departmentId: fewRatingsDept, ownerId: people.worker._id, status: 'Approved', deadline: new Date('2026-10-10'), submittedAt: new Date('2026-10-09') });
      await approvedWithRating(w, score);
    }

    // Weekly report fixtures: an upcoming item and an active blocker in each department.
    await step('upcoming', { status: 'In Progress', deadline: new Date(now + 3 * DAY) });
    const otherItem = await WorkItem.create({ title: `P4e other ${salt}`, workType: 'Reel', stageKey: 'Edit', stageOrder: 3, departmentId: otherDept, ownerId: people.worker._id, status: 'Blocked', deadline: new Date(now + 3 * DAY) });
    await Blocker.create({ workItemId: steps.upcoming._id, blockedById: people.worker._id, reason: 'Other', status: 'Active', blockedAt: new Date() });
    await Blocker.create({ workItemId: otherItem._id, blockedById: people.worker._id, reason: 'Other', status: 'Active', blockedAt: new Date() });
  });

  afterAll(async () => {
    for (const f of files) {
      try { fs.unlinkSync(f); } catch {}
    }
    const items = await WorkItem.find({ title: new RegExp(salt) }).select('_id').lean();
    const ids = items.map((w) => w._id);
    await Rating.deleteMany({ workItemId: { $in: ids } });
    await Submission.deleteMany({ workItemId: { $in: ids } });
    await Blocker.deleteMany({ workItemId: { $in: ids } });
    await MediaItem.deleteMany({ title: new RegExp(salt) });
    await WorkItem.deleteMany({ _id: { $in: ids } });
    await Person.deleteMany({ _id: { $in: Object.values(people).map((p) => p._id) } });
  });

  describe('removed reports (Phase 7)', () => {
    it('the digest, weekly report, HTML export and /individual routes are gone', async () => {
      for (const p of [
        `/api/reports/view/team_performance?departmentId=${dept}`,
        `/api/reports/view/weekly_marketing?departmentId=${dept}`,
        '/api/reports/export?report=weekly_marketing&format=html',
        '/api/reports/individual',
        `/api/reports/individual/${people.worker._id}`,
      ]) {
        const res = await request(app).get(p).set('Authorization', `Bearer ${headToken}`);
        expect([p, res.status]).toEqual([p, 404]);
      }
    });
  });

  describe('upload metadata', () => {
    it('no longer attaches files to a submission', async () => {
      const sub = await Submission.create({ workItemId: steps.onTime._id, stageKey: 'Edit', version: 9, kind: 'video', status: 'submitted', submittedById: people.head._id, fileUrl: '/uploads/y.mp4' });
      const res = await request(app)
        .post('/api/uploads/metadata')
        .set('Authorization', `Bearer ${tokenFor(people.worker)}`)
        .send({ url: '/uploads/INJECTED.mp4', name: 'x', submissionId: String(sub._id) });
      expect(res.status).toBe(201);
      const after = await Submission.findById(sub._id).lean();
      expect(after.files || []).toHaveLength(0);
    });
  });

  describe('clip files', () => {
    let shoot;
    let shooterToken;

    const place = (name) => {
      const full = path.join(UPLOADS, name);
      fs.mkdirSync(UPLOADS, { recursive: true });
      fs.writeFileSync(full, 'CLIP');
      files.push(full);
      return `/uploads/${name}`;
    };

    beforeAll(async () => {
      await make('shooter', 'team_member');
      shooterToken = tokenFor(people.shooter);
      shoot = await WorkItem.create({ title: `P4e shoot ${salt}`, workType: 'Reel', stageKey: 'Shoot', stageOrder: 2, departmentId: dept, ownerId: people.shooter._id, status: 'In Progress', isLocked: false, deadline: new Date(Date.now() + 5 * DAY) });
    });

    it('deleting a clip removes its video and thumbnail files', async () => {
      const url = place(`${salt}-del.mp4`);
      const thumb = place(`${salt}-del.png`);
      const clip = await MediaItem.create({ stageItemId: shoot._id, url, thumbnailUrl: thumb, title: `P4e del ${salt}`, status: 'uploaded' });
      const res = await request(app).delete(`/api/clips/${clip._id}`).set('Authorization', `Bearer ${shooterToken}`);
      expect(res.status).toBe(200);
      expect(fs.existsSync(path.join(UPLOADS, `${salt}-del.mp4`))).toBe(false);
      expect(fs.existsSync(path.join(UPLOADS, `${salt}-del.png`))).toBe(false);
    });

    it('replacing a clip keeps the old file', async () => {
      const oldUrl = place(`${salt}-old.mp4`);
      const newUrl = place(`${salt}-new.mp4`);
      const clip = await MediaItem.create({ stageItemId: shoot._id, url: oldUrl, title: `P4e replace ${salt}`, status: 'uploaded' });
      const res = await request(app).post(`/api/clips/${clip._id}/replace`).set('Authorization', `Bearer ${shooterToken}`).send({ url: newUrl, title: `P4e replace ${salt}` });
      expect(res.status).toBeLessThan(300);
      expect(fs.existsSync(path.join(UPLOADS, `${salt}-old.mp4`))).toBe(true);
    });

    it('a file another clip still uses is kept', async () => {
      const shared = place(`${salt}-shared.mp4`);
      const a = await MediaItem.create({ stageItemId: shoot._id, url: shared, title: `P4e a ${salt}`, status: 'uploaded' });
      await MediaItem.create({ stageItemId: shoot._id, url: shared, title: `P4e b ${salt}`, status: 'uploaded' });
      await request(app).delete(`/api/clips/${a._id}`).set('Authorization', `Bearer ${shooterToken}`).expect(200);
      expect(fs.existsSync(path.join(UPLOADS, `${salt}-shared.mp4`))).toBe(true);
    });

    it('never touches a path outside the uploads folder', async () => {
      const outside = path.resolve(UPLOADS, '..', `${salt}-outside.txt`);
      fs.writeFileSync(outside, 'KEEP');
      files.push(outside);
      const clip = await MediaItem.create({ stageItemId: shoot._id, url: `/uploads/../${salt}-outside.txt`, title: `P4e trav ${salt}`, status: 'uploaded' });
      await request(app).delete(`/api/clips/${clip._id}`).set('Authorization', `Bearer ${shooterToken}`).expect(200);
      expect(fs.existsSync(outside)).toBe(true);
    });
  });
});
