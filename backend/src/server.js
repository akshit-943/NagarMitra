import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRouter from './routes/api.js';
import { connectDB } from './config/db.js';
import { errorHandler } from './middleware/errorHandler.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Parse configured client origins (supports comma-separated list and normalizes trailing slashes)
const configuredOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map((url) => url.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  ...configuredOrigins,
];

const isOriginAllowed = (origin) => {
  if (!origin) return true; // Allow mobile apps, curl, postman, and server-to-server calls

  const normalizedOrigin = origin.trim().replace(/\/+$/, '');

  // 1. Explicitly configured origins (including CLIENT_URL and local ports)
  if (defaultAllowedOrigins.includes(normalizedOrigin)) {
    return true;
  }

  // 2. Any local development origin on any port
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalizedOrigin)) {
    return true;
  }

  // 3. Deployed Vercel domains (*.vercel.app including preview and production deployments)
  if (/^https:\/\/[a-z0-9\-]+(\.[a-z0-9\-]+)*\.vercel\.app$/i.test(normalizedOrigin)) {
    return true;
  }

  // 4. Deployed Render backend self-origin
  if (/^https:\/\/[a-z0-9\-]+\.onrender\.com$/i.test(normalizedOrigin)) {
    return true;
  }

  return false;
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Verification-Token',
    'x-verification-token',
    'x-mock-ai',
    'Accept',
    'Origin',
    'X-Requested-With',
    'Cache-Control',
    'Pragma',
  ],
  optionsSuccessStatus: 204,
};

// Middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger for diagnostic tracing
app.use((req, res, next) => {
  if (!req.url.startsWith('/health')) {
    console.log(`📡 [${req.method}] ${req.url}`);
  }
  next();
});

// Root health-check / ping
app.get('/', (req, res) => {
  res.json({ message: 'NagarMitra API server is running.' });
});
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'NagarMitra Backend API' });
});

// API Routes
app.use('/api', apiRouter);

// Error Handling Middleware
app.use(errorHandler);

import { seedAuthorityUsers } from './utils/seedAuthorityUsers.js';

// Connect Database (non-blocking for foundation check)
connectDB().then((connected) => {
  if (connected) {
    seedAuthorityUsers();
  }
});

// Start Server
const server = app.listen(PORT, () => {
  console.log(`🚀 [CivicPulse Backend] Server running in ${process.env.NODE_ENV || 'development'} mode on http://localhost:${PORT}`);
});

export default app;
