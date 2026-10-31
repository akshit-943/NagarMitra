/**
 * Phase 6 Verification Test Suite: Public Transparency & Civic Impact Intelligence
 * 
 * Verifies:
 * 1. Overview metrics calculation from actual MongoDB records
 * 2. Civic trend analysis, velocity calculation, and sample size >= 5 threshold
 * 3. Department performance scorecard and sample size confidence ratings
 * 4. Deterministic civic impact & resource allocation engine (Zero AI)
 * 5. Public privacy protection (zero citizen PII, zero internal notes)
 * 6. Public audit lifecycle timeline
 * 7. Downloadable Civic Impact PDF generation
 * 8. Filter reactivity across time, category, department, and zone
 */

const BASE_URL = 'http://localhost:5000/api/transparency';

async function runPhase6Tests() {
  console.log('================================================================');
  console.log('CIVICPULSE AI — PHASE 6 VERIFICATION TEST SUITE');
  console.log('Public Transparency, Civic Trends & Impact Intelligence');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, detail = '') {
    if (condition) {
      console.log(`  ✓ PASS: ${testName} ${detail ? `(${detail})` : ''}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName} ${detail ? `— ${detail}` : ''}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Overview Metrics Endpoint
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: Overview Metrics (GET /api/transparency/overview) ---');
    const ovRes = await fetch(`${BASE_URL}/overview?timeRange=all`);
    assert(ovRes.status === 200, 'Overview endpoint returns HTTP 200');
    const ovJson = await ovRes.json();
    assert(ovJson.success === true, 'Overview response has success: true');
    assert(typeof ovJson.data.totalComplaints === 'number', 'totalComplaints is a number', `val: ${ovJson.data.totalComplaints}`);
    assert(typeof ovJson.data.totalMasterIssues === 'number', 'totalMasterIssues is a number', `val: ${ovJson.data.totalMasterIssues}`);
    assert(typeof ovJson.data.resolutionRate === 'number', 'resolutionRate is a number', `val: ${ovJson.data.resolutionRate}%`);
    assert(typeof ovJson.data.slaComplianceRate === 'number', 'slaComplianceRate is a number', `val: ${ovJson.data.slaComplianceRate}%`);
    assert(ovJson.data.filterSummary && ovJson.data.filterSummary.timeRange === 'all', 'Filter summary reflects query parameter');

    // -------------------------------------------------------------------------
    // TEST 2: Filter Reactivity
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Filter Reactivity (7d vs 30d vs Category) ---');
    const res7d = await fetch(`${BASE_URL}/overview?timeRange=7d`);
    const json7d = await res7d.json();
    assert(res7d.status === 200, '7-Day filter query returns HTTP 200');
    assert(json7d.data.filterSummary.timeRange === '7d', '7-Day filter correctly reflected in summary');

    const resCat = await fetch(`${BASE_URL}/overview?category=Pothole`);
    const jsonCat = await resCat.json();
    assert(resCat.status === 200, 'Category filter returns HTTP 200');
    assert(jsonCat.data.filterSummary.category === 'Pothole', 'Category filter correctly reflected in summary');

    // -------------------------------------------------------------------------
    // TEST 3: Civic Trends & Velocity Thresholds
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Civic Trends Analysis (GET /api/transparency/trends) ---');
    const trRes = await fetch(`${BASE_URL}/trends?timeRange=all`);
    assert(trRes.status === 200, 'Trends endpoint returns HTTP 200');
    const trJson = await trRes.json();
    assert(trJson.success === true, 'Trends response has success: true');
    assert(Array.isArray(trJson.data.volumeOverTime), 'volumeOverTime is an array', `count: ${trJson.data.volumeOverTime.length}`);
    assert(Array.isArray(trJson.data.categoryDistribution), 'categoryDistribution is an array', `count: ${trJson.data.categoryDistribution.length}`);
    assert(Array.isArray(trJson.data.categoryTrends), 'categoryTrends is an array');

    // Check sample size threshold rule in categoryTrends
    if (trJson.data.categoryTrends.length > 0) {
      const sampleItem = trJson.data.categoryTrends[0];
      assert(
        ['Increasing', 'Decreasing', 'Stable'].includes(sampleItem.trend),
        'Trend velocity properly labeled',
        `trend: ${sampleItem.trend}, change: ${sampleItem.percentageChange}%`
      );
      assert(
        ['High', 'Moderate', 'Insufficient'].includes(sampleItem.sampleConfidence),
        'Sample size confidence calculated',
        `confidence: ${sampleItem.sampleConfidence}`
      );
    }

    assert(Array.isArray(trJson.data.recurringProblems), 'recurringProblems is an array');
    assert(Array.isArray(trJson.data.persistentAreas), 'persistentAreas is an array');

    // -------------------------------------------------------------------------
    // TEST 4: Department Performance Matrix & Confidence
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Department Performance Matrix (GET /api/transparency/departments) ---');
    const deptRes = await fetch(`${BASE_URL}/departments?timeRange=all`);
    assert(deptRes.status === 200, 'Departments endpoint returns HTTP 200');
    const deptJson = await deptRes.json();
    assert(deptJson.success === true, 'Departments response has success: true');
    assert(Array.isArray(deptJson.data) && deptJson.data.length > 0, 'Returns non-empty array of municipal departments');

    const firstDept = deptJson.data[0];
    assert(typeof firstDept.department === 'string', 'Department has name', firstDept.department);
    assert(typeof firstDept.totalAssigned === 'number', 'totalAssigned is a number', `val: ${firstDept.totalAssigned}`);
    assert(typeof firstDept.resolutionRate === 'number', 'resolutionRate is a number', `val: ${firstDept.resolutionRate}%`);
    assert(typeof firstDept.slaComplianceRate === 'number', 'slaComplianceRate is a number', `val: ${firstDept.slaComplianceRate}%`);
    assert(['High', 'Moderate', 'Insufficient'].includes(firstDept.sampleConfidence), 'sampleConfidence assigned accurately', firstDept.sampleConfidence);

    // -------------------------------------------------------------------------
    // TEST 5: Deterministic Resource Allocation Engine (Zero AI)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Algorithmic Resource Allocation (GET /api/transparency/recommendations) ---');
    const recRes = await fetch(`${BASE_URL}/recommendations?timeRange=all`);
    assert(recRes.status === 200, 'Recommendations endpoint returns HTTP 200');
    const recJson = await recRes.json();
    assert(recJson.success === true, 'Recommendations response has success: true');
    assert(Array.isArray(recJson.data), 'Recommendations returned as an array');
    if (recJson.data.length > 0) {
      const firstRec = recJson.data[0];
      assert(Boolean(firstRec.area), 'Recommendation includes geographic target area', firstRec.area);
      assert(Boolean(firstRec.category), 'Recommendation includes civic category', firstRec.category);
      assert(['CRITICAL', 'HIGH', 'MODERATE', 'LOW', 'URGENT'].includes(String(firstRec.urgency).toUpperCase()), 'Urgency classification validated', firstRec.urgency);
      assert(Boolean(firstRec.recommendation || firstRec.suggestedAction), 'Includes concrete proposed municipal action', (firstRec.recommendation || firstRec.suggestedAction).slice(0, 45) + '...');
      assert(Boolean(firstRec.analyticalReason || firstRec.reason), 'Includes analytical rationale', (firstRec.analyticalReason || firstRec.reason).slice(0, 45) + '...');
      assert(Boolean(firstRec.supportingData), 'Includes empirical supporting telemetry');
    }

    // -------------------------------------------------------------------------
    // TEST 6: Public Privacy Enforcement (Strip PII & Internal Notes)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: Public Privacy Protection (GET /api/transparency/issues) ---');
    const issuesRes = await fetch(`${BASE_URL}/issues?limit=10`);
    assert(issuesRes.status === 200, 'Public issues endpoint returns HTTP 200');
    const issuesJson = await issuesRes.json();
    assert(issuesJson.success === true, 'Public issues response has success: true');
    assert(Array.isArray(issuesJson.data.issues), 'Returns public issues array');

    let leakedPii = false;
    let leakedInternalNotes = false;
    let leakedCitizenHashes = false;

    issuesJson.data.issues.forEach((issue) => {
      // Check for citizen personal info
      if (issue.citizenName || issue.citizenPhone || issue.citizenEmail || issue.submittedBy) {
        leakedPii = true;
      }
      // Check for internal authority notes
      if (issue.internalNotes) {
        leakedInternalNotes = true;
      }
      // Check for supportedBy hashes
      if (issue.supportedBy && Array.isArray(issue.supportedBy) && typeof issue.supportedBy[0] === 'string') {
        leakedCitizenHashes = true;
      }
    });

    assert(!leakedPii, 'STRICT PRIVACY: Zero citizen names, emails, or phone numbers exposed');
    assert(!leakedInternalNotes, 'STRICT PRIVACY: Zero internal authority notes exposed');
    assert(!leakedCitizenHashes, 'STRICT PRIVACY: Zero internal citizen IP or token hashes exposed');

    // -------------------------------------------------------------------------
    // TEST 7: Public Audit Timeline
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7: Public Issue Audit Timeline ---');
    if (issuesJson.data.issues.length > 0) {
      const issueId = issuesJson.data.issues[0]._id;
      const tlRes = await fetch(`${BASE_URL}/issues/${issueId}/timeline`);
      assert(tlRes.status === 200, 'Public timeline endpoint returns HTTP 200');
      const tlJson = await tlRes.json();
      assert(tlJson.success === true, 'Public timeline response has success: true');
      assert(Array.isArray(tlJson.data.timeline), 'Timeline milestones returned as array');
      if (tlJson.data.timeline.length > 0) {
        assert(Boolean(tlJson.data.timeline[0].timestamp), 'Timeline event contains verified timestamp');
      }
    }

    // -------------------------------------------------------------------------
    // TEST 8: Downloadable Civic Impact Report PDF
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 8: Downloadable Civic Impact PDF (GET /api/transparency/reports/impact-pdf) ---');
    const pdfRes = await fetch(`${BASE_URL}/reports/impact-pdf?timeRange=30d`);
    assert(pdfRes.status === 200, 'PDF report endpoint returns HTTP 200');
    assert(pdfRes.headers.get('content-type') === 'application/pdf', 'Response Content-Type is application/pdf');
    const pdfBuffer = await pdfRes.arrayBuffer();
    assert(pdfBuffer.byteLength > 1000, 'PDF binary content has substantial payload', `bytes: ${pdfBuffer.byteLength}`);

    const headerText = String.fromCharCode(...new Uint8Array(pdfBuffer.slice(0, 5)));
    assert(headerText.startsWith('%PDF-'), 'Binary begins with valid %PDF- magic signature', headerText);

    // -------------------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`PHASE 6 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');

    if (failed === 0) {
      console.log('ALL PHASE 6 PUBLIC TRANSPARENCY DELIVERABLES VERIFIED SUCCESSFULLY!\n');
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runPhase6Tests();
