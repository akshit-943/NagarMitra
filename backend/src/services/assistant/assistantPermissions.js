import jwt from 'jsonwebtoken';

const CITIZEN_JWT_SECRET = process.env.CITIZEN_JWT_SECRET || process.env.JWT_SECRET || 'civicpulse_citizen_jwt_secret_2026';
const AUTHORITY_JWT_SECRET = process.env.JWT_SECRET || 'civicpulse_authority_jwt_secret_2026';

/**
 * Resolves the caller's session context (Guest, Citizen, or Authority)
 * strictly without throwing errors so guest users can interact smoothly.
 * 
 * @param {import('express').Request} req 
 * @returns {{ roleContext: 'guest'|'citizen'|'authority', user: Object|null }}
 */
export const resolveCallerContext = (req) => {
  const authHeader = req.headers?.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      roleContext: 'guest',
      user: null,
    };
  }

  const token = authHeader.split(' ')[1];

  // 1. Attempt Citizen token decode
  try {
    const decodedCitizen = jwt.verify(token, CITIZEN_JWT_SECRET);
    if (decodedCitizen.role === 'Citizen' || decodedCitizen.citizenId) {
      return {
        roleContext: 'citizen',
        user: {
          id: decodedCitizen.citizenId || decodedCitizen.userId || decodedCitizen.id,
          name: decodedCitizen.fullName || decodedCitizen.name || 'Citizen',
          email: decodedCitizen.email || null,
          role: 'Citizen',
        },
      };
    }
  } catch {
    // Continue to authority check
  }

  // 2. Attempt Authority token decode
  try {
    const decodedAuthority = jwt.verify(token, AUTHORITY_JWT_SECRET);
    if (decodedAuthority.authorityId || (decodedAuthority.role && decodedAuthority.role !== 'Citizen')) {
      return {
        roleContext: 'authority',
        user: {
          id: decodedAuthority.authorityId || decodedAuthority.id,
          name: decodedAuthority.name || 'Municipal Officer',
          email: decodedAuthority.email || null,
          department: decodedAuthority.department || null,
          role: decodedAuthority.role || 'Authority',
        },
      };
    }
  } catch {
    // Neither valid - treat as guest
  }

  return {
    roleContext: 'guest',
    user: null,
  };
};

/**
 * Tool permission matrix defining authorized roles for each assistant tool
 */
const TOOL_PERMISSIONS = {
  getComplaintStatus: ['guest', 'citizen', 'authority'],
  getCityTransparencyOverview: ['guest', 'citizen', 'authority'],
  getDepartmentPerformance: ['guest', 'citizen', 'authority'],
  draftCivicComplaint: ['guest', 'citizen', 'authority'],
  searchMunicipalFaq: ['guest', 'citizen', 'authority'],
  getMyComplaints: ['citizen'],
  getAuthorityQueueSummary: ['authority'],
  getPendingDuplicateClusters: ['authority'],
};

/**
 * Verifies if the roleContext is authorized to call a given tool
 * @param {string} toolName 
 * @param {'guest'|'citizen'|'authority'} roleContext 
 * @returns {boolean}
 */
export const isToolAuthorized = (toolName, roleContext) => {
  const allowed = TOOL_PERMISSIONS[toolName];
  if (!allowed) return false;
  return allowed.includes(roleContext);
};
