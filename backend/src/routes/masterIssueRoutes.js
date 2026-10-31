import { Router } from 'express';
import {
  getMasterIssues,
  getMasterIssueById,
  getDemoOfficersEndpoint,
  assignMasterIssueEndpoint,
  updateMasterIssueStatus,
  addMasterIssueNoteEndpoint,
  uploadResolutionEvidenceEndpoint,
  verifyResolutionEndpoint,
  getMasterIssueActivityEndpoint,
  getAuthorityAnalyticsEndpoint,
  supportMasterIssueEndpoint,
  getCivicHotspotsEndpoint,
  getPrioritySummaryEndpoint,
  resolveDuplicateEndpoint,
} from '../controllers/masterIssueController.js';
import { handleResolutionEvidenceUpload } from '../middleware/upload.js';
import { authenticateAuthority } from '../middleware/auth.js';
import { optionalCitizenAuth } from '../middleware/citizenAuth.js';

const router = Router();

// Analytical and directory routes
router.get('/officers', authenticateAuthority, getDemoOfficersEndpoint);
router.get('/analytics', authenticateAuthority, getAuthorityAnalyticsEndpoint);
router.get('/hotspots', getCivicHotspotsEndpoint); // Publicly viewable for civic awareness
router.get('/priority/summary', getPrioritySummaryEndpoint);

// Collection routes
router.get('/', getMasterIssues);

// Single item routes
router.get('/:id', getMasterIssueById);
router.get('/:id/activity', getMasterIssueActivityEndpoint);

// Protected Authority Operations (Strictly require Authority JWT)
router.patch('/:id/assign', authenticateAuthority, assignMasterIssueEndpoint);
router.patch('/:id/status', authenticateAuthority, updateMasterIssueStatus);
router.post('/:id/notes', authenticateAuthority, addMasterIssueNoteEndpoint);
router.post('/:id/resolution-evidence', authenticateAuthority, handleResolutionEvidenceUpload, uploadResolutionEvidenceEndpoint);
router.post('/:id/resolve-duplicate', authenticateAuthority, resolveDuplicateEndpoint);

// Public Community Actions (Citizens can support or submit verification feedback)
router.post('/:id/support', optionalCitizenAuth, supportMasterIssueEndpoint);
router.post('/:id/verify', optionalCitizenAuth, verifyResolutionEndpoint);

export default router;
