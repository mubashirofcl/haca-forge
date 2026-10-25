#!/usr/bin/env node
/**
 * scripts/wipe-keep-admin.js
 *
 * Safe database wipe script for HACA Marketing OS.
 * - Dry run by default.
 * - Refuses non-local hosts (localhost, 127.0.0.1, ::1).
 * - Refuses execution in production environment.
 * - Requires: --confirm, --db-name=<connected-db-name>, --keep-emails=<emails>
 * - Automatically performs mongodump backup before mutating.
 */

import { MongoClient } from 'mongodb';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Canonical reference lists
const CANONICAL_DEPARTMENT_CODES = [
  'design',
  'video_production',
  'social_media',
  'seo_content',
  'whatsapp',
  'performance_marketing',
  'tech',
];

const CANONICAL_REPORT_KEYS = [
  'weekly_marketing',
  'monthly_scorecard',
  'creative_production',
  'team_performance',
];

const CANONICAL_REPORT_DEFINITIONS = [
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

// Collections to KEEP
const KEEP_COLLECTIONS = ['teams', 'settings', 'system.indexes'];

// Collections to EMPTY or DROP completely
const COLLECTIONS_TO_EMPTY = [
  // Transactional / Activity
  'activityevents',
  'contentpieces',
  'workitems',
  'calendarplans',
  'assignment_overrides',
  'monthlytargets',
  'notifications',
  'counters',
  'feedbackentries',
  'campaigns',
  'accessrequests',
  'blockers',
  'revisionflags',
  // Verified unused reference collections
  'holdreasons',
  'contentformats',
  'platforms',
  'requesttypes',
  'pipelinetemplates',
  // Legacy empty collections
  'auditlogs',
  'calendarentries',
  'comments',
  'contentitems',
  'deliverables',
  'leads',
  'leaverequests',
  'requests',
  'scheduledreports',
  'shoots',
  'statushistories',
  'tasks',
  'teamassignments',
  'timeentries',
];

export function findMongodump() {
  const commonPaths = [
    'mongodump',
    'C:\\Program Files\\MongoDB\\Tools\\100\\bin\\mongodump.exe',
    'C:\\Program Files\\MongoDB\\Server\\8.3\\bin\\mongodump.exe',
    'C:\\Program Files\\MongoDB\\Server\\7.0\\bin\\mongodump.exe',
  ];

  for (const p of commonPaths) {
    try {
      execSync(`"${p}" --version`, { stdio: 'ignore' });
      return p;
    } catch {
      // continue searching
    }
  }
  return 'mongodump';
}

export function parseArgs(argv = process.argv.slice(2)) {
  const flags = {
    confirm: false,
    dbName: null,
    keepEmails: [],
    clearQueues: false,
    mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/marketing_portal',
  };

  for (const arg of argv) {
    if (arg === '--confirm') flags.confirm = true;
    else if (arg === '--clear-queues') flags.clearQueues = true;
    else if (arg.startsWith('--db-name=')) flags.dbName = arg.split('=')[1].trim();
    else if (arg.startsWith('--keep-emails=')) {
      const emails = arg.split('=')[1].split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
      flags.keepEmails = emails;
    } else if (arg.startsWith('--uri=')) {
      flags.mongoUri = arg.split('=')[1].trim();
    }
  }

  return flags;
}

export function validateHost(uri) {
  // Extract host from mongodb URI (supporting bracketed IPv6 addresses)
  const match = uri.match(/mongodb(?:\+srv)?:\/\/(?:[^@]+@)?(\[[^\]]+\]|[^/:]+)/i);
  if (!match) return false;
  let host = match[1].toLowerCase().replace(/^\[|\]$/g, '');
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

export async function runWipeKeepAdmin(rawArgv = process.argv.slice(2), injectedDb = null) {
  const flags = parseArgs(rawArgv);

  // Safety Guard 1: Environment guard
  if (process.env.NODE_ENV === 'production') {
    throw new Error('CRITICAL SAFETY GUARD: Cannot execute wipe script when NODE_ENV is "production"!');
  }

  // Safety Guard 2: Host restriction
  if (!validateHost(flags.mongoUri)) {
    throw new Error(`CRITICAL SAFETY GUARD: Cannot wipe non-local database host! URI host must be localhost, 127.0.0.1, or ::1.`);
  }

  const isConfirmed = flags.confirm;
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
  if (!isConfirmed) {
    console.log('\n================================================================');
    console.log('🔍 HACA MARKETING OS — DATABASE WIPE DRY-RUN');
    console.log('================================================================');
    console.log(`Connected Database: ${actualDbName}`);
    console.log(`Execution Mode:     DRY-RUN (Zero mutations performed)\n`);

    console.log('Safety Parameters Required for Confirmed Execution:');
    console.log(`  --confirm:                    ${flags.confirm ? '✓' : 'MISSING'}`);
    console.log(`  --db-name=${actualDbName}:          ${flags.dbName === actualDbName ? '✓' : `MISSING (Passed: ${flags.dbName || 'none'})`}`);
    console.log(`  --keep-emails=<email>:        ${flags.keepEmails.length > 0 ? `✓ (${flags.keepEmails.join(', ')})` : 'MISSING'}\n`);

    console.log('Planned Collection Actions:');
    console.log('----------------------------------------------------------------');
    console.log('Collection                     Current Count   Action Planned');
    console.log('----------------------------------------------------------------');

    for (const name of colNames.sort()) {
      const count = beforeCounts[name];
      let action = 'UNSPECIFIED';

      if (name === 'users') {
        action = `KEEP only [${flags.keepEmails.join(', ') || 'NONE'}] (${count} -> 1)`;
      } else if (name === 'teams' || name === 'settings') {
        action = `KEEP as-is (${count} docs)`;
      } else if (name === 'departments') {
        action = `PRUNE extras to 7 canonical (${count} -> 7)`;
      } else if (name === 'priorities') {
        action = `PRUNE 'Urgent' to 3 canonical (${count} -> 3)`;
      } else if (name === 'reportdefinitions') {
        action = `PRUNE legacy to 4 canonical R4 reports (${count} -> 4)`;
      } else if (name === 'profiles') {
        action = `SET HACA active only, 6 others inactive`;
      } else if (name === 'automationrules') {
        action = `RESET runtime fields (lastRunAt, lastRunStatus)`;
      } else if (COLLECTIONS_TO_EMPTY.includes(name)) {
        action = `EMPTY / DROP (${count} -> 0)`;
      } else {
        action = `EMPTY (${count} -> 0)`;
      }

      console.log(`${name.padEnd(30)} ${String(count).padStart(12)}   ${action}`);
    }

    console.log('----------------------------------------------------------------');
    console.log('\nℹ️  To execute the wipe, rerun with all required safety flags:');
    console.log(`    node scripts/wipe-keep-admin.js --confirm --db-name=${actualDbName} --keep-emails=admin@hacaforge.com\n`);

    if (client) await client.close();

    return {
      mode: 'dry-run',
      database: actualDbName,
      beforeCounts,
      executed: false,
    };
  }

  // CONFIRMED EXECUTION:
  // Validate safety requirements
  if (!flags.dbName || flags.dbName !== actualDbName) {
    throw new Error(`CRITICAL SAFETY GUARD: Flag --db-name="${flags.dbName}" does not match connected database "${actualDbName}"!`);
  }

  if (!flags.keepEmails || flags.keepEmails.length === 0) {
    throw new Error('CRITICAL SAFETY GUARD: Flag --keep-emails must specify at least one admin email to preserve!');
  }

  console.log('\n================================================================');
  console.log('🚨 HACA MARKETING OS — CONFIRMED DATABASE WIPE EXECUTION');
  console.log('================================================================');
  console.log(`Database:     ${actualDbName}`);
  console.log(`Keep Users:   ${flags.keepEmails.join(', ')}`);
  console.log('================================================================\n');

  // Step 1: Pre-Wipe Backup
  if (!injectedDb) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.resolve(__dirname, '../../haca-backups', `wipe-${timestamp}`);
    console.log(`📦 Creating safety pre-wipe backup to ${backupDir}...`);

    try {
      fs.mkdirSync(backupDir, { recursive: true });
      const mongodumpBin = findMongodump();
      execSync(`"${mongodumpBin}" --uri="${flags.mongoUri}" --out="${backupDir}"`, {
        stdio: 'inherit',
      });
      console.log('✓ Backup completed successfully.\n');
    } catch (err) {
      throw new Error(`BACKUP FAILED: Aborting database wipe for data safety. Error: ${err.message}`);
    }
  }

  // Step 2: Empty / Drop Transactional & Unused Collections
  console.log('🧹 Purging transactional and unused reference collections...');
  for (const name of COLLECTIONS_TO_EMPTY) {
    if (colNames.includes(name)) {
      await db.collection(name).deleteMany({});
      console.log(`  ✓ Emptied collection: ${name}`);
    }
  }

  // Step 3: Prune Users (Keep only specified emails)
  console.log('\n👤 Pruning user accounts...');
  const usersCol = db.collection('users');
  const keepFilter = { email: { $in: flags.keepEmails } };
  const keptUserCount = await usersCol.countDocuments(keepFilter);

  if (keptUserCount === 0) {
    throw new Error(`ABORT: No users found matching keep emails [${flags.keepEmails.join(', ')}]! Refusing to delete all users.`);
  }

  const deleteUsersResult = await usersCol.deleteMany({
    email: { $nin: flags.keepEmails },
  });
  console.log(`  ✓ Deleted ${deleteUsersResult.deletedCount} non-admin user(s). Kept ${keptUserCount} admin user(s).`);

  // Step 4: Prune Departments to Canonical 7
  console.log('\n🏢 Standardizing departments to canonical 7...');
  const deptsCol = db.collection('departments');
  const deleteDeptsResult = await deptsCol.deleteMany({
    code: { $nin: CANONICAL_DEPARTMENT_CODES },
  });
  console.log(`  ✓ Removed ${deleteDeptsResult.deletedCount} legacy department(s).`);

  // Step 5: Prune Priorities to Canonical 3 (High, Medium, Low)
  console.log('\n⚡ Standardizing priorities to High, Medium, Low...');
  const priorsCol = db.collection('priorities');
  const deletePriorsResult = await priorsCol.deleteMany({
    $or: [{ name: /urgent/i }, { code: /urgent/i }],
  });
  console.log(`  ✓ Removed ${deletePriorsResult.deletedCount} 'Urgent' priority document(s).`);

  // Step 6: Prune and Standardize Report Definitions to Canonical 4 R4 Reports
  console.log('\n📊 Standardizing report definitions to 4 canonical reports...');
  const reportsCol = db.collection('reportdefinitions');
  await reportsCol.deleteMany({
    $or: [
      { reportKey: { $nin: CANONICAL_REPORT_KEYS } },
      { name: /funnel|deep-dive/i },
    ],
  });
  for (const def of CANONICAL_REPORT_DEFINITIONS) {
    await reportsCol.updateOne(
      { reportKey: def.reportKey },
      { $setOnInsert: { ...def, createdAt: new Date(), updatedAt: new Date() } },
      { upsert: true }
    );
  }
  const reportCount = await reportsCol.countDocuments();
  console.log(`  ✓ Standardized report definitions to ${reportCount} canonical reports.`);

  // Step 7: Enforce Single-Brand Profile (HACA active only)
  console.log('\n🏷️  Enforcing single-brand profile rule (HACA active only)...');
  const profsCol = db.collection('profiles');
  await profsCol.updateOne({ code: 'haca' }, { $set: { active: true, isActive: true } });
  const updateOthersResult = await profsCol.updateMany(
    { code: { $ne: 'haca' } },
    { $set: { active: false, isActive: false } }
  );
  console.log(`  ✓ HACA set to active. Set ${updateOthersResult.modifiedCount} other profile(s) to inactive.`);

  // Step 8: Reset Runtime Fields in Automation Rules
  console.log('\n⚙️  Resetting runtime state in automation rules...');
  const autoCol = db.collection('automationrules');
  if (colNames.includes('automationrules')) {
    await autoCol.updateMany(
      {},
      {
        $set: {
          lastRunAt: null,
          lastRunStatus: null,
          errorCount: 0,
        },
      }
    );
    console.log(`  ✓ Reset runtime fields in automationrules.`);
  }

  // Step 9: Queue clearing (if requested)
  if (flags.clearQueues) {
    console.log('\n📬 Clearing BullMQ Redis queues...');
    try {
      const { default: Redis } = await import('ioredis');
      const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
      const keys = await redis.keys('bull:*');
      if (keys.length > 0) {
        await redis.del(...keys);
        console.log(`  ✓ Flushed ${keys.length} BullMQ queue key(s) from Redis.`);
      } else {
        console.log('  ✓ Redis queues already empty.');
      }
      redis.disconnect();
    } catch (err) {
      console.warn(`  ⚠️ Queue clearing failed or Redis unavailable: ${err.message}`);
    }
  }

  // Step 10: Before & After Count Audit
  const afterCounts = {};
  for (const name of colNames) {
    try {
      afterCounts[name] = await db.collection(name).countDocuments();
    } catch {
      afterCounts[name] = 0;
    }
  }

  console.log('\n================================================================');
  console.log('📊 DATABASE WIPE SUMMARY: BEFORE VS AFTER DOCUMENT COUNTS');
  console.log('================================================================');
  console.log('Collection                     Before Count    After Count    Delta');
  console.log('----------------------------------------------------------------');
  for (const name of colNames.sort()) {
    const before = beforeCounts[name] || 0;
    const after = afterCounts[name] || 0;
    const delta = after - before;
    console.log(
      `${name.padEnd(30)} ${String(before).padStart(12)} ${String(after).padStart(14)}   ${delta === 0 ? '-' : String(delta)}`
    );
  }
  console.log('================================================================\n');

  if (client) await client.close();

  return {
    mode: 'confirmed',
    database: actualDbName,
    beforeCounts,
    afterCounts,
    executed: true,
  };
}

// Standalone execution entry point
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  runWipeKeepAdmin()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('\n❌ Execution Error:', err.message);
      process.exit(1);
    });
}
