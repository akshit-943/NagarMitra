/**
 * CivicPulse AI — Intelligent Duplicate Complaint Detection Engine
 * 
 * Evaluates geographic proximity, category correlation, text similarity,
 * and AI multimodal issue descriptions to identify duplicate civic reports.
 */

// Default configuration (can be overridden via environment variables)
export const DEFAULT_RADIUS_METERS = Number(process.env.DUPLICATE_RADIUS_METERS) || 100;
export const STRONG_MATCH_THRESHOLD = 0.65;
export const POSSIBLE_MATCH_THRESHOLD = 0.45;

/**
 * Standard stop words for civic description tokenization
 */
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'in', 'on', 'at',
  'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about', 'into', 'over', 'after',
  'there', 'this', 'that', 'these', 'those', 'it', 'its', 'near', 'very', 'please',
  'problem', 'issue', 'reported', 'seeing', 'have', 'has', 'had', 'been', 'my', 'we'
]);

/**
 * Related category matrix for civic problem taxonomy
 */
const RELATED_CATEGORIES = {
  'Road Damage': ['Roadways & Pavement'],
  'Roadways & Pavement': ['Road Damage'],
  'Garbage Accumulation': ['Sanitation & Waste'],
  'Sanitation & Waste': ['Garbage Accumulation'],
  'Water Leakage': ['Drainage Issues', 'Water & Sanitation'],
  'Drainage Issues': ['Water Leakage', 'Water & Sanitation'],
  'Water & Sanitation': ['Water Leakage', 'Drainage Issues'],
  'Streetlight Problems': ['Electrical & Lighting'],
  'Electrical & Lighting': ['Streetlight Problems'],
  'Public Infrastructure Damage': ['Public Infrastructure'],
};

/**
 * Calculate great-circle distance between two GPS coordinates using Haversine formula
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {number} Distance in meters
 */
export const calculateDistanceMeters = (lat1, lon1, lat2, lon2) => {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) {
    return Infinity;
  }

  const R = 6371e3; // Earth's radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
};

/**
 * Evaluate category similarity score (0.0 to 1.0)
 * @param {string} cat1 
 * @param {string} cat2 
 * @returns {number}
 */
export const evaluateCategorySimilarity = (cat1, cat2) => {
  if (!cat1 || !cat2) return 0.0;
  const c1 = cat1.trim().toLowerCase();
  const c2 = cat2.trim().toLowerCase();

  if (c1 === c2) return 1.0;

  // Check mapped related categories
  for (const [key, related] of Object.entries(RELATED_CATEGORIES)) {
    const keyLower = key.toLowerCase();
    const relatedLowers = related.map((r) => r.toLowerCase());

    const matchesKey = c1 === keyLower || relatedLowers.includes(c1);
    const matchesTarget = c2 === keyLower || relatedLowers.includes(c2);

    if (matchesKey && matchesTarget) {
      return 0.85;
    }
  }

  return 0.0;
};

/**
 * Tokenize and normalize text into meaningful keyword set
 * @param {string} text 
 * @returns {Set<string>}
 */
export const tokenizeText = (text) => {
  if (!text || typeof text !== 'string') return new Set();

  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  return new Set(words);
};

/**
 * Calculate Sørensen-Dice coefficient similarity between two text strings (0.0 to 1.0)
 * @param {string} text1 
 * @param {string} text2 
 * @returns {number}
 */
export const evaluateTextSimilarity = (text1, text2) => {
  const setA = tokenizeText(text1);
  const setB = tokenizeText(text2);

  if (setA.size === 0 || setB.size === 0) return 0.0;

  let intersectionCount = 0;
  for (const token of setA) {
    if (setB.has(token)) {
      intersectionCount++;
    }
  }

  const similarity = (2 * intersectionCount) / (setA.size + setB.size);
  return Number(similarity.toFixed(3));
};

/**
 * Compare two complaints and calculate duplicate match confidence
 * 
 * @param {Object} complaintA - Target or newly submitted complaint
 * @param {Object} complaintB - Existing complaint or MasterIssue representation
 * @param {number} [radiusMeters] - Configurable proximity radius threshold
 * @returns {Object} { confidence, matchType, distanceMeters, breakdown, matchReason }
 */
export const evaluateComplaintSimilarity = (
  complaintA,
  complaintB,
  radiusMeters = DEFAULT_RADIUS_METERS
) => {
  // 1. Geographic distance
  const latA = complaintA.location?.latitude;
  const lonA = complaintA.location?.longitude;
  const latB = complaintB.location?.latitude;
  const lonB = complaintB.location?.longitude;

  const distanceMeters = calculateDistanceMeters(latA, lonA, latB, lonB);

  // Proximity score (1.0 at 0m, linearly decreasing to 0.0 at radiusMeters)
  let proximityScore = 0;
  const addrA = complaintA.location?.address || '';
  const addrB = complaintB.location?.address || '';
  const addressScore = (addrA && addrB) ? evaluateTextSimilarity(addrA, addrB) : 0;

  if (distanceMeters !== Infinity && distanceMeters <= radiusMeters) {
    proximityScore = Math.max(0, 1 - distanceMeters / radiusMeters);
  } else if (addressScore >= 0.5) {
    proximityScore = addressScore;
  }

  // 2. Category similarity (AI category prioritized, fallback to reported category)
  const catA = complaintA.aiAnalysis?.category || complaintA.category;
  const catB = complaintB.aiAnalysis?.category || complaintB.category;
  const categoryScore = evaluateCategorySimilarity(catA, catB);

  // IMPORTANT: If categories are completely unrelated, DO NOT merge even if at exact same location!
  // Two completely different problems (e.g. broken streetlight and pothole) can exist at the same place.
  if (categoryScore < 0.5) {
    return {
      confidence: 0.1,
      matchType: 'Unrelated',
      distanceMeters,
      breakdown: {
        proximityScore: Number(proximityScore.toFixed(2)),
        categoryScore: 0,
        textScore: 0,
        aiIssueScore: 0,
      },
      matchReason: `Unrelated categories (${catA} vs ${catB}) despite physical proximity (${distanceMeters}m).`,
    };
  }

  // 3. Text description & title similarity
  const descA = complaintA.description || complaintA.title || '';
  const descB = complaintB.description || complaintB.title || '';
  const textScore = evaluateTextSimilarity(descA, descB);

  // 4. AI Detected Issue similarity
  const aiIssueA = complaintA.aiAnalysis?.detectedIssue || complaintA.title || descA;
  const aiIssueB = complaintB.aiAnalysis?.detectedIssue || complaintB.title || descB;
  const aiIssueScore = (aiIssueA && aiIssueB)
    ? evaluateTextSimilarity(aiIssueA, aiIssueB)
    : textScore;

  // 5. Shared Civic Anchor Keywords Check (e.g. pothole, leak, pipe, trash, streetlight)
  const ANCHOR_KEYWORDS = [
    'pothole', 'crater', 'asphalt', 'manhole', 'leak', 'burst', 'pipe',
    'flood', 'flooding', 'drain', 'trash', 'garbage', 'dump', 'bin',
    'streetlight', 'light', 'lamp', 'signal', 'sidewalk', 'pavement'
  ];
  const combinedA = (descA + ' ' + aiIssueA).toLowerCase();
  const combinedB = (descB + ' ' + aiIssueB).toLowerCase();
  const sharedAnchors = ANCHOR_KEYWORDS.filter((k) => combinedA.includes(k) && combinedB.includes(k));

  let anchorBoost = 0;
  if (sharedAnchors.length > 0) {
    anchorBoost = 0.20;
  }

  // 6. Weighted composite confidence score
  // Weights: Proximity 35%, Category 35%, Text 15%, AI Detected Issue 15% + Anchor Boost
  let confidence =
    proximityScore * 0.35 +
    categoryScore * 0.35 +
    textScore * 0.15 +
    aiIssueScore * 0.15 +
    anchorBoost;

  // If very close (<50m), same category, and shared anchor word, minimum confidence is 0.80
  if (distanceMeters <= 50 && categoryScore >= 0.85 && sharedAnchors.length > 0) {
    confidence = Math.max(0.80, confidence);
  }

  confidence = Number(Math.max(0, Math.min(1.0, confidence)).toFixed(2));

  // 6. Classification
  let matchType = 'Unrelated';
  let matchReason = '';

  const isWithinRadius = (distanceMeters !== Infinity && distanceMeters <= radiusMeters) || addressScore >= 0.6;
  if (isWithinRadius && confidence >= STRONG_MATCH_THRESHOLD) {
    matchType = 'Strong';
    matchReason = `High-confidence duplicate: ${distanceMeters !== Infinity ? `${distanceMeters}m away` : 'matching address location'} with matching category '${catA}' and overlapping issue keywords.`;
  } else if (((distanceMeters !== Infinity && distanceMeters <= radiusMeters * 1.5) || addressScore >= 0.4) && confidence >= POSSIBLE_MATCH_THRESHOLD) {
    matchType = 'Possible';
    matchReason = `Potential duplicate: ${distanceMeters !== Infinity ? `${distanceMeters}m away` : 'similar address'} with compatible category '${catA}'. Flagged for municipal verification.`;
  } else {
    matchType = 'Unrelated';
    matchReason = `Distinct issue: confidence score (${confidence}) is below duplicate threshold (${POSSIBLE_MATCH_THRESHOLD}).`;
  }

  return {
    confidence,
    matchType,
    distanceMeters,
    breakdown: {
      proximityScore: Number(proximityScore.toFixed(2)),
      categoryScore: Number(categoryScore.toFixed(2)),
      textScore: Number(textScore.toFixed(2)),
      aiIssueScore: Number(aiIssueScore.toFixed(2)),
    },
    matchReason,
  };
};

/**
 * Scan existing MasterIssues to find matches for a newly submitted complaint
 * 
 * @param {Object} newComplaint 
 * @param {Array<Object>} existingMasterIssues 
 * @param {number} [radiusMeters]
 * @returns {Object} Best match outcome { bestMatch, matchType, confidence, masterIssueId, matchReason }
 */
export const findDuplicateMatch = (
  newComplaint,
  existingMasterIssues = [],
  radiusMeters = DEFAULT_RADIUS_METERS
) => {
  let highestConfidence = -1;
  let bestMatch = null;
  let bestMatchResult = null;

  for (const masterIssue of existingMasterIssues) {
    // Check against MasterIssue's primary location and category
    const result = evaluateComplaintSimilarity(newComplaint, masterIssue, radiusMeters);

    if (result.confidence > highestConfidence) {
      highestConfidence = result.confidence;
      bestMatch = masterIssue;
      bestMatchResult = result;
    }
  }

  if (bestMatch && bestMatchResult && bestMatchResult.matchType !== 'Unrelated') {
    return {
      hasMatch: true,
      matchType: bestMatchResult.matchType,
      confidence: bestMatchResult.confidence,
      masterIssue: bestMatch,
      masterIssueId: bestMatch.masterIssueId,
      distanceMeters: bestMatchResult.distanceMeters,
      matchReason: bestMatchResult.matchReason,
      breakdown: bestMatchResult.breakdown,
    };
  }

  return {
    hasMatch: false,
    matchType: 'Unrelated',
    confidence: highestConfidence >= 0 ? highestConfidence : 0,
    masterIssue: null,
    masterIssueId: null,
    matchReason: 'No matching existing master issue identified within geographical and category threshold.',
  };
};
