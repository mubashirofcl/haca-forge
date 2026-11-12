import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { isDriveLink, isAppUploadPath, isAllowedOutputUrl } from '@mmp/shared';
import { app } from '../src/server.js';
import { env } from '../src/config/env.js';
import { Person } from '../src/modules/people/model.js';
import { WorkItem } from '../src/modules/workItems/model.js';
import { Submission } from '../src/modules/submissions/model.js';
import { MediaItem } from '../src/modules/media/model.js';
import { setWorkspacesLockedForTests } from '../src/lib/workspaceLock.js';

// These tests cover the workspace flows, which stay in the code behind the one switch
// (WORKSPACES_LOCKED). They run with it off, as the app will when it is unlocked.
setWorkspacesLockedForTests(false);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS = path.resolve(__dirname, '../uploads');
const tokenFor = (u) => jwt.sign({ userId: String(u._id), role: u.role }, env.JWT_SECRET, { expiresIn: '1h' });
const DRIVE = 'https://drive.google.com/file/d/abc123/view';
const DOCS = 'https://docs.google.com/document/d/xyz/edit';

const BAD = [
  'http://drive.google.com/file/d/a',
  'https://drive.google.com.evil.example/x',
  'https://evil.example/drive.google.com',
  'https://user:pw@drive.google.com/x',
  'https://drive.google.com:8443/x',
  'https://dropbox.com/s/x',
  'https://cdn.example.com/a.mp4',
  'javascript:alert(1)',
  'data:text/html,x',
  'blob:http://localhost/abc',
  '/uploads/../package.json',
  '/etc/passwd',
  'clip.mp4',
];

describe('Phase 5a: saved output URLs', () => {
  describe('shared rule', () => {
    it('accepts https Drive and Docs links and app upload paths', () => {
      for (const u of [DRIVE, DOCS, 'https://drive.google.com/drive/folders/f1']) expect(isDriveLink(u)).toBe(true);
      for (const u of ['/uploads/0f8c2a4e-1111-4222-8333-944455556666.mp4', '/uploads/avatar-x.png']) expect(isAppUploadPath(u)).toBe(true);
    });
    it('rejects everything else', () => {
      for (const u of BAD) expect(isAllowedOutputUrl(u)).toBe(false);
      for (const u of [null, undefined, 42, '']) expect(isAllowedOutputUrl(u)).toBe(false);
    });
  });

  describe('API save paths', () => {
    const salt = `p5a-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    const uploaded = `/uploads/${salt}.mp4`;
    const missing = `/uploads/${salt}-missing.mp4`;
    let owner;
    let ownerToken;
    let adminToken;
    const steps = {};

    const step = (key, stageKey, extra = {}) =>
      WorkItem.create({
        title: `P5a ${key} ${salt}`,
        workType: stageKey === 'Design' ? 'Static Post' : 'Reel',
        stageKey,
        stageOrder: 2,
        status: 'In Progress',
        isLocked: false,
        departmentId: new mongoose.Types.ObjectId(),
        ownerId: owner._id,
        startedAt: new Date(),
        deadline: new Date(Date.now() + 5 * 86400000),
        estimatedEffortHrs: 1,
        ...extra,
      }).then((w) => (steps[key] = w));

    beforeAll(async () => {
      if (mongoose.connection.readyState === 0) await mongoose.connect(env.MONGODB_URI);
      fs.mkdirSync(UPLOADS, { recursive: true });
      fs.writeFileSync(path.join(UPLOADS, `${salt}.mp4`), 'VIDEO');
      owner = await Person.create({ name: `P5a owner ${salt}`, email: `owner.${salt}@p5a.test`, role: 'team_member', status: 'active' });
      const admin = await Person.create({ name: `P5a admin ${salt}`, email: `admin.${salt}@p5a.test`, role: 'admin', status: 'active' });
      ownerToken = tokenFor(owner);
      adminToken = tokenFor(admin);
      for (const k of ['submit', 'draft', 'legacy', 'design', 'edit', 'shoot', 'patch', 'transition']) {
        await step(k, { design: 'Design', shoot: 'Shoot', submit: 'Edit', edit: 'Edit', transition: 'Edit' }[k] || 'Edit');
      }
    });

    afterAll(async () => {
      try { fs.unlinkSync(path.join(UPLOADS, `${salt}.mp4`)); } catch {}
      const ids = Object.values(steps).map((w) => w._id);
      await MediaItem.deleteMany({ stageItemId: { $in: ids } });
      await Submission.deleteMany({ workItemId: { $in: ids } });
      await WorkItem.deleteMany({ _id: { $in: ids } });
      await Person.deleteMany({ email: new RegExp(salt) });
    });

    const auth = (r) => r.set('Authorization', `Bearer ${ownerToken}`);

    it('submit rejects bad links and missing uploads, in files and linkUrl', async () => {
      for (const url of [...BAD, missing]) {
        const a = await auth(request(app).post(`/api/work/${steps.submit._id}/submit`)).send({ kind: 'video', files: [{ url, name: 'x' }] });
        expect(a.status, url).toBe(400);
        const b = await auth(request(app).post(`/api/work/${steps.submit._id}/submit`)).send({ kind: 'video', files: [{ url: uploaded }], linkUrl: url });
        expect(b.status, url).toBe(400);
      }
      expect(await Submission.countDocuments({ workItemId: steps.submit._id, version: { $gt: 0 } })).toBe(0);
    });

    it('submit accepts an upload or a Drive link', async () => {
      const res = await auth(request(app).post(`/api/work/${steps.submit._id}/submit`)).send({ kind: 'video', files: [{ url: uploaded, name: 'cut.mp4' }] });
      expect(res.status).toBeLessThan(300);
      const res2 = await auth(request(app).post(`/api/work/${steps.edit._id}/submit`)).send({ kind: 'video', files: [{ url: DRIVE, name: 'cut' }] });
      expect(res2.status).toBeLessThan(300);
    });

    it('draft save rejects bad links and keeps good ones', async () => {
      const bad = await auth(request(app).put(`/api/work/${steps.draft._id}/draft`)).send({ files: [{ url: 'https://cdn.example.com/a.mp4' }] });
      expect(bad.status).toBe(400);
      const badLink = await auth(request(app).put(`/api/work/${steps.draft._id}/draft`)).send({ linkUrl: 'javascript:alert(1)' });
      expect(badLink.status).toBe(400);
      const good = await auth(request(app).put(`/api/work/${steps.draft._id}/draft`)).send({ files: [{ url: DRIVE }], linkUrl: DOCS });
      expect(good.status).toBe(200);
    });

    it('POST /api/submissions keeps every design slide and never copies a local path into linkUrl', async () => {
      const res = await auth(request(app).post('/api/submissions')).send({
        workItemId: String(steps.design._id),
        fileUrl: uploaded,
        contentUrl: uploaded,
        metadata: { carouselSlides: [uploaded, DRIVE, uploaded] },
      });
      expect(res.status).toBe(201);
      const sub = await Submission.findOne({ workItemId: steps.design._id, version: { $gt: 0 } }).lean();
      expect(sub.files.map((f) => f.url)).toEqual([uploaded, DRIVE, uploaded]);
      expect(sub.linkUrl || '').toBe('');
    });

    it('POST /api/submissions rejects a non-Drive link and keeps a separate Drive link', async () => {
      const bad = await auth(request(app).post('/api/submissions')).send({ workItemId: String(steps.legacy._id), fileUrl: 'https://figma.com/file/x' });
      expect(bad.status).toBe(400);
      expect(bad.body.error.code).toBe('INVALID_OUTPUT_URL');
      const ok = await auth(request(app).post('/api/submissions')).send({ workItemId: String(steps.legacy._id), fileUrl: uploaded, contentUrl: DOCS });
      expect(ok.status).toBe(201);
      const sub = await Submission.findOne({ workItemId: steps.legacy._id, version: { $gt: 0 } }).lean();
      expect(sub.files.map((f) => f.url)).toEqual([uploaded]);
      expect(sub.linkUrl).toBe(DOCS);
    });

    it('clips: create and replace accept uploads and Drive links only; thumbnails must be uploads', async () => {
      for (const url of [...BAD, missing]) {
        const r = await auth(request(app).post(`/api/work/${steps.shoot._id}/clips`)).send({ url, title: 'bad', kind: 'video' });
        expect(r.status, url).toBe(400);
      }
      const thumb = await auth(request(app).post(`/api/work/${steps.shoot._id}/clips`)).send({ url: DRIVE, thumbnailUrl: DRIVE, title: 'drive thumb', kind: 'video' });
      expect(thumb.status).toBe(400);
      const drive = await auth(request(app).post(`/api/work/${steps.shoot._id}/clips`)).send({ url: DRIVE, title: 'Drive clip', kind: 'video' });
      expect(drive.status).toBe(201);
      const up = await auth(request(app).post(`/api/work/${steps.shoot._id}/clips`)).send({ url: uploaded, title: 'Uploaded clip', kind: 'video' });
      expect(up.status).toBe(201);
      const clipId = (up.body.data || up.body)._id;
      const badReplace = await auth(request(app).post(`/api/clips/${clipId}/replace`)).send({ url: 'https://cdn.example.com/x.mp4' });
      expect(badReplace.status).toBe(400);
      const goodReplace = await auth(request(app).post(`/api/clips/${clipId}/replace`)).send({ url: DOCS });
      expect(goodReplace.status).toBeLessThan(300);
    });

    it('PATCH deliverableUrl: new values are checked, an existing legacy value may be re-sent', async () => {
      await WorkItem.updateOne({ _id: steps.patch._id }, { $set: { deliverableUrl: 'https://cdn.example.com/legacy.mp4' } });
      const same = await auth(request(app).patch(`/api/work-items/${steps.patch._id}`)).send({ deliverableUrl: 'https://cdn.example.com/legacy.mp4' });
      expect(same.status).toBe(200);
      const bad = await auth(request(app).patch(`/api/work-items/${steps.patch._id}`)).send({ deliverableUrl: 'https://cdn.example.com/other.mp4' });
      expect(bad.status).toBe(400);
      const good = await auth(request(app).patch(`/api/work-items/${steps.patch._id}`)).send({ deliverableUrl: DRIVE });
      expect(good.status).toBe(200);
    });

    it('a transition with a bad new deliverable link changes nothing', async () => {
      const res = await request(app)
        .post(`/api/work-items/${steps.transition._id}/transition`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ toStatus: 'Blocked', blockerReason: 'Other', blockerNote: 'x', deliverableUrl: 'javascript:alert(1)' });
      expect(res.status).toBe(400);
      const after = await WorkItem.findById(steps.transition._id).lean();
      expect(after.status).toBe('In Progress');
    });
  });
});
