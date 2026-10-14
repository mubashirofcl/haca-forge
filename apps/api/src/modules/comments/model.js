import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema(
  {
    entityType: {
      type: String,
      enum: ['request', 'content', 'task'],
      required: true,
      index: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    mentions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    attachments: [
      {
        type: String,
        trim: true,
      },
    ],
  },
  { timestamps: true }
);

commentSchema.index({ entityType: 1, entityId: 1, createdAt: 1 });

export const Comment = mongoose.model('Comment', commentSchema);
