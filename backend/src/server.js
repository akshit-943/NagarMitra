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
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  process.env.CLIENT_URL,
].filter(Boolean);

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes(origin) ||
      /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
    ) {
      return callback(null, true);
    }
    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Verification-Token', 'x-verification-token', 'x-mock-ai'],
}));
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
