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
import { getProfileImageUrl } from './Library/Shared/profileUtils';
import type { Thread } from './Library/Shared/threadsApi'

// The 'Chat' type is now an alias for the 'Thread' type from the API service.
export type { Thread as Chat };

// Types
interface User {
  id: string
  name: string
  avatarUrl?: string
  initial?: string
  color?: string
}

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
  | { type: 'ADD_MESSAGE'; payload: ApiMessageData };

const initialState: AppState = {
  isLoggedIn: false,
  isLoading: true,
  chats: [],
  selectedChat: null,
  showAllChats: false,
  isLoadingAllChats: false,
  messages: [],
  isLoadingMessages: false,
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'LOGIN_SUCCESS':
      return { ...state, isLoggedIn: true };
    case 'LOGOUT':
      return { ...state, isLoggedIn: false, selectedChat: null, messages: [] };
    case 'SET_CHATS':
      return { ...state, chats: action.payload, selectedChat: state.selectedChat ? action.payload.find(c => c.id === state.selectedChat!.id) || null : null };
    case 'SELECT_CHAT':
      return { ...state, selectedChat: action.payload, showAllChats: false, messages: [], isLoadingMessages: action.payload !== null };
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
    default:
      return state;
  }
}

export default function Main() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const { isLoggedIn, isLoading, chats, selectedChat, showAllChats, isLoadingAllChats, messages, isLoadingMessages } = state;

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
      
      // Test proxy connection
      testProxyConnection();
      
      // Check if proxy has a valid session FIRST
      console.log('Checking proxy session...');
      const proxySession = await authService.checkProxySession();
      console.log('Proxy session check result:', proxySession);
      
      // Debug authentication state
      debugAuthState();
      
      // Wait a moment for auth state to settle
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Check authentication - either local state or proxy session
      const localAuth = authService.isAuthenticated();
      const authenticated = localAuth || proxySession.authenticated;
      
      console.log('Authentication check results:', {
        localAuth,
        proxyAuth: proxySession.authenticated,
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
          if (response.threads.length > 0) {
            // Select the most recently updated chat by default
            const latestChat = response.threads.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
            dispatch({ type: 'SELECT_CHAT', payload: latestChat });
          }
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
      if (response.threads.length > 0) {
        const latestChat = response.threads.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
        dispatch({ type: 'SELECT_CHAT', payload: latestChat });
      }
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
    
    // Load messages for the selected chat using UUID or channelId mapping
    try {
      const identifier = messagesApiService.getMessageIdentifier(chat);
      console.log('📋 Using identifier for messages:', identifier);
      
      if (identifier) {
        const response = await messagesApiService.getMessages(identifier, { limit: 100 });
        dispatch({ type: 'SET_MESSAGES', payload: response.messages });
      } else {
        console.warn('⚠️ No valid identifier found for chat:', chat);
        dispatch({ type: 'SET_MESSAGES', payload: [] });
      }
    } catch (error) {
      console.error("❌ Failed to fetch messages:", error);
      dispatch({ type: 'SET_MESSAGES_LOADING', payload: false });
    }
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

  const handleSendMessage = async (content: string, attachments?: any[]) => {
    if (!selectedChat) {
      console.warn('⚠️ No chat selected for sending message');
      return;
    }

    console.log('📤 Sending message to chat:', {
      chatId: selectedChat.id,
      channelName: selectedChat.channelName,
      content: content.substring(0, 50) + (content.length > 50 ? '...' : '')
    });

    try {
      const identifier = messagesApiService.getMessageIdentifier(selectedChat);
      if (identifier) {
        const response = await messagesApiService.sendMessage(identifier, {
          content,
          attachments
        });
        
        if (response.success) {
          console.log('✅ Message sent successfully');
          dispatch({ type: 'ADD_MESSAGE', payload: response.message });
        }
      } else {
        console.error('❌ No valid identifier for sending message to chat:', selectedChat);
      }
    } catch (error) {
      console.error("❌ Failed to send message:", error);
    }
  };

  const testProxyConnection = async () => {
    try {
      console.log('Testing proxy connection...');
      const response = await fetch('http://localhost:8640/health');
      const data = await response.json();
      console.log('Proxy health check:', data);
      
      const authStatus = await fetch('http://localhost:8640/auth/status', {
        headers: {
          'X-Session-Id': (window as any).sessionId || 'desktop-session'
        }
      });
      const authData = await authStatus.json();
      console.log('Auth status:', authData);
    } catch (error) {
      console.error('Proxy connection test failed:', error);
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
          <ChatHeader selectedChat={selectedChat} onLogout={handleLogout} chatCount={chats.length} />

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
                            reactions: message.reactions || []
                          }} 
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

          <ChatInput onSendMessage={handleSendMessage} />
        </main>
      )}
    </div>
  )
}