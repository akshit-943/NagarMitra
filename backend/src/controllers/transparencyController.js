import Complaint from '../models/Complaint.js';
import MasterIssue from '../models/MasterIssue.js';
import ActivityLog from '../models/ActivityLog.js';
import { isDbConnected } from '../config/db.js';
import { DEMO_DEPARTMENTS } from '../data/officerDirectory.js';
import { canonicalDepartment } from '../utils/departmentHelper.js';
import { evaluateSlaStatus, calculateAggregateSlaMetrics } from '../services/slaService.js';
import { generateCivicImpactPdf } from '../services/pdfReportService.js';

/**
 * Helper to parse date range from query parameters
 */
export const parseDateRange = (query) => {
  const { timeRange = '30d', startDate, endDate } = query;
  const now = new Date();
  let start = null;
  let end = now;
  let label = 'Last 30 Days';

  if (timeRange === '7d') {
    start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    label = 'Last 7 Days';
  } else if (timeRange === '30d') {
    start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    label = 'Last 30 Days';
  } else if (timeRange === '90d') {
    start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    label = 'Last 90 Days';
  } else if (timeRange === 'all') {
    start = null;
    label = 'All Historical Records';
  } else if (timeRange === 'custom' && (startDate || endDate)) {
    start = startDate ? new Date(startDate) : null;
    end = endDate ? new Date(endDate) : now;
    label = `${start ? start.toLocaleDateString() : 'Beginning'} to ${end.toLocaleDateString()}`;
  }

  return { start, end, label, timeRange };
};

/**
 * Helper to build Mongo date and attribute query
 */
const buildFilters = (query, dateRange) => {
  const { category, department, zone, search } = query;
  const masterFilter = {};
  const complaintFilter = {};

  if (dateRange.start) {
    masterFilter.createdAt = { $gte: dateRange.start, $lte: dateRange.end };
    complaintFilter.createdAt = { $gte: dateRange.start, $lte: dateRange.end };
  } else if (dateRange.end) {
    masterFilter.createdAt = { $lte: dateRange.end };
    complaintFilter.createdAt = { $lte: dateRange.end };
  }

  if (category && category !== 'All') {
    masterFilter.category = category;
    complaintFilter.category = category;
  }

  if (department && department !== 'All') {
    masterFilter.$or = [
      { assignedDepartment: department },
      { department: department },
    ];
    complaintFilter.department = department;
  }

  if (zone && zone !== 'All') {
    masterFilter['location.zone'] = zone;
  }

  if (search && search.trim()) {
    const regex = new RegExp(search.trim(), 'i');
    masterFilter.$or = [
      { masterIssueId: regex },
      { title: regex },
      { 'location.address': regex },
    ];
    complaintFilter.$or = [
      { complaintId: regex },
      { description: regex },
      { 'location.address': regex },
    ];
  }

  return { masterFilter, complaintFilter };
};

/**
 * @route   GET /api/transparency/overview
 * @desc    Get aggregated public transparency KPIs computed from actual MongoDB records
 * @access  Public
 */
export const getTransparencyOverview = async (req, res, next) => {
  try {
    if (!isDbConnected()) {
      return res.status(200).json({
        success: true,
        data: {
          totalComplaints: 0,
          totalMasterIssues: 0,
          resolvedIssues: 0,
          inProgressIssues: 0,
          awaitingActionIssues: 0,
          overdueIssues: 0,
          resolutionRate: 0,
          avgResolutionHours: 0,
          slaComplianceRate: 100,
        },
      });
    }

    const dateRange = parseDateRange(req.query);
    const { masterFilter, complaintFilter } = buildFilters(req.query, dateRange);

    const [
      totalComplaints,
      allMasterIssues,
    ] = await Promise.all([
      Complaint.countDocuments(complaintFilter),
      MasterIssue.find(masterFilter).lean(),
    ]);

    const totalMasterIssues = allMasterIssues.length;
    let resolvedCount = 0;
    let inProgressCount = 0;
    let awaitingActionCount = 0;
    let resolutionSubmittedCount = 0;
    let rejectedCount = 0;
    let overdueCount = 0;
    let totalResolutionDurationHours = 0;

    const now = Date.now();

    allMasterIssues.forEach((issue) => {
      const status = issue.status;
      if (status === 'Resolved') {
        resolvedCount++;
        const startTime = new Date(issue.assignedAt || issue.createdAt).getTime();
        const endTime = new Date(issue.resolvedAt || issue.updatedAt).getTime();
        totalResolutionDurationHours += Math.max(0, (endTime - startTime) / (1000 * 60 * 60));
      } else if (status === 'In Progress' || status === 'Assigned') {
        inProgressCount++;
      } else if (status === 'Pending' || status === 'Under Review') {
        awaitingActionCount++;
      } else if (status === 'Resolution Submitted') {
        resolutionSubmittedCount++;
      } else if (status === 'Rejected') {
        rejectedCount++;
      }

      // Check overdue SLA
      if (
        status !== 'Resolved' &&
        status !== 'Rejected' &&
        issue.resolutionDeadline &&
        new Date(issue.resolutionDeadline).getTime() < now
      ) {
        overdueCount++;
      }
    });

    const activeClosedTotal = resolvedCount + rejectedCount;
    const actionableTotal = totalMasterIssues - rejectedCount;
    const resolutionRate = actionableTotal > 0
      ? Math.round((resolvedCount / actionableTotal) * 100)
      : (resolvedCount > 0 ? 100 : 0);

    const avgResolutionHours = resolvedCount > 0
      ? Math.round((totalResolutionDurationHours / resolvedCount) * 10) / 10
      : null;

    // SLA Compliance rate from deterministic SLA helper
    const slaMetrics = calculateAggregateSlaMetrics(allMasterIssues);

    return res.status(200).json({
      success: true,
      data: {
        totalComplaints,
        totalMasterIssues,
        resolvedIssues: resolvedCount,
        inProgressIssues: inProgressCount,
        awaitingActionIssues: awaitingActionCount,
        resolutionSubmittedIssues: resolutionSubmittedCount,
        rejectedIssues: rejectedCount,
        overdueIssues: overdueCount,
        resolutionRate,
        avgResolutionHours,
        slaComplianceRate: slaMetrics.complianceRate,
        filterSummary: {
          timeRange: dateRange.timeRange,
          timeRangeLabel: dateRange.label,
          startDate: dateRange.start,
          endDate: dateRange.end,
          category: req.query.category || 'All',
          department: req.query.department || 'All',
          zone: req.query.zone || 'All',
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/transparency/trends
 * @desc    Time-based civic trends, category velocity, recurring problems, and hotspots
 * @access  Public
 */
export const getCivicTrends = async (req, res, next) => {
  try {
    if (!isDbConnected()) {
      return res.status(200).json({ success: true, data: { volumeOverTime: [], categoryDistribution: [] } });
    }

    const dateRange = parseDateRange(req.query);
    const { masterFilter, complaintFilter } = buildFilters(req.query, dateRange);

    const [complaints, masterIssues] = await Promise.all([
      Complaint.find(complaintFilter).sort({ createdAt: 1 }).lean(),
      MasterIssue.find(masterFilter).sort({ createdAt: 1 }).lean(),
    ]);

    // 1. Category Distribution
    const categoryCounts = {};
    complaints.forEach((c) => {
      const cat = c.category || 'Uncategorized';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    const totalComplaints = complaints.length || 1;
    const categoryDistribution = Object.entries(categoryCounts).map(([cat, count]) => ({
      category: cat,
      count,
      percentage: Math.round((count / totalComplaints) * 100),
    })).sort((a, b) => b.count - a.count);

    // 2. Volume Over Time (Dynamic day/month buckets)
    const timeBuckets = {};
    complaints.forEach((c) => {
      const d = new Date(c.createdAt);
      // Format as YYYY-MM-DD
      const dateKey = d.toISOString().slice(0, 10);
      if (!timeBuckets[dateKey]) {
        timeBuckets[dateKey] = { date: dateKey, received: 0, resolved: 0, pending: 0 };
      }
      timeBuckets[dateKey].received += 1;
      if (c.status === 'Resolved') {
        timeBuckets[dateKey].resolved += 1;
      } else {
        timeBuckets[dateKey].pending += 1;
      }
    });

    const volumeOverTime = Object.values(timeBuckets).sort((a, b) => a.date.localeCompare(b.date));

    // 3. Category Trends: Comparative velocity vs. previous period
    let increasingCategories = [];
    let decreasingCategories = [];
    let stableCategories = [];

    // Calculate comparative trends if dateRange has a defined window
    if (dateRange.start) {
      const windowDurationMs = dateRange.end.getTime() - dateRange.start.getTime();
      const prevWindowStart = new Date(dateRange.start.getTime() - windowDurationMs);
      const prevWindowEnd = dateRange.start;

      const prevPeriodComplaints = await Complaint.find({
        createdAt: { $gte: prevWindowStart, $lt: prevWindowEnd },
      }).lean();

      const prevCounts = {};
      prevPeriodComplaints.forEach((c) => {
        prevCounts[c.category] = (prevCounts[c.category] || 0) + 1;
      });

      categoryDistribution.forEach((curr) => {
        const prev = prevCounts[curr.category] || 0;
        const diff = curr.count - prev;
        const pctChange = prev > 0 ? Math.round((diff / prev) * 100) : (curr.count > 0 ? 100 : 0);

        const trendObj = {
          category: curr.category,
          currentCount: curr.count,
          previousCount: prev,
          percentageChange: pctChange,
        };

        if (pctChange >= 15) {
          increasingCategories.push(trendObj);
        } else if (pctChange <= -15) {
          decreasingCategories.push(trendObj);
        } else {
          stableCategories.push(trendObj);
        }
      });
    }

    // 4. Recurring Problems (Master issues with high report count or high citizen endorsements)
    const recurringProblems = masterIssues
      .filter((m) => m.supportingReportCount > 1 || m.citizenSupportCount > 0)
      .sort((a, b) => (b.supportingReportCount + b.citizenSupportCount) - (a.supportingReportCount + a.citizenSupportCount))
      .slice(0, 5)
      .map((m) => ({
        masterIssueId: m.masterIssueId,
        title: m.title,
        category: m.category,
        location: m.location?.address,
        zone: m.location?.zone || 'Central Area',
        supportingReportCount: m.supportingReportCount || 1,
        repeatCount: m.supportingReportCount || 1,
        citizenSupportCount: m.citizenSupportCount || 0,
        lastReported: m.lastActivityAt || m.updatedAt || m.createdAt || new Date(),
        priorityLevel: m.priority?.level || 'Medium',
        priorityScore: m.priority?.score || 50,
        status: m.status,
      }));

    // 5. Persistent Areas with Unresolved Issues and SLA Tracking
    const zoneMap = {};
    const nowMs = Date.now();

    masterIssues.forEach((m) => {
      const z = m.location?.zone || 'Jamshedpur Municipal Ward';
      if (!zoneMap[z]) {
        zoneMap[z] = {
          zone: z,
          totalIssues: 0,
          unresolvedIssues: 0,
          unresolvedCount: 0,
          resolvedIssues: 0,
          overdueIssues: 0,
        };
      }

      zoneMap[z].totalIssues += 1;

      const isUnresolved = m.status !== 'Resolved' && m.status !== 'Rejected';
      if (isUnresolved) {
        zoneMap[z].unresolvedIssues += 1;
        zoneMap[z].unresolvedCount += 1;

        if (m.resolutionDeadline && new Date(m.resolutionDeadline).getTime() < nowMs) {
          zoneMap[z].overdueIssues += 1;
        }
      } else {
        zoneMap[z].resolvedIssues += 1;
      }
    });

    const persistentAreas = Object.values(zoneMap)
      .sort((a, b) => b.unresolvedIssues - a.unresolvedIssues || b.totalIssues - a.totalIssues)
      .slice(0, 6);

    const hasSufficientData = complaints.length >= 3;

    const allCategoryTrends = [
      ...increasingCategories.map(c => ({ ...c, trend: 'Increasing', sampleConfidence: c.currentCount >= 10 ? 'High' : c.currentCount >= 5 ? 'Moderate' : 'Insufficient' })),
      ...decreasingCategories.map(c => ({ ...c, trend: 'Decreasing', sampleConfidence: c.currentCount >= 10 ? 'High' : c.currentCount >= 5 ? 'Moderate' : 'Insufficient' })),
      ...stableCategories.map(c => ({ ...c, trend: 'Stable', sampleConfidence: c.currentCount >= 10 ? 'High' : c.currentCount >= 5 ? 'Moderate' : 'Insufficient' })),
    ];

    return res.status(200).json({
      success: true,
      data: {
        hasSufficientData,
        sampleSize: complaints.length,
        volumeOverTime,
        categoryDistribution,
        categoryTrends: allCategoryTrends,
        categoryTrendsGrouped: {
          increasing: increasingCategories,
          decreasing: decreasingCategories,
          stable: stableCategories,
          isStatisticallyMeaningful: complaints.length >= 5,
        },
        recurringProblems,
        persistentAreas,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/transparency/departments
 * @desc    Public-facing department performance analytics and SLA compliance
 * @access  Public
 */
export const getDepartmentPerformance = async (req, res, next) => {
  try {
    if (!isDbConnected()) {
      return res.status(200).json({ success: true, data: [] });
    }

    const dateRange = parseDateRange(req.query);
    const { masterFilter } = buildFilters(req.query, dateRange);

    const masterIssues = await MasterIssue.find(masterFilter).lean();

    const deptMap = {};
    DEMO_DEPARTMENTS.forEach((dept) => {
      deptMap[dept] = {
        department: dept,
        totalAssigned: 0,
        resolved: 0,
        inProgress: 0,
        awaiting: 0,
        overdue: 0,
        totalResolutionDurationHours: 0,
        resolvedWithDeadline: 0,
        resolvedOnTime: 0,
      };
    });

    const now = Date.now();

    masterIssues.forEach((issue) => {
      const rawDept = (issue.assignedDepartment && issue.assignedDepartment !== 'Municipal Public Works')
        ? issue.assignedDepartment
        : (issue.department && issue.department !== 'Municipal Public Works' ? issue.department : null);
      const dept = canonicalDepartment(rawDept || issue.category || 'Municipal Public Works');
      if (!deptMap[dept]) {
        deptMap[dept] = {
          department: dept,
          totalAssigned: 0,
          resolved: 0,
          inProgress: 0,
          awaiting: 0,
          overdue: 0,
          totalResolutionDurationHours: 0,
          resolvedWithDeadline: 0,
          resolvedOnTime: 0,
        };
      }

      const d = deptMap[dept];
      d.totalAssigned += 1;

      if (issue.status === 'Resolved') {
        d.resolved += 1;
        const start = new Date(issue.assignedAt || issue.createdAt).getTime();
        const end = new Date(issue.resolvedAt || issue.updatedAt).getTime();
        d.totalResolutionDurationHours += Math.max(0, (end - start) / (1000 * 60 * 60));

        if (issue.resolutionDeadline) {
          d.resolvedWithDeadline += 1;
          if (end <= new Date(issue.resolutionDeadline).getTime()) {
            d.resolvedOnTime += 1;
          }
        }
      } else if (issue.status === 'In Progress' || issue.status === 'Assigned' || issue.status === 'Resolution Submitted') {
        d.inProgress += 1;
      } else if (issue.status === 'Pending' || issue.status === 'Under Review') {
        d.awaiting += 1;
      }

      // Check overdue SLA for active issues
      if (
        issue.status !== 'Resolved' &&
        issue.status !== 'Rejected' &&
        issue.resolutionDeadline &&
        new Date(issue.resolutionDeadline).getTime() < now
      ) {
        d.overdue += 1;
      }
    });

    const performanceRecords = Object.values(deptMap).map((d) => {
      const resolutionRate = d.totalAssigned > 0
        ? Math.round((d.resolved / d.totalAssigned) * 100)
        : 0;

      const avgResolutionHours = d.resolved > 0
        ? Math.round((d.totalResolutionDurationHours / d.resolved) * 10) / 10
        : null;

      const slaComplianceRate = d.totalAssigned === 0
        ? null
        : d.resolvedWithDeadline > 0
        ? Math.round((d.resolvedOnTime / d.resolvedWithDeadline) * 100)
        : (d.overdue > 0 ? 0 : 100);

      // Sample confidence rating to avoid unfair ranking on small sample sizes
      let sampleConfidence = 'No Data';
      if (d.totalAssigned >= 10) {
        sampleConfidence = 'High';
      } else if (d.totalAssigned >= 3) {
        sampleConfidence = 'Moderate';
      } else if (d.totalAssigned > 0) {
        sampleConfidence = 'Insufficient';
      }

      return {
        department: d.department,
        totalAssigned: d.totalAssigned,
        resolved: d.resolved,
        inProgress: d.inProgress,
        awaiting: d.awaiting,
        overdue: d.overdue,
        resolutionRate,
        avgResolutionHours,
        slaComplianceRate,
        sampleConfidence,
        isReliableSample: d.totalAssigned >= 3,
      };
    }).sort((a, b) => b.totalAssigned - a.totalAssigned);

    return res.status(200).json({
      success: true,
      data: performanceRecords,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/transparency/recommendations
 * @desc    Deterministic civic impact and resource allocation recommendations
 * @access  Public
 */
export const getCivicImpactRecommendations = async (req, res, next) => {
  try {
    if (!isDbConnected()) {
      return res.status(200).json({ success: true, data: [] });
    }

    // Evaluate active unresolved master issues
    const activeIssues = await MasterIssue.find({
      status: { $nin: ['Resolved', 'Rejected'] },
    }).lean();

    if (activeIssues.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: 'No active unresolved issues requiring emergency resource reallocation.',
      });
    }

    // Cluster by area zone and category
    const clusterMap = {};
    const now = Date.now();

    activeIssues.forEach((issue) => {
      const zone = issue.location?.zone || 'Central Urban Corridor';
      const cat = issue.category || 'General Infrastructure';
      const key = `${zone}__${cat}`;

      if (!clusterMap[key]) {
        clusterMap[key] = {
          zone,
          category: cat,
          issues: [],
          criticalCount: 0,
          highCount: 0,
          overdueCount: 0,
          totalSupportingReports: 0,
          totalEndorsements: 0,
          sumPriorityScore: 0,
        };
      }

      const cl = clusterMap[key];
      cl.issues.push(issue);
      const score = issue.priority?.score || 50;
      const level = issue.priority?.level || 'Medium';

      cl.sumPriorityScore += score;
      if (level === 'Critical') cl.criticalCount += 1;
      if (level === 'High') cl.highCount += 1;
      cl.totalSupportingReports += (issue.supportingReportCount || 1);
      cl.totalEndorsements += (issue.citizenSupportCount || 0);

      if (issue.resolutionDeadline && new Date(issue.resolutionDeadline).getTime() < now) {
        cl.overdueCount += 1;
      }
    });

    const recommendations = [];
    let recCounter = 1;

    Object.values(clusterMap).forEach((cl) => {
      const issueCount = cl.issues.length;
      const avgPriority = Math.round(cl.sumPriorityScore / issueCount);
      const isUrgent = cl.criticalCount > 0 || cl.overdueCount > 0 || avgPriority >= 75;
      const isHighPriority = cl.highCount > 0 || issueCount >= 2 || avgPriority >= 60;

      if (!isUrgent && !isHighPriority && issueCount < 2) {
        return; // Filter out routine non-clustered single issues
      }

      let suggestedAction = '';
      let reason = '';

      if (cl.category.includes('Water') || cl.category.includes('Drainage')) {
        suggestedAction = `Prioritize specialized hydraulic inspection and dispatch vacuum drainage trucks to ${cl.zone}.`;
        reason = `${cl.zone} has ${issueCount} active ${cl.category} issue(s) with ${cl.totalSupportingReports} resident report(s)${cl.overdueCount > 0 ? ` and ${cl.overdueCount} overdue SLA breach(es)` : ''}.`;
      } else if (cl.category.includes('Roadways') || cl.category.includes('Pavement')) {
        suggestedAction = `Deploy asphalt patching mobile crew and evaluate road surface structural integrity along ${cl.zone}.`;
        reason = `${issueCount} persistent road hazard(s) reported with average priority score of ${avgPriority}/100.`;
      } else if (cl.category.includes('Electrical') || cl.category.includes('Lighting')) {
        suggestedAction = `Dispatch evening illumination patrol and line technicians to verify grid transformers in ${cl.zone}.`;
        reason = `Recurring streetlight and power outage reports impacting pedestrian nighttime safety.`;
      } else if (cl.category.includes('Sanitation')) {
        suggestedAction = `Increase municipal waste collection vehicle frequency and clear public disposal bins in ${cl.zone}.`;
        reason = `Accumulation of waste reports affecting public health standards in ${cl.zone}.`;
      } else {
        suggestedAction = `Schedule municipal on-site supervisor review and allocate additional field personnel to ${cl.zone}.`;
        reason = `Concentration of ${issueCount} active issues with community support from ${cl.totalEndorsements} resident(s).`;
      }

      recommendations.push({
        id: `REC-${new Date().getFullYear()}-${String(recCounter++).padStart(3, '0')}`,
        area: cl.zone,
        category: cl.category,
        urgency: isUrgent ? 'Urgent' : isHighPriority ? 'High' : 'Moderate',
        statistics: `${issueCount} active master issue(s) • ${cl.totalSupportingReports} resident reports • ${cl.overdueCount} overdue`,
        reason,
        analyticalReason: reason,
        suggestedAction,
        recommendation: suggestedAction,
        supportingData: {
          complaintCount: cl.totalSupportingReports,
          unresolvedCount: issueCount,
          overdueCount: cl.overdueCount,
          citizenEndorsements: cl.totalEndorsements,
          averagePriorityScore: avgPriority,
        },
        isSystemGenerated: true,
        disclaimer: 'System-generated resource allocation proposal based on database records. Not an official administrative order.',
        avgPriority,
      });
    });

    // Sort by urgency: Urgent first, then High, then Moderate
    const urgencyOrder = { Urgent: 0, High: 1, Moderate: 2 };
    recommendations.sort((a, b) => (urgencyOrder[a.urgency] ?? 3) - (urgencyOrder[b.urgency] ?? 3));

    return res.status(200).json({
      success: true,
      data: recommendations,
      totalRecommendations: recommendations.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/transparency/issues
 * @desc    Public issue browsing with strict privacy filtering
 * @access  Public
 */
export const getPublicMasterIssues = async (req, res, next) => {
  try {
    if (!isDbConnected()) {
      return res.status(200).json({ success: true, data: [], pagination: { total: 0 } });
    }

    const {
      category,
      status,
      zone,
      search,
      page = 1,
      limit = 10,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (category && category !== 'All') filter.category = category;
    if (status && status !== 'All') filter.status = status;
    if (zone && zone !== 'All') filter['location.zone'] = zone;

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { masterIssueId: regex },
        { title: regex },
        { 'location.address': regex },
      ];
    }

    const [total, issues] = await Promise.all([
      MasterIssue.countDocuments(filter),
      MasterIssue.find(filter)
        .sort({ 'priority.score': -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    // Fetch primary complaint intake images for Before/After parity
    const primaryIds = issues.map((i) => i.primaryComplaintId).filter(Boolean);
    const primaryComplaints = await Complaint.find({ complaintId: { $in: primaryIds } })
      .select('complaintId imageUrl')
      .lean();

    const primaryImgMap = {};
    primaryComplaints.forEach((p) => {
      primaryImgMap[p.complaintId] = p.imageUrl;
    });

    // Sanitize issues strictly for public consumption
    const publicIssues = issues.map((issue) => {
      const sla = evaluateSlaStatus(issue);
      const intakeImageUrl = primaryImgMap[issue.primaryComplaintId] || null;

      return {
        _id: issue._id,
        masterIssueId: issue.masterIssueId,
        title: issue.title,
        category: issue.category,
        location: {
          address: issue.location?.address,
          zone: issue.location?.zone || 'Municipal Zone',
        },
        priority: {
          level: issue.priority?.level || 'Medium',
          score: issue.priority?.score || 50,
        },
        supportingReportCount: issue.supportingReportCount || 1,
        citizenSupportCount: issue.citizenSupportCount || 0,
        assignedDepartment: canonicalDepartment(issue.assignedDepartment || issue.department || issue.category || 'Municipal Public Works'),
        status: issue.status,
        createdAt: issue.createdAt,
        resolutionDeadline: issue.resolutionDeadline,
        resolvedAt: issue.resolvedAt,
        resolutionDescription: issue.resolutionDescription || null,
        resolutionEvidence: issue.resolutionEvidence || [],
        intakeImageUrl,
        verificationStatus: {
          status: issue.verificationStatus?.status || 'Pending',
          confirmedCount: issue.verificationStatus?.confirmedCount || 0,
          disputedCount: issue.verificationStatus?.disputedCount || 0,
        },
        sla,
        // STRICT PRIVACY: internalNotes, supportedBy hashes, and officer private contacts are excluded
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        issues: publicIssues,
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/transparency/issues/:id/timeline
 * @desc    Public audit timeline for an issue (strictly omitting confidential internal notes)
 * @access  Public
 */
export const getPublicIssueTimeline = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isDbConnected()) {
      return res.status(200).json({ success: true, data: { timeline: [] } });
    }

    const trimmedId = id ? id.trim() : '';
    const query = trimmedId.match(/^[0-9a-fA-F]{24}$/)
      ? { $or: [{ masterIssueId: trimmedId.toUpperCase() }, { _id: trimmedId }] }
      : { masterIssueId: trimmedId.toUpperCase() };

    const masterIssue = await MasterIssue.findOne(query)
      .select('masterIssueId category assignedDepartment status createdAt')
      .lean();

    if (!masterIssue) {
      return res.status(404).json({ success: false, message: 'Issue not found' });
    }

    // Retrieve only public timeline events (isInternal !== true)
    const activities = await ActivityLog.find({
      masterIssueId: masterIssue.masterIssueId,
      isInternal: { $ne: true },
    })
      .sort({ createdAt: -1 })
      .lean();

    const timeline = activities.map((a) => ({
      stage: a.action || a.title || 'Status Updated',
      timestamp: a.createdAt,
      note: a.details || a.description || null,
      actor: a.actorRole || 'System',
    }));

    if (timeline.length === 0) {
      timeline.push({
        stage: 'Reported & Triaged',
        timestamp: masterIssue.createdAt,
        note: 'Issue consolidated into Municipal Master Issue registry',
        actor: 'CivicPulse Engine',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        masterIssueId: masterIssue.masterIssueId,
        category: masterIssue.category,
        assignedDepartment: masterIssue.assignedDepartment,
        status: masterIssue.status,
        timeline,
      },
      timeline,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/transparency/reports/impact-pdf
 * @desc    Downloadable executive PDF impact and public transparency report
 * @access  Public / Authority
 */
export const downloadCivicImpactReportPdf = async (req, res, next) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, message: 'Database connection required for report generation.' });
    }

    const dateRange = parseDateRange(req.query);
    const { masterFilter, complaintFilter } = buildFilters(req.query, dateRange);

    const [
      totalComplaints,
      allMasterIssues,
      complaints,
    ] = await Promise.all([
      Complaint.countDocuments(complaintFilter),
      MasterIssue.find(masterFilter).lean(),
      Complaint.find(complaintFilter).lean(),
    ]);

    const totalMasterIssues = allMasterIssues.length;
    let resolvedCount = 0;
    let inProgressCount = 0;
    let awaitingActionCount = 0;
    let overdueCount = 0;
    let totalResolutionDurationHours = 0;
    const now = Date.now();

    allMasterIssues.forEach((issue) => {
      if (issue.status === 'Resolved') {
        resolvedCount++;
        const start = new Date(issue.assignedAt || issue.createdAt).getTime();
        const end = new Date(issue.resolvedAt || issue.updatedAt).getTime();
        totalResolutionDurationHours += Math.max(0, (end - start) / (1000 * 60 * 60));
      } else if (issue.status === 'In Progress' || issue.status === 'Assigned') {
        inProgressCount++;
      } else if (issue.status === 'Pending' || issue.status === 'Under Review') {
        awaitingActionCount++;
      }

      if (
        issue.status !== 'Resolved' &&
        issue.status !== 'Rejected' &&
        issue.resolutionDeadline &&
        new Date(issue.resolutionDeadline).getTime() < now
      ) {
        overdueCount++;
      }
    });

    const resolutionRate = totalMasterIssues > 0
      ? Math.round((resolvedCount / totalMasterIssues) * 100)
      : 0;

    const avgResolutionHours = resolvedCount > 0
      ? Math.round((totalResolutionDurationHours / resolvedCount) * 10) / 10
      : 0;

    const slaMetrics = calculateAggregateSlaMetrics(allMasterIssues);

    // Category distribution
    const categoryCounts = {};
    complaints.forEach((c) => {
      categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1;
    });

    const categoryDistribution = Object.entries(categoryCounts).map(([cat, count]) => ({
      category: cat,
      count,
      percentage: Math.round((count / (complaints.length || 1)) * 100),
    })).sort((a, b) => b.count - a.count);

    // Department Performance
    const deptMap = {};
    allMasterIssues.forEach((issue) => {
      const rawDept = (issue.assignedDepartment && issue.assignedDepartment !== 'Municipal Public Works')
        ? issue.assignedDepartment
        : (issue.department && issue.department !== 'Municipal Public Works' ? issue.department : null);
      const dept = canonicalDepartment(rawDept || issue.category || 'Municipal Public Works');
      if (!deptMap[dept]) {
        deptMap[dept] = { department: dept, total: 0, resolved: 0, overdue: 0, onTime: 0, withDeadline: 0 };
      }
      deptMap[dept].total += 1;
      if (issue.status === 'Resolved') {
        deptMap[dept].resolved += 1;
        if (issue.resolutionDeadline) {
          deptMap[dept].withDeadline += 1;
          const end = new Date(issue.resolvedAt || issue.updatedAt).getTime();
          if (end <= new Date(issue.resolutionDeadline).getTime()) {
            deptMap[dept].onTime += 1;
          }
        }
      }
      if (
        issue.status !== 'Resolved' &&
        issue.status !== 'Rejected' &&
        issue.resolutionDeadline &&
        new Date(issue.resolutionDeadline).getTime() < now
      ) {
        deptMap[dept].overdue += 1;
      }
    });

    const departmentPerformance = Object.values(deptMap).map((d) => ({
      department: d.department,
      totalAssigned: d.total,
      resolved: d.resolved,
      overdue: d.overdue,
      resolutionRate: d.total > 0 ? Math.round((d.resolved / d.total) * 100) : 0,
      slaComplianceRate: d.withDeadline > 0 ? Math.round((d.onTime / d.withDeadline) * 100) : 100,
    }));

    // Recommendations
    const recommendations = [];
    const activeUnresolved = allMasterIssues.filter((m) => m.status !== 'Resolved' && m.status !== 'Rejected');
    if (activeUnresolved.length > 0) {
      recommendations.push({
        area: activeUnresolved[0].location?.zone || 'Municipal Central Ward',
        category: activeUnresolved[0].category,
        urgency: activeUnresolved[0].priority?.level || 'High',
        reason: `${activeUnresolved.length} active unresolved grievance(s) recorded in this reporting period.`,
        suggestedAction: `Schedule on-site supervisory review and coordinate field repairs with ${activeUnresolved[0].assignedDepartment || 'responsible crews'}.`,
      });
    }

    // Set Response Headers for PDF: stream inline by default so direct URL visits or browser refreshes do not force downloads
    const filename = `CivicPulse_Impact_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
    const isAttachment = req.query.download === 'true' || req.query.download === '1';
    const dispositionType = isAttachment ? 'attachment' : 'inline';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${dispositionType}; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    // Stream PDF directly to client
    generateCivicImpactPdf(
      {
        filterSummary: {
          timeRangeLabel: dateRange.label,
        },
        overview: {
          totalComplaints,
          totalMasterIssues,
          resolvedIssues: resolvedCount,
          inProgressIssues: inProgressCount,
          awaitingIssues: awaitingActionCount,
          overdueIssues: overdueCount,
          resolutionRate,
          avgResolutionHours,
          slaComplianceRate: slaMetrics.complianceRate,
        },
        categoryDistribution,
        departmentPerformance,
        recommendations,
        generatedAt: new Date().toLocaleString(),
      },
      res
    );
  } catch (error) {
    next(error);
  }
};
