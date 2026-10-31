// Comprehensive end-to-end test for Citizen Complaint Submission & Dashboard Integration
import dotenv from 'dotenv';
dotenv.config();

const API_BASE = 'http://127.0.0.1:5000/api';

async function runTests() {
  console.log('🚀 Starting Citizen Dashboard Flow Integration Tests...\n');

  // Helper fetcher
  async function api(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, ok: res.ok, data };
  }

  const timestamp = Date.now();
  const citizenAEmail = `citizen_a_${timestamp}@example.com`;
  const citizenAPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
  const citizenBEmail = `citizen_b_${timestamp}@example.com`;
  const citizenBPhone = `97${Math.floor(10000000 + Math.random() * 90000000)}`;
  const password = 'Password@123';

  // 1. Register Citizen A
  console.log(`[1] Registering Citizen A (${citizenAEmail})...`);
  const regA = await api('/citizen/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Citizen Alpha',
      email: citizenAEmail,
      phone: citizenAPhone,
      password,
      confirmPassword: password
    })
  });

  if (!regA.ok || !regA.data?.token) {
    throw new Error(`Failed to register Citizen A: ${JSON.stringify(regA.data)}`);
  }
  const tokenA = regA.data.token;
  const userAId = regA.data.user.id;
  console.log(`✅ Citizen A registered successfully. ID: ${userAId}`);

  // Test A: Submit Complaint as Authenticated Citizen A
  console.log('\n[Test A] Submitting complaint as Citizen A with Authorization Bearer...');
  const complaintPayloadA = {
    category: 'Roadways & Pavement',
    description: `Major hazardous crater on 5th Avenue, test run ${timestamp}`,
    address: '5th Avenue Sector 4, Civic District',
    latitude: 18.5204,
    longitude: 73.8567,
    phone: citizenAPhone,
    department: 'Department of Transportation',
    reportedBy: 'Citizen Resident',
    severity: 'Critical'
  };

  const submitResA = await api('/complaints', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`
    },
    body: JSON.stringify(complaintPayloadA)
  });

  if (!submitResA.ok || !submitResA.data?.data) {
    throw new Error(`Failed to submit complaint for Citizen A: ${JSON.stringify(submitResA.data)}`);
  }

  const createdComplaintA = submitResA.data.data;
  console.log(`✅ Complaint created: ${createdComplaintA.complaintId}`);
  console.log(`   citizenUserId in DB/result: ${createdComplaintA.citizenUserId}`);
  console.log(`   isGuestSubmission in DB/result: ${createdComplaintA.isGuestSubmission}`);

  if (String(createdComplaintA.citizenUserId) !== String(userAId)) {
    throw new Error(`Assertion failed: complaint citizenUserId (${createdComplaintA.citizenUserId}) !== userAId (${userAId})`);
  }
  if (createdComplaintA.isGuestSubmission !== false) {
    throw new Error(`Assertion failed: complaint isGuestSubmission is not false!`);
  }

  // Fetch Citizen A dashboard complaints
  console.log('   Fetching Citizen A complaints list from /citizen/dashboard/complaints...');
  const myComplaintsResA = await api('/citizen/dashboard/complaints', {
    headers: { Authorization: `Bearer ${tokenA}` }
  });

  if (!myComplaintsResA.ok || !Array.isArray(myComplaintsResA.data?.data)) {
    throw new Error(`Failed to fetch Citizen A complaints: ${JSON.stringify(myComplaintsResA.data)}`);
  }

  const foundA = myComplaintsResA.data.data.find(c => c.complaintId === createdComplaintA.complaintId);
  if (!foundA) {
    throw new Error(`Complaint ${createdComplaintA.complaintId} was NOT found in Citizen A's dashboard!`);
  }
  console.log(`✅ Test A PASSED: Complaint ${createdComplaintA.complaintId} appears in Citizen A's dashboard!`);

  // Test B: Refresh the dashboard (re-fetch overview and complaints)
  console.log('\n[Test B] Refreshing dashboard / overview verification...');
  const overviewResA = await api('/citizen/dashboard/overview', {
    headers: { Authorization: `Bearer ${tokenA}` }
  });

  if (!overviewResA.ok || !overviewResA.data?.data) {
    throw new Error(`Failed to fetch overview: ${JSON.stringify(overviewResA.data)}`);
  }
  const overviewData = overviewResA.data.data;
  console.log(`   Total Complaints: ${overviewData.stats.totalComplaints}`);
  console.log(`   Active Complaints: ${overviewData.stats.activeComplaints}`);
  const recentMatch = overviewData.recentComplaints.find(c => c.complaintId === createdComplaintA.complaintId);
  if (!recentMatch) {
    throw new Error(`Complaint not found in recent complaints of dashboard overview!`);
  }
  console.log(`✅ Test B PASSED: Complaint persists across dashboard refresh and overview queries.`);

  // Test C: Logout and Log back in as Citizen A
  console.log('\n[Test C] Simulating re-login for Citizen A...');
  const loginA = await api('/citizen/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      identifier: citizenAEmail,
      password
    })
  });

  if (!loginA.ok || !loginA.data?.token) {
    throw new Error(`Citizen A re-login failed: ${JSON.stringify(loginA.data)}`);
  }
  const freshTokenA = loginA.data.token;
  const recheckComplaints = await api('/citizen/dashboard/complaints', {
    headers: { Authorization: `Bearer ${freshTokenA}` }
  });
  const foundAfterLogin = recheckComplaints.data.data.find(c => c.complaintId === createdComplaintA.complaintId);
  if (!foundAfterLogin) {
    throw new Error(`Complaint missing after re-login!`);
  }
  console.log(`✅ Test C PASSED: Complaint persists after full session re-authentication.`);

  // Test D: Register Citizen B and verify isolation
  console.log(`\n[Test D] Registering Citizen B (${citizenBEmail}) to test account isolation...`);
  const regB = await api('/citizen/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Citizen Beta',
      email: citizenBEmail,
      phone: citizenBPhone,
      password,
      confirmPassword: password
    })
  });
  const tokenB = regB.data.token;
  const myComplaintsResB = await api('/citizen/dashboard/complaints', {
    headers: { Authorization: `Bearer ${tokenB}` }
  });
  const leakFound = myComplaintsResB.data.data.find(c => c.complaintId === createdComplaintA.complaintId);
  if (leakFound) {
    throw new Error(`SECURITY BREACH: Citizen A's complaint leaked into Citizen B's dashboard!`);
  }
  console.log(`✅ Test D PASSED: Strict isolation verified! Citizen B cannot see Citizen A's complaints.`);

  // Test E: Guest submission and tracking
  console.log('\n[Test E] Submitting complaint as unauthenticated Guest...');
  const guestPayload = {
    category: 'Water & Sanitation',
    description: `Water pipeline burst near garden square, guest test ${timestamp}`,
    address: 'Garden Square, Block 2',
    phone: '9988776655',
    department: 'Water Supply Board',
    severity: 'Moderate'
  };
  const guestSubmitRes = await api('/complaints', {
    method: 'POST',
    body: JSON.stringify(guestPayload)
  });

  if (!guestSubmitRes.ok || !guestSubmitRes.data?.data) {
    throw new Error(`Guest complaint submission failed: ${JSON.stringify(guestSubmitRes.data)}`);
  }
  const guestComplaint = guestSubmitRes.data.data;
  const trackingToken = guestSubmitRes.data.trackingToken;
  console.log(`✅ Guest complaint created: ${guestComplaint.complaintId}`);
  console.log(`   citizenUserId: ${guestComplaint.citizenUserId}`);
  console.log(`   isGuestSubmission: ${guestComplaint.isGuestSubmission}`);
  console.log(`   trackingToken issued: ${Boolean(trackingToken)}`);

  if (guestComplaint.citizenUserId !== null && guestComplaint.citizenUserId !== undefined) {
    throw new Error(`Guest complaint has unexpected citizenUserId: ${guestComplaint.citizenUserId}`);
  }
  if (guestComplaint.isGuestSubmission !== true) {
    throw new Error(`Guest complaint isGuestSubmission is not true!`);
  }

  // Verify guest tracking endpoint works with trackingToken
  const trackRes = await api(`/complaints/track/${guestComplaint.complaintId}?token=${encodeURIComponent(trackingToken)}`);
  if (!trackRes.ok || trackRes.data?.data?.complaintId !== guestComplaint.complaintId) {
    throw new Error(`Guest tracking lookup failed: ${JSON.stringify(trackRes.data)}`);
  }
  console.log(`✅ Test E PASSED: Guest submission and tracking token verified independently.`);

  // Test F: Submit second complaint for Citizen A and verify statistics
  console.log('\n[Test F] Submitting second complaint for Citizen A to verify stats calculation...');
  await api('/complaints', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      category: 'Electrical & Lighting',
      description: `Streetlight flickering violently, test run 2 ${timestamp}`,
      address: '7th Cross Street',
      phone: citizenAPhone,
      department: 'Traffic & Electrical Safety',
      severity: 'Low'
    })
  });

  const updatedOverview = await api('/citizen/dashboard/overview', {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  const stats = updatedOverview.data.data.stats;
  console.log(`   Updated stats for Citizen A:`, stats);
  if (stats.totalComplaints !== 2) {
    throw new Error(`Expected totalComplaints = 2, got ${stats.totalComplaints}`);
  }
  if (stats.activeComplaints !== 2) {
    throw new Error(`Expected activeComplaints = 2, got ${stats.activeComplaints}`);
  }
  console.log(`✅ Test F PASSED: Dashboard statistics correctly update and count citizen complaints.`);

  console.log('\n🎉 ALL INTEGRATION TESTS (A - F) COMPLETED SUCCESSFULLY!\n');
}

runTests().catch(err => {
  console.error('\n❌ Test Failure:', err);
  process.exit(1);
});
