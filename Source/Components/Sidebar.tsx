import { Plus, ChevronDown, Settings, LogOut, Palette, Ruler, CheckCircle, Eye, Package, Briefcase, MoreHorizontal, Edit, Trash2, Archive } from 'lucide-react'
import authService from '../Library/Authentication/jwt'
import { threadsApiService, type Thread } from '../Library/Shared/threadsApi'
import { getProfileImageUrl, getProfileInitial } from '../Library/Shared/profileUtils'
import { useState, useEffect, useRef } from 'react'
import NewChatDialog from './NewChatDialog'
import EditChatDialog from './EditChatDialog'
import { useRedis } from '../Library/hooks/useRedis'
import { directThreadEvents } from '../Library/redis/direct-pubsub'
import { showConfirmDialog } from '../Library/Native/dialog'

// Use Thread as Chat since they have the same structure
type ChatType = Thread;

interface SidebarProps {
  chats: ChatType[];
  selectedChat: ChatType | null;
  onChatSelect: (chat: ChatType) => void;
  onShowAllChats: () => void;
  isLoadingAllChats: boolean;
  onCreateChat?: (chatData: {
    name: string;
    requestType: string;
    customerId?: string;
    customerName?: string;
    description?: string;
  }) => void;
  onUpdateChat?: (chatId: number, updates: Partial<ChatType>) => void;
  onDeleteChat?: (chatId: number) => void;
  onRefreshChats?: () => void;
}

export default function Sidebar({
  chats,
  selectedChat,
  onChatSelect,
  onShowAllChats,
  isLoadingAllChats = false,
  onCreateChat,
  onUpdateChat,
  onDeleteChat,
  onRefreshChats
}: SidebarProps) {
  const [user, setUser] = useState(authService.getUser());
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [showEditChatDialog, setShowEditChatDialog] = useState(false);
  const [editingChat, setEditingChat] = useState<ChatType | null>(null);
  const [chatMenus, setChatMenus] = useState<{ [key: number]: boolean }>({});
  const menuRef = useRef<HTMLDivElement>(null);
  const chatMenuRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  
  // Use Redis hook for real-time updates
  const redis = useRedis();

  // Group chats by createdByName from the props
  const chatGroups = threadsApiService.groupThreadsByCreator(chats);

  // Set up real-time subscriptions for chat list updates
  useEffect(() => {
    if (redis.state.connected) {
      console.log('🔔 Setting up chat list real-time subscriptions...');
      
      // Subscribe to thread updates
      redis.subscribe('thread:new', (message) => {
        console.log('📨 New thread created:', message);
        if (onRefreshChats) {
          onRefreshChats();
        }
      });

      redis.subscribe('thread:update', (message) => {
        console.log('📨 Thread updated:', message);
        if (onRefreshChats) {
          onRefreshChats();
        }
      });

      redis.subscribe('thread:delete', (message) => {
        console.log('📨 Thread deleted:', message);
        if (onRefreshChats) {
          onRefreshChats();
        }
      });
    }
  }, [redis.state.connected, onRefreshChats]);

  // Handle chat menu visibility
  const toggleChatMenu = (chatId: number, event: React.MouseEvent) => {
    event.stopPropagation();
    setChatMenus(prev => ({
      ...prev,
      [chatId]: !prev[chatId]
    }));
  };

  const closeChatMenu = (chatId: number) => {
    setChatMenus(prev => ({
      ...prev,
      [chatId]: false
    }));
  };

  // CRUD Operations
  const handleEditChat = async (chat: ChatType) => {
    closeChatMenu(chat.id);
    setEditingChat(chat);
    setShowEditChatDialog(true);
  };

  const handleSaveEditChat = async (newName: string) => {
    if (!editingChat) return;
    
    try {
      console.log('✏️ Editing chat:', editingChat.id, 'to:', newName);
      
      // Update via API
      const response = await threadsApiService.updateThread(editingChat.id, {
        channelName: newName
      });
      
      if (response.success && onUpdateChat) {
        onUpdateChat(editingChat.id, { channelName: newName });
        
        // Publish real-time update
        if (redis.state.connected) {
          await directThreadEvents.updated({
            ...editingChat,
            channelName: newName
          }, user?.id?.toString());
        }
      }
    } catch (error) {
      console.error('❌ Failed to edit chat:', error);
    } finally {
      setEditingChat(null);
    }
  };

  const handleDeleteChat = async (chat: ChatType) => {
    closeChatMenu(chat.id);
    
    try {
      const confirmed = await showConfirmDialog({
        title: 'Delete Chat',
        message: `Are you sure you want to delete "${chat.channelName}"? This action cannot be undone.`,
        okText: 'Delete',
        cancelText: 'Cancel'
      });
      
      if (confirmed) {
        console.log('🗑️ Deleting chat:', chat.id);
        
        // Delete via API
        const response = await threadsApiService.deleteThread(chat.id);
        
        if (response.success && onDeleteChat) {
          onDeleteChat(chat.id);
          
          // Publish real-time update
          if (redis.state.connected) {
            await directThreadEvents.deleted(
              chat.id.toString(),
              user?.id?.toString()
            );
          }
        }
      }
    } catch (error) {
      console.error('❌ Failed to delete chat:', error);
    }
  };

  const handleArchiveChat = async (chat: ChatType) => {
    closeChatMenu(chat.id);
    
    try {
      console.log('📦 Archiving chat:', chat.id);
      
      // Archive via API (assuming there's an archive status)
      const response = await threadsApiService.updateThread(chat.id, {
        metadata: {
          ...chat.metadata,
          archived: true
        }
      });
      
      if (response.success && onUpdateChat) {
        onUpdateChat(chat.id, {
          metadata: {
            queueId: chat.metadata?.queueId || 0,
            queueStatus: chat.metadata?.queueStatus || 'UNKNOWN',
            requestType: chat.metadata?.requestType || 'unknown',
            createdByName: chat.metadata?.createdByName || chat.createdByName,
            archived: true
          }
        });
        
        // Publish real-time update
        if (redis.state.connected) {
          await directThreadEvents.updated({
            ...chat,
            metadata: {
              queueId: chat.metadata?.queueId || 0,
              queueStatus: chat.metadata?.queueStatus || 'UNKNOWN',
              requestType: chat.metadata?.requestType || 'unknown',
              createdByName: chat.metadata?.createdByName || chat.createdByName,
              archived: true
            }
          }, user?.id?.toString());
        }
      }
    } catch (error) {
      console.error('❌ Failed to archive chat:', error);
    }
  };

  useEffect(() => {
    // Refresh user data from auth service
    const currentUser = authService.getUser();
    console.log('Sidebar - Current user from auth service:', currentUser);
    setUser(currentUser);

    // Set up a listener for auth state changes
    const interval = setInterval(() => {
      const updatedUser = authService.getUser();
      if (JSON.stringify(updatedUser) !== JSON.stringify(user)) {
        console.log('Sidebar - User data updated:', updatedUser);
        setUser(updatedUser);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
      
      // Close chat menus when clicking outside
      Object.keys(chatMenus).forEach(chatIdStr => {
        const chatId = parseInt(chatIdStr);
        const menuRef = chatMenuRefs.current[chatId];
        if (menuRef && !menuRef.contains(event.target as Node)) {
          closeChatMenu(chatId);
        }
      });
    };

    if (showUserMenu || Object.values(chatMenus).some(Boolean)) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserMenu, chatMenus]);

  const handleLogout = () => {
    authService.logout();
    window.location.reload(); // Simple way to reset the app state
  };

  const handleChatSelect = (chat: ChatType) => {
    onChatSelect(chat);
  };

  const handleCreateChat = (chatData: {
    name: string;
    requestType: string;
    customerId?: string;
    customerName?: string;
    description?: string;
  }) => {
    if (onCreateChat) {
      onCreateChat(chatData);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
    } else if (diffInHours < 168) { // 7 days
      return date.toLocaleDateString('en-US', { weekday: 'short' })
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      })
    }
  }

  const getRequestTypeIcon = (requestType: string) => {
    switch (requestType) {
      case 'design': return Palette
      case 'dimension': return Ruler
      case 'checkfile': return CheckCircle
      case 'adjustdesign': return Settings
      case 'proof': return Eye
      case 'sample-i':
      case 'sample-t': return Package
      default: return Briefcase
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'text-yellow-600'
      case 'IN_PROGRESS': return 'text-blue-600'
      case 'COMPLETED': return 'text-green-600'
      case 'CANCELLED': return 'text-red-600'
      default: return 'text-on-surface-variant'
    }
  }
  return (
    <aside className="w-[350px] bg-surface flex flex-col border-r border-outline shrink-0 z-10 select-none">
      {/* Workspace Header */}

      {/* Navigation Switcher */}
      <div className="px-4 py-3 shrink-0 flex space-x-2 w-full">
        <div className="flex items-center p-1 bg-surface rounded-lg border border-outline space-x-1 w-full">
          <button className="flex-1 py-1.5 px-2 rounded-lg bg-surface-variant text-on-surface label-medium shadow-sm text-center transition-all border border-outline">
            Channels
          </button>
          <button className="flex-1 py-1.5 px-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-variant label-medium text-center transition-all">
            Direct Messages
          </button>
        </div>

        {/* add chat dialog */}
        <button 
          className="border p-1 bg-surface rounded-lg border-outline w-12 flex items-center justify-center hover:bg-surface-variant transition-colors"
          onClick={() => setShowNewChatDialog(true)}
          title="Create new chat"
        >
          <Plus width={16} height={16} />
        </button>
      </div>

      {/* Channels List */}
      <div className="flex-1 overflow-y-auto px-3 pb-4 flex flex-col gap-6">
        {/* Chat Groups by Creator */}
        {Object.entries(chatGroups).slice(0, 5).map(([creatorName, groupChats]) => (
          <div key={creatorName} className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-2 pb-1 group/header cursor-pointer">
              <div className="label-small text-on-surface-variant uppercase tracking-wider">
                {creatorName}
              </div>
              <Plus className="text-on-surface-variant opacity-0 group-hover/header:opacity-100 hover:text-on-surface transition-opacity" size={16} />
            </div>
            <div className="flex flex-col gap-1">
              {/* Show first 5 chats from this group */}
              {groupChats.slice(0, 5).map((chat: ChatType) => (
                <div
                  key={chat.id}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all hover:bg-surface-variant group relative ${selectedChat?.id === chat.id ? 'bg-primary/10' : ''
                    }`}
                >
                  <div 
                    className="flex-1 flex items-center gap-3 min-w-0"
                    onClick={() => handleChatSelect(chat)}
                  >
                    <div className="flex-shrink-0">
                      <div className="size-8 rounded-full bg-surface-variant border border-outline flex items-center justify-center">
                        {(() => {
                          const IconComponent = getRequestTypeIcon(chat.metadata?.requestType || 'unknown');
                          return <IconComponent size={16} className="text-on-surface-variant" />;
                        })()}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="label-medium text-on-surface truncate pr-2">
                          {chat.channelName}
                        </h3>
                        <span className="label-small text-on-surface-variant flex-shrink-0">
                          {formatDate(chat.updatedAt)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`label-small ${getStatusColor(chat.metadata?.queueStatus || 'UNKNOWN')}`}>
                          {chat.metadata?.queueStatus || 'UNKNOWN'}
                        </span>
                        <span className="label-small text-on-surface-variant">
                          #{chat.metadata?.queueId || 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Chat Menu Button */}
                  <div className="relative" ref={el => { chatMenuRefs.current[chat.id] = el; }}>
                    <button
                      onClick={(e) => toggleChatMenu(chat.id, e)}
                      className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-surface-container transition-all"
                      title="Chat options"
                    >
                      <MoreHorizontal size={16} className="text-on-surface-variant" />
                    </button>

                    {/* Chat Menu Dropdown */}
                    {chatMenus[chat.id] && (
                      <div className="absolute right-0 top-full mt-1 bg-surface-container border border-outline-variant rounded-2xl shadow-lg py-2 z-50 min-w-[160px]">
                        <button
                          onClick={() => handleEditChat(chat)}
                          className="w-full px-4 py-2 text-left hover:bg-surface-variant flex items-center gap-3 text-on-surface"
                        >
                          <Edit size={16} />
                          <span className="text-xs">Edit name</span>
                        </button>
                        <button
                          onClick={() => handleArchiveChat(chat)}
                          className="w-full px-4 py-2 text-left hover:bg-surface-variant flex items-center gap-3 text-on-surface"
                        >
                          <Archive size={16} />
                          <span className="text-xs">Archive</span>
                        </button>
                        <div className="border-t border-outline-variant my-1" />
                        <button
                          onClick={() => handleDeleteChat(chat)}
                          className="w-full px-4 py-2 text-left hover:bg-error-container flex items-center gap-3 text-error"
                        >
                          <Trash2 size={16} />
                          <span className="text-xs">Delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Show more button for this group */}
              {groupChats.length > 5 && (
                <button
                  onClick={onShowAllChats}
                  disabled={isLoadingAllChats}
                  className="flex items-center justify-center gap-2 p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoadingAllChats ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                      <span className="label-small">Loading...</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown size={16} />
                      <span className="label-small">Show {groupChats.length - 5} more</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Show more groups button */}
        {Object.keys(chatGroups).length > 5 && (
          <div className="flex justify-center">
            <button
              onClick={onShowAllChats}
              disabled={isLoadingAllChats}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoadingAllChats ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                  <span className="label-medium">Loading...</span>
                </>
              ) : (
                <>
                  <ChevronDown size={16} />
                  <span className="label-medium">Show more groups</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* User Footer */}
      <div className="p-3 border-t border-outline bg-surface relative" ref={menuRef}>
        <button
          className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-surface-variant transition-colors group"
          onClick={() => setShowUserMenu(!showUserMenu)}
        >
          <div className="relative">
            <div
              className="size-9 rounded-full bg-surface border border-outline flex items-center justify-center text-on-surface label-medium"
              style={user?.profilePicture ? {
                backgroundImage: `url("${getProfileImageUrl(user.profilePicture)}")`,
                backgroundSize: 'cover'
              } : {}}
            >
              {!user?.profilePicture && getProfileInitial(user?.name, user?.uid)}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 size-2.5 bg-tertiary border-2 border-background rounded-full" />
          </div>
          <div className="flex flex-col items-start overflow-hidden text-left">
            <div className="label-medium text-on-surface">
              {user?.name || user?.uid || 'User'}
              {!user && <span className="text-error"> (No user data)</span>}
            </div>
            <div className="label-small text-on-surface-variant">{user?.role || 'Member'}</div>
          </div>
          <Settings className="ml-auto text-on-surface-variant group-hover:text-on-surface" />
        </button>

        {/* User Menu Dropdown */}
        {showUserMenu && (
          <div className="absolute bottom-full left-3 right-3 mb-2 bg-surface border border-outline rounded-lg shadow-lg z-40">
            <div className="p-2">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 w-full p-2 rounded-md hover:bg-surface-variant transition-colors text-on-surface"
              >
                <LogOut size={16} />
                <span className="label-medium">Sign out</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New Chat Dialog */}
      <NewChatDialog
        open={showNewChatDialog}
        onOpenChange={setShowNewChatDialog}
        onCreateChat={handleCreateChat}
      />

      {/* Edit Chat Dialog */}
      <EditChatDialog
        open={showEditChatDialog}
        onOpenChange={setShowEditChatDialog}
        chatName={editingChat?.channelName || ''}
        onSave={handleSaveEditChat}
      />
    </aside>
  )
}