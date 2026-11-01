import axios from 'axios';

// Dynamically resolve API URL matching current browser environment
const resolveBaseUrl = () => {
  const isBrowser = typeof window !== 'undefined';
  const isLocalHost = isBrowser && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '[::1]'
  );

  const envUrl = import.meta.env.VITE_API_BASE_URL;

  // 1. When running in a deployed browser environment (e.g., Vercel, Netlify, custom domain)
  if (isBrowser && !isLocalHost) {
    // If an explicit secure HTTPS API base URL is provided and not pointing to localhost, use it
    if (envUrl && envUrl.trim().startsWith('https://') && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
      let cleanUrl = envUrl.trim().replace(/\/+$/, '');
      if (!cleanUrl.endsWith('/api')) {
        cleanUrl = `${cleanUrl}/api`;
      }
      return cleanUrl;
    }
    // Fallback to live production Render backend to avoid mixed-content blocks or broken localhost requests
    return 'https://nagarmitra-tela.onrender.com/api';
  }

  // 2. When running in local development (localhost / 127.0.0.1)
  if (envUrl && envUrl.trim() !== '') {
    let cleanUrl = envUrl.trim().replace(/\/+$/, '');
    if (isBrowser && cleanUrl.startsWith('http')) {
      if (window.location.hostname === '127.0.0.1') {
        cleanUrl = cleanUrl.replace('localhost', '127.0.0.1');
      } else if (window.location.hostname === 'localhost') {
        cleanUrl = cleanUrl.replace('127.0.0.1', 'localhost');
      }
    }
    if (cleanUrl.startsWith('http') && !cleanUrl.endsWith('/api')) {
      cleanUrl = `${cleanUrl}/api`;
    }
    return cleanUrl;
  }

  // Default to relative /api (handled by Vite dev proxy in local dev)
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
  timeout: 45000,
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
