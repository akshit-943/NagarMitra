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
const VALID_PRIORITY_LEVELS = ['Low', 'Medium', 'High', 'Critical'];

const potentialDuplicateSchema = new mongoose.Schema(
  {
    complaintId: {
      type: String,
      required: true,
      trim: true,
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    matchReason: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['Pending', 'Confirmed', 'Dismissed'],
      default: 'Pending',
    },
    flaggedAt: {
      type: Date,
      default: Date.now,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewedBy: {
      type: String,
      default: null,
    },
  },
  { _id: false }
);

const locationSchema = new mongoose.Schema(
  {
    address: {
      type: String,
      required: true,
      trim: true,
    },
    latitude: {
      type: Number,
      default: null,
    },
    longitude: {
      type: Number,
      default: null,
    },
    zone: {
      type: String,
      default: 'General Urban Zone',
      trim: true,
    },
    locationType: {
      type: String,
      default: 'Unverified / Neutral',
      trim: true,
    },
    importanceScore: {
      type: Number,
      default: 50,
      min: 0,
      max: 100,
    },
    importanceReason: {
      type: String,
      default: 'Standard municipal roadway / unverified landmark',
    },
  },
  { _id: false }
);

const priorityBreakdownSchema = new mongoose.Schema(
  {
    severityScore: { type: Number, default: 50, min: 0, max: 100 },
    safetyScore: { type: Number, default: 50, min: 0, max: 100 },
    collectiveScore: { type: Number, default: 30, min: 0, max: 100 },
    locationScore: { type: Number, default: 50, min: 0, max: 100 },
  },
  { _id: false }
);

const prioritySchema = new mongoose.Schema(
  {
    score: {
      type: Number,
      required: true,
      default: 50,
      min: 0,
      max: 100,
    },
    level: {
      type: String,
      enum: VALID_PRIORITY_LEVELS,
      default: 'Medium',
    },
    breakdown: {
      type: priorityBreakdownSchema,
      default: () => ({}),
    },
    explanation: {
      type: String,
      default: '',
    },
    lastCalculatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const masterIssueSchema = new mongoose.Schema(
  {
    masterIssueId: {
      type: String,
      required: [true, 'Master Issue ID is required'],
      unique: true,
      index: true,
      trim: true,
      uppercase: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: 200,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      index: true,
    },
    primaryComplaintId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    associatedComplaintIds: {
      type: [String],
      default: [],
      index: true,
    },
    potentialDuplicates: {
      type: [potentialDuplicateSchema],
      default: [],
    },
    location: {
      type: locationSchema,
      required: true,
    },
    aiSeverity: {
      score: { type: Number, default: 50, min: 0, max: 100 },
      level: { type: String, default: 'Medium' },
    },
    safetyRisk: {
      level: { type: String, default: 'Medium' },
      score: { type: Number, default: 50 },
      description: { type: String, default: 'Standard municipal hazard assessment.' },
      affectedGroups: { type: [String], default: ['General Public'] },
    },
    supportingReportCount: {
      type: Number,
      default: 1,
      min: 1,
    },
    citizenSupportCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    supportedBy: {
      type: [String], // Hash of user ID, IP, or session token to prevent duplicate upvotes
      default: [],
      select: false, // Don't expose privacy hashes in default queries
    },
    priority: {
      type: prioritySchema,
      default: () => ({}),
    },
    department: {
      type: String,
      default: 'Municipal Public Works',
      trim: true,
      index: true,
    },
    assignedDepartment: {
      type: String,
      default: 'Municipal Public Works',
      trim: true,
      index: true,
    },
    assignedOfficer: {
      id: { type: String, default: null },
      name: { type: String, default: null },
      role: { type: String, default: null },
      department: { type: String, default: null },
      email: { type: String, default: null },
      isDemoAccount: { type: Boolean, default: true },
    },
    assignedAt: {
      type: Date,
      default: null,
      index: true,
    },
    resolutionDeadline: {
      type: Date,
      default: null,
      index: true,
    },
    resolvedAt: {
      type: Date,
      default: null,
      index: true,
    },
    resolutionEvidence: [
      {
        url: { type: String, required: true },
        publicId: { type: String, default: null },
        caption: { type: String, default: 'Work completion photo evidence' },
        uploadedAt: { type: Date, default: Date.now },
        uploadedBy: { type: String, default: 'Municipal Officer' },
      },
    ],
    resolutionDescription: {
      type: String,
      default: '',
      trim: true,
    },
    verificationStatus: {
      status: {
        type: String,
        enum: ['Pending', 'Confirmed', 'Disputed'],
        default: 'Pending',
      },
      confirmedCount: { type: Number, default: 0 },
      disputedCount: { type: Number, default: 0 },
      responses: [
        {
          citizenIdHash: { type: String, required: true },
          response: { type: String, enum: ['Confirmed', 'Disputed'], required: true },
          comment: { type: String, default: '' },
          submittedAt: { type: Date, default: Date.now },
        },
      ],
    },
    aiResolutionAssessment: {
      status: {
        type: String,
        enum: ['Pending', 'Completed', 'Failed', 'Skipped', 'NoImages'],
        default: 'Pending',
      },
      appearsFixed: { type: Boolean, default: null },
      confidenceScore: { type: Number, default: null },
      repairQuality: {
        type: String,
        enum: ['Satisfactory', 'Partial', 'Inadequate', 'Inconclusive', null],
        default: null,
      },
      summary: { type: String, default: '' },
      observations: { type: [String], default: [] },
      assessedAt: { type: Date, default: null },
      modelUsed: { type: String, default: null },
    },
    internalNotes: [
      {
        note: { type: String, required: true },
        author: { type: String, default: 'Municipal Authority' },
        createdAt: { type: Date, default: Date.now },
        isInternal: { type: Boolean, default: true },
      },
    ],
    rejectionReason: {
      type: String,
      default: null,
      trim: true,
    },
    status: {
      type: String,
      enum: VALID_STATUSES,
      default: 'Pending',
      index: true,
    },
    statusHistory: [
      {
        fromStatus: { type: String, default: null },
        toStatus: { type: String, required: true },
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: String, default: 'System' },
        note: { type: String, default: '' },
      },
    ],
    lastActivityAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Helpful compound indexes
masterIssueSchema.index({ category: 1, status: 1 });
masterIssueSchema.index({ assignedDepartment: 1, status: 1 });
masterIssueSchema.index({ 'location.zone': 1 });
masterIssueSchema.index({ 'priority.score': -1 });
masterIssueSchema.index({ 'location.latitude': 1, 'location.longitude': 1 });
masterIssueSchema.index({ createdAt: -1 });

export const MasterIssue = mongoose.model('MasterIssue', masterIssueSchema);
export default MasterIssue;
