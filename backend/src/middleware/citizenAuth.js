import jwt from 'jsonwebtoken';
import CitizenUser from '../models/CitizenUser.js';

const JWT_SECRET = process.env.CITIZEN_JWT_SECRET || process.env.JWT_SECRET || 'civicpulse_citizen_jwt_secret_2026';

/**
 * Middleware: Enforce Authenticated Registered Citizen
 * Validates JWT token from Bearer header and ensures role is 'Citizen'.
 */
export const authenticateCitizen = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Citizen authentication required. Please log in to your account.',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Verify token identity belongs strictly to a citizen
    if (!decoded.citizenId && !decoded.userId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid citizen token payload.',
      });
    }

    if (decoded.role && decoded.role !== 'Citizen') {
      return res.status(403).json({
        success: false,
        message: 'Authority tokens cannot be used to access citizen-specific endpoints.',
      });
    }

    const citizenId = decoded.citizenId || decoded.userId;
    req.citizen = {
      ...decoded,
      citizenId,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Citizen session expired or token invalid. Please log in again.',
      error: error.message,
    });
  }
};

/**
 * Middleware: Optional Citizen Auth
 * If a valid citizen Bearer token is passed, sets `req.citizen`.
 * If missing or invalid, proceeds without failing (supports guest workflow).
 */
export const optionalCitizenAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if ((decoded.citizenId || decoded.userId) && decoded.role === 'Citizen') {
      req.citizen = {
        ...decoded,
        citizenId: decoded.citizenId || decoded.userId,
      };
    }
  } catch {
    // Gracefully ignore token errors for guest callers
  }

  next();
};

export default authenticateCitizen;
