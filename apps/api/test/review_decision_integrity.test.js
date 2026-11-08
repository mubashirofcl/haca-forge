import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import mongoose from 'mongoose';
import { WORK_ACTION_KEYS, ACTION_LABELS } from '@mmp/shared';
import { app } from '../src/server.js';
import { env } from '../src/config/env.js';
import { connectDB } from '../src/config/db.js';
import { Person } from '../src/modules/people/model.js';
import { WorkItem } from '../src/modules/workItems/model.js';
import { Submission, SubmissionComment, Rating } from '../src/modules/submissions/model.js';
import { MediaItem } from '../src/modules/media/model.js';
import { FeedbackEntry } from '../src/modules/feedback/model.js';
import { ActivityEvent } from '../src/modules/activity/model.js';

const TITLE = 'ReviewDecision';
const P = {};
const token = (k) => jwt.sign({ userId: P[k]._id.toString(), email: P[k].email, role: P[k].role }, env.JWT_SECRET, { expiresIn: '1h' });
const call = (method, url, who, body) => request(app)[method](url).set('Authorization', `Bearer ${token(who)}`).send(body);

const makeStep = (stageKey = 'Design', status = 'Pending', extra = {}) =>
  WorkItem.create({
    title: `${TITLE} ${stageKey}`,
    workType: 'Reel',
    stageKey,
    stageOrder: 1,
    status,
    isLocked: false,
    ownerId: P.owner._id,
    reviewRequired: true,
    deadline: new Date('2031-05-10'),
    dueDate: new Date('2031-05-10'),
    startedAt: new Date(Date.now() - 3600000),
    rounds: [{ roundNumber: 1, startedAt: new Date(Date.now() - 3600000), intervals: [] }],
    departmentId: new mongoose.Types.ObjectId(),
    profileId: new mongoose.Types.ObjectId(),
    ...extra,
  });
const makeSub = (w, version = 1, status = 'submitted', extra = {}) =>
  Submission.create({
    workItemId: w._id,
    stageKey: w.stageKey,
    version,
    kind: 'video',
    status,
    submittedById: w.ownerId,
    submittedAt: version > 0 ? new Date(Date.now() - 1000 * (20 - version)) : null,
    linkUrl: 'https://drive.google.com/file/d/x',
    ...extra,
  });
const makeClip = (w, status = 'approved', extra = {}) =>
  MediaItem.create({ stageItemId: w._id, uploadedBy: P.owner._id, kind: 'video', url: 'https://drive.google.com/file/d/c.mp4', title: `${TITLE} clip`, take: 1, order: 0, version: 1, status, ...extra });

const approve = (s, who = 'head', body = { score: 4 }) => call('post', `/api/submissions/${s._id}/approve`, who, body);
const revise = (s, who = 'head') => call('post', `/api/submissions/${s._id}/request-revision`, who, { comment: 'Please change this' });
const shoot = (w, who = 'head', body = { score: 4 }) => call('post', `/api/work/${w._id}/shoot-review`, who, body);
const feedback = (w, who = 'head', roundStatus = 'Revision Required') => call('post', `/api/feedback/work-item/${w._id}`, who, { text: 'A review note', roundStatus });
const move = (w, who, toStatus) => call('post', `/api/work/${w._id}/transition`, who, { toStatus });

/** Everything a decision could have written for this step. */
const state = async (w) => {
  const step = await WorkItem.findById(w._id).lean();
  const subs = await Submission.find({ workItemId: w._id }).sort({ version: 1 }).lean();
  return {
    step: { status: step.status, revisions: step.revisions || 0, approvedAt: step.approvedAt || null, decisionAt: step.decisionAt || null, rounds: (step.rounds || []).length },
    subs: subs.map((s) => ({ v: s.version, status: s.status, reviewedById: s.reviewedById ? String(s.reviewedById) : null, reviewedAt: s.reviewedAt || null })),
    ratings: await Rating.countDocuments({ workItemId: w._id }),
    comments: await SubmissionComment.countDocuments({ workItemId: w._id }),
    entries: await FeedbackEntry.countDocuments({ workItemId: w._id }),
    decisionEvents: await ActivityEvent.countDocuments({
      action: { $in: ['submission.approved', 'submission.revision_requested', 'rating.given', 'work_item.feedback_submitted'] },
      $or: [{ 'metadata.workItemId': w._id }, { entityId: w._id }, { entityId: { $in: subs.map((s) => s._id) } }],
    }),
  };
};
const expectUnchanged = async (w, before) => expect(await state(w)).toEqual(before);

const cleanup = async () => {
  const ids = (await WorkItem.find({ title: new RegExp(`^${TITLE}`) }).select('_id').lean()).map((x) => x._id);
  const subs = (await Submission.find({ workItemId: { $in: ids } }).select('_id').lean()).map((x) => x._id);
  const ratings = (await Rating.find({ workItemId: { $in: ids } }).select('_id').lean()).map((x) => x._id);
  await ActivityEvent.deleteMany({ entityId: { $in: [...ids, ...subs, ...ratings] } });
  await Rating.deleteMany({ workItemId: { $in: ids } });
  await SubmissionComment.deleteMany({ workItemId: { $in: ids } });
  await FeedbackEntry.deleteMany({ workItemId: { $in: ids } });
  await MediaItem.deleteMany({ stageItemId: { $in: ids } });
  await Submission.deleteMany({ workItemId: { $in: ids } });
  const db = mongoose.connection.db;
  await db.collection('revisionflags').deleteMany({ workItemId: { $in: ids } });
  const people = (await Person.find({ email: /^review\.decision\./ }).select('_id').lean()).map((x) => x._id);
  await db.collection('notifications').deleteMany({ recipient: { $in: people } });
  await WorkItem.deleteMany({ _id: { $in: ids } });
  await Person.deleteMany({ _id: { $in: people } });
};

beforeAll(async () => {
  await connectDB();
  await cleanup();
  for (const [k, role] of [['head', 'creative_head'], ['admin', 'admin'], ['sm', 'sm_manager'], ['exec', 'executive'], ['owner', 'team_member'], ['other', 'team_member']]) {
    P[k] = await Person.create({ name: `Decision ${k}`, email: `review.decision.${k}@example.com`, role, status: 'active' });
  }
});
afterEach(() => vi.restoreAllMocks());
afterAll(cleanup);

describe('Approving through the review flow', () => {
  it('approves the latest submission with one rating and the full record', async () => {
    const w = await makeStep();
    const s = await makeSub(w);
    const res = await approve(s, 'head', { score: 5 });
    expect(res.status).toBe(200);
    const after = await state(w);
    expect(after.step.status).toBe('Approved');
    expect(after.subs[0].status).toBe('approved');
    expect(after.ratings).toBe(1);
    expect(await ActivityEvent.countDocuments({ action: 'submission.approved', entityId: s._id })).toBe(1);
    const rating = await Rating.findOne({ workItemId: w._id }).lean();
    expect(rating.score).toBe(5);
    expect(await ActivityEvent.countDocuments({ action: 'rating.given', entityId: rating._id })).toBe(1);
  });

  it('refuses an older version and writes nothing', async () => {
    const w = await makeStep('Edit');
    const v1 = await makeSub(w, 1);
    await makeSub(w, 2);
    const before = await state(w);
    const res = await approve(v1);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('STALE_SUBMISSION');
    await expectUnchanged(w, before);
  });

  it('a repeat approval is refused and does not overwrite the reviewer', async () => {
    const w = await makeStep();
    const s = await makeSub(w);
    expect((await approve(s, 'head', { score: 5 })).status).toBe(200);
    const before = await state(w);
    const again = await approve(s, 'admin', { score: 1 });
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('ALREADY_DECIDED');
    await expectUnchanged(w, before);
    expect((await Rating.findOne({ workItemId: w._id }).lean()).score).toBe(5);
  });

  it('simultaneous approvals of one version create one rating', async () => {
    const w = await makeStep();
    const s = await makeSub(w);
    const res = await Promise.all([1, 2, 3, 4, 5].map(() => approve(s)));
    expect(res.filter((r) => r.status === 200)).toHaveLength(1);
    expect(res.filter((r) => r.status === 409)).toHaveLength(4);
    expect((await state(w)).ratings).toBe(1);
  });

  it('simultaneous approvals of two versions approve only the latest', async () => {
    const w = await makeStep('Edit');
    const v1 = await makeSub(w, 1);
    const v2 = await makeSub(w, 2);
    const res = await Promise.all([approve(v1), approve(v2)]);
    expect(res.map((r) => r.status).sort()).toEqual([200, 409]);
    const after = await state(w);
    expect(after.ratings).toBe(1);
    expect(after.subs.map((s) => s.status)).toEqual(['submitted', 'approved']);
  });

  it.each(['Not Started', 'In Progress', 'Blocked', 'Approved', 'Published'])('refuses while the step is %s, leaving no rating', async (status) => {
    const w = await makeStep('Design', status);
    const s = await makeSub(w);
    const before = await state(w);
    expect((await approve(s)).status).toBe(409);
    await expectUnchanged(w, before);
  });

  it.each([[{}], [{ score: 0 }], [{ score: 6 }], [{ score: 3.5 }], [{ score: 'four' }]])('a missing or invalid rating leaves no writes: %j', async (body) => {
    const w = await makeStep();
    const s = await makeSub(w);
    const before = await state(w);
    expect((await approve(s, 'head', body)).status).toBe(400);
    await expectUnchanged(w, before);
  });

  it('refuses a version submitted before the last decision', async () => {
    const w = await makeStep('Design', 'Pending', { decisionAt: new Date() });
    const s = await makeSub(w);
    const before = await state(w);
    expect((await approve(s)).status).toBe(409);
    await expectUnchanged(w, before);
  });
});

describe('Requesting a revision', () => {
  it('applies to the latest submission only', async () => {
    const w = await makeStep();
    const s = await makeSub(w);
    expect((await revise(s)).status).toBe(200);
    const after = await state(w);
    expect(after.step).toMatchObject({ status: 'In Progress', revisions: 1, rounds: 2 });
    expect(after.subs.find((x) => x.v === 1).status).toBe('changes_requested');
    expect(after.comments).toBe(1);
    expect(after.ratings).toBe(0);
  });

  it('refuses an older version', async () => {
    const w = await makeStep();
    const v1 = await makeSub(w, 1);
    await makeSub(w, 2);
    const before = await state(w);
    expect((await revise(v1)).status).toBe(409);
    await expectUnchanged(w, before);
  });

  it.each(['Approved', 'Published', 'In Progress'])('refuses while the step is %s', async (status) => {
    const w = await makeStep('Design', status);
    const s = await makeSub(w);
    const before = await state(w);
    expect((await revise(s)).status).toBe(409);
    await expectUnchanged(w, before);
  });

  it('a decided version cannot be sent back, and its rating stays', async () => {
    const w = await makeStep();
    const s = await makeSub(w);
    await approve(s);
    const before = await state(w);
    expect((await revise(s)).status).toBe(409);
    await expectUnchanged(w, before);
    expect(before.ratings).toBe(1);
  });

  it('approve and revise at the same moment: one decision wins', async () => {
    const w = await makeStep();
    const s = await makeSub(w);
    const res = await Promise.all([approve(s), revise(s)]);
    expect(res.map((r) => r.status).sort()).toEqual([200, 409]);
    const after = await state(w);
    expect(['approved', 'changes_requested']).toContain(after.subs.find((x) => x.v === 1).status);
    expect(after.ratings).toBe(after.subs.find((x) => x.v === 1).status === 'approved' ? 1 : 0);
  });
});

describe('Reviewer rule on every decision path', () => {
  const paths = {
    approve: async (w, who) => approve(await makeSub(w), who),
    'request revision': async (w, who) => revise(await makeSub(w), who),
    'shoot approve': async (w, who) => {
      await makeSub(w);
      await makeClip(w);
      return shoot(w, who);
    },
    'shoot send back': async (w, who) => {
      await makeSub(w);
      await makeClip(w, 'reshoot_needed');
      return shoot(w, who, { note: 'Reshoot' });
    },
    'feedback revision': async (w, who) => {
      await makeSub(w);
      return feedback(w, who);
    },
    'transition approve': async (w, who) => move(w, who, 'Approved'),
    'transition revision': async (w, who) => move(w, who, 'Feedback'),
  };

  describe.each(Object.keys(paths))('%s', (name) => {
    it.each(['head', 'admin'])('%s cannot decide on their own work', async (who) => {
      const w = await makeStep(name.startsWith('shoot') ? 'Shoot' : 'Design', 'Pending', { ownerId: P[who]._id });
      const res = await paths[name](w, who);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN_SELF_APPROVAL');
      expect((await state(w)).ratings).toBe(0);
      expect((await WorkItem.findById(w._id).lean()).status).toBe('Pending');
    });

    it.each([['sm', 403], ['exec', 403], ['other', 404]])('%s cannot decide', async (who, status) => {
      const w = await makeStep(name.startsWith('shoot') ? 'Shoot' : 'Design');
      const res = await paths[name](w, who);
      expect(res.status).toBe(status);
      expect((await state(w)).ratings).toBe(0);
      expect((await WorkItem.findById(w._id).lean()).status).toBe('Pending');
    });

    it('the owner cannot decide', async () => {
      const w = await makeStep(name.startsWith('shoot') ? 'Shoot' : 'Design');
      expect((await paths[name](w, 'owner')).status).toBe(403);
      expect((await WorkItem.findById(w._id).lean()).status).toBe('Pending');
    });
  });
});

describe('Shoot review', () => {
  it('approval matches the normal route: status, rating and events', async () => {
    const w = await makeStep('Shoot');
    const s = await makeSub(w);
    await makeClip(w);
    expect((await shoot(w)).status).toBe(200);
    const after = await state(w);
    expect(after.step.status).toBe('Approved');
    expect(after.subs[0].status).toBe('approved');
    expect(after.ratings).toBe(1);
    expect(await ActivityEvent.countDocuments({ action: 'submission.approved', entityId: s._id })).toBe(1);
    const rating = await Rating.findOne({ workItemId: w._id }).lean();
    expect(await ActivityEvent.countDocuments({ action: 'rating.given', entityId: rating._id })).toBe(1);
  });

  it.each(['waiting_review', 'uploaded', 'uploading'])('is blocked while a required clip is %s', async (clipStatus) => {
    const w = await makeStep('Shoot');
    await makeSub(w);
    await makeClip(w);
    await makeClip(w, clipStatus);
    const before = await state(w);
    const res = await shoot(w);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('CLIPS_WAITING_REVIEW');
    await expectUnchanged(w, before);
  });

  describe('the normal approve route applies the same clip rule', () => {
    it.each(['waiting_review', 'uploaded', 'reshoot_needed'])('blocked while a clip is %s', async (clipStatus) => {
      const w = await makeStep('Shoot');
      const s = await makeSub(w);
      await makeClip(w);
      await makeClip(w, clipStatus);
      const before = await state(w);
      const res = await approve(s);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('CLIPS_WAITING_REVIEW');
      await expectUnchanged(w, before);
    });

    it('blocked with no clips at all', async () => {
      const w = await makeStep('Shoot');
      const s = await makeSub(w);
      const before = await state(w);
      expect((await approve(s)).status).toBe(400);
      await expectUnchanged(w, before);
    });

    it('allowed once every clip is approved', async () => {
      const w = await makeStep('Shoot');
      const s = await makeSub(w);
      await makeClip(w);
      expect((await approve(s)).status).toBe(200);
      expect((await state(w)).ratings).toBe(1);
    });
  });

  it('a clip replaced by an approved one no longer blocks approval', async () => {
    const w = await makeStep('Shoot');
    await makeSub(w);
    const old = await makeClip(w, 'reshoot_needed');
    await makeClip(w, 'approved', { replacesId: old._id, version: 2 });
    expect((await shoot(w)).status).toBe(200);
    expect((await state(w)).step.status).toBe('Approved');
  });

  it('a replacement still awaiting review blocks approval', async () => {
    const w = await makeStep('Shoot');
    await makeSub(w);
    const old = await makeClip(w, 'reshoot_needed');
    await makeClip(w, 'waiting_review', { replacesId: old._id, version: 2 });
    expect((await shoot(w)).status).toBe(400);
  });

  it('clip-level review still works and does not decide the step', async () => {
    const w = await makeStep('Shoot');
    await makeSub(w);
    const clip = await makeClip(w, 'waiting_review');
    const res = await call('post', `/api/clips/${clip._id}/review`, 'head', { action: 'approve' });
    expect(res.status).toBe(200);
    const after = await state(w);
    expect(after.step.status).toBe('Pending');
    expect(after.ratings).toBe(0);
    expect((await MediaItem.findById(clip._id).lean()).status).toBe('approved');
  });

  it('a flagged clip returns the step to In Progress, closes the version and creates no rating', async () => {
    const submittedAt = new Date(Date.now() - 60000);
    const w = await makeStep('Shoot', 'Pending', { submittedAt, rounds: [{ roundNumber: 1, startedAt: new Date(Date.now() - 3600000), submittedAt, intervals: [] }] });
    await makeSub(w);
    await makeClip(w, 'reshoot_needed');
    expect((await shoot(w, 'head', { note: 'Reshoot' })).status).toBe(200);
    const after = await state(w);
    expect(after.step).toMatchObject({ status: 'In Progress', revisions: 1, rounds: 2 });
    expect(after.subs[0].status).toBe('changes_requested');
    expect(after.ratings).toBe(0);
    const [reviewed, next] = (await WorkItem.findById(w._id).lean()).rounds;
    expect(reviewed.decision).toBe('changes_requested');
    expect(reviewed.submittedAt.getTime()).toBe(submittedAt.getTime());
    expect(next.decision ?? null).toBeNull();
    expect(next.submittedAt ?? null).toBeNull();
  });

  it('a flagged clip on a step in Feedback does the same, and counts one revision', async () => {
    const w = await makeStep('Shoot', 'Feedback');
    await makeSub(w);
    await makeClip(w, 'reshoot_needed');
    expect((await shoot(w, 'head', { note: 'Reshoot' })).status).toBe(200);
    const after = await state(w);
    expect(after.step).toMatchObject({ status: 'In Progress', revisions: 1 });
  });

  it('after a send back the owner is told to rework, and can resubmit clips for review', async () => {
    const w = await makeStep('Shoot');
    await makeSub(w);
    const flagged = await makeClip(w, 'reshoot_needed');
    await shoot(w, 'head', { note: 'Reshoot' });

    const { getMyWork } = await import('../src/modules/workItems/service.js');
    const buckets = await getMyWork(P.owner);
    const mine = Object.values(buckets).flat().find((i) => i._id && String(i._id) === String(w._id));
    expect(mine.status).toBe('In Progress');
    expect(mine.latestSubmissionStatus).toBe('changes_requested');
    const { getAvailableActions } = await import('@mmp/shared');
    expect(getAvailableActions(P.owner, mine).actions).toContain('submit_for_approval');

    // A flagged clip must be replaced first.
    expect((await call('post', `/api/work/${w._id}/submit-clips`, 'owner')).status).toBe(400);
    await makeClip(w, 'uploaded', { replacesId: flagged._id, version: 2 });
    expect((await call('post', `/api/work/${w._id}/submit-clips`, 'owner')).status).toBe(200);
    const after = await state(w);
    expect(after.step.status).toBe('Pending');
    expect(after.subs.map((s) => s.status)).toEqual(['changes_requested', 'submitted']);
    expect(after.step.revisions).toBe(1);
  });

  it.each([[{}], [{ score: 0 }], [{ score: 6 }]])('a missing or invalid rating leaves no writes: %j', async (body) => {
    const w = await makeStep('Shoot');
    await makeSub(w);
    await makeClip(w);
    const before = await state(w);
    expect((await shoot(w, 'head', body)).status).toBe(400);
    await expectUnchanged(w, before);
  });

  it('a draft is never rated, and no submission is invented', async () => {
    const w = await makeStep('Shoot');
    await makeSub(w, 0, 'draft');
    await makeClip(w);
    const before = await state(w);
    const res = await shoot(w);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('NO_SUBMISSION');
    await expectUnchanged(w, before);
  });

  it('a repeat is refused; simultaneous reviews create one rating', async () => {
    const w = await makeStep('Shoot');
    await makeSub(w);
    await makeClip(w);
    const res = await Promise.all([1, 2, 3].map(() => shoot(w)));
    expect(res.filter((r) => r.status === 200)).toHaveLength(1);
    expect((await shoot(w)).status).toBe(409);
    expect((await state(w)).ratings).toBe(1);
  });

  it('an already approved step is refused', async () => {
    const w = await makeStep('Shoot', 'Approved');
    await makeSub(w);
    await makeClip(w);
    const before = await state(w);
    expect((await shoot(w)).status).toBe(409);
    await expectUnchanged(w, before);
  });
});

describe('Feedback route', () => {
  it.each(['head', 'admin'])('cannot approve: 409 for %s, with no writes', async (who) => {
    const w = await makeStep();
    await makeSub(w);
    const before = await state(w);
    const res = await feedback(w, who, 'Approved');
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('USE_REVIEW_FLOW');
    await expectUnchanged(w, before);
  });

  it('Revision Required decides the latest version', async () => {
    const w = await makeStep();
    await makeSub(w);
    expect((await feedback(w)).status).toBe(201);
    const after = await state(w);
    expect(after.step).toMatchObject({ status: 'Feedback', revisions: 1 });
    expect(after.subs[0].status).toBe('changes_requested');
    expect(after.entries).toBe(1);
  });

  it.each(['Approved', 'Published', 'In Progress', 'Not Started'])('Revision Required is refused while the step is %s', async (status) => {
    const w = await makeStep('Design', status);
    await makeSub(w);
    const before = await state(w);
    expect((await feedback(w)).status).toBe(409);
    await expectUnchanged(w, before);
  });

  it('Revision Required is refused with no submission, and twice on one version', async () => {
    const w = await makeStep();
    expect((await feedback(w)).status).toBe(409);
    await makeSub(w);
    expect((await feedback(w)).status).toBe(201);
    expect((await feedback(w)).status).toBe(409);
    expect((await state(w)).step.revisions).toBe(1);
  });

  it('the owner can still respond', async () => {
    const w = await makeStep();
    await makeSub(w);
    await feedback(w);
    const res = await call('post', `/api/feedback/work-item/${w._id}`, 'owner', { text: 'Updated', isResponse: true, round: 1 });
    expect(res.status).toBe(201);
  });
});

describe('/transition', () => {
  describe('cannot approve a step that requires review', () => {
    it.each(['head', 'admin'])('with a submission, as %s', async (who) => {
      const w = await makeStep();
      await makeSub(w);
      const before = await state(w);
      const res = await move(w, who, 'Approved');
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('USE_REVIEW_FLOW');
      await expectUnchanged(w, before);
    });

    it.each(['head', 'admin'])('without a submission, as %s', async (who) => {
      const w = await makeStep();
      const before = await state(w);
      expect((await move(w, who, 'Approved')).status).toBe(409);
      await expectUnchanged(w, before);
    });

    it.each(['Pending', 'Feedback', 'In Progress'])('from %s', async (status) => {
      const w = await makeStep('Design', status);
      expect((await move(w, 'head', 'Approved')).status).toBe(409);
      expect((await WorkItem.findById(w._id).lean()).status).toBe(status);
    });
  });

  it('a step that does not require review keeps its behaviour', async () => {
    const w = await makeStep('Design', 'Pending', { reviewRequired: false });
    expect((await move(w, 'head', 'Approved')).status).toBe(200);
    expect((await state(w)).step.status).toBe('Approved');
    expect((await state(w)).ratings).toBe(0);
  });

  describe('the Shoot exception is gone', () => {
    it.each([['owner', 'Pending'], ['owner', 'In Progress'], ['sm', 'Pending']])('%s cannot approve Shoot from %s', async (who, status) => {
      const w = await makeStep('Shoot', status);
      expect((await move(w, who, 'Approved')).status).toBe(403);
      expect((await WorkItem.findById(w._id).lean()).status).toBe(status);
    });

    it.each([['owner', 'In Progress'], ['sm', 'Pending']])('even when Shoot does not require review: %s from %s', async (who, status) => {
      const w = await makeStep('Shoot', status, { reviewRequired: false });
      expect((await move(w, who, 'Approved')).status).toBe(403);
    });
  });

  it('"Done and forward" no longer exists', () => {
    expect(WORK_ACTION_KEYS).not.toContain('done_and_forward');
    expect(ACTION_LABELS.done_and_forward).toBeUndefined();
  });

  it('a reviewer cannot send back a review step by moving Feedback to In Progress while a version waits', async () => {
    const w = await makeStep('Design', 'Feedback');
    await makeSub(w);
    expect((await move(w, 'head', 'In Progress')).status).toBe(409);
  });

  it('requesting a revision on a review step goes through the review flow', async () => {
    const w = await makeStep();
    await makeSub(w);
    expect((await move(w, 'head', 'Feedback')).status).toBe(409);
  });

  it.each(['Edit', 'Shoot'])('a %s worker submitting through /transition gets a real version', async (stage) => {
    const w = await makeStep(stage, 'In Progress');
    expect((await call('post', `/api/work/${w._id}/transition`, 'owner', { toStatus: 'Feedback', deliverableUrl: 'https://drive.google.com/file/d/cut' })).status).toBe(200);
    const subs = await Submission.find({ workItemId: w._id, version: { $gt: 0 } }).lean();
    expect(subs).toHaveLength(1);
    expect(subs[0].kind).toBe('video');
    expect(subs[0].status).toBe('submitted');
  });

  it('the worker can still submit: a version is created for review', async () => {
    const w = await makeStep('Design', 'In Progress');
    expect((await call('post', `/api/work/${w._id}/transition`, 'owner', { toStatus: 'Pending', deliverableUrl: 'https://drive.google.com/file/d/d' })).status).toBe(200);
    const after = await state(w);
    expect(after.step.status).toBe('Pending');
    expect(after.subs).toHaveLength(1);
    expect(after.subs[0]).toMatchObject({ v: 1, status: 'submitted' });
  });
});

describe('Round timing', () => {
  const rounds = async (w) => (await WorkItem.findById(w._id).lean()).rounds;
  const submit = (w, body = { kind: 'video', linkUrl: 'https://drive.google.com/file/d/next' }) => call('post', `/api/work/${w._id}/submit`, 'owner', body);

  it('resubmitting after a Feedback-route revision keeps the earlier submit time', async () => {
    const first = new Date(Date.now() - 600000);
    const w = await makeStep('Edit', 'Feedback', { submittedAt: first, rounds: [{ roundNumber: 1, startedAt: new Date(Date.now() - 900000), submittedAt: first, intervals: [] }] });
    await makeSub(w);
    expect((await feedback(w)).status).toBe(201);
    expect((await submit(w)).status).toBeLessThan(300);
    const after = await rounds(w);
    expect(after).toHaveLength(2);
    expect(after[0].submittedAt.getTime()).toBe(first.getTime());
    expect(after[0].decision).toBe('changes_requested');
    // The rework runs from the decision to the resubmit.
    expect(after[1].startedAt.getTime()).toBe(after[0].decisionAt.getTime());
    expect(after[1].submittedAt).toBeTruthy();
  });

  it('sending another version with no decision keeps the time and adds no work time', async () => {
    const first = new Date(Date.now() - 600000);
    const w = await makeStep('Edit', 'Feedback', { submittedAt: first, rounds: [{ roundNumber: 1, startedAt: new Date(Date.now() - 900000), submittedAt: first, intervals: [] }] });
    await makeSub(w);
    expect((await submit(w)).status).toBeLessThan(300);
    const after = await rounds(w);
    expect(after[0].submittedAt.getTime()).toBe(first.getTime());
    expect(after[1].startedAt.getTime()).toBe(after[1].submittedAt.getTime());
    expect((await WorkItem.findById(w._id).lean()).submittedAt.getTime()).toBe(first.getTime());
  });

  it('a /transition resubmit keeps the earlier submit time too', async () => {
    const first = new Date(Date.now() - 600000);
    const w = await makeStep('Edit', 'Feedback', { submittedAt: first, rounds: [{ roundNumber: 1, startedAt: new Date(Date.now() - 900000), submittedAt: first, intervals: [] }] });
    await makeSub(w);
    await feedback(w);
    expect((await move(w, 'owner', 'Pending')).status).toBe(200);
    const after = await rounds(w);
    expect(after[0].submittedAt.getTime()).toBe(first.getTime());
    expect(after).toHaveLength(2);
  });

  it('a normal first submit still uses the open round', async () => {
    const w = await makeStep('Edit', 'In Progress');
    expect((await submit(w)).status).toBeLessThan(300);
    const after = await rounds(w);
    expect(after).toHaveLength(1);
    expect(after[0].submittedAt).toBeTruthy();
  });
});

describe('An owner cannot withdraw a submission awaiting review', () => {
  describe.each(['Pending', 'Feedback'])('from %s', (status) => {
    it.each(status === 'Pending' ? ['In Progress', 'Blocked', 'Published'] : ['In Progress', 'Blocked', 'Pending'])('to %s: refused, and revisions do not change', async (to) => {
      const w = await makeStep('Edit', status, { revisions: 2 });
      await makeSub(w);
      const before = await state(w);
      const res = await call('post', `/api/work/${w._id}/transition`, 'owner', { toStatus: to, blockerReason: 'Waiting for feedback', publishedUrl: 'https://drive.google.com/file/d/live' });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('SUBMISSION_AWAITING_REVIEW');
      await expectUnchanged(w, before);
      expect((await state(w)).step.revisions).toBe(2);
    });

    it('marking it blocked through the blockers route is refused too', async () => {
      const w = await makeStep('Edit', status);
      await makeSub(w);
      const before = await state(w);
      const res = await call('post', '/api/blockers', 'owner', { workItemId: w._id, reason: 'Waiting for feedback', note: 'x', dependencyOwnerId: P.other._id.toString() });
      expect(res.status).toBe(409);
      await expectUnchanged(w, before);
    });
  });

  it('an owner can move on once the version has been decided', async () => {
    const w = await makeStep('Edit');
    await makeSub(w);
    await feedback(w);
    expect((await move(w, 'owner', 'Blocked')).status).not.toBe(409);
  });

  it('submit-clips is the submission, so it is not treated as a withdrawal', async () => {
    const w = await makeStep('Shoot', 'Feedback');
    await makeClip(w, 'uploaded');
    expect((await call('post', `/api/work/${w._id}/submit-clips`, 'owner')).status).toBe(200);
    expect((await state(w)).step.status).toBe('Pending');
  });

  it('a step that does not require review is unaffected', async () => {
    const w = await makeStep('Post', 'Feedback', { reviewRequired: false });
    await makeSub(w);
    expect((await move(w, 'owner', 'In Progress')).status).toBe(200);
  });
});

describe('Reopening a finished step', () => {
  const approvedStep = async () => {
    const w = await makeStep();
    const s = await makeSub(w);
    expect((await approve(s)).status).toBe(200);
    return { w, s };
  };

  describe.each(['Approved', 'Published'])('from %s', (status) => {
    it.each([['owner', 403], ['sm', 403], ['exec', 403], ['other', 404]])('%s cannot reopen', async (who, code) => {
      const w = await makeStep('Design', status);
      await makeSub(w, 1, 'approved');
      const res = await move(w, who, 'In Progress');
      expect(res.status).toBe(code);
      expect((await WorkItem.findById(w._id).lean()).status).toBe(status);
    });

    it.each(['head', 'admin'])('%s can reopen', async (who) => {
      const w = await makeStep('Design', status);
      await makeSub(w, 1, 'approved');
      expect((await move(w, who, 'In Progress')).status).toBe(200);
      expect((await WorkItem.findById(w._id).lean()).status).toBe('In Progress');
    });

    it('a head or admin cannot reopen their own step', async () => {
      const w = await makeStep('Design', status, { ownerId: P.head._id });
      expect((await move(w, 'head', 'In Progress')).status).toBe(403);
    });
  });

  it('keeps the rating, and needs a new submission and a new decision', async () => {
    const { w, s } = await approvedStep();
    expect((await move(w, 'head', 'In Progress')).status).toBe(200);
    expect((await state(w)).ratings).toBe(1);

    // The old version cannot be decided again.
    expect((await approve(s)).status).toBe(409);
    expect((await revise(s)).status).toBe(409);

    // Owner resubmits: a new version, which can be decided.
    await call('post', `/api/work/${w._id}/transition`, 'owner', { toStatus: 'Pending', deliverableUrl: 'https://drive.google.com/file/d/v2' });
    const latest = await Submission.findOne({ workItemId: w._id, version: { $gt: 0 } }).sort({ version: -1 });
    expect(latest.version).toBe(2);
    expect(latest.status).toBe('submitted');
    expect((await approve(s)).status).toBe(409);
    expect((await approve(latest)).status).toBe(200);
    const after = await state(w);
    expect(after.ratings).toBe(2);
    expect(after.step.status).toBe('Approved');
  });

  it('reopening to Feedback invents no submission and starts a new round', async () => {
    const { w } = await approvedStep();
    const before = await state(w);
    expect((await move(w, 'admin', 'Feedback')).status).toBe(200);
    const after = await state(w);
    expect(after.step.status).toBe('Feedback');
    expect(after.subs).toEqual(before.subs);
    expect(after.step.rounds).toBe(before.step.rounds + 1);
    const q = await call('get', '/api/submissions/review-queue', 'head');
    expect(JSON.stringify(q.body)).not.toContain(String(w._id));
  });

  it('an old unreviewed version from before the decision is never reused', async () => {
    const w = await makeStep('Design', 'Approved', { approvedAt: new Date(), decisionAt: new Date() });
    const old = await makeSub(w, 1, 'submitted');
    expect((await move(w, 'head', 'In Progress')).status).toBe(200);
    await call('post', `/api/work/${w._id}/transition`, 'owner', { toStatus: 'Pending', deliverableUrl: 'https://drive.google.com/file/d/new' });
    expect((await Submission.find({ workItemId: w._id, version: { $gt: 0 } })).length).toBe(2);
    expect((await approve(old)).status).toBe(409);
  });

  it('later unfinished steps keep their status but pause (Phase 6)', async () => {
    const pieceId = new mongoose.Types.ObjectId();
    const w = await makeStep('Design', 'Approved', { contentPieceId: pieceId, stageOrder: 1 });
    const next = await makeStep('Post', 'In Progress', { contentPieceId: pieceId, stageOrder: 2, reviewRequired: false, isLocked: false, unlockedAt: new Date() });
    const before = await WorkItem.findById(next._id).lean();
    expect((await move(w, 'head', 'In Progress')).status).toBe(200);
    expect((await call('get', `/api/work/${next._id}`, 'head')).status).toBe(200);
    const after = await WorkItem.findById(next._id).lean();
    // Same status and unlock time; locked and marked paused until the reopened step is approved again.
    expect({ status: after.status, unlockedAt: after.unlockedAt }).toEqual({ status: before.status, unlockedAt: before.unlockedAt });
    expect(after.isLocked).toBe(true);
    expect(after.pausedBy.map(String)).toEqual([String(w._id)]);
  });
});

describe('Review queue', () => {
  const ids = (res) => (res.body.data || res.body).map((x) => String(x.id || x._id));
  const queue = (who = 'head') => call('get', '/api/submissions/review-queue', who);

  it.each(['head', 'admin', 'sm', 'exec'])('GET as %s creates no records', async (who) => {
    const w = await makeStep('Design', 'Pending');
    const counts = async () => ({
      subs: await Submission.countDocuments({}),
      forStep: await Submission.countDocuments({ workItemId: w._id }),
      ratings: await Rating.countDocuments({}),
    });
    const before = await counts();
    expect((await queue(who)).status).toBe(200);
    expect(await counts()).toEqual(before);
    expect(before.forStep).toBe(0);
  });

  it('lists only the latest version on a step awaiting review', async () => {
    const w = await makeStep('Edit', 'Feedback');
    const v1 = await makeSub(w, 1);
    const v2 = await makeSub(w, 2);
    const res = await queue();
    expect(ids(res)).toContain(String(v2._id));
    expect(ids(res)).not.toContain(String(v1._id));
  });

  it.each(['Approved', 'Published', 'In Progress', 'Not Started', 'Blocked'])('hides a submitted version while the step is %s, without changing it', async (status) => {
    const w = await makeStep('Design', status);
    const s = await makeSub(w);
    expect(ids(await queue())).not.toContain(String(s._id));
    expect((await Submission.findById(s._id).lean()).status).toBe('submitted');
  });

  it('hides a step whose latest version is decided, even with an older one still submitted', async () => {
    const w = await makeStep('Edit', 'Feedback');
    const old = await makeSub(w, 1);
    const latest = await makeSub(w, 2, 'changes_requested');
    const res = ids(await queue());
    expect(res).not.toContain(String(old._id));
    expect(res).not.toContain(String(latest._id));
  });

  it('a decided version leaves the queue', async () => {
    const w = await makeStep();
    const s = await makeSub(w);
    expect(ids(await queue())).toContain(String(s._id));
    await approve(s);
    expect(ids(await queue())).not.toContain(String(s._id));
  });
});

describe('Forced failures leave no partial writes', () => {
  it('approval: the rating write fails', async () => {
    const w = await makeStep();
    const s = await makeSub(w);
    const before = await state(w);
    vi.spyOn(Rating, 'create').mockRejectedValueOnce(new Error('forced rating failure'));
    expect((await approve(s)).status).toBe(500);
    await expectUnchanged(w, before);
    // Nothing is stuck: the same version can still be approved.
    expect((await approve(s)).status).toBe(200);
    expect((await state(w)).ratings).toBe(1);
  });

  it('approval: the step save fails, so the rating and the claim are undone', async () => {
    const w = await makeStep();
    const s = await makeSub(w);
    const before = await state(w);
    vi.spyOn(WorkItem.prototype, 'save').mockRejectedValueOnce(new Error('forced step failure'));
    expect((await approve(s)).status).toBe(500);
    await expectUnchanged(w, before);
    expect((await approve(s)).status).toBe(200);
  });

  it('shoot approval: the step save fails', async () => {
    const w = await makeStep('Shoot');
    await makeSub(w);
    await makeClip(w);
    const before = await state(w);
    vi.spyOn(WorkItem.prototype, 'save').mockRejectedValueOnce(new Error('forced step failure'));
    expect((await shoot(w)).status).toBe(500);
    await expectUnchanged(w, before);
    expect((await shoot(w)).status).toBe(200);
  });

  it('shoot send back: the step save fails', async () => {
    const w = await makeStep('Shoot');
    await makeSub(w);
    await makeClip(w, 'reshoot_needed');
    const before = await state(w);
    vi.spyOn(WorkItem.prototype, 'save').mockRejectedValueOnce(new Error('forced step failure'));
    expect((await shoot(w, 'head', { note: 'x' })).status).toBe(500);
    await expectUnchanged(w, before);
  });

  it('request revision: the step save fails, so the comment and the claim are undone', async () => {
    const w = await makeStep();
    const s = await makeSub(w);
    const before = await state(w);
    vi.spyOn(WorkItem.prototype, 'save').mockRejectedValueOnce(new Error('forced step failure'));
    expect((await revise(s)).status).toBe(500);
    await expectUnchanged(w, before);
    expect((await revise(s)).status).toBe(200);
  });

  it('request revision: the comment write fails', async () => {
    const w = await makeStep();
    const s = await makeSub(w);
    const before = await state(w);
    vi.spyOn(SubmissionComment, 'create').mockRejectedValueOnce(new Error('forced comment failure'));
    expect((await revise(s)).status).toBe(500);
    await expectUnchanged(w, before);
  });

  it('feedback revision: the entry write fails', async () => {
    const w = await makeStep();
    await makeSub(w);
    const before = await state(w);
    vi.spyOn(FeedbackEntry, 'create').mockRejectedValueOnce(new Error('forced entry failure'));
    expect((await feedback(w)).status).toBe(500);
    await expectUnchanged(w, before);
  });

  it('feedback revision: the step save fails, so the entry and the claim are undone', async () => {
    const w = await makeStep();
    await makeSub(w);
    const before = await state(w);
    vi.spyOn(WorkItem.prototype, 'save').mockRejectedValueOnce(new Error('forced step failure'));
    expect((await feedback(w)).status).toBe(500);
    await expectUnchanged(w, before);
    expect((await feedback(w)).status).toBe(201);
  });

  it('a failure after the step is saved does not undo the decision', async () => {
    const w = await makeStep();
    const s = await makeSub(w);
    vi.spyOn(ActivityEvent, 'create').mockRejectedValue(new Error('forced event failure'));
    const res = await approve(s);
    vi.restoreAllMocks();
    expect(res.status).toBe(200);
    const after = await state(w);
    expect(after.step.status).toBe('Approved');
    expect(after.subs[0].status).toBe('approved');
    expect(after.ratings).toBe(1);
  });
});
