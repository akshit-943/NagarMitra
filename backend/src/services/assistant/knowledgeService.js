/**
 * Knowledge Base for CivicPulse AI Conversational Assistant
 * Curated municipal domain facts, department SLAs, and operational guidelines.
 */

export const MUNICIPAL_KNOWLEDGE = {
  appName: 'CivicPulse AI',
  description: 'AI-Powered Municipal Grievance and Infrastructure Intelligence Platform for Indian Cities.',
  departments: [
    {
      name: 'Sanitation Department',
      canonicalName: 'Sanitation',
      categories: ['Garbage Accumulation', 'Illegal Dumping', 'Overflowing Dustbins'],
      standardSlaHours: 48,
      leadOfficer: 'Chief Municipal Sanitation Officer',
      scope: 'Solid waste management, garbage clearance, public sweepers, composting units.',
    },
    {
      name: 'Road Maintenance Department',
      canonicalName: 'Roads & Infrastructure',
      categories: ['Road Damage', 'Potholes', 'Damaged Footpaths', 'Broken Dividers'],
      standardSlaHours: 120, // 5 days
      leadOfficer: 'Executive Engineer (Roads)',
      scope: 'Asphalt resurfacing, pothole filling, road repairs, footpath maintenance.',
    },
    {
      name: 'Water Supply Department',
      canonicalName: 'Water Supply',
      categories: ['Water Leakage', 'Low Pressure', 'Contaminated Water', 'Burst Main'],
      standardSlaHours: 24,
      leadOfficer: 'Assistant Engineer (Water Works)',
      scope: 'Municipal potable water lines, main distribution repairs, valve fixes.',
    },
    {
      name: 'Drainage and Sewerage Department',
      canonicalName: 'Drainage & Water',
      categories: ['Drainage Issues', 'Blocked Sewers', 'Monsoon Waterlogging', 'Open Manholes'],
      standardSlaHours: 48,
      leadOfficer: 'Drainage Superintendent',
      scope: 'Stormwater drain desilting, sewer unblocking, manhole cover replacement.',
    },
    {
      name: 'Electrical Maintenance Department',
      canonicalName: 'Electricity & Lighting',
      categories: ['Streetlight Problems', 'Exposed Cables', 'Faulty High-Mast Lights'],
      standardSlaHours: 36,
      leadOfficer: 'Chief Electrical Inspector',
      scope: 'Streetlight repairs, timer resets, replacement of LED fixtures, wiring safety.',
    },
    {
      name: 'Environmental Department',
      canonicalName: 'Parks & Environment',
      categories: ['Air Pollution', 'Water Pollution', 'Fallen Trees', 'Park Neglect'],
      standardSlaHours: 72,
      leadOfficer: 'Environmental Health Officer',
      scope: 'Industrial emissions monitoring, tree trimming, garden and green cover upkeep.',
    },
  ],
  emergencyContacts: [
    { service: 'National Emergency', number: '112' },
    { service: 'Municipal Helpline', number: '1916' },
    { service: 'Fire Brigade', number: '101' },
    { service: 'Ambulance Service', number: '102' },
    { service: 'Child Helpline', number: '1098' },
    { service: 'Women Safety Helpline', number: '1091' },
  ],
  faqEntries: [
    {
      topic: 'how to report',
      question: 'How do I submit a civic grievance?',
      answer: 'Click the "Report Issue" button at the top of the portal. Provide a title, clear description, exact location or pin on the map, and optionally upload a photograph. CivicPulse AI will automatically analyze severity, assign the relevant department, and detect any existing duplicate complaints.',
    },
    {
      topic: 'duplicate detection',
      question: 'What is a Master Issue and how does duplicate grouping work?',
      answer: 'When multiple citizens report the same issue (e.g. the same pothole or water leak within a 500-meter radius), CivicPulse AI groups them under a single Master Issue (MST-XXXXXXXX). This consolidates citizen upvotes, alerts municipal dispatchers to high-impact locations, and avoids dispatching duplicate field crews.',
    },
    {
      topic: 'tracking',
      question: 'How do I track my complaint without logging in?',
      answer: 'You can visit the "Track Complaint" page and enter your Complaint ID (e.g., CIV-20261101-ABCD) along with a quick security CAPTCHA. If you are registered, all your submitted issues appear directly on your Personal Citizen Dashboard.',
    },
    {
      topic: 'resolution verification',
      question: 'How does the resolution verification process work?',
      answer: 'Once municipal field crews complete the repair and upload before-and-after photo evidence, the complaint enters "Resolution Submitted". Citizens who raised the issue can verify the work and confirm satisfaction before the case is closed as "Resolved".',
    },
    {
      topic: 'transparency',
      question: 'What is the Public Transparency Dashboard?',
      answer: 'The Public Transparency Dashboard provides real-time civic accountability: overall resolution rates, SLA adherence, department scorecards, recurring problem clusters, and automated PDF executive impact report downloads.',
    },
  ],
};

/**
 * Searches municipal knowledge base for relevant facts and guidelines
 * @param {string} query 
 * @returns {Object}
 */
export const searchKnowledge = (query = '') => {
  if (!query) {
    return {
      departments: MUNICIPAL_KNOWLEDGE.departments.map((d) => ({ name: d.name, slaHours: d.standardSlaHours })),
      emergencyContacts: MUNICIPAL_KNOWLEDGE.emergencyContacts,
    };
  }

  const cleanQ = query.toLowerCase();

  const matchingFaq = MUNICIPAL_KNOWLEDGE.faqEntries.filter(
    (item) => item.topic.includes(cleanQ) || item.question.toLowerCase().includes(cleanQ) || item.answer.toLowerCase().includes(cleanQ)
  );

  const matchingDept = MUNICIPAL_KNOWLEDGE.departments.filter(
    (d) => d.name.toLowerCase().includes(cleanQ) || d.categories.some((c) => c.toLowerCase().includes(cleanQ))
  );

  return {
    query,
    matchingFaq,
    matchingDepartments: matchingDept,
    emergencyContacts: cleanQ.includes('emergency') || cleanQ.includes('help') || cleanQ.includes('number')
      ? MUNICIPAL_KNOWLEDGE.emergencyContacts
      : undefined,
  };
};
