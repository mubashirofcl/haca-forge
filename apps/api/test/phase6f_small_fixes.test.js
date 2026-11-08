import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { submittedWorkTimeMs } from '@mmp/shared';
import { app } from '../src/server.js';
import { env } from '../src/config/env.js';
import { Person } from '../src/modules/people/model.js';
import { WorkItem } from '../src/modules/workItems/model.js';
import { Channel } from '../src/modules/chat/channel.model.js';
import { ChannelMember } from '../src/modules/chat/channelMember.model.js';
import { ChatMessage } from '../src/modules/chat/chatMessage.model.js';
import { Notification } from '../src/modules/notifications/model.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS = path.resolve(__dirname, '../uploads');
const HOUR = 3600000;
const tokenFor = (u) => jwt.sign({ userId: String(u._id), role: u.role, name: u.name }, env.JWT_SECRET, { expiresIn: '1h' });

describe('Phase 6f: small fixes', () => {
  const salt = `p6f-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  const people = {};
  let group;

  const make = (key, role) =>
    Person.create({ name: `P6f ${key}`, email: `${key}.${salt}@p6f.test`, role, status: 'active' }).then((p) => (people[key] = p));
  const as = (who) => ({ Authorization: `Bearer ${tokenFor(people[who])}` });

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) await mongoose.connect(env.MONGODB_URI);
    fs.mkdirSync(UPLOADS, { recursive: true });
    for (const [k, r] of [['admin', 'admin'], ['head', 'creative_head'], ['worker', 'team_member'], ['sender', 'team_member'], ['reader', 'team_member']]) await make(k, r);
    group = await Channel.create({ name: `P6f group ${salt}`, type: 'group', createdById: people.head._id });
    await ChannelMember.create([
      { channelId: group._id, userId: people.sender._id, role: 'owner' },
      { channelId: group._id, userId: people.reader._id, role: 'member' },
    ]);
  });

  afterAll(async () => {
    try { fs.rmSync(path.join(UPLOADS, 'chat', String(group._id)), { recursive: true, force: true }); } catch {}
    const ids = Object.values(people).map((p) => p._id);
    await Notification.deleteMany({ recipient: { $in: ids } });
    await ChatMessage.deleteMany({ channelId: group._id });
    await ChannelMember.deleteMany({ channelId: group._id });
    await Channel.deleteMany({ _id: group._id });
    await WorkItem.deleteMany({ title: new RegExp(salt) });
    await Person.deleteMany({ _id: { $in: ids } });
  });

  describe('admin role change', () => {
    it('an unknown role is a 400 and the person is unchanged', async () => {
      const res = await request(app).patch(`/api/team/${people.worker._id}`).set(as('admin')).send({ role: 'wizard' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_ROLE');
      expect((await Person.findById(people.worker._id).lean()).role).toBe('team_member');
    });

    it('a known role still changes', async () => {
      const res = await request(app).patch(`/api/team/${people.worker._id}`).set(as('admin')).send({ role: 'sm_manager' });
      expect(res.status).toBe(200);
      expect((await Person.findById(people.worker._id).lean()).role).toBe('sm_manager');
      await Person.updateOne({ _id: people.worker._id }, { $set: { role: 'team_member' } });
    });
  });

  describe('attachment-only chat message', () => {
    it('notifies the other members with "sent an attachment"', async () => {
      const up = await request(app)
        .post(`/api/chat/upload?channelId=${group._id}`)
        .set(as('sender'))
        .attach('files', Buffer.from('PDF'), { filename: 'brief.pdf', contentType: 'application/pdf' });
      expect(up.status).toBe(201);
      const res = await request(app)
        .post(`/api/chat/channels/${group._id}/messages`)
        .set(as('sender'))
        .send({ content: '', attachments: [{ storageUrl: up.body.attachments[0].storageUrl }] });
      expect(res.status).toBe(201);
      const messageId = String(res.body.message._id);

      // The fan-out runs after the response, so wait for it.
      let note = null;
      for (let i = 0; i < 40 && !note; i++) {
        note = await Notification.findOne({ recipient: people.reader._id, type: 'chat_message', 'metadata.messageId': new mongoose.Types.ObjectId(messageId) }).lean();
        if (!note) await new Promise((r) => setTimeout(r, 50));
      }
      expect(note).toBeTruthy();
      expect(note.message).toBe('P6f sender sent an attachment');
      expect(String(note.metadata.messageId)).toBe(messageId);
      expect(await Notification.countDocuments({ recipient: people.sender._id, type: 'chat_message' })).toBe(0);
    });
  });

  describe('Performance tab work time', () => {
    const t0 = new Date(Date.now() - 5 * 86400000);
    const at = (h) => new Date(t0.getTime() + h * HOUR);

    it('the shared helper counts submitted rounds only', () => {
      const item = {
        status: 'Feedback',
        rounds: [
          { roundNumber: 1, startedAt: at(0), submittedAt: at(2), decisionAt: at(3), decision: 'changes_requested' },
          { roundNumber: 2, startedAt: at(4), submittedAt: null },
        ],
      };
      expect(submittedWorkTimeMs(item)).toBe(2 * HOUR);
      expect(submittedWorkTimeMs({ rounds: [{ roundNumber: 1, startedAt: at(0) }] })).toBeNull();
      expect(submittedWorkTimeMs({ startedAt: at(0), submittedAt: at(1) })).toBe(HOUR);
      expect(submittedWorkTimeMs({ startedAt: at(0) })).toBeNull();
    });

    it('averages the shared work time of submitted rounds (it was always 0)', async () => {
      const base = {
        workType: 'Reel', departmentId: new mongoose.Types.ObjectId(), ownerId: people.worker._id,
        deadline: at(200), estimatedEffortHrs: 1, isLocked: false,
      };
      await WorkItem.create({
        ...base, title: `P6f Script ${salt}`, stageKey: 'Script', stageOrder: 1, status: 'Approved',
        startedAt: at(0), submittedAt: at(7), approvedAt: at(8),
        rounds: [
          { roundNumber: 1, startedAt: at(0), submittedAt: at(2), decisionAt: at(3), decision: 'changes_requested' },
          { roundNumber: 2, startedAt: at(5), submittedAt: at(7), decisionAt: at(8), decision: 'approved' },
        ],
      });
      // Finished with no submitted round recorded: no work time, so it is not averaged in as 0.
      await WorkItem.create({
        ...base, title: `P6f Edit ${salt}`, stageKey: 'Edit', stageOrder: 2, status: 'Approved',
        approvedAt: at(9), rounds: [{ roundNumber: 1, startedAt: at(8) }],
      });

      const res = await request(app).get(`/api/team/${people.worker._id}/performance`).set(as('admin'));
      expect(res.status).toBe(200);
      const current = (res.body.data || res.body).current;
      expect(current.completedCount).toBe(2);
      expect(current.avgWorkTimeMs).toBe(4 * HOUR);
      expect(current.workTimeByType.Script).toMatchObject({ count: 1 });
      expect(current.workTimeByType.Edit).toBeUndefined();
    });
  });
});
