/**
 * Safe Migration Utility for Unlinked Citizen Complaints
 * 
 * Rules:
 * 1. Only targets complaints with citizenUserId == null.
 * 2. Matches complaint verifiedPhone with citizen user registered phone.
 * 3. Verifies that the complaint createdAt >= citizenUser createdAt (was submitted during or after user registration).
 * 4. Supports --dry-run (default) to preview proposed changes without modifying database records.
 * 5. Run with --execute to commit the migration.
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Complaint from '../models/Complaint.js';
import CitizenUser from '../models/CitizenUser.js';

dotenv.config();

async function runMigration() {
  const isExecute = process.argv.includes('--execute');
  console.log(`\n🔍 Running Safe Complaint Migration Check (${isExecute ? 'EXECUTE MODE' : 'DRY RUN MODE'})...\n`);

  await mongoose.connect(process.env.MONGODB_URI);

  const registeredUsers = await CitizenUser.find({});
  const unlinkedComplaints = await Complaint.find({ citizenUserId: null });

  console.log(`Found ${registeredUsers.length} registered citizens.`);
  console.log(`Found ${unlinkedComplaints.length} unlinked complaints (citizenUserId: null).\n`);

  const candidates = [];

  for (const complaint of unlinkedComplaints) {
    const phone = complaint.verifiedPhone || complaint.phone;
    if (!phone) continue;

    // Find citizen with matching phone
    const matchingUser = registeredUsers.find(u => u.phone === phone);
    if (matchingUser) {
      const complaintDate = new Date(complaint.createdAt);
      const userRegisteredDate = new Date(matchingUser.createdAt);

      // Verify the complaint was submitted around or after the user's registration
      if (complaintDate >= userRegisteredDate) {
        candidates.push({
          complaintId: complaint.complaintId,
          createdAt: complaint.createdAt,
          phone,
          citizen: {
            id: matchingUser._id,
            name: matchingUser.name,
            email: matchingUser.email,
            registeredAt: matchingUser.createdAt
          }
        });
      }
    }
  }

  console.log(`🎯 Identified ${candidates.length} safely linkable complaints:`);
  for (const c of candidates) {
    console.log(`- Complaint ${c.complaintId} (${c.createdAt}) -> User "${c.citizen.name}" (${c.citizen.email}, Phone: ${c.phone})`);
  }

  if (candidates.length === 0) {
    console.log('\nNo unlinked records qualify for automatic linking under strict criteria.');
  } else if (!isExecute) {
    console.log('\n💡 Dry-run complete. No changes were made. To execute this safe migration, run:');
    console.log('   node src/utils/migrateUnlinkedComplaints.js --execute\n');
  } else {
    console.log('\n⚡ Committing updates to MongoDB...');
    let updatedCount = 0;
    for (const c of candidates) {
      await Complaint.updateOne(
        { complaintId: c.complaintId, citizenUserId: null },
        {
          $set: {
            citizenUserId: c.citizen.id,
            isGuestSubmission: false
          }
        }
      );
      updatedCount++;
    }
    console.log(`✅ Successfully migrated and linked ${updatedCount} complaints to their registered citizens!\n`);
  }

  await mongoose.disconnect();
}

runMigration().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
