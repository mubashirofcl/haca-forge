import mongoose from 'mongoose';

const calendarEntrySchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
      index: true,
    },
    platform: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    format: {
      type: String,
      required: true,
      trim: true,
    },
    theme: {
      type: String,
      required: true,
      trim: true,
    },
    campaign: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign',
    },
    captionBrief: {
      type: String,
      trim: true,
      default: '',
    },
    contentPillar: {
      type: String,
      trim: true,
      default: 'General',
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['draft', 'approved', 'converted'],
      default: 'draft',
      index: true,
    },
    importBatchId: {
      type: String,
      index: true,
    },
    linkedContentItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ContentItem',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

calendarEntrySchema.index({ date: 1, platform: 1 });

export const CalendarEntry = mongoose.model('CalendarEntry', calendarEntrySchema);
