import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const citizenUserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [2, 'Full name must be at least 2 characters'],
      maxlength: [100, 'Full name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
      index: true,
    },
    phone: {
      type: String,
      required: [true, 'Mobile number is required'],
      unique: true,
      trim: true,
      match: [/^\+?[0-9]{7,15}$/, 'Please enter a valid mobile number'],
      index: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
    },
    followedIssues: {
      type: [String],
      default: [],
    },
    avatarUrl: {
      type: String,
      default: null,
    },
    preferredLanguage: {
      type: String,
      default: 'en',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Method to verify candidate password
citizenUserSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.passwordHash || !candidatePassword) return false;
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

export const CitizenUser = mongoose.model('CitizenUser', citizenUserSchema);
export default CitizenUser;
