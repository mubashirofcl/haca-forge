import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { POST_CAPTION_MAX } from '@mmp/shared';
import { app } from '../src/server.js';
import { env } from '../src/config/env.js';
import { Person } from '../src/modules/people/model.js';
import { WorkItem } from '../src/modules/workItems/model.js';
import { Submission } from '../src/modules/submissions/model.js';
import { ContentPiece } from '../src/modules/calendar/contentPiece.model.js';

const tokenFor = (u) => jwt.sign({ userId: String(u._id), role: u.role }, env.JWT_SECRET, { expiresIn: '1h' });
const LIVE = 'https://instagram.com/p/p5d-live';

describe('Phase 5d: the Post step is posted with its live link only (no caption)', () => {
  const salt = `p5d-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  const people = {};
  const pieces = [];

  const make = (key, role) =>
    Person.create({ name: `P5d ${key}`, email: `${key}.${salt}@p5d.test`, role, status: 'active' }).then((p) => (people[key] = p));

  async function step(contentType, stageKey, owner, status = 'In Progress') {
    const p = await ContentPiece.create({ planId: new mongoose.Types.ObjectId(), topic: `P5d ${salt}`, contentType, pipeline: contentType === 'Reel' ? 'reel_a' : 'design', postingDate: new Date(Date.now() + 9 * 86400000), status: 'In Progress' });
    pieces.push(p._id);
    return WorkItem.create({
      title: `P5d ${contentType} ${stageKey} ${salt}`,
      workType: contentType,
      stageKey,
      stageOrder: 1,
      status,
      isLocked: false,
      reviewRequired: stageKey !== 'Post',
      contentPieceId: p._id,
      departmentId: new mongoose.Types.ObjectId(),
      ownerId: people[owner]._id,
      deadline: new Date(Date.now() + 9 * 86400000),
      estimatedEffortHrs: 1,
      startedAt: new Date(),
    });
  }
  const post = (w, who, body) =>
    request(app).post(`/api/work-items/${w._id}/transition`).set('Authorization', `Bearer ${tokenFor(people[who])}`).send({ toStatus: 'Published', publishedUrl: LIVE, ...body });

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) await mongoose.connect(env.MONGODB_URI);
    for (const [k, r] of [['poster', 'team_member'], ['writer', 'team_member'], ['other', 'team_member'], ['sm', 'sm_manager'], ['admin', 'admin'], ['head', 'creative_head'], ['exec', 'executive']]) await make(k, r);
  });

  afterAll(async () => {
    const items = await WorkItem.find({ contentPieceId: { $in: pieces } }).select('_id').lean();
    await Submission.deleteMany({ workItemId: { $in: items.map((w) => w._id) } });
    await WorkItem.deleteMany({ contentPieceId: { $in: pieces } });
    await ContentPiece.deleteMany({ _id: { $in: pieces } });
    await Person.deleteMany({ email: new RegExp(salt) });
  });

  describe('Script and Content submit without a caption', () => {
    for (const [type, stageKey] of [['Reel', 'Script'], ['Static Post', 'Content'], ['Carousel Post', 'Content'], ['Story', 'Script']]) {
      it(`${stageKey} of a ${type}: document only`, async () => {
        const w = await step(type, stageKey, 'writer');
        const res = await request(app).post(`/api/work/${w._id}/submit`).set('Authorization', `Bearer ${tokenFor(people.writer)}`).send({ kind: 'document', document: { htmlSnapshot: '<p>Text</p>' } });
        expect(res.status).toBeLessThan(300);
      });
    }
  });

  // Phase 5d asked the poster for a caption. A Post step is now marked posted with its live
  // link only: no caption is required, and none is accepted or saved.
  it('a Post step is marked posted with only its live link', async () => {
    const w = await step('Reel', 'Post', 'poster');
    const res = await post(w, 'poster', {});
    expect(res.status).toBe(200);
    const after = await WorkItem.findById(w._id).lean();
    expect(after.status).toBe('Published');
    expect(after.publishedUrl).toBe(LIVE);
    expect(after.postCaption || '').toBe('');
    expect(after.postHashtags || '').toBe('');
  });

  it('a caption or hashtags sent by an older screen are ignored, not saved, and do not block posting', async () => {
    const w = await step('Reel', 'Post', 'poster');
    const res = await post(w, 'poster', { caption: '  Big launch today  ', hashtags: `#${'b'.repeat(POST_CAPTION_MAX + 50)}` });
    expect(res.status).toBe(200);
    const detail = await request(app).get(`/api/work-items/${w._id}`).set('Authorization', `Bearer ${tokenFor(people.poster)}`);
    const item = detail.body.data || detail.body;
    expect(item.status).toBe('Published');
    expect(item.postCaption || '').toBe('');
    expect(item.postHashtags || '').toBe('');
  });

  it('a caption saved before this change is left untouched', async () => {
    const w = await step('Reel', 'Post', 'poster');
    await WorkItem.updateOne({ _id: w._id }, { $set: { postCaption: 'Saved earlier', postHashtags: '#earlier' } });
    expect((await post(w, 'poster', {})).status).toBe(200);
    const after = await WorkItem.findById(w._id).lean();
    expect(after.postCaption).toBe('Saved earlier');
    expect(after.postHashtags).toBe('#earlier');
  });

  it('the live link is required and must be https', async () => {
    const w = await step('Reel', 'Post', 'poster');
    for (const publishedUrl of ['', 'http://instagram.com/p/x', 'javascript:alert(1)', 'data:text/html,x']) {
      const res = await post(w, 'poster', { publishedUrl });
      expect(res.status, publishedUrl).toBe(400);
      expect(['LIVE_URL_REQUIRED', 'INVALID_LIVE_URL']).toContain(res.body.error.code);
    }
    const after = await WorkItem.findById(w._id).lean();
    expect(after.status).toBe('In Progress');
    expect(after.publishedUrl || '').toBe('');
  });

  describe('who can mark a Post step posted', () => {
    for (const who of ['poster', 'sm', 'admin']) {
      it(`${who} can`, async () => {
        const w = await step('Reel', 'Post', 'poster');
        const res = await post(w, who, {});
        expect(res.status).toBe(200);
        expect((await WorkItem.findById(w._id).lean()).status).toBe('Published');
      });
    }
    for (const who of ['head', 'exec', 'other']) {
      it(`${who} cannot`, async () => {
        const w = await step('Reel', 'Post', 'poster');
        const res = await post(w, who, {});
        expect([403, 404]).toContain(res.status);
        const after = await WorkItem.findById(w._id).lean();
        expect(after.publishedUrl || '').toBe('');
        expect(after.status).toBe('In Progress');
      });
    }
  });
});
