import React, { useState, useEffect, useReducer } from 'react';
import Sidebar from './Components/Sidebar'
import ChatHeader from './Components/ChatHeader'
import MessageBubble from './Components/MessageBubble'
import ChatInput from './Components/ChatInput'
import StickyStatus from './Components/StickyStatus'
import Icon from './Components/Icon'
import LoginPage from './Pages/Login';
import AllChats from './Pages/AllChats';
import authService from './Library/Authentication/jwt';
import { threadsApiService } from './Library/Shared/threadsApi';
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

interface MessageData {
  id: string
  user: User
  time: string
  content: string
  reactions?: { emoji: string; count: number; active?: boolean }[]
  isHighlighted?: boolean
  meta?: {
    type: 'progress'
    label: string
    current: string
    total: string
    percentage: number
  }
}

// State management with useReducer
interface AppState {
  isLoggedIn: boolean;
  isLoading: boolean;
  chats: Thread[];
  selectedChat: Thread | null;
  showAllChats: boolean;
  isLoadingAllChats: boolean;
}

type AppAction =
  | { type: 'LOGIN_SUCCESS' }
  | { type: 'LOGOUT' }
  | { type: 'SET_CHATS'; payload: Thread[] }
  | { type: 'SELECT_CHAT'; payload: Thread | null }
  | { type: 'SHOW_ALL_CHATS' }
  | { type: 'HIDE_ALL_CHATS' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ALL_CHATS_LOADING'; payload: boolean };

const initialState: AppState = {
  isLoggedIn: false,
  isLoading: true,
  chats: [],
  selectedChat: null,
  showAllChats: false,
  isLoadingAllChats: false,
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'LOGIN_SUCCESS':
      return { ...state, isLoggedIn: true };
    case 'LOGOUT':
      return { ...state, isLoggedIn: false, selectedChat: null };
    case 'SET_CHATS':
      return { ...state, chats: action.payload, selectedChat: state.selectedChat ? action.payload.find(c => c.id === state.selectedChat!.id) || null : null };
    case 'SELECT_CHAT':
      return { ...state, selectedChat: action.payload, showAllChats: false };
    case 'SHOW_ALL_CHATS':
      return { ...state, showAllChats: true, isLoadingAllChats: true };
    case 'HIDE_ALL_CHATS':
      return { ...state, showAllChats: false };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ALL_CHATS_LOADING':
      return { ...state, isLoadingAllChats: action.payload };
    default:
      return state;
  }
}

export default function Main() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const { isLoggedIn, isLoading, chats, selectedChat, showAllChats, isLoadingAllChats } = state;

  // Check authentication and fetch initial data
  useEffect(() => {
    const checkAuthAndFetchData = async () => {
      dispatch({ type: 'SET_LOADING', payload: true });
      const authenticated = authService.isAuthenticated();
      if (authenticated) {
        dispatch({ type: 'LOGIN_SUCCESS' });
        try {
          const response = await threadsApiService.getThreads({ limit: 50 }); // Fetch initial chats
          dispatch({ type: 'SET_CHATS', payload: response.threads });
          if (response.threads.length > 0) {
            // Select the most recently updated chat by default
            const latestChat = response.threads.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
            dispatch({ type: 'SELECT_CHAT', payload: latestChat });
          }
        } catch (error) {
          console.error("Failed to fetch threads:", error);
          // Handle error appropriately, maybe show a toast notification
        }
      }
      dispatch({ type: 'SET_LOADING', payload: false });
    };

    checkAuthAndFetchData();
  }, []);

  const handleLoginSuccess = () => {
    window.location.reload(); // Reload to re-trigger the auth check and data fetch
  };

  const handleLogout = () => {
    authService.logout();
    dispatch({ type: 'LOGOUT' });
  };

  const handleChatSelect = (chat: Thread) => {
    dispatch({ type: 'SELECT_CHAT', payload: chat });
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

  // Mock Data
  const messages: MessageData[] = [
    {
      id: '1',
      user: { id: 'lisa', name: 'Lisa M.', initial: 'L', color: 'bg-purple-500' },
      time: '09:15 AM',
      content: "Morning team! Let's focus on the Q4 targets today. We need to close the gap on the enterprise segment. Here is the current breakdown.",
      meta: {
        type: 'progress',
        label: 'Enterprise Goal',
        current: '$1.2M',
        total: '$1.5M',
        percentage: 80
      }
    },
    {
      id: '2',
      user: { id: 'mike', name: 'Mike R.', avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBwqGfqTiF7ysIL2yqhvrkNg0KbUaRRwbznJQ0_VnPMmEimDwfFjpiOI__hl4c2ZSGcz7gZTp73TCa_Ai2ildqlK43IZ3VuPEObUFMZRb1DltxZ_OLbHgrx392Z_QC6PXF60uY7P5JicU7JRNeCQipThU_kxm_L2TdNQEB6LKxYGv2rEJH1064BItoA7lGLKxOeprFIfNyCMqrmWqcs9uf2YYHJi5Pxrtf7sC4VLLzIr_mrJ3g2G8mXUSQgius4_AzS49rJF5Ym2rE' },
      time: '09:42 AM',
      content: "I've just updated the CRM with the latest from Acme Corp. They are ready to sign but need a final review of the SLA.",
      reactions: [{ emoji: '🔥', count: 2 }]
    },
    {
      id: '3',
      user: { id: 'alex', name: 'Alex T.', initial: 'A', color: 'bg-blue-500' },
      time: '10:05 AM',
      content: "@Mike R. I'll handle the SLA review this afternoon. Can you ping me the document ID?",
      isHighlighted: true
    }
  ]

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
            <StickyStatus selectedChat={selectedChat} />

            <div className="flex flex-col gap-1 pb-4 px-6 -mt-2">
              {selectedChat ? (
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

                  {/* Chat Messages Area - Placeholder */}
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="size-16 rounded-full bg-surface-variant/50 flex items-center justify-center mb-4">
                      <Icon name="chat" className="text-on-surface-variant" size={32} />
                    </div>
                    <h3 className="title-medium text-on-surface mb-2">Chat Messages</h3>
                    <p className="body-medium text-on-surface-variant max-w-md">
                      This is where chat messages for "{selectedChat.channelName}" would appear.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  {/* Date Divider */}
                  <div className="relative py-6 flex items-center justify-center">
                    <div className="absolute left-0 right-0 h-px bg-surface-variant" />
                    <div className="relative bg-surface px-3 rounded-full border border-outline text-xs font-medium text-on-surface-variant">
                      Today, Oct 24
                    </div>
                  </div>

                  {/* Messages */}
                  {messages.map((msg) => (
                    <MessageBubble key={msg.id} data={msg} />
                  ))}
                </>
              )}

              <div className="h-2" />
            </div>
          </div>

          <ChatInput />
        </main>
      )}
    </div>
  )
}