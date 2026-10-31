import { calculateDistanceMeters } from './duplicateDetectionService.js';

// Default spatial clustering radius for civic hotspots: 400 meters
export const DEFAULT_HOTSPOT_RADIUS_METERS = 400;

/**
 * Cluster complaints geographically within a spatial distance radius
 * 
 * @param {Array<Object>} complaints - List of complaints with location.latitude & location.longitude
 * @param {number} [clusterRadiusMeters=400] 
 * @returns {Array<Object>} List of geographical clusters
 */
export const clusterComplaintsByProximity = (complaints, clusterRadiusMeters = DEFAULT_HOTSPOT_RADIUS_METERS) => {
  const validComplaints = complaints.filter(
    (c) => c.location && typeof c.location.latitude === 'number' && typeof c.location.longitude === 'number'
  );

  const visited = new Set();
  const clusters = [];

  for (let i = 0; i < validComplaints.length; i++) {
    if (visited.has(i)) continue;

    const base = validComplaints[i];
    visited.add(i);

    const members = [base];

    for (let j = i + 1; j < validComplaints.length; j++) {
      if (visited.has(j)) continue;

      const other = validComplaints[j];
      const dist = calculateDistanceMeters(
        base.location.latitude,
        base.location.longitude,
        other.location.latitude,
        other.location.longitude
      );

      if (dist <= clusterRadiusMeters) {
        visited.add(j);
        members.push(other);
      }
    }

    clusters.push(members);
  }

  return clusters;
};

/**
 * Derive human-readable zone name from cluster addresses
 * @param {Array<Object>} members 
 * @returns {string}
 */
const deriveZoneName = (members) => {
  if (!members || members.length === 0) return 'City Sector';

  // Find most frequent street/address token or use first address
  const addresses = members.map((m) => m.location?.address || '').filter(Boolean);
  if (addresses.length === 0) return 'Municipal Zone';

  const firstAddr = addresses[0];
  const parts = firstAddr.split(',');
  const primaryStreet = parts[0].trim();

  return `${primaryStreet} Zone`;
};

/**
 * Analyze temporal trend for a cluster over a reference time window (e.g. 30 days)
 * 
 * @param {Array<Object>} members 
 * @param {number} [days=30] 
 * @returns {{ timePeriod: string, trend: 'Increasing' | 'Stable' | 'Decreasing' | 'Baseline', recentCount: number, priorCount: number }}
 */
export const calculateClusterTrend = (members, days = 30) => {
  const now = Date.now();
  const halfWindowMs = (days / 2) * 24 * 60 * 60 * 1000;
  const fullWindowMs = days * 24 * 60 * 60 * 1000;

  let recentCount = 0; // within [now - halfWindow, now]
  let priorCount = 0;  // within [now - fullWindow, now - halfWindow]

  for (const m of members) {
    const timestamp = new Date(m.createdAt || m.updatedAt || now).getTime();
    const ageMs = now - timestamp;

    if (ageMs <= halfWindowMs) {
      recentCount++;
    } else if (ageMs <= fullWindowMs) {
      priorCount++;
    }
  }

  const totalInWindow = recentCount + priorCount;

  // Insufficient history for trend determination
  if (totalInWindow < 3) {
    return {
      timePeriod: `Last ${days} days`,
      trend: 'Baseline',
      recentCount,
      priorCount,
    };
  }

  if (recentCount > priorCount * 1.3) {
    return {
      timePeriod: `Last ${days} days`,
      trend: 'Increasing',
      recentCount,
      priorCount,
    };
  } else if (recentCount < priorCount * 0.7) {
    return {
      timePeriod: `Last ${days} days`,
      trend: 'Decreasing',
      recentCount,
      priorCount,
    };
  }

  return {
    timePeriod: `Last ${days} days`,
    trend: 'Stable',
    recentCount,
    priorCount,
  };
};

/**
 * Identify and analyze civic hotspots from complaints dataset
 * 
 * @param {Array<Object>} complaints 
 * @param {Object} [options]
 * @param {number} [options.radiusMeters=400] 
 * @param {number} [options.minComplaints=2] - Minimum complaints to qualify as hotspot
 * @param {number} [options.days=30]
 * @returns {Object} Hotspots report with geospatial clusters, category distributions, and trends
 */
export const analyzeCivicHotspots = (complaints = [], options = {}) => {
  const radiusMeters = options.radiusMeters || DEFAULT_HOTSPOT_RADIUS_METERS;
  const minComplaints = options.minComplaints || 2;
  const days = options.days || 30;

  const clusters = clusterComplaintsByProximity(complaints, radiusMeters);

  const hotspots = [];

  for (let i = 0; i < clusters.length; i++) {
    const members = clusters[i];
    if (members.length < minComplaints) continue;

    // Calculate centroid
    let sumLat = 0;
    let sumLon = 0;
    const categoryCounts = {};
    let totalSeverityScore = 0;
    let severityCount = 0;

    for (const m of members) {
      sumLat += m.location.latitude;
      sumLon += m.location.longitude;

      const cat = m.category || m.aiAnalysis?.category || 'General';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;

      const score = m.aiAnalysis?.severityScore ?? (m.severity === 'Critical' ? 90 : m.severity === 'High' ? 70 : 40);
      totalSeverityScore += score;
      severityCount++;
    }

    const centroid = [
      Number((sumLat / members.length).toFixed(6)),
      Number((sumLon / members.length).toFixed(6)),
    ];

    // Find predominant category
    let topCategory = 'Road Damage';
    let maxCategoryCount = -1;
    for (const [cat, count] of Object.entries(categoryCounts)) {
      if (count > maxCategoryCount) {
        maxCategoryCount = count;
        topCategory = cat;
      }
    }

    const avgSeverity = severityCount > 0 ? Math.round(totalSeverityScore / severityCount) : 50;
    const trendAnalysis = calculateClusterTrend(members, days);

    // Intensity tier
    let intensity = 'Moderate';
    if (members.length >= 5 || avgSeverity >= 75) intensity = 'High';
    else if (members.length <= 2) intensity = 'Low';

    hotspots.push({
      hotspotId: `HS-${i + 1}`,
      zone: deriveZoneName(members),
      category: topCategory,
      complaintCount: members.length,
      coordinates: centroid,
      radiusMeters,
      intensity,
      averageSeverity: avgSeverity,
      categoryBreakdown: categoryCounts,
      timePeriod: trendAnalysis.timePeriod,
      trend: trendAnalysis.trend,
      complaintIds: members.map((m) => m.complaintId || m._id),
      sampleAddresses: [...new Set(members.map((m) => m.location?.address).filter(Boolean))].slice(0, 3),
    });
  }

  // Sort by complaint count descending
  hotspots.sort((a, b) => b.complaintCount - a.complaintCount);

  return {
    success: true,
    data: {
      totalHotspots: hotspots.length,
      highIntensityCount: hotspots.filter((h) => h.intensity === 'High').length,
      timePeriod: `Last ${days} days`,
      hotspots,
    },
  };
};
