import jwt from 'jsonwebtoken';
import AuthorityUser from '../models/AuthorityUser.js';

const JWT_SECRET = process.env.JWT_SECRET || 'civicpulse_authority_jwt_secret_2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';

/**
 * Authority Personnel Login
 * @route POST /api/auth/authority/login
 * @access Public (Authority gateway)
 */
export const loginAuthority = async (req, res, next) => {
  try {
    const rawId = req.body.authorityId || req.body.identifier || req.body.email;
    const { password } = req.body;

    if (!rawId || !password) {
      return res.status(400).json({
        success: false,
        message: 'Authority ID and password are required.',
      });
    }

    const cleanIdentifier = String(rawId).trim();
    // Search by authorityId or email
    const user = await AuthorityUser.findOne({
      $or: [
        { authorityId: cleanIdentifier.toUpperCase() },
        { email: cleanIdentifier.toLowerCase() },
      ],
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Authority credentials. Verification failed.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'This authority account has been deactivated. Contact the Municipal Administrator.',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Authority credentials. Verification failed.',
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Sign JWT
    const payload = {
      userId: user._id,
      authorityId: user.authorityId,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    return res.status(200).json({
      success: true,
      message: 'Authority authentication successful.',
      token,
      user: {
        authorityId: user.authorityId,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Authenticated Authority Profile
 * @route GET /api/auth/authority/me
 * @access Authority Only
 */
export const getAuthorityProfile = async (req, res, next) => {
  try {
    if (!req.authority) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    const user = await AuthorityUser.findById(req.authority.userId)
      .select('-passwordHash')
      .lean();

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Authority account is not active or not found.',
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Authority Personnel Logout
 * @route POST /api/auth/authority/logout
 * @access Public / Authority
 */
export const logoutAuthority = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Authority session terminated. Local tokens should be cleared.',
  });
};
