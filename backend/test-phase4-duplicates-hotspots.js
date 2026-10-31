import 'dotenv/config';
import { connectDB } from './src/config/db.js';
import Complaint from './src/models/Complaint.js';
import MasterIssue from './src/models/MasterIssue.js';
import { generateComplaintId } from './src/utils/generateId.js';
import { syncComplaintToMasterIssue, supportMasterIssue } from './src/services/masterIssueService.js';
import { evaluateComplaintSimilarity, calculateDistanceMeters } from './src/services/duplicateDetectionService.js';
import { calculateDynamicPriority } from './src/services/priorityScoringService.js';
import { analyzeCivicHotspots } from './src/services/hotspotService.js';

async function runPhase4TestSuite() {
  console.log('====================================================');
  console.log('   CIVICPULSE AI — PHASE 4 VERIFICATION SUITE       ');
  console.log('   DUPLICATE DETECTION, MASTER ISSUES & HOTSPOTS    ');
  console.log('====================================================');

  await connectDB();
  const results = [];
  const testComplaintIds = [];
  let testMasterIssueId = null;
  let masterIssueC_Id = null;

  // Clean up any previous test remnants
  await Complaint.deleteMany({ 'location.address': { $regex: /Oak Street/i } });
  await MasterIssue.deleteMany({ 'location.address': { $regex: /Oak Street/i } });

  try {
    // -------------------------------------------------------------
    // TEST 1: Submit a pothole complaint & Create Master Issue
    // -------------------------------------------------------------
    console.log('\n[TEST 1] Creating Primary Pothole Complaint A...');
    const complaintA_Id = generateComplaintId();
    testComplaintIds.push(complaintA_Id);

    const complaintA = await Complaint.create({
      complaintId: complaintA_Id,
      category: 'Roadways & Pavement',
      description: 'Severe deep asphalt pothole on 400 Oak Street. Causing vehicular damage and rim deformation.',
      location: {
        address: '400 Oak Street near 4th Ave',
        latitude: 37.774900,
        longitude: -122.419400,
      },
      status: 'Pending',
      severity: 'High',
      department: 'Road Maintenance Department',
      aiAnalysis: {
        isCivicIssue: true,
        category: 'Road Damage',
        detectedIssue: 'Severe asphalt pothole with rim hazard',
        severityScore: 72,
        severityLevel: 'High',
        safetyRisk: { level: 'High', description: 'Vehicle rim damage and sudden braking', affectedGroups: ['Motorists', 'Cyclists'] },
        analysisStatus: 'Completed',
      },
    });

    const syncA = await syncComplaintToMasterIssue(complaintA);
    testMasterIssueId = syncA.masterIssue?.masterIssueId;
    console.log(` -> Created Master Issue: ${testMasterIssueId} (Action: ${syncA.actionTaken})`);

    const passTest1 =
      syncA.actionTaken === 'CreatedNewMasterIssue' &&
      testMasterIssueId &&
      syncA.masterIssue.primaryComplaintId === complaintA_Id &&
      syncA.masterIssue.supportingReportCount === 1;

    results.push({ name: 'TEST 1: Submit Primary Pothole Complaint & Form Master Issue', passed: passTest1 });

    // -------------------------------------------------------------
    // TEST 2 & 3 & 4: Submit Similar Pothole Complaint within 100m (Strong Match)
    // -------------------------------------------------------------
    console.log('\n[TEST 2-4] Submitting Similar Pothole Complaint B (~35m away)...');
    const complaintB_Id = generateComplaintId();
    testComplaintIds.push(complaintB_Id);

    // Coordinate ~35m away (approx 0.0003 deg lat)
    const latB = 37.775150;
    const lonB = -122.419250;
    const distanceMeters = calculateDistanceMeters(37.774900, -122.419400, latB, lonB);
    console.log(` -> Measured distance between Complaint A and B: ${distanceMeters} meters (within 100m threshold)`);

    const complaintB = await Complaint.create({
      complaintId: complaintB_Id,
      category: 'Roadways & Pavement',
      description: 'Very deep pothole on Oak Street right outside number 410. Cars swerving dangerously.',
      location: {
        address: '410 Oak Street',
        latitude: latB,
        longitude: lonB,
      },
      status: 'Pending',
      severity: 'High',
      department: 'Road Maintenance Department',
      aiAnalysis: {
        isCivicIssue: true,
        category: 'Road Damage',
        detectedIssue: 'Deep street pothole causing erratic driving',
        severityScore: 75,
        severityLevel: 'High',
        safetyRisk: { level: 'High', description: 'Erratic swerving collision risk', affectedGroups: ['Motorists', 'Pedestrians'] },
        analysisStatus: 'Completed',
      },
    });

    // Check similarity calculation
    const similarity = evaluateComplaintSimilarity(complaintB, syncA.masterIssue, 100);
    console.log(` -> Similarity Confidence: ${similarity.confidence} | Match Type: ${similarity.matchType}`);
    console.log(` -> Match Reason: ${similarity.matchReason}`);

    const syncB = await syncComplaintToMasterIssue(complaintB);
    console.log(` -> Sync Action: ${syncB.actionTaken}`);

    const updatedMasterAfterB = await MasterIssue.findOne({ masterIssueId: testMasterIssueId });
    console.log(` -> Master Issue Supporting Reports: ${updatedMasterAfterB.supportingReportCount}`);
    console.log(` -> Master Issue Associated Complaints:`, updatedMasterAfterB.associatedComplaintIds);
    console.log(` -> Recalculated Priority Score: ${updatedMasterAfterB.priority.score} (${updatedMasterAfterB.priority.level})`);

    const passTest2_4 =
      similarity.matchType === 'Strong' &&
      syncB.actionTaken === 'MergedToExistingMasterIssue' &&
      updatedMasterAfterB.supportingReportCount === 2 &&
      updatedMasterAfterB.associatedComplaintIds.includes(complaintB_Id) &&
      updatedMasterAfterB.priority.score > syncA.masterIssue.priority.score; // Priority increased with community reports

    results.push({ name: 'TEST 2-4: Duplicate Detection within 100m & Strong Match Merging', passed: passTest2_4 });

    // -------------------------------------------------------------
    // TEST 5 & 6: Submit Unrelated Complaint at Exact Same Coordinates
    // -------------------------------------------------------------
    console.log('\n[TEST 5-6] Submitting Unrelated Streetlight Complaint C at EXACT same coordinates...');
    const complaintC_Id = generateComplaintId();
    testComplaintIds.push(complaintC_Id);

    const complaintC = await Complaint.create({
      complaintId: complaintC_Id,
      category: 'Electrical & Lighting',
      description: 'Streetlight pole #42 is completely dark at night. Bulb is shattered.',
      location: {
        address: '400 Oak Street (at lamppost)',
        latitude: 37.774900,
        longitude: -122.419400, // Exact same coordinates as Complaint A!
      },
      status: 'Pending',
      severity: 'Medium',
      department: 'Electrical Maintenance Department',
      aiAnalysis: {
        isCivicIssue: true,
        category: 'Streetlight Problems',
        detectedIssue: 'Non-functional dark streetlight pole with broken bulb',
        severityScore: 40,
        severityLevel: 'Medium',
        safetyRisk: { level: 'Medium', description: 'Dark sidewalk pedestrian security', affectedGroups: ['Pedestrians'] },
        analysisStatus: 'Completed',
      },
    });

    const similarityC = evaluateComplaintSimilarity(complaintC, updatedMasterAfterB, 100);
    console.log(` -> Similarity Confidence for Streetlight vs Pothole: ${similarityC.confidence} | Match Type: ${similarityC.matchType}`);
    console.log(` -> Match Reason: ${similarityC.matchReason}`);

    const syncC = await syncComplaintToMasterIssue(complaintC);
    masterIssueC_Id = syncC.masterIssue?.masterIssueId;
    console.log(` -> Sync Action: ${syncC.actionTaken} -> Created Separate Master Issue: ${masterIssueC_Id}`);

    const passTest5_6 =
      similarityC.matchType === 'Unrelated' &&
      syncC.actionTaken === 'CreatedNewMasterIssue' &&
      masterIssueC_Id !== testMasterIssueId; // Must NOT be merged into pothole master issue!

    results.push({ name: 'TEST 5-6: Guardrail: Unrelated Issue at Same Location is NOT Merged', passed: passTest5_6 });

    // -------------------------------------------------------------
    // TEST 7: Citizen "I am also affected" Support Endorsement
    // -------------------------------------------------------------
    console.log('\n[TEST 7] Citizen Endorsement ("I am also affected") on Pothole Master Issue...');
    const citizenUser1 = 'citizen-user-alpha-998';
    const supportRes1 = await supportMasterIssue(testMasterIssueId, citizenUser1);

    console.log(` -> Support Count: ${supportRes1.citizenSupportCount}`);
    console.log(` -> Priority Score after support: ${supportRes1.priority.score} (${supportRes1.priority.level})`);

    const passTest7 =
      supportRes1.success === true &&
      supportRes1.citizenSupportCount === 1 &&
      supportRes1.hasSupported === true;

    results.push({ name: 'TEST 7: Citizen Endorsement Support ("I am also affected")', passed: passTest7 });

    // -------------------------------------------------------------
    // TEST 8: Prevent Duplicate Support from Same Citizen
    // -------------------------------------------------------------
    console.log('\n[TEST 8] Attempting Duplicate Support from Same Citizen...');
    let duplicateSupportBlocked = false;
    try {
      await supportMasterIssue(testMasterIssueId, citizenUser1);
    } catch (err) {
      duplicateSupportBlocked = err.statusCode === 409 || err.message.includes('already registered');
      console.log(` -> Correctly blocked with message: "${err.message}"`);
    }

    results.push({ name: 'TEST 8: Prevent Duplicate Citizen Endorsements (409 Conflict)', passed: duplicateSupportBlocked });

    // -------------------------------------------------------------
    // TEST 9: Priority Score Recalculation Verification
    // -------------------------------------------------------------
    console.log('\n[TEST 9] Verifying Priority Formula & Explainable Breakdown...');
    const masterFinal = await MasterIssue.findOne({ masterIssueId: testMasterIssueId });
    const priority = masterFinal.priority;

    console.log(` -> Severity Score (40%): ${priority.breakdown.severityScore}`);
    console.log(` -> Safety Score (25%): ${priority.breakdown.safetyScore}`);
    console.log(` -> Collective Score (20%): ${priority.breakdown.collectiveScore} (Reports: ${masterFinal.supportingReportCount}, Endorsements: ${masterFinal.citizenSupportCount})`);
    console.log(` -> Location Score (15%): ${priority.breakdown.locationScore}`);
    console.log(` -> Final Score: ${priority.score} (${priority.level})`);
    console.log(` -> Explanation: "${priority.explanation}"`);

    // Verify mathematical bounds
    const expectedComposite = Math.round(
      priority.breakdown.severityScore * 0.40 +
      priority.breakdown.safetyScore * 0.25 +
      priority.breakdown.collectiveScore * 0.20 +
      priority.breakdown.locationScore * 0.15
    );

    const passTest9 =
      priority.score === expectedComposite &&
      priority.score >= 0 &&
      priority.score <= 100 &&
      priority.explanation.length > 20;

    results.push({ name: 'TEST 9: Explainable Multi-factor Dynamic Priority Recalculation', passed: passTest9 });

    // -------------------------------------------------------------
    // TEST 10: Civic Hotspot Aggregation
    // -------------------------------------------------------------
    console.log('\n[TEST 10] Testing Civic Hotspot Geospatial Clustering...');
    const allComplaints = await Complaint.find({ status: { $ne: 'Rejected' } }).lean();
    const hotspotAnalysis = analyzeCivicHotspots(allComplaints, { radiusMeters: 400 });

    console.log(` -> Identified Hotspots: ${hotspotAnalysis.data.totalHotspots}`);
    const oakStreetHotspot = hotspotAnalysis.data.hotspots.find((h) =>
      h.sampleAddresses.some((a) => a.toLowerCase().includes('oak street'))
    );

    console.log(` -> Oak Street Hotspot:`, oakStreetHotspot ? {
      zone: oakStreetHotspot.zone,
      category: oakStreetHotspot.category,
      count: oakStreetHotspot.complaintCount,
      trend: oakStreetHotspot.trend,
      intensity: oakStreetHotspot.intensity,
    } : 'Not found');

    const passTest10 =
      hotspotAnalysis.success === true &&
      hotspotAnalysis.data.hotspots.length > 0 &&
      oakStreetHotspot &&
      oakStreetHotspot.complaintCount >= 2;

    results.push({ name: 'TEST 10: Geographic Hotspot Clustering & Temporal Trend Detection', passed: passTest10 });

    // -------------------------------------------------------------
    // TEST 11: Original Individual Complaints Remain Fully Accessible
    // -------------------------------------------------------------
    console.log('\n[TEST 11] Verifying Original Individual Complaints Remain Accessible...');
    const retrievedA = await Complaint.findOne({ complaintId: complaintA_Id });
    const retrievedB = await Complaint.findOne({ complaintId: complaintB_Id });
    const retrievedC = await Complaint.findOne({ complaintId: complaintC_Id });

    console.log(` -> Complaint A accessible: ${retrievedA.complaintId} (Master: ${retrievedA.masterIssueId}, isPrimary: ${retrievedA.isMasterIssuePrimary})`);
    console.log(` -> Complaint B accessible: ${retrievedB.complaintId} (Master: ${retrievedB.masterIssueId}, isPrimary: ${retrievedB.isMasterIssuePrimary})`);
    console.log(` -> Complaint C accessible: ${retrievedC.complaintId} (Master: ${retrievedC.masterIssueId}, isPrimary: ${retrievedC.isMasterIssuePrimary})`);

    const passTest11 =
      retrievedA && retrievedB && retrievedC &&
      retrievedA.description === complaintA.description &&
      retrievedB.description === complaintB.description &&
      retrievedC.description === complaintC.description &&
      retrievedA.masterIssueId === testMasterIssueId &&
      retrievedB.masterIssueId === testMasterIssueId &&
      retrievedC.masterIssueId === masterIssueC_Id;

    results.push({ name: 'TEST 11: Original Complaint Records Preserved & Independently Queryable', passed: passTest11 });

    // Clean up test records
    console.log('\nCleaning up Phase 4 test documents...');
    await Complaint.deleteMany({ complaintId: { $in: testComplaintIds } });
    if (testMasterIssueId) await MasterIssue.deleteOne({ masterIssueId: testMasterIssueId });
    if (masterIssueC_Id) await MasterIssue.deleteOne({ masterIssueId: masterIssueC_Id });
    console.log('Cleaned up test complaints and master issues.');

    // -------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------
    console.log('\n====================================================');
    console.log('                 PHASE 4 TEST RESULTS               ');
    console.log('====================================================');
    let allPassed = true;
    for (const r of results) {
      console.log(`[${r.passed ? 'PASS' : 'FAIL'}] ${r.name}`);
      if (!r.passed) allPassed = false;
    }
    console.log('====================================================');
    console.log(`OVERALL RESULT: ${allPassed ? 'ALL 11 TESTS PASSED SUCCESSFULLY' : 'SOME TESTS FAILED'}`);
    console.log('====================================================\n');

    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('Test Suite encountered error:', error);
    process.exit(1);
  }
}

runPhase4TestSuite();
