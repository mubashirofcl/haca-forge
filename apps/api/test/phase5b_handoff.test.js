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
import { MediaItem } from '../src/modules/media/model.js';
import { ContentPiece } from '../src/modules/calendar/contentPiece.model.js';
import { Notification } from '../src/modules/notifications/model.js';
import { setWorkspacesLockedForTests } from '../src/lib/workspaceLock.js';

// These tests cover the workspace flows, which stay in the code behind the one switch
// (WORKSPACES_LOCKED). They run with it off, as the app will when it is unlocked.
setWorkspacesLockedForTests(false);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS = path.resolve(__dirname, '../uploads');
const tokenFor = (u) => jwt.sign({ userId: String(u._id), role: u.role }, env.JWT_SECRET, { expiresIn: '1h' });
const DRIVE = 'https://drive.google.com/file/d/handoff/view';

describe('Phase 5b: asset handoff', () => {
  const salt = `p5b-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  const people = {};
  const pieces = [];
  const files = {};
  const dept = new mongoose.Types.ObjectId();

  const make = (key, role) =>
    Person.create({ name: `P5b ${key}`, email: `${key}.${salt}@p5b.test`, role, status: 'active' }).then((p) => (people[key] = p));
  const put = (name) => {
    fs.mkdirSync(UPLOADS, { recursive: true });
    fs.writeFileSync(path.join(UPLOADS, `${salt}-${name}`), 'X');
    return `/uploads/${salt}-${name}`;
  };

  async function piece(contentType, stages) {
    const p = await ContentPiece.create({ planId: new mongoose.Types.ObjectId(), topic: `P5b ${contentType} ${salt}`, contentType, pipeline: contentType === 'Reel' ? 'reel_a' : 'design', postingDate: new Date(Date.now() + 9 * 86400000), status: 'In Progress' });
    pieces.push(p._id);
    const out = {};
    let order = 1;
    for (const [stageKey, status, owner] of stages) {
      out[stageKey] = await WorkItem.create({
        title: `P5b ${contentType} ${stageKey} ${salt}`,
        workType: contentType,
        stageKey,
        stageOrder: order++,
        status,
        isLocked: false,
        reviewRequired: stageKey !== 'Post',
        contentPieceId: p._id,
        departmentId: dept,
        ownerId: people[owner]._id,
        deadline: new Date(Date.now() + 9 * 86400000),
        estimatedEffortHrs: 1,
        startedAt: new Date(),
        approvedAt: ['Approved', 'Published'].includes(status) ? new Date() : null,
      });
    }
    return out;
  }
  const sub = (w, version, status, fields = {}) =>
    Submission.create({ workItemId: w._id, contentPieceId: w.contentPieceId, stageKey: w.stageKey, version, kind: fields.kind || 'video', status, submittedById: w.ownerId, submittedAt: new Date(), ...fields });
  const detail = (w, who) => request(app).get(`/api/work-items/${w._id}`).set('Authorization', `Bearer ${tokenFor(people[who])}`);
  const handoffOf = (res) => (res.body.data || res.body).handoff;
  const stagesOf = (handoff) => handoff.map((e) => e.stageKey);

  let reelA;
  let reelB;
  let reelC;
  let postable;
  let nonPostable;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) await mongoose.connect(env.MONGODB_URI);
    for (const [k, r] of [['writer', 'team_member'], ['shooter', 'team_member'], ['editor', 'team_member'], ['poster', 'team_member'], ['designer', 'team_member'], ['copy', 'team_member'], ['outsider', 'team_member'], ['head', 'creative_head'], ['sm', 'sm_manager'], ['exec', 'executive'], ['admin', 'admin']]) await make(k, r);
    files.cutV1 = put('cut-v1.mp4');
    files.cutV2 = put('cut-v2.mp4');
    files.clip = put('clip.mp4');
    files.slide = put('slide.png');

    // Reel A: Script -> Shoot -> Edit -> Post
    reelA = await piece('Reel', [['Script', 'Approved', 'writer'], ['Shoot', 'Approved', 'shooter'], ['Edit', 'Approved', 'editor'], ['Post', 'In Progress', 'poster']]);
    await sub(reelA.Script, 1, 'changes_requested', { kind: 'document', document: { htmlSnapshot: '<p>OLD SCRIPT</p>', metadata: { caption: 'old caption', hashtags: '#old' } } });
    await sub(reelA.Script, 2, 'approved', { kind: 'document', document: { htmlSnapshot: '<p>Final <b>script</b></p>', metadata: { caption: 'Big news', hashtags: '#haca #reel', shotList: [{ visual: 'Gate' }] } } });
    await MediaItem.create({ stageItemId: reelA.Shoot._id, url: files.clip, title: 'Approved upload clip', status: 'approved', order: 0 });
    await MediaItem.create({ stageItemId: reelA.Shoot._id, url: DRIVE, title: 'Approved Drive clip', status: 'approved', order: 1 });
    await MediaItem.create({ stageItemId: reelA.Shoot._id, url: put('rejected.mp4'), title: 'Rejected clip', status: 'reshoot_needed', order: 2 });
    await sub(reelA.Edit, 1, 'changes_requested', { files: [{ url: files.cutV1 }], fileUrl: files.cutV1 });
    await sub(reelA.Edit, 2, 'approved', { files: [{ url: files.cutV2, name: 'final.mp4' }], fileUrl: files.cutV2, linkUrl: files.cutV2 });

    // Reel B: Shoot -> Edit -> Post, with Edit still in review
    reelB = await piece('Reel', [['Shoot', 'Approved', 'shooter'], ['Edit', 'Feedback', 'editor'], ['Post', 'Not Started', 'poster']]);
    await MediaItem.create({ stageItemId: reelB.Shoot._id, url: files.clip, title: 'B clip', status: 'approved' });
    await sub(reelB.Edit, 1, 'submitted', { files: [{ url: files.cutV1 }] });

    // Reel C: Edit -> Post, Edit saved before Phase 5 with an external URL
    reelC = await piece('Reel', [['Edit', 'Approved', 'editor'], ['Post', 'In Progress', 'poster']]);
    await Submission.collection.insertOne({ workItemId: reelC.Edit._id, contentPieceId: reelC.Edit.contentPieceId, stageKey: 'Edit', version: 1, kind: 'video', status: 'approved', files: [{ url: 'https://cdn.example.com/legacy-cut.mp4' }, { url: 'javascript:alert(1)' }], fileUrl: 'https://cdn.example.com/legacy-cut.mp4', linkUrl: '', submittedById: people.editor._id, submittedAt: new Date(), createdAt: new Date(), updatedAt: new Date() });

    // Postable design: Content -> Design -> Post. Content is legacy: approved step, no version marked approved.
    postable = await piece('Static Post', [['Content', 'Approved', 'copy'], ['Design', 'Approved', 'designer'], ['Post', 'In Progress', 'poster']]);
    await sub(postable.Content, 1, 'submitted', { kind: 'document', document: { htmlSnapshot: '<p>Approved copy</p>', metadata: { caption: 'Design caption', hashtags: '#design' } } });
    await sub(postable.Design, 1, 'approved', { kind: 'image', files: [{ url: files.slide, name: 'slide 1' }, { url: DRIVE, name: 'slide 2' }] });

    // Non-postable design: Content -> Design (handover)
    nonPostable = await piece('Poster', [['Content', 'Approved', 'copy'], ['Design', 'Feedback', 'designer']]);
    await sub(nonPostable.Content, 1, 'approved', { kind: 'document', document: { htmlSnapshot: '<p>Poster copy</p>', metadata: {} } });
  });

  afterAll(async () => {
    for (const f of fs.readdirSync(UPLOADS).filter((n) => n.startsWith(salt))) {
      try { fs.unlinkSync(path.join(UPLOADS, f)); } catch {}
    }
    const items = await WorkItem.find({ contentPieceId: { $in: pieces } }).select('_id').lean();
    const ids = items.map((w) => w._id);
    await Rating.deleteMany({ workItemId: { $in: ids } });
    await Submission.deleteMany({ workItemId: { $in: ids } });
    await MediaItem.deleteMany({ stageItemId: { $in: ids } });
    await WorkItem.deleteMany({ _id: { $in: ids } });
    await ContentPiece.deleteMany({ _id: { $in: pieces } });
    await Notification.deleteMany({ recipient: { $in: Object.values(people).map((p) => p._id) } });
    await Person.deleteMany({ email: new RegExp(salt) });
  });

  describe('Reel A: Script -> Shoot -> Edit -> Post', () => {
    it('Post receives the final cut (latest approved only) and the approved clips, but no script caption', async () => {
      const res = await detail(reelA.Post, 'poster');
      expect(res.status).toBe(200);
      const handoff = handoffOf(res);
      expect(stagesOf(handoff)).toEqual(['Script', 'Shoot', 'Edit']);
      const script = handoff.find((e) => e.stageKey === 'Script');
      expect(script).toMatchObject({ version: 2 });
      // Captions are written by the poster on the Post step; a saved script caption is never handed over.
      expect(script.caption).toBeUndefined();
      expect(JSON.stringify(handoff)).not.toContain('Big news');
      expect(script.text).toContain('Final script');
      expect(JSON.stringify(handoff)).not.toMatch(/OLD SCRIPT|old caption/);
      const edit = handoff.find((e) => e.stageKey === 'Edit');
      expect(edit.version).toBe(2);
      expect(edit.items).toEqual([{ url: files.cutV2, name: 'final.mp4', kind: 'upload' }]);
      expect(JSON.stringify(handoff)).not.toContain(files.cutV1);
    });

    it('Edit receives the script and only the approved clips, upload and Drive', async () => {
      const handoff = handoffOf(await detail(reelA.Edit, 'editor'));
      expect(stagesOf(handoff)).toEqual(['Script', 'Shoot']);
      const clips = handoff.find((e) => e.stageKey === 'Shoot').clips;
      expect(clips.map((c) => [c.title, c.kind])).toEqual([['Approved upload clip', 'upload'], ['Approved Drive clip', 'drive']]);
    });

    it('Shoot receives the approved script and shot list only', async () => {
      const handoff = handoffOf(await detail(reelA.Shoot, 'shooter'));
      expect(stagesOf(handoff)).toEqual(['Script']);
      expect(handoff[0].shotList).toEqual([{ visual: 'Gate' }]);
    });

    it('an earlier worker never sees later steps', async () => {
      const handoff = handoffOf(await detail(reelA.Script, 'writer'));
      expect(handoff).toEqual([]);
    });

    it('a team member not on the piece gets 404', async () => {
      const res = await detail(reelA.Post, 'outsider');
      expect(res.status).toBe(404);
    });
  });

  it('Reel B: an Edit still in review is not handed to Post', async () => {
    const handoff = handoffOf(await detail(reelB.Post, 'poster'));
    expect(stagesOf(handoff)).toEqual(['Shoot']);
    expect(JSON.stringify(handoff)).not.toContain(files.cutV1);
  });

  it('Reel C: an existing external URL shows as a plain link; unsafe URLs are dropped', async () => {
    const res = await detail(reelC.Post, 'poster');
    expect(res.status).toBe(200);
    const edit = handoffOf(res).find((e) => e.stageKey === 'Edit');
    expect(edit.items).toEqual([{ url: 'https://cdn.example.com/legacy-cut.mp4', name: null, kind: 'link' }]);
  });

  describe('designs', () => {
    it('postable: Design receives the approved copy (no caption); a legacy Content step falls back to its latest version', async () => {
      const handoff = handoffOf(await detail(postable.Design, 'designer'));
      expect(stagesOf(handoff)).toEqual(['Content']);
      expect(handoff[0]).toMatchObject({ version: 1 });
      expect(handoff[0].caption).toBeUndefined();
      expect(handoff[0].text).toContain('Approved copy');
    });

    it('postable: Post receives every design file, upload and Drive', async () => {
      const handoff = handoffOf(await detail(postable.Post, 'poster'));
      const design = handoff.find((e) => e.stageKey === 'Design');
      expect(design.items.map((i) => i.kind)).toEqual(['upload', 'drive']);
      expect(JSON.stringify(handoff)).not.toContain('Design caption');
    });

    it('non-postable: approval notifies SM managers once, and the handover shows for SM, CH and admin only', async () => {
      const smBefore = await Notification.countDocuments({ recipient: people.sm._id, type: 'step_handover_ready' });
      const v1 = await sub(nonPostable.Design, 1, 'submitted', { kind: 'image', files: [{ url: files.slide }, { url: DRIVE }] });
      const res = await request(app).post(`/api/submissions/${v1._id}/approve`).set('Authorization', `Bearer ${tokenFor(people.head)}`).send({ score: 5 });
      expect(res.status).toBeLessThan(300);
      const notes = await Notification.find({ recipient: people.sm._id, type: 'step_handover_ready' }).lean();
      expect(notes.length - smBefore).toBe(1);
      expect(notes.at(-1).link).toBe(`/work/${nonPostable.Design._id}`);

      for (const who of ['sm', 'head', 'admin']) {
        const handover = (await detail(nonPostable.Design, who)).body.data.handover;
        expect(handover.items.map((i) => i.kind), who).toEqual(['upload', 'drive']);
      }
      for (const who of ['exec', 'designer']) {
        expect((await detail(nonPostable.Design, who)).body.data.handover, who).toBeUndefined();
      }
    });

    it('a failed approval sends no handover notification', async () => {
      const before = await Notification.countDocuments({ type: 'step_handover_ready', recipient: people.sm._id });
      await WorkItem.updateOne({ _id: nonPostable.Design._id }, { $set: { status: 'Feedback' } });
      const v2 = await sub(nonPostable.Design, 2, 'submitted', { kind: 'image', files: [{ url: files.slide }] });
      const bad = await request(app).post(`/api/submissions/${v2._id}/approve`).set('Authorization', `Bearer ${tokenFor(people.head)}`).send({ score: 9 });
      expect(bad.status).toBe(400);
      expect(await Notification.countDocuments({ type: 'step_handover_ready', recipient: people.sm._id })).toBe(before);
    });

    it('a reopened step approved again notifies again', async () => {
      const before = await Notification.countDocuments({ type: 'step_handover_ready', recipient: people.sm._id });
      const v2 = await Submission.findOne({ workItemId: nonPostable.Design._id, version: 2 });
      const ok = await request(app).post(`/api/submissions/${v2._id}/approve`).set('Authorization', `Bearer ${tokenFor(people.head)}`).send({ score: 4 });
      expect(ok.status).toBeLessThan(300);
      expect(await Notification.countDocuments({ type: 'step_handover_ready', recipient: people.sm._id })).toBe(before + 1);
    });

    it('approving a postable Design step sends no handover notification', async () => {
      const before = await Notification.countDocuments({ type: 'step_handover_ready' });
      const p = await piece('Carousel Post', [['Design', 'Feedback', 'designer'], ['Post', 'Not Started', 'poster']]);
      const v = await sub(p.Design, 1, 'submitted', { kind: 'image', files: [{ url: files.slide }] });
      const ok = await request(app).post(`/api/submissions/${v._id}/approve`).set('Authorization', `Bearer ${tokenFor(people.head)}`).send({ score: 5 });
      expect(ok.status).toBeLessThan(300);
      expect(await Notification.countDocuments({ type: 'step_handover_ready' })).toBe(before);
    });
  });

  describe('Script and Content submissions', () => {
    let script;
    let posterContent;

    beforeAll(async () => {
      const a = await piece('Reel', [['Script', 'In Progress', 'writer'], ['Shoot', 'Not Started', 'shooter']]);
      script = a.Script;
      const b = await piece('Poster', [['Content', 'In Progress', 'copy'], ['Design', 'Not Started', 'designer']]);
      posterContent = b.Content;
    });

    const submit = (w, who, body) => request(app).post(`/api/work/${w._id}/submit`).set('Authorization', `Bearer ${tokenFor(people[who])}`).send(body);

    it('a Drive link alone, with no caption, is accepted on a postable deliverable', async () => {
      const res = await submit(script, 'writer', { kind: 'document', linkUrl: DRIVE });
      expect(res.status).toBeLessThan(300);
      const v = await Submission.findOne({ workItemId: script._id, version: { $gt: 0 } }).sort({ version: -1 }).lean();
      expect(v.linkUrl).toBe(DRIVE);
    });

    it('a non-Drive link is refused', async () => {
      const p = await piece('Reel', [['Script', 'In Progress', 'writer']]);
      const res = await submit(p.Script, 'writer', { kind: 'document', linkUrl: 'https://dropbox.com/s/x' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_OUTPUT_URL');
    });

    it('Shoot receives the approved Drive link', async () => {
      const v = await Submission.findOne({ workItemId: script._id, version: { $gt: 0 } }).sort({ version: -1 });
      await Submission.updateOne({ _id: v._id }, { $set: { status: 'approved' } });
      await WorkItem.updateOne({ _id: script._id }, { $set: { status: 'Approved', approvedAt: new Date() } });
      const shoot = await WorkItem.findOne({ contentPieceId: script.contentPieceId, stageKey: 'Shoot' });
      const handoff = handoffOf(await detail(shoot, 'shooter'));
      expect(handoff[0].items).toEqual([{ url: DRIVE, name: null, kind: 'drive' }]);
    });

    it('a non-postable Content step submits a document', async () => {
      const res = await submit(posterContent, 'copy', { kind: 'document', document: { htmlSnapshot: '<p>Poster text</p>' } });
      expect(res.status).toBeLessThan(300);
    });

    it('a postable Script step submits through /transition with no caption', async () => {
      const p = await piece('Story', [['Script', 'In Progress', 'writer']]);
      const ok = await request(app).post(`/api/work-items/${p.Script._id}/transition`).set('Authorization', `Bearer ${tokenFor(people.writer)}`).send({ toStatus: 'Feedback' });
      expect(ok.status).toBeLessThan(300);
    });
  });
});
