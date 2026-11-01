import MasterIssue from '../models/MasterIssue.js';
import Complaint from '../models/Complaint.js';
import CitizenUser from '../models/CitizenUser.js';
import CitizenNotification from '../models/CitizenNotification.js';
import ActivityLog, { recordActivity } from '../models/ActivityLog.js';
import { isDbConnected } from '../config/db.js';
import {
  supportMasterIssue,
  resolvePotentialDuplicate,
  hashCitizenIdentifier,
} from '../services/masterIssueService.js';
import { analyzeCivicHotspots } from '../services/hotspotService.js';
import { calculateDynamicPriority } from '../services/priorityScoringService.js';
import {
  calculateResolutionDeadline,
  evaluateSlaStatus,
  calculateAggregateSlaMetrics,
} from '../services/slaService.js';
import {
  DEMO_DEPARTMENTS,
  DEMO_OFFICERS,
  getOfficersByDepartment,
  findOfficerById,
} from '../data/officerDirectory.js';
import { validateStatusTransition } from '../utils/statusTransitions.js';
import { uploadBufferToCloudinary, isCloudinaryConfigured } from '../config/cloudinary.js';
import { compareResolutionEvidence } from '../services/geminiResolutionService.js';

/**
 * @route   GET /api/master-issues
 * @desc    Retrieve master issues with filtering, priority sorting, SLA evaluation, and pagination
 * @access  Public / Authority
 */
export const getMasterIssues = async (req, res, next) => {
  try {
    const {
      category,
      status,
      priorityLevel,
      department,
      search,
      sortBy = 'priority', // 'priority', 'date', 'support', 'deadline'
      page = 1,
      limit = 10,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    if (!isDbConnected()) {
      return res.status(200).json({
        success: true,
        data: [],
        pagination: { total: 0, page: pageNum, limit: limitNum, pages: 0 },
        message: 'Database unconnected',
      });
    }

    const filter = {};
    if (category && category !== 'All') {
      filter.category = category;
    }
    if (status && status !== 'All') {
      filter.status = status;
    }
    if (priorityLevel && priorityLevel !== 'All') {
      filter['priority.level'] = priorityLevel;
    }
    if (department && department !== 'All') {
      filter.$or = [
        { department },
        { assignedDepartment: department },
      ];
    }
    if (search && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { masterIssueId: { $regex: escaped, $options: 'i' } },
        { title: { $regex: escaped, $options: 'i' } },
        { 'location.address': { $regex: escaped, $options: 'i' } },
        { 'assignedOfficer.name': { $regex: escaped, $options: 'i' } },
      ];
    }

    let sortObj = { 'priority.score': -1, lastActivityAt: -1 };
    if (sortBy === 'date') {
      sortObj = { createdAt: -1 };
    } else if (sortBy === 'support') {
      sortObj = { citizenSupportCount: -1, supportingReportCount: -1 };
    } else if (sortBy === 'deadline') {
      sortObj = { resolutionDeadline: 1, 'priority.score': -1 };
    }

    const [total, rawIssues] = await Promise.all([
      MasterIssue.countDocuments(filter),
      MasterIssue.find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    // Enrich with SLA status indicators
    const enrichedIssues = rawIssues.map((issue) => ({
      ...issue,
      sla: evaluateSlaStatus(issue),
    }));

    return res.status(200).json({
      success: true,
      data: enrichedIssues,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/master-issues/:id
 * @desc    Retrieve single master issue with full associated complaints, SLA status, and evidence
 * @access  Public
 */
export const getMasterIssueById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isDbConnected()) {
      return res.status(404).json({ success: false, message: 'Database unconnected' });
    }

    const trimmedId = id ? id.trim() : '';
    const query = trimmedId.match(/^[0-9a-fA-F]{24}$/)
      ? { $or: [{ masterIssueId: trimmedId.toUpperCase() }, { _id: trimmedId }] }
      : { masterIssueId: trimmedId.toUpperCase() };

    const masterIssue = await MasterIssue.findOne(query).lean();

    if (!masterIssue) {
      return res.status(404).json({
        success: false,
        message: `Master issue with ID '${id}' not found`,
      });
    }

    // Fetch full details of all associated citizen complaints
    const associatedComplaints = await Complaint.find({
      complaintId: { $in: masterIssue.associatedComplaintIds || [] },
    })
      .sort({ createdAt: -1 })
      .lean();

    // Check citizen endorsement status
    const citizenIdentifier = req.query?.citizenId || req.headers['x-citizen-id'] || req.ip;
    const citizenHash = hashCitizenIdentifier(citizenIdentifier);
    let hasSupported = false;
    let hasVerified = false;

    if (citizenHash) {
      const docWithAuth = await MasterIssue.findById(masterIssue._id).select('+supportedBy').lean();
      if (docWithAuth && Array.isArray(docWithAuth.supportedBy)) {
        hasSupported = docWithAuth.supportedBy.includes(citizenHash);
      }

      if (masterIssue.verificationStatus?.responses) {
        hasVerified = masterIssue.verificationStatus.responses.some(
          (r) => r.citizenIdHash === citizenHash
        );
      }
    }

    // Evaluate SLA
    const sla = evaluateSlaStatus(masterIssue);

    // Enforce confidentiality filtering for citizens
    const isCitizen = req.query.isCitizen === 'true' || req.headers['x-view-mode'] === 'citizen';
    const sanitizedMasterIssue = { ...masterIssue };
    if (isCitizen) {
      sanitizedMasterIssue.internalNotes = [];
      delete sanitizedMasterIssue.supportedBy;
      if (sanitizedMasterIssue.assignedOfficer) {
        sanitizedMasterIssue.assignedOfficer = {
          id: sanitizedMasterIssue.assignedOfficer.id,
          name: sanitizedMasterIssue.assignedOfficer.name,
          role: sanitizedMasterIssue.assignedOfficer.role,
          department: sanitizedMasterIssue.assignedOfficer.department,
        };
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        ...sanitizedMasterIssue,
        associatedComplaints,
        hasSupported,
        hasVerified,
        sla,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/master-issues/officers
 * @desc    Retrieve directory of municipal departments and demo officers
 * @access  Public / Authority
 */
export const getDemoOfficersEndpoint = async (req, res) => {
  const { department } = req.query;
  const officers = getOfficersByDepartment(department);

  return res.status(200).json({
    success: true,
    data: {
      departments: DEMO_DEPARTMENTS,
      officers,
      disclaimer: 'Simulated demonstration directory for Municipal Dispatch verification testing.',
    },
  });
};

/**
 * @route   PATCH /api/master-issues/:id/assign
 * @desc    Assign master issue to department, responsible officer, and set SLA deadline
 * @access  Authority
 */
export const assignMasterIssueEndpoint = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      department,
      officerId,
      customDeadlineHours,
      assignedBy = 'Municipal Dispatcher',
    } = req.body;

    if (!isDbConnected()) {
      return res.status(404).json({ success: false, message: 'Database unconnected' });
    }

    const trimmedId = id ? id.trim() : '';
    const query = trimmedId.match(/^[0-9a-fA-F]{24}$/)
      ? { $or: [{ masterIssueId: trimmedId.toUpperCase() }, { _id: trimmedId }] }
      : { masterIssueId: trimmedId.toUpperCase() };

    const masterIssue = await MasterIssue.findOne(query);

    if (!masterIssue) {
      return res.status(404).json({ success: false, message: 'Master issue not found' });
    }

    // Lookup demo officer if provided
    let officerObj = null;
    if (officerId) {
      officerObj = findOfficerById(officerId);
      if (!officerObj && typeof req.body.officer === 'object') {
        officerObj = req.body.officer;
      }
    }

    const targetDept = department || officerObj?.department || masterIssue.assignedDepartment || 'Municipal Public Works';

    // Calculate resolution deadline deterministically based on priority
    const priorityLevel = masterIssue.priority?.level || 'Medium';
    const now = new Date();
    const resolutionDeadline = calculateResolutionDeadline(
      priorityLevel,
      now,
      customDeadlineHours ? Number(customDeadlineHours) : null
    );

    masterIssue.department = targetDept;
    masterIssue.assignedDepartment = targetDept;
    masterIssue.assignedAt = now;
    masterIssue.resolutionDeadline = resolutionDeadline;

    if (officerObj) {
      masterIssue.assignedOfficer = {
        id: officerObj.id || `OFF-${Date.now()}`,
        name: officerObj.name,
        role: officerObj.role || 'Field Engineer (Demo)',
        department: targetDept,
        email: officerObj.email || null,
        isDemoAccount: true,
      };
    }

    // Transition status to 'Assigned' if currently 'Pending' or 'Under Review'
    const oldStatus = masterIssue.status;
    let statusTransitionNote = '';
    if (['Pending', 'Under Review'].includes(oldStatus)) {
      masterIssue.status = 'Assigned';
      statusTransitionNote = `Status automatically transitioned to 'Assigned' upon departmental dispatch.`;
      masterIssue.statusHistory.push({
        fromStatus: oldStatus,
        toStatus: 'Assigned',
        changedAt: now,
        changedBy: assignedBy,
        note: `Dispatched to ${targetDept} (Officer: ${officerObj ? officerObj.name : 'Unspecified Field Unit'})`,
      });
    }

    masterIssue.lastActivityAt = now;
    await masterIssue.save();

    // Log Activity Timeline Events
    await recordActivity(masterIssue.masterIssueId, {
      eventType: 'DepartmentAssigned',
      description: `Assigned to ${targetDept}. Resolution target deadline established for ${resolutionDeadline.toLocaleString()}.`,
      actor: assignedBy,
      isInternal: false,
      metadata: { department: targetDept, resolutionDeadline },
    });

    if (officerObj) {
      await recordActivity(masterIssue.masterIssueId, {
        eventType: 'OfficerAssigned',
        description: `Field officer ${officerObj.name} (${officerObj.role}) designated as operational lead.`,
        actor: assignedBy,
        isInternal: false,
        metadata: { officer: officerObj },
      });
    }

    // Cascade assignment to all linked citizen complaints
    if (masterIssue.associatedComplaintIds?.length > 0) {
      await Complaint.updateMany(
        { complaintId: { $in: masterIssue.associatedComplaintIds } },
        {
          $set: {
            department: targetDept,
            ...(masterIssue.status === 'Assigned' ? { status: 'Assigned' } : {}),
          },
          ...(masterIssue.status === 'Assigned'
            ? {
                $push: {
                  statusHistory: {
                    fromStatus: oldStatus,
                    toStatus: 'Assigned',
                    changedAt: now,
                    changedBy: `${assignedBy} (via Master Issue ${masterIssue.masterIssueId})`,
                    note: `Assigned to ${targetDept}`,
                  },
                },
              }
            : {}),
        }
      );
    }

    const sla = evaluateSlaStatus(masterIssue);

    return res.status(200).json({
      success: true,
      message: `Master issue ${masterIssue.masterIssueId} successfully assigned to ${targetDept}.`,
      data: {
        ...masterIssue.toObject(),
        sla,
      },
      statusTransitionNote: statusTransitionNote || undefined,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/master-issues/:id/status
 * @desc    Update status of a master issue and cascade to linked complaints with validation
 * @access  Authority
 */
export const updateMasterIssueStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      status,
      note,
      rejectionReason,
      changedBy = 'Municipal Authority',
    } = req.body;

    if (!isDbConnected()) {
      return res.status(404).json({ success: false, message: 'Database unconnected' });
    }

    const trimmedId = id ? id.trim() : '';
    const query = trimmedId.match(/^[0-9a-fA-F]{24}$/)
      ? { $or: [{ masterIssueId: trimmedId.toUpperCase() }, { _id: trimmedId }] }
      : { masterIssueId: trimmedId.toUpperCase() };

    const masterIssue = await MasterIssue.findOne(query);

    if (!masterIssue) {
      return res.status(404).json({ success: false, message: 'Master issue not found' });
    }

    const oldStatus = masterIssue.status;

    // Validate lifecycle transition
    const check = validateStatusTransition(oldStatus, status);
    if (!check.allowed) {
      return res.status(400).json({
        success: false,
        message: check.reason,
        currentStatus: oldStatus,
        requestedStatus: status,
      });
    }

    // Require reason if rejecting
    if (status === 'Rejected' && (!rejectionReason || !rejectionReason.trim())) {
      return res.status(400).json({
        success: false,
        message: 'A specific rejection reason is required when rejecting a municipal issue.',
      });
    }

    const now = new Date();
    masterIssue.status = status;

    if (status === 'Rejected') {
      masterIssue.rejectionReason = rejectionReason.trim();
    } else if (status === 'Resolved') {
      masterIssue.resolvedAt = now;
      masterIssue.verificationStatus.status = 'Confirmed';
    } else if (oldStatus === 'Resolved' && status !== 'Resolved') {
      // Reopened issue
      masterIssue.resolvedAt = null;
    }

    masterIssue.statusHistory.push({
      fromStatus: oldStatus,
      toStatus: status,
      changedAt: now,
      changedBy,
      note: note || (status === 'Rejected' ? `Rejected: ${rejectionReason}` : `Status transitioned to ${status}`),
    });
    masterIssue.lastActivityAt = now;
    await masterIssue.save();

    // Log Activity Event
    await recordActivity(masterIssue.masterIssueId, {
      eventType: status === 'Resolved' ? 'IssueResolved' : status === 'Rejected' ? 'IssueRejected' : 'StatusChanged',
      description: note || `Status transitioned from '${oldStatus}' to '${status}' by ${changedBy}.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`,
      actor: changedBy,
      isInternal: false,
      metadata: { fromStatus: oldStatus, toStatus: status, rejectionReason },
    });

    // Cascade status to all associated complaints
    if (masterIssue.associatedComplaintIds?.length > 0) {
      await Complaint.updateMany(
        { complaintId: { $in: masterIssue.associatedComplaintIds } },
        {
          $set: { status },
          $push: {
            statusHistory: {
              fromStatus: oldStatus,
              toStatus: status,
              changedAt: now,
              changedBy: `${changedBy} (via Master Issue ${masterIssue.masterIssueId})`,
              note: note || `Updated via Master Issue ${masterIssue.masterIssueId}`,
            },
          },
        }
      );
    }

    // Notify citizens following this master issue or owning linked complaints
    try {
      const followers = await CitizenUser.find({ followedIssues: masterIssue.masterIssueId }).select('_id').lean();
      const linkedCitizenIds = [];

      if (masterIssue.associatedComplaintIds?.length > 0) {
        const linkedComplaints = await Complaint.find({
          complaintId: { $in: masterIssue.associatedComplaintIds },
          citizenUserId: { $ne: null },
        }).select('citizenUserId').lean();
        linkedComplaints.forEach((c) => {
          if (c.citizenUserId) linkedCitizenIds.push(c.citizenUserId.toString());
        });
      }

      const allRecipientIds = new Set([
        ...followers.map((f) => f._id.toString()),
        ...linkedCitizenIds,
      ]);

      if (allRecipientIds.size > 0) {
        const notifDocs = Array.from(allRecipientIds).map((uid) => ({
          citizenUserId: uid,
          title: `Civic Issue Update: ${status}`,
          message: `Civic issue #${masterIssue.masterIssueId} (${masterIssue.title || masterIssue.category}) transitioned to "${status}". ${note ? `Note: ${note}` : ''}`,
          type: 'followed_issue',
          masterIssueId: masterIssue.masterIssueId,
        }));
        await CitizenNotification.insertMany(notifDocs);
      }
    } catch {
      // Non-blocking notification dispatch
    }

    const sla = evaluateSlaStatus(masterIssue);

    return res.status(200).json({
      success: true,
      message: `Master issue and ${masterIssue.associatedComplaintIds.length} linked complaint(s) updated to '${status}'`,
      data: {
        ...masterIssue.toObject(),
        sla,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/master-issues/:id/notes
 * @desc    Add an internal administrative note (strictly confidential from citizens)
 * @access  Authority
 */
export const addMasterIssueNoteEndpoint = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { note, author = 'Municipal Operator' } = req.body;

    if (!note || !note.trim()) {
      return res.status(400).json({ success: false, message: 'Note text cannot be empty' });
    }

    if (!isDbConnected()) {
      return res.status(404).json({ success: false, message: 'Database unconnected' });
    }

    const trimmedId = id ? id.trim() : '';
    const query = trimmedId.match(/^[0-9a-fA-F]{24}$/)
      ? { $or: [{ masterIssueId: trimmedId.toUpperCase() }, { _id: trimmedId }] }
      : { masterIssueId: trimmedId.toUpperCase() };

    const masterIssue = await MasterIssue.findOne(query);

    if (!masterIssue) {
      return res.status(404).json({ success: false, message: 'Master issue not found' });
    }

    const noteEntry = {
      note: note.trim(),
      author: author.trim(),
      createdAt: new Date(),
      isInternal: true,
    };

    masterIssue.internalNotes.push(noteEntry);
    masterIssue.lastActivityAt = new Date();
    await masterIssue.save();

    // Log Internal Activity
    await recordActivity(masterIssue.masterIssueId, {
      eventType: 'InternalNoteAdded',
      description: `Internal administrative note added by ${author}: "${note.trim()}"`,
      actor: author,
      isInternal: true,
      metadata: { note: note.trim() },
    });

    return res.status(201).json({
      success: true,
      message: 'Internal note successfully appended.',
      data: masterIssue.internalNotes,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/master-issues/:id/resolution-evidence
 * @desc    Upload completion evidence photographs and work description
 * @access  Authority
 */
export const uploadResolutionEvidenceEndpoint = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      description,
      resolutionDescription,
      uploadedBy = 'Municipal Field Officer',
      photoUrls,
      evidenceUrl,
      caption,
    } = req.body;

    const finalDescription = (description || resolutionDescription || '').trim();

    if (!isDbConnected()) {
      return res.status(404).json({ success: false, message: 'Database unconnected' });
    }

    const trimmedId = id ? id.trim() : '';
    const query = trimmedId.match(/^[0-9a-fA-F]{24}$/)
      ? { $or: [{ masterIssueId: trimmedId.toUpperCase() }, { _id: trimmedId }] }
      : { masterIssueId: trimmedId.toUpperCase() };

    const masterIssue = await MasterIssue.findOne(query);

    if (!masterIssue) {
      return res.status(404).json({ success: false, message: 'Master issue not found' });
    }

    const uploadedEvidence = [];

    // Process files uploaded via Multer
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        if (isCloudinaryConfigured()) {
          const result = await uploadBufferToCloudinary(file.buffer, {
            folder: 'civicpulse/resolution-evidence',
          });
          if (result.success && result.url) {
            uploadedEvidence.push({
              url: result.url,
              publicId: result.publicId,
              caption: caption || 'Field completion verification photograph',
              uploadedAt: new Date(),
              uploadedBy,
            });
          }
        } else {
          // Simulation fallback when storage credentials pending in dev
          uploadedEvidence.push({
            url: `https://res.cloudinary.com/demo/image/upload/sample_pothole_fixed.jpg`,
            publicId: null,
            caption: caption || 'Simulated resolution evidence (storage pending configuration)',
            uploadedAt: new Date(),
            uploadedBy,
          });
        }
      }
    } else if (evidenceUrl) {
      uploadedEvidence.push({
        url: evidenceUrl,
        caption: caption || 'Direct URL resolution evidence',
        uploadedAt: new Date(),
        uploadedBy,
      });
    } else if (photoUrls) {
      let urls = photoUrls;
      if (typeof photoUrls === 'string') {
        try { urls = JSON.parse(photoUrls); } catch (e) { urls = [photoUrls]; }
      }
      if (Array.isArray(urls)) {
        urls.forEach((url) => {
          if (url && typeof url === 'string') {
            uploadedEvidence.push({
              url,
              caption: caption || 'Direct URL resolution evidence',
              uploadedAt: new Date(),
              uploadedBy,
            });
          }
        });
      }
    }

    if (uploadedEvidence.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one resolution evidence photograph is required.',
      });
    }

    // Replace existing resolution evidence with the newly submitted evidence
    masterIssue.resolutionEvidence = uploadedEvidence;
    if (finalDescription) {
      masterIssue.resolutionDescription = finalDescription;
    }

    // Transition status to 'Resolution Submitted'
    const oldStatus = masterIssue.status;
    const now = new Date();
    masterIssue.status = 'Resolution Submitted';
    masterIssue.statusHistory.push({
      fromStatus: oldStatus,
      toStatus: 'Resolution Submitted',
      changedAt: now,
      changedBy: uploadedBy,
      note: description || `Uploaded ${uploadedEvidence.length} resolution evidence photograph(s)`,
    });

    // Reset verification status for community review
    masterIssue.verificationStatus = {
      status: 'Pending',
      confirmedCount: 0,
      disputedCount: 0,
      responses: [],
    };

    masterIssue.lastActivityAt = now;
    await masterIssue.save();

    // Log Activity Event
    await recordActivity(masterIssue.masterIssueId, {
      eventType: 'ResolutionSubmitted',
      description: `Field team uploaded ${uploadedEvidence.length} completion photo(s). Status moved to 'Resolution Submitted' for citizen verification.`,
      actor: uploadedBy,
      isInternal: false,
      metadata: {
        evidenceCount: uploadedEvidence.length,
        description: masterIssue.resolutionDescription,
      },
    });

    // Cascade status to linked complaints
    if (masterIssue.associatedComplaintIds?.length > 0) {
      await Complaint.updateMany(
        { complaintId: { $in: masterIssue.associatedComplaintIds } },
        {
          $set: { status: 'Resolution Submitted' },
          $push: {
            statusHistory: {
              fromStatus: oldStatus,
              toStatus: 'Resolution Submitted',
              changedAt: now,
              changedBy: `${uploadedBy} (via Master Issue ${masterIssue.masterIssueId})`,
              note: 'Resolution evidence uploaded; awaiting community verification',
            },
          },
        }
      );
    }

    // Trigger automated Gemini AI Before-and-After comparative analysis
    let aiAssessment = null;
    try {
      let beforeImageUrl = null;
      let intakeDesc = masterIssue.title;

      if (masterIssue.primaryComplaintId) {
        const primary = await Complaint.findOne({ complaintId: masterIssue.primaryComplaintId })
          .select('imageUrl description')
          .lean();
        if (primary) {
          beforeImageUrl = primary.imageUrl;
          if (primary.description) intakeDesc = primary.description;
        }
      }

      if (!beforeImageUrl && masterIssue.associatedComplaintIds?.length > 0) {
        const anyWithImg = await Complaint.findOne({
          complaintId: { $in: masterIssue.associatedComplaintIds },
          imageUrl: { $ne: null },
        })
          .select('imageUrl description')
          .lean();
        if (anyWithImg) {
          beforeImageUrl = anyWithImg.imageUrl;
          if (anyWithImg.description) intakeDesc = anyWithImg.description;
        }
      }

      const afterImageUrl = uploadedEvidence[0]?.url || null;
      const uploadedBuffer = req.files?.[0]?.buffer || null;
      const uploadedMime = req.files?.[0]?.mimetype || 'image/jpeg';

      const assessmentPromise = compareResolutionEvidence({
        beforeImageUrl,
        afterImageUrl,
        afterBuffer: uploadedBuffer,
        afterMimeType: uploadedMime,
        category: masterIssue.category,
        description: intakeDesc,
        workDescription: finalDescription,
      });

      aiAssessment = await Promise.race([
        assessmentPromise,
        new Promise((resolve) => setTimeout(() => resolve(null), 5000)),
      ]);

      if (aiAssessment) {
        masterIssue.aiResolutionAssessment = aiAssessment;
        await masterIssue.save();

        await recordActivity(masterIssue.masterIssueId, {
          eventType: 'AiResolutionAssessment',
          description: `AI Advisory Check: ${aiAssessment.summary} (${aiAssessment.repairQuality}, ${aiAssessment.confidenceScore}% confidence)`,
          actor: 'NagarMitra AI',
          isInternal: false,
          metadata: aiAssessment,
        });
      } else {
        assessmentPromise
          .then(async (bgAssessment) => {
            if (bgAssessment) {
              await MasterIssue.updateOne(
                { _id: masterIssue._id },
                { $set: { aiResolutionAssessment: bgAssessment } }
              );
              await recordActivity(masterIssue.masterIssueId, {
                eventType: 'AiResolutionAssessment',
                description: `AI Advisory Check: ${bgAssessment.summary} (${bgAssessment.repairQuality}, ${bgAssessment.confidenceScore}% confidence)`,
                actor: 'NagarMitra AI',
                isInternal: false,
                metadata: bgAssessment,
              });
            }
          })
          .catch((e) => console.warn('⚠️ [MasterIssue] BG AI resolution assessment error:', e.message));
      }
    } catch (aiErr) {
      console.warn('⚠️ [MasterIssue] AI resolution comparison error:', aiErr.message);
    }

    return res.status(200).json({
      success: true,
      message: `Resolution evidence uploaded successfully. Issue marked 'Resolution Submitted'.`,
      data: {
        masterIssueId: masterIssue.masterIssueId,
        status: masterIssue.status,
        resolutionEvidence: masterIssue.resolutionEvidence,
        resolutionDescription: masterIssue.resolutionDescription,
        verificationStatus: masterIssue.verificationStatus,
        aiResolutionAssessment: masterIssue.aiResolutionAssessment || aiAssessment,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/master-issues/:id/assess-resolution
 * @desc    On-demand re-assessment or evaluation of resolution evidence using Gemini
 * @access  Public / Authority
 */
export const assessResolutionEndpoint = async (req, res, next) => {
  try {
    const { id } = req.params;
    const trimmedId = id ? id.trim() : '';
    const query = trimmedId.match(/^[0-9a-fA-F]{24}$/)
      ? { $or: [{ masterIssueId: trimmedId.toUpperCase() }, { _id: trimmedId }] }
      : { masterIssueId: trimmedId.toUpperCase() };

    const masterIssue = await MasterIssue.findOne(query);
    if (!masterIssue) {
      return res.status(404).json({ success: false, message: 'Master issue not found' });
    }

    if (!masterIssue.resolutionEvidence || masterIssue.resolutionEvidence.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No resolution evidence photograph is available on this issue to assess.',
      });
    }

    // Find intake photo
    let beforeImageUrl = null;
    let intakeDesc = masterIssue.title;

    if (masterIssue.primaryComplaintId) {
      const primary = await Complaint.findOne({ complaintId: masterIssue.primaryComplaintId })
        .select('imageUrl description')
        .lean();
      if (primary) {
        beforeImageUrl = primary.imageUrl;
        if (primary.description) intakeDesc = primary.description;
      }
    }

    if (!beforeImageUrl && masterIssue.associatedComplaintIds?.length > 0) {
      const anyWithImg = await Complaint.findOne({
        complaintId: { $in: masterIssue.associatedComplaintIds },
        imageUrl: { $ne: null },
      })
        .select('imageUrl description')
        .lean();
      if (anyWithImg) {
        beforeImageUrl = anyWithImg.imageUrl;
        if (anyWithImg.description) intakeDesc = anyWithImg.description;
      }
    }

    const afterImageUrl =
      masterIssue.resolutionEvidence[masterIssue.resolutionEvidence.length - 1]?.url ||
      masterIssue.resolutionEvidence[0]?.url ||
      null;

    const assessment = await compareResolutionEvidence({
      beforeImageUrl,
      afterImageUrl,
      category: masterIssue.category,
      description: intakeDesc,
      workDescription: masterIssue.resolutionDescription,
    });

    masterIssue.aiResolutionAssessment = assessment;
    await masterIssue.save();

    await recordActivity(masterIssue.masterIssueId, {
      eventType: 'AiResolutionAssessment',
      description: `Manual AI Advisory Check: ${assessment.summary} (${assessment.repairQuality}, ${assessment.confidenceScore}% confidence)`,
      actor: req.authority?.name || 'Municipal Supervisor',
      isInternal: false,
      metadata: assessment,
    });

    return res.status(200).json({
      success: true,
      message: 'AI before-and-after resolution assessment completed.',
      data: assessment,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/master-issues/:id/verify
 * @desc    Citizen confirmation or dispute of submitted resolution
 * @access  Public / Citizen
 */
export const verifyResolutionEndpoint = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { response, decision, comment = '', feedback = '' } = req.body;
    let voteResponse = (response || decision || '').trim();
    if (voteResponse === 'Resolved') voteResponse = 'Confirmed';
    if (voteResponse === 'Not Resolved') voteResponse = 'Disputed';
    const feedbackComment = comment || feedback;

    if (!['Confirmed', 'Disputed'].includes(voteResponse)) {
      return res.status(400).json({
        success: false,
        message: "Verification response must be either 'Confirmed' (Resolved) or 'Disputed' (Not Resolved).",
      });
    }

    if (!isDbConnected()) {
      return res.status(404).json({ success: false, message: 'Database unconnected' });
    }

    const trimmedId = id ? id.trim() : '';
    const query = trimmedId.match(/^[0-9a-fA-F]{24}$/)
      ? { $or: [{ masterIssueId: trimmedId.toUpperCase() }, { _id: trimmedId }] }
      : { masterIssueId: trimmedId.toUpperCase() };

    const masterIssue = await MasterIssue.findOne(query);

    if (!masterIssue) {
      return res.status(404).json({ success: false, message: 'Master issue not found' });
    }

    if (masterIssue.status !== 'Resolution Submitted' && masterIssue.status !== 'Resolved') {
      return res.status(400).json({
        success: false,
        message: `Verification is only allowed when resolution evidence is submitted. Current status: '${masterIssue.status}'`,
      });
    }

    // Anonymous duplicate vote prevention
    const citizenIdentifier =
      req.citizen?.citizenId?.toString() ||
      req.headers['x-citizen-id'] ||
      req.headers['x-forwarded-for'] ||
      req.body.citizenId ||
      req.ip;
    const citizenHash = hashCitizenIdentifier(citizenIdentifier);

    if (masterIssue.verificationStatus?.responses?.some((r) => r.citizenIdHash === citizenHash)) {
      return res.status(409).json({
        success: false,
        message: 'You have already submitted a verification vote for this resolution.',
      });
    }

    const now = new Date();
    const verificationEntry = {
      citizenIdHash: citizenHash,
      response: voteResponse,
      comment: feedbackComment.trim(),
      submittedAt: now,
    };

    masterIssue.verificationStatus.responses.push(verificationEntry);

    if (voteResponse === 'Confirmed') {
      masterIssue.verificationStatus.confirmedCount += 1;
    } else {
      masterIssue.verificationStatus.disputedCount += 1;
      masterIssue.verificationStatus.status = 'Disputed';
    }

    // Community consensus or dispute flag
    if (masterIssue.verificationStatus.disputedCount > masterIssue.verificationStatus.confirmedCount) {
      masterIssue.verificationStatus.status = 'Disputed';
    } else if (masterIssue.verificationStatus.confirmedCount >= 1 && masterIssue.verificationStatus.disputedCount === 0) {
      masterIssue.verificationStatus.status = 'Confirmed';
    }

    masterIssue.lastActivityAt = now;
    await masterIssue.save();

    // Log Activity
    await recordActivity(masterIssue.masterIssueId, {
      eventType: 'CitizenVerificationSubmitted',
      description: `Citizen submitted resolution feedback: ${voteResponse}.${feedbackComment ? ` Comment: "${feedbackComment.trim()}"` : ''}`,
      actor: 'Community Citizen',
      isInternal: false,
      metadata: { response: voteResponse, comment: feedbackComment.trim() },
    });

    return res.status(200).json({
      success: true,
      message: `Thank you. Your verification (${voteResponse}) has been recorded.`,
      data: masterIssue.verificationStatus,
      verificationStatus: masterIssue.verificationStatus,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/master-issues/:id/activity
 * @desc    Retrieve chronological audit activity timeline for a master issue
 * @access  Public
 */
export const getMasterIssueActivityEndpoint = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isCitizen = req.query.isCitizen === 'true' || req.headers['x-view-mode'] === 'citizen';

    if (!isDbConnected()) {
      return res.status(200).json({ success: true, data: [] });
    }

    const filter = {
      masterIssueId: id.trim().toUpperCase(),
    };

    // Protect authority confidentiality: filter internal notes from citizen view
    if (isCitizen) {
      filter.isInternal = false;
    }

    const activities = await ActivityLog.find(filter)
      .sort({ timestamp: -1 })
      .limit(50)
      .lean();

    return res.status(200).json({
      success: true,
      count: activities.length,
      data: activities,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/master-issues/analytics
 * @desc    Comprehensive municipal operations and SLA performance analytics
 * @access  Public / Authority
 */
export const getAuthorityAnalyticsEndpoint = async (req, res, next) => {
  try {
    if (!isDbConnected()) {
      return res.status(200).json({
        success: true,
        data: {
          totalMasterIssues: 0,
          awaitingAssignmentCount: 0,
          inProgressCount: 0,
          resolutionSubmittedCount: 0,
          resolvedCount: 0,
          slaMetrics: { complianceRate: 100, currentlyOverdueCount: 0 },
          departmentWorkload: [],
        },
      });
    }

    const allIssues = await MasterIssue.find().lean();
    const totalMasterIssues = allIssues.length;

    // Counts by status
    let awaitingAssignmentCount = 0;
    let inProgressCount = 0;
    let resolutionSubmittedCount = 0;
    let resolvedCount = 0;
    let rejectedCount = 0;

    allIssues.forEach((issue) => {
      if (['Pending', 'Under Review'].includes(issue.status)) {
        awaitingAssignmentCount++;
      } else if (issue.status === 'In Progress' || issue.status === 'Assigned') {
        inProgressCount++;
      } else if (issue.status === 'Resolution Submitted') {
        resolutionSubmittedCount++;
      } else if (issue.status === 'Resolved') {
        resolvedCount++;
      } else if (issue.status === 'Rejected') {
        rejectedCount++;
      }
    });

    const unresolvedCount = totalMasterIssues - resolvedCount - rejectedCount;

    // Compute SLA metrics deterministically
    const slaMetrics = calculateAggregateSlaMetrics(allIssues);

    // Department Workload Aggregation
    const departmentWorkloadMap = {};
    DEMO_DEPARTMENTS.forEach((dept) => {
      departmentWorkloadMap[dept] = {
        department: dept,
        active: 0,
        resolved: 0,
        total: 0,
      };
    });

    allIssues.forEach((issue) => {
      const dept = issue.assignedDepartment || issue.department || 'Municipal Public Works';
      if (!departmentWorkloadMap[dept]) {
        departmentWorkloadMap[dept] = { department: dept, active: 0, resolved: 0, total: 0 };
      }
      departmentWorkloadMap[dept].total += 1;
      if (issue.status === 'Resolved') {
        departmentWorkloadMap[dept].resolved += 1;
      } else if (issue.status !== 'Rejected') {
        departmentWorkloadMap[dept].active += 1;
      }
    });

    const departmentWorkload = Object.values(departmentWorkloadMap);
    const departmentBreakdown = departmentWorkload.map((d) => ({
      ...d,
      inProgress: d.active,
      overdue: allIssues.filter(
        (m) =>
          (m.assignedDepartment === d.department || m.department === d.department) &&
          m.resolutionDeadline &&
          new Date(m.resolutionDeadline).getTime() < Date.now() &&
          m.status !== 'Resolved' &&
          m.status !== 'Rejected'
      ).length,
      complianceRate: slaMetrics.complianceRate,
    }));

    return res.status(200).json({
      success: true,
      data: {
        totalMasterIssues,
        totalIssues: totalMasterIssues,
        unresolvedCount,
        unresolved: unresolvedCount,
        awaitingAssignmentCount,
        awaitingAssignment: awaitingAssignmentCount,
        inProgressCount,
        inProgress: inProgressCount,
        resolutionSubmittedCount,
        resolvedCount,
        resolved: resolvedCount,
        rejectedCount,
        overdue: slaMetrics.currentlyOverdueCount,
        slaComplianceRate: slaMetrics.complianceRate,
        avgResolutionHours: slaMetrics.averageResolutionHours,
        slaMetrics,
        departmentWorkload,
        departmentBreakdown,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Citizen "I am also affected" endorsement
 */
export const supportMasterIssueEndpoint = async (req, res, next) => {
  try {
    const { id } = req.params;
    const citizenIdentifier =
      req.citizen?.citizenId?.toString() ||
      req.headers['x-citizen-id'] ||
      req.body.citizenId ||
      req.ip ||
      'anonymous-citizen';

    const result = await supportMasterIssue(id.toUpperCase(), citizenIdentifier);
    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

/**
 * Geographical hotspot analysis with clustering and trend calculation
 */
export const getCivicHotspotsEndpoint = async (req, res, next) => {
  try {
    const { radius = 400, days = 30 } = req.query;

    if (!isDbConnected()) {
      return res.status(200).json({
        success: true,
        data: { totalHotspots: 0, highIntensityCount: 0, timePeriod: `Last ${days} days`, hotspots: [] },
      });
    }

    const complaints = await Complaint.find({
      'location.latitude': { $ne: null },
      'location.longitude': { $ne: null },
      status: { $nin: ['Resolved', 'Rejected'] },
    })
      .select('complaintId category severity status location createdAt aiAnalysis')
      .lean();

    const analysis = analyzeCivicHotspots(complaints, {
      radiusMeters: Number(radius) || 400,
      days: Number(days) || 30,
    });

    return res.status(200).json(analysis);
  } catch (error) {
    next(error);
  }
};

/**
 * Priority and severity aggregated summary
 */
export const getPrioritySummaryEndpoint = async (req, res, next) => {
  try {
    if (!isDbConnected()) {
      return res.status(200).json({ success: true, data: {} });
    }

    const [totalMasterIssues, totalComplaints, criticalIssues, topIssues] = await Promise.all([
      MasterIssue.countDocuments(),
      Complaint.countDocuments(),
      MasterIssue.countDocuments({ 'priority.level': 'Critical' }),
      MasterIssue.find({ status: { $nin: ['Resolved', 'Rejected'] } })
        .sort({ 'priority.score': -1 })
        .limit(5)
        .lean(),
    ]);

    const priorityCounts = await MasterIssue.aggregate([
      { $group: { _id: '$priority.level', count: { $sum: 1 } } },
    ]);

    const byPriority = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    priorityCounts.forEach((item) => {
      if (item._id && byPriority[item._id] !== undefined) {
        byPriority[item._id] = item.count;
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        totalMasterIssues,
        totalComplaints,
        criticalIssues,
        byPriority,
        topIssues,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Resolve potential duplicate (Confirm or Dismiss)
 */
export const resolveDuplicateEndpoint = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { complaintId, action, reviewer } = req.body;

    if (!complaintId || !['Confirm', 'Dismiss'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Valid 'complaintId' and action ('Confirm' or 'Dismiss') are required",
      });
    }

    const result = await resolvePotentialDuplicate(
      id.toUpperCase(),
      complaintId,
      action,
      reviewer || 'Municipal Dispatcher'
    );

    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};
