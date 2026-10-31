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

function assert(condition, message) {
  if (!condition) {
    console.error(`  ❌ FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✅ PASSED: ${message}`);
}

async function runQA() {
  console.log('================================================================');
  console.log(' CIVICPULSE AI — COMPREHENSIVE QA & BUG FIX VERIFICATION SUITE');
  console.log('================================================================\n');

  let passedTests = 0;
  const createdComplaintIds = [];
  let createdMasterIssueId = null;

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Citizen Auth & Registration
    // -------------------------------------------------------------------------
    console.log('--- TEST GROUP 1: Authentication & Role Isolation ---');
    const citizenEmail = `qa_citizen_${Date.now()}@example.com`;
    const citizenReg = await makeRequest('POST', '/api/citizen/auth/register', {
      name: 'Aditi Deshmukh',
      email: citizenEmail,
      phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
      password: 'CitizenSecurePass123!',
      address: 'FC Road, Shivajinagar, Pune',
      preferredWard: 'Shivajinagar Central',
    });
    assert(citizenReg.status === 201, 'Citizen registers successfully (HTTP 201)');
    const citizenToken = citizenReg.data.token;
    const citizenId = citizenReg.data.user.id;
    assert(Boolean(citizenToken), 'Citizen JWT token generated');
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 2: Authority Login
    // -------------------------------------------------------------------------
    const authLogin = await makeRequest('POST', '/api/auth/authority/login', {
      email: 'admin@municipal.internal',
      password: 'CivicPulse@2026',
    });
    assert(authLogin.status === 200, 'Authority logs in successfully (HTTP 200)');
    const authorityToken = authLogin.data.token;
    assert(Boolean(authorityToken), 'Authority JWT token generated');
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 3: Cross-Role Session Isolation (Issue 3 & 12)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 2: Security & Cross-Role Isolation ---');
    // Citizen attempts to access authority endpoint
    const forbiddenAuthorityAccess = await makeRequest('GET', '/api/master-issues/analytics', null, {
      Authorization: `Bearer ${citizenToken}`,
    });
    assert(
      forbiddenAuthorityAccess.status === 401 || forbiddenAuthorityAccess.status === 403,
      `Citizen token strictly blocked from Authority endpoint (HTTP ${forbiddenAuthorityAccess.status})`
    );
    passedTests++;

    // Authority attempts to access citizen dashboard endpoint
    const forbiddenCitizenAccess = await makeRequest('GET', '/api/citizen/dashboard/overview', null, {
      Authorization: `Bearer ${authorityToken}`,
    });
    assert(
      forbiddenCitizenAccess.status === 401 || forbiddenCitizenAccess.status === 403,
      `Authority token strictly blocked from Citizen Dashboard endpoint (HTTP ${forbiddenCitizenAccess.status})`
    );
    passedTests++;

    // Unauthenticated request to authority endpoint
    const unauthAccess = await makeRequest('GET', '/api/master-issues/analytics');
    assert(unauthAccess.status === 401, 'Unauthenticated request rejected with HTTP 401');
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 4: Citizen Submits Complaint with Indian Location (Issue 1 & 8)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 3: Indian Location & Complaint Submission ---');
    const complaint1 = await makeRequest('POST', '/api/complaints', {
      category: 'Roadways & Pavement',
      description: 'Severe deep crater pothole near Pune University circle on Ganeshkhind Road.',
      address: 'Ganeshkhind Road, Shivajinagar, Pune, Maharashtra 411007',
      latitude: 18.5308,
      longitude: 73.8295,
      locationSource: 'map_selection',
      phone: '9876543210',
      severity: 'High',
    }, {
      Authorization: `Bearer ${citizenToken}`,
    });

    assert(complaint1.status === 201, 'Complaint 1 submitted successfully (HTTP 201)');
    const cp1 = complaint1.data.data;
    assert(cp1.complaintId.startsWith('CP-'), `Complaint 1 has CP- prefix: ${cp1.complaintId}`);
    assert(cp1.location.latitude === 18.5308, 'Latitude stored accurately (18.5308)');
    assert(cp1.location.longitude === 73.8295, 'Longitude stored accurately (73.8295)');
    assert(cp1.citizenUserId === citizenId, 'Complaint correctly linked to authenticated citizen ID');
    assert(cp1.isGuestSubmission === false, 'isGuestSubmission is correctly false');
    createdComplaintIds.push(cp1.complaintId);
    createdMasterIssueId = cp1.masterIssueId;
    assert(Boolean(createdMasterIssueId) && createdMasterIssueId.startsWith('MI-'), `Master Issue generated with MI- prefix: ${createdMasterIssueId}`);
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 5: Duplicate Detection vs Unique Complaint IDs (Issue 4)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 4: Duplicate Deduplication (CP-... vs MI-...) ---');
    const complaint2 = await makeRequest('POST', '/api/complaints', {
      category: 'Roadways & Pavement',
      description: 'Dangerous road damage and deep pothole causing traffic jam near Pune University.',
      address: 'Ganeshkhind Road near Pune University, Pune, Maharashtra',
      latitude: 18.5310,
      longitude: 73.8297,
      locationSource: 'map_selection',
      phone: '9822001122',
      severity: 'High',
    });

    assert(complaint2.status === 201, 'Complaint 2 (duplicate report) submitted successfully (HTTP 201)');
    const cp2 = complaint2.data.data;
    assert(cp2.complaintId.startsWith('CP-'), `Complaint 2 has distinct CP- prefix: ${cp2.complaintId}`);
    assert(cp2.complaintId !== cp1.complaintId, 'Complaint 1 and Complaint 2 have different complaint IDs');
    assert(cp2.masterIssueId === createdMasterIssueId, `Duplicate Complaint 2 shares Master Issue ID: ${createdMasterIssueId}`);
    createdComplaintIds.push(cp2.complaintId);
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 6: Submitter Self-Endorsement Prevention (Issue 13)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 5: Submitter Identity & Endorsement Verification ---');
    // Submitting citizen tries to endorse their own master issue
    const selfEndorse = await makeRequest('POST', `/api/master-issues/${createdMasterIssueId}/support`, {}, {
      Authorization: `Bearer ${citizenToken}`,
    });
    assert(
      selfEndorse.status === 400,
      'Backend blocks submitting citizen from self-endorsing their own complaint (HTTP 400)'
    );
    passedTests++;

    // Independent third-party endorses the master issue
    const thirdPartyEndorse = await makeRequest('POST', `/api/master-issues/${createdMasterIssueId}/support`, {}, {
      'x-citizen-id': 'independent-neighbor-99',
    });
    assert(thirdPartyEndorse.status === 200, 'Independent citizen successfully endorses master issue (HTTP 200)');
    assert(thirdPartyEndorse.data.citizenSupportCount >= 1, 'citizenSupportCount incremented to 1+');
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 7: Citizen Portal Status Filtering (Issue 2 & 10)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 6: Status Filtering & Dashboard Queries ---');
    const activeComplaintsRes = await makeRequest('GET', '/api/complaints?status=Active');
    assert(activeComplaintsRes.status === 200, 'Query Active complaints succeeds (HTTP 200)');
    const hasActive = activeComplaintsRes.data.data.some((c) => c.complaintId === cp1.complaintId);
    assert(hasActive, 'Newly submitted complaint appears in Active complaints query');

    const resolvedComplaintsRes = await makeRequest('GET', '/api/complaints?status=Resolved');
    assert(resolvedComplaintsRes.status === 200, 'Query Resolved complaints succeeds (HTTP 200)');
    const hasResolved = resolvedComplaintsRes.data.data.some((c) => c.complaintId === cp1.complaintId);
    assert(!hasResolved, 'Pending/Active complaint correctly excluded from Resolved complaints query');
    passedTests++;

    // Citizen personal dashboard complaints query
    const citizenDashboardComplaints = await makeRequest('GET', '/api/citizen/dashboard/complaints', null, {
      Authorization: `Bearer ${citizenToken}`,
    });
    assert(citizenDashboardComplaints.status === 200, 'Fetch personal citizen complaints succeeds (HTTP 200)');
    const inPersonalList = citizenDashboardComplaints.data.data.some((c) => c.complaintId === cp1.complaintId);
    assert(inPersonalList, 'Complaint 1 appears in submitting citizen personal dashboard');
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 8: Resolution Lifecycle & Verification Voting (Issue 7)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 7: Resolution Workflow & Citizen Verification ---');
    // Transition status to In Progress
    const toInProgress = await makeRequest('PATCH', `/api/master-issues/${createdMasterIssueId}/status`, {
      status: 'In Progress',
      note: 'Field crew dispatched to Ganeshkhind Road.',
    }, {
      Authorization: `Bearer ${authorityToken}`,
    });
    assert(toInProgress.status === 200, 'Status updated to In Progress (HTTP 200)');

    // Transition status to Resolution Submitted
    const toResolutionSubmitted = await makeRequest('PATCH', `/api/master-issues/${createdMasterIssueId}/status`, {
      status: 'Resolution Submitted',
      note: 'Pothole asphalt repair completed. Awaiting citizen confirmation.',
    }, {
      Authorization: `Bearer ${authorityToken}`,
    });
    assert(toResolutionSubmitted.status === 200, 'Status updated to Resolution Submitted (HTTP 200)');

    // Citizen verification: vote "Resolved" (Confirmed)
    const verifyResolved = await makeRequest('POST', `/api/master-issues/${createdMasterIssueId}/verify`, {
      decision: 'Resolved',
      comment: 'Confirmed, road surface is smooth and clean.',
    }, {
      'x-citizen-id': 'verifier-resident-01',
    });
    assert(verifyResolved.status === 200, 'Citizen submits Resolved verification vote (HTTP 200)');
    assert(verifyResolved.data.data.confirmedCount === 1, 'confirmedCount is 1');

    // Second citizen vote: "Not Resolved" (Disputed)
    const verifyDisputed = await makeRequest('POST', `/api/master-issues/${createdMasterIssueId}/verify`, {
      decision: 'Not Resolved',
      comment: 'Debris left behind on the sidewalk.',
    }, {
      'x-citizen-id': 'verifier-resident-02',
    });
    assert(verifyDisputed.status === 200, 'Citizen submits Not Resolved verification vote (HTTP 200)');
    assert(verifyDisputed.data.data.disputedCount === 1, 'disputedCount is 1');
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 9: Impact Report PDF Stream (Issue 9)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 8: PDF Report Generation ---');
    const pdfRes = await makeRequest('GET', '/api/transparency/reports/impact-pdf?timeRange=30d');
    assert(pdfRes.status === 200, 'Download Impact Report PDF endpoint returns HTTP 200');
    assert(pdfRes.headers['content-type'] === 'application/pdf', 'Response Content-Type is application/pdf');
    assert(
      pdfRes.headers['content-disposition'] && pdfRes.headers['content-disposition'].includes('CivicPulse_Impact_Report'),
      'Content-Disposition header includes valid CivicPulse_Impact_Report filename'
    );
    passedTests++;

    console.log('\n================================================================');
    console.log(` ALL ${passedTests} TEST GROUPS PASSED WITH 100% SUCCESS`);
    console.log('================================================================');

  } finally {
    // -------------------------------------------------------------------------
    // CLEANUP: Reset Database State to Keep Zero Initial State
    // -------------------------------------------------------------------------
    console.log('\n--- CLEANUP: Removing test records to preserve zero initial state ---');
    import('./src/config/db.js').then(async ({ connectDB }) => {
      await connectDB();
      const Complaint = (await import('./src/models/Complaint.js')).default;
      const MasterIssue = (await import('./src/models/MasterIssue.js')).default;
      const ActivityLog = (await import('./src/models/ActivityLog.js')).default;
      const CitizenNotification = (await import('./src/models/CitizenNotification.js')).default;

      if (createdComplaintIds.length > 0) {
        await Complaint.deleteMany({ complaintId: { $in: createdComplaintIds } });
        console.log(`  Removed ${createdComplaintIds.length} test complaints.`);
      }
      if (createdMasterIssueId) {
        await MasterIssue.deleteOne({ masterIssueId: createdMasterIssueId });
        await ActivityLog.deleteMany({ masterIssueId: createdMasterIssueId });
        await CitizenNotification.deleteMany({ masterIssueId: createdMasterIssueId });
        console.log(`  Removed test master issue ${createdMasterIssueId} and activity logs.`);
      }
      console.log('  Cleanup complete. Database cleanly reset.\n');
      process.exit(0);
    }).catch((err) => {
      console.error('Cleanup error:', err);
      process.exit(0);
    });
  }
}

runQA().catch((err) => {
  console.error('QA Suite encountered failure:', err);
  process.exit(1);
});
