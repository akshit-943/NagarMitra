import fetch from 'node-fetch';

const API_BASE = 'http://localhost:5000/api';

async function runTests() {
  console.log('🧪 Starting Citizen Authentication & Dashboard Verification Tests...');

  const timestamp = Date.now();
  const testEmail = `citizen_${timestamp}@civicpulse.test`;
  const testPhone = `+1${String(timestamp).slice(-10)}`;
  const testPassword = 'Password123!';

  // 1. Citizen Registration (NO OTP)
  console.log('\n--- Test 1: Citizen Registration (No OTP) ---');
  const regRes = await fetch(`${API_BASE}/citizen/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Jane Citizen',
      email: testEmail,
      phone: testPhone,
      password: testPassword,
      confirmPassword: testPassword,
    }),
  });
  const regData = await regRes.json();
  console.log('Register Response Status:', regRes.status, 'Success:', regData.success);
  if (!regData.success || !regData.token) {
    throw new Error(`Registration failed: ${JSON.stringify(regData)}`);
  }
  const citizenToken = regData.token;
  const citizenId = regData.user.id;
  console.log('✅ Registered citizen successfully. Token received.');

  // 2. Citizen Login (Email + Password, No OTP)
  console.log('\n--- Test 2: Citizen Login (Email) ---');
  const loginRes = await fetch(`${API_BASE}/citizen/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: testEmail,
      password: testPassword,
    }),
  });
  const loginData = await loginRes.json();
  console.log('Login Response Status:', loginRes.status, 'Success:', loginData.success);
  if (!loginData.success || !loginData.token) {
    throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
  }
  console.log('✅ Citizen login with email succeeded.');

  // 3. Citizen Login (Phone + Password)
  console.log('\n--- Test 3: Citizen Login (Phone) ---');
  const loginPhoneRes = await fetch(`${API_BASE}/citizen/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: testPhone,
      password: testPassword,
    }),
  });
  const loginPhoneData = await loginPhoneRes.json();
  console.log('Login Phone Status:', loginPhoneRes.status, 'Success:', loginPhoneData.success);
  if (!loginPhoneData.success) {
    throw new Error('Login with phone failed');
  }
  console.log('✅ Citizen login with mobile number succeeded.');

  // 4. Authority Route Access Denied for Citizen Token (Security Isolation)
  console.log('\n--- Test 4: Authority Route Protection (Citizen Token Blocked) ---');
  const authRouteRes = await fetch(`${API_BASE}/master-issues/MI-TEST/notes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${citizenToken}`,
    },
    body: JSON.stringify({ note: 'Sneaky note' }),
  });
  console.log('Authority Endpoint with Citizen Token Status:', authRouteRes.status);
  if (authRouteRes.status !== 401 && authRouteRes.status !== 403) {
    throw new Error(`Expected 401 or 403 for Citizen token on Authority route, got ${authRouteRes.status}`);
  }
  console.log(`✅ Security isolation verified: Citizen token denied (${authRouteRes.status}) on Authority endpoints.`);

  // 5. Guest Complaint Submission (No Auth, No OTP)
  console.log('\n--- Test 5: Guest Complaint Submission (No Account, No OTP) ---');
  const guestComplaintRes = await fetch(`${API_BASE}/complaints`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-mock-ai': 'true',
    },
    body: JSON.stringify({
      category: 'Roadways & Pavement',
      description: 'Pothole on 5th avenue guest submission test verification.',
      location: { address: '5th Ave & Market St' },
      phone: '+15551234567',
    }),
  });
  const guestData = await guestComplaintRes.json();
  console.log('Guest Complaint Status:', guestComplaintRes.status, 'Success:', guestData.success);
  if (!guestData.success || !guestData.data.complaintId || !guestData.data.trackingToken) {
    throw new Error(`Guest complaint submission failed: ${JSON.stringify(guestData)}`);
  }
  const guestComplaintId = guestData.data.complaintId;
  const guestTrackingToken = guestData.data.trackingToken;
  console.log(`✅ Guest complaint created: #${guestComplaintId}, Tracking Token: ${guestTrackingToken.slice(0, 8)}...`);

  // 6. Claim Guest Complaint into Citizen Account
  console.log('\n--- Test 6: Claim Guest Complaint into Registered Dashboard ---');
  const claimRes = await fetch(`${API_BASE}/citizen/dashboard/claim-complaint`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${citizenToken}`,
    },
    body: JSON.stringify({
      complaintId: guestComplaintId,
      trackingToken: guestTrackingToken,
    }),
  });
  const claimData = await claimRes.json();
  console.log('Claim Status:', claimRes.status, 'Success:', claimData.success);
  if (!claimData.success) {
    throw new Error(`Claim complaint failed: ${JSON.stringify(claimData)}`);
  }
  console.log('✅ Guest complaint claimed into citizen dashboard.');

  // 7. Reject Claiming with Wrong Tracking Token
  console.log('\n--- Test 7: Reject Claim with Invalid Tracking Token ---');
  const wrongClaimRes = await fetch(`${API_BASE}/citizen/dashboard/claim-complaint`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${citizenToken}`,
    },
    body: JSON.stringify({
      complaintId: guestComplaintId,
      trackingToken: 'wrong-token-1234',
    }),
  });
  console.log('Wrong Token Claim Status:', wrongClaimRes.status);
  if (wrongClaimRes.status !== 401) {
    throw new Error(`Expected 401 for wrong tracking token, got ${wrongClaimRes.status}`);
  }
  console.log('✅ Invalid tracking token correctly rejected with HTTP 401.');

  // 8. Citizen Dashboard Overview & Complaints List
  console.log('\n--- Test 8: Fetch Citizen Dashboard Overview & Personal Complaints ---');
  const dashRes = await fetch(`${API_BASE}/citizen/dashboard/overview`, {
    headers: { Authorization: `Bearer ${citizenToken}` },
  });
  const dashData = await dashRes.json();
  console.log('Dashboard Overview Status:', dashRes.status, 'Success:', dashData.success);
  console.log('Stats:', dashData.data?.stats);
  if (!dashData.success || dashData.data.stats.totalComplaints < 1) {
    throw new Error('Dashboard overview should reflect claimed complaint');
  }
  console.log('✅ Personal dashboard overview reflects claimed complaint correctly.');

  // 9. Citizen Notifications
  console.log('\n--- Test 9: Fetch Citizen Notifications ---');
  const notifRes = await fetch(`${API_BASE}/citizen/dashboard/notifications`, {
    headers: { Authorization: `Bearer ${citizenToken}` },
  });
  const notifData = await notifRes.json();
  console.log('Notifications Status:', notifRes.status, 'Count:', notifData.data?.length, 'Unread:', notifData.unreadCount);
  if (!notifData.success || notifData.data.length < 1) {
    throw new Error('Expected at least welcome and claim notifications');
  }
  console.log('✅ Citizen notifications generated and retrieved successfully.');

  console.log('\n🎉 ALL CITIZEN BACKEND TESTS PASSED CLEANLY!\n');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
