/**
 * scripts/migrate-calendars.js
 *
 * Migration for Multi-Calendar Implementation and For Team Removal:
 * - Dry run by default.
 * - Local database only (localhost / 127.0.0.1).
 * - Requires --confirm and --db-name to execute live.
 * - Exports JSON backup OUTSIDE repo before any mutations.
 * - Sets calendar to 'sm' where missing on CalendarPlan, ContentPiece, and WorkItem.
 * - $unset forTeam on ContentPiece.
 * - Rebuilds indexes on CalendarPlan, ContentPiece, and WorkItem with calendar.
 * - Rollback capability via --rollback <backup-dir>.
 * - Fully idempotent.
 *
 * IMPORTANT: DO NOT run with --confirm during automated build.
 *
 * Usage:
 *   node scripts/migrate-calendars.js                       # Dry run
 *   node scripts/migrate-calendars.js --confirm --db-name marketing_portal # Execute
 *   node scripts/migrate-calendars.js --rollback /path/to/backup            # Rollback
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../apps/api/.env') });
dotenv.config();

const args = process.argv.slice(2);
const isConfirm = args.includes('--confirm');
const dbNameIdx = args.indexOf('--db-name');
const specifiedDbName = dbNameIdx !== -1 && args[dbNameIdx + 1] ? args[dbNameIdx + 1] : null;
const rollbackIdx = args.indexOf('--rollback');
const rollbackDir = rollbackIdx !== -1 && args[rollbackIdx + 1] ? args[rollbackIdx + 1] : null;

const rawUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/marketing_portal';

function assertLocalhost(uri) {
  const isLocal =
    uri.includes('127.0.0.1') ||
    uri.includes('localhost') ||
    uri.includes('::1');
  if (!isLocal) {
    throw new Error(`SAFETY BLOCK: Migration can only run on local database (127.0.0.1/localhost). Found: ${uri}`);
  }
}

async function runRollback(targetUri, backupPath) {
  console.log(`\nInitiating rollback from backup directory: ${backupPath}`);
  if (!fs.existsSync(backupPath)) {
    console.error(`Rollback directory not found: ${backupPath}`);
    process.exit(1);
  }

  await mongoose.connect(targetUri);
  const db = mongoose.connection.db;

  const files = fs.readdirSync(backupPath).filter((f) => f.endsWith('.json'));
  for (const f of files) {
    const colName = f.replace('.json', '');
    const data = JSON.parse(fs.readFileSync(path.join(backupPath, f), 'utf8'));
    console.log(`Restoring [${colName}]: ${data.length} document(s)...`);
    if (data.length > 0) {
      await db.collection(colName).deleteMany({});
      const BATCH_SIZE = 1000;
      for (let i = 0; i < data.length; i += BATCH_SIZE) {
        const batch = data.slice(i, i + BATCH_SIZE).map((doc) => {
          if (doc._id && typeof doc._id === 'string' && doc._id.length === 24) {
            doc._id = new mongoose.Types.ObjectId(doc._id);
          }
          return doc;
        });
        await db.collection(colName).insertMany(batch);
      }
    }
  }
  console.log('Rollback completed successfully.');
  await mongoose.disconnect();
}

async function main() {
  console.log('============================================================');
  console.log(' HACA Marketing OS — Multi-Calendar & For Team Migration');
  console.log(` Mode: ${isConfirm ? 'LIVE (Applying Mutations)' : rollbackDir ? 'ROLLBACK' : 'DRY RUN (Preview Only)'}`);
  console.log('============================================================\n');

  assertLocalhost(rawUri);

  let targetUri = rawUri;
  if (specifiedDbName) {
    const parsed = new URL(rawUri);
    parsed.pathname = `/${specifiedDbName}`;
    targetUri = parsed.toString();
  }

  if (rollbackDir) {
    await runRollback(targetUri, rollbackDir);
    return;
  }

  if (isConfirm && !specifiedDbName) {
    console.error('ERROR: --db-name <database_name> is required when running with --confirm.');
    process.exit(1);
  }

  console.log(`Connecting to local MongoDB: ${targetUri}`);
  await mongoose.connect(targetUri);
  const db = mongoose.connection.db;
  console.log('Connected successfully.\n');

  const collections = await db.listCollections().toArray();
  const collNames = collections.map((c) => c.name);

  // Analyze CalendarPlan
  console.log('--- 1. ANALYSIS: CalendarPlan ---');
  let planCountWithoutCalendar = 0;
  if (collNames.includes('calendarplans')) {
    planCountWithoutCalendar = await db.collection('calendarplans').countDocuments({
      $or: [{ calendar: { $exists: false } }, { calendar: null }],
    });
    console.log(`calendarplans: ${planCountWithoutCalendar} plan(s) missing 'calendar' field (will default to 'sm')`);
  }

  // Analyze ContentPiece
  console.log('--- 2. ANALYSIS: ContentPiece ---');
  let pieceCountWithForTeam = 0;
  let pieceCountWithoutCalendar = 0;
  if (collNames.includes('contentpieces')) {
    pieceCountWithForTeam = await db.collection('contentpieces').countDocuments({
      forTeam: { $exists: true },
    });
    pieceCountWithoutCalendar = await db.collection('contentpieces').countDocuments({
      $or: [{ calendar: { $exists: false } }, { calendar: null }],
    });
    console.log(`contentpieces: ${pieceCountWithForTeam} piece(s) carry obsolete 'forTeam' field (will be unset)`);
    console.log(`contentpieces: ${pieceCountWithoutCalendar} piece(s) missing 'calendar' field (will default to 'sm')`);
  }

  // Analyze WorkItem
  console.log('--- 3. ANALYSIS: WorkItem ---');
  let workItemCountWithoutCalendar = 0;
  if (collNames.includes('workitems')) {
    workItemCountWithoutCalendar = await db.collection('workitems').countDocuments({
      $or: [{ calendar: { $exists: false } }, { calendar: null }],
    });
    console.log(`workitems: ${workItemCountWithoutCalendar} item(s) missing 'calendar' field (will default to 'sm')`);
  }

  if (!isConfirm) {
    console.log('\n[DRY RUN SUMMARY]');
    console.log(`- CalendarPlan documents to set calendar='sm': ${planCountWithoutCalendar}`);
    console.log(`- ContentPiece documents to unset forTeam: ${pieceCountWithForTeam}`);
    console.log(`- ContentPiece documents to set calendar='sm': ${pieceCountWithoutCalendar}`);
    console.log(`- WorkItem documents to set calendar='sm': ${workItemCountWithoutCalendar}`);
    console.log('- Indexes to rebuild: calendarplans { calendar: 1, periodStart: 1, periodEnd: 1 }');
    console.log('\nTo execute mutations, run with: node scripts/migrate-calendars.js --confirm --db-name <database_name>');
    await mongoose.disconnect();
    return;
  }

  // LIVE EXECUTION
  console.log('\n--- 4. EXPORTING BACKUP OUTSIDE REPOSITORY ---');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(os.tmpdir(), `haca-backup-calendars-${timestamp}`);
  fs.mkdirSync(backupDir, { recursive: true });

  const backupColls = ['calendarplans', 'contentpieces', 'workitems'];
  for (const c of backupColls) {
    if (collNames.includes(c)) {
      const docs = await db.collection(c).find({}).toArray();
      const filePath = path.join(backupDir, `${c}.json`);
      fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), 'utf8');
      console.log(`Backed up ${docs.length} document(s) from [${c}] -> ${filePath}`);
    }
  }
  console.log(`Backup completed successfully at: ${backupDir}\n`);

  console.log('--- 5. APPLYING MUTATIONS ---');

  // Mutate calendarplans
  if (collNames.includes('calendarplans')) {
    const res = await db.collection('calendarplans').updateMany(
      { $or: [{ calendar: { $exists: false } }, { calendar: null }] },
      { $set: { calendar: 'sm' } }
    );
    console.log(`calendarplans: Updated ${res.modifiedCount} plan(s) with calendar='sm'`);
  }

  // Mutate contentpieces
  if (collNames.includes('contentpieces')) {
    const res = await db.collection('contentpieces').updateMany(
      {},
      {
        $unset: { forTeam: '' },
      }
    );
    console.log(`contentpieces: Unset forTeam on ${res.modifiedCount} piece(s)`);

    const resCal = await db.collection('contentpieces').updateMany(
      { $or: [{ calendar: { $exists: false } }, { calendar: null }] },
      { $set: { calendar: 'sm' } }
    );
    console.log(`contentpieces: Set calendar='sm' on ${resCal.modifiedCount} piece(s)`);
  }

  // Mutate workitems
  if (collNames.includes('workitems')) {
    const res = await db.collection('workitems').updateMany(
      { $or: [{ calendar: { $exists: false } }, { calendar: null }] },
      { $set: { calendar: 'sm' } }
    );
    console.log(`workitems: Set calendar='sm' on ${res.modifiedCount} item(s)`);
  }

  console.log('\n--- 6. REBUILDING INDEXES ---');
  if (collNames.includes('calendarplans')) {
    try {
      await db.collection('calendarplans').createIndex(
        { calendar: 1, periodStart: 1, periodEnd: 1 },
        { background: true }
      );
      console.log('Created index { calendar: 1, periodStart: 1, periodEnd: 1 } on calendarplans');
    } catch (e) {
      console.warn('Index notice on calendarplans:', e.message);
    }
  }

  if (collNames.includes('contentpieces')) {
    try {
      await db.collection('contentpieces').createIndex({ calendar: 1 }, { background: true });
      console.log('Created index { calendar: 1 } on contentpieces');
    } catch (e) {
      console.warn('Index notice on contentpieces:', e.message);
    }
  }

  if (collNames.includes('workitems')) {
    try {
      await db.collection('workitems').createIndex({ calendar: 1 }, { background: true });
      console.log('Created index { calendar: 1 } on workitems');
    } catch (e) {
      console.warn('Index notice on workitems:', e.message);
    }
  }

  console.log('\n============================================================');
  console.log(' MIGRATION COMPLETED SUCCESSFULLY');
  console.log(` Backup preserved at: ${backupDir}`);
  console.log('============================================================');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('\nFATAL MIGRATION ERROR:', err);
  process.exit(1);
});

