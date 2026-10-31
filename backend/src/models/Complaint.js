import mongoose from 'mongoose';

const VALID_STATUSES = [
  'Pending',
  'Under Review',
  'Assigned',
  'In Progress',
  'Resolution Submitted',
  'Resolved',
  'Rejected',
];
const VALID_SEVERITIES = ['Low', 'Medium', 'Moderate', 'High', 'Critical', null];
const VALID_ANALYSIS_STATUSES = ['Pending', 'Processing', 'Completed', 'Failed'];

const statusHistorySchema = new mongoose.Schema(
  {
    fromStatus: {
      type: String,
      enum: [...VALID_STATUSES, null],
      default: null,
    },
    toStatus: {
      type: String,
      required: true,
      enum: VALID_STATUSES,
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
    changedBy: {
      type: String,
      default: 'Citizen',
    },
    note: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { _id: false }
);

const locationSchema = new mongoose.Schema(
  {
    address: {
      type: String,
      required: [true, 'Location address is required'],
      trim: true,
    },
    latitude: {
      type: Number,
      default: null,
      min: -90,
      max: 90,
    },
    longitude: {
      type: Number,
      default: null,
      min: -180,
      max: 180,
    },
    locationSource: {
      type: String,
      enum: ['gps', 'geocoding', 'map_selection', 'manual'],
      default: 'manual',
    },
  },
  { _id: false }
);

const aiAnalysisSchema = new mongoose.Schema(
  {
    isCivicIssue: { type: Boolean, default: null },
    category: { type: String, default: null },
    detectedIssue: { type: String, default: null },
    severityScore: { type: Number, default: null },
    severityLevel: { type: String, default: null },
    confidence: { type: Number, default: null },
    safetyRisk: {
      level: { type: String, default: null },
      description: { type: String, default: null },
      affectedGroups: { type: [String], default: [] },
    },
    department: { type: String, default: null },
    recommendations: { type: [String], default: [] },
    reasoning: { type: String, default: null },
    requiresHumanReview: { type: Boolean, default: false },
    analysisStatus: {
      type: String,
      enum: VALID_ANALYSIS_STATUSES,
      default: 'Pending',
    },
    analyzedAt: { type: Date, default: null },
    modelUsed: { type: String, default: null },
    error: { type: String, default: null },
  },
  { _id: false }
);

const complaintSchema = new mongoose.Schema(
  {
    complaintId: {
      type: String,
      required: [true, 'Complaint ID is required'],
      unique: true,
      index: true,
      trim: true,
      uppercase: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters long'],
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    location: {
      type: locationSchema,
      required: [true, 'Location is required'],
    },
    imageUrl: {
      type: String,
      default: null,
      trim: true,
    },
    audioUrl: {
      type: String,
      default: null,
      trim: true,
    },
    severity: {
      type: String,
      enum: VALID_SEVERITIES,
      default: null,
    },
    status: {
      type: String,
      enum: VALID_STATUSES,
      default: 'Pending',
      index: true,
    },
    department: {
      type: String,
      default: 'Municipal Public Works',
      trim: true,
      index: true,
    },
    aiAnalysis: {
      type: aiAnalysisSchema,
      default: () => ({ analysisStatus: 'Pending' }),
    },
    duplicateGroupId: {
      type: String,
      default: null,
      index: true,
    },
    masterIssueId: {
      type: String,
      default: null,
      index: true,
      trim: true,
    },
    isMasterIssuePrimary: {
      type: Boolean,
      default: false,
    },
    duplicateAssessment: {
      isDuplicate: { type: Boolean, default: false },
      matchType: { type: String, enum: ['Strong', 'Possible', 'Unrelated', null], default: null },
      confidence: { type: Number, default: 0 },
      matchedWithId: { type: String, default: null },
      matchedMasterIssueId: { type: String, default: null },
      matchReason: { type: String, default: null },
      reviewedByHuman: { type: Boolean, default: false },
    },
    trackingToken: {
      type: String,
      default: null,
      index: true,
    },
    trackingTokenHash: {
      type: String,
      default: null,
    },
    citizenUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CitizenUser',
      default: null,
      index: true,
    },
    isGuestSubmission: {
      type: Boolean,
      default: true,
      index: true,
    },
    verifiedPhone: {
      type: String,
      default: null,
      trim: true,
    },
    statusHistory: {
      type: [statusHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for performant querying
complaintSchema.index({ category: 1, status: 1 });
complaintSchema.index({ createdAt: -1 });
complaintSchema.index({ status: 1, createdAt: -1 });
complaintSchema.index({ 'aiAnalysis.analysisStatus': 1 });

export const Complaint = mongoose.model('Complaint', complaintSchema);
export { VALID_STATUSES, VALID_SEVERITIES, VALID_ANALYSIS_STATUSES };
export default Complaint;
