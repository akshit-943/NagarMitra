import { GoogleGenAI, Type } from '@google/genai';

// Allowed civic categories per specification
export const ALLOWED_CATEGORIES = [
  'Road Damage',
  'Garbage Accumulation',
  'Water Leakage',
  'Drainage Issues',
  'Streetlight Problems',
  'Public Infrastructure Damage',
  'Air Pollution',
  'Water Pollution',
  'Other Civic Issues',
  'Uncertain',
];

// Allowed municipal departments
export const ALLOWED_DEPARTMENTS = [
  'Road Maintenance Department',
  'Sanitation Department',
  'Water Supply Department',
  'Drainage and Sewerage Department',
  'Electrical Maintenance Department',
  'Environmental Department',
  'Municipal Public Works',
];

// Valid trusted domains for fetching Cloudinary stored images (Prevents SSRF)
const TRUSTED_IMAGE_DOMAINS = [
  'res.cloudinary.com',
  'cloudinary.com',
];

/**
 * Validates whether a URL is from a trusted image storage host
 * @param {string} urlString 
 * @returns {boolean}
 */
export const isTrustedImageUrl = (urlString) => {
  try {
    const parsed = new URL(urlString);
    return TRUSTED_IMAGE_DOMAINS.some(
      (domain) => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
};

/**
 * Securely fetch and validate image content from Cloudinary
 * @param {string} imageUrl 
 * @returns {Promise<{ buffer: Buffer, mimeType: string }>}
 */
export const fetchCloudinaryImage = async (imageUrl) => {
  if (!isTrustedImageUrl(imageUrl)) {
    throw new Error('Security Error: Image URL host is not trusted. Only Cloudinary URLs are allowed.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 second fetch timeout

  try {
    const response = await fetch(imageUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch image from storage: HTTP ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowedTypes.some((t) => contentType.toLowerCase().includes(t))) {
      throw new Error(`Invalid image type: '${contentType}'. Allowed types are JPEG, PNG, WEBP.`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Limit image size to 10MB
    if (buffer.length > 10 * 1024 * 1024) {
      throw new Error('Image size exceeds 10MB limit for AI analysis.');
    }

    return {
      buffer,
      mimeType: contentType.split(';')[0].trim(),
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Image retrieval from storage timed out.');
    }
    throw err;
  }
};

/**
 * Enforced JSON schema for Gemini structured output
 */
const CIVIC_ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    isCivicIssue: {
      type: Type.BOOLEAN,
      description: 'True if the photo/description represents a genuine public civic or infrastructure issue. False if unrelated (e.g. personal selfie, indoor pet, screenshot).',
    },
    category: {
      type: Type.STRING,
      description: 'The civic category: Road Damage, Garbage Accumulation, Water Leakage, Drainage Issues, Streetlight Problems, Public Infrastructure Damage, Air Pollution, Water Pollution, or Other Civic Issues / Uncertain.',
    },
    detectedIssue: {
      type: Type.STRING,
      description: 'Concise title of the specific issue detected (e.g., Deep pothole in vehicular lane, Burst water pipe flooding sidewalk).',
    },
    severityScore: {
      type: Type.INTEGER,
      description: 'Integer severity score from 0 to 100 based on visible extent of damage and risk.',
    },
    severityLevel: {
      type: Type.STRING,
      description: 'Low (0-24), Medium (25-49), High (50-74), or Critical (75-100).',
    },
    confidence: {
      type: Type.NUMBER,
      description: 'Confidence score between 0.00 and 1.00 based on photographic clarity and evidence.',
    },
    safetyRisk: {
      type: Type.OBJECT,
      properties: {
        level: {
          type: Type.STRING,
          description: 'Risk level: None, Low, Medium, High, or Critical.',
        },
        description: {
          type: Type.STRING,
          description: 'Specific description of public safety risk (e.g., Accident risk for two-wheelers, sanitation hazard).',
        },
        affectedGroups: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Target demographic or transit groups affected (e.g., Pedestrians, Motorists, Two-wheelers).',
        },
      },
      required: ['level', 'description', 'affectedGroups'],
    },
    department: {
      type: Type.STRING,
      description: 'The recommended municipal department from the allowed list: Road Maintenance Department, Sanitation Department, Water Supply Department, Drainage and Sewerage Department, Electrical Maintenance Department, Environmental Department, or Municipal Public Works.',
    },
    recommendations: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '2 to 4 practical, actionable corrective steps grounded in the evidence.',
    },
    reasoning: {
      type: Type.STRING,
      description: 'Short objective explanation for the severity and classification based on visible evidence.',
    },
    requiresHumanReview: {
      type: Type.BOOLEAN,
      description: 'True if the image is blurry, ambiguous, borderline, or requires physical engineer verification.',
    },
  },
  required: [
    'isCivicIssue',
    'category',
    'detectedIssue',
    'severityScore',
    'severityLevel',
    'confidence',
    'safetyRisk',
    'department',
    'recommendations',
    'reasoning',
    'requiresHumanReview',
  ],
};

/**
 * Analyze a civic complaint using Google GenAI SDK (@google/genai)
 * Handles text descriptions and multimodal image inputs.
 * 
 * @param {Object} params
 * @param {string} params.description - Citizen-provided complaint description
 * @param {string} [params.category] - Citizen-selected category (optional context)
 * @param {string} [params.address] - Location address (optional context)
 * @param {string} [params.imageUrl] - Trusted Cloudinary image URL (optional)
 * @param {Buffer} [params.imageBuffer] - Direct image buffer (optional)
 * @param {string} [params.mimeType] - Image mime type
 * @returns {Promise<Object>} Structured AI analysis results
 */
export const analyzeComplaintWithGemini = async ({
  description,
  category = '',
  address = '',
  imageUrl = null,
  imageBuffer = null,
  mimeType = 'image/jpeg',
}) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.includes('placeholder')) {
    throw new Error('GEMINI_API_KEY is not configured in backend/.env. AI analysis cannot proceed.');
  }

  const modelName = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
  const ai = new GoogleGenAI({ apiKey });

  // System instruction prompt
  const systemPrompt = `You are CivicPulse AI, a municipal infrastructure intelligence and civic grievance analysis engine.
Your task is to analyze civic complaints submitted by citizens, consisting of a citizen description and often a field photograph.
You must assess both the photograph and description together objectively.

Core Guidelines:
1. Examine visible physical damage, public safety risks, and infrastructure obstruction.
2. If the image is blurry, ambiguous, or lacks conclusive evidence, lower your confidence (< 0.70) and set requiresHumanReview: true.
3. If the image or description is NOT related to civic/municipal infrastructure (e.g. personal portraits, animals, indoor selfies, spam), set isCivicIssue: false, category: "Other Civic Issues", severityScore: 0, severityLevel: "Low", and set requiresHumanReview: true so municipal dispatchers can review before closing.
4. Do not invent exact counts of casualties or unsupported medical claims.
5. Provide grounded, practical recommendations for city field crews.
6. The severity score must be an integer between 0 and 100:
   - 0–24: Low
   - 25–49: Medium
   - 50–74: High
   - 75–100: Critical
7. Recommend one of the allowed municipal departments:
   - Road Maintenance Department
   - Sanitation Department
   - Water Supply Department
   - Drainage and Sewerage Department
   - Electrical Maintenance Department
   - Environmental Department
   - Municipal Public Works`;

  const userPrompt = `Citizen Incident Report Context:
- Citizen Description: "${description || 'No description provided'}"
${category ? `- Reported Category: ${category}` : ''}
${address ? `- Location Address: ${address}` : ''}

Please examine the evidence and provide a structured JSON assessment following the schema.`;

  const contents = [];

  // Handle multimodal image input
  let finalBuffer = imageBuffer;
  let finalMime = mimeType;

  if (!finalBuffer && imageUrl) {
    try {
      const fetched = await fetchCloudinaryImage(imageUrl);
      finalBuffer = fetched.buffer;
      finalMime = fetched.mimeType;
    } catch (fetchErr) {
      console.warn(`⚠️ [GeminiService] Could not retrieve image from storage: ${fetchErr.message}. Proceeding with text-only analysis.`);
    }
  }

  if (finalBuffer) {
    contents.push({
      inlineData: {
        data: finalBuffer.toString('base64'),
        mimeType: finalMime,
      },
    });
  }

  contents.push(userPrompt);

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseJsonSchema: CIVIC_ANALYSIS_SCHEMA,
        temperature: 0.2, // Low temperature for consistent, factual civic evaluations
      },
    });

    const rawText = response.text;
    if (!rawText) {
      throw new Error('Gemini returned an empty response.');
    }

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (parseErr) {
      throw new Error(`Failed to parse Gemini response as JSON: ${parseErr.message}`);
    }

    // Backend validation & normalization (Do not trust model output blindly)
    const normalized = validateAndNormalizeAiResponse(parsed, modelName);
    return normalized;
  } catch (error) {
    const isQuotaExhausted =
      error.message?.includes('429') ||
      error.message?.includes('RESOURCE_EXHAUSTED') ||
      error.message?.includes('quota');

    if (isQuotaExhausted) {
      console.warn('⚠️ [GeminiService] Gemini API free tier daily quota exhausted (20 req/day). Marking for manual triage.');
      const quotaErr = new Error('Gemini API daily quota limit reached (Free tier 20 req/day). Incident saved and queued for manual triage.');
      quotaErr.isQuotaExhausted = true;
      throw quotaErr;
    }

    console.error('❌ [GeminiService] Error during analysis:', error.message);
    throw error;
  }
};

/**
 * Mock fixture generator strictly for development, unit testing, and UI state verification.
 * Avoids consuming Gemini free tier quota during routine test execution.
 * Actual citizen submissions retain real Gemini analysis.
 */
export const getMockGeminiAnalysis = ({ category = 'Road Damage', description = '' } = {}) => {
  const cat = ALLOWED_CATEGORIES.includes(category) ? category : 'Road Damage';
  const isHigh =
    description.toLowerCase().includes('critical') ||
    description.toLowerCase().includes('crater') ||
    description.toLowerCase().includes('massive');

  const severityScore = isHigh ? 85 : 55;
  const severityLevel = isHigh ? 'Critical' : 'High';

  let department = 'Municipal Public Works';
  if (cat === 'Road Damage') department = 'Road Maintenance Department';
  else if (cat === 'Garbage Accumulation') department = 'Sanitation Department';
  else if (cat === 'Water Leakage') department = 'Water Supply Department';
  else if (cat === 'Streetlight Problems') department = 'Electrical Maintenance Department';
  else if (cat === 'Drainage Issues') department = 'Drainage and Sewerage Department';

  return {
    isCivicIssue: true,
    category: cat,
    detectedIssue: `${cat}: ${description.slice(0, 60)}`,
    severityScore,
    severityLevel,
    confidence: 0.92,
    safetyRisk: {
      level: severityLevel,
      description: `Development fixture assessment for ${cat.toLowerCase()}.`,
      affectedGroups: ['Local Residents', 'Transit Commuters'],
    },
    department,
    recommendations: [
      'Conduct municipal on-site engineering survey.',
      'Deploy localized containment and repair barriers.',
    ],
    reasoning: 'Standardized development fixture meeting platform schema requirements.',
    requiresHumanReview: false,
    analysisStatus: 'Completed',
    analyzedAt: new Date(),
    modelUsed: 'mock-fixture-development',
  };
};

/**
 * Validate and sanitize raw Gemini response against platform standards
 * @param {Object} raw 
 * @param {string} modelName 
 * @returns {Object}
 */
export const validateAndNormalizeAiResponse = (raw, modelName) => {
  // Validate Category
  let category = raw.category;
  if (!ALLOWED_CATEGORIES.includes(category)) {
    category = 'Other Civic Issues';
  }

  // Validate & Clamp Severity Score
  let severityScore = Number.isInteger(raw.severityScore) ? raw.severityScore : Math.round(Number(raw.severityScore) || 50);
  severityScore = Math.max(0, Math.min(100, severityScore));

  // Determine Severity Level matching the score
  let severityLevel = raw.severityLevel;
  if (severityScore >= 75) severityLevel = 'Critical';
  else if (severityScore >= 50) severityLevel = 'High';
  else if (severityScore >= 25) severityLevel = 'Medium';
  else severityLevel = 'Low';

  // Validate & Clamp Confidence
  let confidence = typeof raw.confidence === 'number' ? raw.confidence : 0.85;
  confidence = Math.max(0.0, Math.min(1.0, Number(confidence.toFixed(2))));

  // Validate Department
  let department = raw.department;
  if (!ALLOWED_DEPARTMENTS.includes(department)) {
    department = 'Municipal Public Works';
  }

  // Validate Safety Risk
  const safetyRisk = {
    level: raw.safetyRisk?.level || severityLevel,
    description: raw.safetyRisk?.description || 'General civic infrastructure concern.',
    affectedGroups: Array.isArray(raw.safetyRisk?.affectedGroups) && raw.safetyRisk.affectedGroups.length > 0
      ? raw.safetyRisk.affectedGroups
      : ['Local Residents', 'Pedestrians'],
  };

  // Validate Recommendations
  const recommendations = Array.isArray(raw.recommendations) && raw.recommendations.length > 0
    ? raw.recommendations
    : ['Arrange standard municipal site inspection.', 'Verify resolution with resident upon completion.'];

  const isCivicIssue = typeof raw.isCivicIssue === 'boolean' ? raw.isCivicIssue : true;
  const requiresHumanReview = !isCivicIssue || Boolean(raw.requiresHumanReview) || confidence < 0.70;

  return {
    isCivicIssue,
    category,
    detectedIssue: raw.detectedIssue || category,
    severityScore,
    severityLevel,
    confidence,
    safetyRisk,
    department,
    recommendations,
    reasoning: raw.reasoning || 'Evaluated based on photographic and textual evidence.',
    requiresHumanReview,
    analysisStatus: 'Completed',
    analyzedAt: new Date(),
    modelUsed: modelName,
  };
};
