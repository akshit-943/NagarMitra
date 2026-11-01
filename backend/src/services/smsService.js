import crypto from 'crypto';

/**
 * Mask a phone number for privacy in logs and user interfaces
 * Example: +919876543210 -> +91 98****3210
 */
export function maskPhoneNumber(phone = '') {
  const cleaned = String(phone).trim();
  if (cleaned.length < 8) return '****';
  const prefix = cleaned.slice(0, cleaned.length - 6);
  const suffix = cleaned.slice(-4);
  return `${prefix}****${suffix}`;
}

/**
 * Hash an OTP using SHA-256 with a unique salt
 */
export function hashOtp(otp, salt) {
  return crypto.createHash('sha256').update(`${otp}:${salt}`).digest('hex');
}

/**
 * Generate a cryptographically secure 6-digit OTP and random salt
 */
export function generateSecureOtp() {
  const otpNumber = crypto.randomInt(100000, 1000000); // 100000 to 999999
  const otp = String(otpNumber);
  const salt = crypto.randomBytes(16).toString('hex');
  const otpHash = hashOtp(otp, salt);
  return { otp, salt, otpHash };
}

/**
 * Dispatch an SMS OTP to a citizen's mobile number
 * 
 * Supports:
 * - Twilio SMS provider (if TWILIO_ACCOUNT_SID & TWILIO_AUTH_TOKEN configured)
 * - Development Mock Mode (when no SMS credentials exist and NODE_ENV !== 'production')
 */
export async function sendOtpSms({ phone, otp }) {
  const isDev = process.env.NODE_ENV !== 'production';
  const masked = maskPhoneNumber(phone);

  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_PHONE_NUMBER;

  // 1. Real SMS Provider: Twilio
  if (twilioSid && twilioAuthToken && twilioFrom) {
    try {
      const auth = Buffer.from(`${twilioSid}:${twilioAuthToken}`).toString('base64');
      const bodyParams = new URLSearchParams({
        To: phone,
        From: twilioFrom,
        Body: `NagarMitra: Your verification code is ${otp}. Valid for 5 minutes. Do not share.`,
      });

      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: bodyParams,
        }
      );

      const twilioData = await response.json();
      if (!response.ok) {
        throw new Error(twilioData.message || `Twilio error HTTP ${response.status}`);
      }

      console.log(`[SMS] OTP dispatched via Twilio to ${masked}. Message SID: ${twilioData.sid}`);
      return {
        success: true,
        provider: 'twilio',
        phoneMasked: masked,
        isDevSimulation: false,
      };
    } catch (err) {
      console.error(`[SMS] Failed to send real SMS to ${masked}:`, err.message);
      if (!isDev) {
        throw err;
      }
      // In dev, fall through to dev simulation if Twilio fails
      console.warn('[DEV MODE] Falling back to simulated OTP delivery due to Twilio error.');
    }
  }

  // 2. Development Simulation Mode
  if (isDev) {
    console.log('\n============================================================');
    console.log(' [DEV MODE ONLY - SIMULATED OTP DISPATCH]');
    console.log(` Recipient Mobile: ${masked} (${phone})`);
    console.log(` One-Time Code:    ${otp}`);
    console.log(' Valid for 5 minutes. Real SMS requires TWILIO credentials.');
    console.log('============================================================\n');

    return {
      success: true,
      provider: 'development-simulation',
      phoneMasked: masked,
      isDevSimulation: true,
      simulatedOtp: otp, // Strictly provided ONLY in development mode for localhost testing!
    };
  }

  // 3. In Production without SMS credentials configured
  throw new Error(
    'SMS dispatch service is not configured on this server. Please contact municipal administrators.'
  );
}
