import Icon from './Icon'
import authService from '../Library/Authentication/jwt'
import threadsApiService, { type Thread } from '../Library/Shared/threadsApi'
import { useState, useEffect, useRef } from 'react'
import type { Chat } from './Chatlists'

// Use Thread as Chat since they have the same structure
type ChatType = Thread;

interface SidebarProps {
  onChatSelect?: (chat: ChatType) => void;
  onShowAllChats?: () => void;
  isLoadingAllChats?: boolean;
}

export default function Sidebar({ onChatSelect, onShowAllChats, isLoadingAllChats = false }: SidebarProps) {
  const [user, setUser] = useState(authService.getUser());
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<number | undefined>();
  const [threads, setThreads] = useState<ChatType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Load threads from API
  useEffect(() => {
    const loadThreads = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await threadsApiService.getThreads({ limit: 100 });
        const validThreads = threadsApiService.filterValidThreads(response.threads);
        setThreads(validThreads);
      } catch (err) {
        console.error('Failed to load threads:', err);
        setError(err instanceof Error ? err.message : 'Failed to load threads');
      } finally {
        setIsLoading(false);
      }
    };

    loadThreads();
  }, []);

  // Group chats by createdByName
  const chatGroups = threadsApiService.groupThreadsByCreator(threads);

  useEffect(() => {
    setUser(authService.getUser());
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserMenu]);

  const handleLogout = () => {
    authService.logout();
    window.location.reload(); // Simple way to reset the app state
  };

  const handleChatSelect = (chat: ChatType) => {
    setSelectedChatId(chat.id);
    onChatSelect?.(chat);
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
      case 'design': return 'palette'
      case 'dimension': return 'straighten'
      case 'checkfile': return 'check_circle'
      case 'adjustdesign': return 'tune'
      case 'proof': return 'visibility'
      case 'sample-i': 
      case 'sample-t': return 'inventory'
      default: return 'work'
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
    <aside className="w-[300px] bg-surface flex flex-col border-r border-outline shrink-0 z-20 select-none">
      {/* Workspace Header */}

      {/* Navigation Switcher */}
      <div className="px-4 py-3 shrink-0 ">
        <div className="flex items-center p-1 bg-surface rounded-lg border border-outline space-x-1">
          <button className="flex-1 py-1.5 px-2 rounded-lg bg-surface-variant text-on-surface label-medium shadow-sm text-center transition-all border border-outline">
            Channels
          </button>
          <button className="flex-1 py-1.5 px-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-variant label-medium text-center transition-all">
            Direct Messages
          </button>
        </div>
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
              <Icon name="add" className="text-on-surface-variant opacity-0 group-hover/header:opacity-100 hover:text-on-surface transition-opacity" size={16} />
            </div>
            <div className="flex flex-col gap-1">
              {/* Show first 5 chats from this group */}
              {groupChats.slice(0, 5).map((chat: ChatType) => (
                <div
                  key={chat.id}
                  onClick={() => handleChatSelect(chat)}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all hover:bg-surface-variant group ${
                    selectedChatId === chat.id ? 'bg-primary/10' : ''
                  }`}
                >
                  <div className="flex-shrink-0">
                    <div className="size-8 rounded-full bg-surface-variant border border-outline flex items-center justify-center">
                      <Icon 
                        name={getRequestTypeIcon(chat.metadata?.requestType || 'unknown')} 
                        size={16} 
                        className="text-on-surface-variant"
                      />
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
                      <Icon name="expand_more" size={16} />
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
                  <Icon name="expand_more" size={16} />
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
                backgroundImage: `url("http://10.10.60.8:1669${user.profilePicture}")`, 
                backgroundSize: 'cover' 
              } : {}}
            >
              {!user?.profilePicture && (user?.name?.charAt(0) || user?.uid?.charAt(0) || 'U')}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 size-2.5 bg-tertiary border-2 border-background rounded-full" />
          </div>
          <div className="flex flex-col items-start overflow-hidden text-left">
            <div className="label-medium text-on-surface">{user?.name || user?.uid || 'User'}</div>
            <div className="label-small text-on-surface-variant">{user?.role || 'Member'}</div>
          </div>
          <Icon name="settings" className="ml-auto text-on-surface-variant group-hover:text-on-surface" />
        </button>

        {/* User Menu Dropdown */}
        {showUserMenu && (
          <div className="absolute bottom-full left-3 right-3 mb-2 bg-surface border border-outline rounded-lg shadow-lg z-50">
            <div className="p-2">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 w-full p-2 rounded-md hover:bg-surface-variant transition-colors text-on-surface"
              >
                <Icon name="logout" size={16} />
                <span className="label-medium">Sign out</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}

function SidebarItem({ icon, label }: { icon: string, label: string }) {
  return (
    <a className="flex items-center gap-2.5 px-3 py-1.5 rounded-md text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-all group" href="#">
      <Icon name={icon} className="text-on-surface-variant group-hover:text-on-surface-variant" />
      <span className="label-large">{label}</span>
    </a>
  )
}

function ThreadItem({ label, isNew }: { label: string, isNew?: boolean }) {
  return (
    <a className={`flex items-center gap-2 p-1.5 -ml-1.5 rounded ${isNew ? 'bg-surface-variant/5 text-on-surface' : 'hover:bg-surface-variant/5 text-on-surface-variant hover:text-on-surface'} transition-colors group/thread`} href="#">
      <Icon name="subdirectory_arrow_right" className={`rotate-180 ${isNew ? 'text-primary' : 'text-on-surface-variant group-hover/thread:text-on-surface-variant'}`} size={14} />
      <span className={`label-medium truncate ${isNew ? 'font-medium' : ''}`}>{label}</span>
      {isNew && <span className="ml-auto label-small bg-primary/20 text-on-primary-container px-1 rounded-md">New</span>}
    </a>
  )
}