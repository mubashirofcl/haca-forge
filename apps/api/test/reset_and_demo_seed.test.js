import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { Person } from '../src/modules/people/model.js';
import { AccessRequest } from '../src/modules/access/model.js';
import { runMarketingOsReset } from '../../../scripts/reset-data-marketing-os.js';
import { seedDemoUsers } from '../../../scripts/seed-demo-users.js';

describe('Phase 1b: Database Reset Script Guards & Demo Seed', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDemoPass = process.env.DEMO_SEED_PASSWORD;

  beforeAll(async () => {
    const mongoUri =
      process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/marketing_portal_test';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }
    process.env.DEMO_SEED_PASSWORD = 'TestSecretPass123!';
  });

  afterAll(async () => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.DEMO_SEED_PASSWORD = originalDemoPass;
    // Clean up demo users from test database
    await Person.deleteMany({ email: /@demo\.haca\.local$/i });
    await AccessRequest.deleteMany({ email: /@demo\.haca\.local$/i });
  });

  describe('Reset Script Guards', () => {
    it('runs in dry-run mode by default and makes zero changes', async () => {
      const initialUsersCount = await Person.countDocuments();
      const res = await runMarketingOsReset(['--keep-emails=test@example.com'], mongoose.connection.db);

      expect(res.mode).toBe('dry-run');
      expect(res.collectionPlans.length).toBeGreaterThan(0);

      const afterUsersCount = await Person.countDocuments();
      expect(afterUsersCount).toBe(initialUsersCount);
    });

    it('refuses execution when NODE_ENV is production', async () => {
      process.env.NODE_ENV = 'production';
      try {
        await expect(
          runMarketingOsReset(
            ['--confirm', `--db-name=${mongoose.connection.db.databaseName}`, '--keep-emails=test@example.com'],
            mongoose.connection.db
          )
        ).rejects.toThrow('CRITICAL SAFETY GUARD');
      } finally {
        process.env.NODE_ENV = 'test';
      }
    });

    it('refuses destructive reset if --db-name does not match connected database', async () => {
      await expect(
        runMarketingOsReset(
          ['--confirm', '--db-name=wrong_database_name', '--keep-emails=test@example.com'],
          mongoose.connection.db
        )
      ).rejects.toThrow('--db-name parameter is required and must match connected database name');
    });

    it('refuses destructive reset if --keep-emails is missing or empty', async () => {
      await expect(
        runMarketingOsReset(
          ['--confirm', `--db-name=${mongoose.connection.db.databaseName}`],
          mongoose.connection.db
        )
      ).rejects.toThrow('--keep-emails is required for destructive reset');
    });

    it('refuses destructive reset if DEMO_SEED_PASSWORD is not set', async () => {
      delete process.env.DEMO_SEED_PASSWORD;
      try {
        await expect(
          runMarketingOsReset(
            ['--confirm', `--db-name=${mongoose.connection.db.databaseName}`, '--keep-emails=admin@test.com'],
            mongoose.connection.db
          )
        ).rejects.toThrow('DEMO_SEED_PASSWORD is not configured');
      } finally {
        process.env.DEMO_SEED_PASSWORD = 'TestSecretPass123!';
      }
    });

    it('prints rollback information when --rollback-info is passed', async () => {
      const res = await runMarketingOsReset(['--rollback-info'], mongoose.connection.db);
      expect(res.mode).toBe('rollback-info');
    });
  });

  describe('Part C: Demo Users Seeding', () => {
    it('creates all 9 demo users with correct roles, job roles, work preferences and supervisor hierarchies', async () => {
      const result = await seedDemoUsers();
      expect(result.users.length).toBe(9);

      // Verify Creative Head
      const head = await Person.findOne({ email: 'creative.head@demo.haca.local' });
      expect(head).toBeDefined();
      expect(head.role).toBe('creative_head');
      expect(head.profileAccess.length).toBe(7); // Access to all 7 brands
      expect(head.workPreferences).toEqual(['Content', 'Script', 'Post']);

      // Verify Demo Executive
      const executive = await Person.findOne({ email: 'executive@demo.haca.local' });
      expect(executive).toBeDefined();
      expect(executive.role).toBe('executive');
      expect(executive.profileAccess.length).toBe(7); // Access to all 7 brands by default
      expect(executive.reportsToIds.length).toBe(0);
      expect(executive.departmentId).toBeNull();
      expect(executive.workPreferences).toEqual([]);

      // Verify Demo SM Manager
      const smManager = await Person.findOne({ email: 'sm.manager@demo.haca.local' });
      expect(smManager).toBeDefined();
      expect(smManager.role).toBe('sm_manager');
      expect(smManager.jobRole).toBe('Social Media Manager');
      expect(smManager.workPreferences).toEqual(['Post', 'Content']);

      // Verify UI Designer
      const uiDesigner = await Person.findOne({ email: 'ui.designer@demo.haca.local' });
      expect(uiDesigner).toBeDefined();
      expect(uiDesigner.role).toBe('team_member');
      expect(uiDesigner.jobRole).toBe('UI Designer');
      expect(uiDesigner.workPreferences).toEqual(['Design']);

      // Verify Designer
      const designer = await Person.findOne({ email: 'designer@demo.haca.local' });
      expect(designer).toBeDefined();
      expect(designer.role).toBe('team_member');
      expect(designer.workPreferences).toEqual(['Design']);

      // Verify Video Editor
      const videoEditor = await Person.findOne({ email: 'video.editor@demo.haca.local' });
      expect(videoEditor).toBeDefined();
      expect(videoEditor.role).toBe('team_member');
      expect(videoEditor.workPreferences).toEqual(['Edit', 'Shoot']);

      // Verify Writer
      const writer = await Person.findOne({ email: 'writer@demo.haca.local' });
      expect(writer).toBeDefined();
      expect(writer.role).toBe('team_member');
      expect(writer.workPreferences).toEqual(['Content', 'Script']);

      // Verify sample pending AccessRequests exist
      const sampleReqs = await AccessRequest.find({ email: /@demo\.haca\.local$/i });
      expect(sampleReqs.length).toBe(2);
      const roles = sampleReqs.map((r) => r.requestedRole);
      expect(roles).toContain('team_member');
      expect(roles).toContain('sm_manager');
    });

    it('is completely idempotent on a second run without duplicating users', async () => {
      const initialCount = await Person.countDocuments({ email: /@demo\.haca\.local$/i });
      const initialReqCount = await AccessRequest.countDocuments({ email: /@demo\.haca\.local$/i });

      await seedDemoUsers();

      const afterCount = await Person.countDocuments({ email: /@demo\.haca\.local$/i });
      const afterReqCount = await AccessRequest.countDocuments({ email: /@demo\.haca\.local$/i });

      expect(afterCount).toBe(initialCount);
      expect(afterReqCount).toBe(initialReqCount);
    });

    it('cleans up all demo users and access requests with --remove-demo', async () => {
      const removeResult = await seedDemoUsers({ remove: true });
      expect(removeResult.removedUsers).toBeGreaterThanOrEqual(9);
      expect(removeResult.removedRequests).toBe(2);

      const remainingDemoUsers = await Person.countDocuments({ email: /@demo\.haca\.local$/i });
      expect(remainingDemoUsers).toBe(0);

      const remainingDemoRequests = await AccessRequest.countDocuments({ email: /@demo\.haca\.local$/i });
      expect(remainingDemoRequests).toBe(0);
    });
  });
});
