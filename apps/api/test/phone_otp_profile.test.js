import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/server.js';
import { env } from '../src/config/env.js';
import { Person } from '../src/modules/people/model.js';
import { PhoneVerification } from '../src/modules/profile/phoneVerification.model.js';
import { connectDB } from '../src/config/db.js';

describe('PHONE OTP VERIFICATION & PROFILE EMAIL LOCK SUITE', () => {
  let testWorker, testAdmin;
  let workerToken, adminToken;

  function makeToken(user) {
    return jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  }

  beforeAll(async () => {
    await connectDB();
    await Person.deleteMany({ email: /@phone-otp-test\.com$/ });
    await PhoneVerification.deleteMany({});

    testWorker = await Person.create({
      name: 'Phone OTP Worker',
      email: 'worker@phone-otp-test.com',
      role: 'team_member',
      jobRole: 'Writer',
      status: 'active',
      phone: '+919000000001',
      phoneVerified: true,
      passwordHash: 'hash',
    });

    testAdmin = await Person.create({
      name: 'Phone OTP Admin',
      email: 'admin@phone-otp-test.com',
      role: 'admin',
      status: 'active',
      passwordHash: 'hash',
    });

    workerToken = makeToken(testWorker);
    adminToken = makeToken(testAdmin);
  });

  afterAll(async () => {
    await Person.deleteMany({ email: /@phone-otp-test\.com$/ });
    await PhoneVerification.deleteMany({});
  });

  describe('1. Phone OTP Verification Flow', () => {
    it('rejects invalid phone number on OTP send', async () => {
      const res = await request(app)
        .post('/api/me/phone-otp/send')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ phone: '123' });

      expect(res.status).toBe(400);
    });

    it('sends 6-digit OTP for valid mobile number', async () => {
      const res = await request(app)
        .post('/api/me/phone-otp/send')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ phone: '+919876543210' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.testOtp).toBe('123456');

      const record = await PhoneVerification.findOne({
        userId: testWorker._id,
        phone: '+919876543210',
      });
      expect(record).toBeDefined();
      expect(record.otp).toBe('123456');
      expect(record.verified).toBe(false);
    });

    it('rejects incorrect OTP code', async () => {
      const res = await request(app)
        .post('/api/me/phone-otp/verify')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ phone: '+919876543210', otp: '999999' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_OTP');
    });

    it('verifies correct OTP code and returns verification token', async () => {
      const res = await request(app)
        .post('/api/me/phone-otp/verify')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ phone: '+919876543210', otp: '123456' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.verified).toBe(true);
      expect(res.body.verificationToken).toBeDefined();

      const record = await PhoneVerification.findOne({
        userId: testWorker._id,
        phone: '+919876543210',
      });
      expect(record.verified).toBe(true);
      expect(record.token).toBe(res.body.verificationToken);
    });
  });

  describe('2. Profile Update with Phone Verification & Email Lock', () => {
    it('blocks updating phone number when enforceOtp is true without token', async () => {
      const res = await request(app)
        .patch('/api/me/profile')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          phone: '+919999999999',
          enforceOtp: true,
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('PHONE_OTP_REQUIRED');
    });

    it('allows updating phone number when valid OTP verification token is supplied', async () => {
      // 1. Send OTP
      await request(app)
        .post('/api/me/phone-otp/send')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ phone: '+919876500000' });

      // 2. Verify OTP
      const verifyRes = await request(app)
        .post('/api/me/phone-otp/verify')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ phone: '+919876500000', otp: '123456' });

      const token = verifyRes.body.verificationToken;

      // 3. Update profile with token
      const updateRes = await request(app)
        .patch('/api/me/profile')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          phone: '+919876500000',
          phoneVerificationToken: token,
          preferredName: 'Verified Worker',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.phone).toBe('+919876500000');
      expect(updateRes.body.data.preferredName).toBe('Verified Worker');

      // Verify DB state
      const dbPerson = await Person.findById(testWorker._id);
      expect(dbPerson.phone).toBe('+919876500000');
      expect(dbPerson.phoneVerified).toBe(true);
      expect(dbPerson.phoneVerifiedAt).toBeDefined();
    });

    it('strictly rejects non-admin attempts to change registered email via profile update', async () => {
      const res = await request(app)
        .patch('/api/me/profile')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          email: 'hacker@phone-otp-test.com',
        });

      expect(res.status).toBe(400); // Strict schema rejects unrecognized email key on user profile
    });

    it('allows admin to update user email via admin team details endpoint', async () => {
      const res = await request(app)
        .patch(`/api/team/${testWorker._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'updated-worker@phone-otp-test.com',
          reason: 'Corporate domain migration',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe('updated-worker@phone-otp-test.com');

      const dbPerson = await Person.findById(testWorker._id);
      expect(dbPerson.email).toBe('updated-worker@phone-otp-test.com');
    });

    it('non-admin cannot update email on team details endpoint', async () => {
      const res = await request(app)
        .patch(`/api/team/${testWorker._id}`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          email: 'unauthorized@phone-otp-test.com',
          reason: 'Attempted self update',
        });

      expect(res.status).toBe(403);
    });
  });
});
