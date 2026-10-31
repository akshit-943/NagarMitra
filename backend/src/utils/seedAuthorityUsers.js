import bcrypt from 'bcryptjs';
import AuthorityUser from '../models/AuthorityUser.js';

export const INITIAL_AUTHORITY_ACCOUNTS = [
  {
    authorityId: 'AUTH-ADMIN-01',
    name: 'Municipal Administrator',
    email: 'admin@municipal.internal',
    role: 'Municipal Administrator',
    department: 'All Departments',
    defaultPassword: process.env.AUTHORITY_DEFAULT_PASSWORD || 'CivicPulse@2026',
  },
  {
    authorityId: 'OFF-MPW-01',
    name: 'Vikram Rao',
    email: 'v.rao.demo@municipal.internal',
    role: 'Department Officer',
    department: 'Municipal Public Works',
    defaultPassword: process.env.AUTHORITY_DEFAULT_PASSWORD || 'CivicPulse@2026',
  },
  {
    authorityId: 'OFF-WSB-01',
    name: 'Rajesh Nair',
    email: 'r.nair.demo@water.internal',
    role: 'Department Officer',
    department: 'Water Supply Board',
    defaultPassword: process.env.AUTHORITY_DEFAULT_PASSWORD || 'CivicPulse@2026',
  },
  {
    authorityId: 'OFF-SAN-01',
    name: 'Anita Sharma',
    email: 'a.sharma.demo@sanitation.internal',
    role: 'Supervisor',
    department: 'Sanitation Department',
    defaultPassword: process.env.AUTHORITY_DEFAULT_PASSWORD || 'CivicPulse@2026',
  },
  {
    authorityId: 'OFF-ELE-01',
    name: 'Arjun Das',
    email: 'a.das.demo@electricity.internal',
    role: 'Department Officer',
    department: 'Electricity Department',
    defaultPassword: process.env.AUTHORITY_DEFAULT_PASSWORD || 'CivicPulse@2026',
  },
];

export async function seedAuthorityUsers() {
  try {
    const existingCount = await AuthorityUser.countDocuments();
    if (existingCount > 0) {
      return { seeded: false, count: existingCount, message: 'Authority accounts already exist.' };
    }

    const salt = await bcrypt.genSalt(10);
    const createdUsers = [];

    for (const acc of INITIAL_AUTHORITY_ACCOUNTS) {
      const passwordHash = await bcrypt.hash(acc.defaultPassword, salt);
      const user = await AuthorityUser.create({
        authorityId: acc.authorityId,
        name: acc.name,
        email: acc.email,
        role: acc.role,
        department: acc.department,
        passwordHash,
        isActive: true,
      });
      createdUsers.push(user.authorityId);
    }

    console.log(`[AUTH SEED] Successfully provisioned ${createdUsers.length} initial authority accounts.`);
    return { seeded: true, count: createdUsers.length, users: createdUsers };
  } catch (error) {
    console.error('[AUTH SEED] Error provisioning authority users:', error.message);
    return { seeded: false, error: error.message };
  }
}
