import { useEffect, useReducer } from 'react';
import { MessageCircle } from 'lucide-react'
import Sidebar from './Components/Sidebar'
import ChatHeader from './Components/ChatHeader'
import MessageBubble from './Components/MessageBubble'
import ChatInput from './Components/ChatInput'
import StickyStatus from './Components/StickyStatus'
import LoginPage from './Pages/Login';
import AllChats from './Pages/AllChats';
import authService from './Library/Authentication/jwt';
import { debugAuthState } from './Library/Authentication/debug';
import { threadsApiService } from './Library/Shared/threadsApi';
import { messagesApiService, type MessageData as ApiMessageData } from './Library/Shared/messagesApi';
import { queueApiService } from './Library/Shared/queueApi';
import { getProfileImageUrl } from './Library/Shared/profileUtils';
import { useRedis } from './Library/hooks/useRedis';
import type { PubSubMessage } from './Library/redis/direct-pubsub';
import type { Thread } from './Library/Shared/threadsApi'

// The 'Chat' type is now an alias for the 'Thread' type from the API service.
export type { Thread as Chat };

// Types

// State management with useReducer
interface AppState {
  isLoggedIn: boolean;
  isLoading: boolean;
  chats: Thread[];
  selectedChat: Thread | null;
  showAllChats: boolean;
  isLoadingAllChats: boolean;
  messages: ApiMessageData[];
  isLoadingMessages: boolean;
  lastSelectedChatId: number | null;
  replyingTo: { messageId: string; userName: string; content: string } | null;
}

type AppAction =
  | { type: 'LOGIN_SUCCESS' }
  | { type: 'LOGOUT' }
  | { type: 'SET_CHATS'; payload: Thread[] }
  | { type: 'SELECT_CHAT'; payload: Thread | null }
  | { type: 'SHOW_ALL_CHATS' }
  | { type: 'HIDE_ALL_CHATS' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ALL_CHATS_LOADING'; payload: boolean }
  | { type: 'SET_MESSAGES'; payload: ApiMessageData[] }
  | { type: 'SET_MESSAGES_LOADING'; payload: boolean }
  | { type: 'ADD_MESSAGE'; payload: ApiMessageData }
  | { type: 'UPDATE_MESSAGE'; payload: { messageId: string; updates: Partial<ApiMessageData> } }
  | { type: 'DELETE_MESSAGE'; payload: string }
  | { type: 'SET_LAST_SELECTED_CHAT'; payload: number | null }
  | { type: 'SET_REPLYING_TO'; payload: { messageId: string; userName: string; content: string } | null };

const initialState: AppState = {
  isLoggedIn: false,
  isLoading: true,
  chats: [],
  selectedChat: null,
  showAllChats: false,
  isLoadingAllChats: false,
  messages: [],
  isLoadingMessages: false,
  lastSelectedChatId: null,
  replyingTo: null,
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'LOGIN_SUCCESS':
      return { ...state, isLoggedIn: true };
    case 'LOGOUT':
      return { ...state, isLoggedIn: false, selectedChat: null, messages: [], lastSelectedChatId: null, replyingTo: null };
    case 'SET_CHATS':
      return { ...state, chats: action.payload, selectedChat: state.selectedChat ? action.payload.find(c => c.id === state.selectedChat!.id) || null : null };
    case 'SELECT_CHAT':
      // Save selected chat ID to localStorage
      if (action.payload) {
        localStorage.setItem('lastSelectedChatId', action.payload.id.toString());
      } else {
        localStorage.removeItem('lastSelectedChatId');
      }
      return { ...state, selectedChat: action.payload, showAllChats: false, messages: [], isLoadingMessages: action.payload !== null, lastSelectedChatId: action.payload?.id || null, replyingTo: null };
    case 'SHOW_ALL_CHATS':
      return { ...state, showAllChats: true, isLoadingAllChats: true };
    case 'HIDE_ALL_CHATS':
      return { ...state, showAllChats: false };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ALL_CHATS_LOADING':
      return { ...state, isLoadingAllChats: action.payload };
    case 'SET_MESSAGES':
      return { ...state, messages: action.payload, isLoadingMessages: false };
    case 'SET_MESSAGES_LOADING':
      return { ...state, isLoadingMessages: action.payload };
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.payload] };
    case 'UPDATE_MESSAGE':
      return { 
        ...state, 
        messages: state.messages.map(msg =>
          msg.messageId === action.payload.messageId
            ? { ...msg, ...action.payload.updates }
            : msg
        )
      };
    case 'DELETE_MESSAGE':
      return { 
        ...state, 
        messages: state.messages.filter(msg => msg.messageId !== action.payload)
      };
    case 'SET_LAST_SELECTED_CHAT':
      return { ...state, lastSelectedChatId: action.payload };
    case 'SET_REPLYING_TO':
      return { ...state, replyingTo: action.payload };
    default:
      return state;
  }
}

export default function Main() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const { isLoggedIn, isLoading, chats, selectedChat, showAllChats, isLoadingAllChats, messages, isLoadingMessages, lastSelectedChatId, replyingTo } = state;
  
  // Use global Redis hook
  const redis = useRedis();
  const redisConnected = redis.state.connected;

  // Set up real-time subscriptions when Redis connects
  useEffect(() => {
    if (redis.state.connected) {
      console.log('✅ Redis connected, setting up subscriptions...');
      setupRealtimeSubscriptions();
    }
  }, [redis.state.connected]);

  // Subscribe to specific channels for the selected chat
  const subscribeToChat = async (chat: Thread) => {
    if (!redisConnected) return;
    
    try {
      // Direct Redis doesn't need channel subscription like Socket.IO
      // The subscription is handled by the direct Redis client
      const channelId = chat.channelId || chat.channelName;
      if (channelId) {
        console.log('🔔 Direct Redis ready for chat channel:', channelId);
      }
    } catch (error) {
      console.error('❌ Failed to prepare direct Redis for chat channels:', error);
    }
  };

  // Set up real-time subscriptions for the selected chat
  const setupRealtimeSubscriptions = async () => {
    try {
      // Subscribe to chat messages
      await redis.subscribe('chat:message', (message: PubSubMessage) => {
        console.log('📨 Real-time message received via Redis hook:', message);
        
        // Check if the message is for the currently selected chat
        if (selectedChat && message.data.channelId === selectedChat.channelId) {
          // Add the message to the current chat
          const newMessage: ApiMessageData = {
            id: parseInt(message.data.message.id) || Date.now(),
            messageId: message.data.message.id || Date.now().toString(),
            channelId: message.data.channelId,
            userId: parseInt(message.data.message.userId || '0'),
            userName: message.data.message.userName || 'Unknown User',
            userRole: message.data.message.userRole || 'member',
            profilePicture: message.data.message.profilePicture,
            content: message.data.message.content,
            createdAt: new Date(message.timestamp).toISOString(),
            attachments: message.data.message.attachments || [],
            reactions: message.data.message.reactions || []
          };
          
          dispatch({ type: 'ADD_MESSAGE', payload: newMessage });
        }
      });

      // Subscribe to message edits
      await redis.subscribe('chat:edit', (message: PubSubMessage) => {
        console.log('✏️ Real-time message edit received via Redis hook:', message);
        
        // Check if the edit is for the currently selected chat
        if (selectedChat && message.data.channelId === selectedChat.channelId) {
          // Update the message in the current chat
          dispatch({ 
            type: 'UPDATE_MESSAGE', 
            payload: { 
              messageId: message.data.messageId, 
              updates: { 
                content: message.data.content,
                attachments: message.data.attachments || [],
                editedAt: message.data.editedAt
              }
            }
          });
        }
      });

      // Subscribe to message deletions
      await redis.subscribe('chat:delete', (message: PubSubMessage) => {
        console.log('🗑️ Real-time message delete received via Redis hook:', message);
        
        // Check if the deletion is for the currently selected chat
        if (selectedChat && message.data.channelId === selectedChat.channelId) {
          // Remove the message from the current chat
          dispatch({ type: 'DELETE_MESSAGE', payload: message.data.messageId });
        }
      });

      // Subscribe to message reactions
      await redis.subscribe('chat:reaction', (message: PubSubMessage) => {
        console.log('😀 Real-time reaction received via Redis hook:', message);
        
        // Check if the reaction is for the currently selected chat
        if (selectedChat && message.data.channelId === selectedChat.channelId) {
          // Update the message reactions
          dispatch({ 
            type: 'UPDATE_MESSAGE', 
            payload: { 
              messageId: message.data.messageId, 
              updates: { 
                reactions: message.data.reactions
              }
            }
          });
        }
      });

      // Subscribe to thread updates
      await redis.subscribe('thread:update', (message: PubSubMessage) => {
        console.log('🔄 Thread update received via Redis hook:', message);
        // Refresh threads list when there are updates
        refreshThreads();
      });

      // Subscribe to notifications
      await redis.subscribe('notification', (message: PubSubMessage) => {
        console.log('🔔 Notification received via Redis hook:', message);
        // Handle notifications (could show toast, update UI, etc.)
      });

      console.log('✅ Redis hook real-time subscriptions set up successfully');
    } catch (error) {
      console.error('❌ Failed to set up Redis hook real-time subscriptions:', error);
    }
  };

  // Refresh threads from API
  const refreshThreads = async () => {
    try {
      const response = await threadsApiService.getThreads({ limit: 50 });
      dispatch({ type: 'SET_CHATS', payload: response.threads });
    } catch (error) {
      console.error('❌ Failed to refresh threads:', error);
    }
  };

  // Load last selected chat ID from localStorage on component mount
  useEffect(() => {
    const savedChatId = localStorage.getItem('lastSelectedChatId');
    if (savedChatId) {
      dispatch({ type: 'SET_LAST_SELECTED_CHAT', payload: parseInt(savedChatId, 10) });
    }
  }, []);

  // Function to load messages for a selected chat
  const loadMessagesForChat = async (chat: Thread) => {
    try {
      const identifier = messagesApiService.getMessageIdentifier(chat);
      console.log('📋 Loading messages for chat:', chat.channelName, 'with identifier:', identifier);
      
      if (identifier) {
        const response = await messagesApiService.getMessages(identifier, { limit: 100 });
        dispatch({ type: 'SET_MESSAGES', payload: response.messages });
        console.log('✅ Messages loaded:', response.messages.length, 'messages');
      } else {
        console.warn('⚠️ No valid identifier found for chat:', chat);
        dispatch({ type: 'SET_MESSAGES', payload: [] });
      }
    } catch (error) {
      console.error("❌ Failed to fetch messages:", error);
      dispatch({ type: 'SET_MESSAGES_LOADING', payload: false });
    }
  };

  // Auto-select chat when chats are loaded
  useEffect(() => {
    if (chats.length > 0 && !selectedChat) {
      let chatToSelect: Thread | null = null;

      // Try to restore last selected chat
      if (lastSelectedChatId) {
        chatToSelect = chats.find(chat => chat.id === lastSelectedChatId) || null;
        console.log('Attempting to restore last selected chat:', lastSelectedChatId, chatToSelect ? 'found' : 'not found');
      }

      // If no saved chat or saved chat not found, select the first chat (most recent)
      if (!chatToSelect && chats.length > 0) {
        // Sort by updatedAt to get the most recent chat first
        const sortedChats = [...chats].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        chatToSelect = sortedChats[0];
        console.log('Selecting first/most recent chat:', chatToSelect.channelName);
      }

      if (chatToSelect) {
        console.log('🚀 Auto-selecting chat and loading messages:', chatToSelect.channelName);
        dispatch({ type: 'SELECT_CHAT', payload: chatToSelect });
        
        // Subscribe to real-time updates for this chat
        if (redisConnected) {
          subscribeToChat(chatToSelect).catch(console.error);
        }
        
        // Load messages for the auto-selected chat
        loadMessagesForChat(chatToSelect);
      }
    }
  }, [chats, selectedChat, lastSelectedChatId]);

  // Check authentication and fetch initial data
  useEffect(() => {
    const checkAuthAndFetchData = async () => {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      console.log('=== Starting Authentication Check ===');
      
      // Ensure session ID is set
      if (!(window as any).sessionId) {
        (window as any).sessionId = 'desktop-session';
      }
      console.log('Using session ID:', (window as any).sessionId);
      
      // Force refresh auth state from storage
      authService.refreshAuthState();
      
      // Test backend connection
      testBackendConnection();
      
      // Check if backend has a valid session FIRST
      console.log('Checking backend session...');
      const backendSession = await authService.checkAuthStatus();
      console.log('Backend session check result:', backendSession);
      
      // Debug authentication state
      debugAuthState();
      
      // Wait a moment for auth state to settle
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Check authentication - either local state or backend session
      const localAuth = authService.isAuthenticated();
      const authenticated = localAuth || backendSession.authenticated;
      
      console.log('Authentication check results:', {
        localAuth,
        backendAuth: backendSession.authenticated,
        finalResult: authenticated
      });
      
      if (authenticated) {
        console.log('User is authenticated, loading app data...');
        dispatch({ type: 'LOGIN_SUCCESS' });
        
        try {
          // Load user profile first (this will sync from proxy if needed)
          console.log('Loading user profile...');
          await authService.loadUserProfile();
          
          console.log('Fetching threads...');
          const response = await threadsApiService.getThreads({ limit: 50 }); // Fetch initial chats
          console.log('Threads response:', response);
          dispatch({ type: 'SET_CHATS', payload: response.threads });
          // Chat selection is now handled by the useEffect above
        } catch (error) {
          console.error("Failed to fetch data:", error);
          // If we get 401, the token might be invalid
          if (error instanceof Error && error.message.includes('401')) {
            console.log('Token appears invalid, logging out...');
            authService.logout();
            dispatch({ type: 'LOGOUT' });
          }
        }
      } else {
        console.log('Not authenticated - showing login page');
      }
      dispatch({ type: 'SET_LOADING', payload: false });
      console.log('=== Authentication Check Complete ===');
    };

    checkAuthAndFetchData();
  }, []);

  const handleLoginSuccess = async () => {
    console.log('Login successful, loading user profile and data...');
    
    // Force refresh auth state from storage
    authService.refreshAuthState();
    
    // Load user profile
    try {
      await authService.loadUserProfile();
    } catch (error) {
      console.error('Failed to load user profile after login:', error);
    }
    
    // Update the app state instead of reloading
    dispatch({ type: 'LOGIN_SUCCESS' });
    
    // Load initial data
    try {
      console.log('Fetching threads after login...');
      const response = await threadsApiService.getThreads({ limit: 50 });
      console.log('Threads response after login:', response);
      dispatch({ type: 'SET_CHATS', payload: response.threads });
      // Chat selection is now handled by the useEffect above
    } catch (error) {
      console.error("Failed to fetch threads after login:", error);
    }
    
    dispatch({ type: 'SET_LOADING', payload: false });
  };

  const handleLogout = () => {
    authService.logout();
    dispatch({ type: 'LOGOUT' });
  };

  const handleChatSelect = async (chat: Thread) => {
    console.log('🎯 Chat selected:', {
      id: chat.id,
      uuid: chat.uuid,
      channelId: chat.channelId,
      channelName: chat.channelName
    });
    
    dispatch({ type: 'SELECT_CHAT', payload: chat });
    
    // Subscribe to real-time updates for this chat
    if (redisConnected) {
      await subscribeToChat(chat);
    }
    
    // Load messages for the selected chat
    await loadMessagesForChat(chat);
  };

  const handleShowAllChats = async () => {
    dispatch({ type: 'SHOW_ALL_CHATS' });
    try {
      // Re-fetch all chats to ensure data is fresh
      const response = await threadsApiService.getThreads({ limit: 500 }); // Fetch more for "all" view
      dispatch({ type: 'SET_CHATS', payload: response.threads });
    } catch (error) {
      console.error("Failed to fetch all threads:", error);
    } finally {
      dispatch({ type: 'SET_ALL_CHATS_LOADING', payload: false });
    }
  };

  const handleBackFromAllChats = () => {
    dispatch({ type: 'HIDE_ALL_CHATS' });
  };

  const handleCreateChat = async (chatData: {
    name: string;
    requestType: string;
    customerId?: string;
    customerName?: string;
    description?: string;
  }) => {
    console.log('🆕 Creating new chat:', chatData);
    
    try {
      // Create a new queue using the queueApiService
      const queueData = await queueApiService.createQueue({
        jobName: chatData.name,
        requestType: chatData.requestType,
        notes: chatData.description || null,
        priority: 'normal',
        customerId: chatData.customerId || null,
        customerName: chatData.customerName || null,
      });

      console.log('✅ Queue created successfully:', queueData);
      
      // Refresh the threads list to include the new chat
      const response = await threadsApiService.getThreads({ limit: 50 });
      dispatch({ type: 'SET_CHATS', payload: response.threads });
      
      // Find and select the newly created chat
      const newChat = response.threads.find(thread => 
        thread.metadata?.queueId === queueData.id
      );
      
      if (newChat) {
        console.log('✅ New chat found and selected:', newChat);
        dispatch({ type: 'SELECT_CHAT', payload: newChat });
        await loadMessagesForChat(newChat);
      }
      
    } catch (error) {
      console.error('❌ Failed to create chat:', error);
      // You could show a toast notification here
    }
  };

  const handleUpdateChat = async (chatId: number, updates: Partial<Thread>) => {
    console.log('🔄 Updating chat in main:', chatId, updates);
    
    // Update the chat in the local state
    dispatch({
      type: 'SET_CHATS',
      payload: chats.map(chat =>
        chat.id === chatId ? { ...chat, ...updates } : chat
      )
    });
  };

  const handleDeleteChat = async (chatId: number) => {
    console.log('🗑️ Deleting chat from main:', chatId);
    
    // Remove the chat from local state
    dispatch({
      type: 'SET_CHATS',
      payload: chats.filter(chat => chat.id !== chatId)
    });
    
    // If the deleted chat was selected, clear selection
    if (selectedChat?.id === chatId) {
      dispatch({ type: 'SELECT_CHAT', payload: null });
    }
  };

  const handleRefreshChats = async () => {
    console.log('🔄 Refreshing chats from real-time update...');
    try {
      const response = await threadsApiService.getThreads({ limit: 50 });
      dispatch({ type: 'SET_CHATS', payload: response.threads });
    } catch (error) {
      console.error('❌ Failed to refresh chats:', error);
    }
  };

  const handleSendMessage = async (content: string, attachments?: any[], replyTo?: { messageId: string; userName: string; content: string }) => {
    if (!selectedChat) {
      console.warn('⚠️ No chat selected for sending message');
      return;
    }

    console.log('📤 Sending message to chat:', {
      chatId: selectedChat.id,
      channelName: selectedChat.channelName,
      content: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
      replyTo: replyTo ? `Reply to: ${replyTo.userName}` : 'No reply'
    });

    try {
      const identifier = messagesApiService.getMessageIdentifier(selectedChat);
      if (identifier) {
        const response = await messagesApiService.sendMessage(identifier, {
          content,
          attachments,
          replyToId: replyTo?.messageId
        });
        
        if (response.success) {
          console.log('✅ Message sent successfully');
          dispatch({ type: 'ADD_MESSAGE', payload: response.message });
          
          // Clear reply state after sending
          if (replyTo) {
            dispatch({ type: 'SET_REPLYING_TO', payload: null });
          }
          
          // Publish real-time event if Redis is connected
          if (redisConnected) {
            try {
              // Get current user ID from auth service
              const currentUser = authService.getUser();
              const userId = currentUser?.id?.toString() || 'unknown';
              
              await redis.publish.newMessage(
                selectedChat.channelId || selectedChat.channelName,
                {
                  id: response.message.messageId,
                  content: response.message.content,
                  userId: response.message.userId.toString(),
                  userName: response.message.userName,
                  profilePicture: response.message.profilePicture,
                  attachments: response.message.attachments || [],
                  reactions: response.message.reactions || []
                },
                userId
              );
              console.log('📡 Real-time message event published');
            } catch (redisError) {
              console.warn('⚠️ Failed to publish real-time message event:', redisError);
            }
          }
        }
      } else {
        console.error('❌ No valid identifier for sending message to chat:', selectedChat);
      }
    } catch (error) {
      console.error("❌ Failed to send message:", error);
    }
  };

  const handleReply = (messageId: string, userName: string, content: string) => {
    console.log('💬 Setting reply to:', { messageId, userName, content: content.substring(0, 50) });
    dispatch({ type: 'SET_REPLYING_TO', payload: { messageId, userName, content } });
  };

  const handleCancelReply = () => {
    console.log('❌ Cancelling reply');
    dispatch({ type: 'SET_REPLYING_TO', payload: null });
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!selectedChat) {
      console.warn('⚠️ No chat selected for adding reaction');
      return;
    }

    console.log('😀 Adding reaction:', { messageId, emoji });
    
    try {
      const identifier = messagesApiService.getMessageIdentifier(selectedChat);
      if (identifier) {
        const response = await messagesApiService.addReaction(identifier, messageId, emoji);
        
        if (response.success) {
          console.log('✅ Reaction added successfully');
          
          // Update the message reactions in local state
          dispatch({ 
            type: 'UPDATE_MESSAGE', 
            payload: { 
              messageId, 
              updates: { 
                reactions: response.reactions
              }
            }
          });
          
          // Publish real-time reaction event if Redis is connected
          if (redisConnected) {
            try {
              // Get current user ID from auth service
              const currentUser = authService.getUser();
              const userId = currentUser?.id?.toString() || 'unknown';
              
              await redis.publish.messageReaction(
                selectedChat.channelId || selectedChat.channelName,
                messageId,
                response.reactions,
                userId
              );
              console.log('📡 Real-time reaction event published');
            } catch (redisError) {
              console.warn('⚠️ Failed to publish real-time reaction event:', redisError);
            }
          }
        }
      }
    } catch (error) {
      console.error("❌ Failed to add reaction:", error);
    }
  };

  const handleEditMessage = async (messageId: string, newContent: string, attachments?: string[]) => {
    if (!selectedChat) {
      console.warn('⚠️ No chat selected for editing message');
      return;
    }

    console.log('✏️ Editing message:', { messageId, newContent: newContent.substring(0, 50) });
    
    try {
      const identifier = messagesApiService.getMessageIdentifier(selectedChat);
      if (identifier) {
        const response = await messagesApiService.editMessage(identifier, messageId, {
          content: newContent,
          attachments
        });
        
        if (response.success) {
          console.log('✅ Message edited successfully');
          
          // Update the message in the local state
          dispatch({ 
            type: 'UPDATE_MESSAGE', 
            payload: { 
              messageId, 
              updates: { 
                content: newContent, 
                attachments: attachments || [],
                editedAt: response.message.editedAt 
              }
            }
          });
          
          // Publish real-time edit event if Redis is connected
          if (redisConnected) {
            try {
              // Get current user ID from auth service
              const currentUser = authService.getUser();
              const userId = currentUser?.id?.toString() || 'unknown';
              
              await redis.publish.messageEdited(
                selectedChat.channelId || selectedChat.channelName,
                messageId,
                newContent,
                response.message.editedAt || new Date().toISOString(),
                attachments,
                userId
              );
              console.log('📡 Real-time message edit event published');
            } catch (redisError) {
              console.warn('⚠️ Failed to publish real-time edit event:', redisError);
            }
          }
        }
      }
    } catch (error) {
      console.error("❌ Failed to edit message:", error);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!selectedChat) {
      console.warn('⚠️ No chat selected for deleting message');
      return;
    }

    console.log('🗑️ Deleting message:', messageId);
    console.log('📋 Selected chat:', {
      id: selectedChat.id,
      uuid: selectedChat.uuid,
      channelId: selectedChat.channelId,
      channelName: selectedChat.channelName
    });
    
    try {
      const identifier = messagesApiService.getMessageIdentifier(selectedChat);
      console.log('🔍 Using identifier for deletion:', identifier);
      
      if (identifier) {
        console.log('📡 Making DELETE API call...');
        const response = await messagesApiService.deleteMessage(identifier, messageId);
        console.log('📡 DELETE API response:', response);
        
        if (response.success) {
          console.log('✅ Message deleted successfully from API');
          
          // Remove the message from the local state
          console.log('🔄 Updating local state to remove message:', messageId);
          dispatch({ type: 'DELETE_MESSAGE', payload: messageId });
          console.log('✅ Local state updated');
          
          // Publish real-time delete event if Redis is connected
          if (redisConnected) {
            try {
              // Get current user ID from auth service
              const currentUser = authService.getUser();
              const userId = currentUser?.id?.toString() || 'unknown';
              
              await redis.publish.messageDeleted(
                selectedChat.channelId || selectedChat.channelName,
                messageId,
                userId
              );
              console.log('📡 Real-time message delete event published');
            } catch (redisError) {
              console.warn('⚠️ Failed to publish real-time delete event:', redisError);
            }
          }
        } else {
          console.error('❌ API returned success: false');
        }
      } else {
        console.error('❌ No valid identifier found for chat');
      }
    } catch (error) {
      console.error("❌ Failed to delete message:", error);
      console.error("❌ Error details:", {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  };

  const testBackendConnection = async () => {
    try {
      console.log('Testing backend connection...');
      
      // Test authentication via IPC/fallback
      const testResult = await authService.testAuthentication();
      console.log('Backend connection test result:', testResult);
    } catch (error) {
      console.error('Backend connection test failed:', error);
    }
  };

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="bg-background text-on-background h-screen w-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="body-medium text-on-surface-variant">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="bg-background text-on-background h-screen w-screen flex overflow-hidden selection:bg-primary/30 selection:text-on-primary ">
      <Sidebar
        chats={chats}
        selectedChat={selectedChat}
        onChatSelect={handleChatSelect}
        onShowAllChats={handleShowAllChats}
        isLoadingAllChats={isLoadingAllChats}
        onCreateChat={handleCreateChat}
        onUpdateChat={handleUpdateChat}
        onDeleteChat={handleDeleteChat}
        onRefreshChats={handleRefreshChats}
      />

      {showAllChats ? (
        <AllChats
          chats={chats}
          onChatSelect={handleChatSelect}
          onBack={handleBackFromAllChats}
          selectedChatId={selectedChat?.id}
          isLoading={isLoadingAllChats}
        />
      ) : (
        <main className="flex-1 flex flex-col min-w-0 bg-surface relative">
          <ChatHeader selectedChat={selectedChat} onLogout={handleLogout} chatCount={chats.length} redisConnected={redisConnected} />

          <div className="flex-1 overflow-y-auto flex flex-col relative" id="message-container">
            <StickyStatus 
              selectedChat={selectedChat} 
              onStatusUpdate={(newStatus) => {
                console.log('Queue status updated to:', newStatus);
                // Update the selected chat's metadata
                if (selectedChat?.metadata?.queueId) {
                  dispatch({ 
                    type: 'SELECT_CHAT', 
                    payload: selectedChat ? {
                      ...selectedChat,
                      metadata: {
                        ...selectedChat.metadata,
                        queueStatus: newStatus
                      }
                    } : null
                  });
                }
              }}
            />

            <div className="flex flex-col gap-1 pb-4 px-6 -mt-2">
              {selectedChat && (
                <>
                  {/* Date Divider */}
                  <div className="relative py-6 flex items-center justify-center">
                    <div className="absolute left-0 right-0 h-px bg-surface-variant" />
                    <div className="relative bg-surface px-3 rounded-full border border-outline text-xs font-medium text-on-surface-variant">
                      {new Date(selectedChat.createdAt).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </div>
                  </div>

                  {/* Chat Messages Area */}
                  {isLoadingMessages ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                      <p className="body-medium text-on-surface-variant">Loading messages...</p>
                    </div>
                  ) : messages.length > 0 ? (
                    <div className="flex flex-col gap-1">
                      {messages.map((message) => (
                        <MessageBubble 
                          key={message.messageId} 
                          data={{
                            id: message.messageId,
                            user: {
                              id: message.userId.toString(),
                              name: message.userName,
                              avatarUrl: getProfileImageUrl(message.profilePicture),
                              initial: message.userName.charAt(0).toUpperCase(),
                              color: 'bg-blue-500'
                            },
                            time: new Date(message.createdAt).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit'
                            }),
                            content: message.content,
                            attachments: message.attachments || [],
                            reactions: message.reactions || [],
                            editedAt: message.editedAt,
                            replyTo: message.replyTo
                          }}
                          onReply={handleReply}
                          onReaction={handleReaction}
                          onEdit={handleEditMessage}
                          onDelete={handleDeleteMessage}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="size-16 rounded-full bg-surface-variant/50 flex items-center justify-center mb-4">
                        <MessageCircle className="text-on-surface-variant" size={32} />
                      </div>
                      <h3 className="title-medium text-on-surface mb-2">No Messages Yet</h3>
                      <p className="body-medium text-on-surface-variant max-w-md">
                        Start the conversation in "{selectedChat.channelName}".
                      </p>
                    </div>
                  )}
                </>
              )}

              <div className="h-2" />
            </div>
          </div>

          <ChatInput 
            onSendMessage={handleSendMessage} 
            replyingTo={replyingTo}
            onCancelReply={handleCancelReply}
          />
        </main>
      )}
    </div>
  )
}