import mongoose from 'mongoose';

const channelSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['team', 'group', 'dm'],
      required: true,
      index: true,
    },
    name: {
      type: String,
      trim: true,
      maxlength: 40,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },
    systemSlug: {
      type: String,
      trim: true,
      index: true,
      sparse: true,
    },
    createdById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      default: null,
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    archivedById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      default: null,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastMessageSnippet: {
      type: String,
      maxlength: 300,
      default: '',
    },
    lastMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChatMessage',
      default: null,
    },
    profileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Profile',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

channelSchema.index({ type: 1, isArchived: 1, lastMessageAt: -1 });

export const Channel = mongoose.model('Channel', channelSchema);

