import Complaint from '../../models/Complaint.js';
import MasterIssue from '../../models/MasterIssue.js';
import { canonicalDepartment, getDepartmentForCategory } from '../../utils/departmentHelper.js';
import { searchKnowledge } from './knowledgeService.js';
import { isToolAuthorized } from './assistantPermissions.js';

/**
 * Registry of executable tools available to the conversational assistant.
 * Strictly wraps existing data access safely with zero mutation of existing business logic.
 */
export const TOOL_DEFINITIONS = [
  {
    name: 'getComplaintStatus',
    description: 'Look up real-time status, department assignment, and progress of any complaint or master issue by its ID (e.g., CIV-20261101-ABCD or MST-20261101-WXYZ).',
    parameters: {
      type: 'OBJECT',
      properties: {
        complaintId: {
          type: 'STRING',
          description: 'The complaint ID or Master Issue ID to track.',
        },
      },
      required: ['complaintId'],
    },
  },
  {
    name: 'getMyComplaints',
    description: 'List the complaints filed by the currently logged-in citizen.',
    parameters: {
      type: 'OBJECT',
      properties: {
        limit: {
          type: 'INTEGER',
          description: 'Number of recent complaints to fetch (default 5, max 15).',
        },
      },
    },
  },
  {
    name: 'getCityTransparencyOverview',
    description: 'Get high-level municipal statistics across the city: total complaints, resolution percentage, active issues, and top problem categories.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'getDepartmentPerformance',
    description: 'Get performance metrics, active load, and resolution stats for a specific municipal department.',
    parameters: {
      type: 'OBJECT',
      properties: {
        department: {
          type: 'STRING',
          description: 'The department name (e.g., Sanitation, Roads & Infrastructure, Water Supply, Electricity & Lighting).',
        },
      },
      required: ['department'],
    },
  },
  {
    name: 'draftCivicComplaint',
    description: 'Prepare a structured complaint draft when a citizen describes an incident they want to report. The assistant prepares this card for user review and confirmation before submission.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: {
          type: 'STRING',
          description: 'Clear, concise headline summarizing the issue.',
        },
        description: {
          type: 'STRING',
          description: 'Detailed description of the civic problem and hazards.',
        },
        category: {
          type: 'STRING',
          description: 'Category: Road Damage, Garbage Accumulation, Water Leakage, Drainage Issues, Streetlight Problems, Public Infrastructure Damage, Air Pollution, or Water Pollution.',
        },
        address: {
          type: 'STRING',
          description: 'Location or street address in the city.',
        },
        estimatedSeverity: {
          type: 'STRING',
          description: 'Estimated severity: Low, Medium, High, or Critical.',
        },
      },
      required: ['title', 'description', 'category'],
    },
  },
  {
    name: 'searchMunicipalFaq',
    description: 'Search municipal operating rules, SLAs, helpline numbers, or how-to procedures.',
    parameters: {
      type: 'OBJECT',
      properties: {
        topic: {
          type: 'STRING',
          description: 'Keyword or topic to search (e.g. emergency, duplicate detection, SLAs, sanitation).',
        },
      },
      required: ['topic'],
    },
  },
  {
    name: 'getAuthorityQueueSummary',
    description: 'Authority only: Get summary of high-priority complaints, pending assignments, and SLA status for municipal administrators.',
    parameters: {
      type: 'OBJECT',
      properties: {
        department: {
          type: 'STRING',
          description: 'Optional department filter.',
        },
      },
    },
  },
  {
    name: 'getPendingDuplicateClusters',
    description: 'Authority only: Fetch Master Issues that have pending duplicate complaints awaiting merge review.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
];

/**
 * Tool Execution Handlers
 */
export const executeTool = async (toolName, params = {}, context = {}) => {
  // 1. Permission check
  const roleContext = context.roleContext || 'guest';
  if (!isToolAuthorized(toolName, roleContext)) {
    return {
      error: `Access Denied: The tool '${toolName}' is not accessible in the current session context (${roleContext}).`,
    };
  }

  try {
    switch (toolName) {
      case 'getComplaintStatus': {
        const queryId = (params.complaintId || '').trim().toUpperCase();
        if (!queryId) {
          return { error: 'Please provide a valid Complaint ID or Master Issue ID.' };
        }

        // Try single complaint first
        const complaint = await Complaint.findOne({ complaintId: queryId })
          .select('complaintId title description category status severity priorityScore department location createdAt updatedAt masterIssueId resolutionDetails')
          .lean();

        if (complaint) {
          return {
            found: true,
            type: 'individual_complaint',
            complaintId: complaint.complaintId,
            title: complaint.title,
            category: complaint.category,
            department: complaint.department,
            status: complaint.status,
            priorityScore: complaint.priorityScore,
            address: complaint.location?.address || 'Location on record',
            masterIssueId: complaint.masterIssueId || null,
            reportedAt: complaint.createdAt,
            lastUpdated: complaint.updatedAt,
            isResolved: complaint.status === 'Resolved',
            resolutionNotes: complaint.resolutionDetails?.notes || null,
          };
        }

        // Try master issue
        const master = await MasterIssue.findOne({ masterIssueId: queryId })
          .select('masterIssueId title category status severity priority department address complaintCount complaints createdAt')
          .lean();

        if (master) {
          return {
            found: true,
            type: 'master_issue',
            masterIssueId: master.masterIssueId,
            title: master.title,
            category: master.category,
            department: master.department,
            status: master.status,
            priority: master.priority,
            totalGroupedComplaints: master.complaintCount || (master.complaints ? master.complaints.length : 1),
            address: master.address || 'Area cluster',
            reportedAt: master.createdAt,
          };
        }

        return {
          found: false,
          message: `No complaint or master issue found matching ID '${queryId}'. Please verify the ID format (e.g. CIV-20261101-ABCD).`,
        };
      }

      case 'getMyComplaints': {
        if (!context.user?.id) {
          return { error: 'Citizen authentication required to fetch your personal grievances.' };
        }

        const limit = Math.min(Math.max(parseInt(params.limit, 10) || 5, 1), 15);
        const complaints = await Complaint.find({ citizenId: context.user.id })
          .sort({ createdAt: -1 })
          .limit(limit)
          .select('complaintId title category status priorityScore createdAt location.address')
          .lean();

        return {
          citizenName: context.user.name,
          count: complaints.length,
          complaints: complaints.map((c) => ({
            complaintId: c.complaintId,
            title: c.title,
            category: c.category,
            status: c.status,
            priorityScore: c.priorityScore,
            address: c.location?.address,
            filedOn: c.createdAt,
          })),
        };
      }

      case 'getCityTransparencyOverview': {
        const [total, resolved, inProgress, underReview] = await Promise.all([
          Complaint.countDocuments(),
          Complaint.countDocuments({ status: 'Resolved' }),
          Complaint.countDocuments({ status: { $in: ['In Progress', 'Assigned', 'Resolution Submitted'] } }),
          Complaint.countDocuments({ status: { $in: ['Pending', 'Under Review'] } }),
        ]);

        const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

        return {
          totalComplaints: total,
          resolvedComplaints: resolved,
          inProgressComplaints: inProgress,
          pendingComplaints: underReview,
          resolutionRate: `${resolutionRate}%`,
          statusSummary: `CivicPulse AI has recorded ${total} grievances citywide, with ${resolved} resolved (${resolutionRate}% resolution efficiency).`,
        };
      }

      case 'getDepartmentPerformance': {
        const rawDept = params.department || '';
        const dept = canonicalDepartment(rawDept);

        const [total, resolved] = await Promise.all([
          Complaint.countDocuments({ department: { $regex: new RegExp(dept, 'i') } }),
          Complaint.countDocuments({ department: { $regex: new RegExp(dept, 'i') }, status: 'Resolved' }),
        ]);

        const rate = total > 0 ? Math.round((resolved / total) * 100) : 100;

        return {
          department: dept,
          totalAssigned: total,
          resolvedCount: resolved,
          activeCount: Math.max(total - resolved, 0),
          efficiencyRate: `${rate}%`,
        };
      }

      case 'draftCivicComplaint': {
        const rawCategory = params.category || 'Other Civic Issues';
        const assignedDept = getDepartmentForCategory(rawCategory);

        return {
          isDraftReady: true,
          draft: {
            title: params.title || 'Civic Grievance',
            description: params.description || '',
            category: rawCategory,
            department: assignedDept,
            address: params.address || '',
            severity: params.estimatedSeverity || 'Medium',
          },
          actionNote: 'Complaint draft prepared for citizen review. Please confirm details before final submission.',
        };
      }

      case 'searchMunicipalFaq': {
        return searchKnowledge(params.topic || '');
      }

      case 'getAuthorityQueueSummary': {
        const query = { status: { $nin: ['Resolved', 'Rejected'] } };
        if (params.department) {
          query.department = { $regex: new RegExp(params.department, 'i') };
        }

        const [highPriority, totalActive] = await Promise.all([
          Complaint.find({ ...query, priorityScore: { $gte: 70 } })
            .sort({ priorityScore: -1 })
            .limit(5)
            .select('complaintId title category priorityScore department createdAt')
            .lean(),
          Complaint.countDocuments(query),
        ]);

        return {
          totalActiveQueue: totalActive,
          urgentCriticalItems: highPriority.map((c) => ({
            complaintId: c.complaintId,
            title: c.title,
            priorityScore: c.priorityScore,
            department: c.department,
          })),
        };
      }

      case 'getPendingDuplicateClusters': {
        const masterIssuesWithDuplicates = await MasterIssue.find({
          'pendingDuplicates.0': { $exists: true },
        })
          .select('masterIssueId title category department pendingDuplicates')
          .limit(5)
          .lean();

        return {
          clusterCount: masterIssuesWithDuplicates.length,
          clusters: masterIssuesWithDuplicates.map((m) => ({
            masterIssueId: m.masterIssueId,
            title: m.title,
            department: m.department,
            pendingDuplicateCount: m.pendingDuplicates?.length || 0,
            pendingDuplicates: (m.pendingDuplicates || []).map((d) => ({
              complaintId: d.complaintId,
              title: d.title,
              confidenceScore: d.confidenceScore,
            })),
          })),
        };
      }

      default:
        return { error: `Unrecognized tool '${toolName}'.` };
    }
  } catch (err) {
    return {
      error: `Error executing tool '${toolName}': ${err.message}`,
    };
  }
};
