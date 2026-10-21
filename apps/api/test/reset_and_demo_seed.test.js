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
    it('creates all 9 demo users with correct roles, job roles and supervisor hierarchies', async () => {
      const result = await seedDemoUsers();
      expect(result.users.length).toBe(9);

      // Verify Marketing Head
      const head = await Person.findOne({ email: 'head@demo.haca.local' });
      expect(head).toBeDefined();
      expect(head.role).toBe('marketing_head');
      expect(head.profileAccess.length).toBe(7); // Access to all 7 brands

      // Verify Design Lead
      const designLead = await Person.findOne({ email: 'lead.design@demo.haca.local' });
      expect(designLead).toBeDefined();
      expect(designLead.role).toBe('team_lead');
      expect(designLead.jobRole).toBe('Design Lead (TL)');
      expect(designLead.profileAccess.length).toBe(2);

      // Verify Creative Manager
      const creativeManager = await Person.findOne({ email: 'manager.creative@demo.haca.local' });
      expect(creativeManager).toBeDefined();
      expect(creativeManager.role).toBe('team_lead');
      expect(creativeManager.jobRole).toBe('Creative Manager (TL)');
      expect(creativeManager.profileAccess.length).toBe(2);

      // Verify UI Designer reports to BOTH Design Lead AND Creative Manager
      const uiDesigner = await Person.findOne({ email: 'ui.designer@demo.haca.local' });
      expect(uiDesigner).toBeDefined();
      expect(uiDesigner.role).toBe('team_member');
      expect(uiDesigner.jobRole).toBe('UI Designer');
      expect(uiDesigner.reportsToIds.length).toBe(2);
      const leadIdStrs = uiDesigner.reportsToIds.map((id) => id.toString());
      expect(leadIdStrs).toContain(designLead._id.toString());
      expect(leadIdStrs).toContain(creativeManager._id.toString());

      // Verify Designer reports to Design Lead
      const designer = await Person.findOne({ email: 'designer@demo.haca.local' });
      expect(designer.reportsToIds[0]?.toString()).toBe(designLead._id.toString());

      // Verify Video Editor reports to Creative Manager
      const videoEditor = await Person.findOne({ email: 'video.editor@demo.haca.local' });
      expect(videoEditor.reportsToIds[0]?.toString()).toBe(creativeManager._id.toString());

      // Verify sample pending AccessRequests exist
      const sampleReqs = await AccessRequest.find({ email: /@demo\.haca\.local$/i });
      expect(sampleReqs.length).toBe(2);
      const roles = sampleReqs.map((r) => r.requestedRole);
      expect(roles).toContain('team_member');
      expect(roles).toContain('team_lead');
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
