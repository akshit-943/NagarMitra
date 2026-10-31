import 'dotenv/config';
import { connectDB } from '../src/config/db.js';
import Complaint from '../src/models/Complaint.js';
import { syncComplaintToMasterIssue } from '../src/services/masterIssueService.js';

async function syncAll() {
  await connectDB();
  const unlinked = await Complaint.find({ masterIssueId: null });
  console.log(`Found ${unlinked.length} unlinked complaints to sync into MasterIssues.`);

  for (const c of unlinked) {
    const res = await syncComplaintToMasterIssue(c);
    console.log(`Complaint ${c.complaintId} -> ${res.actionTaken} (${res.masterIssue?.masterIssueId})`);
  }

  console.log('Sync complete.');
  process.exit(0);
}

syncAll().catch((err) => {
  console.error('Sync failed:', err);
  process.exit(1);
});
