/**
 * End-to-End Workflow Verification Script for Phase 2
 * Tests:
 * 1. Health check & DB connection diagnostics
 * 2. Complaint submission via POST /api/complaints
 * 3. Complaint retrieval via GET /api/complaints/:id
 * 4. Filtered & paginated retrieval via GET /api/complaints
 * 5. Status update transition via PATCH /api/complaints/:id/status
 * 6. Audit trail verification in statusHistory
 * 7. Aggregated metrics via GET /api/complaints/stats
 * 8. Invalid form submissions (missing required fields, short description)
 * 9. Invalid status transitions (e.g. In Progress -> Pending)
 * 10. Multipart upload handling with missing/unconfigured Cloudinary notice
 */

const BASE_URL = 'http://localhost:5000/api';

const runTests = async () => {
  console.log('🧪 Starting Phase 2 End-to-End Test Suite...\n');
  let passed = 0;
  let failed = 0;

  const assert = (condition, title, details = '') => {
    if (condition) {
      console.log(`✅ [PASS] ${title}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${title} - ${details}`);
      failed++;
    }
  };

  try {
    // Test 1: Health check
    console.log('--- Test 1: Health Check Endpoint ---');
    const healthRes = await fetch(`${BASE_URL}/health`);
    const healthData = await healthRes.json();
    assert(healthRes.status === 200, 'Health check returns 200 OK');
    assert(healthData.service === 'CivicPulse AI Backend API', 'Service name matches');
    assert(healthData.database !== undefined, 'Database status object included');
    assert(healthData.mediaStorage !== undefined, 'Media storage status object included');
    console.log(`    DB Connected: ${healthData.database.connected}, Cloudinary Configured: ${healthData.mediaStorage.configured}`);

    // Test 2: Create a complaint (Valid payload)
    console.log('\n--- Test 2: Submit Valid Complaint ---');
    const payload = {
      category: 'Water & Sanitation',
      description: 'Major pressurized water pipe leak flooding residential sidewalk on 8th Street.',
      address: '742 Evergreen Terrace, Ward 3',
      latitude: 37.7812,
      longitude: -122.4110,
      department: 'Water Supply Board',
      reportedBy: 'Citizen Test Runner',
      severity: 'Critical',
    };

    const createRes = await fetch(`${BASE_URL}/complaints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const createData = await createRes.json();
    assert(createRes.status === 201, 'POST /api/complaints returns 201 Created');
    assert(createData.success === true, 'Response success is true');
    assert(createData.data.complaintId && createData.data.complaintId.startsWith('CP-'), 'Generated human-readable complaintId starting with CP-');
    assert(createData.data.status === 'Pending', 'Initial status is Pending');
    assert(createData.data.statusHistory.length === 1, 'Initial statusHistory entry created');

    const createdId = createData.data.complaintId;
    console.log(`    Created Complaint ID: ${createdId}`);

    // Test 3: Retrieve complaint by ID
    console.log('\n--- Test 3: Retrieve Complaint by ID ---');
    const getRes = await fetch(`${BASE_URL}/complaints/${createdId}`);
    const getData = await getRes.json();
    assert(getRes.status === 200, 'GET /api/complaints/:id returns 200 OK');
    assert(getData.data.complaintId === createdId, 'Retrieved ID matches created ID');
    assert(getData.data.category === 'Water & Sanitation', 'Category matches');
    assert(getData.data.location.address === payload.address, 'Address matches');

    // Test 4: Retrieve with category & status filter
    console.log('\n--- Test 4: Filter & Pagination on GET /api/complaints ---');
    const filterRes = await fetch(`${BASE_URL}/complaints?category=Water%20%26%20Sanitation&status=Pending`);
    const filterData = await filterRes.json();
    assert(filterRes.status === 200, 'GET /api/complaints with filter returns 200 OK');
    assert(filterData.success === true, 'Response success is true');
    assert(filterData.data.some((c) => c.complaintId === createdId), 'Created complaint is included in filtered response');
    assert(filterData.total >= 1, `Total count is reported (${filterData.total})`);

    // Test 5: Valid Status Update (Pending -> In Progress)
    console.log('\n--- Test 5: Valid Status Transition (Pending -> In Progress) ---');
    const updateRes = await fetch(`${BASE_URL}/complaints/${createdId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'In Progress',
        note: 'Emergency crew deployed to site with repair excavation gear',
        changedBy: 'Superintendent Harris',
      }),
    });
    const updateData = await updateRes.json();
    assert(updateRes.status === 200, 'PATCH returns 200 OK');
    assert(updateData.data.status === 'In Progress', 'Status successfully changed to In Progress');
    assert(updateData.data.statusHistory.length === 2, 'statusHistory now contains 2 entries');
    assert(updateData.data.statusHistory[1].fromStatus === 'Pending', 'Audit trail records fromStatus = Pending');
    assert(updateData.data.statusHistory[1].toStatus === 'In Progress', 'Audit trail records toStatus = In Progress');

    // Test 6: Valid Second Status Transition (In Progress -> Resolved)
    console.log('\n--- Test 6: Second Valid Status Transition (In Progress -> Resolved) ---');
    const resolveRes = await fetch(`${BASE_URL}/complaints/${createdId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'Resolved',
        note: 'Pipe sealed and asphalt re-paved. Water pressure restored.',
        changedBy: 'Lead Technician Chen',
      }),
    });
    const resolveData = await resolveRes.json();
    assert(resolveRes.status === 200, 'PATCH returns 200 OK for Resolved');
    assert(resolveData.data.status === 'Resolved', 'Status is now Resolved');
    assert(resolveData.data.statusHistory.length === 3, 'Audit trail has 3 total entries');

    // Test 7: Invalid Status Transition (Resolved cannot transition to 'In Progress' directly)
    console.log('\n--- Test 7: Reject Invalid Status Transition ---');
    const invalidTransRes = await fetch(`${BASE_URL}/complaints/${createdId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'In Progress',
      }),
    });
    const invalidTransData = await invalidTransRes.json();
    assert(invalidTransRes.status === 400, 'Returns 400 Bad Request for forbidden transition');
    assert(invalidTransData.success === false, 'success is false');
    assert(invalidTransData.message.includes('Cannot transition'), 'Clear explanation message returned');

    // Test 8: Invalid Form Submission (Missing required fields)
    console.log('\n--- Test 8: Form Validation Rejection ---');
    const invalidFormRes = await fetch(`${BASE_URL}/complaints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: '',
        description: 'short',
      }),
    });
    const invalidFormData = await invalidFormRes.json();
    assert(invalidFormRes.status === 400, 'Returns 400 Bad Request on invalid submission');
    assert(invalidFormData.errors && invalidFormData.errors.length > 0, 'Returns specific error array');

    // Test 9: Aggregated Statistics
    console.log('\n--- Test 9: Aggregated Statistics Endpoint ---');
    const statsRes = await fetch(`${BASE_URL}/complaints/stats`);
    const statsData = await statsRes.json();
    assert(statsRes.status === 200, 'GET /api/complaints/stats returns 200 OK');
    assert(statsData.data.total >= 1, 'Total count is >= 1');
    assert(statsData.data.byStatus !== undefined, 'byStatus mapping is present');
    assert(statsData.data.byCategory !== undefined, 'byCategory mapping is present');
    assert(statsData.data.bySeverity !== undefined, 'bySeverity mapping is present');

    // Test 10: Multipart Image Upload Simulation (FormData)
    console.log('\n--- Test 10: Multipart Form Submission (Multer Handling) ---');
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const fakeImageBody = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="category"',
      '',
      'Parks & Public Realm',
      `--${boundary}`,
      'Content-Disposition: form-data; name="description"',
      '',
      'Large fallen branch blocking park playground equipment.',
      `--${boundary}`,
      'Content-Disposition: form-data; name="address"',
      '',
      'Central Meadow Park',
      `--${boundary}`,
      'Content-Disposition: form-data; name="image"; filename="evidence.png"',
      'Content-Type: image/png',
      '',
      'fake-png-binary-content-simulated',
      `--${boundary}--`,
    ].join('\r\n');

    const multipartRes = await fetch(`${BASE_URL}/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: fakeImageBody,
    });
    const multipartData = await multipartRes.json();
    assert(multipartRes.status === 201, 'Multipart submission returns 201 Created');
    assert(multipartData.data.complaintId !== undefined, 'Complaint ID created for multipart upload');
    assert(multipartData.uploadNotice !== undefined || multipartData.data.imageUrl !== null, 'Upload notice explains Cloudinary status without pretending fake upload');

    console.log('\n=========================================');
    console.log(`🎉 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('=========================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('❌ Unexpected test error:', error);
    process.exit(1);
  }
};

runTests();
