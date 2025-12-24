import React, { useState, useEffect } from 'react';
import Sidebar from './Components/Sidebar'
import ChatHeader from './Components/ChatHeader'
import MessageBubble from './Components/MessageBubble'
import ChatInput from './Components/ChatInput'
import StickyStatus from './Components/StickyStatus'
import Icon from './Components/Icon'
import LoginPage from './Pages/Login';
import AllChats from './Pages/AllChats';
import authService from './Library/Authentication/jwt';
import type { Chat } from './Components/Chatlists';

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

export default function Main() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [showAllChats, setShowAllChats] = useState(false);
  const [isLoadingAllChats, setIsLoadingAllChats] = useState(false);

  // Check authentication status on component mount
  useEffect(() => {
    const checkAuth = () => {
      const authenticated = authService.isAuthenticated();
      setIsLoggedIn(authenticated);
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    authService.logout();
    setIsLoggedIn(false);
  };

  const handleChatSelect = (chat: Chat) => {
    setSelectedChat(chat);
    setShowAllChats(false); // Close all chats view when a chat is selected
  };

  const handleShowAllChats = () => {
    setIsLoadingAllChats(true);
    setShowAllChats(true);
    
    // Simulate loading delay (remove this in production and replace with actual data fetching)
    setTimeout(() => {
      setIsLoadingAllChats(false);
    }, 1500);
  };

  const handleBackFromAllChats = () => {
    setShowAllChats(false);
    setIsLoadingAllChats(false); // Reset loading state when going back
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
        onChatSelect={handleChatSelect} 
        onShowAllChats={handleShowAllChats}
        isLoadingAllChats={isLoadingAllChats}
      />
      
      {showAllChats ? (
        <AllChats 
          onChatSelect={handleChatSelect}
          onBack={handleBackFromAllChats}
          selectedChatId={selectedChat?.id}
          isLoading={isLoadingAllChats}
        />
      ) : (
        <main className="flex-1 flex flex-col min-w-0 bg-surface relative">
          <ChatHeader selectedChat={selectedChat} />

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