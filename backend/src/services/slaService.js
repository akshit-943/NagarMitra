/**
 * CivicPulse AI — Service Level Agreement (SLA) & Deadline Engine
 * 
 * Computes deterministic resolution deadlines, tracking remaining hours,
 * flagging overdue work, and measuring municipal compliance rates.
 */

export const DEFAULT_SLA_TARGETS_HOURS = {
  Critical: 24,       // 1 day
  High: 72,           // 3 days
  Medium: 168,        // 7 days
  Moderate: 168,      // 7 days
  Low: 336,           // 14 days
};

/**
 * Compute resolution deadline timestamp based on issue priority
 * @param {string} priorityLevel - 'Critical', 'High', 'Medium', 'Low'
 * @param {Date|string} [startDate=new Date()]
 * @param {number} [customHours=null]
 * @returns {Date}
 */
export const calculateResolutionDeadline = (
  priorityLevel = 'Medium',
  startDate = new Date(),
  customHours = null
) => {
  const start = startDate instanceof Date ? startDate : new Date(startDate);
  const hours = typeof customHours === 'number' && customHours > 0
    ? customHours
    : (DEFAULT_SLA_TARGETS_HOURS[priorityLevel] || DEFAULT_SLA_TARGETS_HOURS.Medium);

  return new Date(start.getTime() + hours * 60 * 60 * 1000);
};

/**
 * Evaluate SLA status, remaining time, and compliance metrics for a master issue
 * @param {Object} masterIssue 
 * @param {Date} [now=new Date()]
 * @returns {Object}
 */
export const evaluateSlaStatus = (masterIssue, now = new Date()) => {
  const deadline = masterIssue.resolutionDeadline ? new Date(masterIssue.resolutionDeadline) : null;
  const assignedAt = masterIssue.assignedAt ? new Date(masterIssue.assignedAt) : null;
  const resolvedAt = masterIssue.resolvedAt ? new Date(masterIssue.resolvedAt) : null;
  const isResolved = masterIssue.status === 'Resolved';

  if (!deadline) {
    return {
      hasDeadline: false,
      deadlineText: 'Unscheduled',
      remainingHours: null,
      isOverdue: false,
      isApproaching: false,
      statusLabel: 'No Target Set',
      badgeVariant: 'neutral',
    };
  }

  // If issue is resolved, assess whether it was closed on time
  if (isResolved && resolvedAt) {
    const wasOnTime = resolvedAt.getTime() <= deadline.getTime();
    const resolutionDurationHours = Math.round(
      Math.max(0, (resolvedAt.getTime() - (assignedAt?.getTime() || masterIssue.createdAt.getTime())) / (1000 * 60 * 60))
    );

    return {
      hasDeadline: true,
      deadline,
      deadlineText: deadline.toLocaleDateString(),
      resolvedAt,
      resolutionDurationHours,
      isOverdue: !wasOnTime,
      isApproaching: false,
      wasOnTime,
      statusLabel: wasOnTime ? 'Resolved Within SLA' : 'Resolved Overdue',
      badgeVariant: wasOnTime ? 'sage' : 'rose',
    };
  }

  // Active / Unresolved calculation
  const diffMs = deadline.getTime() - now.getTime();
  const remainingHours = Math.round(diffMs / (1000 * 60 * 60));
  const isOverdue = diffMs < 0;
  const isApproaching = !isOverdue && remainingHours <= 24;

  let statusLabel = 'Within SLA';
  let badgeVariant = 'lime';

  if (isOverdue) {
    statusLabel = `Overdue by ${Math.abs(remainingHours)}h`;
    badgeVariant = 'rose';
  } else if (isApproaching) {
    statusLabel = `Due in ${remainingHours}h`;
    badgeVariant = 'amber';
  } else {
    const days = Math.round(remainingHours / 24);
    statusLabel = `${days > 0 ? `${days}d` : `${remainingHours}h`} remaining`;
  }

  return {
    hasDeadline: true,
    deadline,
    deadlineText: deadline.toLocaleString(),
    remainingHours,
    isOverdue,
    isApproaching,
    statusLabel,
    badgeVariant,
  };
};

/**
 * Compute aggregate SLA compliance statistics from an array of master issues
 * @param {Array<Object>} masterIssues
 * @returns {Object}
 */
export const calculateAggregateSlaMetrics = (masterIssues = []) => {
  const resolved = masterIssues.filter((m) => m.status === 'Resolved' && m.resolutionDeadline);
  const activeWithDeadline = masterIssues.filter(
    (m) => m.status !== 'Resolved' && m.status !== 'Rejected' && m.resolutionDeadline
  );

  let withinSlaResolvedCount = 0;
  let overdueResolvedCount = 0;
  let totalResolutionHours = 0;

  resolved.forEach((issue) => {
    const resolvedTime = new Date(issue.resolvedAt || issue.updatedAt).getTime();
    const deadlineTime = new Date(issue.resolutionDeadline).getTime();
    const startTime = new Date(issue.assignedAt || issue.createdAt).getTime();

    if (resolvedTime <= deadlineTime) {
      withinSlaResolvedCount++;
    } else {
      overdueResolvedCount++;
    }

    totalResolutionHours += Math.max(0, (resolvedTime - startTime) / (1000 * 60 * 60));
  });

  const now = Date.now();
  let currentlyOverdueCount = 0;
  let approachingDeadlineCount = 0;

  activeWithDeadline.forEach((issue) => {
    const deadlineTime = new Date(issue.resolutionDeadline).getTime();
    const diffHours = (deadlineTime - now) / (1000 * 60 * 60);
    if (diffHours < 0) {
      currentlyOverdueCount++;
    } else if (diffHours <= 24) {
      approachingDeadlineCount++;
    }
  });

  const totalResolvedWithDeadline = withinSlaResolvedCount + overdueResolvedCount;
  const complianceRate = masterIssues.length === 0
    ? null
    : totalResolvedWithDeadline > 0
    ? Math.round((withinSlaResolvedCount / totalResolvedWithDeadline) * 100)
    : (currentlyOverdueCount > 0 ? 0 : 100);

  const averageResolutionHours = resolved.length > 0
    ? Math.round((totalResolutionHours / resolved.length) * 10) / 10
    : null;

  return {
    complianceRate,
    withinSlaResolvedCount,
    overdueResolvedCount,
    currentlyOverdueCount,
    approachingDeadlineCount,
    averageResolutionHours,
    totalTracked: masterIssues.length,
  };
};
