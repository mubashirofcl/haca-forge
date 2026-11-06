import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/server.js';
import { Person } from '../src/modules/people/model.js';
import { Session } from '../src/modules/auth/session.model.js';
import { env } from '../src/config/env.js';

// Admin user-management actions used by /team and /team/:id:
// invite (POST /api/people), change role (PATCH /api/team/:id), reset password and force logout.
const DOMAIN = '@admin-um-test.local';

const makeToken = (user) =>
  jwt.sign(
    { userId: user._id.toString(), role: user.role, email: user.email },
    env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );

const addSession = (userId) =>
  Session.create({
    userId,
    deviceLabel: 'Test device',
    ipHash: 'test-ip-hash',
    refreshTokenHash: `rt-${new mongoose.Types.ObjectId()}`,
    refreshTokenFamily: `fam-${new mongoose.Types.ObjectId()}`,
  });

describe('Admin user-management API', () => {
  const people = {};
  const tokens = {};
  let target;

  beforeAll(async () => {
    const mongoUri = process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/marketing_portal_test';
    if (mongoose.connection.readyState === 0) await mongoose.connect(mongoUri);
    await Person.deleteMany({ email: new RegExp(`${DOMAIN.replace('.', '\\.')}$`) });

    for (const role of ['admin', 'creative_head', 'sm_manager', 'executive', 'team_member']) {
      people[role] = await Person.create({ name: `UM ${role}`, email: `${role}${DOMAIN}`, role, status: 'active' });
      tokens[role] = makeToken(people[role]);
    }
  });

  beforeEach(async () => {
    await Person.deleteMany({ email: { $in: [`target${DOMAIN}`, `invited${DOMAIN}`, `illegal${DOMAIN}`] } });
    target = await Person.create({
      name: 'UM Target',
      email: `target${DOMAIN}`,
      role: 'team_member',
      status: 'active',
      mustSetPassword: false,
    });
    await Session.deleteMany({ userId: target._id });
    await addSession(target._id);
  });

  afterAll(async () => {
    const ids = (await Person.find({ email: new RegExp(`${DOMAIN.replace('.', '\\.')}$`) }).select('_id')).map((p) => p._id);
    await Session.deleteMany({ userId: { $in: ids } });
    await Person.deleteMany({ _id: { $in: ids } });
  });

  describe('Unauthorized roles are rejected and nothing changes', () => {
    for (const role of ['creative_head', 'sm_manager', 'executive', 'team_member']) {
      it(`${role}: POST /api/people is rejected and no account is created`, async () => {
        const res = await request(app)
          .post('/api/people')
          .set('Authorization', `Bearer ${tokens[role]}`)
          .send({ name: 'Illegal Person', email: `illegal${DOMAIN}`, role: 'admin' });
        expect(res.status).toBe(403);
        expect(await Person.findOne({ email: `illegal${DOMAIN}` })).toBeNull();
      });

      it(`${role}: PATCH /api/team/:id with a role is rejected and the role is unchanged`, async () => {
        const res = await request(app)
          .patch(`/api/team/${target._id}`)
          .set('Authorization', `Bearer ${tokens[role]}`)
          .send({ role: 'admin' });
        expect(res.status).toBe(403);
        expect((await Person.findById(target._id)).role).toBe('team_member');
      });

      it(`${role}: POST /api/team/:id/reset-password is rejected and the password state is unchanged`, async () => {
        const res = await request(app)
          .post(`/api/team/${target._id}/reset-password`)
          .set('Authorization', `Bearer ${tokens[role]}`);
        expect(res.status).toBe(403);
        expect((await Person.findById(target._id)).mustSetPassword).toBe(false);
      });

      it(`${role}: POST /api/team/:id/force-logout is rejected and sessions remain`, async () => {
        const res = await request(app)
          .post(`/api/team/${target._id}/force-logout`)
          .set('Authorization', `Bearer ${tokens[role]}`);
        expect(res.status).toBe(403);
        expect(await Session.countDocuments({ userId: target._id })).toBe(1);
      });
    }

    it('unauthenticated calls to all four endpoints return 401', async () => {
      const calls = [
        request(app).post('/api/people').send({ name: 'X', email: `illegal${DOMAIN}` }),
        request(app).patch(`/api/team/${target._id}`).send({ role: 'admin' }),
        request(app).post(`/api/team/${target._id}/reset-password`),
        request(app).post(`/api/team/${target._id}/force-logout`),
      ];
      for (const res of await Promise.all(calls)) expect(res.status).toBe(401);
      const after = await Person.findById(target._id);
      expect(after.role).toBe('team_member');
      expect(after.mustSetPassword).toBe(false);
      expect(await Session.countDocuments({ userId: target._id })).toBe(1);
    });
  });

  describe('Admin can use all four actions', () => {
    it('invite: creates an account that must set its own password, without returning a password hash', async () => {
      const res = await request(app)
        .post('/api/people')
        .set('Authorization', `Bearer ${tokens.admin}`)
        .send({ name: 'UM Invited', email: `INVITED${DOMAIN}`, role: 'sm_manager' });
      expect(res.status).toBe(201);
      expect(res.body.data.passwordHash).toBeUndefined();
      const created = await Person.findOne({ email: `invited${DOMAIN}` });
      expect(created.role).toBe('sm_manager');
      expect(created.mustSetPassword).toBe(true);
    });

    it('invite: a duplicate email is rejected with 409', async () => {
      const res = await request(app)
        .post('/api/people')
        .set('Authorization', `Bearer ${tokens.admin}`)
        .send({ name: 'Dup', email: `target${DOMAIN}`, role: 'team_member' });
      expect(res.status).toBe(409);
    });

    it('change role: PATCH /api/team/:id saves the new role', async () => {
      const res = await request(app)
        .patch(`/api/team/${target._id}`)
        .set('Authorization', `Bearer ${tokens.admin}`)
        .send({ role: 'sm_manager' });
      expect(res.status).toBe(200);
      expect((await Person.findById(target._id)).role).toBe('sm_manager');
    });

    it('change role: an unknown role is rejected and the role is unchanged', async () => {
      const res = await request(app)
        .patch(`/api/team/${target._id}`)
        .set('Authorization', `Bearer ${tokens.admin}`)
        .send({ role: 'superuser' });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect((await Person.findById(target._id)).role).toBe('team_member');
    });

    it('reset password: blocks sign-in until a new password is set and returns no credentials', async () => {
      const res = await request(app)
        .post(`/api/team/${target._id}/reset-password`)
        .set('Authorization', `Bearer ${tokens.admin}`);
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).not.toMatch(/password"\s*:|token|resetLink/i);
      expect((await Person.findById(target._id)).mustSetPassword).toBe(true);
    });

    it('force logout: removes every session for the person', async () => {
      await addSession(target._id);
      const res = await request(app)
        .post(`/api/team/${target._id}/force-logout`)
        .set('Authorization', `Bearer ${tokens.admin}`);
      expect(res.status).toBe(200);
      expect(await Session.countDocuments({ userId: target._id })).toBe(0);
    });
  });
});
