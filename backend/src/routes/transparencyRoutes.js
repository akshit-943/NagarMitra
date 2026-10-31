import { Router } from 'express';
import {
  getTransparencyOverview,
  getCivicTrends,
  getDepartmentPerformance,
  getCivicImpactRecommendations,
  getPublicMasterIssues,
  getPublicIssueTimeline,
  downloadCivicImpactReportPdf,
} from '../controllers/transparencyController.js';

const router = Router();

// Public transparency analytics & reporting endpoints
router.get('/overview', getTransparencyOverview);
router.get('/trends', getCivicTrends);
router.get('/departments', getDepartmentPerformance);
router.get('/recommendations', getCivicImpactRecommendations);
router.get('/reports/impact-pdf', downloadCivicImpactReportPdf);

// Public issue transparency & audit browsing
router.get('/issues', getPublicMasterIssues);
router.get('/issues/:id/timeline', getPublicIssueTimeline);

export default router;
