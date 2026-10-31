import { Router } from 'express';
import {
  registerCitizen,
  loginCitizen,
  getCitizenProfile,
  updateCitizenProfile,
  changeCitizenPassword,
  forgotPassword,
} from '../controllers/citizenAuthController.js';
import {
  getDashboardOverview,
  getMyComplaints,
  claimGuestComplaint,
  getFollowedIssues,
  toggleFollowIssue,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../controllers/citizenDashboardController.js';
import { authenticateCitizen } from '../middleware/citizenAuth.js';

const router = Router();

// ========================
// Citizen Auth Routes
// ========================
router.post('/auth/register', registerCitizen);
router.post('/auth/login', loginCitizen);
router.get('/auth/me', authenticateCitizen, getCitizenProfile);
router.put('/auth/profile', authenticateCitizen, updateCitizenProfile);
router.put('/auth/change-password', authenticateCitizen, changeCitizenPassword);
router.post('/auth/forgot-password', forgotPassword);

// ========================
// Citizen Dashboard Routes
// ========================
router.get('/dashboard/overview', authenticateCitizen, getDashboardOverview);
router.get('/dashboard/complaints', authenticateCitizen, getMyComplaints);
router.post('/dashboard/claim-complaint', authenticateCitizen, claimGuestComplaint);
router.get('/dashboard/followed-issues', authenticateCitizen, getFollowedIssues);
router.post('/dashboard/follow-issue', authenticateCitizen, toggleFollowIssue);
router.get('/dashboard/notifications', authenticateCitizen, getNotifications);
router.patch('/dashboard/notifications/:id/read', authenticateCitizen, markNotificationRead);
router.post('/dashboard/notifications/read-all', authenticateCitizen, markAllNotificationsRead);

export default router;
