import { Router } from 'express';
import {
  createComplaint,
  getComplaints,
  getComplaintById,
  trackComplaint,
  updateComplaintStatus,
  getComplaintStats,
  triggerComplaintAiAnalysis,
  getComplaintDuplicates,
} from '../controllers/complaintController.js';
import { handleImageUpload } from '../middleware/upload.js';
import { authenticateAuthority } from '../middleware/auth.js';
import { optionalCitizenAuth } from '../middleware/citizenAuth.js';

const router = Router();

// Stats route (must be before /:id)
router.get('/stats', getComplaintStats);

// Secure tracking route (must be before /:id)
router.get('/track/:id', trackComplaint);

// Collection routes
router.post('/', handleImageUpload, optionalCitizenAuth, createComplaint);
router.get('/', getComplaints);

// Item routes
router.get('/:id', getComplaintById);
router.get('/:id/duplicates', getComplaintDuplicates);

// Protected Authority Action: Status change
router.patch('/:id/status', authenticateAuthority, updateComplaintStatus);
router.post('/:id/analyze', triggerComplaintAiAnalysis);

export default router;
