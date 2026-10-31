/**
 * CivicPulse - Department Mapping & Canonicalization Utilities
 */

import { DEMO_DEPARTMENTS } from '../data/officerDirectory.js';

/**
 * Normalizes any department string (including AI responses, categories, or legacy strings)
 * to one of the canonical DEMO_DEPARTMENTS.
 *
 * @param {string} dept
 * @returns {string} One of DEMO_DEPARTMENTS
 */
export const canonicalDepartment = (dept) => {
  if (!dept || typeof dept !== 'string') return 'Municipal Public Works';
  const d = dept.trim().toLowerCase();

  if (d.includes('sanitat') || d.includes('waste') || d.includes('garbage')) {
    return 'Sanitation Department';
  }
  if (d.includes('water')) {
    return 'Water Supply Board';
  }
  if (d.includes('drain') || d.includes('sewer')) {
    return 'Drainage Department';
  }
  if (d.includes('electr') || d.includes('light') || d.includes('power')) {
    return 'Electricity Department';
  }
  if (d.includes('environ') || d.includes('park') || d.includes('tree') || d.includes('garden')) {
    return 'Environmental Department';
  }
  if (d.includes('road') || d.includes('pavement') || d.includes('pothole') || d.includes('public works')) {
    return 'Municipal Public Works';
  }

  // Exact match with DEMO_DEPARTMENTS (case-insensitive)
  const matched = DEMO_DEPARTMENTS.find((canonical) => canonical.toLowerCase() === d);
  return matched || 'Municipal Public Works';
};

/**
 * Resolves the primary municipal department responsible for a given civic category.
 *
 * @param {string} category
 * @returns {string} One of DEMO_DEPARTMENTS
 */
export const getDepartmentForCategory = (category) => {
  if (!category || typeof category !== 'string') return 'Municipal Public Works';
  return canonicalDepartment(category);
};
