import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: () => `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`,
    },
    sender: {
      type: String,
      enum: ['user', 'assistant', 'system'],
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    toolCalls: {
      type: Array,
      default: [],
    },
    toolResults: {
      type: Array,
      default: [],
    },
    draftComplaint: {
      type: Object,
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const assistantConversationSchema = new mongoose.Schema(
  {
    conversationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    roleContext: {
      type: String,
      enum: ['guest', 'citizen', 'authority'],
      default: 'guest',
      index: true,
    },
    userId: {
      type: String,
      default: null,
      index: true,
    },
    userEmail: {
      type: String,
      default: null,
    },
    userName: {
      type: String,
      default: null,
    },
    messages: {
      type: [messageSchema],
      default: [],
    },
    metadata: {
      type: Map,
      of: String,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Index for query performance on user conversations
assistantConversationSchema.index({ userId: 1, updatedAt: -1 });

const AssistantConversation = mongoose.model('AssistantConversation', assistantConversationSchema);

export default AssistantConversation;
