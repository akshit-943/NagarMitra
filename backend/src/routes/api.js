import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import complaintRoutes from './complaintRoutes.js';
import masterIssueRoutes from './masterIssueRoutes.js';
import transparencyRoutes from './transparencyRoutes.js';
import authRoutes from './authRoutes.js';
import verificationRoutes from './verificationRoutes.js';
import citizenRoutes from './citizenRoutes.js';

const router = Router();

// Route modules
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/verification', verificationRoutes);
router.use('/citizen', citizenRoutes);
router.use('/complaints', complaintRoutes);
router.use('/master-issues', masterIssueRoutes);
router.use('/transparency', transparencyRoutes);

export default router;
