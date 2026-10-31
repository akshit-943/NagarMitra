import apiClient from './api';

/**
 * Service: CivicPulse AI Assistant API client
 * Strictly isolated service communicating with /api/assistant routes
 */

/**
 * Send a message to the conversational assistant
 * @param {Object} params
 * @param {string} params.message
 * @param {string} [params.conversationId]
 * @param {Array} [params.history]
 * @returns {Promise<Object>}
 */
export const sendChatMessage = async ({ message, conversationId, history = [] }) => {
  try {
    const response = await apiClient.post('/assistant/chat', {
      message,
      conversationId,
      history,
    });
    return response.data;
  } catch (error) {
    const errorMsg =
      error.response?.data?.message ||
      error.message ||
      'Failed to reach CivicPulse Assistant service.';
    throw new Error(errorMsg);
  }
};

/**
 * Retrieve message history for a conversation
 * @param {string} conversationId
 * @returns {Promise<Object>}
 */
export const fetchChatHistory = async (conversationId) => {
  try {
    const response = await apiClient.get(`/assistant/history/${conversationId}`);
    return response.data;
  } catch (error) {
    console.warn('⚠️ [AssistantService] Could not retrieve chat history:', error.message);
    return { success: false, messages: [] };
  }
};

/**
 * Clear a conversation thread
 * @param {string} conversationId
 * @returns {Promise<Object>}
 */
export const clearChatHistory = async (conversationId) => {
  try {
    const response = await apiClient.delete(`/assistant/history/${conversationId}`);
    return response.data;
  } catch (error) {
    console.warn('⚠️ [AssistantService] Could not clear chat history:', error.message);
    return { success: false };
  }
};
