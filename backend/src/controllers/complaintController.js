import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Complaint from '../models/Complaint.js';
import MasterIssue from '../models/MasterIssue.js';
import OtpVerification from '../models/OtpVerification.js';
import CitizenNotification from '../models/CitizenNotification.js';
import { memoryStore } from '../models/complaintStore.js';
import { isDbConnected } from '../config/db.js';
import { generateComplaintId } from '../utils/generateId.js';
import { uploadBufferToCloudinary, isCloudinaryConfigured } from '../config/cloudinary.js';
import { validateStatusTransition } from '../utils/statusTransitions.js';
import { analyzeComplaintWithGemini, getMockGeminiAnalysis } from '../services/geminiService.js';
import { syncComplaintToMasterIssue } from '../services/masterIssueService.js';
import { evaluateSlaStatus } from '../services/slaService.js';
import { maskPhoneNumber } from '../services/smsService.js';
import { geocodeIndianAddress, isWithinIndia } from '../services/geocodingService.js';
import { canonicalDepartment, getDepartmentForCategory } from '../utils/departmentHelper.js';

/**
 * Background / helper function to run Gemini AI analysis on a saved complaint
 * Updates the document in MongoDB or memoryStore safely.
 */
export const runAiAnalysisForComplaint = async (
  complaintId,
  { imageBuffer, mimeType, mockMode = false, force = false } = {}
) => {
  const store = isDbConnected() ? Complaint : memoryStore;

  // Retrieve current complaint
  let complaint;
  if (isDbConnected()) {
    complaint = await Complaint.findOne({ complaintId });
  } else {
    complaint = await memoryStore.findOne({ complaintId });
  }

  if (!complaint) return null;

  // 1. REUSE PREVIOUSLY SAVED ANALYSIS: Avoid redundant Gemini calls if already Completed
  if (complaint.aiAnalysis?.analysisStatus === 'Completed' && !force) {
    console.log(`ℹ️ [GeminiService] Reusing previously saved verified AI analysis from MongoDB for ${complaintId}`);
    return complaint;
  }

  try {
    // Mark as Processing
    if (isDbConnected()) {
      complaint.aiAnalysis = {
        ...complaint.aiAnalysis,
        analysisStatus: 'Processing',
      };
      await complaint.save();
    } else {
      await memoryStore.findByIdAndUpdate(complaint._id, {
        $set: { 'aiAnalysis.analysisStatus': 'Processing' },
      });
    }

    // Call Gemini API (or Mock fixture if explicitly requested for automated test runs)
    let aiResult;
    if (mockMode || process.env.USE_MOCK_GEMINI === 'true') {
      console.log(`🧪 [GeminiService] Using mock fixture for dev/test: ${complaintId}`);
      aiResult = getMockGeminiAnalysis({
        category: complaint.category,
        description: complaint.description,
      });
    } else {
      aiResult = await analyzeComplaintWithGemini({
        description: complaint.description,
        category: complaint.category,
        address: complaint.location?.address,
        imageUrl: complaint.imageUrl,
        imageBuffer,
        mimeType,
      });
    }

    // Update with Completed AI results
    if (isDbConnected()) {
      complaint.aiAnalysis = aiResult;
      // Also enrich top-level severity & department if established by AI
      if (aiResult.severityLevel) {
        complaint.severity = aiResult.severityLevel;
      }
      if (aiResult.department) {
        const canonical = canonicalDepartment(aiResult.department);
        complaint.department = canonical;
        if (complaint.masterIssueId) {
          try {
            await MasterIssue.updateOne(
              { masterIssueId: complaint.masterIssueId },
              { $set: { department: canonical, assignedDepartment: canonical } }
            );
          } catch (syncErr) {
            console.warn('⚠️ [MasterIssue] Department sync error:', syncErr.message);
          }
        }
      }
      await complaint.save();
      console.log(`✅ [GeminiService] Analysis completed for ${complaintId}: ${aiResult.category} (${aiResult.severityLevel}, Score: ${aiResult.severityScore}, Dept: ${complaint.department})`);
      return complaint;
    } else {
      const canonical = aiResult.department ? canonicalDepartment(aiResult.department) : complaint.department;
      if (complaint.masterIssueId && aiResult.department) {
        try {
          await memoryStore.updateOne(
            { masterIssueId: complaint.masterIssueId },
            { $set: { department: canonical, assignedDepartment: canonical } }
          );
        } catch {
          // Non-blocking
        }
      }
      const updated = await memoryStore.findByIdAndUpdate(complaint._id, {
        $set: {
          aiAnalysis: aiResult,
          severity: aiResult.severityLevel || complaint.severity,
          department: canonical,
        },
      });
      return updated;
    }
  } catch (aiError) {
    console.error(`❌ [GeminiService] AI analysis failed for ${complaintId}:`, aiError.message);

    const isQuota =
      aiError.isQuotaExhausted ||
      aiError.message?.includes('429') ||
      aiError.message?.includes('RESOURCE_EXHAUSTED') ||
      aiError.message?.includes('quota');

    const failedPayload = {
      analysisStatus: 'Failed',
      error: isQuota
        ? 'Gemini API daily quota limit reached (Free tier 20 req/day). Incident saved and queued for manual triage.'
        : aiError.message,
      analyzedAt: new Date(),
      modelUsed: process.env.GEMINI_MODEL || 'gemini-3-flash-preview',
      requiresHumanReview: true,
    };

    if (isDbConnected()) {
      complaint.aiAnalysis = failedPayload;
      await complaint.save();
    } else {
      await memoryStore.findByIdAndUpdate(complaint._id, {
        $set: { aiAnalysis: failedPayload },
      });
    }

    return null;
  }
};

/**
 * @route   POST /api/complaints
 * @desc    Create a new citizen complaint and trigger Gemini analysis
 * @access  Public
 */
export const createComplaint = async (req, res, next) => {
  try {
    const {
      category,
      description,
      department,
      reportedBy,
      address,
      latitude,
      longitude,
    } = req.body;

    // Normalize location
    let location = req.body.location;
    if (typeof location === 'string') {
      try {
        location = JSON.parse(location);
      } catch {
        location = { address: location };
      }
    } else if (!location && address) {
      location = {
        address,
        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null,
      };
    }

    if (!location) {
      location = { address: address || '' };
    }

    // Capture coordinates from location object or top-level body fields
    let lat = location.latitude !== undefined && location.latitude !== null ? Number(location.latitude) : (latitude ? Number(latitude) : null);
    let lng = location.longitude !== undefined && location.longitude !== null ? Number(location.longitude) : (longitude ? Number(longitude) : null);

    // If coordinates are missing or not within India, attempt high-accuracy geocoding from address
    if (location.address && !isWithinIndia(lat, lng)) {
      try {
        const geoResult = await geocodeIndianAddress(location.address);
        if (geoResult) {
          lat = geoResult.latitude;
          lng = geoResult.longitude;
        }
      } catch (geoErr) {
        console.warn('⚠️ [Geocoding] Fallback geocode error:', geoErr.message);
      }
    }

    location.latitude = lat;
    location.longitude = lng;

    // Validation
    const validationErrors = [];
    if (!category || !category.trim()) {
      validationErrors.push('Category is required');
    }
    if (!description || description.trim().length < 10) {
      validationErrors.push('Description is required and must be at least 10 characters');
    }
    if (!location || !location.address || !location.address.trim()) {
      validationErrors.push('Location address is required');
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors,
      });
    }

    // Handle Image Upload with Cloudinary
    let imageUrl = null;
    let uploadNotice = null;
    const uploadedFileBuffer = req.file?.buffer || null;
    const uploadedFileMime = req.file?.mimetype || 'image/jpeg';

    if (req.file) {
      if (isCloudinaryConfigured()) {
        const uploadResult = await uploadBufferToCloudinary(req.file.buffer, {
          folder: 'civicpulse/complaints',
        });
        if (uploadResult.success) {
          imageUrl = uploadResult.url;
        } else {
          console.warn('⚠️ [Cloudinary] Upload failed:', uploadResult.error);
          uploadNotice = `Image upload failed: ${uploadResult.error}. Incident saved without cloud image.`;
        }
      } else {
        const noticeMsg = 'Cloudinary credentials are not configured in backend/.env. Media file acknowledged but not hosted.';
        console.info(`ℹ️ [Cloudinary] ${noticeMsg}`);
        uploadNotice = noticeMsg;
      }
    } else if (req.body.imageUrl) {
      imageUrl = req.body.imageUrl;
    }

    // Citizen Mobile Number Check (Direct phone input without OTP barrier)
    const rawPhone = req.body.phone || req.body.verifiedPhone || req.body.mobileNumber;
    let verifiedPhone = null;

    if (!rawPhone || typeof rawPhone !== 'string' || !rawPhone.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Citizen mobile number is required for incident tracking and dispatch notifications.',
      });
    }

    const cleanPhone = rawPhone.replace(/[\s-]/g, '').trim();
    if (!/^\+?[0-9]{7,15}$/.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid mobile number (e.g. +91 9876543210 or 9876543210).',
      });
    }
    verifiedPhone = cleanPhone;

    // Optional: If an OTP verification token was passed, consume it gracefully
    const verificationToken = req.body.verificationToken || req.headers['x-verification-token'];
    if (verificationToken && isDbConnected()) {
      try {
        await OtpVerification.updateOne({ verificationToken }, { $set: { consumed: true } });
      } catch {
        // Non-blocking
      }
    }

    // Safe human-readable Complaint ID & cryptographic tracking token
    const complaintId = generateComplaintId();
    const trackingToken = crypto.randomBytes(24).toString('hex');
    const locationSource = req.body.locationSource || location.locationSource || (location.latitude && location.longitude ? 'geocoding' : 'manual');

    // Securely detect authenticated citizen user from verified session / token
    let citizenUserId = null;
    let isGuestSubmission = true;

    if (req.citizen && (req.citizen.citizenId || req.citizen.userId)) {
      citizenUserId = req.citizen.citizenId || req.citizen.userId;
      isGuestSubmission = false;
    } else {
      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const secretsToTry = [
          process.env.CITIZEN_JWT_SECRET,
          process.env.JWT_SECRET,
          'civicpulse_citizen_jwt_secret_2026',
        ].filter(Boolean);

        for (const sec of secretsToTry) {
          try {
            const decoded = jwt.verify(token, sec);
            if ((decoded.citizenId || decoded.userId) && decoded.role === 'Citizen') {
              citizenUserId = decoded.citizenId || decoded.userId;
              isGuestSubmission = false;
              break;
            }
          } catch {
            // Check next secret
          }
        }
      }
    }

    // Cast string ID to Mongoose ObjectId if valid
    const citizenObjectId = citizenUserId && mongoose.Types.ObjectId.isValid(citizenUserId)
      ? new mongoose.Types.ObjectId(citizenUserId)
      : null;

    console.log(`📋 [ComplaintSubmission] #${complaintId}: ${citizenUserId ? `Associated with Citizen ID ${citizenUserId}` : 'Guest Submission'}`);

    const newComplaintData = {
      complaintId,
      category: category.trim(),
      description: description.trim(),
      location: {
        address: location.address.trim(),
        latitude: location.latitude ? Number(location.latitude) : null,
        longitude: location.longitude ? Number(location.longitude) : null,
        locationSource,
      },
      imageUrl,
      audioUrl: req.body.audioUrl || null,
      severity: null, // Initially null; populated by Gemini AI analysis
      status: 'Pending',
      department: department ? canonicalDepartment(department) : getDepartmentForCategory(category.trim()),
      trackingToken,
      verifiedPhone,
      citizenUserId: citizenObjectId || citizenUserId || null,
      isGuestSubmission,
      aiAnalysis: {
        analysisStatus: 'Pending',
      },
      duplicateGroupId: null,
      statusHistory: [
        {
          fromStatus: null,
          toStatus: 'Pending',
          changedAt: new Date(),
          changedBy: reportedBy || (citizenUserId ? 'Registered Citizen' : 'Citizen (Guest)'),
          note: 'Initial incident report submitted via Citizen Portal with verified mobile contact',
        },
      ],
    };

    let createdDoc;
    if (isDbConnected()) {
      createdDoc = await Complaint.create(newComplaintData);
      // In-app notification for registered citizens
      if (citizenUserId) {
        try {
          await CitizenNotification.create({
            citizenUserId,
            title: 'Complaint Registered',
            message: `Your complaint #${complaintId} (${category.trim()}) has been submitted for automated triage.`,
            type: 'status_change',
            complaintId,
          });
        } catch {
          // Non-blocking
        }
      }
    } else {
      createdDoc = await memoryStore.create(newComplaintData);
    }

    // Trigger Gemini multimodal analysis
    // We attempt inline execution with a timeout so response can include results immediately if available
    try {
      const mockMode = req.headers['x-mock-ai'] === 'true' || process.env.USE_MOCK_GEMINI === 'true';
      const aiPromise = runAiAnalysisForComplaint(complaintId, {
        imageBuffer: uploadedFileBuffer,
        mimeType: uploadedFileMime,
        mockMode,
      });

      // Race with a 6-second timeout so citizen submission is never blocked
      const raceResult = await Promise.race([
        aiPromise,
        new Promise((resolve) => setTimeout(() => resolve('TIMEOUT'), 6000)),
      ]);

      if (raceResult && raceResult !== 'TIMEOUT') {
        createdDoc = raceResult;
      }
    } catch (aiErr) {
      console.warn('⚠️ [Gemini] Non-fatal AI background dispatch error:', aiErr.message);
    }

    // Intelligent Duplicate & Master Issue Synchronization
    try {
      const syncResult = await syncComplaintToMasterIssue(createdDoc);
      if (syncResult && syncResult.masterIssue && isDbConnected()) {
        const reloaded = await Complaint.findOne({ complaintId });
        if (reloaded) createdDoc = reloaded;
      }
    } catch (syncErr) {
      console.warn('⚠️ [MasterIssue] Duplicate sync error:', syncErr.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Complaint submitted successfully',
      data: createdDoc,
      trackingToken,
      trackingUrl: `/track?id=${complaintId}&token=${trackingToken}`,
      uploadNotice: uploadNotice || undefined,
      storageMode: isDbConnected() ? 'mongodb' : 'in-memory-dev',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/complaints/:id/analyze
 * @desc    Manually trigger or retry Gemini AI analysis for an existing complaint
 * @access  Public / Authority
 */
export const triggerComplaintAiAnalysis = async (req, res, next) => {
  try {
    const { id } = req.params;

    let complaint = null;
    if (isDbConnected()) {
      complaint = await Complaint.findOne({
        $or: [{ complaintId: id.toUpperCase() }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }],
      });
    } else {
      complaint = await memoryStore.findOne({
        $or: [{ complaintId: id.toUpperCase() }, { _id: id }],
      });
    }

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: `Complaint with ID '${id}' not found`,
      });
    }

    // Reuse existing verified analysis unless explicitly forced
    const force = Boolean(req.query.force === 'true' || req.body.force === true);
    if (complaint.aiAnalysis?.analysisStatus === 'Completed' && !force) {
      console.log(`ℹ️ [GeminiService] Reusing previously saved verified AI analysis from MongoDB for ${complaint.complaintId}`);
      return res.status(200).json({
        success: true,
        message: 'Reusing existing verified Gemini AI analysis from database',
        data: complaint,
        reused: true,
      });
    }

    const mockMode = req.headers['x-mock-ai'] === 'true' || process.env.USE_MOCK_GEMINI === 'true';
    console.log(`🤖 [GeminiService] Triggering analysis for ${complaint.complaintId}...`);
    const updated = await runAiAnalysisForComplaint(complaint.complaintId, { mockMode, force });

    if (updated) {
      try {
        await syncComplaintToMasterIssue(updated);
      } catch (syncErr) {
        console.warn('⚠️ [MasterIssue] Re-analysis sync error:', syncErr.message);
      }

      const freshDoc = isDbConnected()
        ? await Complaint.findOne({ complaintId: complaint.complaintId })
        : updated;

      return res.status(200).json({
        success: true,
        message: 'Gemini AI analysis completed successfully',
        data: freshDoc || updated,
      });
    } else {
      // Re-fetch to return failed status state
      const refreshed = isDbConnected()
        ? await Complaint.findOne({ complaintId: complaint.complaintId })
        : await memoryStore.findOne({ complaintId: complaint.complaintId });

      return res.status(200).json({
        success: false,
        message: refreshed.aiAnalysis?.error || 'AI analysis could not be completed',
        data: refreshed,
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/complaints
 * @desc    Retrieve complaints with filtering (category, status, severity) and pagination
 * @access  Public
 */
export const getComplaints = async (req, res, next) => {
  try {
    const {
      category,
      status,
      severity,
      search,
      page = 1,
      limit = 10,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (category && category !== 'All') {
      filter.category = category;
    }
    if (status && status !== 'All') {
      if (status === 'Active') {
        filter.status = { $nin: ['Resolved', 'Rejected'] };
      } else if (status === 'Pending') {
        filter.status = { $in: ['Pending', 'Under Review'] };
      } else {
        filter.status = status;
      }
    }
    if (severity && severity !== 'All') {
      filter.severity = severity === 'Unassigned' ? null : severity;
    }
    if (search && search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: 'i' };
      filter.$or = [
        { complaintId: searchRegex },
        { description: searchRegex },
        { category: searchRegex },
        { 'location.address': searchRegex },
      ];
    }

    let complaints = [];
    let total = 0;

    if (isDbConnected()) {
      total = await Complaint.countDocuments(filter);
      complaints = await Complaint.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean();
    } else {
      const allMatches = await memoryStore.find(filter);
      total = allMatches.length;
      complaints = allMatches.slice(skip, skip + limitNum);
    }

    const totalPages = Math.ceil(total / limitNum) || 1;

    return res.status(200).json({
      success: true,
      count: complaints.length,
      total,
      page: pageNum,
      totalPages,
      data: complaints,
      storageMode: isDbConnected() ? 'mongodb' : 'in-memory-dev',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/complaints/:id
 * @desc    Retrieve a complaint by human-readable complaintId or MongoDB _id
 * @access  Public
 */
export const getComplaintById = async (req, res, next) => {
  try {
    const { id } = req.params;

    let complaint = null;

    if (isDbConnected()) {
      complaint = await Complaint.findOne({
        $or: [
          { complaintId: id.toUpperCase() },
          { masterIssueId: id.toUpperCase() },
          { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null },
        ],
      }).lean();
    } else {
      complaint = await memoryStore.findOne({
        $or: [
          { complaintId: id.toUpperCase() },
          { masterIssueId: id.toUpperCase() },
          { _id: id },
        ],
      });
    }

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: `Complaint with ID '${id}' not found`,
      });
    }

    // Public view: Strip private tracking token and mask phone number
    const sanitizedComplaint = {
      ...complaint,
      trackingToken: undefined,
      verifiedPhone: complaint.verifiedPhone ? maskPhoneNumber(complaint.verifiedPhone) : null,
    };

    return res.status(200).json({
      success: true,
      data: sanitizedComplaint,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/complaints/track/:id
 * @desc    Secure Citizen Complaint Tracking (requires valid trackingToken)
 * @access  Public (Token Protected)
 */
export const trackComplaint = async (req, res, next) => {
  try {
    const { id } = req.params;
    const token = req.query.token || req.headers['x-tracking-token'] || req.body?.trackingToken;

    if (!token) {
      return res.status(403).json({
        success: false,
        message: 'Valid tracking token is required to access secure complaint tracking details.',
      });
    }

    let complaint = null;
    if (isDbConnected()) {
      complaint = await Complaint.findOne({
        $or: [{ complaintId: id.toUpperCase() }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }],
      }).lean();
    } else {
      complaint = await memoryStore.findOne({
        $or: [{ complaintId: id.toUpperCase() }, { _id: id }],
      });
    }

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: `Complaint with ID '${id}' not found`,
      });
    }

    // Validate tracking token matches
    const isTokenMatch = complaint.trackingToken && complaint.trackingToken === token;
    if (!isTokenMatch && !req.authority) {
      return res.status(403).json({
        success: false,
        message: 'Invalid tracking token. Access to private complaint tracking is denied.',
      });
    }

    // Return detailed tracking view with masked phone
    const trackingView = {
      ...complaint,
      verifiedPhone: complaint.verifiedPhone ? maskPhoneNumber(complaint.verifiedPhone) : null,
    };

    return res.status(200).json({
      success: true,
      isOwner: true,
      message: 'Complaint tracking credentials verified successfully.',
      data: trackingView,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/complaints/:id/status
 * @desc    Update complaint status with validated transitions and audit history
 * @access  Public / Authority
 */
export const updateComplaintStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, note, changedBy } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Target status is required in request body',
      });
    }

    let complaint = null;
    if (isDbConnected()) {
      complaint = await Complaint.findOne({
        $or: [{ complaintId: id.toUpperCase() }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }],
      });
    } else {
      complaint = await memoryStore.findOne({
        $or: [{ complaintId: id.toUpperCase() }, { _id: id }],
      });
    }

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: `Complaint with ID '${id}' not found`,
      });
    }

    const transitionCheck = validateStatusTransition(complaint.status, status);
    if (!transitionCheck.allowed) {
      return res.status(400).json({
        success: false,
        message: transitionCheck.reason,
        currentStatus: complaint.status,
        requestedStatus: status,
      });
    }

    const historyEntry = {
      fromStatus: complaint.status,
      toStatus: status,
      changedAt: new Date(),
      changedBy: changedBy || 'Authority Operator',
      note: note || `Status transitioned from ${complaint.status} to ${status}`,
    };

    let updatedDoc;
    if (isDbConnected()) {
      complaint.status = status;
      complaint.statusHistory.push(historyEntry);
      updatedDoc = await complaint.save();

      // Dispatch notification to citizen owner if linked
      if (complaint.citizenUserId) {
        try {
          await CitizenNotification.create({
            citizenUserId: complaint.citizenUserId,
            title: `Complaint Status: ${status}`,
            message: `Your complaint #${complaint.complaintId} status changed to "${status}". ${note ? `Note: ${note}` : ''}`,
            type: 'status_change',
            complaintId: complaint.complaintId,
          });
        } catch {
          // Non-blocking
        }
      }
    } else {
      updatedDoc = await memoryStore.findByIdAndUpdate(complaint._id, {
        $set: { status },
        $push: { statusHistory: historyEntry },
      });
    }

    return res.status(200).json({
      success: true,
      message: `Complaint status updated to '${status}' successfully`,
      data: updatedDoc,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/complaints/stats
 * @desc    Retrieve complaint counts, status-wise, category-wise, and severity metrics
 * @access  Public
 */
export const getComplaintStats = async (req, res, next) => {
  try {
    if (isDbConnected()) {
      const total = await Complaint.countDocuments();

      const statusAggregation = await Complaint.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]);

      const categoryAggregation = await Complaint.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]);

      const severityAggregation = await Complaint.aggregate([
        { $group: { _id: '$severity', count: { $sum: 1 } } },
      ]);

      const byStatus = {
        Pending: 0,
        'Under Review': 0,
        'In Progress': 0,
        Resolved: 0,
        Rejected: 0,
      };
      statusAggregation.forEach((item) => {
        if (item._id) byStatus[item._id] = item.count;
      });

      const byCategory = {};
      categoryAggregation.forEach((item) => {
        if (item._id) byCategory[item._id] = item.count;
      });

      const bySeverity = { Low: 0, Moderate: 0, High: 0, Critical: 0, Unassigned: 0 };
      severityAggregation.forEach((item) => {
        if (item._id) {
          bySeverity[item._id] = item.count;
        } else {
          bySeverity.Unassigned = item.count;
        }
      });

      return res.status(200).json({
        success: true,
        data: {
          total,
          byStatus,
          byCategory,
          bySeverity,
        },
        storageMode: 'mongodb',
      });
    } else {
      const stats = await memoryStore.getStats();
      return res.status(200).json({
        success: true,
        data: stats,
        storageMode: 'in-memory-dev',
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/complaints/:id/duplicates
 * @desc    Get duplicate status, matched master issue, and sister complaints for a complaint
 * @access  Public / Authority
 */
export const getComplaintDuplicates = async (req, res, next) => {
  try {
    const { id } = req.params;
    let complaint = null;
    if (isDbConnected()) {
      complaint = await Complaint.findOne({
        $or: [
          { complaintId: id.toUpperCase() },
          { masterIssueId: id.toUpperCase() },
          { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null },
        ],
      }).lean();
    } else {
      complaint = await memoryStore.findOne({
        $or: [
          { complaintId: id.toUpperCase() },
          { masterIssueId: id.toUpperCase() },
        ],
      });
    }

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    let masterIssue = null;
    let sisterComplaints = [];

    if (complaint.masterIssueId && isDbConnected()) {
      masterIssue = await MasterIssue.findOne({ masterIssueId: complaint.masterIssueId }).lean();
      if (masterIssue) {
        // Enforce strict confidentiality: strip internal notes and officer email from citizen response
        delete masterIssue.internalNotes;
        delete masterIssue.supportedBy;
        if (masterIssue.assignedOfficer) {
          masterIssue.assignedOfficer = {
            id: masterIssue.assignedOfficer.id,
            name: masterIssue.assignedOfficer.name,
            role: masterIssue.assignedOfficer.role,
            department: masterIssue.assignedOfficer.department,
          };
        }
        masterIssue.sla = evaluateSlaStatus(masterIssue);

        if (masterIssue.associatedComplaintIds) {
          sisterComplaints = await Complaint.find({
            complaintId: { $in: masterIssue.associatedComplaintIds, $ne: complaint.complaintId },
          })
            .select('complaintId category description severity status location createdAt imageUrl')
            .lean();
        }
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        complaintId: complaint.complaintId,
        masterIssueId: complaint.masterIssueId,
        isMasterIssuePrimary: complaint.isMasterIssuePrimary,
        duplicateAssessment: complaint.duplicateAssessment || { isDuplicate: false, matchType: 'Unrelated' },
        masterIssue: masterIssue || null,
        sisterComplaints,
      },
    });
  } catch (err) {
    next(err);
  }
};
