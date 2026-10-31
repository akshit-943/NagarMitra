import { VALID_STATUSES } from '../models/Complaint.js';

export const ALLOWED_TRANSITIONS = {
  Pending: ['Under Review', 'Assigned', 'In Progress', 'Rejected'],
  'Under Review': ['Assigned', 'In Progress', 'Pending', 'Rejected'],
  Assigned: ['In Progress', 'Under Review', 'Rejected'],
  'In Progress': ['Resolution Submitted', 'Assigned', 'Resolved', 'Rejected'],
  'Resolution Submitted': ['Resolved', 'In Progress', 'Rejected'],
  Resolved: ['In Progress', 'Under Review'], // Re-opened for inspection / disputed
  Rejected: ['Under Review', 'Pending'],     // Appealed / reconsidered
};

/**
 * Check if a status transition is permitted
 * @param {string} fromStatus 
 * @param {string} toStatus 
 * @returns {{ allowed: boolean, reason?: string }}
 */
export const validateStatusTransition = (fromStatus, toStatus) => {
  if (!VALID_STATUSES.includes(toStatus)) {
    return {
      allowed: false,
      reason: `Invalid target status '${toStatus}'. Allowed values are: ${VALID_STATUSES.join(', ')}`,
    };
  }

  if (fromStatus === toStatus) {
    return {
      allowed: false,
      reason: `Complaint/Issue is already in '${toStatus}' status.`,
    };
  }

  const allowedNext = ALLOWED_TRANSITIONS[fromStatus];
  if (!allowedNext || !allowedNext.includes(toStatus)) {
    return {
      allowed: false,
      reason: `Cannot transition status from '${fromStatus}' to '${toStatus}'. Allowed transitions from '${fromStatus}' are: ${
        allowedNext ? allowedNext.join(', ') : 'None'
      }.`,
    };
  }

  return { allowed: true };
};
