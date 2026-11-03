import mongoose from 'mongoose';

const profileSchema = new mongoose.Schema(
  {
    name: { type: String, default: 'HACA' },
    code: { type: String, default: 'haca' },
    active: { type: Boolean, default: true },
    status: { type: String, default: 'active' },
    createdAt: { type: Date, default: Date.now },
  },
  { strict: false }
);

export const Profile =
  mongoose.models.Profile || mongoose.model('Profile', profileSchema);

