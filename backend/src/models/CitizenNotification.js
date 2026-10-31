import mongoose from 'mongoose';

const citizenNotificationSchema = new mongoose.Schema(
  {
    citizenUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CitizenUser',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['status_change', 'assignment', 'resolution', 'followed_issue', 'announcement', 'claim', 'system'],
      default: 'status_change',
    },
    complaintId: {
      type: String,
      default: null,
      index: true,
    },
    masterIssueId: {
      type: String,
      default: null,
      index: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for querying user unread notifications efficiently
citizenNotificationSchema.index({ citizenUserId: 1, isRead: 1, createdAt: -1 });

export const CitizenNotification = mongoose.model('CitizenNotification', citizenNotificationSchema);
export default CitizenNotification;
