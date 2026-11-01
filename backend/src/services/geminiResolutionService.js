import { GoogleGenAI, Type } from '@google/genai';
import { isTrustedImageUrl } from './geminiService.js';

// Enforced schema for Gemini Before-and-After comparative assessment
const RESOLUTION_COMPARISON_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    appearsFixed: {
      type: Type.BOOLEAN,
      description: 'True if the visible defect/issue in the before photo appears repaired, cleared, or remediated in the after photo. False if defect remains visible or unrepaired.',
    },
    confidenceScore: {
      type: Type.INTEGER,
      description: 'Confidence score from 0 to 100 based on photographic evidence.',
    },
    repairQuality: {
      type: Type.STRING,
      description: 'One of: Satisfactory, Partial, Inadequate, or Inconclusive.',
    },
    summary: {
      type: Type.STRING,
      description: 'A concise 1-2 sentence assessment comparing the before and after state.',
    },
    observations: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Specific visual observations comparing the intake defect vs. completion photograph.',
    },
  },
  required: ['appearsFixed', 'confidenceScore', 'repairQuality', 'summary', 'observations'],
};

/**
 * Safely fetches image buffer from URL with timeout
 * @param {string} urlString
 * @returns {Promise<{ buffer: Buffer, mimeType: string } | null>}
 */
const fetchImageBuffer = async (urlString) => {
  if (!urlString || typeof urlString !== 'string') return null;

  try {
    // Handle inline data URLs directly without network call
    if (urlString.startsWith('data:')) {
      const match = urlString.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        return {
          buffer: Buffer.from(match[2], 'base64'),
          mimeType: match[1] || 'image/jpeg',
        };
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(urlString, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return {
      buffer,
      mimeType: contentType.split(';')[0].trim() || 'image/jpeg',
    };
  } catch (err) {
    console.warn(`⚠️ [GeminiResolutionService] Could not fetch image (${urlString}): ${err.message}`);
    return null;
  }
};

/**
 * Compares before-and-after photographs to assess whether an issue appears resolved.
 * Assisting function — produces an advisory verdict.
 *
 * @param {Object} params
 * @param {string} [params.beforeImageUrl] - Original intake photo URL
 * @param {string} [params.afterImageUrl] - Authority completion photo URL
 * @param {Buffer} [params.afterBuffer] - Optional raw buffer if just uploaded
 * @param {string} [params.afterMimeType] - Optional mimeType if just uploaded
 * @param {string} [params.category] - Incident category
 * @param {string} [params.description] - Original citizen description
 * @param {string} [params.workDescription] - Authority resolution description
 * @returns {Promise<Object>} Advisory assessment payload
 */
export const compareResolutionEvidence = async ({
  beforeImageUrl = null,
  afterImageUrl = null,
  afterBuffer = null,
  afterMimeType = 'image/jpeg',
  category = 'Civic Issue',
  description = '',
  workDescription = '',
}) => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.includes('placeholder')) {
    return {
      status: 'Skipped',
      appearsFixed: null,
      confidenceScore: null,
      repairQuality: 'Inconclusive',
      summary: 'AI comparison skipped: Gemini API key not configured.',
      observations: ['Automated AI comparison unavailable. Please review visual evidence manually.'],
      assessedAt: new Date(),
      modelUsed: null,
    };
  }

  // Retrieve before image
  let beforeData = null;
  if (beforeImageUrl) {
    beforeData = await fetchImageBuffer(beforeImageUrl);
  }

  // Retrieve after image
  let afterData = null;
  if (afterBuffer) {
    afterData = { buffer: afterBuffer, mimeType: afterMimeType };
  } else if (afterImageUrl) {
    afterData = await fetchImageBuffer(afterImageUrl);
  }

  // If both images are not available, return informative advisory state
  if (!beforeData && !afterData) {
    return {
      status: 'NoImages',
      appearsFixed: null,
      confidenceScore: null,
      repairQuality: 'Inconclusive',
      summary: 'Neither intake nor resolution photographs are available for AI visual comparison.',
      observations: ['No photographic evidence attached to original complaint or resolution report.'],
      assessedAt: new Date(),
      modelUsed: null,
    };
  }

  const ai = new GoogleGenAI({ apiKey });

  const systemPrompt = `You are NagarMitra Resolution Inspector, an objective municipal infrastructure auditor.
Your job is to compare a citizen's "Before" intake photograph showing a reported civic grievance with a municipal crew's "After" completion photograph.

Evaluation Rules:
1. Examine the before image to identify the original defect (e.g., pothole, garbage heap, water leakage, broken streetlight, open drain).
2. Examine the after image to determine if the specific defect has been repaired, cleared, or leveled.
3. Be objective:
   - If the site is clearly restored or cleaned: appearsFixed = true, repairQuality = "Satisfactory" or "Partial".
   - If the defect is still present, incomplete, or debris remains: appearsFixed = false, repairQuality = "Inadequate" or "Partial".
   - If photos appear to show different locations, are obscured, or inconclusive: repairQuality = "Inconclusive", confidenceScore < 50.
4. IMPORTANT: Your evaluation is strictly advisory to assist human citizens and municipal supervisors. Citizens make the final confirmation.`;

  const contents = [];

  if (beforeData) {
    contents.push('--- [IMAGE 1: BEFORE REPAIR — Citizen Intake Evidence] ---');
    contents.push({
      inlineData: {
        data: beforeData.buffer.toString('base64'),
        mimeType: beforeData.mimeType,
      },
    });
  } else {
    contents.push('--- [NOTE: Original intake photograph was not provided by citizen] ---');
  }

  if (afterData) {
    contents.push('--- [IMAGE 2: AFTER REPAIR — Municipal Crew Completion Evidence] ---');
    contents.push({
      inlineData: {
        data: afterData.buffer.toString('base64'),
        mimeType: afterData.mimeType,
      },
    });
  }

  contents.push(`Grievance Context:
- Category: ${category}
- Citizen Problem Description: "${description || 'Not provided'}"
- Field Team Resolution Notes: "${workDescription || 'Work reported completed by municipal dispatch'}"

Please inspect both photographs and provide a structured JSON assessment following the schema.`);

  // Candidate models with seamless failover
  const candidateModels = [
    'gemini-3.5-flash-lite',
    process.env.GEMINI_MODEL || 'gemini-3.5-flash',
    'gemini-flash-latest',
    'gemini-3.1-flash-lite',
  ];

  for (const model of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseJsonSchema: RESOLUTION_COMPARISON_SCHEMA,
          temperature: 0.15,
        },
      });

      const parsed = JSON.parse(response.text);

      // Normalize repair quality enum
      let quality = (parsed.repairQuality || 'Inconclusive').trim();
      const validQualities = ['Satisfactory', 'Partial', 'Inadequate', 'Inconclusive'];
      if (!validQualities.includes(quality)) {
        quality = parsed.appearsFixed ? 'Satisfactory' : 'Inadequate';
      }

      return {
        status: 'Completed',
        appearsFixed: Boolean(parsed.appearsFixed),
        confidenceScore: Math.max(0, Math.min(100, Math.round(Number(parsed.confidenceScore) || 75))),
        repairQuality: quality,
        summary: parsed.summary || (parsed.appearsFixed ? 'Repair appears visually completed.' : 'Defect appears to persist.'),
        observations: Array.isArray(parsed.observations) ? parsed.observations : [parsed.summary],
        assessedAt: new Date(),
        modelUsed: model,
      };
    } catch (err) {
      console.warn(`⚠️ [GeminiResolutionService] Model '${model}' failed comparison: ${err.message?.substring(0, 80)}. Checking next fallback...`);
    }
  }

  // Graceful fallback if AI is temporarily unreachable
  return {
    status: 'Failed',
    appearsFixed: null,
    confidenceScore: null,
    repairQuality: 'Inconclusive',
    summary: 'Automated AI visual check is temporarily unavailable. Community citizen confirmation remains active.',
    observations: ['AI inspection service temporarily offline or quota-limited. Manual verification recommended.'],
    assessedAt: new Date(),
    modelUsed: null,
  };
};
