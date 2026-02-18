import { useReducer, useEffect, useState, useRef } from 'react';
import { MessageCircle, UserPlus } from 'lucide-react'
import Sidebar from './Components/Sidebar'
import ChatHeader from './Components/ChatHeader'
import ChatInput from './Components/ChatInput'
import StickyStatus from './Components/StickyStatus'
import LoginPage from './Pages/Login';
import AllChats from './Pages/AllChats';
import UsersPage from './Pages/Users';
import FileManager from './Components/FileManager';
import { useAuth, apiClient } from './Library/Authentication/AuthContext';
import MessageBubble from './Components/MessageBubble';
import { ToastProvider, useToast } from './Library/hooks/useToast.tsx';
import type { ChatType, MessageType } from './Library/types.ts';
import { preprocessChat, deleteChat, createChat, sendMessage, deleteMessage, editMessage, addReaction } from './Library/utils/api.ts';
import { createWebSocketManager, getWebSocketManager } from './Library/utils/websocket.ts';
import { localStorageManager, shouldRestoreState, findChatByUuid } from './Library/utils/localStorage.ts';
import { getWebSocketUrl } from './Library/utils/env.ts';
import { getNullStringValue } from './Library/utils/api.ts';
import { getUserJoinedChats, joinChat, leaveChat } from './Library/Shared/chatMemberApi';

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
  | { type: 'ADD_CHAT_IF_NOT_EXISTS'; payload: ChatType }
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
      // Deduplicate chats by UUID before setting
      const uniqueChats = action.payload.reduce((acc: ChatType[], chat: ChatType) => {
        const existingIndex = acc.findIndex((c: ChatType) => c.uuid === chat.uuid);
        if (existingIndex === -1) {
          acc.push(chat);
        } else {
          // Keep the one with higher ID (more recent)
          if (chat.id > acc[existingIndex].id) {
            acc[existingIndex] = chat;
          }
        }
        return acc;
      }, [] as ChatType[]);
      
      console.log('💬 SET_CHATS:', {
        originalCount: action.payload.length,
        uniqueCount: uniqueChats.length,
        duplicatesRemoved: action.payload.length - uniqueChats.length
      });
      
      return { ...state, chats: uniqueChats, isLoadingChats: false };
    case 'SET_MESSAGES':
        return { ...state, messages: action.payload, isLoadingMessages: false, newMessageIds: new Set() };
    case 'SELECT_CHAT':
      // When a chat is selected, clear previous messages and navigate back to the main chat view
      // Save selected chat to localStorage
      localStorageManager.saveSelectedChat(action.payload);
      
      // Update URL with chat parameter
      if (action.payload) {
        const url = new URL(window.location.href);
        const chatUuid = action.payload.uuid;
        console.log('🔗 SELECT_CHAT: Updating URL with UUID:', chatUuid, 'Chat object:', action.payload);
        
        if (chatUuid) {
          url.searchParams.set('chat', chatUuid);
          window.history.pushState({}, '', url.toString());
        } else {
          console.error('🔗 SELECT_CHAT: Chat UUID is undefined!', action.payload);
        }
      } else {
        // Clear chat parameter if no chat selected
        const url = new URL(window.location.href);
        url.searchParams.delete('chat');
        window.history.pushState({}, '', url.toString());
      }
      
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
    case 'ADD_CHAT_IF_NOT_EXISTS':
      // Add a new chat only if it doesn't already exist (for WebSocket events)
      const chatExists = state.chats.some(chat => chat.uuid === action.payload.uuid);
      console.log('💬 ADD_CHAT_IF_NOT_EXISTS check:', {
        newChatUuid: action.payload.uuid,
        newChatId: action.payload.id,
        newChatName: action.payload.channelName,
        existingChatCount: state.chats.length,
        existingUuids: state.chats.map(c => c.uuid),
        chatExists
      });
      if (chatExists) {
        console.log('💬 Chat already exists, skipping duplicate:', action.payload.channelName);
        return state;
      }
      console.log('💬 Adding new chat via WebSocket');
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
const ChatLayout = ({ 
  state, 
  dispatch, 
  onLogout, 
  wsConnected,
  joinedChats,
  isLoadingMembership,
  onJoinChat,
  onLeaveChat
}: { 
  state: AppState, 
  dispatch: React.Dispatch<AppAction>, 
  onLogout: () => void, 
  wsConnected: boolean,
  joinedChats: Set<number>,
  isLoadingMembership: boolean,
  onJoinChat: (chatId: number) => Promise<void>,
  onLeaveChat: (chatId: number) => Promise<void>
}) => {
  const { selectedChat, replyingTo, chats, messages, isLoadingChats, isLoadingMessages } = state;
  const { user } = useAuth();
  const { addToast } = useToast();

  // Mobile sidebar states
  const [showLeftSidebar, setShowLeftSidebar] = useState(true); // Open by default on desktop
  const [showRightSidebar, setShowRightSidebar] = useState(true);

  // Check if user is a member of the selected chat
  const isChatMember = (chat: ChatType | null): boolean => {
    if (!chat || !user) return false;
    
    // User is always a member of chats they created
    if (chat.createdById === user.id) return true;
    
    // Check if user has explicitly joined
    return joinedChats.has(chat.id);
  };

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
    if (chats.length > 0 && !selectedChat) {
      // Check for URL parameter first
      const urlParams = new URLSearchParams(window.location.search);
      const chatUuidFromUrl = urlParams.get('chat');
      
      if (chatUuidFromUrl) {
        console.log('� Chat UUID from URL:', chatUuidFromUrl);
        const chatFromUrl = findChatByUuid(chats, chatUuidFromUrl);
        if (chatFromUrl) {
          console.log('🔗 Found chat from URL, selecting:', chatFromUrl.channelName);
          addToast({ message: `Opening chat: ${chatFromUrl.channelName}`, type: 'success' });
          dispatch({ 
            type: 'SELECT_CHAT', 
            payload: chatFromUrl 
          });
          // Clear the URL parameter after selecting
          window.history.replaceState({}, '', window.location.pathname);
          return;
        } else {
          console.log('🔗 Chat from URL not found');
          addToast({ message: 'Chat not found', type: 'error' });
        }
      }
      
      // Fall back to localStorage restoration if no URL parameter or chat not found
      if (shouldRestoreState()) {
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
        
        console.log('💬 handleCreateChat - Chat created via API:', {
          uuid: processedChat.uuid,
          id: processedChat.id,
          name: processedChat.channelName,
          currentChatCount: chats.length
        });
        
        // Add the new chat to the local state immediately for better UX
        dispatch({ type: 'ADD_CHAT', payload: processedChat });
        
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
    <div className="bg-background text-on-background h-screen w-screen flex overflow-hidden selection:bg-primary/30 selection:text-on-primary relative">
      {/* Left Sidebar - Always visible on desktop, hidden on mobile */}
      <div className="hidden lg:block">
        <Sidebar
          onNavigate={(page) => {
            dispatch({ type: 'NAVIGATE', payload: page });
          }}
          onLogout={onLogout}
          chats={chats}
          selectedChat={selectedChat}
          onChatSelect={(chat) => {
            dispatch({ type: 'SELECT_CHAT', payload: chat });
          }}
          isLoadingAllChats={isLoadingChats}
          onCreateChat={handleCreateChat}
          //@ts-expect-error
          onDeleteChat={handleDeleteChat}
          joinedChats={joinedChats}
          onJoinChat={onJoinChat}
          onLeaveChat={onLeaveChat}
        />
      </div>

      {state.currentPage === 'allChats' ? (
        <AllChats
          chats={chats}
          onChatSelect={(chat) => {
            dispatch({ type: 'SELECT_CHAT', payload: chat });
          }}
          onBack={() => dispatch({ type: 'NAVIGATE', payload: 'chat' })}
          selectedChatId={selectedChat?.id}
          isLoading={isLoadingChats}
        />
      ) : (
        <>
          <main className="flex-1 flex flex-col min-w-0 bg-surface h-full pb-0 lg:pb-0">
            <ChatHeader 
              selectedChat={selectedChat} 
              chatCount={chats.length} 
              wsConnected={wsConnected} 
              onChatUpdate={handleChatUpdate}
              onToggleRightSidebar={() => setShowRightSidebar(!showRightSidebar)}
              showRightSidebar={showRightSidebar}
            />

            <div className="flex-1 overflow-y-auto flex flex-col relative min-h-0 pb-32 lg:pb-0" id="message-container">
              <StickyStatus
                selectedChat={selectedChat}
                onStatusUpdate={(newStatus) => console.log('Queue status updated to:', newStatus)}
              />

              <div className="flex flex-col gap-1 pb-4 px-3 sm:px-6 -mt-2 flex-1">
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

            {/* Message Input - Let ChatInput handle its own positioning */}
            {selectedChat && (
              isChatMember(selectedChat) ? (
                <ChatInput
                  onSendMessage={handleSendMessage}
                  replyingTo={replyingTo}
                  onCancelReply={() => dispatch({ type: 'SET_REPLYING_TO', payload: null })}
                  currentChat={selectedChat}
                />
              ) : (
                <div className="fixed bottom-16 left-0 right-0 lg:relative lg:bottom-auto p-3 sm:p-6 bg-surface border-t border-outline">
                  <div className="bg-surface-container border border-outline-variant rounded-3xl p-4 sm:p-6 flex flex-col items-center text-center">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-primary/10 flex items-center justify-center mb-3 sm:mb-4">
                      <UserPlus className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
                    </div>
                    <h3 className="title-medium text-on-surface mb-2 text-sm sm:text-base">
                      Join to Participate
                    </h3>
                    <p className="body-medium text-on-surface-variant mb-3 sm:mb-4 max-w-md text-xs sm:text-sm">
                      You need to join this chat to send messages and participate in the conversation.
                    </p>
                    <button
                      onClick={async () => {
                        try {
                          await onJoinChat(selectedChat.id);
                          addToast({ message: `You joined "${selectedChat.channelName}"`, type: 'success' });
                        } catch (error) {
                          console.error('Failed to join chat:', error);
                          addToast({ message: 'Failed to join chat', type: 'error' });
                        }
                      }}
                      disabled={isLoadingMembership}
                      className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-primary text-on-primary rounded-full hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed label-large text-sm sm:text-base"
                    >
                      <UserPlus size={18} className="sm:size-5" />
                      Join Chat
                    </button>
                  </div>
                </div>
              )
            )}
          </main>

          {/* File Manager - Right Sidebar - Toggleable */}
          {showRightSidebar && (
            <div className="transition-all duration-300 ease-in-out hidden md:block h-full">
              <FileManager 
                uniqueId={selectedChat?.uniqueId}
                onPostFile={(fileName, filePath) => {
                  // Post file as a message attachment
                  if (selectedChat) {
                    const fileMetadata = JSON.stringify({
                      type: 'file_attachment',
                      fileName: fileName,
                      filePath: filePath,
                    });
                    handleSendMessage(`📎 ${fileName}`, [fileMetadata]);
                  }
                }}
              />
            </div>
          )}
        </>
      )}

      {/* Mobile Bottom Navigation - Only visible on mobile */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-outline z-40">
        <div className="flex items-center justify-around h-16">
          <button
            onClick={() => dispatch({ type: 'NAVIGATE', payload: 'allChats' })}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
              state.currentPage === 'allChats' ? 'text-primary' : 'text-on-surface-variant'
            }`}
          >
            <MessageCircle size={24} />
            <span className="text-xs mt-1">Chats</span>
          </button>
          
          <button
            onClick={() => dispatch({ type: 'NAVIGATE', payload: 'chat' })}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
              state.currentPage === 'chat' ? 'text-primary' : 'text-on-surface-variant'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="text-xs mt-1">Messages</span>
          </button>
          
          <button
            onClick={() => dispatch({ type: 'NAVIGATE', payload: 'users' })}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
              state.currentPage === 'users' ? 'text-primary' : 'text-on-surface-variant'
            }`}
          >
            <UserPlus size={24} />
            <span className="text-xs mt-1">Users</span>
          </button>
          
          <button
            onClick={onLogout}
            className="flex flex-col items-center justify-center flex-1 h-full text-on-surface-variant transition-colors hover:text-error"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="text-xs mt-1">Logout</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Main() {
  const { user, loading, logout } = useAuth();
  const [state, dispatch] = useReducer(appReducer, initialState);

  // WebSocket state for real-time communication
  const [wsConnected, setWsConnected] = useState(false);
  
  // Track joined chats
  const [joinedChats, setJoinedChats] = useState<Set<number>>(new Set());
  const [isLoadingMembership, setIsLoadingMembership] = useState(true);

  // Track message IDs that are being processed to prevent race condition duplicates
  const processingMessageIds = useRef<Set<string>>(new Set());

  // Load user's joined chats on mount
  useEffect(() => {
    const loadJoinedChats = async () => {
      if (!user) return;
      
      setIsLoadingMembership(true);
      try {
        const chatIds = await getUserJoinedChats();
        setJoinedChats(new Set(chatIds));
      } catch (error) {
        console.error('Failed to load joined chats:', error);
      } finally {
        setIsLoadingMembership(false);
      }
    };

    loadJoinedChats();
  }, [user]);

  // Check if user is a member of the selected chat
  const isChatMember = (chat: ChatType | null): boolean => {
    if (!chat || !user) return false;
    
    // User is always a member of chats they created
    if (chat.createdById === user.id) return true;
    
    // Check if user has explicitly joined
    return joinedChats.has(chat.id);
  };

  // Handle joining a chat
  const handleJoinChat = async (chatId: number) => {
    try {
      await joinChat(chatId);
      setJoinedChats(prev => new Set(prev).add(chatId));
    } catch (error) {
      console.error('Failed to join chat:', error);
      throw error;
    }
  };

  // Handle leaving a chat
  const handleLeaveChat = async (chatId: number) => {
    try {
      await leaveChat(chatId);
      setJoinedChats(prev => {
        const newSet = new Set(prev);
        newSet.delete(chatId);
        return newSet;
      });
    } catch (error) {
      console.error('Failed to leave chat:', error);
      throw error;
    }
  };

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

  // Separate effect for handling WebSocket messages that depends on state
  useEffect(() => {
    const wsManager = getWebSocketManager();
    if (!wsManager) return;

    const handleMessage = (data: any) => {
      // Handle incoming real-time messages
      console.log('📨 Real-time message received:', data);
      console.log('📨 Message type:', data.type);
      console.log('📨 Message data:', data.data);
      console.log('📨 Current selected chat:', state.selectedChat?.uuid);
      console.log('📨 Current messages count:', state.messages.length);
      
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
            // Use ADD_CHAT_IF_NOT_EXISTS to prevent duplicates
            dispatch({ type: 'ADD_CHAT_IF_NOT_EXISTS', payload: processedChat });
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
            console.log('💬 Processed chat with updated status:', {
              uuid: processedChat.uuid,
              status: processedChat.status,
              channelName: processedChat.channelName
            });
            dispatch({ type: 'UPDATE_CHAT', payload: processedChat });
            
            // If this is the currently selected chat, update it immediately
            if (state.selectedChat?.uuid === data.data.chat.uuid) {
              console.log('💬 Updating currently selected chat with new status');
              dispatch({ type: 'SELECT_CHAT', payload: processedChat });
            }
          }
          break;
        case 'chat_message':
          console.log('💬 Chat message received via WebSocket:', data.data);
          console.log('💬 Message object:', data.data?.message);
          console.log('💬 Message ID:', data.data?.message?.messageId);
          console.log('💬 Chat UUID:', data.data?.chatUuid);
          console.log('💬 Current selected chat UUID:', state.selectedChat?.uuid);
          console.log('💬 Current messages:', state.messages.map(m => ({ id: m.messageId, content: m.content.substring(0, 50) })));
          
          // Handle real-time chat messages
          if (data.data?.message && data.data?.chatUuid) {
            const messageId = data.data.message.messageId;
            
            // Only add message if it's for the currently selected chat
            if (state.selectedChat?.uuid === data.data.chatUuid) {
              // Check if message is already being processed (race condition protection)
              if (processingMessageIds.current.has(messageId)) {
                console.log('💬 Message is already being processed, skipping:', messageId);
                return;
              }
              
              // Check if message already exists in state
              const messageExists = state.messages.some(msg => msg.messageId === messageId);
              console.log('💬 Message exists check:', messageExists);
              
              if (!messageExists) {
                console.log('💬 Adding new message to chat via WebSocket');
                
                // Mark as processing
                processingMessageIds.current.add(messageId);
                
                dispatch({ 
                  type: 'ADD_MESSAGE', 
                  payload: { 
                    message: data.data.message, 
                    chatUuid: data.data.chatUuid 
                  } 
                });
                
                // Remove from processing after a short delay
                setTimeout(() => {
                  processingMessageIds.current.delete(messageId);
                }, 1000);
              } else {
                console.log('💬 Message already exists, skipping duplicate:', messageId);
              }
            } else {
              console.log('💬 Message is for different chat, ignoring. Expected:', state.selectedChat?.uuid, 'Got:', data.data.chatUuid);
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
    };

    wsManager.on('message', handleMessage);

    return () => {
      wsManager.off('message', handleMessage);
    };
  }, [state.selectedChat, state.messages]); // Re-run when selectedChat or messages change

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
        return <ChatLayout 
          state={state} 
          dispatch={dispatch} 
          onLogout={handleLogout} 
          wsConnected={wsConnected}
          joinedChats={joinedChats}
          isLoadingMembership={isLoadingMembership}
          onJoinChat={handleJoinChat}
          onLeaveChat={handleLeaveChat}
        />;
    }
  };

  return (
    <ToastProvider>
      {renderCurrentPage()}
    </ToastProvider>
  );
}