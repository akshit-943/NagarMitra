import { useState, useEffect, useCallback, useRef } from 'react';
import { sendChatMessage, fetchChatHistory, clearChatHistory } from '../services/assistantService';

const WELCOME_MESSAGE = {
  id: 'welcome-001',
  sender: 'assistant',
  text: `Hello! I am **CivicPulse Assistant**, your Gemini-powered municipal civic aide. 🏛️\n\nI can help you:\n- **Track grievances** in real-time (enter any \`CIV-XXXX\` ID)\n- **Draft a complaint** for any civic problem\n- Check **citywide resolution statistics** & department response times\n- Find **emergency & helpline numbers**\n\nHow can I help you today?`,
  toolCalls: [],
  timestamp: new Date(),
};

/**
 * Custom Hook: useCivicAssistant
 * Encapsulates assistant state, message sending, history synchronization, and error handling
 */
export function useCivicAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [roleContext, setRoleContext] = useState('guest');

  // Maintain stable conversation ID across component mounts
  const [conversationId, setConversationId] = useState(() => {
    try {
      const stored = sessionStorage.getItem('civicpulse_assistant_conv_id');
      if (stored) return stored;
      const newId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      sessionStorage.setItem('civicpulse_assistant_conv_id', newId);
      return newId;
    } catch {
      return `conv_${Date.now()}`;
    }
  });

  const [messages, setMessages] = useState([WELCOME_MESSAGE]);

  // Load existing history if available
  useEffect(() => {
    let isMounted = true;

    async function loadHistory() {
      if (!conversationId) return;
      try {
        const data = await fetchChatHistory(conversationId);
        if (isMounted && data && Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages([WELCOME_MESSAGE, ...data.messages]);
          if (data.roleContext) setRoleContext(data.roleContext);
        }
      } catch (err) {
        console.warn('⚠️ [useCivicAssistant] Could not load prior messages:', err);
      }
    }

    loadHistory();

    return () => {
      isMounted = false;
    };
  }, [conversationId]);

  // Send message
  const sendMessage = useCallback(
    async (text) => {
      if (!text || !text.trim() || isLoading) return;

      const trimmed = text.trim();
      const userMsg = {
        id: `user-${Date.now()}`,
        sender: 'user',
        text: trimmed,
        timestamp: new Date(),
      };

      // Optimistically add user message
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setError(null);

      try {
        const response = await sendChatMessage({
          message: trimmed,
          conversationId,
          history: messages.slice(-10).map((m) => ({
            sender: m.sender,
            text: m.text,
          })),
        });

        if (response && response.success) {
          const assistantMsg = {
            id: `assistant-${Date.now()}`,
            sender: 'assistant',
            text: response.reply,
            toolCalls: response.toolCalls || [],
            toolResults: response.toolResults || [],
            draftComplaint: response.draftComplaint || null,
            timestamp: new Date(response.timestamp || Date.now()),
          };

          if (response.roleContext) {
            setRoleContext(response.roleContext);
          }

          setMessages((prev) => [...prev, assistantMsg]);
        } else {
          throw new Error(response?.message || 'Failed to get a response.');
        }
      } catch (err) {
        console.error('❌ [useCivicAssistant] Error sending message:', err);
        setError(err.message);

        // Add error message into chat stream
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            sender: 'assistant',
            text: `⚠️ I encountered an issue connecting to the municipal intelligence service (${err.message}). Please try again in a moment.`,
            timestamp: new Date(),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [conversationId, isLoading, messages]
  );

  // Clear chat
  const clearChat = useCallback(async () => {
    try {
      await clearChatHistory(conversationId);
    } catch {
      // ignore
    }
    const newId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    try {
      sessionStorage.setItem('civicpulse_assistant_conv_id', newId);
    } catch {
      // ignore
    }
    setConversationId(newId);
    setMessages([WELCOME_MESSAGE]);
    setError(null);
  }, [conversationId]);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return {
    isOpen,
    setIsOpen,
    toggleOpen,
    isLoading,
    error,
    messages,
    roleContext,
    conversationId,
    sendMessage,
    clearChat,
  };
}
