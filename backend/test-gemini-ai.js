import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { connectDB } from './src/config/db.js';
import Complaint from './src/models/Complaint.js';
import { generateComplaintId } from './src/utils/generateId.js';
import { uploadBufferToCloudinary } from './src/config/cloudinary.js';
import {
  analyzeComplaintWithGemini,
  isTrustedImageUrl,
  fetchCloudinaryImage,
} from './src/services/geminiService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runGeminiTestSuite() {
  console.log('====================================================');
  console.log('   CIVICPULSE AI — PHASE 3 GEMINI TEST SUITE       ');
  console.log('====================================================');
  console.log('Configured Gemini Model:', process.env.GEMINI_MODEL || 'gemini-3-flash-preview');
  console.log('Connecting to MongoDB Atlas...');
  await connectDB();

  const results = [];
  const fixturesDir = path.join(__dirname, 'test-fixtures');

  // Helper to load fixture buffer
  const loadFixture = (filename) => {
    const filePath = path.join(fixturesDir, filename);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Fixture file not found: ${filePath}`);
    }
    return fs.readFileSync(filePath);
  };

  // Helper to upload fixture to Cloudinary
  const uploadFixture = async (filename) => {
    const buffer = loadFixture(filename);
    const uploaded = await uploadBufferToCloudinary(buffer, { folder: 'civicpulse_test_phase3' });
    if (!uploaded.success) {
      throw new Error(`Cloudinary upload failed: ${uploaded.error}`);
    }
    return uploaded.url;
  };

  try {
    // -------------------------------------------------------------
    // TEST 1: ROAD DAMAGE ANALYSIS
    // -------------------------------------------------------------
    console.log('\n----------------------------------------------------');
    console.log('[TEST 1] Road Damage Analysis (Multimodal Photo + Text)');
    console.log('----------------------------------------------------');
    console.log('Uploading road_damage.jpg to Cloudinary...');
    const roadImageUrl = await uploadFixture('road_damage.jpg');
    console.log('Cloudinary URL:', roadImageUrl);

    const roadDescription = 'Dangerous deep pothole on Main Street with standing water. Vehicles swerving sharply to avoid tire blowouts.';
    console.log('Invoking Gemini Multimodal Engine...');
    const roadAi = await analyzeComplaintWithGemini({
      imageUrl: roadImageUrl,
      description: roadDescription,
      category: 'Roadways & Pavement',
      address: '450 Main St & 5th Ave',
    });

    console.log('AI Result:');
    console.log(' - isCivicIssue:', roadAi.isCivicIssue);
    console.log(' - Category:', roadAi.category);
    console.log(' - Detected Issue:', roadAi.detectedIssue);
    console.log(' - Severity:', `${roadAi.severityLevel} (${roadAi.severityScore}/100)`);
    console.log(' - Department:', roadAi.department);
    console.log(' - Safety Risk:', roadAi.safetyRisk?.level, '-', roadAi.safetyRisk?.description);
    console.log(' - Recommendations:', roadAi.recommendations?.length, 'steps');

    const passTest1 =
      roadAi.isCivicIssue === true &&
      roadAi.category === 'Road Damage' &&
      roadAi.severityScore >= 50 &&
      roadAi.recommendations.length > 0;

    results.push({ name: 'TEST 1: Road Damage Classification', passed: passTest1 });

    // Store in MongoDB to test persistence
    const roadComplaint = await Complaint.create({
      complaintId: await generateComplaintId(),
      category: 'Roadways & Pavement',
      description: roadDescription,
      location: { address: '450 Main St & 5th Ave', latitude: 37.7749, longitude: -122.4194 },
      imageUrl: roadImageUrl,
      severity: roadAi.severityLevel,
      department: roadAi.department,
      aiAnalysis: {
        ...roadAi,
        analyzedAt: new Date(),
        analysisStatus: 'Completed',
      },
    });
    console.log('Persisted to MongoDB with complaintId:', roadComplaint.complaintId);

    // -------------------------------------------------------------
    // TEST 2: GARBAGE ACCUMULATION ANALYSIS
    // -------------------------------------------------------------
    console.log('\n----------------------------------------------------');
    console.log('[TEST 2] Garbage Accumulation Analysis');
    console.log('----------------------------------------------------');
    console.log('Uploading garbage_dump.jpg to Cloudinary...');
    const garbageImageUrl = await uploadFixture('garbage_dump.jpg');
    console.log('Cloudinary URL:', garbageImageUrl);

    const garbageDescription = 'Wheelie bin overflowing with large amounts of cups and litter spreading onto the public walkway. Odor attracting pests.';
    console.log('Invoking Gemini Multimodal Engine...');
    const garbageAi = await analyzeComplaintWithGemini({
      imageUrl: garbageImageUrl,
      description: garbageDescription,
      category: 'Sanitation & Waste',
      address: '22 Elm Street Sidewalk',
    });

    console.log('AI Result:');
    console.log(' - isCivicIssue:', garbageAi.isCivicIssue);
    console.log(' - Category:', garbageAi.category);
    console.log(' - Detected Issue:', garbageAi.detectedIssue);
    console.log(' - Severity:', `${garbageAi.severityLevel} (${garbageAi.severityScore}/100)`);
    console.log(' - Department:', garbageAi.department);
    console.log(' - Recommendations:', garbageAi.recommendations?.slice(0, 2));

    const passTest2 =
      garbageAi.isCivicIssue === true &&
      garbageAi.category === 'Garbage Accumulation' &&
      garbageAi.department.toLowerCase().includes('sanitation');

    results.push({ name: 'TEST 2: Garbage Accumulation Classification', passed: passTest2 });

    // -------------------------------------------------------------
    // TEST 3: WATER LEAKAGE / FLOODING ANALYSIS
    // -------------------------------------------------------------
    console.log('\n----------------------------------------------------');
    console.log('[TEST 3] Water Leakage & Flooding Analysis');
    console.log('----------------------------------------------------');
    console.log('Uploading water_leak.jpg to Cloudinary...');
    const waterImageUrl = await uploadFixture('water_leak.jpg');
    console.log('Cloudinary URL:', waterImageUrl);

    const waterDescription = 'Severe stormwater inundation flooding roadway up to vehicle wheel wells. Road impassable.';
    console.log('Invoking Gemini Multimodal Engine...');
    const waterAi = await analyzeComplaintWithGemini({
      imageUrl: waterImageUrl,
      description: waterDescription,
      category: 'Water & Sanitation',
      address: 'River Road Underpass',
    });

    console.log('AI Result:');
    console.log(' - isCivicIssue:', waterAi.isCivicIssue);
    console.log(' - Category:', waterAi.category);
    console.log(' - Detected Issue:', waterAi.detectedIssue);
    console.log(' - Severity:', `${waterAi.severityLevel} (${waterAi.severityScore}/100)`);
    console.log(' - Department:', waterAi.department);

    const passTest3 =
      waterAi.isCivicIssue === true &&
      (waterAi.category === 'Water Leakage' || waterAi.category === 'Drainage Issues' || waterAi.category === 'Public Infrastructure Damage') &&
      waterAi.severityScore >= 60;

    results.push({ name: 'TEST 3: Water Leakage & Inundation Analysis', passed: passTest3 });

    // -------------------------------------------------------------
    // TEST 4: NON-CIVIC IMAGE (FLAGGING & REVIEW)
    // -------------------------------------------------------------
    console.log('\n----------------------------------------------------');
    console.log('[TEST 4] Non-Civic Image Guardrail (Cat Portrait)');
    console.log('----------------------------------------------------');
    console.log('Uploading non_civic_cat.jpg to Cloudinary...');
    const catImageUrl = await uploadFixture('non_civic_cat.jpg');
    console.log('Cloudinary URL:', catImageUrl);

    const catDescription = 'Picture of a pet cat sitting on a ledge indoors.';
    console.log('Invoking Gemini Multimodal Engine...');
    const catAi = await analyzeComplaintWithGemini({
      imageUrl: catImageUrl,
      description: catDescription,
      category: 'Other Civic Issues',
      address: 'Private Apartment',
    });

    console.log('AI Result:');
    console.log(' - isCivicIssue:', catAi.isCivicIssue);
    console.log(' - Category:', catAi.category);
    console.log(' - requiresHumanReview:', catAi.requiresHumanReview);
    console.log(' - Reasoning:', catAi.reasoning);

    const passTest4 =
      catAi.isCivicIssue === false &&
      catAi.requiresHumanReview === true;

    results.push({ name: 'TEST 4: Non-Civic Image Guardrail (isCivicIssue: false, requiresHumanReview: true)', passed: passTest4 });

    // -------------------------------------------------------------
    // TEST 5: SSRF PROTECTION (MALICIOUS/EXTERNAL URL REJECTION)
    // -------------------------------------------------------------
    console.log('\n----------------------------------------------------');
    console.log('[TEST 5] Security Guardrail: SSRF Domain Verification');
    console.log('----------------------------------------------------');
    const untrustedUrl = 'https://attacker.example.com/exploit.jpg';
    const isAllowed = isTrustedImageUrl(untrustedUrl);
    console.log('Checking untrusted URL:', untrustedUrl, '-> Allowed?', isAllowed);

    let rejectedProperly = false;
    try {
      await fetchCloudinaryImage(untrustedUrl);
    } catch (err) {
      rejectedProperly = err.message.includes('Only Cloudinary URLs are allowed');
      console.log('Expected rejection caught:', err.message);
    }

    const passTest5 = !isAllowed && rejectedProperly;
    results.push({ name: 'TEST 5: SSRF Defense Rejects Non-Cloudinary Domains', passed: passTest5 });

    // -------------------------------------------------------------
    // TEST 6: RETRY ANALYSIS WORKFLOW
    // -------------------------------------------------------------
    console.log('\n----------------------------------------------------');
    console.log('[TEST 6] Retry Analysis Execution on Existing DB Complaint');
    console.log('----------------------------------------------------');
    // Create an unanalyzed complaint
    const retryComplaint = await Complaint.create({
      complaintId: await generateComplaintId(),
      category: 'Roadways & Pavement',
      description: 'Asphalt crumbling and forming hazardous depression on road.',
      location: { address: '88 Market St', latitude: 37.78, longitude: -122.40 },
      imageUrl: roadImageUrl,
      status: 'Pending',
      severity: null,
      department: 'General Municipal Services',
      aiAnalysis: {
        analysisStatus: 'Pending',
      },
    });

    console.log('Created pending complaint:', retryComplaint.complaintId);
    console.log('Executing re-analysis on complaint...');

    const reanalyzed = await analyzeComplaintWithGemini({
      imageUrl: retryComplaint.imageUrl,
      description: retryComplaint.description,
      category: retryComplaint.category,
      address: retryComplaint.location?.address,
    });

    retryComplaint.aiAnalysis = {
      ...reanalyzed,
      analyzedAt: new Date(),
      analysisStatus: 'Completed',
    };
    retryComplaint.severity = reanalyzed.severityLevel;
    retryComplaint.department = reanalyzed.department;
    await retryComplaint.save();

    const fetchedAfter = await Complaint.findOne({ complaintId: retryComplaint.complaintId });
    const passTest6 =
      fetchedAfter.aiAnalysis.analysisStatus === 'Completed' &&
      fetchedAfter.severity === reanalyzed.severityLevel &&
      fetchedAfter.aiAnalysis.severityScore > 0;

    console.log('Re-analysis persisted. Analysis status:', fetchedAfter.aiAnalysis.analysisStatus);
    console.log('Severity updated from null to:', fetchedAfter.severity);
    results.push({ name: 'TEST 6: Re-analysis and DB Persistence Workflow', passed: passTest6 });

    // Clean up test documents
    console.log('\nCleaning up test documents from database...');
    await Complaint.deleteMany({
      complaintId: { $in: [roadComplaint.complaintId, retryComplaint.complaintId] },
    });
    console.log('Cleaned up temporary test complaints.');

    // -------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------
    console.log('\n====================================================');
    console.log('                  TEST RESULTS                      ');
    console.log('====================================================');
    let allPassed = true;
    for (const r of results) {
      console.log(`[${r.passed ? 'PASS' : 'FAIL'}] ${r.name}`);
      if (!r.passed) allPassed = false;
    }
    console.log('====================================================');
    console.log(`OVERALL RESULT: ${allPassed ? 'ALL TESTS PASSED SUCCESSFULLY' : 'SOME TESTS FAILED'}`);
    console.log('====================================================\n');

    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('Test Suite encountered error:', error);
    process.exit(1);
  }
}

runGeminiTestSuite();
