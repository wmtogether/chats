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
import { preprocessChat } from './Library/utils/api.ts';
import { createWebSocketManager, getWebSocketManager } from './Library/utils/websocket.ts';
import { localStorageManager, shouldRestoreState, findChatByUuid } from './Library/utils/localStorage.ts';
import DebugPanel from './Components/DebugPanel.tsx';

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
}

type AppAction =
  | { type: 'NAVIGATE'; payload: Page }
  | { type: 'SET_CHATS'; payload: any[] }
  | { type: 'SET_MESSAGES'; payload: any[] }
  | { type: 'SELECT_CHAT'; payload: any | null }
  | { type: 'SET_REPLYING_TO'; payload: { messageId: string; userName: string; content: string } | null }
  | { type: 'SET_LOADING_CHATS'; payload: boolean }
  | { type: 'SET_LOADING_MESSAGES'; payload: boolean }
  | { type: 'RESTORE_STATE'; payload: { page: Page; selectedChat: ChatType | null } };

const initialState: AppState = {
  currentPage: 'chat',
  chats: [],
  messages: [],
  selectedChat: null,
  replyingTo: null,
  isLoadingChats: false,
  isLoadingMessages: false,
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
        return { ...state, messages: action.payload, isLoadingMessages: false };
    case 'SELECT_CHAT':
      // When a chat is selected, clear previous messages and navigate back to the main chat view
      // Save selected chat to localStorage
      localStorageManager.saveSelectedChat(action.payload);
      return { ...state, selectedChat: action.payload, messages: [], currentPage: 'chat', replyingTo: null, isLoadingMessages: false };
    case 'SET_REPLYING_TO':
      return { ...state, replyingTo: action.payload };
    case 'SET_LOADING_CHATS':
      return { ...state, isLoadingChats: action.payload };
    case 'SET_LOADING_MESSAGES':
      return { ...state, isLoadingMessages: action.payload };
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


  // Placeholder functions
  const handleCreateChat = (chatData: any) => console.log('Creating new chat:', chatData);
  const handleUpdateChat = (chatId: number, updates: any) => console.log('Updating chat:', chatId, updates);
  const handleDeleteChat = (chatId: number) => {
    console.log('Deleting chat:', chatId);
    // Simulate deletion by filtering the chats array
    dispatch({ type: 'SET_CHATS', payload: chats.filter(chat => chat.id !== chatId) });
    // If the deleted chat was the selected chat, deselect it
    if (selectedChat?.id === chatId) {
      dispatch({ type: 'SELECT_CHAT', payload: null });
    }
  };
  const handleRefreshChats = () => console.log('Refreshing chats...');
  const handleSendMessage = (content: string, attachments?: any[], replyTo?: any) => console.log('Sending message:', content, attachments, replyTo);
  const handleReaction = (messageId: string, emoji: string) => console.log('Adding reaction:', messageId, emoji);
  const handleEditMessage = (messageId: string, newContent: string, attachments?: string[]) => console.log('Editing message:', messageId, newContent);
  const handleDeleteMessage = (messageId: string) => console.log('Deleting message:', messageId);

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
          <ChatHeader selectedChat={selectedChat} onLogout={onLogout} chatCount={chats.length} wsConnected={wsConnected} />

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
                      return <MessageBubble key={msg.messageId} data={messageData} />;
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
    const wsManager = createWebSocketManager('ws://localhost:5669/ws'); // Match Go server port
    
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
      console.log('� Real-time message received:', data);
      
      // Handle different message types
      switch (data.type) {
        case 'queue_update':
          console.log('� Queue update:', data.data);
          // You can dispatch actions here to update the queue in UI
          break;
        case 'chat_message':
          console.log('� Chat message:', data.data);
          // Handle real-time chat messages
          break;
        case 'upload_progress':
          console.log('� Upload progress:', data.data);
          // Handle real-time upload progress updates
          break;
        case 'image_uploaded':
          console.log('🖼️ Image uploaded:', data.data);
          // Handle image upload notifications
          break;
        case 'user_joined':
          console.log('� User joined:', data.data);
          break;
        case 'status_update':
          console.log('📊 Status update:', data.data);
          break;
        case 'pong':
          console.log('🏓 Pong received:', data.data);
          break;
        default:
          console.log('� Unknown message type:', data.type);
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