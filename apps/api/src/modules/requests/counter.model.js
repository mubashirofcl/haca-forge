import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    seq: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export const Counter = mongoose.model('Counter', counterSchema);

/**
 * Atomically generates the next formatted sequence ID (e.g. MKT-2026-0001)
 * Uses findOneAndUpdate with $inc for high-concurrency safety.
 *
 * @param {string} prefix - Entity prefix (e.g., 'MKT', 'CNT', 'TSK')
 * @returns {Promise<string>} Next formatted identifier
 */
export async function getNextSequenceId(prefix = 'MKT') {
  const currentYear = new Date().getFullYear();
  const counterKey = `${prefix}-${currentYear}`;

  const counter = await Counter.findOneAndUpdate(
    { name: counterKey },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const paddedSeq = String(counter.seq).padStart(4, '0');
  return `${prefix}-${currentYear}-${paddedSeq}`;
}
