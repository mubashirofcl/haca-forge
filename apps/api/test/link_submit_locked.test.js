import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import {
  WORKSPACES_LOCKED,
  getAvailableActions,
  isLivePostUrl,
  reworkTimeMs,
  stepReviewState,
} from '@mmp/shared';
import { app } from '../src/server.js';
import { env } from '../src/config/env.js';
import { Person } from '../src/modules/people/model.js';
import { WorkItem } from '../src/modules/workItems/model.js';
import { Submission, Rating, SubmissionComment } from '../src/modules/submissions/model.js';
import { MediaItem } from '../src/modules/media/model.js';
import { ContentPiece } from '../src/modules/calendar/contentPiece.model.js';
import { Notification } from '../src/modules/notifications/model.js';
import { FeedbackEntry } from '../src/modules/feedback/model.js';
import { ActivityEvent } from '../src/modules/activity/model.js';
import { workspacesLocked } from '../src/lib/workspaceLock.js';

/**
 * Locked workspaces: every step is submitted with links, Shoot is approved directly,
 * Post takes only its live link, rework starts at the worker's click, and no step is ever
 * left without a next action. Runs with the real switch (locked).
 */

const tokenFor = (u) => jwt.sign({ userId: String(u._id), role: u.role }, env.JWT_SECRET, { expiresIn: '1h' });
const DRIVE = (name) => `https://drive.google.com/file/d/${name}/view`;
const DOCS = (name) => `https://docs.google.com/document/d/${name}/edit`;
const LIVE = 'https://www.instagram.com/reel/link-flow-live/';

describe('Locked workspaces: link submission, direct Shoot approval, Post link, rework', () => {
  const salt = `lnk-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  const people = {};
  const pieces = [];
  const dept = new mongoose.Types.ObjectId();

  const make = (key, role) =>
    Person.create({ name: `Lnk ${key}`, email: `${key}.${salt}@lnk.test`, role, status: 'active' }).then((p) => (people[key] = p));

  /** A content piece with its steps in order: the first unlocked, the rest locked. */
  async function piece(contentType, stages, { allUnlocked = false } = {}) {
    const p = await ContentPiece.create({ planId: new mongoose.Types.ObjectId(), topic: `Lnk ${contentType} ${salt}`, contentType, pipeline: contentType === 'Reel' ? 'reel_a' : 'design', postingDate: new Date(Date.now() + 9 * 86400000), status: 'In Progress' });
    pieces.push(p._id);
    const out = {};
    let order = 1;
    for (const [stageKey, owner, status = 'Not Started'] of stages) {
      out[stageKey] = await WorkItem.create({
        title: `Lnk ${contentType} ${stageKey} ${salt}`,
        workType: contentType,
        stageKey,
        stageOrder: order,
        status,
        isLocked: !allUnlocked && order > 1,
        reviewRequired: stageKey !== 'Post',
        contentPieceId: p._id,
        departmentId: dept,
        ownerId: people[owner]._id,
        deadline: new Date(Date.now() + 9 * 86400000),
        estimatedEffortHrs: 1,
        startedAt: status === 'Not Started' ? null : new Date(Date.now() - 3600000),
        rounds: status === 'Not Started' ? [] : [{ roundNumber: 1, startedAt: new Date(Date.now() - 3600000), intervals: [] }],
      });
      order += 1;
    }
    return out;
  }
  const one = async (contentType, stageKey, owner, status = 'In Progress') => (await piece(contentType, [[stageKey, owner, status]]))[stageKey];

  const as = (who) => ({
    post: (url, body) => request(app).post(url).set('Authorization', `Bearer ${tokenFor(people[who])}`).send(body),
    put: (url, body) => request(app).put(url).set('Authorization', `Bearer ${tokenFor(people[who])}`).send(body),
    patch: (url, body) => request(app).patch(url).set('Authorization', `Bearer ${tokenFor(people[who])}`).send(body),
    del: (url) => request(app).delete(url).set('Authorization', `Bearer ${tokenFor(people[who])}`),
    get: (url) => request(app).get(url).set('Authorization', `Bearer ${tokenFor(people[who])}`),
  });
  const submitLink = (w, who, links, note) => as(who).post(`/api/work/${w._id}/submit-link`, { links, note });
  const move = (w, who, toStatus, body = {}) => as(who).post(`/api/work/${w._id}/transition`, { toStatus, ...body });
  const latest = (w) => Submission.findOne({ workItemId: w._id, version: { $gt: 0 } }).sort({ version: -1 });
  const versions = (w) => Submission.countDocuments({ workItemId: w._id, version: { $gt: 0 } });
  const fresh = (w) => WorkItem.findById(w._id).lean();
  const approve = async (w, who = 'head', body = { score: 4, feedback: 'Good work' }) => as(who).post(`/api/submissions/${(await latest(w))._id}/approve`, body);
  const revise = async (w, who = 'head', comment = 'Please change the ending') => as(who).post(`/api/submissions/${(await latest(w))._id}/request-revision`, { comment, rootCause: 'Brief unclear' });
  const notesTo = (who, type) => Notification.countDocuments({ recipient: people[who]._id, ...(type ? { type } : {}) });
  const stateOf = async (w) => {
    const step = await fresh(w);
    const sub = await latest(w);
    return stepReviewState(step.status, sub?.status, step.revisions || 0);
  };

  /** Who must act next on this step. Throws if nobody can: the step would be stuck. */
  async function nextActor(w) {
    const step = await fresh(w);
    if (step.status === 'Approved' && step.stageKey !== 'Post') return 'done';
    if (step.status === 'Published') return 'done';
    const owner = { _id: String(step.ownerId), role: 'team_member' };
    const { actions } = getAvailableActions(owner, { ...step, ownerId: String(step.ownerId) });
    const state = await stateOf(w);
    if (state === 'awaiting_review') {
      if (!(await latest(w))) throw new Error(`${step.stageKey} waits for review with no version`);
      return 'reviewer';
    }
    if (state === 'changes_requested') return 'owner:start_rework';
    if (actions.includes('start')) return 'owner:start';
    if (actions.includes('mark_as_posted')) return 'owner:post';
    if (actions.includes('submit_for_approval')) return state === 'rework_in_progress' ? 'owner:resubmit' : 'owner:submit';
    throw new Error(`${step.stageKey} is stuck in ${step.status} (locked: ${step.isLocked})`);
  }

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) await mongoose.connect(env.MONGODB_URI);
    for (const [k, r] of [['writer', 'team_member'], ['shooter', 'team_member'], ['editor', 'team_member'], ['designer', 'team_member'], ['copy', 'team_member'], ['poster', 'team_member'], ['outsider', 'team_member'], ['head', 'creative_head'], ['sm', 'sm_manager'], ['exec', 'executive'], ['admin', 'admin']]) await make(k, r);
  });

  afterEach(() => vi.restoreAllMocks());

  afterAll(async () => {
    const items = await WorkItem.find({ contentPieceId: { $in: pieces } }).select('_id').lean();
    const ids = items.map((w) => w._id);
    const subs = (await Submission.find({ workItemId: { $in: ids } }).select('_id').lean()).map((s) => s._id);
    await ActivityEvent.deleteMany({ entityId: { $in: [...ids, ...subs, ...ids.map(String), ...subs.map(String)] } });
    await Rating.deleteMany({ workItemId: { $in: ids } });
    await SubmissionComment.deleteMany({ workItemId: { $in: ids } });
    await FeedbackEntry.deleteMany({ workItemId: { $in: ids } });
    await MediaItem.deleteMany({ stageItemId: { $in: ids } });
    await Submission.deleteMany({ workItemId: { $in: ids } });
    await mongoose.connection.db.collection('revisionflags').deleteMany({ workItemId: { $in: ids } });
    await Notification.deleteMany({ recipient: { $in: Object.values(people).map((p) => p._id) } });
    await WorkItem.deleteMany({ _id: { $in: ids } });
    await ContentPiece.deleteMany({ _id: { $in: pieces } });
    await Person.deleteMany({ email: new RegExp(salt) });
  });

  it('runs with the one switch on', () => {
    expect(WORKSPACES_LOCKED).toBe(true);
    expect(workspacesLocked()).toBe(true);
  });

  describe('Workspace-only writes are refused while locked', () => {
    it('refuses draft save, clip upload, clip edits and submit-clips with 423; reads stay open', async () => {
      const script = await one('Reel', 'Script', 'writer');
      const shoot = await one('Reel', 'Shoot', 'shooter');
      const clip = await MediaItem.create({ stageItemId: shoot._id, uploadedBy: people.shooter._id, kind: 'video', url: DRIVE('clip'), title: 'Lnk clip', take: 1, order: 0, version: 1, status: 'uploaded' });

      const refused = [
        await as('writer').put(`/api/work/${script._id}/draft`, { document: { htmlSnapshot: '<p>Draft</p>' } }),
        await as('shooter').post(`/api/work/${shoot._id}/clips`, { url: DRIVE('new-clip'), title: 'New clip' }),
        await as('shooter').put(`/api/work/${shoot._id}/clips/reorder`, { clipIds: [String(clip._id)] }),
        await as('shooter').post(`/api/work/${shoot._id}/submit-clips`, {}),
        await as('shooter').patch(`/api/clips/${clip._id}`, { title: 'Renamed' }),
        await as('shooter').post(`/api/clips/${clip._id}/replace`, { url: DRIVE('replacement') }),
        await as('shooter').del(`/api/clips/${clip._id}`),
      ];
      for (const res of refused) {
        expect(res.status).toBe(423);
        expect(res.body.error?.code || res.body.code).toBe('WORKSPACES_LOCKED');
      }
      expect(await MediaItem.countDocuments({ stageItemId: shoot._id })).toBe(1);
      expect((await MediaItem.findById(clip._id).lean()).title).toBe('Lnk clip');
      expect(await Submission.countDocuments({ workItemId: script._id, 'document.htmlSnapshot': '<p>Draft</p>' })).toBe(0);

      expect((await as('writer').get(`/api/work/${script._id}/draft`)).status).toBe(200);
      expect((await as('shooter').get(`/api/work/${shoot._id}/clips`)).status).toBe(200);
      expect((await as('head').get('/api/submissions/review-queue')).status).toBe(200);
    });

    it('an outsider still gets the same 404 as before, not the lock message', async () => {
      const script = await one('Reel', 'Script', 'writer');
      const res = await as('outsider').put(`/api/work/${script._id}/draft`, { document: { htmlSnapshot: '<p>x</p>' } });
      expect(res.status).toBe(404);
    });
  });

  describe('Submitting with links', () => {
    for (const [type, stageKey, owner, link] of [
      ['Reel', 'Script', 'writer', DOCS('script')],
      ['Static Post', 'Content', 'copy', DOCS('content')],
      ['Reel', 'Shoot', 'shooter', 'https://drive.google.com/drive/folders/shoot-folder'],
      ['Reel', 'Edit', 'editor', DRIVE('final-cut')],
    ]) {
      it(`${stageKey}: one link creates a normal version and the step waits for approval`, async () => {
        const w = await one(type, stageKey, owner);
        const before = await notesTo('head');
        const res = await submitLink(w, owner, [link], 'Please check the ending');
        expect(res.status).toBe(201);
        const sub = await latest(w);
        expect(sub.version).toBe(1);
        expect(sub.status).toBe('submitted');
        expect(sub.kind).toBe('link');
        expect(sub.linkUrl).toBe(link);
        expect(sub.files.map((f) => f.url)).toEqual([link]);
        expect(sub.notes).toBe('Please check the ending');
        expect(String(sub.submittedById)).toBe(String(people[owner]._id));
        const step = await fresh(w);
        expect(step.status).toBe('Feedback');
        expect(step.submittedAt).toBeTruthy();
        expect(step.deliverableUrl).toBe(link);
        expect(step.rounds.at(-1).submittedAt).toBeTruthy();
        expect(await stateOf(w)).toBe('awaiting_review');
        // Submitting notifies the reviewers.
        expect(await notesTo('head')).toBe(before + 1);
        // It is in the review queue as a normal version.
        const queue = await as('head').get('/api/submissions/review-queue');
        expect((queue.body.data || []).some((q) => String(q._id) === String(sub._id))).toBe(true);
      });
    }

    it('Design: several links, one per slide or file', async () => {
      const w = await one('Carousel Post', 'Design', 'designer');
      const links = [DRIVE('slide-1'), DRIVE('slide-2'), DRIVE('slide-3')];
      const res = await submitLink(w, 'designer', [...links, links[0]], '');
      expect(res.status).toBe(201);
      const sub = await latest(w);
      expect(sub.files.map((f) => f.url)).toEqual(links);
      expect(sub.linkUrl).toBe(links[0]);
      expect((await fresh(w)).status).toBe('Feedback');
    });

    it('a step other than Design takes one link only', async () => {
      const w = await one('Reel', 'Edit', 'editor');
      const res = await submitLink(w, 'editor', [DRIVE('a'), DRIVE('b')]);
      expect(res.status).toBe(400);
      expect(res.body.error?.code || res.body.code).toBe('ONE_LINK_ONLY');
      expect(await versions(w)).toBe(0);
      expect((await fresh(w)).status).toBe('In Progress');
    });

    it('rejects invalid links and changes nothing', async () => {
      const w = await one('Carousel Post', 'Design', 'designer');
      for (const bad of [
        ['http://drive.google.com/file/d/x/view'],
        ['https://example.com/file'],
        ['https://drive.google.com.evil.example/file'],
        ['javascript:alert(1)'],
        ['data:text/html,<b>x</b>'],
        ['/uploads/some-file.png'],
        ['not a link'],
        [DRIVE('good'), 'https://dropbox.com/s/bad'],
        [],
        ['   '],
      ]) {
        const res = await submitLink(w, 'designer', bad);
        expect(res.status, JSON.stringify(bad)).toBe(400);
      }
      expect(await versions(w)).toBe(0);
      const step = await fresh(w);
      expect(step.status).toBe('In Progress');
      expect(step.submittedAt).toBeFalsy();
    });

    it('only the owner submits; reviewers and other roles cannot', async () => {
      const flow = await piece('Reel', [['Script', 'writer', 'In Progress'], ['Shoot', 'shooter']]);
      expect((await submitLink(flow.Script, 'outsider', [DOCS('x')])).status).toBe(404);
      for (const who of ['shooter', 'head', 'sm', 'admin', 'exec']) {
        const res = await submitLink(flow.Script, who, [DOCS('x')]);
        expect(res.status, who).toBe(403);
      }
      expect(await versions(flow.Script)).toBe(0);
      expect((await fresh(flow.Script)).status).toBe('In Progress');
    });

    it('cannot be used before starting, on a locked or finished step, twice, or on a Post step', async () => {
      const flow = await piece('Reel', [['Script', 'writer'], ['Shoot', 'shooter'], ['Post', 'poster', 'In Progress']]);
      expect((await submitLink(flow.Script, 'writer', [DOCS('x')])).body.error?.code).toBe('MUST_START_BEFORE_SUBMIT');
      expect((await submitLink(flow.Shoot, 'shooter', [DRIVE('x')])).body.error?.code).toBe('STEP_LOCKED');
      expect((await submitLink(flow.Post, 'poster', [DRIVE('x')])).body.error?.code).toBe('POST_STEP_NOT_SUBMITTED');
      const edit = await one('Reel', 'Edit', 'editor');
      expect((await submitLink(edit, 'editor', [DRIVE('cut')])).status).toBe(201);
      const again = await submitLink(edit, 'editor', [DRIVE('cut-again')]);
      expect(again.status).toBe(409);
      expect(again.body.error?.code).toBe('SUBMISSION_AWAITING_REVIEW');
      expect(await versions(edit)).toBe(1);
    });

    it('the version and the step change together: a failed step save leaves no version', async () => {
      const w = await one('Reel', 'Edit', 'editor');
      const save = vi.spyOn(WorkItem.prototype, 'save').mockRejectedValueOnce(new Error('disk full'));
      const res = await submitLink(w, 'editor', [DRIVE('cut')]);
      expect(save).toHaveBeenCalled();
      expect(res.status).toBe(500);
      expect(await versions(w)).toBe(0);
      const step = await fresh(w);
      expect(step.status).toBe('In Progress');
      expect(step.submittedAt).toBeFalsy();
      expect(step.rounds.at(-1).submittedAt).toBeFalsy();
    });

    it('a failed version write leaves the step as it was', async () => {
      const w = await one('Reel', 'Edit', 'editor');
      vi.spyOn(Submission, 'create').mockRejectedValueOnce(new Error('write failed'));
      const res = await submitLink(w, 'editor', [DRIVE('cut')]);
      expect(res.status).toBe(500);
      expect(await versions(w)).toBe(0);
      expect((await fresh(w)).status).toBe('In Progress');
    });

    it('the old transition path cannot submit a review step while locked', async () => {
      const w = await one('Reel', 'Edit', 'editor');
      for (const toStatus of ['Pending', 'Feedback']) {
        const res = await move(w, 'editor', toStatus, { deliverableUrl: DRIVE('cut') });
        expect(res.status).toBe(409);
        expect(res.body.error?.code).toBe('USE_SUBMIT_LINK');
      }
      expect(await versions(w)).toBe(0);
      const step = await fresh(w);
      expect(step.status).toBe('In Progress');
      expect(step.deliverableUrl || '').toBe('');
    });

    it('a saved workspace draft stays saved and is not attached to the link version', async () => {
      const w = await one('Reel', 'Script', 'writer');
      await Submission.create({ workItemId: w._id, contentPieceId: w.contentPieceId, stageKey: 'Script', version: 0, kind: 'document', status: 'draft', document: { htmlSnapshot: '<p>My unfinished draft</p>' } });
      expect((await submitLink(w, 'writer', [DOCS('script')])).status).toBe(201);
      const draft = await Submission.findOne({ workItemId: w._id, version: 0 }).lean();
      expect(draft.document.htmlSnapshot).toBe('<p>My unfinished draft</p>');
      expect((await latest(w)).document?.htmlSnapshot || '').toBe('');
    });
  });

  describe('Shoot is reviewed like any other step when submitted with a link', () => {
    it('is approved directly with a rating and a message; a rating is mandatory', async () => {
      const flow = await piece('Reel', [['Shoot', 'shooter', 'In Progress'], ['Edit', 'editor']]);
      await submitLink(flow.Shoot, 'shooter', ['https://drive.google.com/drive/folders/footage']);
      expect((await approve(flow.Shoot, 'head', { feedback: 'No rating' })).status).toBe(400);
      expect((await approve(flow.Shoot, 'head', { score: 9 })).status).toBe(400);
      expect((await fresh(flow.Shoot)).status).toBe('Feedback');

      const res = await approve(flow.Shoot, 'head', { score: 5, feedback: 'Lovely footage' });
      expect(res.status).toBe(200);
      expect((await fresh(flow.Shoot)).status).toBe('Approved');
      const rating = await Rating.findOne({ workItemId: flow.Shoot._id }).lean();
      expect(rating.score).toBe(5);
      expect(rating.feedback).toBe('Lovely footage');
      expect((await fresh(flow.Edit)).isLocked).toBe(false);

      // The editor receives the Shoot link.
      const detail = await as('editor').get(`/api/work/${flow.Edit._id}`);
      const shootEntry = (detail.body.data.handoff || []).find((e) => e.stageKey === 'Shoot');
      expect(shootEntry.items.map((i) => i.url)).toEqual(['https://drive.google.com/drive/folders/footage']);
      expect(shootEntry.clips).toEqual([]);
    });

    it('changes can be requested on a Shoot link with a message and root cause', async () => {
      const shoot = await one('Reel', 'Shoot', 'shooter');
      await submitLink(shoot, 'shooter', [DRIVE('footage')]);
      const res = await revise(shoot, 'head', 'The audio is clipping');
      expect(res.status).toBe(200);
      expect(await stateOf(shoot)).toBe('changes_requested');
      const detail = await as('shooter').get(`/api/work/${shoot._id}`);
      expect(detail.body.data.latestFeedback.text).toBe('The audio is clipping');
      expect(detail.body.data.latestFeedback.rootCause).toBe('Brief unclear');
    });

    it('only Creative Head and admin review; the owner, SM manager and executive cannot', async () => {
      const shoot = await one('Reel', 'Shoot', 'shooter');
      await submitLink(shoot, 'shooter', [DRIVE('footage')]);
      for (const who of ['shooter', 'sm', 'exec', 'editor']) {
        expect((await approve(shoot, who)).status, who).toBeGreaterThanOrEqual(403);
        expect((await revise(shoot, who)).status, who).toBeGreaterThanOrEqual(403);
      }
      expect((await fresh(shoot)).status).toBe('Feedback');
      expect((await approve(shoot, 'admin', { score: 3 })).status).toBe(200);
    });

    it('a Shoot version with clips keeps the clip rule', async () => {
      const shoot = await one('Reel', 'Shoot', 'shooter', 'Pending');
      await Submission.create({ workItemId: shoot._id, contentPieceId: shoot.contentPieceId, stageKey: 'Shoot', version: 1, kind: 'video', status: 'submitted', submittedById: people.shooter._id, submittedAt: new Date(), files: [{ url: DRIVE('clip-1') }] });
      const clip = await MediaItem.create({ stageItemId: shoot._id, uploadedBy: people.shooter._id, kind: 'video', url: DRIVE('clip-1'), title: 'Lnk clip 1', take: 1, order: 0, version: 1, status: 'waiting_review' });
      const blocked = await approve(shoot, 'head', { score: 4 });
      expect(blocked.status).toBe(400);
      expect(blocked.body.error?.code).toBe('CLIPS_WAITING_REVIEW');

      // Clip review still works while locked, and the step is then approved through it.
      expect((await as('head').post(`/api/clips/${clip._id}/review`, { action: 'approve' })).status).toBe(200);
      const done = await as('head').post(`/api/work/${shoot._id}/shoot-review`, { score: 4 });
      expect(done.status).toBe(200);
      expect((await fresh(shoot)).status).toBe('Approved');
    });

    it('an uploaded-file version waiting for review is still reviewable', async () => {
      const edit = await one('Reel', 'Edit', 'editor', 'Feedback');
      await Submission.collection.insertOne({ workItemId: edit._id, contentPieceId: edit.contentPieceId, stageKey: 'Edit', version: 1, kind: 'video', status: 'submitted', files: [{ url: '/uploads/older-cut.mp4', name: 'cut.mp4' }], fileUrl: '/uploads/older-cut.mp4', linkUrl: '', submittedById: people.editor._id, submittedAt: new Date(), createdAt: new Date(), updatedAt: new Date() });
      expect((await approve(edit, 'head', { score: 4 })).status).toBe(200);
      expect((await fresh(edit)).status).toBe('Approved');
    });
  });

  describe('Post: the live link only', () => {
    it('is marked Posted with only a live URL, and no caption or hashtags are saved', async () => {
      const post = await one('Reel', 'Post', 'poster');
      const res = await move(post, 'poster', 'Published', { publishedUrl: LIVE, caption: 'Should be ignored', hashtags: '#ignored' });
      expect(res.status).toBe(200);
      const step = await fresh(post);
      expect(step.status).toBe('Published');
      expect(step.publishedUrl).toBe(LIVE);
      expect(step.postedAt).toBeTruthy();
      expect(step.postCaption || '').toBe('');
      expect(step.postHashtags || '').toBe('');
      // The live URL is on the piece, where the Tracker reads it.
      expect((await ContentPiece.findById(post.contentPieceId).lean()).liveUrl).toBe(LIVE);
    });

    it('rejects a missing or unsafe live URL and changes nothing', async () => {
      const post = await one('Reel', 'Post', 'poster');
      for (const bad of [undefined, '', 'http://instagram.com/p/x', 'javascript:alert(1)', 'data:text/html,x', 'instagram.com/p/x', 'https://user:pass@instagram.com/p/x', 'ftp://example.com/x']) {
        const res = await move(post, 'poster', 'Published', bad === undefined ? {} : { publishedUrl: bad });
        expect(res.status, String(bad)).toBe(400);
        expect(['LIVE_URL_REQUIRED', 'INVALID_LIVE_URL']).toContain(res.body.error?.code);
      }
      const step = await fresh(post);
      expect(step.status).toBe('In Progress');
      expect(step.publishedUrl || '').toBe('');
      expect(isLivePostUrl('https://www.linkedin.com/posts/x')).toBe(true);
      expect(isLivePostUrl('http://www.linkedin.com/posts/x')).toBe(false);
    });

    it('accepts any https host', async () => {
      for (const url of ['https://www.linkedin.com/posts/haca-1', 'https://youtu.be/abc123', 'https://x.com/haca/status/1']) {
        const post = await one('Static Post', 'Post', 'poster');
        expect((await move(post, 'poster', 'Published', { publishedUrl: url })).status, url).toBe(200);
      }
    });

    it('leaves a caption saved earlier untouched', async () => {
      const post = await one('Reel', 'Post', 'poster');
      await WorkItem.updateOne({ _id: post._id }, { $set: { postCaption: 'Saved before', postHashtags: '#before' } });
      expect((await move(post, 'poster', 'Published', { publishedUrl: LIVE })).status).toBe(200);
      const step = await fresh(post);
      expect(step.postCaption).toBe('Saved before');
      expect(step.postHashtags).toBe('#before');
    });

    it('only the owner, SM manager and admin post', async () => {
      const post = await one('Reel', 'Post', 'poster');
      for (const who of ['editor', 'head', 'exec']) {
        expect((await move(post, who, 'Published', { publishedUrl: LIVE })).status, who).toBeGreaterThanOrEqual(403);
      }
      expect((await fresh(post)).status).toBe('In Progress');
      expect((await move(post, 'sm', 'Published', { publishedUrl: LIVE })).status).toBe(200);
    });
  });

  describe('Rework: Start rework, then Resubmit', () => {
    it('waits in Changes requested with no round running, then times the rework from the click', async () => {
      const w = await one('Reel', 'Edit', 'editor');
      await submitLink(w, 'editor', [DRIVE('cut-v1')]);
      const ownerNotesBefore = await notesTo('editor', 'revision_requested');
      expect((await revise(w, 'head', 'Trim the intro')).status).toBe(200);

      // Changes requested: one revision, the owner told once, the round decided, none running.
      let step = await fresh(w);
      expect(step.status).toBe('Feedback');
      expect(await stateOf(w)).toBe('changes_requested');
      expect(step.revisions).toBe(1);
      expect(step.rounds).toHaveLength(1);
      expect(step.rounds[0].decision).toBe('changes_requested');
      expect(await notesTo('editor', 'revision_requested')).toBe(ownerNotesBefore + 1);
      expect(reworkTimeMs(step)).toBeNull();

      // Resubmitting before Start rework is refused.
      const early = await submitLink(w, 'editor', [DRIVE('cut-v2')]);
      expect(early.status).toBe(409);
      expect(early.body.error?.code).toBe('REWORK_NOT_STARTED');
      expect(await versions(w)).toBe(1);

      // Start rework: a new round starts now; no revision, nobody notified.
      const allNotesBefore = await Notification.countDocuments({ recipient: { $in: Object.values(people).map((p) => p._id) } });
      const clickedAt = Date.now();
      expect((await move(w, 'editor', 'In Progress')).status).toBe(200);
      step = await fresh(w);
      expect(step.status).toBe('In Progress');
      expect(await stateOf(w)).toBe('rework_in_progress');
      expect(step.revisions).toBe(1);
      expect(step.rounds).toHaveLength(2);
      expect(Math.abs(new Date(step.rounds[1].startedAt).getTime() - clickedAt)).toBeLessThan(5000);
      expect(new Date(step.rounds[1].startedAt).getTime()).toBeGreaterThan(new Date(step.rounds[0].decisionAt).getTime());
      expect(step.rounds[1].submittedAt).toBeFalsy();
      expect(await Notification.countDocuments({ recipient: { $in: Object.values(people).map((p) => p._id) } })).toBe(allNotesBefore);

      // Resubmit: closes the round and creates the next version.
      await new Promise((r) => setTimeout(r, 30));
      expect((await submitLink(w, 'editor', [DRIVE('cut-v2')], 'Intro trimmed')).status).toBe(201);
      step = await fresh(w);
      expect(await stateOf(w)).toBe('awaiting_review');
      expect((await latest(w)).version).toBe(2);
      expect(step.rounds).toHaveLength(2);
      expect(step.rounds[1].submittedAt).toBeTruthy();
      expect(step.resubmittedAt).toBeTruthy();
      expect(step.revisions).toBe(1);
      const expected = new Date(step.rounds[1].submittedAt).getTime() - new Date(step.rounds[1].startedAt).getTime();
      expect(reworkTimeMs(step)).toBe(expected);
      expect(expected).toBeGreaterThan(0);

      expect((await approve(w, 'head', { score: 4 })).status).toBe(200);
      step = await fresh(w);
      expect(step.status).toBe('Approved');
      expect(step.revisions).toBe(1);
      expect(reworkTimeMs(step)).toBe(expected);
    });

    it('Start rework is refused while the latest version waits for review, with no revision counted', async () => {
      const w = await one('Reel', 'Edit', 'editor');
      await submitLink(w, 'editor', [DRIVE('cut-v1')]);
      const res = await move(w, 'editor', 'In Progress');
      expect(res.status).toBe(409);
      expect(res.body.error?.code).toBe('SUBMISSION_AWAITING_REVIEW');
      const step = await fresh(w);
      expect(step.status).toBe('Feedback');
      expect(step.revisions || 0).toBe(0);
      expect(step.rounds).toHaveLength(1);
    });

    it('two rework rounds count two revisions and add both rounds to the rework time', async () => {
      const w = await one('Carousel Post', 'Design', 'designer');
      await submitLink(w, 'designer', [DRIVE('s1')]);
      for (const n of [2, 3]) {
        expect((await revise(w)).status).toBe(200);
        expect((await move(w, 'designer', 'In Progress')).status).toBe(200);
        await new Promise((r) => setTimeout(r, 20));
        expect((await submitLink(w, 'designer', [DRIVE(`s${n}`), DRIVE(`s${n}-b`)])).status).toBe(201);
      }
      const step = await fresh(w);
      expect(step.revisions).toBe(2);
      expect(step.rounds).toHaveLength(3);
      const sum = [1, 2].reduce((t, i) => t + (new Date(step.rounds[i].submittedAt) - new Date(step.rounds[i].startedAt)), 0);
      expect(reworkTimeMs(step)).toBe(sum);
      expect((await latest(w)).version).toBe(3);
    });

    it('every revision path ends in the same state', async () => {
      const read = async (w) => {
        const step = await fresh(w);
        return { status: step.status, state: await stateOf(w), revisions: step.revisions, rounds: step.rounds.length, decision: step.rounds.at(-1).decision, latest: (await latest(w)).status };
      };
      const expected = { status: 'Feedback', state: 'changes_requested', revisions: 1, rounds: 1, decision: 'changes_requested', latest: 'changes_requested' };

      // 1. Review Studio / Work Detail
      const a = await one('Reel', 'Edit', 'editor');
      await submitLink(a, 'editor', [DRIVE('a')]);
      await revise(a);
      expect(await read(a)).toEqual(expected);

      // 2. Feedback page
      const b = await one('Reel', 'Edit', 'editor');
      await submitLink(b, 'editor', [DRIVE('b')]);
      expect((await as('head').post(`/api/feedback/work-item/${b._id}`, { text: 'Needs another pass', roundStatus: 'Revision Required' })).status).toBeLessThan(300);
      expect(await read(b)).toEqual(expected);

      // 3. Shoot clip review (a version with clips)
      const c = await one('Reel', 'Shoot', 'shooter', 'Pending');
      await WorkItem.updateOne({ _id: c._id }, { $set: { 'rounds.0.submittedAt': new Date() } });
      await Submission.create({ workItemId: c._id, contentPieceId: c.contentPieceId, stageKey: 'Shoot', version: 1, kind: 'video', status: 'submitted', submittedById: people.shooter._id, submittedAt: new Date(), files: [{ url: DRIVE('clip') }] });
      await MediaItem.create({ stageItemId: c._id, uploadedBy: people.shooter._id, kind: 'video', url: DRIVE('clip'), title: 'Lnk reshoot clip', take: 1, order: 0, version: 1, status: 'reshoot_needed' });
      const before = await notesTo('shooter', 'revision_requested');
      const res = await as('head').post(`/api/work/${c._id}/shoot-review`, { note: 'Reshoot the opening' });
      expect(res.status).toBe(200);
      expect(await read(c)).toEqual(expected);
      expect(await notesTo('shooter', 'revision_requested')).toBe(before + 1);

      // From each, Start rework opens one round and counts nothing more.
      for (const [w, who] of [[a, 'editor'], [b, 'editor'], [c, 'shooter']]) {
        expect((await move(w, who, 'In Progress')).status).toBe(200);
        const step = await fresh(w);
        expect(step.revisions).toBe(1);
        expect(step.rounds).toHaveLength(2);
        expect(await stateOf(w)).toBe('rework_in_progress');
      }
    });

    it('a blocked or changes-requested step still has a next action', async () => {
      const w = await one('Reel', 'Edit', 'editor');
      await submitLink(w, 'editor', [DRIVE('cut')]);
      await revise(w);
      expect(await nextActor(w)).toBe('owner:start_rework');
      await move(w, 'editor', 'In Progress');
      expect(await nextActor(w)).toBe('owner:resubmit');
      expect((await move(w, 'editor', 'Blocked', { blockerReason: 'Waiting for feedback' })).status).toBe(200);
      const owner = { _id: String(people.editor._id), role: 'team_member' };
      expect(getAvailableActions(owner, { ...(await fresh(w)), ownerId: String(people.editor._id) }).actions).toContain('resolve_blocker');
    });
  });

  describe('Every workflow, start to finish, with links only and one rework', () => {
    const OWNER = { Script: 'writer', Content: 'copy', Shoot: 'shooter', Edit: 'editor', Design: 'designer', Post: 'poster' };
    const linksFor = (stageKey, n) =>
      stageKey === 'Design' ? [DRIVE(`design-${n}-a`), DRIVE(`design-${n}-b`)] : stageKey === 'Shoot' ? [`https://drive.google.com/drive/folders/shoot-${n}`] : [DRIVE(`${stageKey.toLowerCase()}-${n}`)];

    /** Walks one step to its end by always doing what nextActor says. */
    async function walk(w, { rework = false } = {}) {
      const owner = OWNER[w.stageKey];
      let reworked = !rework;
      let version = 0;
      for (let guard = 0; guard < 12; guard++) {
        const next = await nextActor(w);
        if (next === 'done') return version;
        if (next === 'owner:start' || next === 'owner:start_rework') expect((await move(w, owner, 'In Progress')).status).toBe(200);
        else if (next === 'owner:submit' || next === 'owner:resubmit') {
          version += 1;
          expect((await submitLink(w, owner, linksFor(w.stageKey, version))).status).toBe(201);
        } else if (next === 'owner:post') expect((await move(w, owner, 'Published', { publishedUrl: LIVE })).status).toBe(200);
        else if (next === 'reviewer') {
          if (!reworked) {
            reworked = true;
            expect((await revise(w)).status).toBe(200);
          } else expect((await approve(w, 'head', { score: 4, feedback: 'Approved' })).status).toBe(200);
        }
      }
      throw new Error(`${w.stageKey} did not finish`);
    }

    for (const [name, type, stages, reworkOn] of [
      ['Reel: Full', 'Reel', ['Script', 'Shoot', 'Edit', 'Post'], 'Shoot'],
      ['Reel: Shoot + Edit', 'Reel', ['Shoot', 'Edit', 'Post'], 'Edit'],
      ['Reel: Edit only', 'Reel', ['Edit', 'Post'], 'Edit'],
      ['Static Post: With content', 'Static Post', ['Content', 'Design', 'Post'], 'Design'],
      ['Carousel Post: Design only', 'Carousel Post', ['Design', 'Post'], 'Design'],
      ['Poster (not posted): Content then Design, handed over', 'Poster', ['Content', 'Design'], 'Content'],
    ]) {
      it(`${name} never gets stuck`, async () => {
        const flow = await piece(type, stages.map((s) => [s, OWNER[s]]));
        for (const stageKey of stages) {
          const w = flow[stageKey];
          // A step is reachable only after the one before it is done.
          expect((await fresh(w)).isLocked, `${stageKey} unlocked`).toBe(false);
          const lastVersion = await walk(w, { rework: stageKey === reworkOn });
          const step = await fresh(w);
          expect(step.status).toBe(stageKey === 'Post' ? 'Published' : 'Approved');
          if (stageKey !== 'Post') {
            expect(lastVersion).toBe(stageKey === reworkOn ? 2 : 1);
            expect(step.revisions || 0).toBe(stageKey === reworkOn ? 1 : 0);
            expect((await latest(w)).status).toBe('approved');
            expect(await Rating.countDocuments({ workItemId: w._id })).toBe(1);
          }
        }

        // Each later step received every approved link of the steps before it.
        for (let i = 1; i < stages.length; i++) {
          const w = flow[stages[i]];
          const detail = await as(OWNER[stages[i]]).get(`/api/work/${w._id}`);
          const handoff = detail.body.data.handoff || [];
          expect(handoff.map((e) => e.stageKey)).toEqual(stages.slice(0, i));
          for (const entry of handoff) {
            const version = entry.stageKey === reworkOn ? 2 : 1;
            expect(entry.items.map((it) => it.url), `${entry.stageKey} -> ${stages[i]}`).toEqual(linksFor(entry.stageKey, version));
          }
        }

        if (stages.at(-1) === 'Post') {
          expect((await ContentPiece.findById(flow.Post.contentPieceId).lean()).liveUrl).toBe(LIVE);
        } else {
          // Not posted: the approved design is handed over to the SM manager.
          const detail = await as('sm').get(`/api/work/${flow.Design._id}`);
          expect(detail.body.data.handover.items.map((it) => it.url)).toEqual(linksFor('Design', 1));
        }
      });
    }

    it('someone outside the piece, or on an earlier step, does not get the later outputs', async () => {
      const flow = await piece('Reel', [['Script', 'writer'], ['Shoot', 'shooter'], ['Edit', 'editor']]);
      await walk(flow.Script);
      await walk(flow.Shoot);
      // The writer (an earlier step) asks about the Edit step: no handoff of Shoot's link.
      const writerView = await as('writer').get(`/api/work/${flow.Edit._id}`);
      expect(writerView.status).toBe(200);
      expect(writerView.body.data.handoff).toBeUndefined();
      expect((await as('outsider').get(`/api/work/${flow.Edit._id}`)).status).toBe(404);
      // The editor (a later step) gets both.
      const editorView = await as('editor').get(`/api/work/${flow.Edit._id}`);
      expect(editorView.body.data.handoff.map((e) => e.stageKey)).toEqual(['Script', 'Shoot']);
    });
  });

  describe('Lists show the difference between waiting and changes requested', () => {
    it('My Work and Work Detail carry the latest version status and the reviewer note', async () => {
      const waiting = await one('Reel', 'Edit', 'editor');
      const sentBack = await one('Reel', 'Edit', 'editor');
      await submitLink(waiting, 'editor', [DRIVE('w')]);
      await submitLink(sentBack, 'editor', [DRIVE('s')]);
      await revise(sentBack, 'head', 'Colour is off');
      const mine = await as('editor').get('/api/my-work');
      const all = ['overdue', 'today', 'thisWeek', 'upcoming'].flatMap((k) => mine.body.data[k]);
      const find = (w) => all.find((i) => String(i._id) === String(w._id));
      expect(find(waiting).status).toBe('Feedback');
      expect(find(waiting).latestSubmissionStatus).toBe('submitted');
      expect(find(sentBack).status).toBe('Feedback');
      expect(find(sentBack).latestSubmissionStatus).toBe('changes_requested');
      expect(find(sentBack).latestFeedback.text).toBe('Colour is off');

      const detail = await as('editor').get(`/api/work/${waiting._id}`);
      const stage = detail.body.data.pieceStages.find((s) => String(s._id) === String(waiting._id));
      expect(stage.awaitingReview).toBe(true);
      const detail2 = await as('editor').get(`/api/work/${sentBack._id}`);
      expect(detail2.body.data.pieceStages.find((s) => String(s._id) === String(sentBack._id)).awaitingReview).toBeUndefined();
      // An executive sees the step, not the reviewer's note.
      expect((await as('exec').get(`/api/work/${sentBack._id}`)).body.data.latestFeedback).toBeUndefined();
    });

    it('the Tracker, the work list and the review counts tell the two apart', async () => {
      const { awaitingReviewIds, countAwaitingReview, markAwaitingReview } = await import('../src/modules/workItems/reviewState.js');
      const flow = await piece('Reel', [['Script', 'writer', 'In Progress'], ['Edit', 'editor', 'In Progress']], { allUnlocked: true });
      await submitLink(flow.Script, 'writer', [DOCS('tracker-waiting')]);
      await submitLink(flow.Edit, 'editor', [DRIVE('tracker-sent-back')]);
      await revise(flow.Edit);

      // Both are saved as 'Feedback'; only the first waits on a reviewer.
      const steps = await WorkItem.find({ _id: { $in: [flow.Script._id, flow.Edit._id] } }).lean();
      expect(steps.map((s) => s.status)).toEqual(['Feedback', 'Feedback']);
      const awaiting = await awaitingReviewIds(steps);
      expect(awaiting.has(String(flow.Script._id))).toBe(true);
      expect(awaiting.has(String(flow.Edit._id))).toBe(false);
      await markAwaitingReview(steps);
      expect(steps.find((s) => String(s._id) === String(flow.Script._id)).awaitingReview).toBe(true);
      expect(steps.find((s) => String(s._id) === String(flow.Edit._id)).awaitingReview).toBeUndefined();
      // Nothing is written back.
      expect((await fresh(flow.Script)).awaitingReview).toBeUndefined();
      expect(await countAwaitingReview({ _id: { $in: [flow.Script._id, flow.Edit._id] } })).toBe(1);

      // Tracker: the submitted step is flagged as waiting; the sent-back one is not.
      const tracker = await as('sm').get('/api/content-pieces');
      const row = (tracker.body.data || []).find((p) => String(p._id) === String(flow.Script.contentPieceId));
      expect(row).toBeTruthy();
      expect(row.hasWaitingApproval).toBe(true);
      const stage = (key) => row.stages.find((s) => s.stageKey === key);
      expect(stage('Script').awaitingReview).toBe(true);
      expect(stage('Script').holder).toBe('Creative Head');
      expect(stage('Edit').awaitingReview).toBeUndefined();
      expect(stage('Edit').holder).toBe(people.editor.name);

      // Work list: the same flag.
      const list = await as('sm').get('/api/work?allWork=true');
      const inList = (w) => (list.body.data || []).find((i) => String(i._id) === String(w._id));
      if (inList(flow.Script)) expect(inList(flow.Script).awaitingReview).toBe(true);
      if (inList(flow.Edit)) expect(inList(flow.Edit).awaitingReview).toBeUndefined();
    });

    it('no notification link points at a workspace route', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
      const offenders = [];
      const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) walk(full);
          else if (entry.name.endsWith('.js')) {
            const text = fs.readFileSync(full, 'utf8');
            for (const m of text.matchAll(/link:\s*[`'"]([^`'"]*)[`'"]/g)) {
              if (/\/(workspace|writing-studio|write|shoot|edit|design|post)(\?|$)/.test(m[1])) offenders.push(`${entry.name}: ${m[1]}`);
            }
          }
        }
      };
      walk(src);
      expect(offenders).toEqual([]);
    });
  });
});
