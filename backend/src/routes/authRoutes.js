import { Router } from 'express';
import {
  loginAuthority,
  getAuthorityProfile,
  logoutAuthority,
} from '../controllers/authController.js';
import { authenticateAuthority } from '../middleware/auth.js';

const router = Router();

// Authority authentication
router.post('/authority/login', loginAuthority);
router.get('/authority/me', authenticateAuthority, getAuthorityProfile);
router.post('/authority/logout', logoutAuthority);

export default router;
