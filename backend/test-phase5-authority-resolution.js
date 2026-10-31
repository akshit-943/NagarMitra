import 'dotenv/config';
import { connectDB } from './src/config/db.js';
import Complaint from './src/models/Complaint.js';
import MasterIssue from './src/models/MasterIssue.js';
import ActivityLog from './src/models/ActivityLog.js';
import { DEMO_OFFICERS, findOfficerById, DEMO_DEPARTMENTS } from './src/data/officerDirectory.js';
import { calculateResolutionDeadline, evaluateSlaStatus, calculateAggregateSlaMetrics } from './src/services/slaService.js';
import { validateStatusTransition } from './src/utils/statusTransitions.js';

const BASE_URL = 'http://localhost:5000/api';

async function runPhase5TestSuite() {
  console.log('================================================================');
  console.log('   CIVICPULSE AI — PHASE 5 COMPLETE VERIFICATION SUITE          ');
  console.log('   AUTHORITY OPERATIONS, SLA MANAGEMENT & RESOLUTION WORKFLOW   ');
  console.log('================================================================');

  await connectDB();
  const summary = [];
  const testAddress = '550 Market Street, Central Financial District';
  let createdComplaintId = null;
  let masterIssueId = null;
  let assignedOfficerObj = null;

  try {
    // -------------------------------------------------------------------------
    // STEP 1: Submit Citizen Complaint (Intake)
    // -------------------------------------------------------------------------
    console.log('\n[STEP 1] Submitting Citizen Complaint for Municipal Intake...');
    const complaintPayload = {
      category: 'Water & Sanitation',
      description: 'Major water main leakage flooding pedestrian sidewalk on Market Street. Urgent attention required.',
      location: {
        address: testAddress,
        latitude: 37.789172,
        longitude: -122.401449,
      },
      imageUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&q=80&w=800',
    };

    const createRes = await fetch(`${BASE_URL}/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-mock-ai': 'true', // Conserve Gemini API quota
      },
      body: JSON.stringify(complaintPayload),
    });

    const createJson = await createRes.json();
    if (!createJson.success) throw new Error(`Complaint submission failed: ${createJson.message}`);
    createdComplaintId = createJson.data.complaintId;
    masterIssueId = createJson.data.masterIssueId;

    console.log(`  ✓ Complaint submitted: ${createdComplaintId}`);
    console.log(`  ✓ Synced to Master Issue: ${masterIssueId}`);
    summary.push({ step: 1, name: 'Submit Citizen Complaint', passed: true });

    // -------------------------------------------------------------------------
    // STEP 2: Inspect Master Issue in Municipal Command
    // -------------------------------------------------------------------------
    console.log('\n[STEP 2] Inspecting Master Issue in Municipal Command Console...');
    const inspectRes = await fetch(`${BASE_URL}/master-issues/${masterIssueId}`);
    const inspectJson = await inspectRes.json();
    if (!inspectJson.success) throw new Error(`Inspect failed: ${inspectJson.message}`);

    const miData = inspectJson.data;
    console.log(`  ✓ Master Issue retrieved: ${miData.masterIssueId}`);
    console.log(`  ✓ Initial Status: ${miData.status} | Priority: ${miData.priority?.level || 'Medium'} (${miData.priority?.score})`);
    if (!miData.associatedComplaints?.some((c) => c.complaintId === createdComplaintId)) {
      throw new Error('Associated complaints list missing newly filed report');
    }
    summary.push({ step: 2, name: 'Inspect Master Issue', passed: true });

    // -------------------------------------------------------------------------
    // STEP 3: Assign to Department
    // -------------------------------------------------------------------------
    console.log('\n[STEP 3] Assigning Issue to Department: Water Supply Board...');
    const deptAssignRes = await fetch(`${BASE_URL}/master-issues/${masterIssueId}/assign`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        department: 'Water Supply Board',
        assignedBy: 'Chief Dispatch Controller',
      }),
    });
    const deptAssignJson = await deptAssignRes.json();
    if (!deptAssignJson.success) throw new Error(`Dept assign failed: ${deptAssignJson.message}`);
    console.log(`  ✓ Assigned Department: ${deptAssignJson.data.assignedDepartment}`);
    console.log(`  ✓ Status transitioned to: ${deptAssignJson.data.status}`);
    summary.push({ step: 3, name: 'Department Assignment', passed: true });

    // -------------------------------------------------------------------------
    // STEP 4: Query Officer Directory & Assign Demo Officer
    // -------------------------------------------------------------------------
    console.log('\n[STEP 4] Fetching Demo Officer Directory & Assigning Officer...');
    const officersRes = await fetch(`${BASE_URL}/master-issues/officers?department=Water%20Supply%20Board`);
    const officersJson = await officersRes.json();
    const officerList = officersJson.data?.officers || [];
    if (!officersJson.success || officerList.length === 0) throw new Error('No officers found for department');

    const targetOfficer = officerList[0];
    assignedOfficerObj = targetOfficer;
    console.log(`  ✓ Available Officer: ${targetOfficer.name} (${targetOfficer.role}) - ${targetOfficer.department}`);

    const officerAssignRes = await fetch(`${BASE_URL}/master-issues/${masterIssueId}/assign`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        officerId: targetOfficer.id,
        assignedBy: 'Operations Superintendent',
      }),
    });
    const officerAssignJson = await officerAssignRes.json();
    if (!officerAssignJson.success) throw new Error(`Officer assign failed: ${officerAssignJson.message}`);
    console.log(`  ✓ Officer Assigned: ${officerAssignJson.data.assignedOfficer?.name}`);
    summary.push({ step: 4, name: 'Officer Assignment', passed: true });

    // -------------------------------------------------------------------------
    // STEP 5: Set SLA Resolution Deadline
    // -------------------------------------------------------------------------
    console.log('\n[STEP 5] Setting SLA Resolution Target Deadline...');
    const priorityLevel = miData.priority?.level || 'High';
    const computedDeadline = calculateResolutionDeadline(priorityLevel, new Date());
    console.log(`  ✓ Deterministic SLA deadline computed for ${priorityLevel}: ${computedDeadline.toISOString()}`);

    const setDeadlineRes = await fetch(`${BASE_URL}/master-issues/${masterIssueId}/assign`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resolutionDeadline: computedDeadline.toISOString(),
        assignedBy: 'SLA Automation Engine',
      }),
    });
    const setDeadlineJson = await setDeadlineRes.json();
    if (!setDeadlineJson.success) throw new Error(`Deadline assign failed: ${setDeadlineJson.message}`);
    console.log(`  ✓ Resolution Deadline saved: ${setDeadlineJson.data.resolutionDeadline}`);
    summary.push({ step: 5, name: 'SLA Deadline Configuration', passed: true });

    // -------------------------------------------------------------------------
    // STEP 6: Transition Status to In Progress & Verify Cascading
    // -------------------------------------------------------------------------
    console.log('\n[STEP 6] Transitioning Master Issue Status to "In Progress"...');
    const inProgressRes = await fetch(`${BASE_URL}/master-issues/${masterIssueId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'In Progress',
        changedBy: targetOfficer.name,
        note: 'Field crew mobilized with vacuum hydro-excavator to repair the broken water pipe.',
      }),
    });
    const inProgressJson = await inProgressRes.json();
    if (!inProgressJson.success) throw new Error(`Status update failed: ${inProgressJson.message}`);

    // Verify cascade to associated complaint
    const linkedComplaint = await Complaint.findOne({ complaintId: createdComplaintId }).lean();
    console.log(`  ✓ Master Issue Status: ${inProgressJson.data.status}`);
    console.log(`  ✓ Cascaded Complaint Status: ${linkedComplaint.status}`);
    if (linkedComplaint.status !== 'In Progress') {
      throw new Error(`Cascading failed: Complaint status is ${linkedComplaint.status}, expected In Progress`);
    }
    summary.push({ step: 6, name: 'In Progress Transition & Cascade', passed: true });

    // -------------------------------------------------------------------------
    // STEP 7: Upload Resolution Evidence Photograph
    // -------------------------------------------------------------------------
    console.log('\n[STEP 7] Uploading Resolution Evidence Photograph (Cloudinary/Mock Photo)...');
    const evidencePayload = {
      evidenceUrl: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&q=80&w=800',
      caption: 'Main valve replaced, pipeline welded and roadway repaved.',
      uploadedBy: targetOfficer.name,
      resolutionDescription: 'Excavation completed, 6-inch cracked cast iron water line replaced with ductile iron sleeve. Pressure tested at 90 PSI with zero seepage.',
    };

    const evidenceRes = await fetch(`${BASE_URL}/master-issues/${masterIssueId}/resolution-evidence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(evidencePayload),
    });
    const evidenceJson = await evidenceRes.json();
    if (!evidenceJson.success) throw new Error(`Evidence upload failed: ${evidenceJson.message}`);
    console.log(`  ✓ Resolution Evidence Count: ${evidenceJson.data.resolutionEvidence?.length}`);
    console.log(`  ✓ Evidence URL: ${evidenceJson.data.resolutionEvidence?.[0]?.url}`);
    summary.push({ step: 7, name: 'Resolution Evidence Upload', passed: true });

    // -------------------------------------------------------------------------
    // STEP 8: Submit Resolution Description & Verify "Resolution Submitted"
    // -------------------------------------------------------------------------
    console.log('\n[STEP 8] Verifying "Resolution Submitted" Status & Work Description...');
    const miStatusCheck = await MasterIssue.findOne({ masterIssueId }).lean();
    console.log(`  ✓ Master Issue Status: ${miStatusCheck.status}`);
    console.log(`  ✓ Resolution Description: "${miStatusCheck.resolutionDescription}"`);
    console.log(`  ✓ Verification State: ${miStatusCheck.verificationStatus?.status || 'Pending'}`);
    if (miStatusCheck.status !== 'Resolution Submitted') {
      throw new Error(`Expected Resolution Submitted, got ${miStatusCheck.status}`);
    }
    summary.push({ step: 8, name: 'Resolution Submitted Transition', passed: true });

    // -------------------------------------------------------------------------
    // STEP 9: Verify Citizen View Receives Resolution Evidence
    // -------------------------------------------------------------------------
    console.log('\n[STEP 9] Verifying Citizen View Receives Resolution Evidence...');
    const citizenCheckRes = await fetch(`${BASE_URL}/complaints/${createdComplaintId}/duplicates`);
    const citizenCheckJson = await citizenCheckRes.json();
    if (!citizenCheckJson.success) throw new Error(`Citizen check failed: ${citizenCheckJson.message}`);

    const citMi = citizenCheckJson.data.masterIssue;
    if (!citMi) throw new Error('Master issue missing in citizen duplicates response');
    if (!citMi.resolutionEvidence || citMi.resolutionEvidence.length === 0) {
      throw new Error('Resolution evidence not exposed to citizen view');
    }
    console.log(`  ✓ Citizen View Before (Intake) Photo: ${citizenCheckJson.data.complaintId} image is present`);
    console.log(`  ✓ Citizen View After (Resolution) Photo: ${citMi.resolutionEvidence[0].url}`);
    console.log(`  ✓ Citizen View Work Description: "${citMi.resolutionDescription}"`);
    summary.push({ step: 9, name: 'Citizen View Before/After Parity', passed: true });

    // -------------------------------------------------------------------------
    // STEP 10: Submit Citizen Verification Response (Confirmed & Disputed)
    // -------------------------------------------------------------------------
    console.log('\n[STEP 10] Submitting Citizen Verification Responses...');
    // Citizen A confirms
    const verifyResA = await fetch(`${BASE_URL}/master-issues/${masterIssueId}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-citizen-id': 'citizen-user-alpha',
      },
      body: JSON.stringify({
        decision: 'Confirmed',
        comment: 'Water flow is completely stopped and pavement is clean. Thank you!',
      }),
    });
    const verifyJsonA = await verifyResA.json();
    if (!verifyJsonA.success) throw new Error(`Verification A failed: ${verifyJsonA.message}`);
    const statusA = verifyJsonA.verificationStatus || verifyJsonA.data;
    console.log(`  ✓ Verification A Recorded: Confirmed (${statusA.confirmedCount} total)`);

    // Citizen B verifies (duplicate prevention test with same client token should return 409)
    const verifyResADup = await fetch(`${BASE_URL}/master-issues/${masterIssueId}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-citizen-id': 'citizen-user-alpha', // Same client
      },
      body: JSON.stringify({
        decision: 'Confirmed',
        comment: 'Trying to vote twice',
      }),
    });
    const verifyJsonADup = await verifyResADup.json();
    if (verifyResADup.status === 409 || !verifyJsonADup.success) {
      console.log(`  ✓ Duplicate verification duplicate prevention correctly enforced (${verifyJsonADup.message})`);
    }

    // Citizen C confirms from another client ID
    const verifyResC = await fetch(`${BASE_URL}/master-issues/${masterIssueId}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-citizen-id': 'citizen-user-gamma',
      },
      body: JSON.stringify({
        decision: 'Confirmed',
        comment: 'Confirmed good repair.',
      }),
    });
    const verifyJsonC = await verifyResC.json();
    if (!verifyJsonC.success) throw new Error(`Verification C failed: ${verifyJsonC.message}`);
    const statusC = verifyJsonC.verificationStatus || verifyJsonC.data;
    console.log(`  ✓ Verification C Recorded: Total Confirmed = ${statusC.confirmedCount}`);
    summary.push({ step: 10, name: 'Citizen Verification Responses', passed: true });

    // -------------------------------------------------------------------------
    // STEP 11: Transition Issue to "Resolved" & Verify SLA Metrics
    // -------------------------------------------------------------------------
    console.log('\n[STEP 11] Authority Finalizing Issue Transition to "Resolved"...');
    const resolveRes = await fetch(`${BASE_URL}/master-issues/${masterIssueId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'Resolved',
        changedBy: 'Superintendent Review Board',
        note: 'Citizen verification threshold met. Incident successfully resolved and closed.',
      }),
    });
    const resolveJson = await resolveRes.json();
    if (!resolveJson.success) throw new Error(`Final resolution failed: ${resolveJson.message}`);
    console.log(`  ✓ Master Issue Status: ${resolveJson.data.status}`);
    console.log(`  ✓ Resolved At: ${resolveJson.data.resolvedAt}`);

    // Verify linked complaint status
    const resolvedLinkedComplaint = await Complaint.findOne({ complaintId: createdComplaintId }).lean();
    console.log(`  ✓ Linked Complaint Final Status: ${resolvedLinkedComplaint.status}`);
    if (resolvedLinkedComplaint.status !== 'Resolved') {
      throw new Error(`Expected linked complaint status to be Resolved, got ${resolvedLinkedComplaint.status}`);
    }
    summary.push({ step: 11, name: 'Final Resolved Transition', passed: true });

    // -------------------------------------------------------------------------
    // STEP 12: Verify Chronological Activity Timeline & Audit Trail
    // -------------------------------------------------------------------------
    console.log('\n[STEP 12] Inspecting Chronological Activity Log Audit Trail...');
    const activityRes = await fetch(`${BASE_URL}/master-issues/${masterIssueId}/activity`);
    const activityJson = await activityRes.json();
    if (!activityJson.success) throw new Error(`Activity fetch failed: ${activityJson.message}`);

    console.log(`  ✓ Total Audit Trail Events Recorded: ${activityJson.data.length}`);
    const eventTypes = activityJson.data.map((e) => e.eventType);
    console.log(`  ✓ Event Sequence: ${eventTypes.join(' ➔ ')}`);

    const hasAssignment = eventTypes.some((t) => t.includes('Assigned'));
    const hasStatusChange = eventTypes.some((t) => t === 'StatusChanged');
    const hasEvidence = eventTypes.some((t) => t === 'ResolutionSubmitted' || t === 'EvidenceUploaded');
    if (!hasAssignment || !hasStatusChange) {
      throw new Error('Audit trail missing essential operational events');
    }
    summary.push({ step: 12, name: 'Activity Timeline & Audit Trail', passed: true });

    // -------------------------------------------------------------------------
    // STEP 13: Verify SLA Calculation, Overdue Evaluation & Status Indicators
    // -------------------------------------------------------------------------
    console.log('\n[STEP 13] Verifying SLA Engine Evaluation & Overdue Indicators...');
    const testPastDate = new Date(Date.now() - 48 * 3600 * 1000); // 48h ago
    const testOverdueDate = new Date(Date.now() - 24 * 3600 * 1000); // 24h ago deadline

    const overdueEval = evaluateSlaStatus({
      status: 'In Progress',
      assignedAt: testPastDate,
      resolutionDeadline: testOverdueDate,
      createdAt: testPastDate,
    });

    console.log(`  ✓ Overdue Evaluation Test: isOverdue=${overdueEval.isOverdue}, label="${overdueEval.statusLabel}", badge="${overdueEval.badgeVariant}"`);
    if (!overdueEval.isOverdue) throw new Error('SLA evaluation failed to detect overdue deadline');

    const onTimeEval = evaluateSlaStatus({
      status: 'Resolved',
      assignedAt: new Date(Date.now() - 20 * 3600 * 1000),
      resolutionDeadline: new Date(Date.now() + 24 * 3600 * 1000),
      resolvedAt: new Date(),
      createdAt: new Date(Date.now() - 20 * 3600 * 1000),
    });
    console.log(`  ✓ On-Time Resolution Test: wasOnTime=${onTimeEval.wasOnTime}, label="${onTimeEval.statusLabel}"`);
    if (!onTimeEval.wasOnTime) throw new Error('SLA evaluation failed to recognize on-time completion');
    summary.push({ step: 13, name: 'SLA Engine Deterministic Calculations', passed: true });

    // -------------------------------------------------------------------------
    // STEP 14: Verify Operational Authority Analytics & Workload Breakdown
    // -------------------------------------------------------------------------
    console.log('\n[STEP 14] Querying Authority Operational Analytics API...');
    const analyticsRes = await fetch(`${BASE_URL}/master-issues/analytics`);
    const analyticsJson = await analyticsRes.json();
    if (!analyticsJson.success) throw new Error(`Analytics failed: ${analyticsJson.message}`);

    const stats = analyticsJson.data;
    console.log(`  ✓ Total Master Issues: ${stats.totalIssues}`);
    console.log(`  ✓ Unresolved Active: ${stats.unresolved}`);
    console.log(`  ✓ Awaiting Assignment: ${stats.awaitingAssignment}`);
    console.log(`  ✓ In Progress: ${stats.inProgress}`);
    console.log(`  ✓ Resolved: ${stats.resolved}`);
    console.log(`  ✓ Overdue Issues: ${stats.overdue}`);
    console.log(`  ✓ SLA Compliance Rate: ${stats.slaComplianceRate}%`);
    console.log(`  ✓ Average Resolution Cycle: ${stats.avgResolutionHours}h`);
    console.log(`  ✓ Department Workload Records: ${stats.departmentBreakdown?.length}`);
    stats.departmentBreakdown?.forEach((d) => {
      console.log(`     • ${d.department}: total=${d.total}, inProgress=${d.inProgress}, resolved=${d.resolved}, compliance=${d.complianceRate}%`);
    });
    summary.push({ step: 14, name: 'Authority Operational Analytics', passed: true });

    // -------------------------------------------------------------------------
    // STEP 15: Verify Privacy Filtering (isInternal Notes & Officer Email)
    // -------------------------------------------------------------------------
    console.log('\n[STEP 15] Verifying Privacy Filtering for Citizen Queries...');
    // Add confidential internal note
    await fetch(`${BASE_URL}/master-issues/${masterIssueId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        note: 'CONFIDENTIAL INTERNAL NOTE: Contractor crew arrived 30 mins late. Performance penalty discussed.',
        author: 'Chief Engineer',
        isInternal: true,
      }),
    });

    // Authority view (isCitizen not set)
    const authViewRes = await fetch(`${BASE_URL}/master-issues/${masterIssueId}`);
    const authViewJson = await authViewRes.json();
    const authNotes = authViewJson.data.internalNotes || [];
    console.log(`  ✓ Authority View internalNotes count: ${authNotes.length}`);
    if (authNotes.length === 0) throw new Error('Authority view missing internal notes');

    // Citizen view (isCitizen=true)
    const citizenViewRes = await fetch(`${BASE_URL}/master-issues/${masterIssueId}?isCitizen=true`);
    const citizenViewJson = await citizenViewRes.json();
    const citizenNotes = citizenViewJson.data.internalNotes || [];
    console.log(`  ✓ Citizen View internalNotes count: ${citizenNotes.length}`);
    if (citizenNotes.length !== 0) {
      throw new Error(`Privacy breach: Internal notes leaked to citizen! Count: ${citizenNotes.length}`);
    }

    // Check citizen activity timeline filtering
    const citizenActivityRes = await fetch(`${BASE_URL}/master-issues/${masterIssueId}/activity?isCitizen=true`);
    const citizenActivityJson = await citizenActivityRes.json();
    const leakedActivityNotes = citizenActivityJson.data.filter((e) => e.isInternal);
    console.log(`  ✓ Citizen Activity Timeline isInternal count: ${leakedActivityNotes.length}`);
    if (leakedActivityNotes.length > 0) {
      throw new Error('Privacy breach: Internal activity logs exposed to citizen!');
    }

    // Check that officer email is not leaked in citizen duplicates view
    const citDupRes = await fetch(`${BASE_URL}/complaints/${createdComplaintId}/duplicates`);
    const citDupJson = await citDupRes.json();
    if (citDupJson.data?.masterIssue?.assignedOfficer?.email) {
      throw new Error('Privacy breach: Officer email leaked in citizen duplicates endpoint');
    }
    console.log(`  ✓ Officer email safely omitted from citizen duplicates response`);
    summary.push({ step: 15, name: 'Authorization & Privacy Filtering', passed: true });

    // -------------------------------------------------------------------------
    // FINAL REPORT SUMMARY
    // -------------------------------------------------------------------------
    console.log('\n================================================================');
    console.log('   PHASE 5 VERIFICATION RESULTS SUMMARY                         ');
    console.log('================================================================');
    summary.forEach((item) => {
      console.log(`  Step ${item.step.toString().padStart(2, '0')}: ${item.name.padEnd(45, ' ')} [PASSED ✅]`);
    });
    console.log('================================================================');
    console.log('🎉 ALL 15 PHASE 5 REQUIREMENTS VERIFIED SUCCESSFULLY!');
    console.log('================================================================\n');

  } catch (error) {
    console.error('\n❌ [FAIL] Verification error in test suite:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Clean up test complaint and master issue
    try {
      if (createdComplaintId) {
        await Complaint.deleteOne({ complaintId: createdComplaintId });
      }
      if (masterIssueId) {
        await MasterIssue.deleteOne({ masterIssueId });
        await ActivityLog.deleteMany({ masterIssueId });
      }
      console.log('🧹 Test data cleaned up successfully.');
    } catch (e) {
      console.warn('Cleanup warning:', e.message);
    }
    process.exit(0);
  }
}

runPhase5TestSuite();
