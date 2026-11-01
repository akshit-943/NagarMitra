import apiClient from './api';

// Generate or retrieve anonymous persistent citizen client token for voting / endorsement uniqueness
export const getClientCitizenId = () => {
  let citizenId = localStorage.getItem('civicpulse_citizen_id');
  if (!citizenId) {
    citizenId = 'cit_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    localStorage.setItem('civicpulse_citizen_id', citizenId);
  }
  return citizenId;
};

/**
 * Fetch all complaints with optional filtering and pagination
 * @param {Object} params - { category, status, severity, search, page, limit }
 * @returns {Promise<Object>}
 */
export const getComplaints = async (params = {}) => {
  const response = await apiClient.get('/complaints', { params });
  return response.data;
};

/**
 * Fetch single complaint by human-readable complaintId or _id
 * @param {string} id - Complaint ID
 * @returns {Promise<Object>}
 */
export const getComplaintById = async (id) => {
  const response = await apiClient.get(`/complaints/${encodeURIComponent(id)}`);
  return response.data;
};

/**
 * Create a new complaint (supports multipart/form-data for image uploads)
 * @param {Object} complaintData - { category, description, location: { address, latitude, longitude }, reportedBy }
 * @param {File|Blob} [imageFile] - Optional photograph file to upload
 * @returns {Promise<Object>}
 */
export const createComplaint = async (complaintData, imageFile = null) => {
  const citizenToken = localStorage.getItem('civicpulse_citizen_token');
  const requestHeaders = {};

  if (citizenToken) {
    requestHeaders['Authorization'] = `Bearer ${citizenToken}`;
  }

  if (imageFile) {
    const formData = new FormData();
    if (complaintData.category) formData.append('category', complaintData.category);
    if (complaintData.description) formData.append('description', complaintData.description);
    if (complaintData.address) formData.append('address', complaintData.address);
    if (complaintData.severity) formData.append('severity', complaintData.severity);
    const locObj = complaintData.location || {
      address: complaintData.address,
      latitude: complaintData.latitude,
      longitude: complaintData.longitude,
      locationSource: complaintData.locationSource,
    };
    if (locObj.latitude === undefined && complaintData.latitude !== undefined) {
      locObj.latitude = complaintData.latitude;
    }
    if (locObj.longitude === undefined && complaintData.longitude !== undefined) {
      locObj.longitude = complaintData.longitude;
    }
    formData.append('location', JSON.stringify(locObj));
    if (locObj.latitude !== null && locObj.latitude !== undefined) {
      formData.append('latitude', String(locObj.latitude));
    }
    if (locObj.longitude !== null && locObj.longitude !== undefined) {
      formData.append('longitude', String(locObj.longitude));
    }
    if (complaintData.department) formData.append('department', complaintData.department);
    if (complaintData.reportedBy) formData.append('reportedBy', complaintData.reportedBy);
    if (complaintData.verificationToken) formData.append('verificationToken', complaintData.verificationToken);
    if (complaintData.phone) formData.append('phone', complaintData.phone);
    if (complaintData.locationSource) formData.append('locationSource', complaintData.locationSource);
    formData.append('image', imageFile);

    requestHeaders['Content-Type'] = 'multipart/form-data';

    const response = await apiClient.post('/complaints', formData, {
      headers: requestHeaders,
    });
    return response.data;
  }

  const response = await apiClient.post('/complaints', complaintData, {
    headers: requestHeaders,
  });
  return response.data;
};

/**
 * Update complaint status with audit logging
 * @param {string} id - Complaint ID
 * @param {{ status: string, note?: string, changedBy?: string }} updateData
 * @returns {Promise<Object>}
 */
export const updateComplaintStatus = async (id, updateData) => {
  const response = await apiClient.patch(`/complaints/${encodeURIComponent(id)}/status`, updateData);
  return response.data;
};

/**
 * Fetch operational dashboard metrics and distributions
 * @returns {Promise<Object>}
 */
export const getComplaintStats = async () => {
  const response = await apiClient.get('/complaints/stats');
  return response.data;
};

/**
 * Manually trigger or retry Gemini AI analysis for a complaint
 * @param {string} id - Complaint ID
 * @returns {Promise<Object>}
 */
export const triggerAiAnalysis = async (id) => {
  const response = await apiClient.post(`/complaints/${encodeURIComponent(id)}/analyze`);
  return response.data;
};

/**
 * Optional AI description enhancement for speech-to-text dictation
 * @param {string} text - Dictated or typed text
 * @param {string} [category] - Optional category context
 * @returns {Promise<Object>}
 */
export const enhanceDescriptionWithAi = async (text, category = '') => {
  const response = await apiClient.post('/complaints/enhance-description', {
    text,
    category,
  });
  return response.data;
};

// ==========================================
// PHASE 4 & 5: MASTER ISSUES & OPERATIONS
// ==========================================

/**
 * Retrieve master issues with pagination, search, status, and category filtering
 * @param {Object} params - { category, status, priorityLevel, department, search, sortBy, page, limit }
 * @returns {Promise<Object>}
 */
export const getMasterIssues = async (params = {}) => {
  const response = await apiClient.get('/master-issues', { params });
  return response.data;
};

/**
 * Retrieve single master issue with all linked citizen reports
 * @param {string} id - MasterIssue ID
 * @returns {Promise<Object>}
 */
export const getMasterIssueById = async (id) => {
  const citizenId = getClientCitizenId();
  const response = await apiClient.get(`/master-issues/${encodeURIComponent(id)}`, {
    headers: { 'x-citizen-id': citizenId },
  });
  return response.data;
};

/**
 * Citizen "I am also affected" endorsement
 * @param {string} id - MasterIssue ID
 * @returns {Promise<Object>}
 */
export const supportMasterIssue = async (id) => {
  const citizenId = getClientCitizenId();
  const response = await apiClient.post(
    `/master-issues/${encodeURIComponent(id)}/support`,
    { citizenId },
    { headers: { 'x-citizen-id': citizenId } }
  );
  return response.data;
};

/**
 * Retrieve geographical hotspot clusters with frequency and trends
 * @param {Object} params - { radius, days }
 * @returns {Promise<Object>}
 */
export const getCivicHotspots = async (params = {}) => {
  const response = await apiClient.get('/master-issues/hotspots', { params });
  return response.data;
};

/**
 * Retrieve priority and severity summary distribution
 * @returns {Promise<Object>}
 */
export const getPrioritySummary = async () => {
  const response = await apiClient.get('/master-issues/priority/summary');
  return response.data;
};

/**
 * Update Master Issue status and cascade to linked complaints
 * @param {string} id - Master Issue ID
 * @param {{ status: string, note?: string, rejectionReason?: string, changedBy?: string }} updateData
 * @returns {Promise<Object>}
 */
export const updateMasterIssueStatus = async (id, updateData) => {
  const response = await apiClient.patch(`/master-issues/${encodeURIComponent(id)}/status`, updateData);
  return response.data;
};

/**
 * Assign Master Issue to a Department, Officer, and establish SLA deadline
 * @param {string} id - Master Issue ID
 * @param {{ department: string, officerId?: string, customDeadlineHours?: number, assignedBy?: string }} assignData
 * @returns {Promise<Object>}
 */
export const assignMasterIssue = async (id, assignData) => {
  const response = await apiClient.patch(`/master-issues/${encodeURIComponent(id)}/assign`, assignData);
  return response.data;
};

/**
 * Add an internal authority note (confidential from citizens)
 * @param {string} id - Master Issue ID
 * @param {{ note: string, author?: string }} noteData
 * @returns {Promise<Object>}
 */
export const addMasterIssueNote = async (id, noteData) => {
  const response = await apiClient.post(`/master-issues/${encodeURIComponent(id)}/notes`, noteData);
  return response.data;
};

/**
 * Upload resolution evidence photographs and completion work description
 * @param {string} id - Master Issue ID
 * @param {FormData} formData - Contains 'evidence' files, 'description', and 'uploadedBy'
 * @returns {Promise<Object>}
 */
export const uploadResolutionEvidence = async (id, formData) => {
  const response = await apiClient.post(
    `/master-issues/${encodeURIComponent(id)}/resolution-evidence`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data;
};

/**
 * Citizen resolution verification ("Confirmed" or "Disputed")
 * @param {string} id - Master Issue ID
 * @param {{ response: 'Confirmed' | 'Disputed', comment?: string }} verificationData
 * @returns {Promise<Object>}
 */
export const verifyMasterIssueResolution = async (id, verificationData) => {
  const citizenId = getClientCitizenId();
  const response = await apiClient.post(
    `/master-issues/${encodeURIComponent(id)}/verify`,
    verificationData,
    {
      headers: { 'x-citizen-id': citizenId },
    }
  );
  return response.data;
};

/**
 * Request on-demand Gemini AI Before-and-After comparative assessment
 * @param {string} id - Master Issue ID
 * @returns {Promise<Object>}
 */
export const assessMasterIssueResolution = async (id) => {
  const response = await apiClient.post(`/master-issues/${encodeURIComponent(id)}/assess-resolution`);
  return response.data;
};

/**
 * Retrieve chronological activity timeline for a master issue
 * @param {string} id - Master Issue ID
 * @param {boolean} isCitizen - If true, strips confidential internal notes
 * @returns {Promise<Object>}
 */
export const getMasterIssueActivity = async (id, isCitizen = false) => {
  const response = await apiClient.get(`/master-issues/${encodeURIComponent(id)}/activity`, {
    params: { isCitizen: isCitizen ? 'true' : 'false' },
  });
  return response.data;
};

/**
 * Retrieve comprehensive authority operations and SLA analytics
 * @returns {Promise<Object>}
 */
export const getAuthorityAnalytics = async () => {
  const response = await apiClient.get('/master-issues/analytics');
  return response.data;
};

/**
 * Retrieve directory of departments and demo officers
 * @param {string} [department] - Optional filter
 * @returns {Promise<Object>}
 */
export const getDemoOfficers = async (department = '') => {
  const response = await apiClient.get('/master-issues/officers', {
    params: department ? { department } : {},
  });
  return response.data;
};

/**
 * Resolve potential duplicate (Authority action: Confirm or Dismiss)
 * @param {string} masterIssueId
 * @param {string} complaintId
 * @param {'Confirm' | 'Dismiss'} action
 * @returns {Promise<Object>}
 */
export const resolvePotentialDuplicate = async (masterIssueId, complaintId, action) => {
  const response = await apiClient.post(`/master-issues/${encodeURIComponent(masterIssueId)}/resolve-duplicate`, {
    complaintId,
    action,
    reviewer: 'Municipal Command Console',
  });
  return response.data;
};

/**
 * Retrieve duplicate information and sister complaints for a specific complaint
 * @param {string} id - Complaint ID
 * @returns {Promise<Object>}
 */
export const getComplaintDuplicates = async (id) => {
  const response = await apiClient.get(`/complaints/${encodeURIComponent(id)}/duplicates`);
  return response.data;
};

// ==========================================
// PHASE 6: PUBLIC TRANSPARENCY & CIVIC IMPACT
// ==========================================

/**
 * Retrieve high-level transparency overview metrics
 * @param {Object} params - { timeRange, startDate, endDate, category, department, zone }
 * @returns {Promise<Object>}
 */
export const getTransparencyOverview = async (params = {}) => {
  const response = await apiClient.get('/transparency/overview', { params });
  return response.data;
};

/**
 * Retrieve civic trends, velocity, recurring issues, and hotspots
 * @param {Object} params - { timeRange, startDate, endDate, category, department, zone }
 * @returns {Promise<Object>}
 */
export const getCivicTrends = async (params = {}) => {
  const response = await apiClient.get('/transparency/trends', { params });
  return response.data;
};

/**
 * Retrieve departmental resolution and SLA compliance metrics
 * @param {Object} params - { timeRange, startDate, endDate, category, department, zone }
 * @returns {Promise<Object>}
 */
export const getDepartmentPerformance = async (params = {}) => {
  const response = await apiClient.get('/transparency/departments', { params });
  return response.data;
};

/**
 * Retrieve algorithmic civic impact and resource allocation recommendations
 * @param {Object} params - { timeRange, startDate, endDate, category, department, zone }
 * @returns {Promise<Object>}
 */
export const getCivicImpactRecommendations = async (params = {}) => {
  const response = await apiClient.get('/transparency/recommendations', { params });
  return response.data;
};

/**
 * Retrieve public-safe master issues for public browsing and transparency
 * @param {Object} params - { page, limit, status, category, department, zone, priority, search, sortBy }
 * @returns {Promise<Object>}
 */
export const getPublicMasterIssues = async (params = {}) => {
  const response = await apiClient.get('/transparency/issues', { params });
  return response.data;
};

/**
 * Retrieve public-safe audit timeline for a specific master issue
 * @param {string} id - Master issue ID
 * @returns {Promise<Object>}
 */
export const getPublicIssueTimeline = async (id) => {
  const response = await apiClient.get(`/transparency/issues/${encodeURIComponent(id)}/timeline`);
  return response.data;
};

/**
 * Construct URL for downloading the Civic Impact PDF report
 * @param {Object} params - { timeRange, startDate, endDate, category, department, zone }
 * @returns {string}
 */
export const getImpactReportPdfUrl = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '' && val !== 'All') {
      query.append(key, val);
    }
  });
  const queryString = query.toString();
  const base = '/api/transparency/reports/impact-pdf';
  return queryString ? `${base}?${queryString}` : base;
};

/**
 * Trigger immediate client-side download of Civic Impact PDF report
 * @param {Object} params
 */
export const downloadImpactReportPdf = async (params = {}) => {
  const response = await apiClient.get('/transparency/reports/impact-pdf', {
    params: { ...params, download: 'true' },
    responseType: 'blob',
  });
  const blob = new Blob([response.data], { type: 'application/pdf' });
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = `CivicPulse_Impact_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 5000);
  return true;
};

// ==========================================
// AUTHORITY AUTHENTICATION & SECURITY
// ==========================================

/**
 * Authenticate Authority Personnel
 * @param {Object} credentials - { authorityId, password }
 * @returns {Promise<Object>}
 */
export const loginAuthority = async ({ authorityId, password }) => {
  const response = await apiClient.post('/auth/authority/login', { authorityId, password });
  if (response.data.token) {
    localStorage.setItem('civicpulse_token', response.data.token);
    localStorage.setItem('civicpulse_authority_user', JSON.stringify(response.data.user));
  }
  return response.data;
};

/**
 * Get Authenticated Authority User Profile
 * @returns {Promise<Object>}
 */
export const getAuthorityProfile = async () => {
  const response = await apiClient.get('/auth/authority/me');
  return response.data;
};

/**
 * Terminate Authority Session
 */
export const logoutAuthority = async () => {
  try {
    await apiClient.post('/auth/authority/logout');
  } catch (e) {
    console.warn('Logout notification error:', e.message);
  } finally {
    localStorage.removeItem('civicpulse_token');
    localStorage.removeItem('civicpulse_authority_user');
  }
};

// ==========================================
// MANDATORY CITIZEN VERIFICATION (CAPTCHA & OTP)
// ==========================================

/**
 * Request Mobile OTP with mandatory CAPTCHA token
 * @param {Object} payload - { phone, captchaToken }
 * @returns {Promise<Object>}
 */
export const requestMobileOtp = async ({ phone, captchaToken }) => {
  const response = await apiClient.post('/verification/request-otp', { phone, captchaToken });
  return response.data;
};

/**
 * Confirm Mobile OTP and obtain single-use verificationToken
 * @param {Object} payload - { phone, otp }
 * @returns {Promise<Object>}
 */
export const verifyMobileOtp = async ({ phone, otp }) => {
  const response = await apiClient.post('/verification/verify-otp', { phone, otp });
  return response.data;
};

/**
 * Secure Citizen Complaint Tracking with trackingToken
 * @param {string} complaintId
 * @param {string} trackingToken
 * @returns {Promise<Object>}
 */
export const trackComplaintSecurely = async (complaintId, trackingToken) => {
  const response = await apiClient.get(`/complaints/track/${encodeURIComponent(complaintId)}`, {
    params: { token: trackingToken },
  });
  return response.data;
};

// ==========================================
// GEOLOCATION & GEOCODING SERVICES
// ==========================================

/**
 * Search locations and landmarks using OpenStreetMap Nominatim restricted to India
 * @param {string} query
 * @returns {Promise<Array>}
 */
export const searchGeocoding = async (query) => {
  if (!query || query.trim().length < 3) return [];
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=in&limit=6&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'en',
        },
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data || []).filter((item) => {
      const lat = Number(item.lat);
      const lon = Number(item.lon);
      return !isNaN(lat) && !isNaN(lon) && lat >= 6.0 && lat <= 38.0 && lon >= 68.0 && lon <= 98.0;
    });
  } catch (err) {
    console.warn('Geocoding search failed:', err.message);
    return [];
  }
};

/**
 * Reverse geocode latitude and longitude to street address
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<string|null>}
 */
export const reverseGeocodeCoordinates = async (lat, lon) => {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'en',
        },
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.display_name || null;
  } catch (err) {
    console.warn('Reverse geocoding failed:', err.message);
    return null;
  }
};

// ==========================================
// CITIZEN AUTHENTICATION & DASHBOARD SERVICES
// ==========================================

/**
 * Register a new Citizen Account
 * @param {Object} userData - { name, email, phone, password, confirmPassword }
 */
export const registerCitizen = async (userData) => {
  const response = await apiClient.post('/citizen/auth/register', userData);
  if (response.data.token) {
    localStorage.setItem('civicpulse_citizen_token', response.data.token);
    localStorage.setItem('civicpulse_citizen_user', JSON.stringify(response.data.user));
  }
  return response.data;
};

/**
 * Log in Citizen Account
 * @param {Object} credentials - { identifier, password }
 */
export const loginCitizen = async (credentials) => {
  const response = await apiClient.post('/citizen/auth/login', credentials);
  if (response.data.token) {
    localStorage.setItem('civicpulse_citizen_token', response.data.token);
    localStorage.setItem('civicpulse_citizen_user', JSON.stringify(response.data.user));
  }
  return response.data;
};

/**
 * Log out Citizen Account
 */
export const logoutCitizen = () => {
  localStorage.removeItem('civicpulse_citizen_token');
  localStorage.removeItem('civicpulse_citizen_user');
};

/**
 * Get Authenticated Citizen Profile
 */
export const getCitizenProfile = async () => {
  const response = await apiClient.get('/citizen/auth/me');
  return response.data;
};

/**
 * Update Citizen Profile (Name, Phone)
 */
export const updateCitizenProfile = async (profileData) => {
  const response = await apiClient.put('/citizen/auth/profile', profileData);
  if (response.data.user) {
    localStorage.setItem('civicpulse_citizen_user', JSON.stringify(response.data.user));
  }
  return response.data;
};

/**
 * Change Citizen Password
 */
export const changeCitizenPassword = async (passwords) => {
  const response = await apiClient.put('/citizen/auth/change-password', passwords);
  return response.data;
};

/**
 * Forgot Password Notice
 */
export const forgotCitizenPassword = async (identifier) => {
  const response = await apiClient.post('/citizen/auth/forgot-password', { identifier });
  return response.data;
};

/**
 * Get Citizen Personal Dashboard Overview
 */
export const getCitizenDashboardOverview = async () => {
  const response = await apiClient.get('/citizen/dashboard/overview');
  return response.data;
};

/**
 * Get All Personal Complaints for Citizen
 */
export const getMyComplaints = async (params = {}) => {
  const response = await apiClient.get('/citizen/dashboard/complaints', { params });
  return response.data;
};

/**
 * Claim a Guest Complaint using Complaint ID & Tracking Token
 */
export const claimGuestComplaint = async (complaintId, trackingToken) => {
  const response = await apiClient.post('/citizen/dashboard/claim-complaint', {
    complaintId,
    trackingToken,
  });
  return response.data;
};

/**
 * Get Followed Master Issues
 */
export const getFollowedMasterIssues = async () => {
  const response = await apiClient.get('/citizen/dashboard/followed-issues');
  return response.data;
};

/**
 * Follow or Unfollow a Master Issue
 */
export const toggleFollowMasterIssue = async (masterIssueId) => {
  const response = await apiClient.post('/citizen/dashboard/follow-issue', { masterIssueId });
  return response.data;
};

/**
 * Get Citizen In-App Notifications
 */
export const getCitizenNotifications = async () => {
  const response = await apiClient.get('/citizen/dashboard/notifications');
  return response.data;
};

/**
 * Mark a Notification as Read
 */
export const markNotificationRead = async (notificationId) => {
  const response = await apiClient.patch(`/citizen/dashboard/notifications/${notificationId}/read`);
  return response.data;
};

/**
 * Mark All Notifications as Read
 */
export const markAllNotificationsRead = async () => {
  const response = await apiClient.post('/citizen/dashboard/notifications/read-all');
  return response.data;
};


