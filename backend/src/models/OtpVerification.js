import mongoose from 'mongoose';

const otpVerificationSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: [true, 'Mobile number is required'],
      trim: true,
      index: true,
    },
    otpHash: {
      type: String,
      required: true,
    },
    salt: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // MongoDB TTL auto-cleanup upon expiration
    },
    attempts: {
      type: Number,
      default: 0,
    },
    verified: {
      type: Boolean,
      default: false,
      index: true,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    verificationToken: {
      type: String,
      default: null,
      index: true,
    },
    consumed: {
      type: Boolean,
      default: false,
    },
    ip: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

otpVerificationSchema.index({ phone: 1, createdAt: -1 });

export const OtpVerification = mongoose.model('OtpVerification', otpVerificationSchema);
export default OtpVerification;
