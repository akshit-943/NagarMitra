import mongoose from 'mongoose';
import CitizenUser from '../models/CitizenUser.js';
import Complaint from '../models/Complaint.js';
import MasterIssue from '../models/MasterIssue.js';
import CitizenNotification from '../models/CitizenNotification.js';

/**
 * Get Citizen Personal Dashboard Overview
 * @route GET /api/citizen/dashboard/overview
 * @access Citizen Protected
 */
export const getDashboardOverview = async (req, res, next) => {
  try {
    const citizenId = req.citizen.citizenId;

    const user = await CitizenUser.findById(citizenId).lean();
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Citizen account not found.',
      });
    }

    // 1. Complaint stats for this citizen (robust match for both ObjectId and string representation)
    const citizenObjId = mongoose.Types.ObjectId.isValid(citizenId)
      ? new mongoose.Types.ObjectId(citizenId)
      : null;
    const citizenIdQuery = citizenObjId ? { $in: [citizenId, citizenObjId] } : citizenId;

    const myComplaints = await Complaint.find({ citizenUserId: citizenIdQuery }).sort({ createdAt: -1 }).lean();
    const totalComplaints = myComplaints.length;
    const activeComplaints = myComplaints.filter(
      (c) => !['Resolved', 'Rejected'].includes(c.status)
    ).length;
    const resolvedComplaints = myComplaints.filter((c) => c.status === 'Resolved').length;

    // 2. Followed issues
    const followedIssueIds = user.followedIssues || [];
    let followedIssuesList = [];
    if (followedIssueIds.length > 0) {
      followedIssuesList = await MasterIssue.find({
        masterIssueId: { $in: followedIssueIds },
      }).lean();
    }

    // 3. Unread notifications
    const unreadNotificationsCount = await CitizenNotification.countDocuments({
      citizenUserId: citizenId,
      isRead: false,
    });

    const recentNotifications = await CitizenNotification.find({
      citizenUserId: citizenId,
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        stats: {
          totalComplaints,
          activeComplaints,
          resolvedComplaints,
          followedIssuesCount: followedIssueIds.length,
          unreadNotificationsCount,
        },
        recentComplaints: myComplaints.slice(0, 5),
        followedIssues: followedIssuesList,
        recentNotifications,
        user: {
          name: user.name,
          email: user.email,
          phone: user.phone,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get All Personal Complaints of Authenticated Citizen
 * @route GET /api/citizen/dashboard/complaints
 * @access Citizen Protected
 */
export const getMyComplaints = async (req, res, next) => {
  try {
    const citizenId = req.citizen.citizenId;
    const { status, search } = req.query;

    const citizenObjId = mongoose.Types.ObjectId.isValid(citizenId)
      ? new mongoose.Types.ObjectId(citizenId)
      : null;
    const citizenIdQuery = citizenObjId ? { $in: [citizenId, citizenObjId] } : citizenId;

    const filter = { citizenUserId: citizenIdQuery };

    if (status && status !== 'All') {
      filter.status = status;
    }

    if (search && search.trim()) {
      filter.$or = [
        { complaintId: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } },
        { category: { $regex: search.trim(), $options: 'i' } },
        { 'location.address': { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const complaints = await Complaint.find(filter).sort({ createdAt: -1 }).lean();

    return res.status(200).json({
      success: true,
      count: complaints.length,
      data: complaints,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Claim / Link a Guest Complaint to Authenticated Citizen Account
 * @route POST /api/citizen/dashboard/claim-complaint
 * @access Citizen Protected
 */
export const claimGuestComplaint = async (req, res, next) => {
  try {
    const citizenId = req.citizen.citizenId;
    const { complaintId, trackingToken } = req.body;

    if (!complaintId || !trackingToken) {
      return res.status(400).json({
        success: false,
        message: 'Both Complaint ID and tracking token are required to claim a guest complaint.',
      });
    }

    const cleanComplaintId = String(complaintId).trim().toUpperCase();
    const cleanToken = String(trackingToken).trim();

    const complaint = await Complaint.findOne({ complaintId: cleanComplaintId });

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: `Complaint '${cleanComplaintId}' was not found in the municipal registry.`,
      });
    }

    // Verify tracking token matches
    if (!complaint.trackingToken || complaint.trackingToken !== cleanToken) {
      return res.status(401).json({
        success: false,
        message: 'Invalid tracking token. Please provide the secret tracking key provided upon submission.',
      });
    }

    // Check if already claimed
    if (complaint.citizenUserId) {
      if (complaint.citizenUserId.toString() === citizenId) {
        return res.status(200).json({
          success: true,
          message: `Complaint ${cleanComplaintId} is already linked to your dashboard.`,
          data: complaint,
        });
      }

      return res.status(400).json({
        success: false,
        message: `Complaint ${cleanComplaintId} has already been claimed by another citizen account.`,
      });
    }

    // Link complaint to this citizen
    complaint.citizenUserId = citizenId;
    complaint.isGuestSubmission = false;
    await complaint.save();

    // Create in-app notification
    try {
      await CitizenNotification.create({
        citizenUserId: citizenId,
        title: 'Guest Complaint Linked',
        message: `Complaint #${cleanComplaintId} (${complaint.category}) has been successfully linked to your personal dashboard.`,
        type: 'claim',
        complaintId: cleanComplaintId,
      });
    } catch {
      // Non-blocking
    }

    return res.status(200).json({
      success: true,
      message: `Complaint ${cleanComplaintId} successfully linked to your personal dashboard.`,
      data: complaint,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Followed Master Issues
 * @route GET /api/citizen/dashboard/followed-issues
 * @access Citizen Protected
 */
export const getFollowedIssues = async (req, res, next) => {
  try {
    const citizenId = req.citizen.citizenId;
    const user = await CitizenUser.findById(citizenId).lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Citizen account not found.',
      });
    }

    const followedIds = user.followedIssues || [];
    const issues = await MasterIssue.find({
      masterIssueId: { $in: followedIds },
    }).lean();

    return res.status(200).json({
      success: true,
      count: issues.length,
      data: issues,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle Follow / Unfollow a Master Issue
 * @route POST /api/citizen/dashboard/follow-issue
 * @access Citizen Protected
 */
export const toggleFollowIssue = async (req, res, next) => {
  try {
    const citizenId = req.citizen.citizenId;
    const { masterIssueId } = req.body;

    if (!masterIssueId) {
      return res.status(400).json({
        success: false,
        message: 'masterIssueId is required.',
      });
    }

    const cleanId = String(masterIssueId).trim();
    const user = await CitizenUser.findById(citizenId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Citizen account not found.',
      });
    }

    const masterIssue = await MasterIssue.findOne({ masterIssueId: cleanId });
    if (!masterIssue) {
      return res.status(404).json({
        success: false,
        message: `Master Issue '${cleanId}' not found.`,
      });
    }

    const isFollowing = user.followedIssues.includes(cleanId);
    let message = '';

    if (isFollowing) {
      user.followedIssues = user.followedIssues.filter((id) => id !== cleanId);
      message = `Unfollowed civic issue #${cleanId}.`;
    } else {
      user.followedIssues.push(cleanId);
      message = `Now following civic issue #${cleanId}. You will receive dispatch updates.`;

      // Notification
      try {
        await CitizenNotification.create({
          citizenUserId: citizenId,
          title: 'Following Civic Issue',
          message: `You are now following #${cleanId} (${masterIssue.title || masterIssue.category}). You will be notified of SLA and resolution updates.`,
          type: 'followed_issue',
          masterIssueId: cleanId,
        });
      } catch {
        // Non-blocking
      }
    }

    await user.save();

    return res.status(200).json({
      success: true,
      isFollowing: !isFollowing,
      message,
      followedIssues: user.followedIssues,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Citizen Notifications
 * @route GET /api/citizen/dashboard/notifications
 * @access Citizen Protected
 */
export const getNotifications = async (req, res, next) => {
  try {
    const citizenId = req.citizen.citizenId;

    const notifications = await CitizenNotification.find({ citizenUserId: citizenId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const unreadCount = await CitizenNotification.countDocuments({
      citizenUserId: citizenId,
      isRead: false,
    });

    return res.status(200).json({
      success: true,
      unreadCount,
      data: notifications,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark a Notification as Read
 * @route PATCH /api/citizen/dashboard/notifications/:id/read
 * @access Citizen Protected
 */
export const markNotificationRead = async (req, res, next) => {
  try {
    const citizenId = req.citizen.citizenId;
    const { id } = req.params;

    const notif = await CitizenNotification.findOneAndUpdate(
      { _id: id, citizenUserId: citizenId },
      { $set: { isRead: true } },
      { new: true }
    );

    if (!notif) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found.',
      });
    }

    return res.status(200).json({
      success: true,
      data: notif,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark All Notifications as Read
 * @route POST /api/citizen/dashboard/notifications/read-all
 * @access Citizen Protected
 */
export const markAllNotificationsRead = async (req, res, next) => {
  try {
    const citizenId = req.citizen.citizenId;

    await CitizenNotification.updateMany(
      { citizenUserId: citizenId, isRead: false },
      { $set: { isRead: true } }
    );

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read.',
    });
  } catch (error) {
    next(error);
  }
};
