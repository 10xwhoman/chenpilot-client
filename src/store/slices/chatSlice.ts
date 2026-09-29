import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { ChatMessage, AgentQueryRequest, Conversation, ThreadState } from '@/types';
import { AgentQueryResponse } from '@/types/agent';
import { VOICE_MESSAGE } from '@/constants';
import apiService from '@/services/api';

// ─── Voice message payload ────────────────────────────────────────────────────
export interface SendVoiceMessagePayload {
  audioUrl: string;
  duration: number;
  mimeType: string;
  transcript: string;
  sizeBytes: number;
}

interface ChatState {
  messages: ChatMessage[];
  conversations: Conversation[];
  currentConversation: Conversation | null;
  isLoading: boolean;
  error: string | null;
  isTyping: boolean;
  agentStatus: {
    isConnected: boolean;
    lastHealthCheck: string | null;
    capabilities: any;
  };
  chatHistory: { [conversationId: string]: ChatMessage[] };
  /** The currently open thread, or null when no thread panel is shown */
  activeThread: ThreadState | null;
}

const initialState: ChatState = {
  messages: [],
  conversations: [],
  currentConversation: null,
  isLoading: false,
  error: null,
  isTyping: false,
  agentStatus: {
    isConnected: false,
    lastHealthCheck: null,
    capabilities: null,
  },
  chatHistory: {},
  activeThread: null,
};

// Async thunks
// Removed server-side conversation thunks - now handled client-side

export const getOrCreateActiveConversation = createAsyncThunk(
  'chat/getOrCreateActiveConversation',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as any;
      const currentConversation = state.chat.currentConversation;
      
      // If we already have an active conversation, return it
      if (currentConversation) {
        return currentConversation;
      }
      
      // Create a new conversation locally
      const newConversation: Conversation = {
        id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: 'New Chat',
        description: 'A new conversation',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: state.auth.user?.id || 'anonymous',
        messageCount: 0
      };
      
      return newConversation;
    } catch (error: any) {
      return rejectWithValue('Failed to create conversation');
    }
  }
);

export const sendMessage = createAsyncThunk(
  'chat/sendMessage',
  async (query: string, { getState, rejectWithValue }) => {
    const state = getState() as any;
    
    // Concurrency guard: prevent multiple simultaneous queries
    if (state.chat.isLoading || state.chat.isTyping) {
      return rejectWithValue('A query is already in progress');
    }

    try {
      const userId = state.auth.user?.id;
      const currentConversation = state.chat.currentConversation;
      
      if (!userId) {
        return rejectWithValue('User not authenticated');
      }

      // Get or create active conversation locally
      let conversation = currentConversation;
      if (!conversation) {
        // Create a new conversation locally
        conversation = {
          id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: 'New Chat',
          description: 'A new conversation',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          userId: userId,
          messageCount: 0
        };
      }

      // Save user message locally (no server call needed)
      const userMessage: ChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'user',
        content: query,
        timestamp: new Date().toISOString(),
      };

      // Call the API service to get actual response
      const response = await apiService.queryAgent({ userId, query });
      
      // Handle parsing of the agent response
      let content = response.result.data;
      
      // If the response data is a string that looks like JSON, try to parse it
      if (typeof content === 'string' && (content.trim().startsWith('{') || content.trim().startsWith('['))) {
        try {
          const parsed = JSON.parse(content);
          // If successfully parsed and it's an object/array, we might want to 
          // extract a 'message' field if it exists, or just keep it as structured data
          if (parsed && typeof parsed === 'object') {
            // If it has a specific 'message' or 'text' field, we might use that for display
            // but for now we keep the whole object as metadata or stringify it for content
            console.log('[ChatSlice] Structured agent response:', parsed);
          }
        } catch (e) {
          // Not valid JSON or parsing failed, keep as string
          console.log('[ChatSlice] Response is not valid JSON, keeping as string');
        }
      }

      // Create agent message with execution trace if available
      const agentMessage: ChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'agent',
        content: content,
        timestamp: new Date().toISOString(),
        metadata: {
          success: response.result.success,
          error: response.result.error,
          executionTrace: response.result.executionTrace,
          // Store raw structured data in metadata if it was JSON
          rawData: typeof content !== 'string' ? content : undefined
        }
      };

      return { response, conversation, userMessage, agentMessage };
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || 'Failed to send message';
      return rejectWithValue(errorMsg);
    }
  }
);

// ─── sendVoiceMessage thunk ───────────────────────────────────────────────────

export const sendVoiceMessage = createAsyncThunk(
  'chat/sendVoiceMessage',
  async (payload: SendVoiceMessagePayload, { getState, rejectWithValue }) => {
    const state = getState() as any;

    if (state.chat.isLoading || state.chat.isTyping) {
      return rejectWithValue('A message is already in progress');
    }

    const userId = state.auth.user?.id;
    if (!userId) {
      return rejectWithValue('User not authenticated');
    }

    // Storage guard — warn if total voice data in history is getting large
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('chat_history') || '';
      if (stored.length > VOICE_MESSAGE.STORAGE_WARN_BYTES) {
        console.warn('[sendVoiceMessage] chat_history localStorage is large; consider pruning old voice messages');
      }
    }

    let conversation = state.chat.currentConversation;
    if (!conversation) {
      conversation = {
        id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: 'New Chat',
        description: 'A new conversation',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId,
        messageCount: 0,
      };
    }

    // Display text is the transcript (or a placeholder)
    const displayText = payload.transcript
      ? `🎙 *Voice message* — "${payload.transcript}"`
      : '🎙 *Voice message*';

    const voiceMessage: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'user',
      messageType: 'voice',
      content: displayText,
      timestamp: new Date().toISOString(),
      voice: {
        audioUrl: payload.audioUrl,
        duration: payload.duration,
        mimeType: payload.mimeType,
        transcript: payload.transcript,
        sizeBytes: payload.sizeBytes,
      },
    };

    // If there is a transcript, forward it to the agent as a regular text query
    let agentMessage: ChatMessage | null = null;
    if (payload.transcript.trim()) {
      try {
        const response = await apiService.queryAgent({ userId, query: payload.transcript });
        let content = response.result.data;
        try {
          const parsed = JSON.parse(content);
          if (parsed && typeof parsed === 'object') content = parsed;
        } catch { /* not JSON */ }

        agentMessage = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'agent',
          content,
          timestamp: new Date().toISOString(),
          metadata: {
            success: response.result.success,
            error: response.result.error,
            executionTrace: response.result.executionTrace,
          },
        };
      } catch {
        // Non-fatal — voice message is still stored even if agent call fails
      }
    }

    return { conversation, voiceMessage, agentMessage };
  },
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    addMessage: (state, action: PayloadAction<ChatMessage>) => {
      state.messages.push(action.payload);
    },
    addUserMessage: (state, action: PayloadAction<string>) => {
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'user',
        content: action.payload,
        timestamp: new Date().toISOString(),
      };
      state.messages.push(userMessage);
    },
    addSystemMessage: (state, action: PayloadAction<{ content: string; metadata?: any }>) => {
      const systemMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'system',
        content: action.payload.content,
        timestamp: new Date().toISOString(),
        metadata: action.payload.metadata,
      };
      state.messages.push(systemMessage);
    },
    clearMessages: (state) => {
      state.messages = [];
    },
    setMessages: (state, action: PayloadAction<ChatMessage[]>) => {
      state.messages = action.payload;
    },
    setConversations: (state, action: PayloadAction<Conversation[]>) => {
      state.conversations = action.payload;
    },
    setCurrentConversation: (state, action: PayloadAction<Conversation | null>) => {
      state.currentConversation = action.payload;
    },
    setTyping: (state, action: PayloadAction<boolean>) => {
      state.isTyping = action.payload;
    },
    updateMessage: (state, action: PayloadAction<{ id: string; updates: Partial<ChatMessage> }>) => {
      const index = state.messages.findIndex(msg => msg.id === action.payload.id);
      if (index !== -1) {
        state.messages[index] = { ...state.messages[index], ...action.payload.updates };
      }
    },
    removeMessage: (state, action: PayloadAction<string>) => {
      state.messages = state.messages.filter(msg => msg.id !== action.payload);
    },
    updateAgentStatus: (state, action: PayloadAction<{ isConnected: boolean; lastHealthCheck: string | null; capabilities?: any }>) => {
      state.agentStatus = { ...state.agentStatus, ...action.payload };
    },
    setAgentConnected: (state, action: PayloadAction<boolean>) => {
      state.agentStatus.isConnected = action.payload;
    },
    startNewChat: (state) => {
      // Save current conversation messages to history
      if (state.currentConversation && state.messages.length > 0) {
        state.chatHistory[state.currentConversation.id] = [...state.messages];
      }
      // Clear current messages and conversation
      state.messages = [];
      state.currentConversation = null;
      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('chat_history', JSON.stringify(state.chatHistory));
      }
    },
    loadChatHistory: (state, action: PayloadAction<string>) => {
      const conversationId = action.payload;
      if (state.chatHistory[conversationId]) {
        state.messages = state.chatHistory[conversationId];
      } else {
        state.messages = [];
      }
    },
    saveChatHistory: (state) => {
      if (state.currentConversation && state.messages.length > 0) {
        state.chatHistory[state.currentConversation.id] = [...state.messages];
        // Save to localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem('chat_history', JSON.stringify(state.chatHistory));
        }
      }
    },
    deleteChatHistory: (state, action: PayloadAction<string>) => {
      const conversationId = action.payload;
      delete state.chatHistory[conversationId];
      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('chat_history', JSON.stringify(state.chatHistory));
      }
    },
    initializeChatHistory: (state) => {
      if (typeof window !== 'undefined') {
        const savedHistory = localStorage.getItem('chat_history');
        if (savedHistory) {
          try {
            state.chatHistory = JSON.parse(savedHistory);
          } catch (error) {
            console.error('Failed to parse chat history:', error);
            state.chatHistory = {};
          }
        }
      }
    },
    saveConversationLocally: (state, action: PayloadAction<Conversation>) => {
      const conversation = action.payload;
      state.conversations.unshift(conversation);
      
      // Save to localStorage
      if (typeof window !== 'undefined') {
        const conversations = JSON.parse(localStorage.getItem('conversations') || '[]');
        conversations.unshift(conversation);
        localStorage.setItem('conversations', JSON.stringify(conversations));
      }
    },
    loadConversationsLocally: (state) => {
      if (typeof window !== 'undefined') {
        const conversations = JSON.parse(localStorage.getItem('conversations') || '[]');
        state.conversations = conversations;
      }
    },
    deleteConversationLocally: (state, action: PayloadAction<string>) => {
      const conversationId = action.payload;
      state.conversations = state.conversations.filter(conv => conv.id !== conversationId);
      delete state.chatHistory[conversationId];
      
      // Update localStorage
      if (typeof window !== 'undefined') {
        const conversations = JSON.parse(localStorage.getItem('conversations') || '[]');
        const updatedConversations = conversations.filter((conv: Conversation) => conv.id !== conversationId);
        localStorage.setItem('conversations', JSON.stringify(updatedConversations));
        
        const chatHistory = JSON.parse(localStorage.getItem('chat_history') || '{}');
        delete chatHistory[conversationId];
        localStorage.setItem('chat_history', JSON.stringify(chatHistory));
      }
    },

    // ── Thread reducers ────────────────────────────────────────────────────────

    /** Open (or switch to) the thread for a given root message. */
    openThread: (state, action: PayloadAction<string>) => {
      const rootId = action.payload;
      // Collect existing replies from state.messages
      const replies = state.messages.filter(
        (m) => m.threadId === rootId && m.parentId !== undefined,
      );
      state.activeThread = { rootMessageId: rootId, replies, isTyping: false };
    },

    /** Close the thread panel. */
    closeThread: (state) => {
      state.activeThread = null;
    },

    /** Add a reply message to the active thread and increment root's replyCount. */
    addReply: (state, action: PayloadAction<ChatMessage>) => {
      const reply = action.payload;
      // Push into main messages list so it's persisted
      state.messages.push(reply);

      // Update the root message's replyCount
      const rootIdx = state.messages.findIndex((m) => m.id === reply.threadId);
      if (rootIdx !== -1) {
        state.messages[rootIdx] = {
          ...state.messages[rootIdx],
          replyCount: (state.messages[rootIdx].replyCount ?? 0) + 1,
        };
      }

      // Reflect in the live thread panel if it's open for this thread
      if (state.activeThread && state.activeThread.rootMessageId === reply.threadId) {
        state.activeThread.replies.push(reply);
      }

      // Persist
      if (state.currentConversation && typeof window !== 'undefined') {
        state.chatHistory[state.currentConversation.id] = [...state.messages];
        localStorage.setItem('chat_history', JSON.stringify(state.chatHistory));
      }
    },

    /** Toggle the typing indicator inside the thread panel. */
    setThreadTyping: (state, action: PayloadAction<boolean>) => {
      if (state.activeThread) {
        state.activeThread.isTyping = action.payload;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Removed server conversation extraReducers - now handled client-side
      
      // Get or Create Active Conversation
      .addCase(getOrCreateActiveConversation.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getOrCreateActiveConversation.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentConversation = action.payload;
        state.messages = action.payload.messages || [];
        state.error = null;
      })
      .addCase(getOrCreateActiveConversation.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Send Message
      .addCase(sendMessage.pending, (state) => {
        state.isLoading = true;
        state.isTyping = true;
        state.error = null;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isTyping = false;
        state.currentConversation = action.payload.conversation;
        
        // Debug logging to see what the server is returning
        console.log('[ChatSlice] Full response:', action.payload.response);
        console.log('[ChatSlice] Response result:', action.payload.response.result);
        console.log('[ChatSlice] Response data:', action.payload.response.result.data);
        
        // Handle different response formats
        let content = action.payload.response.result.data;
        
        // If the response data is an object with structured data, use it directly
        if (typeof content === 'object' && content !== null) {
          // The content is already structured, use it as is
          console.log('[ChatSlice] Using structured content:', content);
        } else if (typeof content === 'string') {
          // Try to parse if it's a JSON string
          try {
            const parsed = JSON.parse(content);
            if (typeof parsed === 'object' && parsed !== null) {
              content = parsed;
              console.log('[ChatSlice] Parsed JSON content:', content);
            }
          } catch (e) {
            // Not JSON, use as string
            console.log('[ChatSlice] Using string content:', content);
          }
        }
        
        // Add both user and agent messages from the payload
        if (action.payload.userMessage) {
          state.messages.push(action.payload.userMessage);
        }
        
        if (action.payload.agentMessage) {
          state.messages.push(action.payload.agentMessage);
        }
        
        // Save chat history after each message
        if (state.currentConversation) {
          state.chatHistory[state.currentConversation.id] = [...state.messages];
          if (typeof window !== 'undefined') {
            localStorage.setItem('chat_history', JSON.stringify(state.chatHistory));
          }
        }
        
        state.error = null;
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.isLoading = false;
        state.isTyping = false;
        state.error = action.payload as string;
        
        // Add error message with friendly content
        const errorContent = action.payload instanceof Error 
          ? action.payload.message 
          : String(action.payload);
        
        // Convert technical error messages to user-friendly ones
        let friendlyMessage = errorContent;
        if (errorContent.includes('invalid query')) {
          friendlyMessage = "I didn't understand that. Could you please rephrase your question?";
        } else if (errorContent.includes('Failed to send message')) {
          friendlyMessage = "I'm having trouble processing your request. Please try again.";
        } else if (errorContent.includes('User not authenticated')) {
          friendlyMessage = "Please log in to continue the conversation.";
        }
        
        const errorMessage: ChatMessage = {
          id: Date.now().toString(),
          type: 'agent',
          content: friendlyMessage,
          timestamp: new Date().toISOString(),
          metadata: {
            success: false,
            type: 'error',
          },
        };
        state.messages.push(errorMessage);
      })

      // ── sendVoiceMessage ───────────────────────────────────────────────────
      .addCase(sendVoiceMessage.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(sendVoiceMessage.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentConversation = action.payload.conversation;

        state.messages.push(action.payload.voiceMessage);

        if (action.payload.agentMessage) {
          state.messages.push(action.payload.agentMessage);
        }

        if (state.currentConversation) {
          state.chatHistory[state.currentConversation.id] = [...state.messages];
          if (typeof window !== 'undefined') {
            localStorage.setItem('chat_history', JSON.stringify(state.chatHistory));
          }
        }

        state.error = null;
      })
      .addCase(sendVoiceMessage.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const {
  clearError,
  addMessage,
  addUserMessage,
  addSystemMessage,
  clearMessages,
  setMessages,
  setConversations,
  setCurrentConversation,
  setTyping,
  updateMessage,
  removeMessage,
  updateAgentStatus,
  setAgentConnected,
  startNewChat,
  loadChatHistory,
  saveChatHistory,
  deleteChatHistory,
  initializeChatHistory,
  saveConversationLocally,
  loadConversationsLocally,
  deleteConversationLocally,
  openThread,
  closeThread,
  addReply,
  setThreadTyping,
} = chatSlice.actions;
export default chatSlice.reducer;
