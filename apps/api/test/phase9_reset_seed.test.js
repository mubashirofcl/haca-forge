import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { env } from '../src/config/env.js';
import { Person } from '../src/modules/people/model.js';
import { ensureBaselineUsers } from '../src/modules/people/baselineUsers.js';
import { SEED_USERS, missingSeedPasswords, seedPasswordVar } from '../src/modules/people/seedUsers.js';
import { assertSafe, hostOf, isLocalUri, isProtectedDbName, parseArgs } from '../scripts/reset-and-seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API = path.resolve(__dirname, '..');
const SCRIPT = path.join(API, 'scripts/reset-and-seed.js');
const salt = `${Date.now()}${Math.round(Math.random() * 1e6)}`;
// A throwaway local database (never the real one, never a test database).
const SCRATCH_DB = `p9_reset_scratch_${salt}`;
const SCRATCH_URI = `mongodb://127.0.0.1:27017/${SCRATCH_DB}`;
const ADMIN_EMAIL = `p9admin.${salt}@scratch.local`;
const fakePasswords = Object.fromEntries(SEED_USERS.map((u, i) => [seedPasswordVar(u), `Scratch-only-${i}-pass`]));

const runScript = (args, extraEnv = {}) =>
  spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: API,
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'development', MONGODB_URI: SCRATCH_URI, ADMIN_SEED_EMAIL: ADMIN_EMAIL, ADMIN_SEED_PASSWORD: 'Scratch-admin-pass', REDIS_URL: 'redis://127.0.0.1:1', ...extraEnv },
    timeout: 120000,
  });

describe('Phase 9: reset script safety', () => {
  it('parses flags; recognises local hosts and protected database names', () => {
    expect(parseArgs(['--confirm', '--db-name=x', '--skip-queues'])).toMatchObject({ confirm: true, dbName: 'x', skipQueues: true });
    expect(parseArgs([]).confirm).toBe(false);
    expect(isLocalUri('mongodb://127.0.0.1:27017/a')).toBe(true);
    expect(isLocalUri('mongodb://localhost/a')).toBe(true);
    expect(isLocalUri('mongodb://user:pw@db.example.com:27017/a')).toBe(false);
    expect(isLocalUri('mongodb+srv://cluster0.example.net/a')).toBe(false);
    expect(hostOf('mongodb://u:p@10.0.0.5:27017/a')).toBe('10.0.0.5');
    expect(isProtectedDbName('marketing_portal_test')).toBe(true);
    expect(isProtectedDbName('marketing_portal_uicheck')).toBe(true);
    expect(isProtectedDbName('marketing_portal')).toBe(false);
  });

  it('refuses production, a non-local host, a test database and a mismatched --db-name', () => {
    const flags = { confirm: true, dbName: 'marketing_portal' };
    expect(() => assertSafe({ uri: 'mongodb://127.0.0.1/marketing_portal', flags, nodeEnv: 'production' })).toThrow(/production/);
    expect(() => assertSafe({ uri: 'mongodb://db.example.com/marketing_portal', flags, nodeEnv: 'development' })).toThrow(/not local/);
    expect(() => assertSafe({ uri: 'mongodb://127.0.0.1/marketing_portal_test', flags: { confirm: true, dbName: 'marketing_portal_test' }, nodeEnv: 'development' })).toThrow(/test or disposable/);
    expect(() => assertSafe({ uri: 'mongodb://127.0.0.1/marketing_portal', flags: { confirm: true, dbName: 'other' }, nodeEnv: 'development' })).toThrow(/--db-name must match/);
    expect(assertSafe({ uri: 'mongodb://127.0.0.1/marketing_portal', flags, nodeEnv: 'development' })).toBe('marketing_portal');
  });

  it('the script itself refuses a non-local URI and a test database before connecting', () => {
    const remote = runScript(['--confirm', '--db-name=x'], { MONGODB_URI: 'mongodb://db.example.com:27017/x' });
    expect(remote.status).toBe(1);
    expect(remote.stderr).toMatch(/not local/);
    const testDb = runScript(['--confirm', '--db-name=marketing_portal_test'], { MONGODB_URI: 'mongodb://127.0.0.1:27017/marketing_portal_test' });
    expect(testDb.status).toBe(1);
    expect(testDb.stderr).toMatch(/test or disposable/);
  });
});

describe('Phase 9: reset and seed on a scratch database', () => {
  let scratch;
  let uploadsDir;
  let adminId;

  beforeAll(async () => {
    uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p9-uploads-'));
    fs.writeFileSync(path.join(uploadsDir, 'a.png'), 'x');
    fs.mkdirSync(path.join(uploadsDir, 'chat', 'c1'), { recursive: true });
    fs.writeFileSync(path.join(uploadsDir, 'chat', 'c1', 'b.txt'), 'y');

    scratch = mongoose.createConnection(SCRATCH_URI);
    await scratch.asPromise();
    const db = scratch.db;
    await db.collection('departments').insertMany(['social_media', 'design', 'video_production', 'seo_content', 'whatsapp', 'performance_marketing', 'tech'].map((code) => ({ code, name: code, type: code, isActive: true })));
    adminId = (await db.collection('users').insertOne({ email: ADMIN_EMAIL, name: 'Admin', role: 'admin', status: 'active', passwordHash: 'keep-me' })).insertedId;
    await db.collection('users').insertMany([{ email: `old.${salt}@x.local`, role: 'team_member', status: 'active' }, { email: `old2.${salt}@x.local`, role: 'admin', status: 'active' }]);
    await db.collection('sessions').insertMany([{ userId: adminId, token: 'a' }, { userId: new mongoose.Types.ObjectId(), token: 'b' }]);
    await db.collection('workitems').insertMany([{ title: 'w1' }, { title: 'w2' }]);
    await db.collection('priorities').insertMany([{ name: 'High' }, { name: 'Low' }]);
    await db.collection('profiles').insertOne({ code: 'haca' });
    await db.collection('settings').insertOne({ defaultWeeklyCapacityHours: 40 });
    await db.collection('automationrules').insertOne({ ruleKey: 'weekly_report', name: 'Retired' });
  });

  afterAll(async () => {
    await scratch.db.dropDatabase();
    await scratch.close();
    fs.rmSync(uploadsDir, { recursive: true, force: true });
  });

  it('a dry run (no --confirm) changes nothing', async () => {
    const r = runScript([`--uploads-dir=${uploadsDir}`, '--skip-queues'], fakePasswords);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/DRY RUN/);
    expect(r.stdout).toMatch(/workitems\s+delete\s+2\s+keep\s+0/);
    expect(await scratch.db.collection('workitems').countDocuments()).toBe(2);
    expect(await scratch.db.collection('users').countDocuments()).toBe(3);
    expect(fs.existsSync(path.join(uploadsDir, 'a.png'))).toBe(true);
  });

  it('refuses to reset when a seed password is missing, before deleting anything', async () => {
    const partial = { ...fakePasswords, SEED_PASSWORD_POSTER: '' };
    const r = runScript(['--confirm', `--db-name=${SCRATCH_DB}`, `--uploads-dir=${uploadsDir}`, '--skip-queues'], partial);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/SEED_PASSWORD_POSTER/);
    expect(await scratch.db.collection('workitems').countDocuments()).toBe(2);
  });

  it('a confirmed run keeps config and the admin, wipes the rest, and seeds the 12 users', async () => {
    const r = runScript(['--confirm', `--db-name=${SCRATCH_DB}`, `--uploads-dir=${uploadsDir}`, '--skip-queues'], fakePasswords);
    expect(r.status).toBe(0);
    expect(r.stdout + r.stderr).not.toMatch(/Scratch-only-|Scratch-admin-pass/);
    const db = scratch.db;
    expect(await db.collection('workitems').countDocuments()).toBe(0);
    expect(await db.collection('priorities').countDocuments()).toBe(0);
    expect(await db.collection('profiles').countDocuments()).toBe(0);
    expect(await db.collection('departments').countDocuments()).toBe(7);
    expect(await db.collection('settings').countDocuments()).toBe(1);
    expect(await db.collection('automationrules').findOne({ ruleKey: 'weekly_report' })).toBeTruthy();
    const admin = await db.collection('users').findOne({ _id: adminId });
    expect(admin.passwordHash).toBe('keep-me');
    expect(await db.collection('sessions').countDocuments()).toBe(1);
    expect((await db.collection('sessions').findOne({})).userId.toString()).toBe(adminId.toString());

    const users = await db.collection('users').find({ _id: { $ne: adminId } }).toArray();
    expect(users).toHaveLength(12);
    const departments = await db.collection('departments').find({}).toArray();
    for (const cfg of SEED_USERS) {
      const u = users.find((x) => x.email === cfg.email);
      expect(u, cfg.email).toBeTruthy();
      expect(u).toMatchObject({ role: cfg.role, jobRole: cfg.jobRole, status: 'active', workPreferences: cfg.workPreferences });
      expect(departments.find((d) => String(d._id) === String(u.departmentId))?.code ?? null).toBe(cfg.departmentCode);
      expect(await bcrypt.compare(fakePasswords[seedPasswordVar(cfg)], u.passwordHash)).toBe(true);
    }
    expect(users.find((u) => u.email === 'allrounder@demo.haca.local').workPreferences).toEqual(['Script', 'Shoot', 'Post']);

    const team = await db.collection('channels').findOne({ type: 'team', systemSlug: 'team-chat' });
    expect(team).toBeTruthy();
    expect(await db.collection('channelmembers').countDocuments({ channelId: team._id })).toBe(13);

    expect(fs.readdirSync(uploadsDir)).toEqual([]);
  });
});

describe('Phase 9: startup creates only a missing admin and never rewrites users', () => {
  const email = `p9.startup.${salt}@scratch.local`;
  const saved = {};

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) await mongoose.connect(env.MONGODB_URI);
    saved.email = env.ADMIN_SEED_EMAIL;
    saved.password = env.ADMIN_SEED_PASSWORD;
    env.ADMIN_SEED_EMAIL = email;
    env.ADMIN_SEED_PASSWORD = 'Startup-only-test-pass';
  });

  afterAll(async () => {
    env.ADMIN_SEED_EMAIL = saved.email;
    env.ADMIN_SEED_PASSWORD = saved.password;
    await Person.deleteMany({ email });
  });

  it('creates the admin when missing, then leaves it alone', async () => {
    expect(await ensureBaselineUsers()).toMatchObject({ created: true });
    const admin = await Person.findOne({ email }).select('+passwordHash').lean();
    expect(admin.role).toBe('admin');
    await Person.collection.updateOne({ _id: admin._id }, { $set: { passwordHash: 'changed-by-user', name: 'Renamed' } });
    expect(await ensureBaselineUsers()).toMatchObject({ created: false, reason: 'exists' });
    const after = await Person.collection.findOne({ _id: admin._id });
    expect(after.passwordHash).toBe('changed-by-user');
    expect(after.name).toBe('Renamed');
  });

  it('never creates or rewrites the 12 test users', async () => {
    const before = await Person.countDocuments({ email: /@demo\.haca\.local$/ });
    await ensureBaselineUsers();
    expect(await Person.countDocuments({ email: /@demo\.haca\.local$/ })).toBe(before);
  });

  it('no password is written in the seed or startup source', () => {
    // No literal passwords and no fallback values: passwords come only from the env.
    // When a local .env exists, none of its password values may appear in these files either
    // (checked without naming any password here).
    const envFile = path.join(API, '.env');
    const localValues = fs.existsSync(envFile)
      ? [...fs.readFileSync(envFile, 'utf8').matchAll(/^(?:SEED_PASSWORD_[A-Z0-9]+|ADMIN_SEED_PASSWORD)=(.*)$/gm)]
          .map((m) => m[1].trim().replace(/^["']|["']$/g, ''))
          .filter((v) => v.length >= 6)
      : [];
    for (const file of ['src/modules/people/baselineUsers.js', 'src/modules/people/seedUsers.js', 'scripts/reset-and-seed.js', 'test/phase9_reset_seed.test.js']) {
      const text = fs.readFileSync(path.join(API, file), 'utf8');
      expect([file, /password:\s*['"]|PASSWORD\s*\|\|\s*['"]/.test(text)]).toEqual([file, false]);
      expect([file, localValues.filter((v) => text.includes(v)).length]).toEqual([file, 0]);
    }
    expect(missingSeedPasswords({})).toHaveLength(12);
  });
});
