/**
 * scripts/migrate-team-chat.js
 *
 * Idempotent migration script to bootstrap the system Team Chat channel
 * and synchronize active user memberships into ChannelMember.
 *
 * Usage:
 *   node scripts/migrate-team-chat.js            # Dry run (default)
 *   node scripts/migrate-team-chat.js --confirm  # Apply updates
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../apps/api/.env') });
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/marketing_portal';

async function main() {
  const args = process.argv.slice(2);
  const isConfirm = args.includes('--confirm');

  console.log('------------------------------------------------------------');
  console.log(' HACA Marketing OS — Team Chat Bootstrap & Membership Migration');
  console.log(` Mode: ${isConfirm ? 'LIVE (Applying Changes)' : 'DRY RUN (Preview Only)'}`);
  console.log('------------------------------------------------------------');

  await mongoose.connect(MONGO_URI);
  console.log(`Connected to MongoDB: ${MONGO_URI}\n`);

  const Channel = mongoose.model(
    'Channel',
    new mongoose.Schema({}, { strict: false }),
    'channels'
  );

  const ChannelMember = mongoose.model(
    'ChannelMember',
    new mongoose.Schema({}, { strict: false }),
    'channelmembers'
  );

  const Person = mongoose.model(
    'Person',
    new mongoose.Schema({}, { strict: false }),
    'users'
  );

  // 1. Check or create Team Chat channel
  let teamChannel = await Channel.findOne({ type: 'team', systemSlug: 'team-chat' });
  if (!teamChannel) {
    console.log('[+] Team Chat channel does not exist.');
    if (isConfirm) {
      teamChannel = await Channel.create({
        type: 'team',
        name: 'Team Chat',
        description: 'System-wide team communication channel for all active members.',
        systemSlug: 'team-chat',
        isArchived: false,
        lastMessageAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`    -> Created Team Chat channel: ${teamChannel._id}`);
    } else {
      console.log('    -> [DRY RUN] Would create system Team Chat channel.');
    }
  } else {
    console.log(`[=] Team Chat channel already exists: ${teamChannel._id}`);
  }

  // 2. Find active users
  const activeUsers = await Person.find({ status: 'active' });
  console.log(`Found ${activeUsers.length} active users.`);

  let addedCount = 0;
  if (teamChannel || !isConfirm) {
    const channelId = teamChannel ? teamChannel._id : new mongoose.Types.ObjectId();
    const existingMembers = teamChannel
      ? await ChannelMember.find({ channelId: teamChannel._id })
      : [];
    const memberSet = new Set(existingMembers.map((m) => m.userId.toString()));

    for (const user of activeUsers) {
      if (!memberSet.has(user._id.toString())) {
        addedCount++;
        console.log(`    -> Missing membership: ${user.name} (${user.email}) [${user.role}]`);
        if (isConfirm) {
          await ChannelMember.create({
            channelId: teamChannel._id,
            userId: user._id,
            role: 'member',
            joinedAt: new Date(),
            isMuted: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }
    }
  }

  console.log('\nMigration Summary:');
  console.log(`- Team Chat Channel: ${teamChannel ? 'Exists' : 'Created'}`);
  console.log(`- Active Users Inspected: ${activeUsers.length}`);
  console.log(`- Memberships To Add: ${addedCount}`);

  if (!isConfirm && addedCount > 0) {
    console.log('\nTo execute changes, rerun with: node scripts/migrate-team-chat.js --confirm');
  }

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

