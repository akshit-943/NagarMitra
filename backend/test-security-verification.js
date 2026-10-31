/**
 * CivicPulse AI - Focused Verification Test Suite
 * Covers Authority Security, Mandatory Citizen Verification,
 * Real Live Map Integration, Location Capture, and Navigation Cleanup.
 */

import http from 'http';

const BASE_URL = 'http://localhost:5000';

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, text: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log(' CIVICPULSE AI — 23 TARGETED VERIFICATION TESTS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(testNum, title, condition, details = '') {
    if (condition) {
      console.log(`[PASS] Test ${testNum}: ${title}`);
      passed++;
    } else {
      console.error(`[FAIL] Test ${testNum}: ${title} - ${details}`);
      failed++;
    }
  }

  try {
    // ----------------------------------------------------
    // GROUP 1: AUTHORITY AUTHENTICATION & ACCESS CONTROL
    // ----------------------------------------------------
    console.log('--- Group 1: Authority Authentication & Security ---');

    // Test 1: Unauthenticated request to /api/master-issues/analytics blocked
    const t1 = await makeRequest('GET', '/api/master-issues/analytics');
    assert(1, 'Unauthenticated request to authority analytics blocked (HTTP 401)', t1.status === 401);

    // Test 2: Unauthenticated request to status transition endpoint blocked
    const t2 = await makeRequest('PATCH', '/api/complaints/CMP-DUMMY/status', { status: 'In Progress' });
    assert(2, 'Unauthenticated request to complaint status transition blocked (HTTP 401)', t2.status === 401);

    // Test 3: Authority login with invalid credentials rejected
    const t3 = await makeRequest('POST', '/api/auth/authority/login', {
      authorityId: 'AUTH-ADMIN-01',
      password: 'WrongPassword123!',
    });
    assert(3, 'Authority login with invalid password rejected (HTTP 401)', t3.status === 401);

    // Test 4: Authority login with valid credentials succeeds and returns JWT
    const t4 = await makeRequest('POST', '/api/auth/authority/login', {
      authorityId: 'AUTH-ADMIN-01',
      password: 'CivicPulse@2026',
    });
    const authToken = t4.data?.token;
    assert(
      4,
      'Authority login with valid credentials succeeds (HTTP 200, JWT returned)',
      t4.status === 200 && Boolean(authToken) && t4.data?.user?.role === 'Municipal Administrator'
    );

    // Test 5: Authenticated authority user can access protected analytics endpoint
    const t5 = await makeRequest('GET', '/api/master-issues/analytics', null, {
      Authorization: `Bearer ${authToken}`,
    });
    assert(5, 'Authenticated authority user accesses analytics endpoint (HTTP 200)', t5.status === 200);

    // Test 6: Public citizen read access to /api/complaints works login-free
    const t6 = await makeRequest('GET', '/api/complaints');
    assert(6, 'Citizens can query complaint registry login-free without credentials (HTTP 200)', t6.status === 200 && Array.isArray(t6.data?.data));

    // ----------------------------------------------------
    // GROUP 2: MANDATORY CITIZEN VERIFICATION (CAPTCHA + OTP)
    // ----------------------------------------------------
    console.log('\n--- Group 2: Mandatory Citizen Verification (CAPTCHA + OTP) ---');

    // Test 7: Complaint submission without verificationToken blocked
    const t7 = await makeRequest('POST', '/api/complaints', {
      category: 'Roadways & Pavement',
      description: 'Dangerous pothole at 4th and Main',
      location: { address: '4th and Main St', latitude: 37.7749, longitude: -122.4194 },
    });
    assert(7, 'Complaint submission without verificationToken blocked (HTTP 400)', t7.status === 400);

    // Test 8: Complaint submission with invalid verificationToken blocked
    const t8 = await makeRequest('POST', '/api/complaints', {
      category: 'Roadways & Pavement',
      description: 'Dangerous pothole at 4th and Main',
      location: { address: '4th and Main St', latitude: 37.7749, longitude: -122.4194 },
      verificationToken: 'invalid-fake-token-xyz',
    });
    assert(8, 'Complaint submission with invalid verificationToken blocked (HTTP 400)', t8.status === 400);

    // Test 9: Request OTP without CAPTCHA token blocked
    const t9 = await makeRequest('POST', '/api/verification/request-otp', {
      phone: '+14155550199',
    });
    assert(9, 'Request OTP without CAPTCHA token blocked (HTTP 400)', t9.status === 400);

    // Test 10: Request OTP with invalid CAPTCHA token rejected
    const t10 = await makeRequest('POST', '/api/verification/request-otp', {
      phone: '+14155550198',
      captchaToken: 'invalid_turnstile_token',
    });
    assert(10, 'Request OTP with bad captcha rejected with HTTP 400', t10.status === 400);

    // Test 11: Request OTP with dev mock CAPTCHA succeeds and returns masked phone
    const testPhone = `+1415555${Math.floor(1000 + Math.random() * 9000)}`;
    const t11 = await makeRequest('POST', '/api/verification/request-otp', {
      phone: testPhone,
      captchaToken: 'DEV_MOCK_TURNSTILE_PASS',
    });
    assert(
      11,
      'Request OTP with valid CAPTCHA succeeds with masked phone & simulated OTP in dev',
      t11.status === 200 && Boolean(t11.data?.phoneMasked)
    );
    const simulatedOtp = t11.data?.simulatedOtp;

    // Test 12: Verify OTP with incorrect code rejected
    const t12 = await makeRequest('POST', '/api/verification/verify-otp', {
      phone: testPhone,
      otp: '000000',
    });
    assert(12, 'Verify OTP with wrong code rejected (HTTP 400)', t12.status === 400);

    // Test 13: Verify OTP with correct code succeeds and returns single-use verificationToken
    const t13 = await makeRequest('POST', '/api/verification/verify-otp', {
      phone: testPhone,
      otp: simulatedOtp || '123456',
    });
    const verificationToken = t13.data?.verificationToken;
    assert(
      13,
      'Verify OTP with correct code returns verificationToken (HTTP 200)',
      t13.status === 200 && Boolean(verificationToken)
    );

    // Test 14: Submit complaint with valid verificationToken succeeds and returns trackingToken
    const t14 = await makeRequest('POST', '/api/complaints', {
      category: 'Roadways & Pavement',
      description: 'Pothole verification test for CivicPulse security audit',
      location: {
        address: '500 Howard Street, San Francisco, CA',
        latitude: 37.7885,
        longitude: -122.3980,
      },
      locationSource: 'gps',
      verificationToken: verificationToken,
    });
    const createdComplaintId = t14.data?.data?.complaintId;
    const trackingToken = t14.data?.trackingToken || t14.data?.data?.trackingToken;
    assert(
      14,
      'Complaint submission with valid verificationToken succeeds with trackingToken (HTTP 201)',
      t14.status === 201 && Boolean(createdComplaintId) && Boolean(trackingToken)
    );

    // Test 15: Replay prevention: Same verificationToken cannot be reused for a second complaint
    const t15 = await makeRequest('POST', '/api/complaints', {
      category: 'Sanitation & Waste',
      description: 'Attempted replay submission',
      location: { address: '123 Market St', latitude: 37.78, longitude: -122.40 },
      verificationToken: verificationToken,
    });
    assert(15, 'Single-use token enforcement: Replay submission blocked (HTTP 400)', t15.status === 400);

    // ----------------------------------------------------
    // GROUP 3: SECURE COMPLAINT TRACKING & PII PROTECTION
    // ----------------------------------------------------
    console.log('\n--- Group 3: Secure Complaint Tracking & PII Protection ---');

    // Test 16: Access /api/complaints/track/:id without token blocked
    const t16 = await makeRequest('GET', `/api/complaints/track/${createdComplaintId}`);
    assert(16, 'Secure tracking endpoint without token rejected (HTTP 403)', t16.status === 403);

    // Test 17: Access /api/complaints/track/:id with wrong token blocked
    const t17 = await makeRequest('GET', `/api/complaints/track/${createdComplaintId}?token=wrong-token-123`);
    assert(17, 'Secure tracking endpoint with wrong token rejected (HTTP 403)', t17.status === 403);

    // Test 18: Access /api/complaints/track/:id with correct trackingToken succeeds
    const t18 = await makeRequest('GET', `/api/complaints/track/${createdComplaintId}?token=${trackingToken}`);
    assert(
      18,
      'Secure tracking endpoint with correct token succeeds (HTTP 200, isOwner: true)',
      t18.status === 200 && t18.data?.isOwner === true && Boolean(t18.data?.data?.verifiedPhone || t18.data?.verifiedPhone)
    );

    // Test 19: Public /api/complaints/:id endpoint omits trackingToken and masks phone
    const t19 = await makeRequest('GET', `/api/complaints/${createdComplaintId}`);
    const publicData = t19.data?.data;
    assert(
      19,
      'Public complaint details endpoint omits trackingToken from response',
      t19.status === 200 && publicData?.trackingToken === undefined
    );

    // ----------------------------------------------------
    // GROUP 4: LOCATION CAPTURE & GEOLOCATION
    // ----------------------------------------------------
    console.log('\n--- Group 4: Location Capture & Geocoding Methods ---');

    // Test 20: Complaint saved with locationSource
    assert(
      20,
      'Complaint records persist locationSource (e.g. gps / map_selection / geocoding)',
      publicData?.locationSource === 'gps' || publicData?.location?.locationSource === 'gps'
    );

    // Test 21: OpenStreetMap coordinates valid
    assert(
      21,
      'Stored complaint coordinates have valid latitude and longitude for OpenStreetMap rendering',
      typeof publicData?.location?.latitude === 'number' && typeof publicData?.location?.longitude === 'number'
    );

    // ----------------------------------------------------
    // GROUP 5: SYSTEM HEALTH & NAVIGATION INTEGRITY
    // ----------------------------------------------------
    console.log('\n--- Group 5: Backend Health & Navigation Cleanup ---');

    // Test 22: Backend /api/health endpoint intact and healthy
    const t22 = await makeRequest('GET', '/api/health');
    assert(22, 'Internal backend /api/health endpoint operational (HTTP 200)', t22.status === 200 && t22.data?.status === 'ok');

    // Test 23: Root /health endpoint operational
    const t23 = await makeRequest('GET', '/health');
    assert(23, 'Internal backend root /health endpoint operational (HTTP 200)', t23.status === 200 && t23.data?.status === 'ok');

  } catch (err) {
    console.error('Fatal test execution error:', err);
    failed++;
  }

  console.log('\n====================================================');
  console.log(` SUMMARY: ${passed} PASSED / ${failed} FAILED (Total ${passed + failed})`);
  console.log('====================================================');

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
