import mongoose from 'mongoose';
import { Deliverable } from './model.js';
import { Comment } from '../comments/model.js';
import { logger } from '../../lib/logger.js';

/**
 * Idempotent migration to map legacy Submission and Feedback documents into
 * unified Deliverable and Comment models. Preserves original collections in backups.
 *
 * Rollback instructions:
 * 1. If rollback is required, original collections are untouched in backup_submissions and backup_feedbacks.
 * 2. Remove migrated items: await Deliverable.deleteMany({ legacySubmissionId: { $ne: null } });
 *
 * @param {Object} [database] - Optional mongodb Db instance (defaults to mongoose.connection.db)
 * @returns {Promise<Object>} Migration statistics
 */
export async function runDeliverableMigration(database) {
  const db = database || mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection is not open for migration');
  }

  const collections = await db.listCollections().toArray();
  const collectionNames = collections.map((c) => c.name);

  let migratedDeliverables = 0;
  let migratedComments = 0;
  const backupsCreated = [];

  // 1. Migrate Submissions -> Deliverables
  if (collectionNames.includes('submissions')) {
    const submissionsCol = db.collection('submissions');

    // Create backup collection if not already created
    if (!collectionNames.includes('backup_submissions')) {
      const allSubmissions = await submissionsCol.find({}).toArray();
      if (allSubmissions.length > 0) {
        await db.collection('backup_submissions').insertMany(allSubmissions);
        backupsCreated.push('backup_submissions');
      }
    }

    const legacySubmissions = await submissionsCol.find({}).toArray();

    for (const sub of legacySubmissions) {
      // Idempotency check: verify if this legacy doc is already migrated
      const existing = await Deliverable.findOne({ legacySubmissionId: sub._id });
      if (existing) {
        continue;
      }

      await Deliverable.create({
        taskId: sub.taskId,
        contentItemId: sub.contentItemId,
        version: sub.version || 1,
        type: sub.type || 'video',
        fileUrl: sub.fileUrl || sub.url || '',
        externalLink: sub.externalLink || sub.link || '',
        thumbnail: sub.thumbnail || '',
        uploadedBy: sub.uploadedBy || sub.userId || sub.author,
        notes: sub.notes || sub.description || '',
        status: sub.status || 'submitted',
        decidedBy: sub.decidedBy || null,
        decidedAt: sub.decidedAt || null,
        legacySubmissionId: sub._id,
      });

      migratedDeliverables++;
    }
  }

  // 2. Migrate Feedbacks -> Comments
  if (collectionNames.includes('feedbacks')) {
    const feedbackCol = db.collection('feedbacks');

    // Create backup collection if not already created
    if (!collectionNames.includes('backup_feedbacks')) {
      const allFeedbacks = await feedbackCol.find({}).toArray();
      if (allFeedbacks.length > 0) {
        await db.collection('backup_feedbacks').insertMany(allFeedbacks);
        backupsCreated.push('backup_feedbacks');
      }
    }

    const legacyFeedbacks = await feedbackCol.find({}).toArray();

    for (const fb of legacyFeedbacks) {
      // Check if comment already exists for this feedback text and author
      const existing = await Comment.findOne({
        entityId: fb.deliverableId || fb.submissionId || fb.taskId,
        author: fb.author || fb.userId,
        text: fb.feedback || fb.text || fb.comment || 'Feedback',
      });

      if (existing) {
        continue;
      }

      await Comment.create({
        entityType: 'deliverable',
        entityId: fb.deliverableId || fb.submissionId || fb.taskId,
        author: fb.author || fb.userId,
        text: fb.feedback || fb.text || fb.comment || 'Feedback',
        mediaTimestamp: fb.mediaTimestamp ?? fb.timestamp ?? null,
      });

      migratedComments++;
    }
  }

  logger.info(
    { migratedDeliverables, migratedComments, backupsCreated },
    'Deliverable & Feedback migration completed'
  );

  return {
    status: 'success',
    migratedDeliverables,
    migratedComments,
    backupsCreated,
  };
}
