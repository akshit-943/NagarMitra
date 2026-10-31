import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema(
  {
    masterIssueId: {
      type: String,
      required: true,
      index: true,
      trim: true,
      uppercase: true,
    },
    eventType: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    actor: {
      type: String,
      default: 'Municipal Operations',
      trim: true,
    },
    isInternal: {
      type: Boolean,
      default: false,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

activityLogSchema.index({ masterIssueId: 1, timestamp: -1 });

export const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

/**
 * Log an audit event for a master issue
 * @param {string} masterIssueId 
 * @param {Object} eventData 
 * @returns {Promise<Object>}
 */
export const recordActivity = async (
  masterIssueId,
  { eventType, description, actor = 'System', isInternal = false, metadata = {} }
) => {
  try {
    const entry = await ActivityLog.create({
      masterIssueId: masterIssueId.toUpperCase(),
      eventType,
      description,
      actor,
      isInternal,
      metadata,
      timestamp: new Date(),
    });
    return entry;
  } catch (err) {
    console.warn(`⚠️ [ActivityLog] Failed to record event '${eventType}':`, err.message);
    return null;
  }
};

export default ActivityLog;
