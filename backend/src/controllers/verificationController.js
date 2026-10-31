import crypto from 'crypto';
import OtpVerification from '../models/OtpVerification.js';
import { verifyCaptchaToken } from '../services/captchaService.js';
import {
  generateSecureOtp,
  hashOtp,
  sendOtpSms,
  maskPhoneNumber,
} from '../services/smsService.js';

const E164_PHONE_REGEX = /^\+[1-9]\d{6,14}$/;

/**
 * Request Mobile OTP with mandatory CAPTCHA validation
 * @route POST /api/verification/request-otp
 * @access Public (Citizen)
 */
export const requestOtp = async (req, res, next) => {
  try {
    const { phone, captchaToken } = req.body;
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';

    // 1. Mandatory CAPTCHA Verification
    if (!captchaToken) {
      return res.status(400).json({
        success: false,
        message: 'CAPTCHA token is required before requesting an OTP verification code.',
      });
    }

    const captchaResult = await verifyCaptchaToken(captchaToken, clientIp);
    if (!captchaResult.success) {
      return res.status(400).json({
        success: false,
        message: captchaResult.message || 'CAPTCHA verification failed. Please complete the human check.',
      });
    }

    // 2. Validate Mobile Number (E.164 format)
    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Mobile number is required with country code (e.g. +91 9876543210).',
      });
    }

    const cleanPhone = phone.replace(/[\s-]/g, '');
    if (!E164_PHONE_REGEX.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid mobile number in international format with country code (e.g. +919876543210).',
      });
    }

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

    // 3. Rate Limiting: Resend cooldown (60s)
    const recentRecord = await OtpVerification.findOne({
      phone: cleanPhone,
      createdAt: { $gte: oneMinuteAgo },
    }).sort({ createdAt: -1 });

    if (recentRecord) {
      const elapsedSeconds = Math.floor((Date.now() - new Date(recentRecord.createdAt).getTime()) / 1000);
      const remainingSeconds = Math.max(1, 60 - elapsedSeconds);
      return res.status(429).json({
        success: false,
        message: `Please wait ${remainingSeconds} seconds before requesting another verification code.`,
        cooldownRemaining: remainingSeconds,
      });
    }

    // 4. Rate Limiting: Max 3 requests per 10 mins per phone
    const phoneCount = await OtpVerification.countDocuments({
      phone: cleanPhone,
      createdAt: { $gte: tenMinutesAgo },
    });

    if (phoneCount >= 3) {
      return res.status(429).json({
        success: false,
        message: 'Too many OTP requests for this mobile number. Please wait 10 minutes before retrying.',
      });
    }

    // 5. Generate secure 6-digit OTP
    const { otp, salt, otpHash } = generateSecureOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // 6. Save OTP record
    await OtpVerification.create({
      phone: cleanPhone,
      otpHash,
      salt,
      expiresAt,
      attempts: 0,
      verified: false,
      ip: clientIp,
    });

    // 7. Dispatch SMS
    const smsResult = await sendOtpSms({ phone: cleanPhone, otp });

    const isDev = process.env.NODE_ENV !== 'production';

    return res.status(200).json({
      success: true,
      message: `Verification code sent to ${maskPhoneNumber(cleanPhone)}.`,
      phoneMasked: maskPhoneNumber(cleanPhone),
      cooldownSeconds: 60,
      expiresInSeconds: 300,
      isDevSimulation: smsResult.isDevSimulation,
      // For localhost testing ONLY in development mode:
      simulatedOtp: isDev && smsResult.isDevSimulation ? smsResult.simulatedOtp : undefined,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify Citizen Mobile OTP
 * @route POST /api/verification/verify-otp
 * @access Public (Citizen)
 */
export const verifyOtp = async (req, res, next) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number and verification code are required.',
      });
    }

    const cleanPhone = String(phone).replace(/[\s-]/g, '');
    const cleanOtp = String(otp).trim();

    if (!/^\d{6}$/.test(cleanOtp)) {
      return res.status(400).json({
        success: false,
        message: 'Verification code must be exactly 6 digits.',
      });
    }

    // Find active unconsumed OTP for this phone
    const record = await OtpVerification.findOne({
      phone: cleanPhone,
      verified: false,
      consumed: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!record) {
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired or was not requested. Please request a new code.',
      });
    }

    // Enforce max 3 attempts
    if (record.attempts >= 3) {
      return res.status(400).json({
        success: false,
        message: 'Maximum verification attempts exceeded. Please request a new code.',
      });
    }

    record.attempts += 1;

    // Verify hash
    const candidateHash = hashOtp(cleanOtp, record.salt);
    if (candidateHash !== record.otpHash) {
      await record.save();
      const remaining = 3 - record.attempts;
      return res.status(400).json({
        success: false,
        message: remaining > 0
          ? `Invalid verification code. ${remaining} attempt(s) remaining.`
          : 'Invalid code. Maximum attempts exceeded. Please request a new code.',
      });
    }

    // Validated successfully: issue a single-use citizenVerificationToken
    const verificationToken = `VT-${Date.now()}-${crypto.randomBytes(24).toString('hex')}`;
    record.verified = true;
    record.verifiedAt = new Date();
    record.verificationToken = verificationToken;
    await record.save();

    return res.status(200).json({
      success: true,
      verified: true,
      message: 'Mobile number verified successfully.',
      verificationToken,
      phoneMasked: maskPhoneNumber(cleanPhone),
    });
  } catch (error) {
    next(error);
  }
};
