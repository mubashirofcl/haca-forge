import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongodb';
import { MongoClient } from 'mongodb';
import { runWipeKeepAdmin, validateHost } from '../../../scripts/wipe-keep-admin.js';

describe('Stage 3: Database Wipe Script (scripts/wipe-keep-admin.js)', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const testDbUri = 'mongodb://127.0.0.1:27017';
  const testDbName = 'marketing_portal_wipe_test';
  let client;
  let testDb;

  beforeAll(async () => {
    client = new MongoClient(testDbUri);
    await client.connect();
    testDb = client.db(testDbName);

    // Seed mock data into test database
    await testDb.collection('users').deleteMany({});
    await testDb.collection('users').insertMany([
      {
        name: 'Super Admin',
        email: 'admin@hacaforge.com',
        role: 'admin',
        passwordHash: 'secret_hash_preserved',
        status: 'active',
      },
      {
        name: 'Regular Member',
        email: 'member@test.com',
        role: 'team_member',
        passwordHash: 'member_hash',
        status: 'active',
      },
      {
        name: 'Old Manager',
        email: 'manager@test.com',
        role: 'sm_manager',
        passwordHash: 'manager_hash',
        status: 'active',
      },
    ]);

    await testDb.collection('activityevents').deleteMany({});
    await testDb.collection('activityevents').insertMany([
      { type: 'item_created', title: 'Event 1' },
      { type: 'item_moved', title: 'Event 2' },
    ]);

    await testDb.collection('workitems').deleteMany({});
    await testDb.collection('workitems').insertMany([
      { title: 'Work Item 1', status: 'in_progress' },
      { title: 'Work Item 2', status: 'done' },
    ]);

    await testDb.collection('teams').deleteMany({});
    await testDb.collection('teams').insertMany([
      { name: 'Core Design Team', code: 'design' },
      { name: 'Video Ops', code: 'video' },
    ]);

    await testDb.collection('departments').deleteMany({});
    await testDb.collection('departments').insertMany([
      { name: 'Design', code: 'design' },
      { name: 'Video Production', code: 'video_production' },
      { name: 'Social Media', code: 'social_media' },
      { name: 'SEO & Content', code: 'seo_content' },
      { name: 'WhatsApp', code: 'whatsapp' },
      { name: 'Performance Marketing', code: 'performance_marketing' },
      { name: 'Tech', code: 'tech' },
      { name: 'Old Academic Affairs', code: 'legacy_academic' },
      { name: 'Old Events & Comms', code: 'legacy_events' },
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
      { name: 'HACA', code: 'haca', active: true },
      { name: 'HACA Mideast', code: 'haca_mideast', active: true },
      { name: 'HACA Design School', code: 'haca_design_school', active: true },
    ]);
  });

  afterAll(async () => {
    process.env.NODE_ENV = originalNodeEnv;
    if (testDb) {
      await testDb.dropDatabase();
    }
    if (client) {
      await client.close();
    }
  });

  describe('Safety Guards & Validations', () => {
    it('validates local hosts and rejects remote hosts', () => {
      expect(validateHost('mongodb://localhost:27017/db')).toBe(true);
      expect(validateHost('mongodb://127.0.0.1:27017/db')).toBe(true);
      expect(validateHost('mongodb://[::1]:27017/db')).toBe(true);
      expect(validateHost('mongodb://production.cluster.mongodb.net:27017/db')).toBe(false);
      expect(validateHost('mongodb://192.168.1.100:27017/db')).toBe(false);
    });

    it('refuses execution when NODE_ENV is production', async () => {
      process.env.NODE_ENV = 'production';
      try {
        await expect(
          runWipeKeepAdmin(['--confirm', `--db-name=${testDbName}`, '--keep-emails=admin@hacaforge.com'], testDb)
        ).rejects.toThrow('Cannot execute wipe script when NODE_ENV is "production"');
      } finally {
        process.env.NODE_ENV = 'test';
      }
    });

    it('refuses non-local MongoDB URI', async () => {
      await expect(
        runWipeKeepAdmin([
          '--confirm',
          `--db-name=${testDbName}`,
          '--keep-emails=admin@hacaforge.com',
          '--uri=mongodb://remote-server.com:27017/db',
        ])
      ).rejects.toThrow('Cannot wipe non-local database host');
    });

    it('refuses confirmed run if --db-name does not match actual connected database', async () => {
      await expect(
        runWipeKeepAdmin(
          ['--confirm', '--db-name=wrong_database_name', '--keep-emails=admin@hacaforge.com'],
          testDb
        )
      ).rejects.toThrow(/does not match connected database/);
    });

    it('refuses confirmed run if --keep-emails is missing or empty', async () => {
      await expect(
        runWipeKeepAdmin(['--confirm', `--db-name=${testDbName}`, '--keep-emails='], testDb)
      ).rejects.toThrow(/must specify at least one admin email/);
    });
  });

  describe('Dry-Run Mode Invariance', () => {
    it('runs in dry-run mode by default and makes zero database mutations', async () => {
      const initialUsers = await testDb.collection('users').countDocuments();
      const initialEvents = await testDb.collection('activityevents').countDocuments();
      const initialDepts = await testDb.collection('departments').countDocuments();

      const res = await runWipeKeepAdmin([], testDb);

      expect(res.mode).toBe('dry-run');
      expect(res.executed).toBe(false);

      const afterUsers = await testDb.collection('users').countDocuments();
      const afterEvents = await testDb.collection('activityevents').countDocuments();
      const afterDepts = await testDb.collection('departments').countDocuments();

      expect(afterUsers).toBe(initialUsers);
      expect(afterEvents).toBe(initialEvents);
      expect(afterDepts).toBe(initialDepts);
    });
  });

  describe('Confirmed Execution Verification', () => {
    it('preserves the specified admin user with passwordHash intact and deletes all other users', async () => {
      const res = await runWipeKeepAdmin(
        ['--confirm', `--db-name=${testDbName}`, '--keep-emails=admin@hacaforge.com'],
        testDb
      );

      expect(res.mode).toBe('confirmed');
      expect(res.executed).toBe(true);

      // 1. Users verification
      const remainingUsers = await testDb.collection('users').find({}).toArray();
      expect(remainingUsers.length).toBe(1);
      expect(remainingUsers[0].email).toBe('admin@hacaforge.com');
      expect(remainingUsers[0].passwordHash).toBe('secret_hash_preserved');

      // 2. Transactional collections emptied
      const eventsCount = await testDb.collection('activityevents').countDocuments();
      expect(eventsCount).toBe(0);

      const workItemsCount = await testDb.collection('workitems').countDocuments();
      expect(workItemsCount).toBe(0);

      // 3. Teams preserved
      const teamsCount = await testDb.collection('teams').countDocuments();
      expect(teamsCount).toBe(2);

      // 4. Departments pruned to canonical 7
      const depts = await testDb.collection('departments').find({}).toArray();
      expect(depts.length).toBe(7);
      expect(depts.map((d) => d.code).sort()).toEqual([
        'design',
        'performance_marketing',
        'seo_content',
        'social_media',
        'tech',
        'video_production',
        'whatsapp',
      ].sort());

      // 5. Priorities pruned (Urgent removed, leaving 3)
      const priorities = await testDb.collection('priorities').find({}).toArray();
      expect(priorities.length).toBe(3);
      expect(priorities.some((p) => p.name === 'Urgent')).toBe(false);

      // 6. Profiles single-brand rule (only HACA active)
      const hacaProfile = await testDb.collection('profiles').findOne({ code: 'haca' });
      expect(hacaProfile.active).toBe(true);

      const otherProfiles = await testDb.collection('profiles').find({ code: { $ne: 'haca' } }).toArray();
      for (const p of otherProfiles) {
        expect(p.active).toBe(false);
      }
    });
  });
});
