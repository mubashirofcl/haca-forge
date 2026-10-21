import mongoose from 'mongoose';

const departmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    code: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    type: {
      type: String,
      trim: true,
      index: true,
    },
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
    },
    description: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

departmentSchema.pre('save', function (next) {
  if (!this.code && this.type) {
    this.code = this.type;
  }
  if (!this.type && this.code) {
    this.type = this.code;
  }
  next();
});

export const Department = mongoose.models.Department || mongoose.model('Department', departmentSchema);
