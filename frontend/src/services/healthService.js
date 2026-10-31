import apiClient from './api';

/**
 * Fetch backend health status
 * @returns {Promise<Object>}
 */
export const checkHealth = async () => {
  const response = await apiClient.get('/health');
  return response.data;
};
