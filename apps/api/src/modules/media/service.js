import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MediaItem, MediaMessage } from './model.js';
import { WorkItem } from '../workItems/model.js';
import { User } from '../people/model.js';
import { resolveScope } from '../../lib/scope.js';
import { getWorkspaceMode } from '@mmp/shared';
import { createNotification } from '../notifications/service.js';
import { canSeePrivateReview, canSeeStepOutput, getParticipation, isTeamMember } from '../workItems/access.js';
import { assertOutputUrl } from '../uploads/outputUrls.js';

/**
 * Sanitize plain text to ensure no dangerous HTML/scripts
 */
function sanitizePlainText(text) {
  if (!text) return '';
  return String(text)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .trim();
}

/**
 * Helper to check whether aspect ratio is 9:16 vertical standard
 */
function isOrientation916(width, height) {
  if (!width || !height || width <= 0 || height <= 0) return true;
  const ratio = height / width;
  return ratio >= 1.6 && ratio <= 1.9;
}

/**
 * 1. Create a new clip (after signed upload)
 */
export async function createClip(stageItemId, clipData, user) {
  const workItem = await WorkItem.findById(stageItemId);
  if (!workItem) {
    const error = new Error('Stage item not found');
    error.statusCode = 404;
    throw error;
  }

  // Permission check: step must be editable by this user
  const mode = getWorkspaceMode(user, workItem);
  if (mode !== 'edit') {
    const error = new Error('You do not have permission to add clips to this stage');
    error.statusCode = 403;
    error.code = 'FORBIDDEN_ACTION';
    throw error;
  }

  // Server-side limits: max 10 clips per step
  const existingCount = await MediaItem.countDocuments({ stageItemId });
  if (existingCount >= 10) {
    const error = new Error('A maximum of 10 clips can be uploaded per shoot step');
    error.statusCode = 400;
    error.code = 'MAX_CLIPS_EXCEEDED';
    throw error;
  }

  // Server-side type and size limits per docs/WORKSPACES.md
  const kind = clipData.kind || 'video';
  const sizeBytes = Number(clipData.sizeBytes) || 0;
  if (kind === 'video') {
    if (sizeBytes > 500 * 1024 * 1024) {
      const error = new Error('Video file size exceeds maximum limit of 500 MB');
      error.statusCode = 400;
      error.code = 'FILE_TOO_LARGE';
      throw error;
    }
  } else if (kind === 'image') {
    if (sizeBytes > 20 * 1024 * 1024) {
      const error = new Error('Image file size exceeds maximum limit of 20 MB');
      error.statusCode = 400;
      error.code = 'FILE_TOO_LARGE';
      throw error;
    }
  }

  // Calculate 9:16 orientation
  const width = Number(clipData.width) || 0;
  const height = Number(clipData.height) || 0;
  const orientationOk = width > 0 && height > 0 ? isOrientation916(width, height) : true;

  // Auto-order if not provided
  let order = Number(clipData.order);
  if (isNaN(order)) {
    const lastClip = await MediaItem.findOne({ stageItemId }).sort({ order: -1 });
    order = lastClip ? (lastClip.order || 0) + 1 : 0;
  }

  // Handle replacesId
  let version = 1;
  if (clipData.replacesId) {
    const oldClip = await MediaItem.findById(clipData.replacesId);
    if (oldClip) {
      if (oldClip.status === 'approved') {
        const error = new Error('Approved clips are locked and cannot be replaced');
        error.statusCode = 400;
        error.code = 'CLIP_LOCKED';
        throw error;
      }
      version = (oldClip.version || 1) + 1;
    }
  }

  // A clip is a file uploaded here or a Google Drive link; a thumbnail must be an upload.
  assertOutputUrl(clipData.url, 'url');
  if (!clipData.url) throw Object.assign(new Error('A clip URL is required'), { statusCode: 400, code: 'INVALID_OUTPUT_URL' });
  assertOutputUrl(clipData.thumbnailUrl, 'thumbnailUrl', { uploadsOnly: true });

  const clip = await MediaItem.create({
    stageItemId,
    contentPieceId: workItem.contentPieceId || null,
    kind,
    url: clipData.url,
    storageId: clipData.storageId || '',
    thumbnailUrl: clipData.thumbnailUrl || '',
    title: sanitizePlainText(clipData.title),
    shotRef: clipData.shotRef ? String(clipData.shotRef).trim() : '',
    take: Math.max(1, Number(clipData.take) || 1),
    tags: Array.isArray(clipData.tags) ? clipData.tags : [],
    notes: sanitizePlainText(clipData.notes || ''),
    favourite: Boolean(clipData.favourite),
    order,
    version,
    replacesId: clipData.replacesId || null,
    durationSeconds: Number(clipData.durationSeconds) || 0,
    width,
    height,
    orientationOk,
    sizeBytes,
    status: clipData.status || 'uploaded',
  });

  return clip;
}

/**
 * 2. List clips for a step with shot list & coverage maths
 */
export async function listClips(stageItemId, user) {
  const workItem = await WorkItem.findById(stageItemId);
  if (!workItem) {
    const error = new Error('Stage item not found');
    error.statusCode = 404;
    throw error;
  }

  // A participant on someone else's step sees only the approved clips of an earlier, finished step.
  const userIdForClips = (user.userId || user._id || user.id)?.toString();
  const isOtherOwnersStep = isTeamMember(user) && (workItem.ownerId?._id || workItem.ownerId)?.toString() !== userIdForClips;
  if (isOtherOwnersStep) {
    const participation = await getParticipation(workItem, user);
    if (!canSeeStepOutput(workItem, participation)) {
      const error = new Error('You do not have access to view this stage');
      error.statusCode = 403;
      error.code = 'FORBIDDEN_ACTION';
      throw error;
    }
  } else {
    const mode = getWorkspaceMode(user, workItem);
    if (mode === 'none') {
      const error = new Error('You do not have access to view this stage');
      error.statusCode = 403;
      error.code = 'FORBIDDEN_ACTION';
      throw error;
    }
  }

  let clips = await MediaItem.find({ stageItemId })
    .populate('decidedById', 'name email role')
    .sort({ order: 1, createdAt: 1 })
    .lean();
  if (isOtherOwnersStep) {
    const replacedIds = new Set(clips.filter((c) => c.replacesId).map((c) => String(c.replacesId)));
    clips = clips.filter((c) => c.status === 'approved' && !replacedIds.has(String(c._id)));
  }

  const userIdStr = (user.userId || user._id || user.id)?.toString();

  // Compute unread message counts per clip for this viewer
  const clipIds = clips.map((c) => c._id);
  const unreadCountsMap = {};

  if (clipIds.length > 0 && userIdStr) {
    const unreadMessages = await MediaMessage.find({
      mediaItemId: { $in: clipIds },
      authorId: { $ne: userIdStr },
      'seenBy.userId': { $ne: userIdStr },
    }).select('mediaItemId');

    for (const msg of unreadMessages) {
      const k = msg.mediaItemId.toString();
      unreadCountsMap[k] = (unreadCountsMap[k] || 0) + 1;
    }
  }

  const enrichedClips = clips.map((clip) => ({
    ...clip,
    unreadCount: isOtherOwnersStep ? 0 : unreadCountsMap[clip._id.toString()] || 0,
  }));

  // Retrieve script shot list from Script stage of the same contentPiece
  let shotList = [];
  if (workItem.contentPieceId) {
    const scriptStage = await WorkItem.findOne({
      contentPieceId: workItem.contentPieceId,
      stageKey: 'Script',
    });
    if (scriptStage) {
      try {
        const { Submission } = await import('../submissions/model.js');
        const scriptSub = await Submission.findOne({
          workItemId: scriptStage._id,
          version: { $gt: 0 },
        }).sort({ version: -1 });

        if (scriptSub?.document?.metadata?.shotList) {
          shotList = scriptSub.document.metadata.shotList;
        }
      } catch {}
    }
  }

  // Calculate coverage
  const totalShots = shotList.length;
  let coveredShots = 0;
  if (totalShots > 0) {
    coveredShots = shotList.filter((shot, idx) => {
      const matchSceneNum = String(shot.sceneNumber ?? idx + 1);
      const matchVisual = shot.visual ? String(shot.visual).trim().toLowerCase() : '';
      const matchShotRef = shot.shotRef ? String(shot.shotRef).trim() : '';

      return enrichedClips.some((c) => {
        if (!c.shotRef) return false;
        const cRef = String(c.shotRef).trim();
        return (
          cRef === matchSceneNum ||
          cRef === matchShotRef ||
          (matchVisual && cRef.toLowerCase() === matchVisual)
        );
      });
    }).length;
  }

  const coverage = `${coveredShots} of ${totalShots} shots covered`;

  return {
    clips: enrichedClips,
    shotList,
    coverage,
    totalShots,
    coveredShots,
  };
}

/**
 * 3. Update clip metadata (only while not approved and step is editable)
 */
export async function updateClipMetadata(clipId, updateData, user) {
  const clip = await MediaItem.findById(clipId);
  if (!clip) {
    const error = new Error('Clip not found');
    error.statusCode = 404;
    throw error;
  }

  if (clip.status === 'approved') {
    const error = new Error('Approved clips are locked and cannot be updated');
    error.statusCode = 400;
    error.code = 'CLIP_LOCKED';
    throw error;
  }

  const workItem = await WorkItem.findById(clip.stageItemId);
  const mode = getWorkspaceMode(user, workItem);
  if (mode !== 'edit') {
    const error = new Error('Stage is not editable');
    error.statusCode = 403;
    error.code = 'FORBIDDEN_ACTION';
    throw error;
  }

  if (updateData.title !== undefined) clip.title = sanitizePlainText(updateData.title);
  if (updateData.shotRef !== undefined) clip.shotRef = String(updateData.shotRef).trim();
  if (updateData.take !== undefined) clip.take = Math.max(1, Number(updateData.take) || 1);
  if (updateData.tags !== undefined) clip.tags = Array.isArray(updateData.tags) ? updateData.tags : [];
  if (updateData.notes !== undefined) clip.notes = sanitizePlainText(updateData.notes);
  if (updateData.favourite !== undefined) clip.favourite = Boolean(updateData.favourite);
  if (updateData.order !== undefined) clip.order = Number(updateData.order) || 0;

  await clip.save();
  return clip;
}

/**
 * 4. Replace clip (creates a new version; the old one stays in history)
 */
export async function replaceClip(clipId, newClipData, user) {
  const oldClip = await MediaItem.findById(clipId);
  if (!oldClip) {
    const error = new Error('Clip to replace not found');
    error.statusCode = 404;
    throw error;
  }

  if (oldClip.status === 'approved') {
    const error = new Error('Approved clips are locked and cannot be replaced');
    error.statusCode = 400;
    error.code = 'CLIP_LOCKED';
    throw error;
  }

  const workItem = await WorkItem.findById(oldClip.stageItemId);
  const mode = getWorkspaceMode(user, workItem);
  if (mode !== 'edit') {
    const error = new Error('Stage is not editable');
    error.statusCode = 403;
    error.code = 'FORBIDDEN_ACTION';
    throw error;
  }

  const width = Number(newClipData.width) || oldClip.width;
  const height = Number(newClipData.height) || oldClip.height;
  const orientationOk = width > 0 && height > 0 ? isOrientation916(width, height) : true;

  // Only the values sent now are checked; a reused old thumbnail stays as it was.
  if (!newClipData.url) throw Object.assign(new Error('A clip URL is required'), { statusCode: 400, code: 'INVALID_OUTPUT_URL' });
  assertOutputUrl(newClipData.url, 'url');
  assertOutputUrl(newClipData.thumbnailUrl, 'thumbnailUrl', { uploadsOnly: true });

  const newClip = await MediaItem.create({
    stageItemId: oldClip.stageItemId,
    contentPieceId: oldClip.contentPieceId,
    kind: newClipData.kind || oldClip.kind,
    url: newClipData.url,
    storageId: newClipData.storageId || oldClip.storageId,
    thumbnailUrl: newClipData.thumbnailUrl || oldClip.thumbnailUrl,
    title: sanitizePlainText(newClipData.title || oldClip.title),
    shotRef: newClipData.shotRef !== undefined ? String(newClipData.shotRef).trim() : oldClip.shotRef,
    take: newClipData.take !== undefined ? Number(newClipData.take) : oldClip.take + 1,
    tags: Array.isArray(newClipData.tags) ? newClipData.tags : oldClip.tags,
    notes: newClipData.notes !== undefined ? sanitizePlainText(newClipData.notes) : oldClip.notes,
    favourite: newClipData.favourite !== undefined ? Boolean(newClipData.favourite) : oldClip.favourite,
    order: oldClip.order,
    version: (oldClip.version || 1) + 1,
    replacesId: oldClip._id,
    durationSeconds: Number(newClipData.durationSeconds) || oldClip.durationSeconds,
    width,
    height,
    orientationOk,
    sizeBytes: Number(newClipData.sizeBytes) || oldClip.sizeBytes,
    status: 'uploaded',
  });

  return newClip;
}

const UPLOADS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../uploads');

/**
 * Delete a deleted clip's local files (video and thumbnail). Only a plain file directly in
 * /uploads is touched, and only when no other clip still points at it.
 */
async function removeClipFiles(clip) {
  for (const url of new Set([clip.url, clip.thumbnailUrl])) {
    const match = /^\/uploads\/([A-Za-z0-9._-]+)$/.exec(String(url || ''));
    if (!match || match[1].startsWith('.')) continue;
    const stillUsed = await MediaItem.exists({ $or: [{ url }, { thumbnailUrl: url }] });
    if (stillUsed) continue;
    try {
      fs.unlinkSync(path.join(UPLOADS_DIR, match[1]));
    } catch {
      // Already gone, or never stored locally.
    }
  }
}

/**
 * 5. Delete clip (only while not approved and step is editable)
 */
export async function deleteClip(clipId, user) {
  const clip = await MediaItem.findById(clipId);
  if (!clip) {
    const error = new Error('Clip not found');
    error.statusCode = 404;
    throw error;
  }

  if (clip.status === 'approved') {
    const error = new Error('Approved clips are locked and cannot be deleted');
    error.statusCode = 400;
    error.code = 'CLIP_LOCKED';
    throw error;
  }

  const workItem = await WorkItem.findById(clip.stageItemId);
  const mode = getWorkspaceMode(user, workItem);
  if (mode !== 'edit') {
    const error = new Error('Stage is not editable');
    error.statusCode = 403;
    error.code = 'FORBIDDEN_ACTION';
    throw error;
  }

  await MediaMessage.deleteMany({ mediaItemId: clip._id });
  await MediaItem.findByIdAndDelete(clip._id);
  // A deleted clip's file goes too. Replaced clips and old versions keep theirs.
  await removeClipFiles(clip);

  return { success: true };
}

/**
 * 6. Reorder clips
 */
export async function reorderClips(stageItemId, clipIds, user) {
  const workItem = await WorkItem.findById(stageItemId);
  if (!workItem) {
    const error = new Error('Stage item not found');
    error.statusCode = 404;
    throw error;
  }

  const mode = getWorkspaceMode(user, workItem);
  if (mode !== 'edit') {
    const error = new Error('Stage is not editable');
    error.statusCode = 403;
    error.code = 'FORBIDDEN_ACTION';
    throw error;
  }

  if (Array.isArray(clipIds)) {
    const updates = clipIds.map((id, index) =>
      MediaItem.updateOne({ _id: id, stageItemId }, { $set: { order: index } })
    );
    await Promise.all(updates);
  }

  return { success: true };
}

/**
 * 7. Post message to clip thread
 * Permissions: step owner, creative_head and admin can post; sm_manager and executive read only; nobody else sees thread.
 */
export async function postMessage(clipId, messageData, user) {
  const clip = await MediaItem.findById(clipId);
  if (!clip) {
    const error = new Error('Clip not found');
    error.statusCode = 404;
    throw error;
  }

  const workItem = await WorkItem.findById(clip.stageItemId);
  if (!workItem) {
    const error = new Error('Stage item not found');
    error.statusCode = 404;
    throw error;
  }

  const userIdStr = (user.userId || user._id || user.id)?.toString();
  const ownerIdStr = (workItem.ownerId?._id || workItem.ownerId)?.toString();
  const isOwner = Boolean(userIdStr && ownerIdStr && userIdStr === ownerIdStr);
  const role = user.role;

  // Verify permission
  const canPost = isOwner || role === 'creative_head' || role === 'admin';
  if (!canPost) {
    const error = new Error('You do not have permission to post messages to this clip');
    error.statusCode = 403;
    error.code = 'FORBIDDEN_ACTION';
    throw error;
  }

  const cleanText = sanitizePlainText(messageData.text);
  if (!cleanText) {
    const error = new Error('Message text cannot be empty');
    error.statusCode = 400;
    throw error;
  }

  const message = await MediaMessage.create({
    mediaItemId: clip._id,
    authorId: userIdStr,
    text: cleanText,
    timeSeconds: messageData.timeSeconds != null ? Number(messageData.timeSeconds) : null,
    replyToId: messageData.replyToId || null,
    seenBy: [{ userId: userIdStr, seenAt: new Date() }],
  });

  const populated = await MediaMessage.findById(message._id)
    .populate('authorId', 'name email role jobRole')
    .populate({
      path: 'replyToId',
      select: 'text authorId timeSeconds',
      populate: { path: 'authorId', select: 'name role' },
    });

  // Notification: new message to "the other side"
  if (isOwner) {
    // Shooter posted -> notify creative_head
    const creativeHeads = await User.find({ role: 'creative_head', status: 'active' });
    for (const ch of creativeHeads) {
      await createNotification({
        recipient: ch._id,
        type: 'new_message',
        title: 'New message on clip',
        message: `${user.name || 'Shooter'} commented on "${clip.title}"`,
        link: `/feedback?workItemId=${workItem._id}&clipId=${clip._id}`,
      });
    }
  } else {
    // Reviewer posted -> notify shooter (step owner)
    if (workItem.ownerId) {
      await createNotification({
        recipient: workItem.ownerId,
        type: 'new_message',
        title: 'New feedback on clip',
        message: `${user.name || 'Creative Head'} commented on "${clip.title}"`,
        link: `/work/${workItem._id}?clipId=${clip._id}`,
      });
    }
  }

  return populated;
}

/**
 * 8. List messages for a clip
 * Permissions: owner, creative_head, admin, sm_manager, executive.
 */
export async function listMessages(clipId, user) {
  const clip = await MediaItem.findById(clipId);
  if (!clip) {
    const error = new Error('Clip not found');
    error.statusCode = 404;
    throw error;
  }

  const workItem = await WorkItem.findById(clip.stageItemId);
  if (!workItem) {
    const error = new Error('Stage item not found');
    error.statusCode = 404;
    throw error;
  }

  if (!canSeePrivateReview(user, workItem)) {
    const error = new Error('You do not have access to view this message thread');
    error.statusCode = 403;
    error.code = 'FORBIDDEN_ACTION';
    throw error;
  }

  const messages = await MediaMessage.find({ mediaItemId: clip._id })
    .populate('authorId', 'name email role jobRole')
    .populate({
      path: 'replyToId',
      select: 'text authorId timeSeconds',
      populate: { path: 'authorId', select: 'name role' },
    })
    .populate('doneById', 'name email role')
    .sort({ createdAt: 1 });

  return messages;
}

/**
 * 9. Mark messages seen for a clip
 */
export async function markMessagesSeen(clipId, user) {
  const userIdStr = (user.userId || user._id || user.id)?.toString();
  if (!userIdStr) return { success: true };

  // Only someone who can read the thread can mark it seen.
  const clip = await MediaItem.findById(clipId).select('stageItemId').lean();
  const workItem = clip ? await WorkItem.findById(clip.stageItemId).select('ownerId').lean() : null;
  if (!clip || !workItem) {
    const error = new Error('Clip not found');
    error.statusCode = 404;
    throw error;
  }
  if (!canSeePrivateReview(user, workItem)) {
    const error = new Error('You do not have access to view this message thread');
    error.statusCode = 403;
    error.code = 'FORBIDDEN_ACTION';
    throw error;
  }

  await MediaMessage.updateMany(
    {
      mediaItemId: clipId,
      'seenBy.userId': { $ne: userIdStr },
    },
    {
      $push: {
        seenBy: {
          userId: userIdStr,
          seenAt: new Date(),
        },
      },
    }
  );

  return { success: true };
}

/**
 * 10. Mark done / reopen on feedback message
 * Reviewers can reopen; owner/reviewers can mark done.
 */
export async function toggleMessageDone(clipId, messageId, done, user) {
  const message = await MediaMessage.findOne({ _id: messageId, mediaItemId: clipId });
  if (!message) {
    const error = new Error('Message not found');
    error.statusCode = 404;
    throw error;
  }

  const clip = await MediaItem.findById(clipId);
  const workItem = await WorkItem.findById(clip.stageItemId);
  const userIdStr = (user.userId || user._id || user.id)?.toString();
  const ownerIdStr = (workItem.ownerId?._id || workItem.ownerId)?.toString();
  const isOwner = Boolean(userIdStr && ownerIdStr && userIdStr === ownerIdStr);
  const isReviewer = user.role === 'creative_head' || user.role === 'admin';

  if (done === false) {
    // Reopening is restricted to reviewers
    if (!isReviewer) {
      const error = new Error('Only reviewers can reopen resolved feedback');
      error.statusCode = 403;
      error.code = 'FORBIDDEN_ACTION';
      throw error;
    }
    message.doneAt = null;
    message.doneById = null;
  } else {
    // Marking done allowed for owner and reviewer
    if (!isOwner && !isReviewer) {
      const error = new Error('You do not have permission to mark this feedback as done');
      error.statusCode = 403;
      error.code = 'FORBIDDEN_ACTION';
      throw error;
    }
    message.doneAt = new Date();
    message.doneById = userIdStr;
  }

  await message.save();
  return message;
}

/**
 * 11. Review clip (creative_head and admin)
 * Approve clip, or Reshoot needed (a message is required).
 */
export async function reviewClip(clipId, { action, message }, user) {
  if (user.role !== 'creative_head' && user.role !== 'admin') {
    const error = new Error('Only Creative Head or Admin can review clips');
    error.statusCode = 403;
    error.code = 'FORBIDDEN_ACTION';
    throw error;
  }

  const clip = await MediaItem.findById(clipId);
  if (!clip) {
    const error = new Error('Clip not found');
    error.statusCode = 404;
    throw error;
  }

  const workItem = await WorkItem.findById(clip.stageItemId);
  if (!workItem) {
    const error = new Error('Stage item not found');
    error.statusCode = 404;
    throw error;
  }

  const userIdStr = (user.userId || user._id || user.id)?.toString();

  if (action === 'reshoot_needed') {
    if (!message || !message.trim()) {
      const error = new Error('A feedback message is required when requesting a reshoot');
      error.statusCode = 400;
      error.code = 'FEEDBACK_MESSAGE_REQUIRED';
      throw error;
    }

    const cleanMsg = sanitizePlainText(message);

    // Create feedback message in thread
    await MediaMessage.create({
      mediaItemId: clip._id,
      authorId: userIdStr,
      text: cleanMsg,
      seenBy: [{ userId: userIdStr, seenAt: new Date() }],
    });

    clip.status = 'reshoot_needed';
    clip.decidedById = userIdStr;
    clip.decidedAt = new Date();
    await clip.save();

    // Notify shooter
    if (workItem.ownerId) {
      await createNotification({
        recipient: workItem.ownerId,
        type: 'clip_decision',
        title: 'Reshoot needed',
        message: `Reshoot needed for clip "${clip.title}": ${cleanMsg.substring(0, 100)}`,
        link: `/work/${workItem._id}?clipId=${clip._id}`,
      });
    }
  } else if (action === 'approve') {
    clip.status = 'approved';
    clip.decidedById = userIdStr;
    clip.decidedAt = new Date();

    if (message && message.trim()) {
      const cleanMsg = sanitizePlainText(message);
      await MediaMessage.create({
        mediaItemId: clip._id,
        authorId: userIdStr,
        text: cleanMsg,
        seenBy: [{ userId: userIdStr, seenAt: new Date() }],
      });
    }

    await clip.save();

    // Notify shooter
    if (workItem.ownerId) {
      await createNotification({
        recipient: workItem.ownerId,
        type: 'clip_decision',
        title: 'Clip approved',
        message: `Clip "${clip.title}" was approved`,
        link: `/work/${workItem._id}?clipId=${clip._id}`,
      });
    }
  } else {
    const error = new Error(`Invalid review action: ${action}`);
    error.statusCode = 400;
    throw error;
  }

  return clip;
}

/**
 * 12. Submit clips for approval
 * Requires >= 1 clip, none uploading, and after revision every flagged clip must have a replacement or new clip.
 */
export async function submitClipsForApproval(stageItemId, user) {
  const workItem = await WorkItem.findById(stageItemId);
  if (!workItem) {
    const error = new Error('Stage item not found');
    error.statusCode = 404;
    throw error;
  }

  const userIdStr = (user.userId || user._id || user.id)?.toString();
  const ownerIdStr = (workItem.ownerId?._id || workItem.ownerId)?.toString();
  const isOwner = Boolean(userIdStr && ownerIdStr && userIdStr === ownerIdStr);

  if (!isOwner && user.role !== 'admin') {
    const error = new Error('Only the step owner can submit clips for approval');
    error.statusCode = 403;
    error.code = 'FORBIDDEN_ACTION';
    throw error;
  }

  const allClips = await MediaItem.find({ stageItemId });

  // 1. Requires at least one clip
  if (allClips.length === 0) {
    const error = new Error('At least one clip is required to submit for approval');
    error.statusCode = 400;
    error.code = 'NO_CLIPS';
    throw error;
  }

  // 2. No clip still uploading
  const isUploading = allClips.some((c) => c.status === 'uploading');
  if (isUploading) {
    const error = new Error('Wait for all uploads to complete before submitting');
    error.statusCode = 400;
    error.code = 'UPLOADS_IN_PROGRESS';
    throw error;
  }

  // 3. After a revision: every flagged clip must have a replaced or new clip
  const flaggedClips = allClips.filter((c) => c.status === 'reshoot_needed');
  if (flaggedClips.length > 0) {
    for (const flagged of flaggedClips) {
      const hasReplacement = allClips.some(
        (c) => c.replacesId && c.replacesId.toString() === flagged._id.toString()
      );
      if (!hasReplacement) {
        const error = new Error(
          `Flagged clip "${flagged.title}" must be replaced before resubmitting`
        );
        error.statusCode = 400;
        error.code = 'FLAGGED_CLIPS_NOT_REPLACED';
        throw error;
      }
    }
  }

  // Move uploaded and replaced clips to waiting_review
  await MediaItem.updateMany(
    { stageItemId: workItem._id, status: { $in: ['uploaded'] } },
    { $set: { status: 'waiting_review' } }
  );

  // Reuse existing Submission model
  const { Submission } = await import('../submissions/model.js');
  const latestSub = await Submission.findOne({ workItemId: workItem._id }).sort({ version: -1 });
  const nextVersion = (latestSub?.version || 0) + 1;

  const clipFiles = allClips.map((c) => ({
    name: c.title,
    url: c.url,
    sizeBytes: c.sizeBytes || 0,
    mimeType: c.kind === 'video' ? 'video/mp4' : 'image/png',
    width: c.width || 0,
    height: c.height || 0,
    durationSeconds: c.durationSeconds || 0,
  }));

  const submission = await Submission.create({
    workItemId: workItem._id,
    contentPieceId: workItem.contentPieceId,
    authorId: workItem.ownerId || user.userId || user.id,
    kind: 'video',
    deliverableType: 'video',
    version: nextVersion,
    status: 'submitted',
    submittedAt: new Date(),
    files: clipFiles,
    fileUrl: clipFiles[0]?.url,
    notes: 'Footage clips submitted for review',
    metadata: {
      totalClips: allClips.length,
      clipIds: allClips.map((c) => c._id),
    },
  });

  // Link clips to this submissionId
  await MediaItem.updateMany(
    { stageItemId: workItem._id },
    { $set: { submissionId: submission._id } }
  );

  // Update work item deliverableUrl so it's readily accessible across listings
  if (clipFiles[0]?.url) {
    await WorkItem.findByIdAndUpdate(workItem._id, { deliverableUrl: clipFiles[0].url });
  }

  // Transition step to Pending
  const { transitionWorkItem } = await import('../workItems/transition.service.js');
  const updatedWorkItem = await transitionWorkItem(
    workItem._id,
    { toStatus: 'Pending', notes: 'Footage clips submitted for Creative Head review' },
    user,
    { ownerSubmission: true }
  );

  // Notify Creative Head
  const creativeHeads = await User.find({ role: 'creative_head', status: 'active' });
  for (const ch of creativeHeads) {
    await createNotification({
      recipient: ch._id,
      type: 'submission_ready',
      title: 'Clips submitted for review',
      message: `${user.name || 'Shooter'} submitted clips for "${workItem.title}"`,
      link: `/feedback?workItemId=${workItem._id}`,
    });
  }

  return { success: true, workItem: updatedWorkItem, submission };
}

/**
 * 13. Finish review of shoot step (Creative Head / Admin)
 * If any clip is reshoot_needed -> step returns to In Progress for the owner to reshoot.
 * If all clips are approved -> approve step with 1 to 5 rating.
 * A step cannot be approved while a clip is waiting_review or reshoot_needed.
 */
export async function finishShootStepReview(stageItemId, reviewData, user) {
  const {
    assertDecisionAllowed,
    assertReviewer,
    assertValidRating,
    approveSubmission,
    claimSubmission,
    releaseSubmission,
    getRequiredClips,
  } = await import('../submissions/reviewDecision.js');

  const workItem = await WorkItem.findById(stageItemId);
  if (!workItem) {
    const error = new Error('Stage item not found');
    error.statusCode = 404;
    throw error;
  }

  assertReviewer(user, workItem);

  const { required, flagged: flaggedClips, undecided: undecidedClips } = await getRequiredClips(stageItemId);
  if (required.length === 0) {
    const error = new Error('No clips found for this step');
    error.statusCode = 400;
    throw error;
  }

  if (undecidedClips.length > 0) {
    const error = new Error('All clips must be reviewed before completing step review');
    error.statusCode = 400;
    error.code = 'CLIPS_WAITING_REVIEW';
    throw error;
  }

  const { transitionWorkItem } = await import('../workItems/transition.service.js');

  // Outcome 1: If any clip is reshoot_needed -> back to In Progress, like a normal revision
  if (flaggedClips.length > 0) {
    const submission = await assertDecisionAllowed({ user, workItem, decision: 'revision' });
    await claimSubmission(submission, 'changes_requested', user);

    let updatedWorkItem;
    try {
      updatedWorkItem = await transitionWorkItem(
        workItem._id,
        {
          toStatus: 'In Progress',
          comment:
            reviewData.note ||
            reviewData.feedback ||
            `${flaggedClips.length} clip(s) flagged for reshoot`,
        },
        user,
        { reviewDecision: true }
      );
    } catch (error) {
      await releaseSubmission(submission);
      throw error;
    }

    return {
      outcome: 'changes_requested',
      workItem: updatedWorkItem,
      flaggedCount: flaggedClips.length,
    };
  }

  // Outcome 2: All required clips are approved -> Approve step with rating
  const submission = await assertDecisionAllowed({ user, workItem, decision: 'approve' });
  const score = Number(reviewData.score);
  assertValidRating(score);

  const { workItem: updatedWorkItem } = await approveSubmission({
    submission,
    workItem,
    score,
    feedback: reviewData.feedback || '',
    tags: Array.isArray(reviewData.tags) ? reviewData.tags : [],
    user,
  });

  return {
    outcome: 'approved',
    workItem: updatedWorkItem,
  };
}
