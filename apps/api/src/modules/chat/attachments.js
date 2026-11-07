import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { CHAT_ATTACHMENT_CONFIG } from '@mmp/shared';
import { Channel } from './channel.model.js';
import { ChannelMember } from './channelMember.model.js';
import { Person } from '../people/model.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Chat files live at uploads/chat/<channelId>/<random id>/<file name>. */
export const CHAT_UPLOAD_ROOT = path.resolve(__dirname, '../../../uploads/chat');

const MIME_BY_EXT = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv',
  '.txt': 'text/plain',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
};

const ALLOWED_EXTS = new Set([
  ...CHAT_ATTACHMENT_CONFIG.images.extensions,
  ...CHAT_ATTACHMENT_CONFIG.documents.extensions,
  ...CHAT_ATTACHMENT_CONFIG.videos.extensions,
]);

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const NAME = '[A-Za-z0-9_-]{1,60}\\.[a-z0-9]{2,5}';

function fail(message, statusCode = 400, code = 'INVALID_ATTACHMENT') {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

/**
 * The upload's channel: a real id the user may post to. Checked before any file is written,
 * so a bad or foreign channel never creates a folder.
 */
export async function requireChatUploadChannel(req, _res, next) {
  try {
    const channelId = String(req.query.channelId || '');
    if (!mongoose.isValidObjectId(channelId) || String(new mongoose.Types.ObjectId(channelId)) !== channelId) {
      throw fail('A valid channelId is required.', 400, 'INVALID_CHANNEL_ID');
    }
    const channel = await Channel.findById(channelId).select('type isArchived').lean();
    if (!channel) throw fail('Channel not found.', 404, 'NOT_FOUND');
    if (channel.isArchived) throw fail('Cannot upload to an archived channel.', 400, 'CHANNEL_ARCHIVED');
    const userId = req.user.userId;
    const allowed = channel.type === 'team'
      ? Boolean(await Person.exists({ _id: userId, status: 'active' }))
      : Boolean(await ChannelMember.exists({ channelId, userId }));
    if (!allowed) throw fail('You are not a member of this channel.', 403, 'FORBIDDEN');
    req.chatUploadChannelId = channelId;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * A message's attachments, built from the files on disk. The client only says which
 * uploaded file it means; name, size and type come from the server, and the file must
 * be one uploaded to this channel.
 */
export function buildChatAttachments(channelId, attachments = []) {
  const pattern = new RegExp(`^/uploads/chat/${String(channelId)}/(${UUID})/(${NAME})$`);
  return (attachments || []).map((att) => {
    const match = pattern.exec(String(att?.storageUrl || ''));
    if (!match) throw fail('Attachments must be files uploaded to this channel.');
    const ext = path.extname(match[2]).toLowerCase();
    if (!ALLOWED_EXTS.has(ext)) throw fail('This attachment type is not allowed.');
    const filePath = path.join(CHAT_UPLOAD_ROOT, String(channelId), match[1], match[2]);
    let stat;
    try {
      stat = fs.statSync(filePath);
    } catch {
      throw fail('Attachment file not found. Upload it again.');
    }
    if (!stat.isFile()) throw fail('Attachment file not found. Upload it again.');
    return {
      fileName: match[2],
      fileSize: stat.size,
      mimeType: MIME_BY_EXT[ext],
      storageUrl: att.storageUrl,
    };
  });
}
