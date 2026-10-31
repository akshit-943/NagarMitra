/**
 * CivicPulse AI — Cloudflare Turnstile CAPTCHA Verification Service
 * 
 * Validates Turnstile tokens with Cloudflare's siteverify endpoint.
 * In local development, supports Cloudflare's official dummy test keys
 * and explicitly labelled development testing tokens.
 */

const CLOUDFLARE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
// Cloudflare's official always-pass test secret key
const CLOUDFLARE_TEST_SECRET = '1x0000000000000000000000000000000AA';

export async function verifyCaptchaToken(token, clientIp = '') {
  if (!token || typeof token !== 'string' || !token.trim()) {
    return {
      success: false,
      message: 'CAPTCHA verification token is missing. Please complete the human verification check.',
    };
  }

  const secretKey = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY || CLOUDFLARE_TEST_SECRET;
  const isDev = process.env.NODE_ENV !== 'production';

  // Explicitly reject invalid test tokens
  if (token.includes('invalid') || token.includes('fail') || token === '2x0000000000000000000000000000000AA') {
    return {
      success: false,
      message: 'CAPTCHA verification failed. Human challenge rejected.',
    };
  }

  // Local development / mock token support for automated tests and offline dev
  if (token === 'DEV_MOCK_TURNSTILE_PASS' || token === 'XXXX.DUMMY.TOKEN.XXXX') {
    if (isDev) {
      console.log('[DEV MODE ONLY] CAPTCHA verified using explicitly labelled development mock token.');
      return {
        success: true,
        isDevSimulation: true,
        message: 'CAPTCHA verified (development simulation).',
      };
    } else {
      return {
        success: false,
        message: 'Mock CAPTCHA tokens are strictly prohibited in production environment.',
      };
    }
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token.trim());
    if (clientIp) {
      formData.append('remoteip', clientIp);
    }

    const response = await fetch(CLOUDFLARE_VERIFY_URL, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!response.ok) {
      // In development mode, if Cloudflare verification fails due to network/firewall or test secret
      if (isDev && secretKey === CLOUDFLARE_TEST_SECRET) {
        console.warn(`[DEV MODE] Cloudflare Turnstile HTTP error (${response.status}). Development fallback active.`);
        return {
          success: true,
          isDevSimulation: true,
          message: 'Development fallback validation.',
        };
      }
      return {
        success: false,
        message: `CAPTCHA verification service returned HTTP ${response.status}.`,
      };
    }

    const data = await response.json();

    if (data.success) {
      return {
        success: true,
        hostname: data.hostname,
        challenge_ts: data.challenge_ts,
      };
    } else {
      const errorCodes = data['error-codes'] ? data['error-codes'].join(', ') : 'Verification rejected';
      
      // In local dev with test secret, handle explicit test pass tokens
      if (isDev && secretKey === CLOUDFLARE_TEST_SECRET && (token.startsWith('dev_pass_') || token === '1x0000000000000000000000000000000AA')) {
        console.warn(`[DEV MODE] Turnstile test key rejected (${errorCodes}). Allowing dev verification.`);
        return {
          success: true,
          isDevSimulation: true,
          message: 'Development test bypass active.',
        };
      }

      return {
        success: false,
        message: `CAPTCHA verification failed (${errorCodes}). Please try again.`,
        errorCodes: data['error-codes'],
      };
    }
  } catch (error) {
    console.error('Turnstile verification error:', error.message);
    if (isDev) {
      console.warn('[DEV MODE] Network error verifying CAPTCHA with Cloudflare. Allowing local development pass.');
      return {
        success: true,
        isDevSimulation: true,
        message: 'Local development network error fallback.',
      };
    }
    return {
      success: false,
      message: 'CAPTCHA provider is currently unreachable. Please try again shortly.',
      error: error.message,
    };
  }
}
