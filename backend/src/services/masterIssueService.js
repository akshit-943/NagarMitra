import crypto from 'crypto';
import MasterIssue from '../models/MasterIssue.js';
import Complaint from '../models/Complaint.js';
import { isDbConnected } from '../config/db.js';
import { generateMasterIssueId } from '../utils/generateId.js';
import { findDuplicateMatch } from './duplicateDetectionService.js';
import { calculateDynamicPriority } from './priorityScoringService.js';
import { canonicalDepartment, getDepartmentForCategory } from '../utils/departmentHelper.js';

/**
 * Hash citizen identifier (e.g. IP + User-Agent or client token) for anonymous support tracking
 * @param {string} identifier 
 * @returns {string} SHA-256 hash string
 */
export const hashCitizenIdentifier = (identifier) => {
  if (!identifier) return null;
  return crypto.createHash('sha256').update(String(identifier).trim()).digest('hex');
};

/**
 * Synchronize a newly created or analyzed complaint with the MasterIssue intelligence engine.
 * 
 * - If Strong Match: Groups complaint with existing MasterIssue, increments supporting count, recalculates priority.
 * - If Possible Match: Flags complaint as potential duplicate under the MasterIssue for human review.
 * - If Unrelated: Creates a new MasterIssue for this incident.
 * 
 * @param {Object} complaint - Raw or Mongoose complaint document
 * @returns {Promise<Object>} Outcome { masterIssue, actionTaken, duplicateAssessment }
 */
export const syncComplaintToMasterIssue = async (complaint) => {
  if (!complaint || !complaint.complaintId) {
    return { actionTaken: 'None', error: 'Invalid complaint object' };
  }

  // 1. Fetch active (non-resolved, non-rejected) master issues
  let existingMasterIssues = [];
  if (isDbConnected()) {
    existingMasterIssues = await MasterIssue.find({
      status: { $nin: ['Resolved', 'Rejected'] },
    }).lean();
  }

  // 2. Run intelligent duplicate detection
  const matchResult = findDuplicateMatch(complaint, existingMasterIssues);

  // 3. Handle outcomes
  if (matchResult.hasMatch && matchResult.matchType === 'Strong') {
    // -------------------------------------------------------------
    // STRONG MATCH: Merge as supporting duplicate report
    // -------------------------------------------------------------
    const masterIssueId = matchResult.masterIssueId;

    if (isDbConnected()) {
      const masterIssue = await MasterIssue.findOne({ masterIssueId });

      if (masterIssue) {
        // Avoid duplicate entries in associatedComplaintIds
        if (!masterIssue.associatedComplaintIds.includes(complaint.complaintId)) {
          masterIssue.associatedComplaintIds.push(complaint.complaintId);
          masterIssue.supportingReportCount = masterIssue.associatedComplaintIds.length;
        }

        // Keep highest AI severity score
        const newSeverityScore = complaint.aiAnalysis?.severityScore || 50;
        if (newSeverityScore > (masterIssue.aiSeverity?.score || 0)) {
          masterIssue.aiSeverity = {
            score: newSeverityScore,
            level: complaint.aiAnalysis?.severityLevel || complaint.severity || 'Medium',
          };
        }

        // Recalculate dynamic priority
        const priorityAssessment = calculateDynamicPriority({
          severityScore: masterIssue.aiSeverity.score,
          safetyRisk: masterIssue.safetyRisk,
          supportingReportCount: masterIssue.supportingReportCount,
          citizenSupportCount: masterIssue.citizenSupportCount,
          address: masterIssue.location?.address,
        });

        masterIssue.priority = priorityAssessment;
        masterIssue.lastActivityAt = new Date();
        await masterIssue.save();

        // Update the individual complaint with master issue reference
        await Complaint.updateOne(
          { complaintId: complaint.complaintId },
          {
            $set: {
              masterIssueId: masterIssue.masterIssueId,
              duplicateGroupId: masterIssue.masterIssueId,
              isMasterIssuePrimary: false,
              duplicateAssessment: {
                isDuplicate: true,
                matchType: 'Strong',
                confidence: matchResult.confidence,
                matchedWithId: masterIssue.primaryComplaintId,
                matchedMasterIssueId: masterIssue.masterIssueId,
                matchReason: matchResult.matchReason,
                reviewedByHuman: false,
              },
            },
          }
        );

        return {
          actionTaken: 'MergedToExistingMasterIssue',
          masterIssue,
          duplicateAssessment: {
            isDuplicate: true,
            matchType: 'Strong',
            confidence: matchResult.confidence,
            masterIssueId: masterIssue.masterIssueId,
          },
        };
      }
    }
  } else if (matchResult.hasMatch && matchResult.matchType === 'Possible') {
    // -------------------------------------------------------------
    // POSSIBLE MATCH: Flag for municipal human verification
    // -------------------------------------------------------------
    const masterIssueId = matchResult.masterIssueId;

    if (isDbConnected()) {
      await MasterIssue.updateOne(
        { masterIssueId },
        {
          $push: {
            potentialDuplicates: {
              complaintId: complaint.complaintId,
              confidence: matchResult.confidence,
              matchReason: matchResult.matchReason,
              status: 'Pending',
              flaggedAt: new Date(),
            },
          },
          $set: { lastActivityAt: new Date() },
        }
      );

      // Create an independent MasterIssue for now, but flag for review
      const newMasterIssueId = generateMasterIssueId();
      const severityScore = complaint.aiAnalysis?.severityScore || 50;

      const priorityAssessment = calculateDynamicPriority({
        severityScore,
        safetyRisk: complaint.aiAnalysis?.safetyRisk || {},
        supportingReportCount: 1,
        citizenSupportCount: 0,
        address: complaint.location?.address || '',
      });

      const newMaster = await MasterIssue.create({
        masterIssueId: newMasterIssueId,
        title: complaint.aiAnalysis?.detectedIssue || `${complaint.category} incident at ${complaint.location?.address}`,
        category: complaint.category,
        primaryComplaintId: complaint.complaintId,
        associatedComplaintIds: [complaint.complaintId],
        potentialDuplicates: [],
        location: {
          address: complaint.location?.address || 'City Zone',
          latitude: complaint.location?.latitude ?? null,
          longitude: complaint.location?.longitude ?? null,
          coordinates: complaint.location?.latitude && complaint.location?.longitude
            ? [Number(complaint.location.longitude), Number(complaint.location.latitude)]
            : undefined,
          zone: priorityAssessment.locationMeta?.locationType || 'General Zone',
          locationType: priorityAssessment.locationMeta?.locationType || 'Neutral',
          importanceScore: priorityAssessment.locationMeta?.score || 50,
          importanceReason: priorityAssessment.locationMeta?.reason || '',
        },
        aiSeverity: {
          score: severityScore,
          level: complaint.aiAnalysis?.severityLevel || complaint.severity || 'Medium',
        },
        safetyRisk: {
          level: complaint.aiAnalysis?.safetyRisk?.level || 'Medium',
          score: priorityAssessment.breakdown.safetyScore,
          description: complaint.aiAnalysis?.safetyRisk?.description || 'Municipal safety evaluation',
          affectedGroups: complaint.aiAnalysis?.safetyRisk?.affectedGroups || ['General Public'],
        },
        supportingReportCount: 1,
        citizenSupportCount: 0,
        supportedBy: [],
        priority: priorityAssessment,
        department: canonicalDepartment(complaint.department || complaint.aiAnalysis?.department || getDepartmentForCategory(complaint.category)),
        assignedDepartment: canonicalDepartment(complaint.department || complaint.aiAnalysis?.department || getDepartmentForCategory(complaint.category)),
        status: 'Pending',
      });

      await Complaint.updateOne(
        { complaintId: complaint.complaintId },
        {
          $set: {
            masterIssueId: newMaster.masterIssueId,
            duplicateGroupId: newMaster.masterIssueId,
            isMasterIssuePrimary: true,
            duplicateAssessment: {
              isDuplicate: false,
              matchType: 'Possible',
              confidence: matchResult.confidence,
              matchedWithId: matchResult.masterIssue?.primaryComplaintId,
              matchedMasterIssueId: matchResult.masterIssueId,
              matchReason: matchResult.matchReason,
              reviewedByHuman: false,
            },
          },
        }
      );

      return {
        actionTaken: 'FlaggedAsPossibleDuplicate',
        masterIssue: newMaster,
        matchedTargetMasterIssueId: masterIssueId,
        duplicateAssessment: {
          isDuplicate: false,
          matchType: 'Possible',
          confidence: matchResult.confidence,
        },
      };
    }
  }

  // -------------------------------------------------------------
  // UNRELATED / NEW ISSUE: Create a new MasterIssue
  // -------------------------------------------------------------
  const newMasterIssueId = generateMasterIssueId();
  const severityScore = complaint.aiAnalysis?.severityScore || (complaint.severity === 'Critical' ? 90 : complaint.severity === 'High' ? 70 : 45);

  const priorityAssessment = calculateDynamicPriority({
    severityScore,
    safetyRisk: complaint.aiAnalysis?.safetyRisk || {},
    supportingReportCount: 1,
    citizenSupportCount: 0,
    address: complaint.location?.address || '',
  });

  let newMaster = null;
  if (isDbConnected()) {
    newMaster = await MasterIssue.create({
      masterIssueId: newMasterIssueId,
      title: complaint.aiAnalysis?.detectedIssue || `${complaint.category} at ${complaint.location?.address || 'Site'}`,
      category: complaint.category,
      primaryComplaintId: complaint.complaintId,
      associatedComplaintIds: [complaint.complaintId],
      potentialDuplicates: [],
      location: {
        address: complaint.location?.address || 'City Zone',
        latitude: complaint.location?.latitude ?? null,
        longitude: complaint.location?.longitude ?? null,
        coordinates: complaint.location?.latitude && complaint.location?.longitude
          ? [Number(complaint.location.longitude), Number(complaint.location.latitude)]
          : undefined,
        zone: priorityAssessment.locationMeta?.locationType || 'General Zone',
        locationType: priorityAssessment.locationMeta?.locationType || 'Neutral',
        importanceScore: priorityAssessment.locationMeta?.score || 50,
        importanceReason: priorityAssessment.locationMeta?.reason || '',
      },
      aiSeverity: {
        score: severityScore,
        level: complaint.aiAnalysis?.severityLevel || complaint.severity || 'Medium',
      },
      safetyRisk: {
        level: complaint.aiAnalysis?.safetyRisk?.level || 'Medium',
        score: priorityAssessment.breakdown.safetyScore,
        description: complaint.aiAnalysis?.safetyRisk?.description || 'Standard safety assessment',
        affectedGroups: complaint.aiAnalysis?.safetyRisk?.affectedGroups || ['General Public'],
      },
      supportingReportCount: 1,
      citizenSupportCount: 0,
      supportedBy: [],
      priority: priorityAssessment,
      department: canonicalDepartment(complaint.department || complaint.aiAnalysis?.department || getDepartmentForCategory(complaint.category)),
      assignedDepartment: canonicalDepartment(complaint.department || complaint.aiAnalysis?.department || getDepartmentForCategory(complaint.category)),
      status: 'Pending',
    });

    await Complaint.updateOne(
      { complaintId: complaint.complaintId },
      {
        $set: {
          masterIssueId: newMaster.masterIssueId,
          duplicateGroupId: newMaster.masterIssueId,
          isMasterIssuePrimary: true,
          duplicateAssessment: {
            isDuplicate: false,
            matchType: 'Unrelated',
            confidence: matchResult.confidence,
            matchedWithId: null,
            matchedMasterIssueId: null,
            matchReason: 'Distinct incident; established new master issue.',
            reviewedByHuman: false,
          },
        },
      }
    );
  }

  return {
    actionTaken: 'CreatedNewMasterIssue',
    masterIssue: newMaster,
    duplicateAssessment: {
      isDuplicate: false,
      matchType: 'Unrelated',
      confidence: matchResult.confidence,
    },
  };
};

/**
 * Endorse a MasterIssue ("I am also affected")
 * Prevents repeat support from the same citizen identifier.
 * Recalculates priority dynamically upon support.
 * 
 * @param {string} masterIssueId 
 * @param {string} citizenIdentifier - Unique citizen user ID, session token, or client IP
 * @returns {Promise<Object>} Updated master issue and support stats
 */
export const supportMasterIssue = async (masterIssueId, citizenIdentifier) => {
  if (!masterIssueId) {
    throw new Error('Master Issue ID is required');
  }

  const citizenHash = hashCitizenIdentifier(citizenIdentifier || 'anonymous-citizen');

  if (!isDbConnected()) {
    throw new Error('Database is not connected');
  }

  // Need select('+supportedBy') because supportedBy has select: false by default
  const masterIssue = await MasterIssue.findOne({ masterIssueId }).select('+supportedBy');

  if (!masterIssue) {
    const error = new Error(`Master issue '${masterIssueId}' not found`);
    error.statusCode = 404;
    throw error;
  }

  // Verify submitter cannot self-endorse their own complaint
  if (masterIssue.associatedComplaintIds?.length > 0) {
    const associatedComplaints = await Complaint.find({
      complaintId: { $in: masterIssue.associatedComplaintIds },
    }).select('citizenUserId phone').lean();

    const isSubmitter = associatedComplaints.some(
      (c) =>
        (c.citizenUserId && String(c.citizenUserId) === String(citizenIdentifier)) ||
        (c.phone && String(c.phone) === String(citizenIdentifier))
    );

    if (isSubmitter) {
      const err = new Error('You submitted this complaint. Submitting citizens cannot endorse their own report.');
      err.statusCode = 400;
      throw err;
    }
  }

  // Verify not already supported
  if (masterIssue.supportedBy.includes(citizenHash)) {
    const err = new Error('You have already registered your support for this issue.');
    err.statusCode = 409;
    throw err;
  }

  // Add support
  masterIssue.supportedBy.push(citizenHash);
  masterIssue.citizenSupportCount = masterIssue.supportedBy.length;

  // Recalculate dynamic priority
  const newPriority = calculateDynamicPriority({
    severityScore: masterIssue.aiSeverity?.score || 50,
    safetyRisk: masterIssue.safetyRisk,
    supportingReportCount: masterIssue.supportingReportCount,
    citizenSupportCount: masterIssue.citizenSupportCount,
    address: masterIssue.location?.address,
  });

  masterIssue.priority = newPriority;
  masterIssue.lastActivityAt = new Date();
  await masterIssue.save();

  return {
    success: true,
    message: 'Your endorsement has been recorded. Collective priority score updated.',
    masterIssueId: masterIssue.masterIssueId,
    citizenSupportCount: masterIssue.citizenSupportCount,
    priority: masterIssue.priority,
    hasSupported: true,
  };
};

/**
 * Resolve a potential duplicate (Authority action: Confirm or Dismiss)
 * 
 * @param {string} masterIssueId 
 * @param {string} complaintId 
 * @param {'Confirm' | 'Dismiss'} action 
 * @param {string} [reviewer='Municipal Dispatcher'] 
 * @returns {Promise<Object>}
 */
export const resolvePotentialDuplicate = async (masterIssueId, complaintId, action, reviewer = 'Municipal Dispatcher') => {
  if (!isDbConnected()) {
    throw new Error('Database is not connected');
  }

  const masterIssue = await MasterIssue.findOne({ masterIssueId });
  if (!masterIssue) {
    const err = new Error('Master issue not found');
    err.statusCode = 404;
    throw err;
  }

  const targetPot = masterIssue.potentialDuplicates.find((p) => p.complaintId === complaintId);
  if (!targetPot) {
    const err = new Error(`Potential duplicate '${complaintId}' not found under this master issue.`);
    err.statusCode = 404;
    throw err;
  }

  if (action === 'Confirm') {
    targetPot.status = 'Confirmed';
    targetPot.reviewedAt = new Date();
    targetPot.reviewedBy = reviewer;

    if (!masterIssue.associatedComplaintIds.includes(complaintId)) {
      masterIssue.associatedComplaintIds.push(complaintId);
      masterIssue.supportingReportCount = masterIssue.associatedComplaintIds.length;
    }

    // Recalculate priority
    masterIssue.priority = calculateDynamicPriority({
      severityScore: masterIssue.aiSeverity?.score || 50,
      safetyRisk: masterIssue.safetyRisk,
      supportingReportCount: masterIssue.supportingReportCount,
      citizenSupportCount: masterIssue.citizenSupportCount,
      address: masterIssue.location?.address,
    });

    await masterIssue.save();

    // Check if the merged complaint was previously associated with a tentative single-complaint MasterIssue
    const existingComplaint = await Complaint.findOne({ complaintId }).lean();
    const prevMasterIssueId = existingComplaint?.masterIssueId;

    await Complaint.updateOne(
      { complaintId },
      {
        $set: {
          masterIssueId: masterIssue.masterIssueId,
          duplicateGroupId: masterIssue.masterIssueId,
          isMasterIssuePrimary: false,
          'duplicateAssessment.isDuplicate': true,
          'duplicateAssessment.matchType': 'Strong',
          'duplicateAssessment.reviewedByHuman': true,
        },
      }
    );

    // If an isolated tentative MasterIssue was created during 'Possible' match, remove the orphaned MasterIssue
    if (prevMasterIssueId && prevMasterIssueId !== masterIssue.masterIssueId) {
      const prevMaster = await MasterIssue.findOne({ masterIssueId: prevMasterIssueId });
      if (prevMaster && (prevMaster.associatedComplaintIds.length <= 1 || prevMaster.primaryComplaintId === complaintId)) {
        await MasterIssue.deleteOne({ masterIssueId: prevMasterIssueId });
      }
    }

    return { success: true, message: `Complaint ${complaintId} confirmed as duplicate and merged into ${masterIssue.masterIssueId}.`, masterIssue };
  } else {
    // Dismiss
    targetPot.status = 'Dismissed';
    targetPot.reviewedAt = new Date();
    targetPot.reviewedBy = reviewer;
    await masterIssue.save();

    await Complaint.updateOne(
      { complaintId },
      {
        $set: {
          'duplicateAssessment.reviewedByHuman': true,
          'duplicateAssessment.matchType': 'Unrelated',
        },
      }
    );

    return { success: true, message: `Potential duplicate ${complaintId} dismissed. Kept as independent issue.`, masterIssue };
  }
};
