/**
 * CivicPulse AI — Dynamic Civic Priority Scoring Engine
 * 
 * Computes an explainable, multi-factor priority score based on:
 * - AI Severity (40%)
 * - Public Safety Risk (25%)
 * - Collective Citizen Impact (20%)
 * - Location Criticality / Infrastructure Importance (15%)
 */

// Weight constants per civic specification
export const WEIGHTS = {
  SEVERITY: 0.40,
  SAFETY: 0.25,
  COLLECTIVE: 0.20,
  LOCATION: 0.15,
};

/**
 * Sensitive and high-priority landmark keywords for location importance detection
 */
const LOCATION_IMPORTANCE_RULES = [
  {
    regex: /\b(hospital|emergency|trauma|clinic|ambulance|urgent care|medical center)\b/i,
    score: 100,
    type: 'Hospital & Emergency Healthcare Route',
    reason: 'Direct access route for emergency services and healthcare patients.',
  },
  {
    regex: /\b(school|elementary|kindergarten|high school|academy|university|college|daycare|nursery)\b/i,
    score: 90,
    type: 'School & Educational Zone',
    reason: 'High density of vulnerable pedestrians (children, students, parents).',
  },
  {
    regex: /\b(metro|subway|transit center|bus station|train station|terminal|railway)\b/i,
    score: 85,
    type: 'Major Public Transit Hub',
    reason: 'High daily footfall and transit connectivity artery.',
  },
  {
    regex: /\b(bridge|expressway|highway|freeway|flyover|arterial|boulevard|interstate)\b/i,
    score: 80,
    type: 'Arterial Transport Corridor',
    reason: 'High-speed or high-volume vehicular route where failure creates gridlock.',
  },
  {
    regex: /\b(market|plaza|downtown|civic center|library|public square|town square)\b/i,
    score: 65,
    type: 'Public Commercial & Gathering Realm',
    reason: 'Commercial activity zone with elevated pedestrian presence.',
  },
];

/**
 * Evaluate location importance score and provide explainable reason
 * @param {string} address 
 * @returns {{ score: number, locationType: string, reason: string }}
 */
export const evaluateLocationImportance = (address = '') => {
  if (!address || typeof address !== 'string') {
    return {
      score: 50,
      locationType: 'Unverified / Neutral',
      reason: 'No address text available to determine infrastructure sensitivity; neutral baseline applied.',
    };
  }

  for (const rule of LOCATION_IMPORTANCE_RULES) {
    if (rule.regex.test(address)) {
      return {
        score: rule.score,
        locationType: rule.type,
        reason: rule.reason,
      };
    }
  }

  // Neutral default: standard local municipal roadway
  return {
    score: 50,
    locationType: 'Standard Municipal Area',
    reason: 'Standard local roadway / neighborhood zone; neutral unverified baseline applied.',
  };
};

/**
 * Normalize public safety risk level into a 0–100 score
 * @param {Object} safetyRisk - { level, affectedGroups }
 * @param {string} defaultLevel 
 * @returns {number}
 */
export const evaluateSafetyScore = (safetyRisk = {}, defaultLevel = 'Medium') => {
  const level = (safetyRisk.level || defaultLevel).toLowerCase();
  let baseScore = 50;

  switch (level) {
    case 'critical':
      baseScore = 100;
      break;
    case 'high':
      baseScore = 75;
      break;
    case 'medium':
    case 'moderate':
      baseScore = 50;
      break;
    case 'low':
      baseScore = 25;
      break;
    default:
      baseScore = 50;
  }

  // Boost if vulnerable groups (children, elderly, disabled, cyclists) are noted
  const affected = Array.isArray(safetyRisk.affectedGroups)
    ? safetyRisk.affectedGroups.map((g) => g.toLowerCase())
    : [];

  const hasVulnerable = affected.some((g) =>
    g.includes('child') || g.includes('elder') || g.includes('pedestrian') || g.includes('cyclist') || g.includes('disabled')
  );

  if (hasVulnerable && baseScore < 100) {
    baseScore = Math.min(100, baseScore + 10);
  }

  return baseScore;
};

/**
 * Calculate collective citizen impact score using logarithmic diminishing returns
 * 
 * Formula: Math.min(100, Math.round(32 * Math.log2(effectiveSupport + 1)))
 * 
 * @param {number} reportCount - Number of formal duplicate complaints submitted
 * @param {number} citizenSupportCount - Number of "I am also affected" endorsements
 * @returns {number} Normalized score (0 to 100)
 */
export const evaluateCollectiveImpactScore = (reportCount = 1, citizenSupportCount = 0) => {
  const validReports = Math.max(1, Number(reportCount) || 1);
  const validSupport = Math.max(0, Number(citizenSupportCount) || 0);

  // Each verified complaint report has full weight; "also affected" click has 0.5 weight
  const effectiveSupport = validReports + (validSupport * 0.5);

  // Logarithmic diminishing return:
  // 1 report -> 32
  // 2 reports -> 51
  // 3 reports -> 64
  // 5 reports -> 83
  // 7+ reports -> 100 (capped)
  const rawScore = 32 * Math.log2(effectiveSupport + 1);
  const normalized = Math.min(100, Math.round(rawScore));

  return Math.max(20, normalized);
};

/**
 * Determine priority tier label from score
 * @param {number} score 
 * @returns {'Low' | 'Medium' | 'High' | 'Critical'}
 */
export const getPriorityLevel = (score) => {
  if (score >= 75) return 'Critical';
  if (score >= 50) return 'High';
  if (score >= 25) return 'Medium';
  return 'Low';
};

/**
 * Calculate full dynamic priority score and explainability breakdown
 * 
 * @param {Object} params
 * @param {number} params.severityScore - AI severity score (0–100)
 * @param {Object} [params.safetyRisk] - Safety risk metadata { level, description, affectedGroups }
 * @param {number} [params.supportingReportCount=1] - Number of duplicate complaint records
 * @param {number} [params.citizenSupportCount=0] - Number of citizen upvotes ("I am also affected")
 * @param {string} [params.address=''] - Location address text
 * @returns {Object} Priority assessment { score, level, breakdown, explanation, lastCalculatedAt }
 */
export const calculateDynamicPriority = ({
  severityScore = 50,
  safetyRisk = {},
  supportingReportCount = 1,
  citizenSupportCount = 0,
  address = '',
}) => {
  // 1. Normalized Severity Score (0-100)
  const normSeverity = Math.max(0, Math.min(100, Math.round(Number(severityScore) || 50)));

  // 2. Normalized Safety Score (0-100)
  const normSafety = evaluateSafetyScore(safetyRisk);

  // 3. Normalized Collective Impact Score (0-100)
  const normCollective = evaluateCollectiveImpactScore(supportingReportCount, citizenSupportCount);

  // 4. Normalized Location Importance Score (0-100)
  const locationMeta = evaluateLocationImportance(address);
  const normLocation = locationMeta.score;

  // Composite Weighted Calculation
  const compositeScore = Math.round(
    normSeverity * WEIGHTS.SEVERITY +
    normSafety * WEIGHTS.SAFETY +
    normCollective * WEIGHTS.COLLECTIVE +
    normLocation * WEIGHTS.LOCATION
  );

  const finalScore = Math.max(0, Math.min(100, compositeScore));
  const level = getPriorityLevel(finalScore);

  // Build human-explainable narrative
  const explanation = `Score ${finalScore} (${level}): Driven by AI severity (${normSeverity} × 40%), public safety risk (${normSafety} × 25%), collective community impact (${normCollective} × 20% across ${supportingReportCount} report(s) and ${citizenSupportCount} citizen endorsement(s)), and location criticality (${normLocation} × 15% - ${locationMeta.locationType}).`;

  return {
    score: finalScore,
    level,
    breakdown: {
      severityScore: normSeverity,
      safetyScore: normSafety,
      collectiveScore: normCollective,
      locationScore: normLocation,
    },
    locationMeta,
    explanation,
    lastCalculatedAt: new Date(),
  };
};
