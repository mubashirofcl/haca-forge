/**
 * scripts/migrate-profile-completed.js
 *
 * One-time idempotent migration script to mark existing users with both `name` and `phone`
 * as having completed their profile (`profileCompletedAt`).
 *
 * Usage:
 *   node scripts/migrate-profile-completed.js               # Dry run (default)
 *   node scripts/migrate-profile-completed.js --backup     # Dry run and export backup JSON
 *   node scripts/migrate-profile-completed.js --confirm    # Apply updates (DO NOT RUN per prompt instructions)
 *   node scripts/migrate-profile-completed.js --rollback <path-to-backup.json>
 */

import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../apps/api/.env') });
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/marketing_portal';

async function main() {
  const args = process.argv.slice(2);
  const isConfirm = args.includes('--confirm');
  const isBackup = args.includes('--backup');
  const rollbackIndex = args.indexOf('--rollback');
  const rollbackPath = rollbackIndex !== -1 ? args[rollbackIndex + 1] : null;

  console.log('------------------------------------------------------------');
  console.log(' HACA Marketing OS — Profile Completion Migration Script');
  console.log('------------------------------------------------------------');

  await mongoose.connect(MONGO_URI);
  console.log(`Connected to MongoDB: ${MONGO_URI}`);

  const User = mongoose.model(
    'Person',
    new mongoose.Schema({}, { strict: false }),
    'users'
  );

  // Rollback mode
  if (rollbackPath) {
    console.log(`\nInitiating Rollback from: ${rollbackPath}`);
    if (!fs.existsSync(rollbackPath)) {
      console.error(`Error: Backup file not found at ${rollbackPath}`);
      process.exit(1);
    }

    const backupData = JSON.parse(fs.readFileSync(rollbackPath, 'utf8'));
    console.log(`Found ${backupData.length} records in backup.`);

    for (const record of backupData) {
      await User.updateOne(
        { _id: record._id },
        { $set: { profileCompletedAt: record.profileCompletedAt } }
      );
    }

    console.log('Rollback completed successfully.');
    await mongoose.disconnect();
    process.exit(0);
  }

  // Find all users without profileCompletedAt
  const candidateUsers = await User.find({
    $or: [
      { profileCompletedAt: null },
      { profileCompletedAt: { $exists: false } },
    ],
  }).lean();

  console.log(`Total users without profileCompletedAt: ${candidateUsers.length}`);

  const eligibleForComplete = [];
  const pendingWelcome = [];

  for (const u of candidateUsers) {
    const hasName = typeof u.name === 'string' && u.name.trim().length > 0;
    const hasPhone = typeof u.phone === 'string' && u.phone.trim().length > 0;

    if (hasName && hasPhone) {
      eligibleForComplete.push(u);
    } else {
      pendingWelcome.push(u);
    }
  }

  console.log(`\n[Summary]`);
  console.log(`  - Eligible for completion (has name & phone): ${eligibleForComplete.length}`);
  console.log(`  - Will be prompted for /welcome (lacks phone or name): ${pendingWelcome.length}`);

  if (eligibleForComplete.length > 0) {
    console.log('\nEligible Users Preview:');
    eligibleForComplete.slice(0, 10).forEach((u) => {
      console.log(`  * ${u.name} (${u.email}) — Phone: ${u.phone} — Role: ${u.role}`);
    });
    if (eligibleForComplete.length > 10) {
      console.log(`  ... and ${eligibleForComplete.length - 10} more`);
    }
  }

  if (pendingWelcome.length > 0) {
    console.log('\nPending Welcome Users (Need to complete on next login):');
    pendingWelcome.slice(0, 10).forEach((u) => {
      console.log(`  * ${u.name || '(No Name)'} (${u.email}) — Missing Phone — Role: ${u.role}`);
    });
    if (pendingWelcome.length > 10) {
      console.log(`  ... and ${pendingWelcome.length - 10} more`);
    }
  }

  // Backup generation
  if (isBackup || isConfirm) {
    const backupDir = path.resolve(__dirname, '../backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const backupFile = path.join(
      backupDir,
      `profile_migration_backup_${Date.now()}.json`
    );
    const backupPayload = eligibleForComplete.map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      profileCompletedAt: u.profileCompletedAt || null,
    }));
    fs.writeFileSync(backupFile, JSON.stringify(backupPayload, null, 2), 'utf8');
    console.log(`\n[Backup] Pre-migration snapshot saved to: ${backupFile}`);
  }

  if (!isConfirm) {
    console.log('\n>>> DRY RUN COMPLETED. No database changes were made.');
    console.log('>>> To commit changes, run with --confirm (DO NOT run unless explicitly requested).');
  } else {
    console.log('\nApplying updates...');
    const now = new Date();
    for (const u of eligibleForComplete) {
      const completedAt = u.createdAt ? new Date(u.createdAt) : now;
      await User.updateOne(
        { _id: u._id },
        { $set: { profileCompletedAt: completedAt } }
      );
    }
    console.log(`Successfully marked ${eligibleForComplete.length} users as profile completed.`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

