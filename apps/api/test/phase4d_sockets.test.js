import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { io as ioClient } from 'socket.io-client';
import { app, server, io } from '../src/server.js';
import { env } from '../src/config/env.js';
import { Person } from '../src/modules/people/model.js';
import { WorkItem } from '../src/modules/workItems/model.js';
import { Submission, SubmissionComment } from '../src/modules/submissions/model.js';
import { Notification } from '../src/modules/notifications/model.js';
import { Channel } from '../src/modules/chat/channel.model.js';
import { ChannelMember } from '../src/modules/chat/channelMember.model.js';
import { ChatMessage } from '../src/modules/chat/chatMessage.model.js';
import { Session } from '../src/modules/auth/session.model.js';
import { withoutContact } from '../src/lib/socketHub.js';
import { registerSocketIO } from '../src/modules/notifications/service.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const tokenFor = (user, claims = {}) =>
  jwt.sign({ userId: String(user._id), role: user.role, ...claims }, env.JWT_SECRET, { expiresIn: '1h' });

describe('Phase 4d: sockets', () => {
  const salt = `p4d-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  const people = {};
  const sockets = [];
  let port;
  let group;

  const make = (key, role, extra = {}) =>
    Person.create({
      name: `P4d ${key}`,
      email: `${key}.${salt}@p4d.test`,
      phone: '+15550001111',
      whatsappNumber: '+15550002222',
      role,
      status: 'active',
      ...extra,
    }).then((p) => (people[key] = p));

  const connect = (user, { claims, query, noCookie } = {}) =>
    new Promise((resolve) => {
      const socket = ioClient(`http://127.0.0.1:${port}`, {
        transports: ['websocket'],
        reconnection: false,
        forceNew: true,
        extraHeaders: noCookie || !user ? {} : { cookie: `accessToken=${tokenFor(user, claims)}` },
        query,
      });
      socket.events = [];
      socket.onAny((ev, payload) => socket.events.push({ ev, payload }));
      socket.on('connect', () => {
        sockets.push(socket);
        resolve({ ok: true, socket });
      });
      socket.on('connect_error', (err) => {
        socket.close();
        resolve({ ok: false, error: err.message });
      });
    });

  const disconnected = (socket, ms = 2000) =>
    new Promise((resolve) => {
      if (!socket.connected) return resolve('already');
      const timer = setTimeout(() => resolve(null), ms);
      socket.once('disconnect', (reason) => {
        clearTimeout(timer);
        resolve(reason);
      });
    });

  const join = (socket, channelId) => new Promise((resolve) => socket.emit('chat:join', { channelId: String(channelId) }, resolve));
  const got = (socket, ev, pred = () => true) => socket.events.filter((e) => e.ev === ev && pred(e.payload));

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) await mongoose.connect(env.MONGODB_URI);
    await make('admin', 'admin');
    await make('head', 'creative_head');
    await make('exec', 'executive');
    for (const k of ['member', 'member2', 'outsider', 'leaver', 'suspendee', 'promotee', 'forced', 'revoker', 'logouter']) await make(k, 'team_member');
    group = await Channel.create({ name: `P4d group ${salt}`, type: 'group', createdById: people.head._id });
    await ChannelMember.create(
      ['head', 'member', 'member2', 'leaver', 'exec'].map((k) => ({ channelId: group._id, userId: people[k]._id, role: k === 'head' ? 'owner' : 'member' }))
    );
    // startServer() registers this in production; tests import the app without starting it.
    registerSocketIO(io);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = server.address().port;
  });

  afterAll(async () => {
    for (const s of sockets) s.close();
    await new Promise((resolve) => server.close(() => resolve()));
    const ids = Object.values(people).map((p) => p._id);
    await ChatMessage.deleteMany({ channelId: group._id });
    await ChannelMember.deleteMany({ channelId: group._id });
    await Channel.deleteMany({ _id: group._id });
    await SubmissionComment.deleteMany({ authorId: { $in: ids } });
    await Submission.deleteMany({ submittedById: { $in: ids } });
    await WorkItem.deleteMany({ title: new RegExp(salt) });
    await Notification.deleteMany({ recipient: { $in: ids } });
    await Session.deleteMany({ userId: { $in: ids } });
    await ChannelMember.deleteMany({ userId: { $in: ids } });
    await Person.deleteMany({ _id: { $in: ids } });
  });

  describe('handshake', () => {
    it('refuses a token passed in the URL', async () => {
      const r = await connect(people.member, { noCookie: true, query: { token: tokenFor(people.member) } });
      expect(r.ok).toBe(false);
    });

    it('refuses a suspended user even with a valid token', async () => {
      const p = await make('alreadySuspended', 'team_member', { status: 'suspended' });
      const r = await connect(p);
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/suspended/i);
    });

    it('takes the role from the database, not the token', async () => {
      const r = await connect(people.member2, { claims: { role: 'admin' } });
      expect(r.ok).toBe(true);
      io.to('role:admin').emit('p4d:probe', 'admin-room');
      io.to('role:team_member').emit('p4d:probe', 'member-room');
      await wait(300);
      expect(got(r.socket, 'p4d:probe').map((e) => e.payload)).toEqual(['member-room']);
    });
  });

  describe('sessions ending or changing', () => {
    it('logout disconnects the user\'s sockets', async () => {
      const { socket } = await connect(people.logouter);
      const reason = disconnected(socket);
      const res = await request(app).post('/api/auth/logout').set('Cookie', `accessToken=${tokenFor(people.logouter)}`);
      expect(res.status).toBe(200);
      expect(await reason).toBe('io server disconnect');
    });

    it('suspension disconnects, and a new connection is refused', async () => {
      const { socket } = await connect(people.suspendee);
      const reason = disconnected(socket);
      const res = await request(app).post(`/api/people/${people.suspendee._id}/suspend`).set('Authorization', `Bearer ${tokenFor(people.admin)}`).send({});
      expect(res.status).toBe(200);
      expect(await reason).toBe('io server disconnect');
      expect((await connect(people.suspendee)).ok).toBe(false);
    });

    it('forced logout disconnects', async () => {
      const { socket } = await connect(people.forced);
      const reason = disconnected(socket);
      const res = await request(app).post(`/api/team/${people.forced._id}/force-logout`).set('Authorization', `Bearer ${tokenFor(people.admin)}`);
      expect(res.status).toBe(200);
      expect(await reason).toBe('io server disconnect');
    });

    it('revoking other sessions disconnects', async () => {
      const { socket } = await connect(people.revoker);
      const reason = disconnected(socket);
      const res = await request(app).post('/api/me/sessions/revoke-others').set('Authorization', `Bearer ${tokenFor(people.revoker)}`);
      expect(res.status).toBe(200);
      expect(await reason).toBe('io server disconnect');
    });

    it('a role change disconnects, and the reconnect joins the new role room', async () => {
      const { socket } = await connect(people.promotee);
      const reason = disconnected(socket);
      const res = await request(app).patch(`/api/people/${people.promotee._id}`).set('Authorization', `Bearer ${tokenFor(people.admin)}`).send({ role: 'sm_manager' });
      expect(res.status).toBe(200);
      expect(await reason).toBe('io server disconnect');
      const again = await connect(people.promotee);
      expect(again.ok).toBe(true);
      io.to('role:team_member').emit('p4d:role', 'old');
      io.to('role:sm_manager').emit('p4d:role', 'new');
      await wait(300);
      expect(got(again.socket, 'p4d:role').map((e) => e.payload)).toEqual(['new']);
    });

    it('an unrelated profile edit does not disconnect', async () => {
      const { socket } = await connect(people.member2);
      const reason = disconnected(socket, 800);
      const res = await request(app).patch(`/api/people/${people.member2._id}`).set('Authorization', `Bearer ${tokenFor(people.admin)}`).send({ name: 'P4d member2 renamed' });
      expect(res.status).toBe(200);
      expect(await reason).toBeNull();
    });
  });

  describe('chat rooms', () => {
    it('a removed member stops receiving the channel', async () => {
      const removed = await connect(people.member);
      const stays = await connect(people.member2);
      expect(await join(removed.socket, group._id)).toEqual({ success: true });
      expect(await join(stays.socket, group._id)).toEqual({ success: true });
      const del = await request(app).delete(`/api/chat/channels/${group._id}/members/${people.member._id}`).set('Authorization', `Bearer ${tokenFor(people.head)}`);
      expect(del.status).toBe(200);
      await request(app).post(`/api/chat/channels/${group._id}/messages`).set('Authorization', `Bearer ${tokenFor(people.head)}`).send({ content: `AFTER_REMOVAL ${salt}` });
      await wait(500);
      expect(got(stays.socket, 'chat:message:new', (m) => m.content?.startsWith('AFTER_REMOVAL'))).toHaveLength(1);
      expect(got(removed.socket, 'chat:message:new')).toHaveLength(0);
    });

    it('a member who leaves stops receiving the channel', async () => {
      const leaver = await connect(people.leaver);
      await join(leaver.socket, group._id);
      const del = await request(app).delete(`/api/chat/channels/${group._id}/members/${people.leaver._id}`).set('Authorization', `Bearer ${tokenFor(people.leaver)}`);
      expect(del.status).toBe(200);
      await request(app).post(`/api/chat/channels/${group._id}/messages`).set('Authorization', `Bearer ${tokenFor(people.head)}`).send({ content: `AFTER_LEAVING ${salt}` });
      await wait(500);
      expect(got(leaver.socket, 'chat:message:new')).toHaveLength(0);
    });

    it('a non-member cannot join, send read receipts or typing events to a channel', async () => {
      const listener = await connect(people.member2);
      await join(listener.socket, group._id);
      const outsider = await connect(people.outsider);
      expect(await join(outsider.socket, group._id)).toEqual({ error: 'Not a member of this channel' });
      outsider.socket.emit('chat:read', { channelId: String(group._id), messageId: 'SPOOF' });
      outsider.socket.emit('chat:typing:start', { channelId: String(group._id) });
      outsider.socket.emit('chat:typing:stop', { channelId: String(group._id) });
      await wait(400);
      expect(got(listener.socket, 'chat:read').concat(got(listener.socket, 'chat:typing'))).toHaveLength(0);
    });

    it('members can send read receipts and typing; executives cannot type', async () => {
      const listener = await connect(people.member2);
      await join(listener.socket, group._id);
      const head = await connect(people.head);
      const exec = await connect(people.exec);
      expect(await join(exec.socket, group._id)).toEqual({ success: true });
      exec.socket.emit('chat:typing:start', { channelId: String(group._id) });
      exec.socket.emit('chat:typing:stop', { channelId: String(group._id) });
      head.socket.emit('chat:typing:start', { channelId: String(group._id) });
      head.socket.emit('chat:read', { channelId: String(group._id), messageId: 'm1' });
      await wait(400);
      const typingFrom = got(listener.socket, 'chat:typing').map((e) => e.payload.userId);
      expect(typingFrom).toEqual([String(people.head._id)]);
      expect(got(listener.socket, 'chat:read').map((e) => e.payload.userId)).toEqual([String(people.head._id)]);
    });
  });

  describe('payloads carry no contact details', () => {
    it('comment:new and notification:new to the step owner have no email, phone or WhatsApp', async () => {
      const step = await WorkItem.create({
        title: `P4d edit ${salt}`,
        workType: 'Reel',
        status: 'Feedback',
        stageKey: 'Edit',
        stageOrder: 3,
        departmentId: new mongoose.Types.ObjectId(),
        ownerId: people.member2._id,
        deadline: new Date(Date.now() + 86400000),
        estimatedEffortHrs: 1,
      });
      const sub = await Submission.create({ workItemId: step._id, stageKey: 'Edit', version: 1, kind: 'video', status: 'submitted', submittedById: people.member2._id, fileUrl: '/uploads/x.mp4' });
      const owner = await connect(people.member2);
      const res = await request(app).post(`/api/submissions/${sub._id}/comments`).set('Authorization', `Bearer ${tokenFor(people.head)}`).send({ text: 'Tighten the intro' });
      expect(res.status).toBeLessThan(300);
      await wait(600);
      const comment = got(owner.socket, 'comment:new');
      expect(comment).toHaveLength(1);
      expect(comment[0].payload.authorId.name).toBe('P4d head');
      const all = JSON.stringify(owner.socket.events);
      for (const value of [people.head.email, '+15550001111', '+15550002222']) expect(all).not.toContain(value);
      expect(all).not.toMatch(/"(email|phone|whatsappNumber)":"/);
    });

    it('withoutContact removes contact text at any depth and keeps settings flags', () => {
      const out = withoutContact({
        a: { email: 'x@y', name: 'X', prefs: { email: true }, list: [{ phone: '1', whatsapp: '2', whatsappNumber: '3', mobile: '4', phoneNumber: '5', ok: 1 }] },
      });
      expect(out).toEqual({ a: { name: 'X', prefs: { email: true }, list: [{ ok: 1 }] } });
    });
  });
});
