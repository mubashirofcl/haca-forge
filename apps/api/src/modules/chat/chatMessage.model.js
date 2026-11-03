import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    mimeType: { type: String, required: true },
    storageUrl: { type: String, required: true },
    thumbnailUrl: { type: String },
    width: { type: Number },
    height: { type: Number },
    duration: { type: Number },
  },
  { _id: true }
);

const reactionSchema = new mongoose.Schema(
  {
    emoji: {
      type: String,
      enum: ['👍', '❤️', '😂', '🎉', '👀', '✅'],
      required: true,
    },
    userIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Person',
      },
    ],
  },
  { _id: false }
);

const sharedMediaSchema = new mongoose.Schema(
  {
    grantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ShareGrant', required: true },
    assetId: { type: String, required: true },
    assetType: {
      type: String,
      enum: ['clip', 'finalCut', 'designImages', 'designPdf', 'document'],
      required: true,
    },
    contentPieceId: { type: mongoose.Schema.Types.ObjectId, ref: 'ContentPiece', required: true },
    contentPieceTitle: { type: String, required: true },
    stageKey: { type: String, required: true },
    title: { type: String, required: true },
    thumbnailUrl: { type: String },
    previewUrl: { type: String },
    downloadUrl: { type: String },
    owner: {
      _id: { type: mongoose.Schema.Types.ObjectId, ref: 'Person' },
      name: { type: String },
      preferredName: { type: String },
      avatarUrl: { type: String },
    },
    note: { type: String, default: '' },
    isRevoked: { type: Boolean, default: false },
  },
  { _id: false }
);

const seenRecordSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', required: true },
    seenAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const chatMessageSchema = new mongoose.Schema(
  {
    channelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Channel',
      required: true,
      index: true,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      required: true,
      index: true,
    },
    kind: {
      type: String,
      enum: ['text', 'media_share'],
      default: 'text',
      index: true,
    },
    content: {
      type: String,
      maxlength: 4000,
      default: '',
    },
    replyToId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChatMessage',
      default: null,
      index: true,
    },
    attachments: [attachmentSchema],
    reactions: [reactionSchema],
    isPinned: {
      type: Boolean,
      default: false,
      index: true,
    },
    pinnedAt: {
      type: Date,
      default: null,
    },
    pinnedById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      default: null,
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    editedAt: {
      type: Date,
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      default: null,
    },
    sharedMedia: {
      type: sharedMediaSchema,
      default: null,
    },
    seenBy: [seenRecordSchema],
  },
  {
    timestamps: true,
  }
);

chatMessageSchema.index({ channelId: 1, createdAt: -1 });

export const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

