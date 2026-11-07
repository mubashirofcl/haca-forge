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

describe('Phase 5d: caption and hashtags on the Post step', () => {
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

  it('a Post step cannot be marked posted without a caption, and nothing changes', async () => {
    const w = await step('Reel', 'Post', 'poster');
    for (const body of [{}, { caption: '   ' }, { hashtags: '#only' }]) {
      const res = await post(w, 'poster', body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CAPTION_REQUIRED');
    }
    const after = await WorkItem.findById(w._id).lean();
    expect(after.status).toBe('In Progress');
    expect(after.publishedUrl || '').toBe('');
  });

  it('caption and hashtags are saved on the Post step and returned with it', async () => {
    const w = await step('Reel', 'Post', 'poster');
    const res = await post(w, 'poster', { caption: '  Big launch today  ', hashtags: '#haca #launch' });
    expect(res.status).toBe(200);
    const detail = await request(app).get(`/api/work-items/${w._id}`).set('Authorization', `Bearer ${tokenFor(people.poster)}`);
    const item = detail.body.data || detail.body;
    expect(item.status).toBe('Published');
    expect(item.postCaption).toBe('Big launch today');
    expect(item.postHashtags).toBe('#haca #launch');
  });

  it('hashtags are optional', async () => {
    const w = await step('Static Post', 'Post', 'poster');
    const res = await post(w, 'poster', { caption: 'Caption only' });
    expect(res.status).toBe(200);
    expect((await WorkItem.findById(w._id).lean()).postHashtags).toBe('');
  });

  describe('who can set them', () => {
    for (const who of ['poster', 'sm', 'admin']) {
      it(`${who} can`, async () => {
        const w = await step('Reel', 'Post', 'poster');
        const res = await post(w, who, { caption: `Set by ${who}` });
        expect(res.status).toBe(200);
        expect((await WorkItem.findById(w._id).lean()).postCaption).toBe(`Set by ${who}`);
      });
    }
    for (const who of ['head', 'exec', 'other']) {
      it(`${who} cannot`, async () => {
        const w = await step('Reel', 'Post', 'poster');
        const res = await post(w, who, { caption: 'Not allowed' });
        expect([403, 404]).toContain(res.status);
        const after = await WorkItem.findById(w._id).lean();
        expect(after.postCaption || '').toBe('');
        expect(after.status).toBe('In Progress');
      });
    }

    it('captions are accepted only when marking a Post step posted', async () => {
      const w = await step('Reel', 'Script', 'writer');
      const res = await request(app).post(`/api/work-items/${w._id}/transition`).set('Authorization', `Bearer ${tokenFor(people.writer)}`).send({ toStatus: 'Feedback', caption: 'Sneaky' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CAPTION_NOT_ALLOWED');
      const p = await step('Reel', 'Post', 'poster');
      const blocked = await request(app).post(`/api/work-items/${p._id}/transition`).set('Authorization', `Bearer ${tokenFor(people.poster)}`).send({ toStatus: 'Blocked', blockerReason: 'Other', blockerNote: 'x', caption: 'Sneaky' });
      expect(blocked.status).toBe(400);
    });
  });

  describe('length limits', () => {
    it(`rejects caption and hashtags over ${POST_CAPTION_MAX} characters together`, async () => {
      const w = await step('Reel', 'Post', 'poster');
      const res = await post(w, 'poster', { caption: 'a'.repeat(2000), hashtags: `#${'b'.repeat(1000)}` });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CAPTION_TOO_LONG');
      expect((await WorkItem.findById(w._id).lean()).status).toBe('In Progress');
    });

    it('rejects a caption alone over the limit', async () => {
      const w = await step('Reel', 'Post', 'poster');
      const res = await post(w, 'poster', { caption: 'a'.repeat(POST_CAPTION_MAX + 1) });
      expect(res.status).toBe(400);
    });

    it('accepts exactly the limit', async () => {
      const w = await step('Reel', 'Post', 'poster');
      const caption = 'a'.repeat(POST_CAPTION_MAX - 10);
      const hashtags = '#'.padEnd(8, 'x');
      const res = await post(w, 'poster', { caption, hashtags });
      expect(res.status).toBe(200);
    });
  });
});
