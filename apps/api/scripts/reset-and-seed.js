/**
 * apps/api/scripts/reset-and-seed.js (Phase 9)
 *
 * Resets the LOCAL marketing_portal database to an empty working state and seeds the 12 test
 * users. Never for production.
 *
 *   node scripts/reset-and-seed.js                                   dry run (default): reports only
 *   node scripts/reset-and-seed.js --confirm --db-name=marketing_portal   performs the reset
 *   Options: --uploads-dir=<path> (default apps/api/uploads), --skip-queues (leave BullMQ alone)
 *
 * Safety: refuses NODE_ENV=production, any host other than localhost/127.0.0.1/::1, and test or
 * disposable databases (names containing "test" or "uicheck"). --confirm also needs --db-name
 * equal to the database in MONGODB_URI. Back up first (mongodump) before a confirmed run.
 *
 * Keeps: configuration collections (departments, automationrules, settings, counters), the
 * admin account (ADMIN_SEED_EMAIL) and its sessions. Empties every other collection, deletes the
 * files in apps/api/uploads, clears stale BullMQ jobs (keeping the reminder schedules), then
 * recreates the Team Chat channel and the 12 users (passwords from SEED_PASSWORD_* in .env).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_UPLOADS_DIR = path.resolve(__dirname, '../uploads');

/** Collections kept as system configuration. Everything else is emptied (users and sessions: see below). */
export const KEEP_COLLECTIONS = ['departments', 'automationrules', 'settings', 'counters'];
/** Reminder schedules kept in the queue; every other repeat schedule and stale job is cleared. */
export const KEEP_SCHEDULES = ['overdue_escalation', 'todo_escalation', 'blocker_dependency_alert', 'revision_pattern_flag'];

export function parseArgs(argv = process.argv.slice(2)) {
  const flags = { confirm: false, dbName: null, uploadsDir: DEFAULT_UPLOADS_DIR, skipQueues: false };
  for (const arg of argv) {
    if (arg === '--confirm') flags.confirm = true;
    else if (arg.startsWith('--db-name=')) flags.dbName = arg.slice('--db-name='.length);
    else if (arg.startsWith('--uploads-dir=')) flags.uploadsDir = path.resolve(arg.slice('--uploads-dir='.length));
    else if (arg === '--skip-queues') flags.skipQueues = true;
  }
  return flags;
}

export function hostOf(uri) {
  const m = /^mongodb(?:\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)/i.exec(String(uri || ''));
  if (!m) return null;
  if (/^mongodb\+srv:/i.test(uri)) return m[1];
  const first = m[1].split(',')[0];
  return first.startsWith('[') ? first.slice(1, first.indexOf(']')) : first.split(':')[0];
}

export const isLocalUri = (uri) => ['localhost', '127.0.0.1', '::1'].includes(hostOf(uri)) && !/^mongodb\+srv:/i.test(uri);
export const dbNameOf = (uri) => (/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/i.exec(String(uri || '')) || [])[1] || '';
export const isProtectedDbName = (name) => /test|uicheck/i.test(String(name || ''));

/** Throws on anything unsafe. Returns the database name. */
export function assertSafe({ uri, flags, nodeEnv }) {
  if (nodeEnv === 'production') throw new Error('Refusing: NODE_ENV is production.');
  if (!isLocalUri(uri)) throw new Error(`Refusing: the database host "${hostOf(uri)}" is not local (localhost, 127.0.0.1 or ::1).`);
  const name = dbNameOf(uri);
  if (!name) throw new Error('Refusing: MONGODB_URI has no database name.');
  if (isProtectedDbName(name)) throw new Error(`Refusing: "${name}" is a test or disposable database.`);
  if (flags.confirm && flags.dbName !== name) {
    throw new Error(`Refusing: --db-name must match the database in MONGODB_URI ("${name}").`);
  }
  return name;
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? listFiles(p) : [p];
  });
}

async function connectQueues(redisUrl) {
  try {
    const { default: Redis } = await import('ioredis');
    const probe = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1, connectTimeout: 2000, retryStrategy: () => null });
    probe.on('error', () => {});
    await probe.connect();
    await probe.quit();
    const { Queue } = await import('bullmq');
    const { QUEUE_NAMES } = await import('../src/lib/queue.js');
    const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
    return Object.values(QUEUE_NAMES).map((name) => new Queue(name, { connection }));
  } catch {
    return null;
  }
}

async function queuePlan(queues) {
  if (!queues) return { reachable: false, queues: [] };
  const out = [];
  for (const q of queues) {
    const counts = await q.getJobCounts('wait', 'active', 'delayed', 'completed', 'failed', 'paused');
    const repeat = await q.getRepeatableJobs();
    out.push({ name: q.name, counts, repeat: repeat.map((r) => r.name) });
  }
  return { reachable: true, queues: out };
}

async function clearQueues(queues) {
  const result = [];
  for (const q of queues || []) {
    let removedSchedules = 0;
    for (const r of await q.getRepeatableJobs()) {
      if (!KEEP_SCHEDULES.includes(r.name)) {
        await q.removeRepeatableByKey(r.key);
        removedSchedules += 1;
      }
    }
    let removedJobs = 0;
    for (const state of ['wait', 'completed', 'failed', 'paused']) removedJobs += (await q.clean(0, 100000, state)).length;
    // Delayed jobs: keep the next run of each kept reminder schedule, drop the rest.
    for (const job of await q.getDelayed(0, -1)) {
      const isKeptRepeat = job?.opts?.repeat && KEEP_SCHEDULES.includes(job.name);
      if (!isKeptRepeat) {
        await job.remove();
        removedJobs += 1;
      }
    }
    result.push({ name: q.name, removedJobs, removedSchedules });
  }
  return result;
}

export async function run({ argv = process.argv.slice(2), log = console.log } = {}) {
  const { env } = await import('../src/config/env.js');
  const flags = parseArgs(argv);
  const uri = env.MONGODB_URI;
  const dbName = assertSafe({ uri, flags, nodeEnv: env.NODE_ENV });

  const adminEmail = (env.ADMIN_SEED_EMAIL || '').toLowerCase().trim();
  if (!adminEmail) throw new Error('Refusing: ADMIN_SEED_EMAIL is not set in .env.');
  const { SEED_USERS, seedPasswordVar, missingSeedPasswords } = await import('../src/modules/people/seedUsers.js');
  const missing = missingSeedPasswords(process.env);

  await mongoose.connect(uri);
  try {
    const db = mongoose.connection.db;
    if (db.databaseName !== dbName) throw new Error(`Refusing: connected to "${db.databaseName}", expected "${dbName}".`);
    const admin = await db.collection('users').findOne({ email: adminEmail }, { projection: { _id: 1, email: 1 } });

    const collections = (await db.listCollections().toArray()).filter((c) => c.type !== 'view' && !c.name.startsWith('system.')).map((c) => c.name).sort();
    const plan = [];
    for (const name of collections) {
      const total = await db.collection(name).countDocuments({});
      let keep = 0;
      if (KEEP_COLLECTIONS.includes(name)) keep = total;
      else if (name === 'users' && admin) keep = 1;
      else if (name === 'sessions' && admin) keep = await db.collection(name).countDocuments({ userId: admin._id });
      plan.push({ name, total, keep, remove: total - keep });
    }
    const files = listFiles(flags.uploadsDir);
    const queues = flags.skipQueues ? null : await connectQueues(env.REDIS_URL || 'redis://127.0.0.1:6379');
    const qPlan = await queuePlan(queues);

    log(`\n${flags.confirm ? 'RESET' : 'DRY RUN (nothing is changed; add --confirm --db-name=' + dbName + ')'}: ${dbName}`);
    log(`Admin kept: ${admin ? admin.email : `NOT FOUND (${adminEmail})`}`);
    for (const p of plan) log(`  ${p.name.padEnd(26)} delete ${String(p.remove).padStart(5)}   keep ${String(p.keep).padStart(4)}`);
    log(`Upload files to delete: ${files.length}`);
    log(flags.skipQueues ? 'Queues: skipped (--skip-queues)' : qPlan.reachable ? `Queues: ${qPlan.queues.map((q) => `${q.name} ${JSON.stringify(q.counts)} schedules [${q.repeat.join(', ')}]`).join('; ')}` : 'Queues: Redis not running; nothing to clear');
    log(`Seed passwords: ${missing.length ? `MISSING ${missing.join(', ')}` : `all ${SEED_USERS.length} set`}`);

    if (!flags.confirm) return { mode: 'dry-run', plan, files: files.length, queues: qPlan };
    if (!admin) throw new Error(`Refusing: the admin account ${adminEmail} was not found, so it cannot be kept.`);
    if (missing.length) throw new Error(`Refusing: set ${missing.join(', ')} in apps/api/.env first.`);

    // 1. Wipe.
    for (const p of plan) {
      if (KEEP_COLLECTIONS.includes(p.name)) continue;
      if (p.name === 'users') await db.collection('users').deleteMany({ _id: { $ne: admin._id } });
      else if (p.name === 'sessions') await db.collection('sessions').deleteMany({ userId: { $ne: admin._id } });
      else await db.collection(p.name).deleteMany({});
    }
    // 2. Uploads (files only; the folder stays).
    const uploadsRoot = path.resolve(flags.uploadsDir);
    for (const f of files) {
      if (!path.resolve(f).startsWith(uploadsRoot + path.sep)) throw new Error(`Refusing to delete outside uploads: ${f}`);
      fs.unlinkSync(f);
    }
    for (const entry of fs.existsSync(uploadsRoot) ? fs.readdirSync(uploadsRoot, { withFileTypes: true }) : []) {
      if (entry.isDirectory()) fs.rmSync(path.join(uploadsRoot, entry.name), { recursive: true, force: true });
    }
    // 3. Queues.
    const cleared = await clearQueues(queues);

    // 4. Startup needs and the 12 users.
    const { seedReferenceData } = await import('../src/modules/referenceData/service.js');
    const { ensureAutomationRules } = await import('../src/modules/automation/runner.js');
    const { Person } = await import('../src/modules/people/model.js');
    const { Department } = await import('../src/modules/departments/model.js');
    await seedReferenceData();
    await ensureAutomationRules();
    const departments = await Department.find().select('_id code').lean();
    const deptId = (code) => (code ? departments.find((d) => d.code === code)?._id || null : null);
    const created = [];
    for (const u of SEED_USERS) {
      const person = await Person.create({
        name: u.name,
        email: u.email,
        phone: u.phone,
        passwordHash: await bcrypt.hash(process.env[seedPasswordVar(u)], 10),
        role: u.role,
        jobRole: u.jobRole,
        departmentId: deptId(u.departmentCode),
        workPreferences: u.workPreferences,
        weeklyCapacityHours: u.capacity,
        status: 'active',
        mustSetPassword: false,
      });
      created.push({ email: person.email, role: person.role, jobRole: person.jobRole, department: u.departmentCode });
    }
    const { ensureTeamChatChannel } = await import('../src/modules/chat/service.js');
    await ensureTeamChatChannel();

    const after = [];
    for (const name of (await db.listCollections().toArray()).filter((c) => c.type !== 'view' && !c.name.startsWith('system.')).map((c) => c.name).sort()) {
      after.push({ name, count: await db.collection(name).countDocuments({}) });
    }
    log('\nDone. Users created:');
    for (const c of created) log(`  ${c.email.padEnd(30)} ${c.role.padEnd(14)} ${c.jobRole || '-'}`);
    log('Final counts:');
    for (const a of after) log(`  ${a.name.padEnd(26)} ${a.count}`);
    if (cleared.length) log(`Queues cleared: ${JSON.stringify(cleared)}`);
    return { mode: 'reset', plan, created, after, cleared, filesDeleted: files.length };
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  run()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
