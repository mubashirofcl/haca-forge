import mongoose from 'mongoose';

const shareGrantSchema = new mongoose.Schema(
  {
    channelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Channel',
      required: true,
      index: true,
    },
    channel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Channel',
      default: null,
    },
    assetId: {
      type: String,
      required: true,
      index: true,
    },
    mediaItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MediaItem',
      default: null,
    },
    message: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChatMessage',
      default: null,
    },
    assetType: {
      type: String,
      enum: ['clip', 'finalCut', 'designImages', 'designPdf', 'document', 'submission'],
      required: true,
    },
    contentPieceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ContentPiece',
      required: true,
      index: true,
    },
    stageKey: {
      type: String,
      required: true,
    },
    sharedById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      required: true,
    },
    grantedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      default: null,
    },
    sharedAt: {
      type: Date,
      default: Date.now,
    },
    isRevoked: {
      type: Boolean,
      default: false,
      index: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    revokedById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

shareGrantSchema.index({ channelId: 1, assetId: 1 });

export const ShareGrant = mongoose.model('ShareGrant', shareGrantSchema);

