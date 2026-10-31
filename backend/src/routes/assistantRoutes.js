import { Router } from 'express';
import {
  handleChatMessage,
  getConversationHistory,
  clearConversationHistory,
} from '../controllers/assistantController.js';

const router = Router();

// Process conversational turn with Civic Assistant
router.post('/chat', handleChatMessage);

// Retrieve multi-turn conversation history
router.get('/history/:conversationId', getConversationHistory);

// Reset or clear conversation
router.delete('/history/:conversationId', clearConversationHistory);

export default router;
