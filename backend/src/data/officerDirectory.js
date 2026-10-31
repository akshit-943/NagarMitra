/**
 * CivicPulse AI — Demonstration Officer Directory
 * 
 * DISCLAIMER:
 * These are simulated demonstration profiles created solely for testing
 * municipal dispatch, department routing, and SLA compliance.
 * They do not represent real municipal employees or government affiliations.
 */

export const DEMO_DEPARTMENTS = [
  'Municipal Public Works',
  'Water Supply Board',
  'Sanitation Department',
  'Drainage Department',
  'Electricity Department',
  'Environmental Department',
];

export const DEMO_OFFICERS = [
  {
    id: 'OFF-MPW-01',
    name: 'Vikram Rao',
    department: 'Municipal Public Works',
    role: 'Senior Civil Infrastructure Inspector',
    email: 'v.rao.demo@municipal.internal',
    isDemoAccount: true,
  },
  {
    id: 'OFF-MPW-02',
    name: 'Sunita Patel',
    department: 'Municipal Public Works',
    role: 'Road Surface & Pavement Specialist',
    email: 's.patel.demo@municipal.internal',
    isDemoAccount: true,
  },
  {
    id: 'OFF-WSB-01',
    name: 'Rajesh Nair',
    department: 'Water Supply Board',
    role: 'Hydraulic Distribution Engineer',
    email: 'r.nair.demo@water.internal',
    isDemoAccount: true,
  },
  {
    id: 'OFF-WSB-02',
    name: 'Farooq Ahmed',
    department: 'Water Supply Board',
    role: 'Pipeline Leakage Remediation Lead',
    email: 'f.ahmed.demo@water.internal',
    isDemoAccount: true,
  },
  {
    id: 'OFF-SAN-01',
    name: 'Anita Sharma',
    department: 'Sanitation Department',
    role: 'Municipal Waste Operations Director',
    email: 'a.sharma.demo@sanitation.internal',
    isDemoAccount: true,
  },
  {
    id: 'OFF-SAN-02',
    name: 'Karan Mehra',
    department: 'Sanitation Department',
    role: 'Solid Waste Management Supervisor',
    email: 'k.mehra.demo@sanitation.internal',
    isDemoAccount: true,
  },
  {
    id: 'OFF-DRN-01',
    name: 'Kavita Joshi',
    department: 'Drainage Department',
    role: 'Stormwater & Drainage Overseer',
    email: 'k.joshi.demo@drainage.internal',
    isDemoAccount: true,
  },
  {
    id: 'OFF-ELE-01',
    name: 'Arjun Das',
    department: 'Electricity Department',
    role: 'Electrical Grid & Lighting Field Crew Lead',
    email: 'a.das.demo@electricity.internal',
    isDemoAccount: true,
  },
  {
    id: 'OFF-ENV-01',
    name: 'Dr. Meera Sen',
    department: 'Environmental Department',
    role: 'Air & Water Quality Field Analyst',
    email: 'm.sen.demo@environment.internal',
    isDemoAccount: true,
  },
];

export const getOfficersByDepartment = (department) => {
  if (!department || department === 'All') return DEMO_OFFICERS;
  return DEMO_OFFICERS.filter((off) => off.department.toLowerCase() === department.toLowerCase());
};

export const findOfficerById = (officerId) => {
  if (!officerId) return null;
  return DEMO_OFFICERS.find((off) => off.id.toUpperCase() === officerId.toUpperCase()) || null;
};
