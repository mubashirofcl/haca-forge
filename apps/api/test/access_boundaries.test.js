import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/server.js';
import { env } from '../src/config/env.js';
import { connectDB } from '../src/config/db.js';
import { Person } from '../src/modules/people/model.js';
import { WorkItem } from '../src/modules/workItems/model.js';
import { Submission, SubmissionComment, Rating, EditorLock } from '../src/modules/submissions/model.js';
import { MediaItem, MediaMessage } from '../src/modules/media/model.js';
import { FeedbackEntry } from '../src/modules/feedback/model.js';
import { Blocker } from '../src/modules/blockers/model.js';
import { ActivityEvent } from '../src/modules/activity/model.js';
import { ContentPiece } from '../src/modules/calendar/contentPiece.model.js';
import { CalendarPlan } from '../src/modules/calendar/plan.model.js';
import workItemRoutes from '../src/modules/workItems/routes.js';
import submissionRoutes from '../src/modules/submissions/routes.js';
import clipsRouter from '../src/modules/media/routes.js';
import { feedbackRouter } from '../src/modules/feedback/routes.js';
import blockerRoutes from '../src/modules/blockers/routes.js';
import { applyWorkItemViewerRules } from '../src/modules/workItems/viewerRules.js';

const NOTE = 'PRIVATE_REVISION_NOTE';
const RATING_NOTE = 'PRIVATE_RATING_NOTE';
const THREAD = 'PRIVATE_THREAD_MESSAGE';
const DRAFT = 'PRIVATE_DRAFT_NOTE';
const BLOCKER = 'PRIVATE_BLOCKER_MARKER';
const P = {};
const dept = new mongoose.Types.ObjectId();
const EMAIL = (k) => `access.boundary.${k}@example.com`;
const PHONE = '+919800000001';
const token = (k) => jwt.sign({ userId: P[k]._id.toString(), email: P[k].email, role: P[k].role }, env.JWT_SECRET, { expiresIn: '1h' });
const call = (method, url, who, body) => {
  const r = request(app)[method](url).set('Authorization', `Bearer ${token(who)}`);
  return body !== undefined ? r.send(body) : r;
};
const text = (res) => JSON.stringify(res.body);

async function fresh({ editStatus = 'Pending', shootEdit = false } = {}) {
  const plan = await CalendarPlan.create({ code: `ACCESS-${new mongoose.Types.ObjectId()}`, title: 'Access', kind: 'monthly', periodStart: new Date(), periodEnd: new Date(), createdById: P.head._id, calendar: 'sm' });
  const piece = await ContentPiece.create({ planId: plan._id, postingDate: new Date('2031-05-20'), topic: 'AccessBoundary', contentType: 'Reel', pipeline: 'reel_a', rowStatus: 'approved', calendar: 'sm' });
  const base = { workType: 'Reel', contentPieceId: piece._id, calendarPlanId: plan._id, isLocked: false, deadline: new Date('2031-05-10'), dueDate: new Date('2031-05-10'), departmentId: dept, profileId: new mongoose.Types.ObjectId(), reviewRequired: true };
  const script = await WorkItem.create({ ...base, title: 'AccessBoundary Script', stageKey: 'Script', stageOrder: 1, status: 'Approved', ownerId: P.earlier._id, deliverableUrl: 'https://example.test/script-output' });
  const edit = await WorkItem.create({ ...base, title: 'AccessBoundary Edit', stageKey: shootEdit ? 'Shoot' : 'Edit', stageOrder: 2, status: editStatus, ownerId: P.owner._id, startedAt: new Date(), deliverableUrl: 'https://example.test/edit-output', blockerNote: 'x' });
  const post = await WorkItem.create({ ...base, title: 'AccessBoundary Post', stageKey: 'Post', stageOrder: 3, status: 'Not Started', ownerId: P.later._id, reviewRequired: false });
  const scriptV1 = await Submission.create({ workItemId: script._id, contentPieceId: piece._id, stageKey: 'Script', version: 1, kind: 'document', status: 'changes_requested', submittedById: P.earlier._id, submittedAt: new Date(), linkUrl: 'https://example.test/script-v1' });
  const scriptV2 = await Submission.create({ workItemId: script._id, contentPieceId: piece._id, stageKey: 'Script', version: 2, kind: 'document', status: 'approved', submittedById: P.earlier._id, submittedAt: new Date(), linkUrl: 'https://example.test/script-v2' });
  const sub = await Submission.create({ workItemId: edit._id, contentPieceId: piece._id, stageKey: 'Edit', version: 1, kind: 'video', status: editStatus === 'Approved' ? 'approved' : 'submitted', submittedById: P.owner._id, submittedAt: new Date(), linkUrl: 'https://example.test/edit-v1' });
  await Submission.create({ workItemId: edit._id, contentPieceId: piece._id, stageKey: 'Edit', version: 0, kind: 'video', status: 'draft', notes: DRAFT });
  const comment = await SubmissionComment.create({ submissionId: sub._id, workItemId: edit._id, authorId: P.head._id, text: NOTE, anchor: null });
  const scriptComment = await SubmissionComment.create({ submissionId: scriptV2._id, workItemId: script._id, authorId: P.head._id, text: NOTE, anchor: null });
  await FeedbackEntry.create({ workItemId: edit._id, round: 1, fromPersonId: P.head._id, roundStatus: 'Revision Required', text: NOTE, isResponse: false });
  const rating = await Rating.create({ submissionId: sub._id, workItemId: edit._id, contentPieceId: piece._id, stageKey: 'Edit', workerId: P.owner._id, raterId: P.head._id, score: 4, feedback: RATING_NOTE });
  const clip = await MediaItem.create({ stageItemId: edit._id, contentPieceId: piece._id, url: 'https://example.test/approved.mp4', title: 'AccessBoundary approved', status: 'approved', uploadedBy: P.owner._id });
  const rejected = await MediaItem.create({ stageItemId: edit._id, contentPieceId: piece._id, url: 'https://example.test/rejected.mp4', title: 'AccessBoundary rejected', status: 'reshoot_needed', uploadedBy: P.owner._id });
  const message = await MediaMessage.create({ mediaItemId: clip._id, authorId: P.head._id, text: THREAD, seenBy: [] });
  const blocker = await Blocker.create({ workItemId: edit._id, blockedById: P.owner._id, reason: 'Other', notes: BLOCKER, status: 'Active', dependencyOwnerId: P.later._id });
  await ActivityEvent.create({ entityType: 'work_item', entityId: edit._id, actorId: P.head._id, action: 'work_item.feedback_submitted', metadata: { text: NOTE, comment: NOTE, title: 'AccessBoundary Edit' } });
  return { plan, piece, script, edit, post, scriptV1, scriptV2, sub, comment, scriptComment, rating, clip, rejected, message, blocker };
}

const cleanup = async () => {
  const pieces = (await ContentPiece.find({ topic: 'AccessBoundary' }).select('_id').lean()).map((x) => x._id);
  const ids = (await WorkItem.find({ title: /^AccessBoundary/ }).select('_id').lean()).map((x) => x._id);
  const clips = (await MediaItem.find({ stageItemId: { $in: ids } }).select('_id').lean()).map((x) => x._id);
  await MediaMessage.deleteMany({ mediaItemId: { $in: clips } });
  await MediaItem.deleteMany({ _id: { $in: clips } });
  await Rating.deleteMany({ workItemId: { $in: ids } });
  await SubmissionComment.deleteMany({ workItemId: { $in: ids } });
  await FeedbackEntry.deleteMany({ workItemId: { $in: ids } });
  await Blocker.deleteMany({ workItemId: { $in: ids } });
  await EditorLock.deleteMany({ workItemId: { $in: ids } });
  await ActivityEvent.deleteMany({ entityId: { $in: ids } });
  await Submission.deleteMany({ workItemId: { $in: ids } });
  await WorkItem.deleteMany({ _id: { $in: ids } });
  await ContentPiece.deleteMany({ _id: { $in: pieces } });
  await CalendarPlan.deleteMany({ code: /^ACCESS-/ });
  const people = (await Person.find({ email: /^access\.boundary\./ }).select('_id').lean()).map((x) => x._id);
  await mongoose.connection.db.collection('notifications').deleteMany({ recipient: { $in: people } });
  await Person.deleteMany({ _id: { $in: people } });
};

beforeAll(async () => {
  await connectDB();
  await cleanup();
  for (const [k, role] of [['head', 'creative_head'], ['admin', 'admin'], ['sm', 'sm_manager'], ['exec', 'executive'], ['owner', 'team_member'], ['earlier', 'team_member'], ['later', 'team_member'], ['outsider', 'team_member']]) {
    P[k] = await Person.create({ name: `Access ${k}`, email: EMAIL(k), role, status: 'active', phone: PHONE, whatsappNumber: PHONE });
  }
});
afterAll(cleanup);

/** The routes as Express holds them, so a new :id route cannot be missed. */
function routesOf(router) {
  return router.stack.filter((l) => l.route).flatMap((l) => Object.keys(l.route.methods).map((method) => ({ method, path: l.route.path })));
}

describe('Route inventory: every :id route', () => {
  let f;
  const missing = new mongoose.Types.ObjectId().toString();
  beforeAll(async () => {
    f = await fresh({ editStatus: 'In Progress' });
  });

  const MOUNTS = [
    { name: 'work items', router: workItemRoutes, prefixes: ['/api/work', '/api/work-items'], ids: (f2, p) => ({ id: f2.edit._id, stageItemId: f2.edit._id, commentId: f2.comment._id })[p] },
    { name: 'clips', router: clipsRouter, prefixes: ['/api/clips', '/clips'], ids: (f2, p) => ({ id: f2.clip._id, messageId: f2.message._id })[p] },
    { name: 'feedback', router: feedbackRouter, prefixes: ['/api/feedback'], ids: (f2, p) => ({ workItemId: f2.edit._id })[p] },
    { name: 'blockers', router: blockerRoutes, prefixes: ['/api/blockers'], ids: (f2, p) => ({ id: f2.blocker._id })[p] },
  ];
  const SUBMISSIONS = { name: 'submissions', router: submissionRoutes, prefixes: ['/api/submissions', '/submissions'] };
  const submissionId = (f2, path) => (path.startsWith('/ratings') ? f2.rating._id : path.startsWith('/comments') ? f2.comment._id : f2.sub._id);
  // Person routes answer about a person, not a deliverable: a team_member gets 403 whether or not they exist.
  const PERSON_ROUTES = ['/ratings/summary/:personId'];

  const paramNames = (path) => [...path.matchAll(/:(\w+)/g)].map((m) => m[1]);
  const fill = (path, resolve) => path.replace(/:(\w+)/g, (_, p) => resolve(p));

  const cases = () => {
    const out = [];
    for (const m of MOUNTS) {
      for (const r of routesOf(m.router)) {
        if (!r.path.includes(':')) continue;
        for (const prefix of m.prefixes) out.push({ ...r, prefix, real: (x) => fill(r.path, (p) => m.ids(x, p)) });
      }
    }
    for (const r of routesOf(SUBMISSIONS.router)) {
      if (!r.path.includes(':') || PERSON_ROUTES.includes(r.path)) continue;
      for (const prefix of SUBMISSIONS.prefixes) out.push({ ...r, prefix, real: (x) => fill(r.path, () => submissionId(x, r.path)) });
    }
    return out;
  };

  it('covers every :id route, and both aliases', () => {
    for (const m of MOUNTS) {
      for (const r of routesOf(m.router)) {
        for (const p of paramNames(r.path)) {
          expect(m.ids({ edit: {}, clip: {}, message: {}, comment: {}, blocker: {} }, p) !== undefined || m.ids({ edit: { _id: 1 }, clip: { _id: 1 }, message: { _id: 1 }, comment: { _id: 1 }, blocker: { _id: 1 } }, p) !== undefined, `${m.name} ${r.path} :${p} is not classified`).toBe(true);
        }
      }
    }
    const all = cases();
    expect(all.length).toBeGreaterThan(60);
    // The work item router also holds the routes added by submissions and media.
    const workPaths = routesOf(workItemRoutes).map((r) => r.path);
    for (const expected of ['/:id', '/:id/transition', '/:id/draft', '/:id/editor-lock', '/:id/comments', '/:id/comments/:commentId/resolve', '/:stageItemId/clips', '/:stageItemId/submit-clips', '/:stageItemId/shoot-review']) {
      expect(workPaths).toContain(expected);
    }
    expect(all.filter((c) => c.prefix === '/api/work-items').length).toBe(all.filter((c) => c.prefix === '/api/work').length);
  });

  it('every route answers 401 without a token, before anything about the object', async () => {
    for (const c of cases()) {
      for (const url of [c.real(f), c.path.replace(/:\w+/g, missing), c.path.replace(/:\w+/g, 'not-an-id')]) {
        const target = url.startsWith('/') && !url.startsWith(c.prefix) ? c.prefix + url : c.prefix + url;
        const res = await request(app)[c.method](target).send({});
        expect(res.status, `${c.method} ${target}`).toBe(401);
      }
    }
  }, 120000);

  it('a non-participant gets an identical 404 for a real, missing or invalid id, everywhere', async () => {
    for (const c of cases()) {
      const real = await call(c.method, c.prefix + c.real(f), 'outsider', {});
      const gone = await call(c.method, c.prefix + c.path.replace(/:\w+/g, missing), 'outsider', {});
      const bad = await call(c.method, c.prefix + c.path.replace(/:\w+/g, 'not-an-id'), 'outsider', {});
      const label = `${c.method} ${c.prefix}${c.path}`;
      expect(real.status, label).toBe(404);
      expect(gone.status, label).toBe(404);
      expect(bad.status, label).toBe(404);
      expect(gone.body, label).toEqual(real.body);
      expect(bad.body, label).toEqual(real.body);
    }
  }, 180000);

  it('permission checks still apply after the object check: a participant cannot use a route their role lacks', async () => {
    const res = await call('delete', `/api/work/${f.edit._id}`, 'owner');
    expect(res.status).toBe(403);
    const invalid = await call('delete', '/api/work/not-an-id', 'exec');
    expect(invalid.status).toBe(403);
  });

  it('other roles keep their invalid-id behaviour', async () => {
    expect((await call('get', '/api/work/not-an-id', 'sm')).status).toBe(400);
    expect((await call('get', '/api/submissions/not-an-id', 'head')).status).toBe(400);
    expect((await call('get', `/api/work/${missing}`, 'sm')).status).toBe(404);
  });

  it('routes that take the id in the body or query follow the same rule', async () => {
    const x = await fresh({ editStatus: 'In Progress' });
    for (const res of [
      await call('post', '/api/submissions', 'outsider', { workItemId: x.edit._id, contentUrl: 'https://example.test/y' }),
      await call('post', '/api/blockers', 'outsider', { workItemId: x.edit._id, reason: 'Other', note: 'x' }),
      await call('post', '/api/feedback', 'outsider', { workItemId: x.edit._id, text: 'x', isResponse: true }),
      await call('get', `/api/submissions?workItemId=${x.edit._id}`, 'outsider'),
    ]) {
      expect(res.status).toBe(404);
    }
    const byPiece = await call('get', `/api/submissions?contentPieceId=${x.piece._id}`, 'outsider');
    expect(byPiece.status).toBe(200);
    expect(byPiece.body).toEqual([]);
  });
});

describe('/transition ordering', () => {
  it.each([['same status', 'Pending', 'Pending'], ['invalid move', 'Not Started', 'Published'], ['valid move', 'In Progress', 'Blocked']])('a non-participant learns nothing: %s', async (_l, status, to) => {
    const x = await fresh({ editStatus: status });
    const res = await call('post', `/api/work/${x.edit._id}/transition`, 'outsider', { toStatus: to, blockerReason: 'Waiting for feedback' });
    expect(res.status).toBe(404);
    expect(text(res)).not.toContain('AccessBoundary');
  });

  it.each([['same status', 'Pending', 'Pending'], ['invalid move', 'Not Started', 'Published']])('a participant on another step gets 403, with no item or status: %s', async (_l, status, to) => {
    const x = await fresh({ editStatus: status });
    const res = await call('post', `/api/work/${x.edit._id}/transition`, 'later', { toStatus: to });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_OWNERSHIP');
    expect(text(res)).not.toContain('AccessBoundary');
  });

  it('an executive gets 403 even on a same-status request', async () => {
    const x = await fresh();
    expect((await call('post', `/api/work/${x.edit._id}/transition`, 'exec', { toStatus: 'Pending' })).status).toBe(403);
  });

  it('the owner still gets the same-status response', async () => {
    const x = await fresh();
    expect((await call('post', `/api/work/${x.edit._id}/transition`, 'owner', { toStatus: 'Pending' })).status).toBe(200);
  });
});

describe('Participants: pipeline status for every step, outputs only where allowed', () => {
  let f;
  beforeAll(async () => {
    f = await fresh();
  });

  it('see pipeline status for every step, with no other step\'s outputs', async () => {
    const res = await call('get', `/api/work/${f.post._id}`, 'later');
    expect(res.status).toBe(200);
    const stages = res.body.data.pieceStages;
    expect(stages.map((s) => s.status)).toEqual(['Approved', 'Pending', 'Not Started']);
    expect(stages[1].deliverableUrl).toBeUndefined();
    expect(stages[1].revisions).toBeUndefined();
    expect(text(res)).not.toContain('edit-output');
    // The earlier step is approved, so its output is visible.
    expect(stages[0].deliverableUrl).toBe('https://example.test/script-output');
  });

  it('a later step, seen by someone on an earlier one, shows status only', async () => {
    const res = await call('get', `/api/work/${f.post._id}`, 'earlier');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('Not Started');
    expect(res.body.data.pieceStages).toHaveLength(3);
    const edit = await call('get', `/api/work/${f.edit._id}`, 'earlier');
    expect(edit.status).toBe(200);
    const data = edit.body.data;
    for (const key of ['deliverableUrl', 'latestSubmission', 'draftSubmission', 'rating', 'rounds', 'blockerNote']) {
      expect(data[key], key).toBeUndefined();
    }
    expect(text(edit)).not.toContain('edit-output');
  });

  it('removes outputs from steps that are Mongoose documents, not only plain objects', async () => {
    const pieceStages = await WorkItem.find({ contentPieceId: f.edit.contentPieceId }).sort({ stageOrder: 1 });
    const item = { ...f.post.toObject(), pieceStages };
    const result = await applyWorkItemViewerRules(item, { _id: P.later._id, role: 'team_member' });
    const edit = result.pieceStages.find((s) => String(s._id) === String(f.edit._id));
    expect(edit.status).toBe('Pending');
    expect(edit.deliverableUrl).toBeUndefined();
    const json = JSON.stringify(result);
    expect(json).not.toContain('edit-output');
    expect(json).not.toContain('$__');
  });

  it('an unapproved earlier step shows status only', async () => {
    const res = await call('get', `/api/work/${f.edit._id}`, 'later');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('Pending');
    for (const key of ['deliverableUrl', 'latestSubmission', 'draftSubmission', 'rating']) expect(res.body.data[key], key).toBeUndefined();
    expect((await call('get', `/api/submissions/${f.sub._id}`, 'later')).status).toBe(403);
    expect((await call('get', `/api/submissions?workItemId=${f.edit._id}`, 'later')).body).toEqual([]);
    expect((await call('get', `/api/work/${f.edit._id}/clips`, 'later')).status).toBe(403);
  });

  it('later outputs are blocked', async () => {
    expect((await call('get', `/api/submissions/${f.sub._id}`, 'earlier')).status).toBe(403);
    expect((await call('get', `/api/submissions?workItemId=${f.edit._id}`, 'earlier')).body).toEqual([]);
    expect((await call('get', `/api/work/${f.edit._id}/submissions`, 'earlier')).body.data ?? []).toEqual([]);
    expect((await call('get', `/api/work/${f.edit._id}/clips`, 'earlier')).status).toBe(403);
  });

  it('an approved earlier output is visible; its unapproved versions are not', async () => {
    const approved = await call('get', `/api/submissions/${f.scriptV2._id}`, 'owner');
    expect(approved.status).toBe(200);
    expect(approved.body.data?.linkUrl ?? approved.body.linkUrl).toBe('https://example.test/script-v2');
    expect((await call('get', `/api/submissions/${f.scriptV1._id}`, 'owner')).status).toBe(403);
    const list = await call('get', `/api/submissions?workItemId=${f.script._id}`, 'owner');
    expect(list.body.map((s) => s.version)).toEqual([2]);
  });

  it('an earlier step\'s review thread and notes stay private, even on its approved output', async () => {
    const approved = await call('get', `/api/submissions/${f.scriptV2._id}`, 'owner');
    expect(text(approved)).not.toContain(NOTE);
    const item = await call('get', `/api/work/${f.script._id}`, 'owner');
    expect(item.status).toBe(200);
    expect(item.body.data.deliverableUrl).toBe('https://example.test/script-output');
    expect(text(item)).not.toContain(NOTE);
  });

  it('a step\'s own owner keeps everything', async () => {
    const res = await call('get', `/api/work/${f.edit._id}`, 'owner');
    expect(res.body.data.deliverableUrl).toBe('https://example.test/edit-output');
    expect(res.body.data.draftSubmission).toBeTruthy();
    expect(res.body.data.rating.feedback).toBe(RATING_NOTE);
    expect(text(await call('get', `/api/submissions/${f.sub._id}`, 'owner'))).toContain(NOTE);
    expect(text(await call('get', `/api/work/${f.edit._id}/comments`, 'owner'))).toContain(NOTE);
  });

  describe('clips of an approved earlier step', () => {
    let s;
    beforeAll(async () => {
      s = await fresh({ editStatus: 'Approved', shootEdit: true });
    });

    it('a later participant sees only approved clips, with no thread', async () => {
      const res = await call('get', `/api/work/${s.edit._id}/clips`, 'later');
      expect(res.status).toBe(200);
      const titles = (res.body.data.clips || []).map((c) => c.title);
      expect(titles).toEqual(['AccessBoundary approved']);
      expect(text(res)).not.toContain('rejected');
      expect(text(res)).not.toContain(THREAD);
    });

    it('a replaced clip is not shown', async () => {
      const x = await fresh({ editStatus: 'Approved', shootEdit: true });
      await MediaItem.create({ stageItemId: x.edit._id, url: 'https://example.test/new.mp4', title: 'AccessBoundary replacement', status: 'approved', replacesId: x.clip._id, uploadedBy: P.owner._id });
      const res = await call('get', `/api/work/${x.edit._id}/clips`, 'later');
      expect((res.body.data.clips || []).map((c) => c.title)).toEqual(['AccessBoundary replacement']);
    });

    it('someone earlier in the piece cannot see them', async () => {
      expect((await call('get', `/api/work/${s.edit._id}/clips`, 'earlier')).status).toBe(403);
    });
  });
});

describe('Private review: owner, admin, creative_head and sm_manager only', () => {
  let f;
  beforeAll(async () => {
    f = await fresh();
  });

  it.each(['owner', 'head', 'admin', 'sm'])('%s can read revision notes and the clip thread', async (who) => {
    expect(text(await call('get', `/api/work/${f.edit._id}/comments`, who))).toContain(NOTE);
    expect(text(await call('get', `/api/submissions/${f.sub._id}/comments`, who))).toContain(NOTE);
    expect(text(await call('get', `/api/submissions/${f.sub._id}`, who))).toContain(NOTE);
    expect(text(await call('get', `/api/feedback/work-item/${f.edit._id}`, who))).toContain(NOTE);
    expect(text(await call('get', `/api/clips/${f.clip._id}/messages`, who))).toContain(THREAD);
    expect(text(await call('get', `/api/work/${f.edit._id}`, who))).toContain(RATING_NOTE);
  });

  it.each(['exec', 'earlier', 'later'])('%s cannot read any of them', async (who) => {
    for (const url of [`/api/work/${f.edit._id}`, `/api/work/${f.edit._id}/comments`, `/api/submissions/${f.sub._id}`, `/api/submissions/${f.sub._id}/comments`, `/api/feedback/work-item/${f.edit._id}`, `/api/clips/${f.clip._id}/messages`, `/api/work/${f.edit._id}/activity`]) {
      const t = text(await call('get', url, who));
      expect(t, url).not.toContain(NOTE);
      expect(t, url).not.toContain(THREAD);
      expect(t, url).not.toContain(RATING_NOTE);
    }
  });

  it('an executive keeps the rating score, without the feedback', async () => {
    const res = await call('get', `/api/work/${f.edit._id}`, 'exec');
    expect(res.body.data.rating.score).toBe(4);
    expect(res.body.data.rating.feedback).toBeUndefined();
    const summaryText = text(await call('get', `/api/submissions/ratings/summary/${P.owner._id}`, 'exec'));
    expect(summaryText).not.toContain(RATING_NOTE);
  });

  it('feedback threads hide the note from an executive; sm_manager still sees it', async () => {
    expect(text(await call('get', '/api/feedback/threads', 'exec'))).not.toContain(NOTE);
    expect(text(await call('get', '/api/feedback/threads', 'sm'))).toContain(NOTE);
  });

  it('activity keeps who did what, without the private text', async () => {
    const exec = await call('get', `/api/work/${f.edit._id}/activity`, 'exec');
    expect(exec.status).toBe(200);
    expect((exec.body.data || []).some((e) => e.action === 'work_item.feedback_submitted')).toBe(true);
    expect(text(exec)).not.toContain(NOTE);
    expect(text(await call('get', `/api/work/${f.edit._id}/activity`, 'sm'))).toContain(NOTE);
  });
});

describe('Contact details', () => {
  let f;
  beforeAll(async () => {
    f = await fresh();
  });
  const others = (k) => ['head', 'admin', 'sm', 'exec', 'owner', 'earlier', 'later', 'outsider'].filter((x) => x !== k).map(EMAIL);
  const expectNoOtherContact = (res, viewer, label) => {
    const t = text(res);
    for (const email of others(viewer)) expect(t, `${label}: ${email}`).not.toContain(email);
  };

  const REST = (x) => [
    `/api/work/${x.edit._id}`,
    `/api/work/${x.edit._id}/activity`,
    `/api/work/${x.edit._id}/submissions`,
    `/api/submissions/${x.sub._id}`,
    `/api/feedback/work-item/${x.edit._id}`,
    `/api/clips/${x.clip._id}/messages`,
    `/api/work/${x.edit._id}/clips`,
    '/api/blockers',
    '/api/work',
    '/api/work/calendar',
    '/api/my-work',
    '/api/notifications',
  ];

  it('a team_member sees no one else\'s contact details, nested or not', async () => {
    for (const who of ['owner', 'later']) {
      for (const url of REST(f)) {
        const res = await call('get', url, who);
        if (res.status === 200) expectNoOtherContact(res, who, `${who} ${url}`);
      }
    }
  });

  it('an executive sees no one else\'s, on nested and leadership responses', async () => {
    const urls = [...REST(f).filter((u) => !u.includes('/messages') && u !== '/api/my-work'), '/api/submissions/review-queue', '/api/feedback/threads', '/api/calendar-plans', `/api/calendar-plans/${f.plan._id}`, '/api/content-pieces', '/api/revisions/flags', `/api/team/${P.owner._id}`, `/api/team/${P.owner._id}/activity`];
    for (const url of urls) {
      const res = await call('get', url, 'exec');
      expect(res.status, url).toBe(200);
      expectNoOtherContact(res, 'exec', url);
      expect(text(res), url).not.toContain(PHONE);
    }
  });

  it.each(['exec', 'owner'])('%s still sees their own details on their own profile', async (who) => {
    const me = await call('get', '/api/me/profile', who);
    expect(me.status).toBe(200);
    expect(text(me)).toContain(EMAIL(who));
    expect(text(me)).toContain(PHONE);
    const auth = await call('get', '/api/auth/me', who);
    expect(auth.status).toBe(200);
    expect(text(auth)).toContain(EMAIL(who));
    const team = await call('get', `/api/team/${P[who]._id}`, who);
    expect(team.status).toBe(200);
    expect(text(team)).toContain(EMAIL(who));
    expect(text(team)).toContain(PHONE);
  });

  it('settings named email are kept: only contact values are removed', async () => {
    const settings = await call('get', '/api/me/settings', 'owner');
    expect(settings.status).toBe(200);
    expect(text(settings)).toContain('"email":true');
  });

  it('leadership screens are unchanged for admin, creative_head and sm_manager', async () => {
    for (const who of ['admin', 'head', 'sm']) {
      for (const url of [`/api/work/${f.edit._id}`, '/api/content-pieces', `/api/calendar-plans/${f.plan._id}`, '/api/submissions/review-queue']) {
        const res = await call('get', url, who);
        expect(res.status, `${who} ${url}`).toBe(200);
      }
      expect(text(await call('get', `/api/work/${f.edit._id}`, who))).toContain(EMAIL('owner'));
    }
  });

  it('notifications carry no contact details for a team_member', async () => {
    const x = await fresh();
    await call('post', `/api/submissions/${x.sub._id}/request-revision`, 'head', { comment: 'Please change' });
    const res = await call('get', '/api/notifications', 'owner');
    expect(res.status).toBe(200);
    expectNoOtherContact(res, 'owner', 'notifications');
  });
});

describe('Blockers', () => {
  let f;
  let other;
  beforeAll(async () => {
    f = await fresh({ editStatus: 'In Progress' });
    // A blocker on a deliverable none of these team members is on.
    const stranger = await Person.create({ name: 'Access stranger', email: EMAIL('stranger'), role: 'team_member', status: 'active' });
    const step = await WorkItem.create({ title: 'AccessBoundary Other', workType: 'Reel', stageKey: 'Edit', stageOrder: 1, status: 'In Progress', ownerId: stranger._id, deadline: new Date('2031-05-10'), departmentId: dept, profileId: new mongoose.Types.ObjectId() });
    other = await Blocker.create({ workItemId: step._id, blockedById: stranger._id, reason: 'Other', notes: 'STRANGERS_BLOCKER', status: 'Active' });
  });

  it.each(['owner', 'earlier', 'later'])('%s sees the blocker on their deliverable, not others', async (who) => {
    const res = await call('get', '/api/blockers', who);
    expect(res.status).toBe(200);
    expect(text(res)).toContain(BLOCKER);
    expect(text(res)).not.toContain('STRANGERS_BLOCKER');
  });

  it('a non-participant sees neither', async () => {
    const t = text(await call('get', '/api/blockers', 'outsider'));
    expect(t).not.toContain(BLOCKER);
    expect(t).not.toContain('STRANGERS_BLOCKER');
  });

  it.each(['head', 'admin', 'sm', 'exec'])('%s keeps seeing all of them', async (who) => {
    const t = text(await call('get', '/api/blockers', who));
    expect(t).toContain(BLOCKER);
    expect(t).toContain('STRANGERS_BLOCKER');
  });

  describe.each([['resolve', 'patch', 'resolve', { resolutionNotes: 'x' }], ['notify', 'post', 'notify', {}]])('%s', (_l, method, action, body) => {
    const url = (b) => `/api/blockers/${b._id}/${action}`;
    it('a non-participant gets the identical 404', async () => {
      const x = await fresh({ editStatus: 'In Progress' });
      const real = await call(method, url(x.blocker), 'outsider', body);
      const gone = await call(method, `/api/blockers/${new mongoose.Types.ObjectId()}/${action}`, 'outsider', body);
      const bad = await call(method, `/api/blockers/not-an-id/${action}`, 'outsider', body);
      expect(real.status).toBe(404);
      expect(gone.body).toEqual(real.body);
      expect(bad.body).toEqual(real.body);
    });

    it('a participant on another step gets 403, and nothing changes', async () => {
      const x = await fresh({ editStatus: 'In Progress' });
      expect((await call(method, url(x.blocker), 'later', body)).status).toBe(403);
      const after = await Blocker.findById(x.blocker._id).lean();
      expect(after.status).toBe('Active');
      expect(after.lastNotifiedAt ?? null).toBeNull();
    });

    it.each(['owner', 'sm', 'admin'])('%s can do it', async (who) => {
      const x = await fresh({ editStatus: 'In Progress' });
      expect((await call(method, url(x.blocker), who, body)).status).toBe(200);
    });

    it.each(['exec', 'head'])('%s cannot', async (who) => {
      const x = await fresh({ editStatus: 'In Progress' });
      expect((await call(method, url(x.blocker), who, body)).status).toBe(403);
    });
  });
});

describe('Editor lock and clip messages seen', () => {
  it('only the step owner or an admin can hold the lock', async () => {
    const x = await fresh({ editStatus: 'In Progress' });
    const url = `/api/work/${x.edit._id}/editor-lock`;
    expect((await call('post', url, 'outsider', {})).status).toBe(404);
    for (const who of ['later', 'earlier', 'exec', 'sm', 'head']) {
      expect((await call('post', url, who, {})).status, who).toBe(403);
      expect((await call('delete', url, who)).status, who).toBe(403);
    }
    expect(await EditorLock.findOne({ workItemId: x.edit._id })).toBeNull();
    expect((await call('post', url, 'owner', {})).status).toBe(200);
    expect(await EditorLock.findOne({ workItemId: x.edit._id })).not.toBeNull();
    expect((await call('post', url, 'admin', {})).status).toBe(200);
  });

  it('no one can lock a step that does not exist', async () => {
    const missing = new mongoose.Types.ObjectId();
    for (const who of ['exec', 'admin', 'owner']) {
      expect((await call('post', `/api/work/${missing}/editor-lock`, who, {})).status).toBe(404);
    }
    expect(await EditorLock.findOne({ workItemId: missing })).toBeNull();
  });

  it('only someone who can read a thread can mark it seen', async () => {
    const x = await fresh();
    const url = `/api/clips/${x.clip._id}/messages/seen`;
    const seenBy = async () => (await MediaMessage.findById(x.message._id).lean()).seenBy.length;
    expect((await call('post', url, 'outsider', {})).status).toBe(404);
    for (const who of ['exec', 'later', 'earlier']) expect((await call('post', url, who, {})).status, who).toBe(403);
    expect(await seenBy()).toBe(0);
    expect((await call('post', url, 'owner', {})).status).toBe(200);
    expect(await seenBy()).toBe(1);
    expect((await call('post', url, 'sm', {})).status).toBe(200);
  });
});
