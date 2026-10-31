import axios from 'axios';

// Dynamically resolve API URL matching current browser hostname to eliminate cross-origin mismatch
const resolveBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && envUrl.trim() !== '') {
    if (typeof window !== 'undefined' && envUrl.startsWith('http')) {
      if (window.location.hostname === '127.0.0.1') {
        return envUrl.replace('localhost', '127.0.0.1');
      }
      if (window.location.hostname === 'localhost') {
        return envUrl.replace('127.0.0.1', 'localhost');
      }
    }
    return envUrl;
  }
  return '/api';
};

const API_BASE_URL = resolveBaseUrl();

/**
 * Pre-configured Axios instance for CivicPulse AI API calls
 */
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request interceptor to attach JWT token when authentication is active
apiClient.interceptors.request.use(
  (config) => {
    // If Authorization header is already explicitly set, respect it
    if (config.headers?.Authorization || config.headers?.authorization) {
      return config;
    }

    const authorityToken = localStorage.getItem('civicpulse_token');
    const citizenToken = localStorage.getItem('civicpulse_citizen_token');
    const url = config.url || '';
    const method = (config.method || '').toLowerCase();

    // 1. Citizen-specific endpoints (/citizen/*)
    if (url.startsWith('/citizen') || url.includes('/citizen/')) {
      if (citizenToken) {
        config.headers.Authorization = `Bearer ${citizenToken}`;
      }
    }
    // 2. Complaint submission (/complaints POST) - Citizen token takes precedence for ownership
    else if (url.includes('/complaints') && method === 'post') {
      if (citizenToken) {
        config.headers.Authorization = `Bearer ${citizenToken}`;
      }
      // Guest submission: do not attach authority token!
    }
    // 3. Authority endpoints (/auth/authority, status changes, administrative actions)
    else if (authorityToken) {
      config.headers.Authorization = `Bearer ${authorityToken}`;
    }
    // 4. Default citizen session fallback
    else if (citizenToken) {
      config.headers.Authorization = `Bearer ${citizenToken}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for unified error formatting
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const customError = {
      message: error.response?.data?.message || error.message || 'An unexpected error occurred',
      status: error.response?.status,
      data: error.response?.data,
    };
    return Promise.reject(customError);
  }
);

export default apiClient;
