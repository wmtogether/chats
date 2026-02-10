import { useReducer, useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react'
import Sidebar from './Components/Sidebar'
import ChatHeader from './Components/ChatHeader'
import ChatInput from './Components/ChatInput'
import StickyStatus from './Components/StickyStatus'
import LoginPage from './Pages/Login';
import AllChats from './Pages/AllChats';
import UsersPage from './Pages/Users';
import { useAuth, apiClient } from './Library/Authentication/AuthContext';
import MessageBubble from './Components/MessageBubble';
import { ToastProvider, useToast } from './Library/hooks/useToast.tsx';
import type { ChatType, MessageType } from './Library/types.ts';
import { preprocessChat, deleteChat, createChat, sendMessage, deleteMessage, editMessage, addReaction } from './Library/utils/api.ts';
import { createWebSocketManager, getWebSocketManager } from './Library/utils/websocket.ts';
import { localStorageManager, shouldRestoreState, findChatByUuid } from './Library/utils/localStorage.ts';
import { getWebSocketUrl } from './Library/utils/env.ts';

type Page = 'chat' | 'users' | 'allChats';

// The reducer now manages UI state, including the current page
interface AppState {
  currentPage: Page;
  chats: ChatType[];
  messages: MessageType[];
  selectedChat: ChatType | null;
  replyingTo: { messageId: string; userName: string; content: string } | null;
  isLoadingChats: boolean;
  isLoadingMessages: boolean;
  deletingMessages: string[];
  newMessageIds: Set<string>; // Track recently added messages for animation
}

type AppAction =
  | { type: 'NAVIGATE'; payload: Page }
  | { type: 'SET_CHATS'; payload: any[] }
  | { type: 'SET_MESSAGES'; payload: any[] }
  | { type: 'SELECT_CHAT'; payload: any | null }
  | { type: 'UPDATE_CHAT'; payload: ChatType }
  | { type: 'ADD_CHAT'; payload: ChatType }
  | { type: 'REMOVE_CHAT'; payload: string }
  | { type: 'ADD_MESSAGE'; payload: { message: MessageType; chatUuid: string } }
  | { type: 'REMOVE_MESSAGE'; payload: string }
  | { type: 'UPDATE_MESSAGE'; payload: MessageType }
  | { type: 'SET_REPLYING_TO'; payload: { messageId: string; userName: string; content: string } | null }
  | { type: 'SET_LOADING_CHATS'; payload: boolean }
  | { type: 'SET_LOADING_MESSAGES'; payload: boolean }
  | { type: 'SET_DELETING_MESSAGE'; payload: string }
  | { type: 'REMOVE_DELETING_MESSAGE'; payload: string }
  | { type: 'CLEAR_NEW_MESSAGE_IDS' }
  | { type: 'RESTORE_STATE'; payload: { page: Page; selectedChat: ChatType | null } };

const initialState: AppState = {
  currentPage: 'chat',
  chats: [],
  messages: [],
  selectedChat: null,
  replyingTo: null,
  isLoadingChats: false,
  isLoadingMessages: false,
  deletingMessages: [],
  newMessageIds: new Set(),
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'NAVIGATE':
      // Save current page to localStorage
      localStorageManager.saveCurrentPage(action.payload);
      return { ...state, currentPage: action.payload };
    case 'SET_CHATS':
      return { ...state, chats: action.payload, isLoadingChats: false };
    case 'SET_MESSAGES':
        return { ...state, messages: action.payload, isLoadingMessages: false, newMessageIds: new Set() };
    case 'SELECT_CHAT':
      // When a chat is selected, clear previous messages and navigate back to the main chat view
      // Save selected chat to localStorage
      localStorageManager.saveSelectedChat(action.payload);
      return { ...state, selectedChat: action.payload, messages: [], currentPage: 'chat', replyingTo: null, isLoadingMessages: false, newMessageIds: new Set() };
    case 'UPDATE_CHAT':
      // Update a specific chat in the chats array and selectedChat if it matches
      const updatedChats = state.chats.map(chat => 
        chat.uuid === action.payload.uuid ? action.payload : chat
      );
      const updatedSelectedChat = state.selectedChat?.uuid === action.payload.uuid 
        ? action.payload 
        : state.selectedChat;
      
      return { 
        ...state, 
        chats: updatedChats, 
        selectedChat: updatedSelectedChat 
      };
    case 'ADD_CHAT':
      // Add a new chat to the chats array
      return { 
        ...state, 
        chats: [...state.chats, action.payload] 
      };
    case 'REMOVE_CHAT':
      // Remove a chat by UUID and deselect if it was selected
      const filteredChats = state.chats.filter(chat => chat.uuid !== action.payload);
      const newSelectedChat = state.selectedChat?.uuid === action.payload ? null : state.selectedChat;
      return { 
        ...state, 
        chats: filteredChats,
        selectedChat: newSelectedChat,
        messages: newSelectedChat ? state.messages : [] // Clear messages if chat was deselected
      };
    case 'ADD_MESSAGE':
      // Add a new message if it's for the currently selected chat
      if (state.selectedChat?.uuid === action.payload.chatUuid) {
        const newMessageIds = new Set(state.newMessageIds);
        newMessageIds.add(action.payload.message.messageId);
        return { 
          ...state, 
          messages: [...state.messages, action.payload.message],
          newMessageIds
        };
      }
      return state; // No change if message is not for current chat
    case 'REMOVE_MESSAGE':
      // Remove a message by messageId
      return { 
        ...state, 
        messages: state.messages.filter(msg => msg.messageId !== action.payload) 
      };
    case 'UPDATE_MESSAGE':
      // Update a message by messageId
      return { 
        ...state, 
        messages: state.messages.map(msg => 
          msg.messageId === action.payload.messageId ? action.payload : msg
        ) 
      };
    case 'CLEAR_NEW_MESSAGE_IDS':
      return { ...state, newMessageIds: new Set() };
    case 'SET_REPLYING_TO':
      return { ...state, replyingTo: action.payload };
    case 'SET_LOADING_CHATS':
      return { ...state, isLoadingChats: action.payload };
    case 'SET_LOADING_MESSAGES':
      return { ...state, isLoadingMessages: action.payload };
    case 'SET_DELETING_MESSAGE':
      return { ...state, deletingMessages: [...state.deletingMessages, action.payload] };
    case 'REMOVE_DELETING_MESSAGE':
      return { ...state, deletingMessages: state.deletingMessages.filter(id => id !== action.payload) };
    case 'RESTORE_STATE':
      // Restore state from localStorage
      console.log('🔄 RESTORE_STATE action triggered:', action.payload);
      
      return { 
        ...state, 
        currentPage: action.payload.page, 
        selectedChat: action.payload.selectedChat,
        messages: [], // Clear messages, they'll be loaded fresh
        replyingTo: null 
      };
    default:
      return state;
  }
}

// Main component for the authenticated chat experience
const ChatLayout = ({ state, dispatch, onLogout, wsConnected }: { state: AppState, dispatch: React.Dispatch<AppAction>, onLogout: () => void, wsConnected: boolean }) => {
  const { selectedChat, replyingTo, chats, messages, isLoadingChats, isLoadingMessages } = state;
  const { user } = useAuth();
  const { addToast } = useToast();

  // Fetch all chats when the user is authenticated
  useEffect(() => {
    const fetchChats = async () => {
      if (user) { // Only fetch if we have a user
        dispatch({ type: 'SET_LOADING_CHATS', payload: true });
        try {
          const response = await apiClient.get('/chats');
          const preprocessedChats = (response.data.data || []).map(preprocessChat);
          //@ts-expect-error
          const nonArchivedChats = preprocessedChats.filter(chat => chat.isArchived !== 1); // Filter archived chats
          dispatch({ type: 'SET_CHATS', payload: nonArchivedChats });

          // Note: State restoration is now handled in a separate useEffect
          // to avoid timing issues with chat loading
        } catch (error) {
          console.error("Failed to fetch chats:", error);
          dispatch({ type: 'SET_LOADING_CHATS', payload: false });
        }
      }
    };
    fetchChats();
  }, [user]); // Re-run when user object changes

  // Separate effect to handle state restoration after chats are loaded
  useEffect(() => {
    if (chats.length > 0 && !selectedChat && shouldRestoreState()) {
      console.log('🔄 Chats loaded, attempting state restoration...');
      const savedChatUuid = localStorageManager.getSelectedChatUuid();
      const savedPage = localStorageManager.getCurrentPage();
      
      console.log('🔄 Saved chat UUID:', savedChatUuid);
      console.log('🔄 Available chats:', chats.length);
      
      if (savedChatUuid) {
        const savedChat = findChatByUuid(chats, savedChatUuid);
        if (savedChat) {
          console.log('🔄 Found saved chat, restoring:', savedChat.channelName);
          addToast({ message: `Restored chat: ${savedChat.channelName}`, type: 'success' });
          dispatch({ 
            type: 'RESTORE_STATE', 
            payload: { 
              page: savedPage || 'chat', 
              selectedChat: savedChat 
            } 
          });
        } else {
          console.log('🔄 Saved chat not found in loaded chats');
        }
      }
    }
  }, [chats, selectedChat, addToast]);

  // Fetch messages when a chat is selected
  useEffect(() => {
    if (selectedChat?.uuid) {
      const fetchMessages = async () => {
        dispatch({ type: 'SET_LOADING_MESSAGES', payload: true });
        try {
          const response = await apiClient.get(`/chats/${selectedChat.uuid}/messages`);
          dispatch({ type: 'SET_MESSAGES', payload: response.data.data || [] });
        } catch (error) {
          console.error(`Failed to fetch messages for chat ${selectedChat.uuid}:`, error);
          dispatch({ type: 'SET_LOADING_MESSAGES', payload: false });
        }
      };
      fetchMessages();
    }
  }, [selectedChat]);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    const messageContainer = document.getElementById('message-container');
    if (messageContainer && messages.length > 0) {
      // Small delay to ensure the message is rendered
      setTimeout(() => {
        messageContainer.scrollTop = messageContainer.scrollHeight;
      }, 100);
    }
  }, [messages.length]); // Only trigger when message count changes

  // Clear new message indicators after a delay
  useEffect(() => {
    if (state.newMessageIds.size > 0) {
      const timer = setTimeout(() => {
        dispatch({ type: 'CLEAR_NEW_MESSAGE_IDS' });
      }, 3000); // Clear after 3 seconds

      return () => clearTimeout(timer);
    }
    return undefined; // Explicit return for when condition is false
  }, [state.newMessageIds.size]);

  // Debug function to test WebSocket connectivity
  useEffect(() => {
    // Add a global function for testing WebSocket
    (window as any).testWebSocket = () => {
      const wsManager = getWebSocketManager();
      if (wsManager) {
        console.log('🧪 Testing WebSocket connection...');
        console.log('🧪 WebSocket connected:', wsManager.getConnectionStatus());
        
        // Send a test ping
        wsManager.send({
          type: 'ping',
          data: Date.now()
        });
      } else {
        console.log('❌ WebSocket manager not available');
      }
    };

    // Add a global function to test message sending
    (window as any).testSendMessage = async (content: string) => {
      if (selectedChat) {
        console.log('🧪 Testing message send:', content);
        try {
          const result = await sendMessage(selectedChat.uuid, { content });
          console.log('🧪 Message send result:', result);
        } catch (error) {
          console.error('🧪 Message send error:', error);
        }
      } else {
        console.log('❌ No chat selected for testing');
      }
    };

    return () => {
      delete (window as any).testWebSocket;
      delete (window as any).testSendMessage;
    };
  }, [selectedChat]);


  // Handle chat updates (e.g., request type changes)
  const handleChatUpdate = (updatedChat: ChatType) => {
    console.log('Updating chat:', updatedChat.channelName);
    const processedChat = preprocessChat(updatedChat);
    dispatch({ type: 'UPDATE_CHAT', payload: processedChat });
  };

  // Placeholder functions
  const handleCreateChat = async (chatData: {
    name: string;
    requestType: string;
    customerId?: string;
    customerName?: string;
    description?: string;
  }) => {
    console.log('Creating new chat:', chatData);
    
    try {
      // Call the API to create the chat
      const result = await createChat(chatData);
      
      if (result.success && result.data) {
        // Process the new chat data
        const processedChat = preprocessChat(result.data);
        
        // Add the new chat to the local state
        dispatch({ type: 'SET_CHATS', payload: [...chats, processedChat] });
        
        // Select the newly created chat
        dispatch({ type: 'SELECT_CHAT', payload: processedChat });
        
        console.log('Chat created successfully:', result.message);
        
        // Show success toast
        addToast({ message: `Chat "${chatData.name}" created successfully!`, type: 'success' });
      } else {
        console.error('Failed to create chat:', result.error);
        throw new Error(result.error || 'Failed to create chat');
      }
    } catch (error) {
      console.error('Error creating chat:', error);
      // Show error toast
      addToast({ 
        message: `Failed to create chat: ${error instanceof Error ? error.message : 'Unknown error'}`, 
        type: 'error' 
      });
      throw error; // Re-throw so the dialog can handle it
    }
  };
  const handleUpdateChat = (chatId: number, updates: any) => console.log('Updating chat:', chatId, updates);
  const handleDeleteChat = async (chatId: number) => {
    console.log('Deleting chat:', chatId);
    
    // Find the chat to get its UUID
    const chatToDelete = chats.find(chat => chat.id === chatId);
    if (!chatToDelete) {
      console.error('Chat not found for deletion:', chatId);
      return;
    }

    try {
      // Call the API to delete the chat
      const result = await deleteChat(chatToDelete.uuid);
      
      if (result.success) {
        // Remove the chat from the local state
        dispatch({ type: 'SET_CHATS', payload: chats.filter(chat => chat.id !== chatId) });
        
        // If the deleted chat was the selected chat, deselect it
        if (selectedChat?.id === chatId) {
          dispatch({ type: 'SELECT_CHAT', payload: null });
        }
        
        console.log('Chat deleted successfully:', result.message);
      } else {
        console.error('Failed to delete chat:', result.error);
        throw new Error(result.error || 'Failed to delete chat');
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
      // You might want to show an error toast here
      throw error; // Re-throw so the Sidebar can handle it
    }
  };
  const handleRefreshChats = () => console.log('Refreshing chats...');
  const handleSendMessage = async (content: string, attachments?: string[], replyTo?: any) => {
    if (!selectedChat) {
      console.error('No chat selected');
      return;
    }

    console.log('Sending message:', content, attachments, replyTo);
    
    try {
      // Call the API to send the message
      const result = await sendMessage(selectedChat.uuid, {
        content,
        attachments,
        replyTo
      });
      
      if (result.success && result.data) {
        // Don't add to local state here - let WebSocket handle it to avoid duplicates
        console.log('Message sent successfully:', result.message);
        
        // Show success toast
        // addToast({ message: 'Message sent successfully!', type: 'success' });
      } else {
        console.error('Failed to send message:', result.error);
        throw new Error(result.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Show error toast
      addToast({ 
        message: `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`, 
        type: 'error' 
      });
      throw error;
    }
  };

  const handleEditMessage = async (messageId: string, newContent: string, attachments?: string[]) => {
    console.log('Editing message:', messageId, newContent, attachments);
    
    try {
      // Call the API to edit the message
      const result = await editMessage(messageId, {
        content: newContent,
        attachments
      });
      
      if (result.success && result.data) {
        // Don't update local state here - let WebSocket handle it to avoid duplicates
        console.log('Message edited successfully:', result.message);
        
        // Show success toast
        addToast({ message: 'Message edited successfully!', type: 'success' });
      } else {
        console.error('Failed to edit message:', result.error);
        throw new Error(result.error || 'Failed to edit message');
      }
    } catch (error) {
      console.error('Error editing message:', error);
      // Show error toast
      addToast({ 
        message: `Failed to edit message: ${error instanceof Error ? error.message : 'Unknown error'}`, 
        type: 'error' 
      });
      throw error;
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    console.log('Adding reaction:', messageId, emoji);
    
    try {
      // Call the API to add the reaction
      const result = await addReaction(messageId, emoji);
      
      if (result.success) {
        console.log('Reaction added successfully:', result.message);
        
        // Show info toast about the feature
        addToast({ message: result.message || 'Reaction added!', type: 'info' });
      } else {
        console.error('Failed to add reaction:', result.error);
        throw new Error(result.error || 'Failed to add reaction');
      }
    } catch (error) {
      console.error('Error adding reaction:', error);
      // Show error toast
      addToast({ 
        message: `Failed to add reaction: ${error instanceof Error ? error.message : 'Unknown error'}`, 
        type: 'error' 
      });
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    console.log('Deleting message:', messageId);
    
    // Check if this message is already being deleted
    if (state.deletingMessages?.includes(messageId)) {
      console.log('Message already being deleted, skipping:', messageId);
      return;
    }
    
    // Add to deleting messages list
    dispatch({ type: 'SET_DELETING_MESSAGE', payload: messageId });
    
    try {
      // Call the API to delete the message
      const result = await deleteMessage(messageId);
      
      if (result.success) {
        // Don't update local state here - let WebSocket handle it to avoid duplicates
        console.log('Message deleted successfully:', result.message);
        
        // Show success toast
        addToast({ message: 'Message deleted successfully!', type: 'success' });
      } else {
        console.error('Failed to delete message:', result.error);
        throw new Error(result.error || 'Failed to delete message');
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      // Show error toast
      addToast({ 
        message: `Failed to delete message: ${error instanceof Error ? error.message : 'Unknown error'}`, 
        type: 'error' 
      });
      throw error;
    } finally {
      // Remove from deleting messages list
      dispatch({ type: 'REMOVE_DELETING_MESSAGE', payload: messageId });
    }
  };

  return (
    <div className="bg-background text-on-background h-screen w-screen flex overflow-hidden selection:bg-primary/30 selection:text-on-primary ">
      <Sidebar
        onNavigate={(page) => dispatch({ type: 'NAVIGATE', payload: page })}
        onLogout={onLogout}
        chats={chats}
        selectedChat={selectedChat}
        onChatSelect={(chat) => dispatch({ type: 'SELECT_CHAT', payload: chat })}
        isLoadingAllChats={isLoadingChats}
        onCreateChat={handleCreateChat}
        //@ts-expect-error
        onDeleteChat={handleDeleteChat} // Pass the new prop
      />

      {state.currentPage === 'allChats' ? (
        <AllChats
          chats={chats}
          onChatSelect={(chat) => dispatch({ type: 'SELECT_CHAT', payload: chat })}
          onBack={() => dispatch({ type: 'NAVIGATE', payload: 'chat' })}
          selectedChatId={selectedChat?.id}
          isLoading={isLoadingChats}
        />
      ) : (
        <main className="flex-1 flex flex-col min-w-0 bg-surface relative">
          <ChatHeader 
            selectedChat={selectedChat} 
            chatCount={chats.length} 
            wsConnected={wsConnected} 
            onChatUpdate={handleChatUpdate}
          />

          <div className="flex-1 overflow-y-auto flex flex-col relative" id="message-container">
            <StickyStatus
              selectedChat={selectedChat}
              onStatusUpdate={(newStatus) => console.log('Queue status updated to:', newStatus)}
            />

            <div className="flex flex-col gap-1 pb-4 px-6 -mt-2 h-full">
              {selectedChat ? (
                <>
                  <div className="relative py-6 flex items-center justify-center">
                    <div className="absolute left-0 right-0 h-px bg-surface-variant" />
                    <div className="relative bg-surface px-3 rounded-full border border-outline text-xs font-medium text-on-surface-variant">
                      {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                  </div>
                  {messages.length > 0 ? (
                    messages.map((msg: MessageType) => { // Explicitly type msg as MessageType
                      //@ts-expect-error
                      const messageData: MessageBubbleData = { // Explicitly type messageData as MessageBubbleData
                        id: msg.messageId,
                        user: {
                          id: msg.userId,
                          name: msg.userName,
                        },
                        time: new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        content: msg.content,
                        attachments: msg.attachments,
                        editedAt: msg.editedAt,
                      };
                      return (
                        <MessageBubble 
                          key={msg.messageId} 
                          data={messageData}
                          isNewMessage={state.newMessageIds.has(msg.messageId)}
                          onReply={(messageId, userName, content) => 
                            dispatch({ type: 'SET_REPLYING_TO', payload: { messageId, userName, content } })
                          }
                          onReaction={handleReaction}
                          onEdit={handleEditMessage}
                          onDelete={handleDeleteMessage}
                        />
                      );
                    })
                  ) : isLoadingMessages ? (
                    <div className="flex flex-col gap-4 py-6">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className="flex gap-4 p-3 animate-pulse">
                          <div className="size-10 rounded-full bg-surface-variant flex-shrink-0"></div>
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <div className="h-4 bg-surface-variant rounded w-20"></div>
                              <div className="h-3 bg-surface-variant rounded w-12"></div>
                            </div>
                            <div className="space-y-1">
                              <div className="h-4 bg-surface-variant rounded w-3/4"></div>
                              <div className="h-4 bg-surface-variant rounded w-1/2"></div>
                            </div>
                          </div>
                        </div>
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
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <h3 className="title-large text-on-surface mb-2">Select a chat</h3>
                  <p className="body-large text-on-surface-variant">Choose a conversation from the sidebar to get started.</p>
                </div>
              )}
              <div className="h-2" />
            </div>
          </div>

          {selectedChat && (
            <ChatInput
              onSendMessage={handleSendMessage}
              replyingTo={replyingTo}
              onCancelReply={() => dispatch({ type: 'SET_REPLYING_TO', payload: null })}
            />
          )}
        </main>
      )}

      {/* Debug Panel - only in development
      {import.meta.env.DEV && (
        <DebugPanel 
          currentState={{
            selectedChat,
            currentPage: state.currentPage,
            chatsCount: chats.length
          }}
        />
      )} */}
    </div>
  )
}

export default function Main() {
  const { user, loading, logout } = useAuth();
  const [state, dispatch] = useReducer(appReducer, initialState);

  // WebSocket state for real-time communication
  const [wsConnected, setWsConnected] = useState(false);

  // Save state when app is about to unload (user closes tab/refreshes)
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Update the last active timestamp
      localStorageManager.saveAppState({
        selectedChatUuid: state.selectedChat?.uuid,
        currentPage: state.currentPage,
        lastActiveTimestamp: Date.now()
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Save state when tab becomes hidden
        handleBeforeUnload();
      }
    };

    // Save state periodically (every 30 seconds) while app is active
    const saveInterval = setInterval(() => {
      if (user && state.selectedChat) {
        localStorageManager.saveAppState({
          selectedChatUuid: state.selectedChat.uuid,
          currentPage: state.currentPage,
          lastActiveTimestamp: Date.now()
        });
      }
    }, 30000); // 30 seconds

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(saveInterval);
      // Final save on cleanup
      handleBeforeUnload();
    };
  }, [user, state.selectedChat, state.currentPage]);

  // Enhanced logout handler that clears localStorage and disconnects WebSocket
  const handleLogout = () => {
    localStorageManager.clearAppState();
    
    // Disconnect WebSocket
    const wsManager = getWebSocketManager();
    if (wsManager) {
      wsManager.disconnect();
    }
    
    logout();
  };

  useEffect(() => {
    // Only initialize WebSocket if user is authenticated
    if (!user) return;

    // Initialize WebSocket connection for real-time updates
    const wsManager = createWebSocketManager(getWebSocketUrl()); // Use environment variable
    
    wsManager.on('connect', () => {
      setWsConnected(true);
      console.log('✅ Real-time connection established');
    });

    wsManager.on('disconnect', () => {
      setWsConnected(false);
      console.log('🔌 Real-time connection lost');
    });

    wsManager.on('error', (error: any) => {
      console.error('❌ Real-time connection error:', error);
      setWsConnected(false);
    });

    wsManager.on('maxReconnectAttemptsReached', () => {
      console.error('❌ Max reconnection attempts reached');
      setWsConnected(false);
    });

    wsManager.on('message', (data: any) => {
      // Handle incoming real-time messages
      console.log('📨 Real-time message received:', data);
      console.log('📨 Message type:', data.type);
      console.log('📨 Message data:', data.data);
      
      // Handle different message types
      switch (data.type) {
        case 'queue_update':
          console.log('📊 Queue update:', data.data);
          // You can dispatch actions here to update the queue in UI
          break;
        case 'chat_created':
          console.log('💬 Chat created:', data.data);
          // Handle real-time chat creation
          if (data.data?.chat) {
            const processedChat = preprocessChat(data.data.chat);
            // Add the new chat to the chats list
            dispatch({ type: 'ADD_CHAT', payload: processedChat });
          }
          break;
        case 'chat_deleted':
          console.log('💬 Chat deleted:', data.data);
          // Handle real-time chat deletion
          if (data.data?.chatUuid) {
            dispatch({ type: 'REMOVE_CHAT', payload: data.data.chatUuid });
          }
          break;
        case 'chat_updated':
          console.log('💬 Chat updated:', data.data);
          // Handle real-time chat updates (e.g., request type changes)
          if (data.data?.chat) {
            const processedChat = preprocessChat(data.data.chat);
            dispatch({ type: 'UPDATE_CHAT', payload: processedChat });
          }
          break;
        case 'chat_status_updated':
          console.log('💬 Chat status updated:', data.data);
          // Handle real-time chat status updates
          if (data.data?.chat) {
            const processedChat = preprocessChat(data.data.chat);
            dispatch({ type: 'UPDATE_CHAT', payload: processedChat });
            
            // If this is the currently selected chat, update it immediately
            if (state.selectedChat?.uuid === data.data.chat.uuid) {
              dispatch({ type: 'SELECT_CHAT', payload: processedChat });
            }
          }
          break;
        case 'chat_message':
          console.log('💬 Chat message received via WebSocket:', data.data);
          console.log('💬 Message object:', data.data?.message);
          console.log('💬 Chat UUID:', data.data?.chatUuid);
          console.log('💬 Current selected chat UUID:', state.selectedChat?.uuid);
          
          // Handle real-time chat messages
          if (data.data?.message && data.data?.chatUuid) {
            // Check if message already exists to prevent duplicates
            const messageExists = state.messages.some(msg => msg.messageId === data.data.message.messageId);
            if (!messageExists) {
              console.log('💬 Adding new message to chat via WebSocket');
              dispatch({ 
                type: 'ADD_MESSAGE', 
                payload: { 
                  message: data.data.message, 
                  chatUuid: data.data.chatUuid 
                } 
              });
            } else {
              console.log('💬 Message already exists, skipping duplicate:', data.data.message.messageId);
            }
          } else {
            console.warn('💬 WebSocket chat_message missing required data:', {
              hasMessage: !!data.data?.message,
              hasChatUuid: !!data.data?.chatUuid,
              data: data.data
            });
          }
          break;
        case 'upload_progress':
          console.log('📤 Upload progress:', data.data);
          // Handle real-time upload progress updates
          break;
        case 'image_uploaded':
          console.log('🖼️ Image uploaded:', data.data);
          // Handle image upload notifications
          break;
        case 'user_joined':
          console.log('👤 User joined:', data.data);
          break;
        case 'status_update':
          console.log('📊 Status update:', data.data);
          break;
        case 'pong':
          console.log('🏓 Pong received:', data.data);
          break;
        case 'message_deleted':
          console.log('🗑️ Message deleted:', data.data);
          // Handle real-time message deletion
          if (data.data?.messageId) {
            dispatch({ type: 'REMOVE_MESSAGE', payload: data.data.messageId });
          }
          break;
        case 'message_updated':
          console.log('✏️ Message updated:', data.data);
          // Handle real-time message updates
          if (data.data?.message) {
            dispatch({ type: 'UPDATE_MESSAGE', payload: data.data.message });
          }
          break;
        default:
          console.log('❓ Unknown message type:', data.type);
      }
    });

    // Attempt to connect
    wsManager.connect().catch((error) => {
      console.error('❌ Failed to establish real-time connection:', error);
      setWsConnected(false);
    });

    return () => {
      wsManager.disconnect();
      setWsConnected(false);
      console.log('🔌 Real-time connection closed');
    };
  }, [user]); // Re-run when user changes

  // Render a loading screen while auth state is being determined
  if (loading) {
    return (
      <div className="bg-background text-on-background h-screen w-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="body-medium text-on-surface-variant">Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, render the login page
  if (!user) {
    return <LoginPage />;
  }

  // Main content switcher based on the current page state
  const renderCurrentPage = () => {
    switch (state.currentPage) {
      case 'users':
        //@ts-expect-error
        return <div className="h-screen w-screen flex overflow-hidden"><Sidebar onNavigate={(page) => dispatch({ type: 'NAVIGATE', payload: page })} onLogout={handleLogout} chats={state.chats} selectedChat={null} onChatSelect={() => {}} isLoadingAllChats={state.isLoadingChats} /><UsersPage /></div>;
      case 'chat':
      case 'allChats':
      default:
        return <ChatLayout state={state} dispatch={dispatch} onLogout={handleLogout} wsConnected={wsConnected} />;
    }
  };

  return (
    <ToastProvider>
      {renderCurrentPage()}
    </ToastProvider>
  );
}