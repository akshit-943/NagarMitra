import crypto from 'crypto';

/**
 * Generate a safe, human-readable, unique Complaint ID
 * Format: CP-YYYYMMDD-XXXX
 * Does not rely on count-based approaches to prevent race conditions.
 * 
 * @returns {string} Unique complaint ID
 */
export const generateComplaintId = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateSegment = `${year}${month}${day}`;

  // 4-character cryptographic hex token (16^4 = 65,536 combinations per day per cluster)
  const randomToken = crypto.randomBytes(2).toString('hex').toUpperCase();

  return `CP-${dateSegment}-${randomToken}`;
};

/**
 * Generate a safe, human-readable, unique Master Issue ID
 * Format: MI-YYYYMMDD-XXXX
 * 
 * @returns {string} Unique master issue ID
 */
export const generateMasterIssueId = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateSegment = `${year}${month}${day}`;

  const randomToken = crypto.randomBytes(2).toString('hex').toUpperCase();

  return `MI-${dateSegment}-${randomToken}`;
};
