import AssistantConversation from '../models/AssistantConversation.js';
import { resolveCallerContext } from '../services/assistant/assistantPermissions.js';
import { runAssistantTurn } from '../services/assistant/geminiAssistantService.js';
import crypto from 'crypto';

/**
 * Controller: Process chat interaction with the Civic Assistant
 * POST /api/assistant/chat
 */
export const handleChatMessage = async (req, res) => {
  try {
    const { message, conversationId, history } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'A valid message string is required.',
      });
    }

    if (message.length > 2000) {
      return res.status(400).json({
        success: false,
        message: 'Message exceeds the maximum limit of 2,000 characters.',
      });
    }

    // Resolve caller session context (Guest, Citizen, or Authority)
    const context = resolveCallerContext(req);

    // Ensure or generate conversation ID
    const activeConversationId = conversationId && typeof conversationId === 'string' && conversationId.trim()
      ? conversationId.trim()
      : `conv_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    // Retrieve or instantiate conversation record
    let conversation = await AssistantConversation.findOne({ conversationId: activeConversationId });
    if (!conversation) {
      conversation = new AssistantConversation({
        conversationId: activeConversationId,
        roleContext: context.roleContext,
        userId: context.user?.id || null,
        userEmail: context.user?.email || null,
        userName: context.user?.name || null,
        messages: [],
      });
    } else {
      // Refresh identity in case user logged in mid-session
      if (context.roleContext !== 'guest' && conversation.roleContext === 'guest') {
        conversation.roleContext = context.roleContext;
        conversation.userId = context.user?.id || null;
        conversation.userEmail = context.user?.email || null;
        conversation.userName = context.user?.name || null;
      }
    }

    // Determine history to pass (combine passed history or stored DB history)
    const messageHistory = Array.isArray(history) && history.length > 0
      ? history
      : conversation.messages.map((m) => ({
          sender: m.sender,
          text: m.text,
        }));

    // Execute assistant turn via Gemini and tool execution engine
    const turnResult = await runAssistantTurn({
      message: message.trim(),
      history: messageHistory,
      context,
    });

    // Record user message
    conversation.messages.push({
      sender: 'user',
      text: message.trim(),
      timestamp: new Date(),
    });

    // Record assistant reply
    conversation.messages.push({
      sender: 'assistant',
      text: turnResult.reply,
      toolCalls: turnResult.toolCalls || [],
      toolResults: turnResult.toolResults || [],
      draftComplaint: turnResult.draftComplaint || null,
      timestamp: new Date(),
    });

    // Limit conversation storage to last 50 messages to keep document compact
    if (conversation.messages.length > 50) {
      conversation.messages = conversation.messages.slice(-50);
    }

    await conversation.save();

    return res.status(200).json({
      success: true,
      conversationId: activeConversationId,
      reply: turnResult.reply,
      toolCalls: turnResult.toolCalls,
      toolResults: turnResult.toolResults,
      draftComplaint: turnResult.draftComplaint,
      roleContext: context.roleContext,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('❌ [AssistantController] Error handling message:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process assistant message.',
      error: error.message,
    });
  }
};

/**
 * Controller: Get conversation message history
 * GET /api/assistant/history/:conversationId
 */
export const getConversationHistory = async (req, res) => {
  try {
    const { conversationId } = req.params;

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        message: 'Conversation ID is required.',
      });
    }

    const conversation = await AssistantConversation.findOne({ conversationId }).lean();

    if (!conversation) {
      return res.status(200).json({
        success: true,
        conversationId,
        messages: [],
        roleContext: 'guest',
      });
    }

    return res.status(200).json({
      success: true,
      conversationId: conversation.conversationId,
      roleContext: conversation.roleContext,
      messages: conversation.messages || [],
    });
  } catch (error) {
    console.error('❌ [AssistantController] Error retrieving history:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve conversation history.',
      error: error.message,
    });
  }
};

/**
 * Controller: Clear conversation messages
 * DELETE /api/assistant/history/:conversationId
 */
export const clearConversationHistory = async (req, res) => {
  try {
    const { conversationId } = req.params;

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        message: 'Conversation ID is required.',
      });
    }

    await AssistantConversation.findOneAndUpdate(
      { conversationId },
      { $set: { messages: [] } }
    );

    return res.status(200).json({
      success: true,
      message: 'Conversation cleared successfully.',
    });
  } catch (error) {
    console.error('❌ [AssistantController] Error clearing history:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to clear conversation history.',
      error: error.message,
    });
  }
};
