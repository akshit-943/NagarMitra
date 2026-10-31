import 'dotenv/config';

const BACKEND_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('================================================================');
  console.log('🧪 CIVICPULSE AI — INSPECT DETAILS BUG FIX & GEMINI OPTIMIZATION');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  // Helper assertion
  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ PASSED: ${message}`);
      passedTests++;
    } else {
      console.error(`  ❌ FAILED: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  try {
    // -------------------------------------------------------------
    // TEST 1: Fetch all Master Issues from Backend
    // -------------------------------------------------------------
    console.log('[TEST 1] Fetching active master issues from /api/master-issues...');
    const listRes = await fetch(`${BACKEND_URL}/master-issues`);
    const listData = await listRes.json();
    assert(listRes.status === 200, 'GET /api/master-issues returned HTTP 200');
    assert(listData.success === true, 'Response marked success');
    assert(Array.isArray(listData.data), 'Returned master issues array');
    assert(listData.data.length > 0, `Found ${listData.data.length} master issues in registry`);

    const sampleIssues = listData.data.slice(0, 3);
    console.log(`  -> Testing details inspection on ${sampleIssues.length} distinct Master Issues:\n     ` + sampleIssues.map(m => m.masterIssueId).join(', '));

    // -------------------------------------------------------------
    // TEST 2: Inspect Details for Multiple Distinct Master Issues
    // -------------------------------------------------------------
    for (const [index, sample] of sampleIssues.entries()) {
      console.log(`\n[TEST 2.${index + 1}] Inspecting details for Master Issue: ${sample.masterIssueId}...`);
      const detailRes = await fetch(`${BACKEND_URL}/master-issues/${sample.masterIssueId}`);
      const detailData = await detailRes.json();

      assert(detailRes.status === 200, `HTTP 200 returned for ${sample.masterIssueId}`);
      assert(detailData.success === true, 'Detail response marked success');
      const issue = detailData.data;

      // Verify all required fields from prompt
      assert(issue.masterIssueId === sample.masterIssueId, `Master Issue ID matches: ${issue.masterIssueId}`);
      assert(typeof issue.category === 'string' && issue.category.length > 0, `Category present: "${issue.category}"`);
      assert(typeof issue.title === 'string' && issue.title.length > 0, `Title / description present: "${issue.title}"`);
      assert(typeof issue.status === 'string', `Current status present: "${issue.status}"`);
      assert(issue.location && typeof issue.location.address === 'string', `Location address present: "${issue.location?.address}"`);
      assert(typeof issue.department === 'string', `Department present: "${issue.department}"`);

      // Verify Dynamic Priority & 4-way Breakdown
      assert(issue.priority && typeof issue.priority.score === 'number', `Dynamic priority score present: ${issue.priority?.score}/100`);
      assert(issue.priority?.breakdown?.severityScore !== undefined, `AI Severity component: ${issue.priority?.breakdown?.severityScore}`);
      assert(issue.priority?.breakdown?.safetyScore !== undefined, `Safety Risk component: ${issue.priority?.breakdown?.safetyScore}`);
      assert(issue.priority?.breakdown?.collectiveScore !== undefined, `Collective Impact component: ${issue.priority?.breakdown?.collectiveScore}`);
      assert(issue.priority?.breakdown?.locationScore !== undefined, `Location Criticality component: ${issue.priority?.breakdown?.locationScore}`);
      assert(typeof issue.priority?.explanation === 'string', `Priority explanation string present`);

      // Verify Citizen Collective Impact & Linked Complaints
      assert(typeof issue.supportingReportCount === 'number', `Supporting reports count: ${issue.supportingReportCount}`);
      assert(typeof issue.citizenSupportCount === 'number', `Citizen endorsement count: ${issue.citizenSupportCount}`);
      assert(Array.isArray(issue.associatedComplaints), `Associated complaints array present (length: ${issue.associatedComplaints?.length})`);
      assert(Array.isArray(issue.statusHistory), `Status history timeline present (${issue.statusHistory.length} entries)`);
    }

    // -------------------------------------------------------------
    // TEST 3: Invalid Master Issue ID Handling (404, No Blank Page)
    // -------------------------------------------------------------
    console.log('\n[TEST 3] Testing invalid / non-existent Master Issue ID handling...');
    const invalidId = 'MI-INVALID-99999';
    const invalidRes = await fetch(`${BACKEND_URL}/master-issues/${invalidId}`);
    const invalidData = await invalidRes.json();

    assert(invalidRes.status === 404, 'Invalid ID returns HTTP 404');
    assert(invalidData.success === false, 'Invalid response marked success: false');
    assert(invalidData.message.includes('not found'), `Clear error message returned: "${invalidData.message}"`);

    // -------------------------------------------------------------
    // TEST 4: Gemini Optimization — Reuse Existing Analysis
    // -------------------------------------------------------------
    console.log('\n[TEST 4] Testing Gemini API Optimization: Reusing previously saved MongoDB analysis...');
    const complaintsRes = await fetch(`${BACKEND_URL}/complaints?limit=5`);
    const complaintsData = await complaintsRes.json();
    const analyzedComplaint = complaintsData.data.find(c => c.aiAnalysis?.analysisStatus === 'Completed');

    if (analyzedComplaint) {
      console.log(`  -> Found analyzed complaint ${analyzedComplaint.complaintId}. Calling /analyze endpoint without force...`);
      const reanalyzeRes = await fetch(`${BACKEND_URL}/complaints/${analyzedComplaint.complaintId}/analyze`, {
        method: 'POST',
      });
      const reanalyzeData = await reanalyzeRes.json();

      assert(reanalyzeRes.status === 200, 'Re-analyze call returned HTTP 200');
      assert(reanalyzeData.reused === true, 'Verified: Reused existing MongoDB analysis without re-calling Gemini API');
      assert(reanalyzeData.data.aiAnalysis?.analysisStatus === 'Completed', 'Analysis status remains Completed');
      console.log(`  -> Confirmation message: "${reanalyzeData.message}"`);
    } else {
      console.log('  ⚠️ No pre-completed complaints found to test reuse (skipping check)');
    }

    // -------------------------------------------------------------
    // TEST 5: Gemini Optimization — Development / Testing Mock Bypass
    // -------------------------------------------------------------
    console.log('\n[TEST 5] Testing development mock bypass header (x-mock-ai: true)...');
    const testComplaintPayload = {
      category: 'Road Damage',
      description: 'Dev fixture verification: pothole on Fifth Avenue near central station.',
      address: '789 Fifth Avenue',
      latitude: 37.7790,
      longitude: -122.4180,
    };

    const mockCreateRes = await fetch(`${BACKEND_URL}/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-mock-ai': 'true',
      },
      body: JSON.stringify(testComplaintPayload),
    });
    const mockCreateData = await mockCreateRes.json();

    assert(mockCreateRes.status === 201, 'Mock complaint created with HTTP 201');
    assert(mockCreateData.data.complaintId !== undefined, `Created complaint: ${mockCreateData.data.complaintId}`);
    assert(mockCreateData.data.aiAnalysis?.modelUsed === 'mock-fixture-development', 'Mock model identifier clearly marked as mock-fixture-development (never masquerading as genuine)');
    assert(mockCreateData.data.aiAnalysis?.analysisStatus === 'Completed', 'Mock analysis populated valid structured output');
    assert(mockCreateData.data.masterIssueId !== null, `Linked to Master Issue: ${mockCreateData.data.masterIssueId}`);

    // Clean up test complaint
    console.log('\n================================================================');
    console.log(`🎉 ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
    console.log('================================================================\n');

  } catch (err) {
    console.error('\n❌ Test execution encountered an error:', err.message);
    process.exit(1);
  }
}

runTests();
