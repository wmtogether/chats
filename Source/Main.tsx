import { useReducer, useEffect } from 'react';
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

type Page = 'chat' | 'users' | 'allChats';

// The reducer now manages UI state, including the current page
interface AppState {
  currentPage: Page;
  chats: any[];
  messages: any[];
  selectedChat: any | null;
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
  | { type: 'SET_LOADING_MESSAGES'; payload: boolean };

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
      return { ...state, currentPage: action.payload };
    case 'SET_CHATS':
      return { ...state, chats: action.payload, isLoadingChats: false };
    case 'SET_MESSAGES':
        return { ...state, messages: action.payload, isLoadingMessages: false };
    case 'SELECT_CHAT':
      // When a chat is selected, clear previous messages and navigate back to the main chat view
      return { ...state, selectedChat: action.payload, messages: [], currentPage: 'chat', replyingTo: null, isLoadingMessages: false };
    case 'SET_REPLYING_TO':
      return { ...state, replyingTo: action.payload };
    case 'SET_LOADING_CHATS':
      return { ...state, isLoadingChats: action.payload };
    case 'SET_LOADING_MESSAGES':
      return { ...state, isLoadingMessages: action.payload };
    default:
      return state;
  }
}

// Main component for the authenticated chat experience
const ChatLayout = ({ state, dispatch, onLogout }: { state: AppState, dispatch: React.Dispatch<AppAction>, onLogout: () => void }) => {
  const { selectedChat, replyingTo, chats, messages, isLoadingChats, isLoadingMessages } = state;
  const { user } = useAuth();

  // Fetch all chats when the user is authenticated
  useEffect(() => {
    const fetchChats = async () => {
      if (user) { // Only fetch if we have a user
        dispatch({ type: 'SET_LOADING_CHATS', payload: true });
        try {
          const response = await apiClient.get('/chats');
          dispatch({ type: 'SET_CHATS', payload: response.data.data || [] });
        } catch (error) {
          console.error("Failed to fetch chats:", error);
          dispatch({ type: 'SET_LOADING_CHATS', payload: false });
        }
      }
    };
    fetchChats();
  }, [user]); // Re-run when user object changes

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
  const handleDeleteChat = (chatId: number) => console.log('Deleting chat:', chatId);
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
          <ChatHeader selectedChat={selectedChat} onLogout={onLogout} chatCount={chats.length} redisConnected={false} />

          <div className="flex-1 overflow-y-auto flex flex-col relative" id="message-container">
            <StickyStatus
              selectedChat={selectedChat}
              onStatusUpdate={(newStatus) => console.log('Queue status updated to:', newStatus)}
            />

            <div className="flex flex-col gap-1 pb-4 px-6 -mt-2">
              {selectedChat ? (
                <>
                  <div className="relative py-6 flex items-center justify-center">
                    <div className="absolute left-0 right-0 h-px bg-surface-variant" />
                    <div className="relative bg-surface px-3 rounded-full border border-outline text-xs font-medium text-on-surface-variant">
                      {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                  </div>
                  {messages.length > 0 ? (
                    messages.map(msg => {
                      const messageData = {
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
    </div>
  )
}

export default function Main() {
  const { user, loading, logout } = useAuth();
  const [state, dispatch] = useReducer(appReducer, initialState);

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
        return <div className="h-screen w-screen flex overflow-hidden"><Sidebar onNavigate={(page) => dispatch({ type: 'NAVIGATE', payload: page })} onLogout={logout} chats={state.chats} selectedChat={null} onChatSelect={() => {}} isLoadingAllChats={state.isLoadingChats} /><UsersPage /></div>;
      case 'chat':
      case 'allChats':
      default:
        return <ChatLayout state={state} dispatch={dispatch} onLogout={logout} />;
    }
  };

  return renderCurrentPage();
}