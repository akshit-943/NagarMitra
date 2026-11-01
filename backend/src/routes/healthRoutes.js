import { Router } from 'express';
import { getDbStatus } from '../config/db.js';
import { getCloudinaryStatus } from '../config/cloudinary.js';

const router = Router();

/**
 * @route   GET /api/health
 * @desc    System health check endpoint with database, storage, and AI engine status
 * @access  Public
 */
router.get('/', (req, res) => {
  const db = getDbStatus();
  const cloudinary = getCloudinaryStatus();
  const geminiConfigured = Boolean(
    process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.includes('placeholder')
  );

  res.status(200).json({
    status: 'ok',
    service: 'NagarMitra Backend API',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: {
      connected: db.isConnected,
      readyState: db.readyState,
      host: db.host,
      database: db.database,
      mode: db.connectionMode,
      error: db.error,
    },
    mediaStorage: {
      provider: 'Cloudinary',
      configured: cloudinary.configured,
      cloudName: cloudinary.cloudName,
      statusMessage: cloudinary.statusMessage,
    },
    aiEngine: {
      provider: 'Google Gemini GenAI SDK',
      sdk: '@google/genai',
      configured: geminiConfigured,
      model: process.env.GEMINI_MODEL || 'gemini-3-flash-preview',
      visionEnabled: true,
    },
  });
});

export default router;
