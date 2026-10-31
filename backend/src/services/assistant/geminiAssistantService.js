import { GoogleGenAI } from '@google/genai';
import { executeTool } from './toolRegistry.js';

// Tool Declarations formatted with parametersJsonSchema for @google/genai
const GEMINI_TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'getComplaintStatus',
        description: 'Look up real-time status, department assignment, and progress of any complaint or master issue by its ID (e.g. CIV-20261101-ABCD or MST-20261101-WXYZ).',
        parametersJsonSchema: {
          type: 'object',
          properties: {
            complaintId: {
              type: 'string',
              description: 'The complaint ID or Master Issue ID to track.',
            },
          },
          required: ['complaintId'],
        },
      },
      {
        name: 'getMyComplaints',
        description: 'List the complaints filed by the currently logged-in citizen.',
        parametersJsonSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'integer',
              description: 'Number of complaints to fetch (default 5).',
            },
          },
        },
      },
      {
        name: 'getCityTransparencyOverview',
        description: 'Get citywide municipal statistics: total complaints, resolution percentage, active issues, and efficiency rate.',
        parametersJsonSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'getDepartmentPerformance',
        description: 'Get performance metrics, active load, and resolution stats for a specific municipal department.',
        parametersJsonSchema: {
          type: 'object',
          properties: {
            department: {
              type: 'string',
              description: 'The department name (e.g., Sanitation, Roads & Infrastructure, Water Supply, Electricity & Lighting).',
            },
          },
          required: ['department'],
        },
      },
      {
        name: 'draftCivicComplaint',
        description: 'Prepare an interactive draft complaint card when a citizen describes an incident they want to report. The user reviews and submits the draft with one click.',
        parametersJsonSchema: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Clear, concise headline summarizing the issue.',
            },
            description: {
              type: 'string',
              description: 'Detailed description of the civic problem and hazards.',
            },
            category: {
              type: 'string',
              description: 'Category: Road Damage, Garbage Accumulation, Water Leakage, Drainage Issues, Streetlight Problems, Public Infrastructure Damage, Air Pollution, Water Pollution.',
            },
            address: {
              type: 'string',
              description: 'Location or street address in the city.',
            },
            estimatedSeverity: {
              type: 'string',
              description: 'Estimated severity: Low, Medium, High, or Critical.',
            },
          },
          required: ['title', 'description', 'category'],
        },
      },
      {
        name: 'searchMunicipalFaq',
        description: 'Search municipal operating rules, SLAs, helpline numbers, or how-to procedures.',
        parametersJsonSchema: {
          type: 'object',
          properties: {
            topic: {
              type: 'string',
              description: 'Keyword or topic to search (e.g. emergency, duplicate detection, SLAs, sanitation).',
            },
          },
          required: ['topic'],
        },
      },
      {
        name: 'getAuthorityQueueSummary',
        description: 'Authority only: Get summary of high-priority complaints, pending assignments, and active queue for municipal administrators.',
        parametersJsonSchema: {
          type: 'object',
          properties: {
            department: {
              type: 'string',
              description: 'Optional department filter.',
            },
          },
        },
      },
      {
        name: 'getPendingDuplicateClusters',
        description: 'Authority only: Fetch Master Issues that have pending duplicate complaints awaiting merge review.',
        parametersJsonSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  },
];

/**
 * Builds the system instruction tailored to caller context
 */
const getSystemInstruction = (context = {}) => {
  const role = context.roleContext || 'guest';
  const userName = context.user?.name || (role === 'citizen' ? 'Citizen' : role === 'authority' ? 'Officer' : 'Visitor');
  const userDept = context.user?.department ? ` (Department: ${context.user.department})` : '';

  return `You are CivicPulse Assistant, the intelligent municipal conversational AI for CivicPulse AI.
Your purpose is to provide civic assistance, real-time grievance tracking, municipal transparency information, and help citizens draft complaints for review.

User Context:
- Role: ${role.toUpperCase()}
- Name: ${userName}${userDept}

Guidelines:
1. Always be polite, concise, professional, and civic-minded.
2. Use markdown formatting with bold text, bullet points, and clean paragraphs.
3. When the user asks about a complaint ID (CIV-XXXX or MST-XXXX), invoke 'getComplaintStatus'.
4. When a logged-in citizen asks about their grievances or "my complaints", call 'getMyComplaints'.
5. When the user asks for city statistics or resolution rates, call 'getCityTransparencyOverview'.
6. When the user describes a problem they want to report (e.g. "there is a huge pothole on MG Road"), proactively call 'draftCivicComplaint' with appropriate fields so the user can review and submit the card.
7. For emergency inquiries, provide standard Indian emergency numbers (112, 1916 for Municipal, 101 for Fire).
8. Do not make up fake complaint IDs or invent non-existent statistics; use the tools to query live data.`;
};

/**
 * Executes a multi-turn chat interaction with Gemini and tool execution
 * 
 * @param {Object} params
 * @param {string} params.message - Current user query
 * @param {Array} [params.history] - Prior messages in the conversation
 * @param {Object} [params.context] - Session context { roleContext, user }
 * @returns {Promise<{ reply: string, toolCalls: Array, toolResults: Array, draftComplaint: Object|null }>}
 */
export const runAssistantTurn = async ({ message, history = [], context = {} }) => {
  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';

  if (!apiKey || apiKey.includes('placeholder')) {
    // Graceful fallback if no API key is configured
    return runFallbackAssistant({ message, context });
  }

  const ai = new GoogleGenAI({ apiKey });
  const systemInstruction = getSystemInstruction(context);

  // Build contents array from recent history (up to last 10 turns to avoid exceeding context)
  const contents = [];
  const recentHistory = history.slice(-10);

  for (const item of recentHistory) {
    if (item.sender === 'user') {
      contents.push({
        role: 'user',
        parts: [{ text: item.text }],
      });
    } else if (item.sender === 'assistant' && item.text) {
      contents.push({
        role: 'model',
        parts: [{ text: item.text }],
      });
    }
  }

  // Add current user message
  contents.push({
    role: 'user',
    parts: [{ text: message }],
  });

  const executedToolCalls = [];
  const executedToolResults = [];
  let capturedDraft = null;

  try {
    // Step 1: Initial call to Gemini with tools
    const firstResponse = await ai.models.generateContent({
      model: modelName,
      contents,
      config: {
        systemInstruction,
        tools: GEMINI_TOOLS,
        temperature: 0.3,
      },
    });

    // Check if Gemini invoked function calls
    if (firstResponse.functionCalls && firstResponse.functionCalls.length > 0) {
      // Preserve model candidate content (with its thought signature)
      contents.push(firstResponse.candidates[0].content);

      // Execute each tool call
      for (const call of firstResponse.functionCalls) {
        executedToolCalls.push({
          name: call.name,
          args: call.args,
          id: call.id,
        });

        const result = await executeTool(call.name, call.args, context);
        executedToolResults.push({
          name: call.name,
          result,
        });

        if (call.name === 'draftCivicComplaint' && result.isDraftReady) {
          capturedDraft = result.draft;
        }

        // Push functionResponse to contents
        contents.push({
          role: 'user',
          parts: [
            {
              functionResponse: {
                name: call.name,
                response: { result },
                id: call.id,
              },
            },
          ],
        });
      }

      // Step 2: Final response from Gemini after incorporating tool outputs
      const secondResponse = await ai.models.generateContent({
        model: modelName,
        contents,
        config: {
          systemInstruction,
          tools: GEMINI_TOOLS,
          temperature: 0.3,
        },
      });

      return {
        reply: secondResponse.text || 'I have retrieved the requested information for you.',
        toolCalls: executedToolCalls,
        toolResults: executedToolResults,
        draftComplaint: capturedDraft,
      };
    }

    // Direct text response without tools
    return {
      reply: firstResponse.text || 'How can I assist you with city services or grievances today?',
      toolCalls: [],
      toolResults: [],
      draftComplaint: null,
    };
  } catch (error) {
    console.warn(`⚠️ [GeminiAssistantService] API generation failed: ${error.message}. Switching to resilient local assistant.`);
    return runFallbackAssistant({ message, context, originalError: error.message });
  }
};

/**
 * Resilient local fallback when Gemini API is rate-limited, unreachable, or key is missing.
 * Ensures the assistant NEVER crashes or breaks user experience.
 */
const runFallbackAssistant = async ({ message = '', context = {}, originalError = null }) => {
  const clean = message.toLowerCase();
  const executedToolCalls = [];
  const executedToolResults = [];
  let capturedDraft = null;

  // 1. Complaint ID Tracking check
  const complaintIdMatch = message.match(/\b(CIV|MST)-\d{8}-[A-Za-z0-9]+\b/i);
  if (complaintIdMatch) {
    const id = complaintIdMatch[0].toUpperCase();
    const result = await executeTool('getComplaintStatus', { complaintId: id }, context);
    executedToolCalls.push({ name: 'getComplaintStatus', args: { complaintId: id } });
    executedToolResults.push({ name: 'getComplaintStatus', result });

    if (result.found) {
      return {
        reply: `### Status for ${result.complaintId || result.masterIssueId}\n\n- **Issue:** ${result.title}\n- **Current Status:** **${result.status}**\n- **Department:** ${result.department}\n- **Location:** ${result.address}\n\nOur field teams are actively monitoring this grievance.`,
        toolCalls: executedToolCalls,
        toolResults: executedToolResults,
        draftComplaint: null,
      };
    } else {
      return {
        reply: `I could not locate any active complaint with ID **${id}**. Please double-check your complaint reference number or track it directly via the Track Complaint page.`,
        toolCalls: executedToolCalls,
        toolResults: executedToolResults,
        draftComplaint: null,
      };
    }
  }

  // 2. City Overview / Transparency check
  if (clean.includes('statistic') || clean.includes('overview') || clean.includes('transparency') || clean.includes('how many complaint') || clean.includes('resolution rate')) {
    const stats = await executeTool('getCityTransparencyOverview', {}, context);
    return {
      reply: `### Citywide Civic Statistics\n\n- **Total Complaints Filed:** ${stats.totalComplaints}\n- **Successfully Resolved:** ${stats.resolvedComplaints}\n- **Active / In Progress:** ${stats.inProgressComplaints}\n- **Resolution Efficiency:** **${stats.resolutionRate}**\n\nYou can view full department scorecards on our Public Transparency Dashboard.`,
      toolCalls: [{ name: 'getCityTransparencyOverview', args: {} }],
      toolResults: [{ name: 'getCityTransparencyOverview', result: stats }],
      draftComplaint: null,
    };
  }

  // 3. Personal complaints check (Citizen)
  if ((clean.includes('my complaint') || clean.includes('my issues') || clean.includes('my grievances')) && context.roleContext === 'citizen') {
    const myComplaints = await executeTool('getMyComplaints', {}, context);
    if (myComplaints.count > 0) {
      const list = myComplaints.complaints
        .map((c) => `- **${c.complaintId}**: ${c.title} — *${c.status}*`)
        .join('\n');
      return {
        reply: `Here are your recent registered complaints, ${context.user?.name || 'Citizen'}:\n\n${list}`,
        toolCalls: [{ name: 'getMyComplaints', args: {} }],
        toolResults: [{ name: 'getMyComplaints', result: myComplaints }],
        draftComplaint: null,
      };
    } else {
      return {
        reply: `You currently have no registered complaints on file. You can file one anytime by clicking "Report Issue" or letting me know what issue you're facing.`,
        toolCalls: [{ name: 'getMyComplaints', args: {} }],
        toolResults: [{ name: 'getMyComplaints', result: myComplaints }],
        draftComplaint: null,
      };
    }
  }

  // 4. Intent to draft a complaint
  if (clean.includes('pothole') || clean.includes('garbage') || clean.includes('water leak') || clean.includes('broken light') || clean.includes('report') || clean.includes('drainage')) {
    let category = 'Other Civic Issues';
    if (clean.includes('pothole') || clean.includes('road')) category = 'Road Damage';
    else if (clean.includes('garbage') || clean.includes('trash') || clean.includes('waste')) category = 'Garbage Accumulation';
    else if (clean.includes('water leak') || clean.includes('pipe')) category = 'Water Leakage';
    else if (clean.includes('light') || clean.includes('lamp')) category = 'Streetlight Problems';
    else if (clean.includes('drain') || clean.includes('sewer')) category = 'Drainage Issues';

    const draftResult = await executeTool('draftCivicComplaint', {
      title: message.length > 50 ? `${message.substring(0, 47)}...` : message,
      description: message,
      category,
      estimatedSeverity: 'Medium',
    }, context);

    capturedDraft = draftResult.draft;

    return {
      reply: `I have prepared a complaint draft based on your description. Please review the details below. When you're ready, you can submit it directly to dispatch our municipal teams!`,
      toolCalls: [{ name: 'draftCivicComplaint', args: { category } }],
      toolResults: [{ name: 'draftCivicComplaint', result: draftResult }],
      draftComplaint: capturedDraft,
    };
  }

  // 5. Emergency numbers
  if (clean.includes('emergency') || clean.includes('police') || clean.includes('fire') || clean.includes('ambulance') || clean.includes('helpline')) {
    return {
      reply: `### Emergency & Civic Helplines\n\n- **National Emergency:** 112\n- **Municipal Helpline:** 1916\n- **Fire Department:** 101\n- **Ambulance Services:** 102\n- **Child Helpline:** 1098\n- **Women Safety Helpline:** 1091`,
      toolCalls: [],
      toolResults: [],
      draftComplaint: null,
    };
  }

  // General helpful guide
  return {
    reply: `Hello! I am your **CivicPulse AI Assistant**. I can help you with:\n\n- **Tracking an issue:** Give me your Complaint ID (e.g. \`CIV-20261101-ABCD\`).\n- **Reporting a problem:** Tell me about any pothole, garbage dump, water leak, or broken streetlight.\n- **City transparency stats:** Ask for city resolution rates or department performance.\n- **Emergency & Helplines:** Ask for helpline numbers.\n\nHow can I help you today?`,
    toolCalls: [],
    toolResults: [],
    draftComplaint: null,
  };
};
