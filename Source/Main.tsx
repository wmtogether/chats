import React, { useState, useEffect } from 'react';
import Sidebar from './Components/Sidebar'
import ChatHeader from './Components/ChatHeader'
import MessageBubble from './Components/MessageBubble'
import ChatInput from './Components/ChatInput'
import StickyStatus from './Components/StickyStatus'
import LoginPage from './Pages/Login';
import authService from './Library/Authentication/jwt';

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
    <div className="bg-background text-on-background h-screen w-full flex overflow-hidden selection:bg-primary/30 selection:text-on-primary ">
      <Sidebar />
      
      <main className="flex-1 flex flex-col min-w-0 bg-surface relative">
        <ChatHeader />

        <div className="flex-1 overflow-y-auto flex flex-col relative" id="message-container">
          <StickyStatus />

          <div className="flex flex-col gap-1 pb-4 px-6 -mt-2">
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
            
            <div className="h-2" />
          </div>
        </div>

        <ChatInput />
      </main>
    </div>
  )
}