import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../apps/api/src/config/db.js';
import { MediaItem, MediaMessage } from '../apps/api/src/modules/media/model.js';
import { Person } from '../apps/api/src/modules/people/model.js';

async function seedShootDemo() {
  await connectDB();
  const stageItemId = '6adf29adb555676776e21ed7';

  const shooter = await Person.findOne({ email: 'shooter@demo.haca.local' });
  const creativeHead = await Person.findOne({ role: 'creative_head' });

  // Clean existing clips for this item
  await MediaItem.deleteMany({ stageItemId });
  await MediaMessage.deleteMany({});

  const clip1 = await MediaItem.create({
    stageItemId,
    kind: 'video',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    storageId: 'demo/clip-scene-1-hook',
    thumbnailUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&auto=format&fit=crop&q=80',
    title: 'Scene 1: Coding Fast Cuts & Setup',
    shotRef: 'Scene 1: The Hook (0–12 seconds)',
    take: 2,
    tags: ['A-roll'],
    notes: 'Crisp 4K 60fps vertical framing. Good lighting on mechanical keyboard.',
    favourite: true,
    order: 0,
    version: 1,
    durationSeconds: 12,
    width: 1080,
    height: 1920,
    orientationOk: true,
    sizeBytes: 28400000,
    status: 'approved',
    decidedById: creativeHead?._id,
    decidedAt: new Date(Date.now() - 3600000),
  });

  const clip2 = await MediaItem.create({
    stageItemId,
    kind: 'video',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
    storageId: 'demo/clip-scene-2-interview',
    thumbnailUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&auto=format&fit=crop&q=80',
    title: 'Scene 2: Alumni Interview Desk',
    shotRef: 'Scene 2: The Beginning (12–28 seconds)',
    take: 1,
    tags: ['Interview'],
    notes: 'First take facing camera.',
    favourite: false,
    order: 1,
    version: 1,
    durationSeconds: 16,
    width: 1080,
    height: 1920,
    orientationOk: true,
    sizeBytes: 34200000,
    status: 'reshoot_needed',
    decidedById: creativeHead?._id,
    decidedAt: new Date(Date.now() - 1800000),
  });

  const clip3 = await MediaItem.create({
    stageItemId,
    kind: 'video',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    storageId: 'demo/clip-scene-3-lab',
    thumbnailUrl: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=600&auto=format&fit=crop&q=80',
    title: 'Scene 3: Lab B-roll & Screen Architecture',
    shotRef: 'Scene 3: The Transformation (28–55 seconds)',
    take: 1,
    tags: ['B-roll'],
    notes: 'Panning over terminal and neural net visualization.',
    favourite: false,
    order: 2,
    version: 1,
    durationSeconds: 27,
    width: 1080,
    height: 1920,
    orientationOk: true,
    sizeBytes: 52100000,
    status: 'uploaded',
  });

  // Add messages for clip2
  const msg1 = await MediaMessage.create({
    mediaItemId: clip2._id,
    authorId: creativeHead?._id,
    text: 'Audio is slightly muffled around 0:08 because of the background HVAC unit. Please re-position the wireless lapel mic higher up on the collar and reshoot.',
    timeSeconds: 8,
    seenBy: [{ userId: shooter?._id, seenAt: new Date() }],
    createdAt: new Date(Date.now() - 1800000),
  });

  const msg2 = await MediaMessage.create({
    mediaItemId: clip2._id,
    authorId: shooter?._id,
    text: 'Understood! I will use the deadcat windscreen and re-record take 2 right now.',
    replyToId: msg1._id,
    seenBy: [{ userId: creativeHead?._id, seenAt: new Date() }],
    createdAt: new Date(Date.now() - 900000),
  });

  // Add message for clip1
  await MediaMessage.create({
    mediaItemId: clip1._id,
    authorId: creativeHead?._id,
    text: 'Great lighting and clean 9:16 vertical framing at 0:04. Approved for assembly!',
    timeSeconds: 4,
    seenBy: [{ userId: shooter?._id, seenAt: new Date() }],
    createdAt: new Date(Date.now() - 3600000),
  });

  console.log('Seeded demo clips successfully:', [clip1._id, clip2._id, clip3._id]);
  await disconnectDB();
}

seedShootDemo();
