import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'civicpulse_authority_jwt_secret_2026';

/**
 * Authentication middleware for Authority Personnel
 * Protects authority operations (status changes, assignments, notes, evidence)
 */
export const authenticateAuthority = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Authority access required. No authentication token provided.',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Strict Security Isolation: Citizen accounts must never access authority endpoints
    if (decoded.role === 'Citizen' || decoded.citizenId || !decoded.authorityId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. Citizen accounts are not authorized to access Municipal Authority operations.',
      });
    }

    req.authority = decoded;
    req.user = decoded; // For backwards compatibility
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired authority session token.',
      error: error.message,
    });
  }
};

/**
 * Role-Based Access Control Middleware
 * @param {string[]} allowedRoles
 */
export const requireRole = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.authority) {
      return res.status(401).json({
        success: false,
        message: 'Authority authentication required.',
      });
    }

    if (!allowedRoles || allowedRoles.length === 0) {
      return next();
    }

    if (!allowedRoles.includes(req.authority.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden. Role '${req.authority.role}' does not have sufficient permission for this administrative action. Required: ${allowedRoles.join(', ')}`,
      });
    }

    next();
  };
};

export const authenticate = authenticateAuthority; // alias for backwards compatibility
export default authenticateAuthority;
