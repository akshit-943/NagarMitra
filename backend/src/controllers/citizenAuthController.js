import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import CitizenUser from '../models/CitizenUser.js';
import CitizenNotification from '../models/CitizenNotification.js';

const JWT_SECRET = process.env.CITIZEN_JWT_SECRET || process.env.JWT_SECRET || 'civicpulse_citizen_jwt_secret_2026';
const JWT_EXPIRES_IN = process.env.CITIZEN_JWT_EXPIRES_IN || '30d';

/**
 * Register a new Citizen Account
 * @route POST /api/citizen/auth/register
 * @access Public (No OTP, No Email verification required)
 */
export const registerCitizen = async (req, res, next) => {
  try {
    const { name, email, phone, password, confirmPassword } = req.body;

    // Field presence checks
    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'All fields (name, email, mobile number, password) are required.',
      });
    }

    const trimmedName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.replace(/[\s-]/g, '').trim();

    if (trimmedName.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Full name must be at least 2 characters.',
      });
    }

    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.',
      });
    }

    const phoneRegex = /^\+?[0-9]{7,15}$/;
    if (!phoneRegex.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid mobile number (7–15 digits).',
      });
    }

    if (confirmPassword !== undefined && password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Password and confirm password do not match.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    // Check if email is already registered
    const existingEmail = await CitizenUser.findOne({ email: cleanEmail });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email address already exists. Please log in.',
      });
    }

    // Check if phone number is already registered
    const existingPhone = await CitizenUser.findOne({ phone: cleanPhone });
    if (existingPhone) {
      return res.status(400).json({
        success: false,
        message: 'An account with this mobile number already exists. Please log in.',
      });
    }

    // Secure password hashing
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await CitizenUser.create({
      name: trimmedName,
      email: cleanEmail,
      phone: cleanPhone,
      passwordHash,
      followedIssues: [],
    });

    // Create a welcoming notification in citizen's inbox
    try {
      await CitizenNotification.create({
        citizenUserId: newUser._id,
        title: 'Welcome to CivicPulse AI',
        message: 'Your personal citizen dashboard is ready. Report issues, follow neighborhood initiatives, and track resolution timelines in real time.',
        type: 'announcement',
      });
    } catch {
      // Non-blocking
    }

    // Sign JWT
    const payload = {
      citizenId: newUser._id.toString(),
      userId: newUser._id.toString(),
      name: newUser.name,
      email: newUser.email,
      phone: newUser.phone,
      role: 'Citizen',
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    return res.status(201).json({
      success: true,
      message: 'Citizen registration successful. Welcome to CivicPulse AI.',
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        role: 'Citizen',
        createdAt: newUser.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Citizen Login (Email or Mobile Number + Password)
 * @route POST /api/citizen/auth/login
 * @access Public (No OTP required)
 */
export const loginCitizen = async (req, res, next) => {
  try {
    const rawIdentifier = req.body.identifier || req.body.email || req.body.phone;
    const { password } = req.body;

    if (!rawIdentifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email address or mobile number and password are required.',
      });
    }

    const cleanIdentifier = String(rawIdentifier).trim();
    const cleanPhone = cleanIdentifier.replace(/[\s-]/g, '');

    // Search by email or mobile phone
    const user = await CitizenUser.findOne({
      $or: [
        { email: cleanIdentifier.toLowerCase() },
        { phone: cleanPhone },
        { phone: cleanIdentifier },
      ],
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. No account found with that email or mobile number.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'This citizen account has been deactivated.',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Incorrect password.',
      });
    }

    // Sign JWT
    const payload = {
      citizenId: user._id.toString(),
      userId: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: 'Citizen',
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    return res.status(200).json({
      success: true,
      message: 'Welcome back!',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: 'Citizen',
        followedIssues: user.followedIssues || [],
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Authenticated Citizen Profile
 * @route GET /api/citizen/auth/me
 * @access Citizen Protected
 */
export const getCitizenProfile = async (req, res, next) => {
  try {
    const citizenId = req.citizen.citizenId;
    const user = await CitizenUser.findById(citizenId).select('-passwordHash').lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Citizen account not found.',
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
 * Update Citizen Profile (Name, Phone)
 * @route PUT /api/citizen/auth/profile
 * @access Citizen Protected
 */
export const updateCitizenProfile = async (req, res, next) => {
  try {
    const citizenId = req.citizen.citizenId;
    const { name, phone } = req.body;

    const user = await CitizenUser.findById(citizenId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Citizen account not found.',
      });
    }

    if (name && name.trim().length >= 2) {
      user.name = name.trim();
    }

    if (phone) {
      const cleanPhone = phone.replace(/[\s-]/g, '').trim();
      const phoneRegex = /^\+?[0-9]{7,15}$/;
      if (!phoneRegex.test(cleanPhone)) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid mobile number (7–15 digits).',
        });
      }

      // Check if another account has this phone
      const phoneTaken = await CitizenUser.findOne({
        phone: cleanPhone,
        _id: { $ne: user._id },
      });
      if (phoneTaken) {
        return res.status(400).json({
          success: false,
          message: 'This mobile number is already in use by another account.',
        });
      }

      user.phone = cleanPhone;
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: 'Citizen',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Change Citizen Password
 * @route PUT /api/citizen/auth/change-password
 * @access Citizen Protected
 */
export const changeCitizenPassword = async (req, res, next) => {
  try {
    const citizenId = req.citizen.citizenId;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required.',
      });
    }

    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password and confirmation do not match.',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long.',
      });
    }

    const user = await CitizenUser.findById(citizenId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Citizen account not found.',
      });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect.',
      });
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Forgot Password Notice / Recovery Guideline
 * @route POST /api/citizen/auth/forgot-password
 * @access Public
 */
export const forgotPassword = async (req, res) => {
  const { identifier } = req.body;
  return res.status(200).json({
    success: true,
    message: `Account recovery request received for '${identifier || 'user'}'. Automated email reset requires an active SMTP provider configured in your municipal deployment environment. If you need assistance, please contact your municipal support desk or re-register.`,
  });
};
