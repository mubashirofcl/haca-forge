import mongoose from 'mongoose';

const phoneVerificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      required: true,
      index: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    otp: {
      type: String,
      required: true,
    },
    token: {
      type: String,
      default: null,
      index: true,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: '10m' },
    },
  },
  { timestamps: true }
);

export const PhoneVerification = mongoose.model('PhoneVerification', phoneVerificationSchema);
export default PhoneVerification;

