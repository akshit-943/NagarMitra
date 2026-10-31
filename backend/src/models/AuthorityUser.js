import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const VALID_ROLES = [
  'Municipal Administrator',
  'Department Officer',
  'Supervisor',
];

const authorityUserSchema = new mongoose.Schema(
  {
    authorityId: {
      type: String,
      required: [true, 'Authority ID is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
    },
    role: {
      type: String,
      enum: VALID_ROLES,
      default: 'Department Officer',
      index: true,
    },
    department: {
      type: String,
      default: 'Municipal Public Works',
      trim: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Method to verify password
authorityUserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

export const AuthorityUser = mongoose.model('AuthorityUser', authorityUserSchema);
export { VALID_ROLES };
export default AuthorityUser;
