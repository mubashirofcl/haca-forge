import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import { app } from '../src/server.js';
import { env } from '../src/config/env.js';
import { Person } from '../src/modules/people/model.js';
import { Department } from '../src/modules/departments/model.js';
import { Profile } from '../src/modules/referenceData/profile.model.js';
import { ContentPiece } from '../src/modules/calendar/contentPiece.model.js';
import { WorkItem } from '../src/modules/workItems/model.js';
import { Session } from '../src/modules/auth/session.model.js';
import { ActivityEvent } from '../src/modules/activity/model.js';
import { Notification } from '../src/modules/notifications/model.js';
import { createNotification } from '../src/modules/notifications/service.js';

const makeAccessToken = (user, sessionId = null) =>
  jwt.sign(
    {
      userId: user._id.toString(),
      role: user.role,
      email: user.email,
      ...(sessionId ? { sessionId: sessionId.toString() } : {}),
    },
    env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );

const makeRefreshToken = (user, sessionId = null, family = 'family-test') =>
  jwt.sign(
    {
      userId: user._id.toString(),
      sessionId: sessionId ? sessionId.toString() : null,
      family,
    },
    env.JWT_REFRESH_SECRET || 'test-refresh-secret',
    { expiresIn: '7d' }
  );

describe('Profile and Settings Comprehensive Suite', () => {
  let adminUser, headUser, smUser, execUser, workerA, workerB, externalWorker;
  let adminToken, headToken, smToken, execToken, workerAToken, workerBToken, externalToken;
  let testDept, testProfile, sharedPiece;

  beforeAll(async () => {
    const mongoUri =
      process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/marketing_portal_test';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }

    // Clean test records
    await Person.deleteMany({ email: /@profile-test\.com$/ });
    await Session.deleteMany({});
    await ActivityEvent.deleteMany({ 'metadata.changedFields': { $exists: true } });
    await Notification.deleteMany({ title: /Security Alert|Work Details Change Request/ });
    await ContentPiece.deleteMany({ topic: /Profile Test/ });
    await WorkItem.deleteMany({ title: /Profile Test/ });

    // Reference data
    testDept = await Department.create({
      name: 'Profile Design Dept',
      code: 'prof_design_' + Date.now(),
    });

    testProfile = await Profile.create({
      name: 'Profile Test Brand',
      code: 'prof_brand_' + Date.now(),
    });

    const hashedPassword = await bcrypt.hash('CurrentPassword123!', 10);

    // Seed 5 canonical roles
    adminUser = await Person.create({
      name: 'Admin Boss',
      email: 'admin@profile-test.com',
      role: 'admin',
      status: 'active',
      passwordHash: hashedPassword,
      departmentId: testDept._id,
      phone: '+15551110001',
      profileCompletedAt: new Date(),
    });

    headUser = await Person.create({
      name: 'Creative Director',
      email: 'creative@profile-test.com',
      role: 'creative_head',
      status: 'active',
      passwordHash: hashedPassword,
      departmentId: testDept._id,
      phone: '+15551110002',
      profileCompletedAt: new Date(),
    });

    smUser = await Person.create({
      name: 'Social Manager',
      email: 'sm@profile-test.com',
      role: 'sm_manager',
      status: 'active',
      passwordHash: hashedPassword,
      departmentId: testDept._id,
      phone: '+15551110003',
      profileCompletedAt: new Date(),
    });

    execUser = await Person.create({
      name: 'Executive Leader',
      email: 'exec@profile-test.com',
      role: 'executive',
      status: 'active',
      passwordHash: hashedPassword,
      departmentId: testDept._id,
      phone: '+15551110004',
      profileCompletedAt: new Date(),
    });

    workerA = await Person.create({
      name: 'Worker Alpha',
      email: 'worker.a@profile-test.com',
      role: 'team_member',
      jobRole: 'Designer',
      status: 'active',
      passwordHash: hashedPassword,
      departmentId: testDept._id,
      phone: '+15551110005',
      profileCompletedAt: new Date(),
    });

    workerB = await Person.create({
      name: 'Worker Beta',
      email: 'worker.b@profile-test.com',
      role: 'team_member',
      jobRole: 'Video Editor',
      status: 'active',
      passwordHash: hashedPassword,
      departmentId: testDept._id,
      phone: '+15551110006',
      profileCompletedAt: new Date(),
    });

    externalWorker = await Person.create({
      name: 'Worker External',
      email: 'worker.ext@profile-test.com',
      role: 'team_member',
      jobRole: 'Writer',
      status: 'active',
      passwordHash: hashedPassword,
      departmentId: testDept._id,
      phone: '+15551110007',
      profileCompletedAt: new Date(),
    });

    // Content piece connecting workerA and workerB (collaborators on the same piece)
    sharedPiece = await ContentPiece.create({
      planId: new mongoose.Types.ObjectId(),
      postingDate: new Date(),
      pipeline: 'reel_a',
      topic: 'Profile Test Shared Piece',
      campaignName: 'Profile Test Campaign',
      profileId: testProfile._id,
      contentType: 'Reel',
      targetAudience: 'General',
      stagePlan: [
        {
          stageKey: 'Design',
          ownerId: workerA._id,
          dueDate: new Date(Date.now() + 86400000),
        },
        {
          stageKey: 'Edit',
          ownerId: workerB._id,
          dueDate: new Date(Date.now() + 172800000),
        },
      ],
    });

    // Generate tokens
    adminToken = makeAccessToken(adminUser);
    headToken = makeAccessToken(headUser);
    smToken = makeAccessToken(smUser);
    execToken = makeAccessToken(execUser);
    workerAToken = makeAccessToken(workerA);
    workerBToken = makeAccessToken(workerB);
    externalToken = makeAccessToken(externalWorker);
  });

  afterAll(async () => {
    await Person.deleteMany({ email: /@profile-test\.com$/ });
    await Session.deleteMany({});
    await ContentPiece.deleteMany({ topic: /Profile Test/ });
    await WorkItem.deleteMany({ title: /Profile Test/ });
    await Department.deleteMany({ _id: testDept._id });
    await Profile.deleteMany({ _id: testProfile._id });
  });

  describe('1. Profile Rendering & Role Panels for All 5 Canonical Roles', () => {
    it('Admin profile returns pendingAccessRequests and usersByRole', async () => {
      const res = await request(app)
        .get('/api/me/profile')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.role).toBe('admin');
      expect(res.body.data.rolePanelData).toBeDefined();
      expect(res.body.data.rolePanelData.adminMetrics).toBeDefined();
      expect(typeof res.body.data.rolePanelData.adminMetrics.pendingAccessRequests).toBe('number');
      expect(res.body.data.rolePanelData.adminMetrics.usersByRole).toBeDefined();
    });

    it('Creative Head profile returns stagesWaitingApproval and plansWaiting', async () => {
      const res = await request(app)
        .get('/api/me/profile')
        .set('Authorization', `Bearer ${headToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.role).toBe('creative_head');
      expect(res.body.data.rolePanelData).toBeDefined();
      expect(res.body.data.rolePanelData.creativeMetrics).toBeDefined();
      expect(typeof res.body.data.rolePanelData.creativeMetrics.stagesWaitingApproval).toBe('number');
      expect(typeof res.body.data.rolePanelData.creativeMetrics.plansWaiting).toBe('number');
    });

    it('Social Media Manager profile returns planStatus, needsOwnerCount, lateItems', async () => {
      const res = await request(app)
        .get('/api/me/profile')
        .set('Authorization', `Bearer ${smToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.role).toBe('sm_manager');
      expect(res.body.data.rolePanelData).toBeDefined();
      expect(res.body.data.rolePanelData.smMetrics).toBeDefined();
      expect(typeof res.body.data.rolePanelData.smMetrics.needsOwnerCount).toBe('number');
      expect(typeof res.body.data.rolePanelData.smMetrics.lateItemsCount).toBe('number');
    });

    it('Executive profile returns companySummary read-only metrics', async () => {
      const res = await request(app)
        .get('/api/me/profile')
        .set('Authorization', `Bearer ${execToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.role).toBe('executive');
      expect(res.body.data.rolePanelData).toBeDefined();
      expect(res.body.data.rolePanelData.companySummary).toBeDefined();
      expect(typeof res.body.data.rolePanelData.companySummary.activeUsersCount).toBe('number');
      expect(typeof res.body.data.rolePanelData.companySummary.activeDeliverablesCount).toBe('number');
    });

    it('Team Member profile returns myCurrentSteps, myLoad, onTimeRate', async () => {
      const res = await request(app)
        .get('/api/me/profile')
        .set('Authorization', `Bearer ${workerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.role).toBe('team_member');
      expect(res.body.data.rolePanelData).toBeDefined();
      expect(res.body.data.rolePanelData.memberMetrics).toBeDefined();
      expect(typeof res.body.data.rolePanelData.memberMetrics.myCurrentStepsCount).toBe('number');
      expect(res.body.data.rolePanelData.memberMetrics.capacityBand).toBeDefined();
    });
  });

  describe('2. Strict Validation, Field Updates, HTML Stripping & Activity Logging', () => {
    it('Updates allowed personal fields and strips HTML', async () => {
      const res = await request(app)
        .patch('/api/me/profile')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({
          preferredName: '<b>Alfie</b>',
          phone: '+15552345678',
          whatsappNumber: '+15552345678',
          languages: ['English', 'Spanish'],
          about: '<i>Passionate designer & visual storyteller.</i>',
          skills: ['Figma', 'Illustrator', 'Branding'],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.preferredName).toBe('Alfie'); // HTML stripped
      expect(res.body.data.about).toBe('Passionate designer & visual storyteller.'); // HTML stripped
      expect(res.body.data.languages).toEqual(['English', 'Spanish']);
      expect(res.body.data.skills).toEqual(['Figma', 'Illustrator', 'Branding']);

      // Verify ActivityEvent recorded field names only (never values)
      const event = await ActivityEvent.findOne({
        entityId: workerA._id,
        action: 'profile.updated',
      }).sort({ createdAt: -1 });

      expect(event).toBeDefined();
      expect(event.metadata.changedFields).toContain('preferredName');
      expect(event.metadata.changedFields).toContain('about');
      expect(JSON.stringify(event.metadata)).not.toContain('Passionate designer');
    });

    it('Strict schema rejects unauthorized modifications to role, email, department, capacity', async () => {
      // Rejects role elevation
      const resRole = await request(app)
        .patch('/api/me/profile')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({ role: 'admin' });
      expect(resRole.status).toBe(400);

      // Rejects email change
      const resEmail = await request(app)
        .patch('/api/me/profile')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({ email: 'newemail@profile-test.com' });
      expect(resEmail.status).toBe(400);

      // Rejects department change
      const resDept = await request(app)
        .patch('/api/me/profile')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({ departmentId: new mongoose.Types.ObjectId() });
      expect(resDept.status).toBe(400);

      // Rejects weekly capacity change
      const resCap = await request(app)
        .patch('/api/me/profile')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({ weeklyCapacityHours: 10 });
      expect(resCap.status).toBe(400);

      // Rejects unknown keys
      const resUnknown = await request(app)
        .patch('/api/me/profile')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({ customInjectionKey: 'malicious' });
      expect(resUnknown.status).toBe(400);
    });

    it('Enforces character limits: about <= 200, languages <= 5, skills <= 10', async () => {
      const longAbout = 'a'.repeat(201);
      const resAbout = await request(app)
        .patch('/api/me/profile')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({ about: longAbout });
      expect(resAbout.status).toBe(400);

      const tooManyLangs = ['1', '2', '3', '4', '5', '6'];
      const resLangs = await request(app)
        .patch('/api/me/profile')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({ languages: tooManyLangs });
      expect(resLangs.status).toBe(400);

      const tooManySkills = Array.from({ length: 11 }, (_, i) => `Skill${i}`);
      const resSkills = await request(app)
        .patch('/api/me/profile')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({ skills: tooManySkills });
      expect(resSkills.status).toBe(400);
    });
  });

  describe('3. Avatar Processing, Replacement & Deletion', () => {
    it('Rejects non-image avatar upload', async () => {
      const res = await request(app)
        .post('/api/me/avatar')
        .set('Authorization', `Bearer ${workerAToken}`)
        .attach('avatar', Buffer.from('console.log("bad")'), 'script.js');

      expect(res.status).toBe(400);
    });

    it('Uploads valid image avatar and removes prior image on replacement', async () => {
      // Upload avatar 1
      const fakePng1 = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48,
        0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00,
        0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78,
        0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
        0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
      ]);

      const res1 = await request(app)
        .post('/api/me/avatar')
        .set('Authorization', `Bearer ${workerAToken}`)
        .attach('avatar', fakePng1, 'photo1.png');

      expect(res1.status).toBe(200);
      expect(res1.body.data.avatarUrl).toBeDefined();

      const updatedUser1 = await Person.findById(workerA._id);
      expect(updatedUser1.avatarUrl).toBeDefined();
      const firstStorageId = updatedUser1.avatarStorageId;

      // Upload avatar 2 to replace
      const res2 = await request(app)
        .post('/api/me/avatar')
        .set('Authorization', `Bearer ${workerAToken}`)
        .attach('avatar', fakePng1, 'photo2.png');

      expect(res2.status).toBe(200);
      const updatedUser2 = await Person.findById(workerA._id);
      expect(updatedUser2.avatarStorageId).not.toBe(firstStorageId);

      // Verify old file is removed if on disk
      if (firstStorageId) {
        const oldPath = path.resolve(process.cwd(), 'uploads', firstStorageId);
        expect(fs.existsSync(oldPath)).toBe(false);
      }
    });

    it('DELETE /api/me/avatar removes photo and cleans storage', async () => {
      const res = await request(app)
        .delete('/api/me/avatar')
        .set('Authorization', `Bearer ${workerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const refreshed = await Person.findById(workerA._id);
      expect(refreshed.avatarUrl).toBeNull();
      expect(refreshed.avatarStorageId).toBeNull();
    });
  });

  describe('4. Settings Persistence & Strict Rules', () => {
    it('Persists preferences (startPage, dateFormat, timeFormat, weekStart) and notificationPrefs', async () => {
      const res = await request(app)
        .patch('/api/me/settings')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({
          preferences: {
            startPage: 'My Work',
            dateFormat: 'YYYY-MM-DD',
            timeFormat: '24h',
            weekStart: 'monday',
          },
          notificationPrefs: {
            mySteps: { inApp: true, email: false },
            approvalsRevisions: { inApp: false, email: false },
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.preferences.startPage).toBe('My Work');
      expect(res.body.data.preferences.dateFormat).toBe('YYYY-MM-DD');
      expect(res.body.data.preferences.timeFormat).toBe('24h');
      expect(res.body.data.notificationPrefs.mySteps.email).toBe(false);

      // GET /api/me/settings returns persisted values
      const getRes = await request(app)
        .get('/api/me/settings')
        .set('Authorization', `Bearer ${workerAToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.preferences.startPage).toBe('My Work');
    });

    it('Rejects unauthorized/unknown fields on /api/me/settings', async () => {
      const res = await request(app)
        .patch('/api/me/settings')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({ unknownConfig: 'dangerous' });

      expect(res.status).toBe(400);
    });
  });

  describe('5. Password Change Validation, Rate Limiting & Mandatory Notice', () => {
    it('Rejects wrong current password', async () => {
      const res = await request(app)
        .post('/api/me/password')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({
          currentPassword: 'WrongPassword123!',
          newPassword: 'BrandNewPassword123!',
          confirmPassword: 'BrandNewPassword123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_CURRENT_PASSWORD');
    });

    it('Rejects new password failing complexity rules', async () => {
      // Missing uppercase
      const resNoUpper = await request(app)
        .post('/api/me/password')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({
          currentPassword: 'CurrentPassword123!',
          newPassword: 'lowercaseonly123',
          confirmPassword: 'lowercaseonly123',
        });
      expect(resNoUpper.status).toBe(400);

      // Missing number
      const resNoNum = await request(app)
        .post('/api/me/password')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({
          currentPassword: 'CurrentPassword123!',
          newPassword: 'NoNumberHere!',
          confirmPassword: 'NoNumberHere!',
        });
      expect(resNoNum.status).toBe(400);

      // Same as current password
      const resSame = await request(app)
        .post('/api/me/password')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({
          currentPassword: 'CurrentPassword123!',
          newPassword: 'CurrentPassword123!',
          confirmPassword: 'CurrentPassword123!',
        });
      expect(resSame.status).toBe(400);
    });

    it('Updates password on valid input and records security ActivityEvent', async () => {
      const res = await request(app)
        .post('/api/me/password')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({
          currentPassword: 'CurrentPassword123!',
          newPassword: 'ValidNewPassword123!',
          confirmPassword: 'ValidNewPassword123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // ActivityEvent recorded
      const event = await ActivityEvent.findOne({
        entityId: workerA._id,
        action: 'password.changed',
      });
      expect(event).toBeDefined();
    });

    it('Triggers rate limit after 5 consecutive password attempts', async () => {
      // Execute 5 rapid attempts to trigger rate limit window
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/me/password')
          .set('Authorization', `Bearer ${workerBToken}`)
          .send({
            currentPassword: 'BadPassword',
            newPassword: 'Password123!',
            confirmPassword: 'Password123!',
          });
      }

      // 6th attempt should be rate limited
      const rateLimitedRes = await request(app)
        .post('/api/me/password')
        .set('Authorization', `Bearer ${workerBToken}`)
        .send({
          currentPassword: 'BadPassword',
          newPassword: 'Password123!',
          confirmPassword: 'Password123!',
        });

      expect(rateLimitedRes.status).toBe(429);
      expect(rateLimitedRes.body.code).toBe('PASSWORD_RATE_LIMITED');
    });
  });

  describe('6. Active Sessions & Device Management', () => {
    let sessionA, sessionB;

    beforeAll(async () => {
      sessionA = await Session.create({
        userId: workerA._id,
        deviceLabel: 'Chrome on Mac OS X',
        ipHash: 'abc123hash',
        refreshTokenHash: 'hashA',
        refreshTokenFamily: 'family-worker-a',
        lastUsedAt: new Date(),
      });

      sessionB = await Session.create({
        userId: workerA._id,
        deviceLabel: 'Safari on iPhone',
        ipHash: 'def456hash',
        refreshTokenHash: 'hashB',
        refreshTokenFamily: 'family-worker-b',
        lastUsedAt: new Date(Date.now() - 3600000),
      });
    });

    it('Lists active sessions with deviceLabel and isCurrent flag', async () => {
      const activeRefreshToken = makeRefreshToken(workerA, sessionA._id);

      const res = await request(app)
        .get('/api/me/sessions')
        .set('Authorization', `Bearer ${workerAToken}`)
        .set('Cookie', `refreshToken=${activeRefreshToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);

      const current = res.body.data.find((s) => s.isCurrent);
      expect(current).toBeDefined();
      expect(current._id.toString()).toBe(sessionA._id.toString());
    });

    it('Revokes a single session by id', async () => {
      const res = await request(app)
        .delete(`/api/me/sessions/${sessionB._id}`)
        .set('Authorization', `Bearer ${workerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const revoked = await Session.findById(sessionB._id);
      expect(revoked.revokedAt).toBeDefined();
    });

    it('Revokes all other sessions leaving only the current device', async () => {
      // Re-create an extra active session
      const sessionExtra = await Session.create({
        userId: workerA._id,
        deviceLabel: 'Firefox on Linux',
        ipHash: 'ghi789hash',
        refreshTokenHash: 'hashExtra',
        refreshTokenFamily: 'family-worker-c',
        lastUsedAt: new Date(),
      });

      const activeRefreshToken = makeRefreshToken(workerA, sessionA._id);

      const res = await request(app)
        .post('/api/me/sessions/revoke-others')
        .set('Authorization', `Bearer ${workerAToken}`)
        .set('Cookie', `refreshToken=${activeRefreshToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const extraRevoked = await Session.findById(sessionExtra._id);
      expect(extraRevoked.revokedAt).toBeDefined();

      const currentStillActive = await Session.findById(sessionA._id);
      expect(currentStillActive.revokedAt).toBeNull();
    });
  });

  describe('7. Change Request Form & Admin Alerting', () => {
    it('Notifies every active admin and creates ActivityEvent upon change request', async () => {
      const res = await request(app)
        .post('/api/me/change-request')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({
          requestedChanges: 'Please update my department to Brand Design & increase weekly capacity.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify admin received notification
      const adminNotif = await Notification.findOne({
        recipient: adminUser._id,
        type: 'change_request',
      });
      expect(adminNotif).toBeDefined();
      expect(adminNotif.title).toContain('Change Request');

      // Verify ActivityEvent
      const event = await ActivityEvent.findOne({
        entityId: workerA._id,
        action: 'profile.change_requested',
      });
      expect(event).toBeDefined();
      expect(event.metadata.changedFields).toContain('requestedChanges');
    });
  });

  describe('8. Role Scoping, Visibility & Teammate Card Masking', () => {
    it('Admin sees full contact details (email, phone) for another user', async () => {
      const res = await request(app)
        .get(`/api/people/${workerA._id}/profile`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe(workerA.email);
      expect(res.body.data.phone).toBe('+15552345678');
    });

    it('Creative Head sees full contact details', async () => {
      const res = await request(app)
        .get(`/api/people/${workerA._id}/profile`)
        .set('Authorization', `Bearer ${headToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe(workerA.email);
    });

    it('Social Media Manager sees full contact details', async () => {
      const res = await request(app)
        .get(`/api/people/${workerA._id}/profile`)
        .set('Authorization', `Bearer ${smToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe(workerA.email);
    });

    it('Executive sees masked contact details (email, phone are null)', async () => {
      const res = await request(app)
        .get(`/api/people/${workerA._id}/profile`)
        .set('Authorization', `Bearer ${execToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBeNull();
      expect(res.body.data.phone).toBeNull();
      expect(res.body.data.whatsappNumber).toBeNull();
    });

    it('Worker viewing non-teammate outside shared content piece is rejected (HTTP 403)', async () => {
      // workerA and externalWorker share NO content piece
      const res = await request(app)
        .get(`/api/people/${externalWorker._id}/profile`)
        .set('Authorization', `Bearer ${workerAToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN_TEAMMATE_OUTSIDE_SHARED_PIECE');
    });

    it('Worker viewing collaborator on shared content piece gets profile with masked contact details', async () => {
      // workerA and workerB are collaborators on sharedPiece
      const res = await request(app)
        .get(`/api/people/${workerB._id}/profile`)
        .set('Authorization', `Bearer ${workerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe(workerB.name);
      expect(res.body.data.email).toBeNull(); // Worker sees NO contact details of teammate
      expect(res.body.data.phone).toBeNull();
    });
  });

  describe('9. Admin Management of Another Person (Name, Phone & Avatar)', () => {
    it('Admin can fix another person name and phone', async () => {
      const res = await request(app)
        .patch(`/api/people/${externalWorker._id}/basic-info`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Worker Corrected',
          phone: '+15559998888',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Worker Corrected');
      expect(res.body.data.phone).toBe('+15559998888');
    });

    it('Non-admin cannot fix another person basic info', async () => {
      const res = await request(app)
        .patch(`/api/people/${externalWorker._id}/basic-info`)
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({ name: 'Hacked Name' });

      expect(res.status).toBe(403);
    });

    it('Admin can remove another person avatar', async () => {
      // Set an avatar first
      externalWorker.avatarUrl = '/uploads/test_ext.png';
      externalWorker.avatarStorageId = 'test_ext.png';
      await externalWorker.save();

      const res = await request(app)
        .delete(`/api/people/${externalWorker._id}/avatar`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const refreshed = await Person.findById(externalWorker._id);
      expect(refreshed.avatarUrl).toBeNull();
    });
  });

  describe('10. First-Login Welcome Flow', () => {
    let freshUser, freshToken;

    beforeAll(async () => {
      freshUser = await Person.create({
        name: 'New Joinee',
        email: 'newjoinee@profile-test.com',
        role: 'team_member',
        status: 'active',
        passwordHash: await bcrypt.hash('InitialPassword123!', 10),
        profileCompletedAt: null, // Uncompleted profile
      });

      freshToken = makeAccessToken(freshUser);
    });

    it('Blocks completion if phone or name is missing', async () => {
      const res = await request(app)
        .post('/api/me/welcome')
        .set('Authorization', `Bearer ${freshToken}`)
        .send({ name: 'Valid Name', phone: 'invalid-phone' });

      expect(res.status).toBe(400);
    });

    it('Completes welcome setup with valid name and phone and marks profileCompletedAt', async () => {
      const res = await request(app)
        .post('/api/me/welcome')
        .set('Authorization', `Bearer ${freshToken}`)
        .send({
          name: 'New Joinee Confirmed',
          phone: '+15554443322',
          avatarUrl: null,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updated = await Person.findById(freshUser._id);
      expect(updated.profileCompletedAt).toBeDefined();
      expect(updated.name).toBe('New Joinee Confirmed');
      expect(updated.phone).toBe('+15554443322');
    });
  });

  describe('11. Notification Preferences Category Suppression', () => {
    it('Suppresses in-app notification when user category preference is disabled', async () => {
      // Set workerA preference: mySteps inApp = false
      workerA.notificationPrefs = {
        mySteps: { inApp: false, email: false },
      };
      await workerA.save();

      const notif = await createNotification({
        recipient: workerA._id,
        type: 'step_assigned',
        title: 'Step Assigned to You',
        message: 'You have been assigned to Design stage.',
      });

      expect(notif).toBeNull(); // Suppressed!
    });

    it('Never suppresses security alerts regardless of preferences', async () => {
      // User disabled all notification categories
      workerA.notificationPrefs = {
        system: { inApp: false, email: false },
        mySteps: { inApp: false, email: false },
      };
      await workerA.save();

      const securityNotif = await createNotification({
        recipient: workerA._id,
        type: 'security_alert',
        title: 'Security Alert: Password Changed',
        message: 'Your password was changed.',
      });

      expect(securityNotif).not.toBeNull();
      expect(securityNotif.type).toBe('security_alert');
    });
  });
});
