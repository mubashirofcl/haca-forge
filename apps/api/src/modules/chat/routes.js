import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission, requireAnyPermission } from '../../middleware/requirePermission.js';
import * as chatController from './controller.js';
import { CHAT_UPLOAD_ROOT, requireChatUploadChannel } from './attachments.js';
import { CHAT_ATTACHMENT_CONFIG } from '@mmp/shared';

const rootUploads = CHAT_UPLOAD_ROOT;

if (!fs.existsSync(rootUploads)) {
  fs.mkdirSync(rootUploads, { recursive: true });
}

// Each upload gets its own random folder inside the channel's folder. The channel id
// was validated, and membership checked, by requireChatUploadChannel before this runs.
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const uuid = crypto.randomUUID();
    const dest = path.join(rootUploads, req.chatUploadChannelId, uuid);
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeBase = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 60) || 'file';
    cb(null, `${safeBase}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB max allowed (video cap)
    files: 5,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype.toLowerCase();

    const isImage =
      CHAT_ATTACHMENT_CONFIG.images.extensions.includes(ext) &&
      CHAT_ATTACHMENT_CONFIG.images.mimes.includes(mime);

    const isDoc =
      CHAT_ATTACHMENT_CONFIG.documents.extensions.includes(ext) &&
      (CHAT_ATTACHMENT_CONFIG.documents.mimes.includes(mime) || mime === 'text/plain');

    const isVideo =
      CHAT_ATTACHMENT_CONFIG.videos.extensions.includes(ext) &&
      CHAT_ATTACHMENT_CONFIG.videos.mimes.includes(mime);

    if (isImage || isDoc || isVideo) {
      cb(null, true);
    } else {
      const err = new Error(`File type "${ext}" (${mime}) is not allowed in team chat.`);
      err.statusCode = 400;
      err.code = 'FILE_TYPE_NOT_ALLOWED';
      cb(err);
    }
  },
});

export const chatRouter = Router();

// Authentication on all chat endpoints
chatRouter.use(authenticate);

// 1. Channel operations
chatRouter.get('/channels', requireAnyPermission(['chat.use', 'chat.read']), chatController.listChannels);
chatRouter.post('/channels/groups', requirePermission('chat.group.create'), chatController.createGroup);
chatRouter.post('/channels/dm', requirePermission('chat.use'), chatController.getOrCreateDM);
chatRouter.get('/channels/:channelId', requireAnyPermission(['chat.use', 'chat.read']), chatController.getChannel);
chatRouter.patch('/channels/:channelId', requirePermission('chat.group.create'), chatController.updateGroup);
chatRouter.post('/channels/:channelId/archive', requirePermission('chat.group.create'), chatController.archiveGroup);
chatRouter.post('/channels/:channelId/unarchive', requirePermission('chat.moderate'), chatController.unarchiveGroup);
chatRouter.post('/channels/:channelId/members', requirePermission('chat.group.create'), chatController.addGroupMembers);
chatRouter.delete('/channels/:channelId/members/:memberId', requirePermission('chat.use'), chatController.removeGroupMember);
chatRouter.post('/channels/:channelId/mute', requireAnyPermission(['chat.use', 'chat.read']), chatController.muteChannel);

// 2. Message operations
chatRouter.get('/channels/:channelId/messages', requireAnyPermission(['chat.use', 'chat.read']), chatController.listMessages);
chatRouter.post('/channels/:channelId/messages', requirePermission('chat.use'), chatController.sendMessage);
chatRouter.patch('/channels/:channelId/messages/:messageId', requirePermission('chat.use'), chatController.editMessage);
chatRouter.delete('/channels/:channelId/messages/:messageId', requirePermission('chat.use'), chatController.deleteMessage);
chatRouter.post('/channels/:channelId/messages/:messageId/reactions', requirePermission('chat.use'), chatController.toggleReaction);
chatRouter.post('/channels/:channelId/messages/:messageId/pin', requirePermission('chat.use'), chatController.togglePin);
chatRouter.post('/channels/:channelId/read', requireAnyPermission(['chat.use', 'chat.read']), chatController.markRead);

// 3. Sharing operations
chatRouter.post('/share', requirePermission('chat.use'), chatController.shareAsset);
chatRouter.post('/share/:grantId/revoke', requirePermission('chat.use'), chatController.revokeShare);
chatRouter.get('/shared-asset/:grantId', requireAnyPermission(['chat.use', 'chat.read']), chatController.getSharedAsset);

// 4. Search operations
chatRouter.get('/search', requireAnyPermission(['chat.use', 'chat.read']), chatController.searchMessages);

// 5. File upload
chatRouter.post('/upload', requirePermission('chat.use'), requireChatUploadChannel, upload.array('files', 5), (req, res) => {
  const files = req.files || [];
  const attachments = files.map((f) => {
    // Relative storage URL
    const relPath = path.relative(path.dirname(rootUploads), f.path).replace(/\\/g, '/');
    const storageUrl = `/uploads/${relPath}`;

    return {
      fileName: f.originalname,
      fileSize: f.size,
      mimeType: f.mimetype,
      storageUrl,
    };
  });

  res.status(201).json({ attachments });
});

