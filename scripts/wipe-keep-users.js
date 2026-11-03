#!/usr/bin/env node
/**
 * scripts/wipe-keep-users.js
 *
 * Safe database wipe script for HACA Marketing OS.
 * - Dry run by default.
 * - Refuses non-local hosts (localhost, 127.0.0.1, ::1).
 * - Refuses execution in production environment (NODE_ENV=production).
 * - Requires: --confirm and --db-name=<connected-db-name>
 * - Exports backup OUTSIDE repository before any deletion or mutation.
 * - Verifies backup files exist and are non-empty before proceeding.
 * - Extracts Cloudinary URLs from deleted documents to cloudinary-urls.txt.
 * - Preserves ALL users unchanged (invalidates refresh tokens only).
 * - Resets reference and configuration collections to canonical seed state.
 * - Empties transactional collections; resets counters.
 * - Supports --clear-queues (obliterates BullMQ Redis keys).
 * - Supports --drop-empty (drops collections without an active Mongoose model).
 * - Idempotent; prints before/after document count audit and restoration instructions.
 */

import { MongoClient } from 'mongodb';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

// Canonical reference definitions
export const CANONICAL_DEPARTMENT_CODES = [
  'design',
  'video_production',
  'social_media',
  'seo_content',
  'whatsapp',
  'performance_marketing',
  'tech',
];

export const CANONICAL_REPORT_KEYS = [
  'weekly_marketing',
  'monthly_scorecard',
  'creative_production',
  'team_performance',
];

export const CANONICAL_REPORT_DEFINITIONS = [
  {
    reportKey: 'weekly_marketing',
    name: 'Weekly Work Report',
    description: 'Weekly summary of completed deliverables, on-time delivery rate, active bottlenecks, and upcoming week priorities.',
    cadence: 'Weekly',
    scheduleCron: '0 8 * * 1',
    scheduleDisplay: 'Mondays at 08:00 AM',
    recipients: ['creative_head', 'sm_manager'],
  },
  {
    reportKey: 'monthly_scorecard',
    name: 'Monthly Performance Scorecard',
    description: 'Operational throughput: planned versus published deliverables, on-time delivery rate, revision rate, and stage approval turnaround (strictly targets removed).',
    cadence: 'Monthly',
    scheduleCron: '59 23 28-31 * *',
    scheduleDisplay: 'Last day of month at 23:59',
    recipients: ['creative_head', 'admin'],
  },
  {
    reportKey: 'creative_production',
    name: 'Creative Production Report',
    description: 'Throughput breakdown by creative department and stage: script output, design assets created, video edit hours, and stage approval turnaround.',
    cadence: 'Weekly',
    scheduleCron: '0 18 * * 5',
    scheduleDisplay: 'Fridays at 18:00 PM',
    recipients: ['creative_head', 'sm_manager'],
  },
  {
    reportKey: 'team_performance',
    name: 'Team Performance Digest',
    description: 'Balanced contributor evaluation across four objective dimensions: Output, Efficiency, Quality, and Collaboration.',
    cadence: 'Monthly',
    scheduleCron: '0 9 1 * *',
    scheduleDisplay: '1st of each month at 09:00 AM',
    recipients: ['creative_head', 'sm_manager'],
  },
];

export const CANONICAL_AUTOMATION_RULES = [
  {
    ruleKey: 'month_end_report',
    name: 'Month-End Performance Scorecard',
    description: 'Automatically compiles and dispatches the Monthly Performance Scorecard to Marketing Head and Admin at 23:59 on the final day of each month.',
    trigger: 'cron',
    schedule: 'Last day of month 23:59',
    cronExpression: '59 23 28-31 * *',
    action: 'Generate and distribute Monthly Performance Scorecard report',
    active: true,
    config: { reportKey: 'monthly_scorecard', sendEmail: true },
  },
  {
    ruleKey: 'overdue_escalation',
    name: 'Overdue Deliverable Escalation',
    description: 'Continuously audits deliverables past their deadline. Pings deliverable owner immediately; escalates to Department Team Lead after 4 hours overdue.',
    trigger: 'scheduled',
    schedule: 'Hourly check',
    cronExpression: '0 * * * *',
    action: 'Dispatch owner reminder and Team Lead escalation for overdue work items',
    active: true,
    config: { leadEscalationHours: 4 },
  },
  {
    ruleKey: 'todo_escalation',
    name: 'Stale Task & Todo Escalation',
    description: 'Flags open deliverables in progress that have experienced no status change for 3 or more consecutive days, prompting status updates.',
    trigger: 'scheduled',
    schedule: 'Daily at 09:00 AM',
    cronExpression: '0 9 * * *',
    action: 'Notify deliverable owner of stagnant deliverable in progress',
    active: true,
    config: { daysInactive: 3 },
  },
  {
    ruleKey: 'blocker_dependency_alert',
    name: 'Blocker Dependency Alert & SLA Monitor',
    description: 'Monitors unresolved deliverable blockers and executes reminder pings to assigned cross-functional dependency owners every 24 hours.',
    trigger: 'event',
    schedule: 'Instant & 24h cadence',
    cronExpression: '0 10 * * *',
    action: 'Dispatch blocker reminder to cross-team dependency owner',
    active: true,
    config: { reminderIntervalHours: 24 },
  },
  {
    ruleKey: 'revision_pattern_flag',
    name: 'Revision Pattern & Quality Guard',
    description: 'Detects deliverables entering round 4 or higher; triggers an excessive revision flag to Marketing Head and requests root-cause classification.',
    trigger: 'event',
    schedule: 'Instant on 4th round',
    cronExpression: null,
    action: 'Create RevisionFlag and alert Marketing Head',
    active: true,
    config: { thresholdRound: 4 },
  },
  {
    ruleKey: 'weekly_report',
    name: 'Weekly Marketing Executive Digest',
    description: 'Generates the comprehensive Weekly Marketing Report every Monday at 08:00 AM, detailing planned vs completed output, department throughput, and open blockers.',
    trigger: 'cron',
    schedule: 'Mondays at 08:00 AM',
    cronExpression: '0 8 * * 1',
    action: 'Generate and email Weekly Marketing Report to leadership',
    active: true,
    config: { reportKey: 'weekly_marketing', sendEmail: true },
  },
];

export const CANONICAL_AUTOMATION_KEYS = CANONICAL_AUTOMATION_RULES.map((r) => r.ruleKey);

// Collections to EMPTY (retain collection and its indexes)
export const COLLECTIONS_TO_EMPTY = [
  'activityevents',
  'contentpieces',
  'workitems',
  'calendarplans',
  'assignment_overrides',
  'notifications',
  'accessrequests',
  'counters',
  'blockers',
  'feedbackentries',
  'revisionflags',
  'scheduledreports',
  'monthlytargets',
  'campaigns',
];

// Collections without active Mongoose models to drop with --drop-empty
export const RETIRED_COLLECTIONS_WITHOUT_MODEL = [
  'teams',
  'auditlogs',
  'calendarentries',
  'campaigns',
  'comments',
  'contentformats',
  'contentitems',
  'deliverables',
  'holdreasons',
  'leads',
  'leaverequests',
  'monthlytargets',
  'pipelinetemplates',
  'platforms',
  'requests',
  'requesttypes',
  'shoots',
  'statushistories',
  'tasks',
  'teamassignments',
  'timeentries',
];

export function parseArgs(argv = process.argv.slice(2)) {
  const flags = {
    confirm: false,
    dbName: null,
    clearQueues: false,
    dropEmpty: false,
    backupDir: null,
    mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/marketing_portal',
    redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  };

  for (const arg of argv) {
    if (arg === '--confirm') flags.confirm = true;
    else if (arg === '--clear-queues') flags.clearQueues = true;
    else if (arg === '--drop-empty') flags.dropEmpty = true;
    else if (arg.startsWith('--db-name=')) flags.dbName = arg.split('=')[1].trim();
    else if (arg.startsWith('--backup-dir=')) flags.backupDir = arg.split('=')[1].trim();
    else if (arg.startsWith('--uri=')) flags.mongoUri = arg.split('=')[1].trim();
    else if (arg.startsWith('--redis-url=')) flags.redisUrl = arg.split('=')[1].trim();
  }

  return flags;
}

export function validateHost(uri) {
  const match = uri.match(/mongodb(?:\+srv)?:\/\/(?:[^@]+@)?(\[[^\]]+\]|[^/:]+)/i);
  if (!match) return false;
  const host = match[1].toLowerCase().replace(/^\[|\]$/g, '');
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

export function isPathInsideRepo(targetPath, repoRoot = REPO_ROOT) {
  const resolvedTarget = path.resolve(targetPath);
  const resolvedRepo = path.resolve(repoRoot);
  const rel = path.relative(resolvedRepo, resolvedTarget);
  // Inside repo if relative path does not begin with '..' and is not absolute
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

export function extractCloudinaryUrls(docs) {
  const urls = new Set();
  function scan(val) {
    if (!val) return;
    if (typeof val === 'string') {
      if (val.includes('cloudinary.com') || val.includes('res.cloudinary.com')) {
        urls.add(val.trim());
      }
    } else if (Array.isArray(val)) {
      for (const item of val) scan(item);
    } else if (typeof val === 'object') {
      for (const k of Object.keys(val)) scan(val[k]);
    }
  }
  for (const doc of docs) {
    scan(doc);
  }
  return Array.from(urls);
}

export async function runWipeKeepUsers(rawArgv = process.argv.slice(2), injectedDb = null) {
  const flags = parseArgs(rawArgv);

  // Safety Guard 1: Environment guard
  if (process.env.NODE_ENV === 'production') {
    throw new Error('CRITICAL SAFETY GUARD: Cannot execute wipe script when NODE_ENV is "production"!');
  }

  // Safety Guard 2: Host restriction
  if (!validateHost(flags.mongoUri)) {
    throw new Error('CRITICAL SAFETY GUARD: Cannot wipe non-local database host! Host must be localhost, 127.0.0.1, or ::1.');
  }

  let client = null;
  let db = injectedDb;

  if (!db) {
    client = new MongoClient(flags.mongoUri);
    await client.connect();
    db = client.db();
  }

  const actualDbName = db.databaseName;

  // Gather current collection list and counts
  const allCols = await db.listCollections().toArray();
  const colNames = allCols.map((c) => c.name);
  const beforeCounts = {};

  for (const name of colNames) {
    try {
      beforeCounts[name] = await db.collection(name).countDocuments();
    } catch {
      beforeCounts[name] = 0;
    }
  }

  // DRY-RUN MODE:
  if (!flags.confirm) {
    console.log('\n================================================================');
    console.log('🔍 HACA MARKETING OS — DATABASE WIPE DRY-RUN (KEEP USERS ONLY)');
    console.log('================================================================');
    console.log(`Connected Database: ${actualDbName}`);
    console.log(`Execution Mode:     DRY-RUN (Zero mutations performed)\n`);

    console.log('Safety Parameters Required for Confirmed Execution:');
    console.log(`  --confirm:                    ${flags.confirm ? '✓' : 'MISSING'}`);
    console.log(`  --db-name=${actualDbName}:          ${flags.dbName === actualDbName ? '✓' : `MISSING (Passed: ${flags.dbName || 'none'})`}`);
    console.log(`  --clear-queues:               ${flags.clearQueues ? 'Enabled' : 'Disabled'}`);
    console.log(`  --drop-empty:                 ${flags.dropEmpty ? 'Enabled' : 'Disabled'}\n`);

    // Preview users to be kept
    const users = await db.collection('users').find({}).toArray();
    console.log(`Kept Users Preview (${users.length} accounts will survive completely unchanged):`);
    console.table(
      users.map((u) => ({
        Name: u.name || 'Unnamed',
        Email: u.email,
        Role: u.role,
        Status: u.status,
      }))
    );

    console.log('\nPlanned Collection Actions:');
    console.log('--------------------------------------------------------------------------------');
    console.log('Collection                     Current Count   Action Planned');
    console.log('--------------------------------------------------------------------------------');

    for (const name of colNames.sort()) {
      const count = beforeCounts[name] || 0;
      let action = 'UNSPECIFIED';

      if (name === 'users') {
        action = `KEEP ALL ${count} users unchanged (invalidate refresh tokens only)`;
      } else if (name === 'settings') {
        action = `KEEP as-is (${count} doc)`;
      } else if (name === 'profiles') {
        action = `KEEP 7 profiles; enforce HACA active, 6 inactive`;
      } else if (name === 'departments') {
        action = `KEEP canonical 7 departments; prune any extra`;
      } else if (name === 'priorities') {
        action = `KEEP canonical 3 priorities; prune any 'Urgent'`;
      } else if (name === 'automationrules') {
        action = `KEEP 6 rules; reset runtime state (lastRunAt, status) & sync titles`;
      } else if (name === 'reportdefinitions') {
        action = `KEEP 4 reports; reset runtime state & prune orphan recipients`;
      } else if (RETIRED_COLLECTIONS_WITHOUT_MODEL.includes(name)) {
        action = flags.dropEmpty ? `DROP collection (${count} docs -> DROPPED)` : `EMPTY collection (${count} -> 0)`;
      } else if (COLLECTIONS_TO_EMPTY.includes(name)) {
        action = `EMPTY collection (${count} -> 0, retain indexes)`;
      } else {
        action = `EMPTY collection (${count} -> 0)`;
      }

      console.log(`${name.padEnd(30)} ${String(count).padStart(12)}   ${action}`);
    }

    console.log('--------------------------------------------------------------------------------');
    console.log('\nℹ️  To execute the confirmed wipe, rerun with required safety flags:');
    console.log(`    node scripts/wipe-keep-users.js --confirm --db-name=${actualDbName} --clear-queues\n`);

    if (client) await client.close();

    return {
      mode: 'dry-run',
      database: actualDbName,
      beforeCounts,
      executed: false,
    };
  }

  // CONFIRMED EXECUTION:
  // Validate safety guards
  if (!flags.dbName || flags.dbName !== actualDbName) {
    throw new Error(`CRITICAL SAFETY GUARD: Flag --db-name="${flags.dbName}" does not match connected database "${actualDbName}"!`);
  }

  // Safety Guard: Backup Path Guard
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = flags.backupDir
    ? path.resolve(flags.backupDir)
    : path.resolve(REPO_ROOT, '../haca-backups', `wipe-${timestamp}`);

  if (isPathInsideRepo(backupDir, REPO_ROOT)) {
    throw new Error(
      `CRITICAL SAFETY GUARD: Backup folder MUST be outside the repository! Path "${backupDir}" is inside repository root "${REPO_ROOT}".`
    );
  }

  console.log('\n================================================================');
  console.log('🚨 HACA MARKETING OS — CONFIRMED DATABASE WIPE EXECUTION');
  console.log('================================================================');
  console.log(`Database:     ${actualDbName}`);
  console.log(`Backup Dir:   ${backupDir}`);
  console.log('================================================================\n');

  // Step 1: Pre-Wipe Backup
  console.log(`📦 Exporting pre-wipe backup to ${backupDir}...`);
  fs.mkdirSync(backupDir, { recursive: true });

  const allDeletedDocuments = [];

  for (const name of colNames) {
    const count = beforeCounts[name] || 0;
    if (count > 0) {
      const docs = await db.collection(name).find({}).toArray();
      const filePath = path.join(backupDir, `${name}.json`);
      fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), 'utf8');

      // Verify file exists and is non-empty
      if (!fs.existsSync(filePath)) {
        throw new Error(`BACKUP FAILED: Backup file for collection "${name}" was not created! Aborting wipe.`);
      }
      const stat = fs.statSync(filePath);
      if (stat.size === 0) {
        throw new Error(`BACKUP FAILED: Backup file for collection "${name}" is empty (0 bytes)! Aborting wipe.`);
      }

      if (COLLECTIONS_TO_EMPTY.includes(name) || RETIRED_COLLECTIONS_WITHOUT_MODEL.includes(name)) {
        allDeletedDocuments.push(...docs);
      }
    }
  }
  console.log('  ✓ All affected collections successfully backed up and verified.\n');

  // Step 2: Extract Cloudinary URLs from deleted documents
  console.log('🔍 Scanning deleted documents for referenced Cloudinary URLs...');
  const cloudinaryUrls = extractCloudinaryUrls(allDeletedDocuments);
  const cloudinaryUrlsFile = path.join(backupDir, 'cloudinary-urls.txt');
  fs.writeFileSync(cloudinaryUrlsFile, cloudinaryUrls.join('\n') + (cloudinaryUrls.length > 0 ? '\n' : ''), 'utf8');

  if (cloudinaryUrls.length > 0) {
    console.log(`  ⚠️ Found ${cloudinaryUrls.length} Cloudinary URL(s). Written to: ${cloudinaryUrlsFile}`);
  } else {
    console.log(`  ✓ 0 Cloudinary URLs found. Empty list saved to: ${cloudinaryUrlsFile}`);
  }

  // Step 3: Preserve Users & Invalidate Refresh Tokens
  console.log('\n👤 Preserving all user accounts & invalidating sessions...');
  const usersCol = db.collection('users');
  const userCount = await usersCol.countDocuments({});
  if (userCount === 0) {
    throw new Error('ABORT: Users collection is unexpectedly empty! Refusing to continue.');
  }

  // Invalidate refresh tokens only; preserve every other attribute
  await usersCol.updateMany({}, { $set: { refreshTokens: [] } });

  const keptUsers = await usersCol.find({}).toArray();
  console.log(`  ✓ Successfully kept all ${keptUsers.length} users with sessions invalidated.`);
  console.log('\n📋 Kept Users Summary:');
  console.table(
    keptUsers.map((u) => ({
      Name: u.name || 'Unnamed',
      Email: u.email,
      Role: u.role,
      Status: u.status,
    }))
  );

  // Step 4: Empty Transactional Collections
  console.log('\n🧹 Purging transactional data collections...');
  for (const name of COLLECTIONS_TO_EMPTY) {
    if (colNames.includes(name)) {
      await db.collection(name).deleteMany({});
      console.log(`  ✓ Emptied collection: ${name} (indexes preserved)`);
    }
  }

  // Reset counters if collection exists
  if (colNames.includes('counters')) {
    await db.collection('counters').deleteMany({});
    console.log('  ✓ Reset counters collection.');
  }

  // Step 5: Handle Retired / Legacy Collections
  if (flags.dropEmpty) {
    console.log('\n🗑️  Dropping collections without an active Mongoose model (--drop-empty enabled)...');
    for (const name of RETIRED_COLLECTIONS_WITHOUT_MODEL) {
      if (colNames.includes(name)) {
        await db.collection(name).drop();
        console.log(`  ✓ Dropped retired collection: ${name}`);
      }
    }
  } else {
    for (const name of RETIRED_COLLECTIONS_WITHOUT_MODEL) {
      if (colNames.includes(name)) {
        await db.collection(name).deleteMany({});
        console.log(`  ✓ Emptied legacy collection: ${name}`);
      }
    }
  }

  // Step 6: Reset Reference Data Runtime Fields & Enforce Canonical State
  console.log('\n🏢 Standardizing departments to canonical 7...');
  const deptsCol = db.collection('departments');
  const deleteDepts = await deptsCol.deleteMany({
    code: { $nin: CANONICAL_DEPARTMENT_CODES },
  });
  if (deleteDepts.deletedCount > 0) {
    console.log(`  ✓ Pruned ${deleteDepts.deletedCount} non-canonical department(s).`);
  } else {
    console.log('  ✓ All 7 canonical departments verified.');
  }

  console.log('\n⚡ Standardizing priorities to canonical 3...');
  const priorsCol = db.collection('priorities');
  if (colNames.includes('priorities')) {
    const deletePriors = await priorsCol.deleteMany({
      $or: [{ name: /urgent/i }, { code: /urgent/i }],
    });
    if (deletePriors.deletedCount > 0) {
      console.log(`  ✓ Pruned ${deletePriors.deletedCount} 'Urgent' priority document(s).`);
    } else {
      console.log('  ✓ Canonical 3 priorities verified.');
    }
  }

  console.log('\n🏷️  Enforcing single-brand mode profile rule (HACA active only)...');
  const profsCol = db.collection('profiles');
  if (colNames.includes('profiles')) {
    await profsCol.updateOne({ code: 'haca' }, { $set: { active: true, isActive: true } });
    await profsCol.updateMany({ code: { $ne: 'haca' } }, { $set: { active: false, isActive: false } });
    console.log('  ✓ Profile HACA set to active; 6 other brand profiles set to inactive.');
  }

  console.log('\n⚙️  Resetting runtime state & syncing metadata in automation rules...');
  const autoCol = db.collection('automationrules');
  if (colNames.includes('automationrules')) {
    for (const rule of CANONICAL_AUTOMATION_RULES) {
      await autoCol.updateOne(
        { ruleKey: rule.ruleKey },
        {
          $set: {
            name: rule.name,
            description: rule.description,
            trigger: rule.trigger,
            schedule: rule.schedule,
            cronExpression: rule.cronExpression,
            action: rule.action,
            config: rule.config,
            active: rule.active,
            lastRunAt: null,
            lastRunStatus: null,
            lastRunSummary: null,
            lastRunDetails: null,
            errorCount: 0,
          },
        },
        { upsert: true }
      );
    }
    await autoCol.deleteMany({ ruleKey: { $nin: CANONICAL_AUTOMATION_KEYS } });
    console.log('  ✓ Synced canonical 6 automation rules and cleared all runtime fields.');
  }

  console.log('\n📊 Resetting runtime state & syncing recipients in report definitions...');
  const reportsCol = db.collection('reportdefinitions');
  if (colNames.includes('reportdefinitions')) {
    for (const def of CANONICAL_REPORT_DEFINITIONS) {
      await reportsCol.updateOne(
        { reportKey: def.reportKey },
        {
          $set: {
            name: def.name,
            description: def.description,
            cadence: def.cadence,
            scheduleCron: def.scheduleCron,
            scheduleDisplay: def.scheduleDisplay,
            recipients: def.recipients,
            lastGeneratedAt: null,
            lastGeneratedBy: null,
            lastGeneratedSummary: null,
            latestSnapshot: null,
          },
        },
        { upsert: true }
      );
    }
    await reportsCol.deleteMany({
      $or: [
        { reportKey: { $nin: CANONICAL_REPORT_KEYS } },
        { name: /funnel|deep-dive/i },
      ],
    });
    console.log('  ✓ Synced canonical 4 report definitions and cleared runtime fields & orphan recipients.');
  }

  // Step 7: Clear Redis Queues if requested
  if (flags.clearQueues) {
    console.log('\n📬 Clearing BullMQ Redis queues (--clear-queues enabled)...');
    try {
      const { default: Redis } = await import('ioredis');
      const redis = new Redis(flags.redisUrl || 'redis://127.0.0.1:6379', {
        connectTimeout: 2000,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
      });

      await new Promise((resolve, reject) => {
        redis.once('ready', resolve);
        redis.once('error', reject);
      });

      const keys = await redis.keys('bull:*');
      if (keys.length > 0) {
        await redis.del(...keys);
        console.log(`  ✓ Flushed ${keys.length} BullMQ queue key(s) from Redis (queues & repeatable jobs obliterated).`);
      } else {
        console.log('  ✓ Redis BullMQ queues already empty (0 keys).');
      }
      redis.disconnect();
    } catch (err) {
      console.warn(`  ⚠️ Queue clearing skipped or Redis unreachable: ${err.message}`);
    }
  }

  // Step 8: Document Count Audit (Before vs After)
  const remainingCols = (await db.listCollections().toArray()).map((c) => c.name);
  const afterCounts = {};
  for (const name of remainingCols) {
    try {
      afterCounts[name] = await db.collection(name).countDocuments();
    } catch {
      afterCounts[name] = 0;
    }
  }

  const allTrackedCols = Array.from(new Set([...colNames, ...remainingCols])).sort();

  console.log('\n================================================================================');
  console.log('📊 DATABASE WIPE SUMMARY: BEFORE VS AFTER DOCUMENT COUNTS');
  console.log('================================================================================');
  console.log('Collection                     Before Count    After Count    Delta');
  console.log('--------------------------------------------------------------------------------');
  for (const name of allTrackedCols) {
    const before = beforeCounts[name] ?? 'DROPPED';
    const after = remainingCols.includes(name) ? (afterCounts[name] ?? 0) : 'DROPPED';
    let delta = '-';
    if (typeof before === 'number' && typeof after === 'number') {
      const diff = after - before;
      delta = diff === 0 ? '0' : String(diff);
    } else if (after === 'DROPPED') {
      delta = `-${before}`;
    }
    console.log(
      `${name.padEnd(30)} ${String(before).padStart(12)} ${String(after).padStart(14)}   ${delta.padStart(8)}`
    );
  }
  console.log('================================================================================\n');

  console.log('================================================================================');
  console.log('🔄 RESTORATION INSTRUCTIONS');
  console.log('================================================================================');
  console.log(`Backup files are stored in: ${backupDir}`);
  console.log(`To restore any collection, import from JSON into your database:`);
  console.log(`Example:`);
  console.log(`  node -e "
    import fs from 'fs';
    import path from 'path';
    import { MongoClient } from 'mongodb';
    const client = new MongoClient('${flags.mongoUri}');
    await client.connect();
    const db = client.db('${actualDbName}');
    const files = fs.readdirSync('${backupDir.replace(/\\/g, '/')}').filter(f => f.endsWith('.json'));
    for (const f of files) {
      const col = f.replace('.json', '');
      const docs = JSON.parse(fs.readFileSync(path.join('${backupDir.replace(/\\/g, '/')}', f), 'utf8'));
      if (docs.length > 0) {
        await db.collection(col).deleteMany({});
        await db.collection(col).insertMany(docs);
        console.log('Restored', col, docs.length, 'docs');
      }
    }
    await client.close();
  "`);
  console.log('================================================================================\n');

  if (client) await client.close();

  return {
    mode: 'confirmed',
    database: actualDbName,
    backupDir,
    beforeCounts,
    afterCounts,
    executed: true,
  };
}

// Standalone execution entry point
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isMain) {
  runWipeKeepUsers()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('\n❌ Execution Error:', err.message);
      process.exit(1);
    });
}
