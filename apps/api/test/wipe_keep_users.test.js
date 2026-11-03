import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoClient } from 'mongodb';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  runWipeKeepUsers,
  validateHost,
  isPathInsideRepo,
  extractCloudinaryUrls,
  CANONICAL_DEPARTMENT_CODES,
  CANONICAL_REPORT_KEYS,
} from '../../../scripts/wipe-keep-users.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');

describe('Database Wipe Script (scripts/wipe-keep-users.js)', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const testDbUri = 'mongodb://127.0.0.1:27017';
  const testDbName = 'marketing_portal_wipe_test';
  const testBackupDir = path.resolve(REPO_ROOT, '../haca-backups/test-wipe-backup');

  let client;
  let testDb;

  async function seedTestData() {
    // 1. Users (all 5 roles + pending invite user)
    await testDb.collection('users').deleteMany({});
    await testDb.collection('users').insertMany([
      {
        name: 'Super Admin',
        email: 'admin@hacaforge.com',
        role: 'admin',
        passwordHash: 'admin_hash_preserved',
        status: 'active',
        refreshTokens: ['token_123', 'token_456'],
      },
      {
        name: 'Creative Head',
        email: 'head@demo.haca.local',
        role: 'creative_head',
        passwordHash: 'head_hash_preserved',
        status: 'active',
        workPreferences: ['Script', 'Design'],
        refreshTokens: ['token_789'],
      },
      {
        name: 'SM Manager',
        email: 'sm@demo.haca.local',
        role: 'sm_manager',
        passwordHash: 'sm_hash_preserved',
        status: 'active',
        workPreferences: ['Post'],
        refreshTokens: [],
      },
      {
        name: 'Team Member Worker',
        email: 'writer@demo.haca.local',
        role: 'team_member',
        passwordHash: 'writer_hash_preserved',
        status: 'active',
        workPreferences: ['Content'],
        refreshTokens: ['token_abc'],
      },
      {
        name: 'Pending Invite Member',
        email: 'pending@demo.haca.local',
        role: 'team_member',
        status: 'active',
        mustSetPassword: true,
        resetPasswordTokenHash: 'hash_invite_123',
        resetPasswordExpiresAt: new Date(Date.now() + 86400000),
        refreshTokens: [],
      },
      {
        name: 'Executive Leader',
        email: 'exec@demo.haca.local',
        role: 'executive',
        passwordHash: 'exec_hash_preserved',
        status: 'active',
        refreshTokens: [],
      },
    ]);

    // 2. Transactional collections with mock documents (some including Cloudinary URLs)
    await testDb.collection('workitems').deleteMany({});
    await testDb.collection('workitems').insertMany([
      { title: 'Work Item 1', status: 'in_progress', deliverableUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg' },
      { title: 'Work Item 2', status: 'done', deliverableUrl: 'https://figma.com/file/123' },
    ]);

    await testDb.collection('activityevents').deleteMany({});
    await testDb.collection('activityevents').insertMany([
      { type: 'item_created', title: 'Event 1' },
      { type: 'item_moved', title: 'Event 2', metadata: { assetUrl: 'https://cloudinary.com/demo/video.mp4' } },
    ]);

    await testDb.collection('calendarplans').deleteMany({});
    await testDb.collection('calendarplans').insertMany([
      { title: 'October Plan', status: 'Approved' },
    ]);

    await testDb.collection('contentpieces').deleteMany({});
    await testDb.collection('contentpieces').insertMany([
      { title: 'Post 1', status: 'draft' },
    ]);

    await testDb.collection('accessrequests').deleteMany({});
    await testDb.collection('accessrequests').insertMany([
      { email: 'applicant@test.com', status: 'pending' },
    ]);

    await testDb.collection('notifications').deleteMany({});
    await testDb.collection('notifications').insertMany([
      { title: 'New task assigned', read: false },
    ]);

    await testDb.collection('assignment_overrides').deleteMany({});
    await testDb.collection('assignment_overrides').insertMany([
      { stage: 'Design', reason: 'Capacity override' },
    ]);

    // 3. Retired collection without model
    await testDb.collection('teams').deleteMany({});
    await testDb.collection('teams').insertMany([
      { name: 'Core Design', code: 'design' },
      { name: 'Video Ops', code: 'video' },
    ]);

    // 4. Reference collections with extra/stale data
    await testDb.collection('departments').deleteMany({});
    await testDb.collection('departments').insertMany([
      { name: 'Design', code: 'design' },
      { name: 'Video Production', code: 'video_production' },
      { name: 'Social Media', code: 'social_media' },
      { name: 'SEO & Content', code: 'seo_content' },
      { name: 'WhatsApp', code: 'whatsapp' },
      { name: 'Performance Marketing', code: 'performance_marketing' },
      { name: 'Tech', code: 'tech' },
      { name: 'Legacy Academic Affairs', code: 'legacy_academic' },
      { name: 'Legacy Events', code: 'legacy_events' },
    ]);

    await testDb.collection('priorities').deleteMany({});
    await testDb.collection('priorities').insertMany([
      { name: 'Urgent', level: 1 },
      { name: 'High', level: 2 },
      { name: 'Medium', level: 3 },
      { name: 'Low', level: 4 },
    ]);

    await testDb.collection('profiles').deleteMany({});
    await testDb.collection('profiles').insertMany([
      { name: 'HACA', code: 'haca', active: true, isActive: true },
      { name: 'HACA Mideast', code: 'haca_mideast', active: true, isActive: true },
      { name: 'HACA Design School', code: 'haca_design_school', active: true, isActive: true },
    ]);

    await testDb.collection('automationrules').deleteMany({});
    await testDb.collection('automationrules').insertMany([
      {
        ruleKey: 'overdue_escalation',
        name: 'Exec Overdue Rule',
        description: 'Test rule renamed',
        lastRunAt: new Date(),
        lastRunStatus: 'error',
        errorCount: 3,
      },
      {
        ruleKey: 'weekly_report',
        name: 'Weekly Marketing Executive Digest',
        lastRunAt: new Date(),
        lastRunStatus: 'success',
        errorCount: 0,
      },
    ]);

    await testDb.collection('reportdefinitions').deleteMany({});
    await testDb.collection('reportdefinitions').insertMany([
      {
        reportKey: 'weekly_marketing',
        name: 'Weekly Work Report',
        lastGeneratedAt: new Date(),
        recipients: ['custom.user@deleted.com', '6ade4251173358061b8903c6'],
      },
      {
        reportKey: 'monthly_scorecard',
        name: 'Monthly Performance Scorecard',
        lastGeneratedAt: new Date(),
        recipients: ['creative_head', 'admin'],
      },
    ]);

    await testDb.collection('settings').deleteMany({});
    await testDb.collection('settings').insertOne({
      defaultWeeklyCapacityHours: 40,
    });
  }

  beforeAll(async () => {
    client = new MongoClient(testDbUri);
    await client.connect();
    testDb = client.db(testDbName);
    await seedTestData();
  });

  afterAll(async () => {
    process.env.NODE_ENV = originalNodeEnv;
    if (fs.existsSync(testBackupDir)) {
      fs.rmSync(testBackupDir, { recursive: true, force: true });
    }
    if (testDb) {
      await testDb.dropDatabase();
    }
    if (client) {
      await client.close();
    }
  });

  describe('Utility & Host Validation', () => {
    it('validateHost allows local host addresses', () => {
      expect(validateHost('mongodb://localhost:27017/marketing_portal')).toBe(true);
      expect(validateHost('mongodb://127.0.0.1:27017/marketing_portal')).toBe(true);
      expect(validateHost('mongodb://[::1]:27017/marketing_portal')).toBe(true);
    });

    it('validateHost rejects non-local host addresses', () => {
      expect(validateHost('mongodb://192.168.1.50:27017/marketing_portal')).toBe(false);
      expect(validateHost('mongodb+srv://user:pass@cluster.mongodb.net/marketing_portal')).toBe(false);
      expect(validateHost('mongodb://production-cluster.internal:27017/prod')).toBe(false);
    });

    it('isPathInsideRepo correctly flags inside vs outside repo', () => {
      expect(isPathInsideRepo(path.join(REPO_ROOT, 'scripts'))).toBe(true);
      expect(isPathInsideRepo(path.join(REPO_ROOT, 'docs'))).toBe(true);
      expect(isPathInsideRepo(path.join(REPO_ROOT, '../haca-backups/test'))).toBe(false);
      expect(isPathInsideRepo('C:\\temp\\backups')).toBe(false);
    });

    it('extractCloudinaryUrls extracts and deduplicates cloudinary URLs', () => {
      const docs = [
        { url: 'https://res.cloudinary.com/haca/image/upload/banner.png' },
        { nested: { media: ['https://res.cloudinary.com/haca/image/upload/banner.png', 'https://figma.com/file'] } },
        { video: 'https://cloudinary.com/v1/video.mp4' },
      ];
      const urls = extractCloudinaryUrls(docs);
      expect(urls).toHaveLength(2);
      expect(urls).toContain('https://res.cloudinary.com/haca/image/upload/banner.png');
      expect(urls).toContain('https://cloudinary.com/v1/video.mp4');
    });
  });

  describe('Safety Guards & Dry-run Mode', () => {
    it('refuses execution if NODE_ENV is production', async () => {
      process.env.NODE_ENV = 'production';
      await expect(
        runWipeKeepUsers(['--confirm', `--db-name=${testDbName}`], testDb)
      ).rejects.toThrow(/Cannot execute wipe script when NODE_ENV is "production"/);
      process.env.NODE_ENV = 'development';
    });

    it('refuses execution if host is non-local', async () => {
      await expect(
        runWipeKeepUsers(['--uri=mongodb://remote.server:27017/db', '--confirm', '--db-name=db'])
      ).rejects.toThrow(/Cannot wipe non-local database host/);
    });

    it('refuses confirmed run if --db-name does not match actual connected database', async () => {
      await expect(
        runWipeKeepUsers(['--confirm', '--db-name=wrong_db_name'], testDb)
      ).rejects.toThrow(/does not match connected database/);
    });

    it('refuses confirmed run if backup directory is inside repository', async () => {
      const insideBackup = path.join(REPO_ROOT, 'backup-inside');
      await expect(
        runWipeKeepUsers(
          ['--confirm', `--db-name=${testDbName}`, `--backup-dir=${insideBackup}`],
          testDb
        )
      ).rejects.toThrow(/Backup folder MUST be outside the repository/);
    });

    it('dry-run mode changes nothing in the database', async () => {
      const beforeUsers = await testDb.collection('users').countDocuments();
      const beforeWork = await testDb.collection('workitems').countDocuments();
      const beforeEvents = await testDb.collection('activityevents').countDocuments();

      const result = await runWipeKeepUsers([`--db-name=${testDbName}`], testDb);

      expect(result.mode).toBe('dry-run');
      expect(result.executed).toBe(false);

      const afterUsers = await testDb.collection('users').countDocuments();
      const afterWork = await testDb.collection('workitems').countDocuments();
      const afterEvents = await testDb.collection('activityevents').countDocuments();

      expect(afterUsers).toBe(beforeUsers);
      expect(afterWork).toBe(beforeWork);
      expect(afterEvents).toBe(beforeEvents);
    });
  });

  describe('Confirmed Execution & Full Wipe Behavior', () => {
    let result;

    beforeAll(async () => {
      await seedTestData();
      result = await runWipeKeepUsers(
        [
          '--confirm',
          `--db-name=${testDbName}`,
          `--backup-dir=${testBackupDir}`,
          '--drop-empty',
        ],
        testDb
      );
    });

    it('executes successfully in confirmed mode', () => {
      expect(result.mode).toBe('confirmed');
      expect(result.executed).toBe(true);
    });

    it('created backup folder outside repo with non-empty JSON files', () => {
      expect(fs.existsSync(testBackupDir)).toBe(true);
      const files = fs.readdirSync(testBackupDir);
      expect(files).toContain('users.json');
      expect(files).toContain('workitems.json');
      expect(files).toContain('activityevents.json');

      const userStat = fs.statSync(path.join(testBackupDir, 'users.json'));
      expect(userStat.size).toBeGreaterThan(0);
    });

    it('wrote cloudinary-urls.txt with all referenced URLs found in deleted documents', () => {
      const cloudinaryPath = path.join(testBackupDir, 'cloudinary-urls.txt');
      expect(fs.existsSync(cloudinaryPath)).toBe(true);
      const content = fs.readFileSync(cloudinaryPath, 'utf8');
      expect(content).toContain('https://res.cloudinary.com/demo/image/upload/sample.jpg');
      expect(content).toContain('https://cloudinary.com/demo/video.mp4');
    });

    it('KEPT ALL 6 USERS UNCHANGED, preserving roles, passwords, and pending invites', async () => {
      const users = await testDb.collection('users').find({}).toArray();
      expect(users).toHaveLength(6);

      const admin = users.find((u) => u.email === 'admin@hacaforge.com');
      expect(admin.role).toBe('admin');
      expect(admin.passwordHash).toBe('admin_hash_preserved');

      const head = users.find((u) => u.email === 'head@demo.haca.local');
      expect(head.role).toBe('creative_head');
      expect(head.workPreferences).toEqual(['Script', 'Design']);

      const pending = users.find((u) => u.email === 'pending@demo.haca.local');
      expect(pending.mustSetPassword).toBe(true);
      expect(pending.resetPasswordTokenHash).toBe('hash_invite_123');
    });

    it('invalidated sessions by resetting refreshTokens to empty for all users', async () => {
      const users = await testDb.collection('users').find({}).toArray();
      for (const u of users) {
        expect(u.refreshTokens).toEqual([]);
      }
    });

    it('emptied all transactional collections while preserving collections', async () => {
      expect(await testDb.collection('workitems').countDocuments()).toBe(0);
      expect(await testDb.collection('activityevents').countDocuments()).toBe(0);
      expect(await testDb.collection('calendarplans').countDocuments()).toBe(0);
      expect(await testDb.collection('contentpieces').countDocuments()).toBe(0);
      expect(await testDb.collection('accessrequests').countDocuments()).toBe(0);
      expect(await testDb.collection('notifications').countDocuments()).toBe(0);
      expect(await testDb.collection('assignment_overrides').countDocuments()).toBe(0);
    });

    it('dropped retired collections without models when --drop-empty is passed', async () => {
      const collections = (await testDb.listCollections().toArray()).map((c) => c.name);
      expect(collections).not.toContain('teams');
    });

    it('standardized departments to canonical 7 and pruned extra departments', async () => {
      const depts = await testDb.collection('departments').find({}).toArray();
      expect(depts).toHaveLength(7);
      const codes = depts.map((d) => d.code);
      for (const code of CANONICAL_DEPARTMENT_CODES) {
        expect(codes).toContain(code);
      }
      expect(codes).not.toContain('legacy_academic');
      expect(codes).not.toContain('legacy_events');
    });

    it('standardized priorities to canonical 3 and pruned Urgent', async () => {
      const priorities = await testDb.collection('priorities').find({}).toArray();
      expect(priorities).toHaveLength(3);
      const names = priorities.map((p) => p.name);
      expect(names).toContain('High');
      expect(names).toContain('Medium');
      expect(names).toContain('Low');
      expect(names).not.toContain('Urgent');
    });

    it('enforced single-brand profile mode (HACA active, others inactive)', async () => {
      const profiles = await testDb.collection('profiles').find({}).toArray();
      const haca = profiles.find((p) => p.code === 'haca');
      expect(haca.active).toBe(true);
      const others = profiles.filter((p) => p.code !== 'haca');
      for (const p of others) {
        expect(p.active).toBe(false);
      }
    });

    it('reset runtime fields and restored canonical metadata in automation rules', async () => {
      const rules = await testDb.collection('automationrules').find({}).toArray();
      expect(rules.length).toBeGreaterThanOrEqual(6);
      const overdue = rules.find((r) => r.ruleKey === 'overdue_escalation');
      expect(overdue.name).toBe('Overdue Deliverable Escalation');
      expect(overdue.lastRunAt).toBeNull();
      expect(overdue.lastRunStatus).toBeNull();
      expect(overdue.errorCount).toBe(0);
    });

    it('reset runtime fields and restored canonical recipients in report definitions', async () => {
      const reports = await testDb.collection('reportdefinitions').find({}).toArray();
      expect(reports).toHaveLength(4);
      for (const r of reports) {
        expect(r.lastGeneratedAt).toBeNull();
        expect(r.latestSnapshot).toBeNull();
      }
      const weekly = reports.find((r) => r.reportKey === 'weekly_marketing');
      expect(weekly.recipients).toEqual(['creative_head', 'sm_manager']);
    });

    it('is completely idempotent on a second run', async () => {
      const secondRunBackup = path.join(testBackupDir, 'second-run');
      const secondResult = await runWipeKeepUsers(
        [
          '--confirm',
          `--db-name=${testDbName}`,
          `--backup-dir=${secondRunBackup}`,
        ],
        testDb
      );

      expect(secondResult.executed).toBe(true);

      // Verify all users remain intact
      const users = await testDb.collection('users').find({}).toArray();
      expect(users).toHaveLength(6);

      // Verify transactional collections remain 0
      expect(await testDb.collection('workitems').countDocuments()).toBe(0);
      expect(await testDb.collection('activityevents').countDocuments()).toBe(0);

      // Clean up second backup
      if (fs.existsSync(secondRunBackup)) {
        fs.rmSync(secondRunBackup, { recursive: true, force: true });
      }
    });
  });
});
