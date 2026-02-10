import { Plus, ChevronDown, LogOut, MoreHorizontal, Edit, Trash2, Archive, MessageSquare, Search, X } from 'lucide-react'
import { useState, useEffect, useMemo, useRef } from 'react'
import NewChatDialog from './NewChatDialog'
import EditChatDialog from './EditChatDialog'
import { useAuth } from '../Library/Authentication/AuthContext'
import ConfirmDialog from './ui/ConfirmDialog';
import { useToast } from '../Library/hooks/useToast.tsx';
import type { ChatType } from '../Library/types'; // Import ChatType
import { getNullStringValue } from '../Library/utils/api.ts'; // Import getNullStringValue
import { Palette, Ruler, FileCheck, Eye, Package, Briefcase, Settings } from 'lucide-react'
type Page = 'chat' | 'users' | 'allChats';
type SidebarTab = 'channels' | 'me';

type RequestType = 'design' | 'dimension' | 'checkfile' | 'adjustdesign' | 'proof' | 'sample-i' | 'sample-t' | 'general' | 'consultation';

const REQUEST_TYPES: {
  id: RequestType;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
}[] = [
    {
      id: 'design',
      label: 'งานออกแบบใหม่', // Design Request
      description: 'Create new design or artwork',
      icon: Palette,
      color: 'bg-primary/12 text-primary border-primary/20 hover:bg-primary/16',
    },
    {
      id: 'dimension',
      label: 'เช็คระยะ/ขนาด', // Dimension Check
      description: 'Verify measurements and specifications',
      icon: Ruler,
      color: 'bg-secondary/12 text-secondary border-secondary/20 hover:bg-secondary/16',
    },
    {
      id: 'adjustdesign',
      label: 'แก้ไขแบบ', // Design Adjustment
      description: 'Modify existing design',
      icon: Edit,
      color: 'bg-tertiary/12 text-tertiary border-tertiary/20 hover:bg-tertiary/16',
    },
    {
      id: 'checkfile',
      label: 'เช็คไฟล์', // File Review
      description: 'Review and validate files',
      icon: FileCheck,
      color: 'bg-error/12 text-error border-error/20 hover:bg-error/16',
    },
    {
      id: 'proof',
      label: 'ตรวจสอบปรู๊ฟ', // Proof Review
      description: 'Review proof before production',
      icon: Eye,
      color: 'bg-outline/12 text-on-surface border-outline/20 hover:bg-outline/16',
    },
    {
      id: 'sample-i',
      label: 'ตัวอย่าง(Inkjet)', // Sample Type I
      description: 'Inkjet sample request',
      icon: Package,
      color: 'bg-surface-variant/12 text-on-surface-variant border-surface-variant/20 hover:bg-surface-variant/16',
    },
    {
      id: 'sample-t',
      label: 'ตัวอย่าง (Toner)', // Sample Type T
      description: 'Toner sample request',
      icon: Package,
      color: 'bg-inverse-surface/12 text-inverse-on-surface border-inverse-surface/20 hover:bg-inverse-surface/16',
    },
    {
      id: 'general',
      label: 'เรื่องทั่วไป', // General Request
      description: 'General discussion or inquiry',
      icon: Briefcase,
      color: 'bg-on-surface/12 text-on-surface border-on-surface/20 hover:bg-on-surface/16',
    },
    {
      id: 'consultation',
      label: 'ขอคำปรึกษา', // Consultation
      description: 'Expert advice and consultation',
      icon: Settings,
      color: 'bg-primary-container/12 text-on-primary-container border-primary-container/20 hover:bg-primary-container/16',
    },
  ];
// type ChatType = any; // Remove this line as ChatType is now imported

interface SidebarProps {
  chats: ChatType[];
  selectedChat: ChatType | null;
  onChatSelect: (chat: ChatType) => void;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  isLoadingAllChats: boolean;
  onCreateChat?: (chatData: {
    name: string;
    requestType: string;
    customerId?: string;
    customerName?: string;
    description?: string;
  }) => void;
  onDeleteChat: (chatId: string | number) => Promise<void>; // Updated to return Promise
}

export default function Sidebar({
  chats,
  selectedChat,
  onChatSelect,
  onNavigate,
  onLogout,
  isLoadingAllChats = false,
  onCreateChat,
  onDeleteChat, // Destructure new prop
}: SidebarProps) {
  const { user } = useAuth();
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [showEditChatDialog, setShowEditChatDialog] = useState(false);
  const [editingChat, setEditingChat] = useState<ChatType | null>(null);
  const [chatMenus, setChatMenus] = useState<{ [key: number]: boolean }>({});
  const chatMenuRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false); // New state
  const [chatToDelete, setChatToDelete] = useState<ChatType | null>(null); // New state
  const { addToast } = useToast(); // Initialize useToast
  const [activeTab, setActiveTab] = useState<SidebarTab>('channels'); // New state for tab management

  // Search functionality
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter chats based on search query and active tab
  const filteredChats = useMemo(() => {
    let baseChats = chats;
    
    // Filter by tab first
    if (activeTab === 'me' && user) {
      baseChats = chats.filter(chat => chat.createdById === user.id);
    }
    
    // Then filter by search query
    if (!searchQuery.trim()) return baseChats;

    const query = searchQuery.toLowerCase();
    return baseChats.filter(chat =>
      chat.channelName.toLowerCase().includes(query) ||
      chat.uniqueId?.toLowerCase().includes(query) ||
      chat.createdByName.toLowerCase().includes(query) ||
      getNullStringValue(chat.customers)?.toLowerCase().includes(query) ||
      getNullStringValue(chat.customerId)?.toLowerCase().includes(query) ||
      chat.parsedMetadata?.requestType?.toLowerCase().includes(query) ||
      chat.description?.String?.toLowerCase().includes(query)
    );
  }, [chats, searchQuery, activeTab, user]);

  const chatGroups = useMemo(() => {
    return filteredChats.reduce((acc, chat) => {
      const creator = chat.createdByName || 'Unknown';
      if (!acc[creator]) {
        acc[creator] = [];
      }
      acc[creator].push(chat);
      return acc;
    }, {} as Record<string, ChatType[]>);
  }, [filteredChats]);

  // Clear search function
  const clearSearch = () => {
    setSearchQuery('');
    searchInputRef.current?.focus();
  };

  // Keyboard shortcut for search (Ctrl/Cmd + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape' && isSearchFocused) {
        clearSearch();
        searchInputRef.current?.blur();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSearchFocused]);

  // Helper function to highlight search matches
  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;

    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className="bg-primary/20 text-primary rounded px-0.5">
          {part}
        </mark>
      ) : part
    );
  };

  // Helper function to check if current user can delete a chat
  const canDeleteChat = (chat: ChatType): boolean => {
    if (!user) return false;
    
    // User can delete if they are the creator
    if (chat.createdById === user.id) return true;
    
    // User can delete if they are admin
    if (user.role === 'manager' || user.role === 'sales') return true;
    
    return false;
  };

  const toggleChatMenu = (chatId: number, event: React.MouseEvent) => {
    event.stopPropagation();
    setChatMenus(prev => ({ ...prev, [chatId]: !prev[chatId] }));
  };

  const closeChatMenu = (chatId: number) => {
    setChatMenus(prev => ({ ...prev, [chatId]: false }));
  };

  const handleEditChat = (chat: ChatType) => {
    closeChatMenu(chat.id);
    setEditingChat(chat);
    setShowEditChatDialog(true);
  };

  // Placeholder functions for menu actions
  const handleSaveEditChat = (newName: string) => console.log('Saving chat:', editingChat?.id, newName);

  const handleDeleteChatClick = (chat: ChatType) => { // Renamed to avoid conflict with prop
    closeChatMenu(chat.id);
    setChatToDelete(chat);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDeleteChat = async () => {
    if (chatToDelete) {
      try {
        await onDeleteChat(chatToDelete.id);
        addToast({ message: `Chat "${chatToDelete.channelName}" has been deleted.`, type: 'success' });
      } catch (error) {
        console.error('Failed to delete chat:', error);
        addToast({ 
          message: `Failed to delete chat "${chatToDelete.channelName}". ${error instanceof Error ? error.message : 'Unknown error'}`, 
          type: 'error' 
        });
      }
    }
    setChatToDelete(null);
    setShowDeleteConfirm(false);
  };

  const handleArchiveChat = (chat: ChatType) => console.log('Archiving chat:', chat.id);


  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      Object.keys(chatMenus).forEach(chatIdStr => {
        const chatId = parseInt(chatIdStr);
        const menuRef = chatMenuRefs.current[chatId];
        if (menuRef && !menuRef.contains(event.target as Node)) {
          closeChatMenu(chatId);
        }
      });
    };

    if (Object.values(chatMenus).some(Boolean)) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [chatMenus]);

  return (
    <aside className="w-[350px] bg-surface flex flex-col border-r border-outline shrink-0 z-10 select-none">
      {/* Navigation Switcher */}
      <div className="px-4 py-3 shrink-0 flex space-x-2 w-full">
        <div className="flex items-center p-1 bg-surface rounded-lg border border-outline space-x-1 w-full">
          <button 
            onClick={() => setActiveTab('channels')}
            className={`flex-1 py-1.5 px-2 rounded-lg label-medium text-center transition-all border ${
              activeTab === 'channels' 
                ? 'bg-surface-variant text-on-surface shadow-sm border-outline' 
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant border-transparent'
            }`}
          >
            Channels
          </button>
          <button 
            onClick={() => setActiveTab('me')}
            className={`flex-1 py-1.5 px-2 rounded-lg label-medium text-center transition-all border ${
              activeTab === 'me' 
                ? 'bg-surface-variant text-on-surface shadow-sm border-outline' 
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant border-transparent'
            }`}
          >
            Me
          </button>
        </div>
        <button
          className="border p-1 bg-surface rounded-lg border-outline w-12 flex items-center justify-center hover:bg-surface-variant transition-colors"
          onClick={() => setShowNewChatDialog(true)}
          title="Create new chat"
        >
          <Plus width={16} height={16} />
        </button>
      </div>

      {/* Search Bar - MD3 Style */}
      <div className="px-4 pb-3 shrink-0">
        <div className={`relative transition-all duration-200 ${isSearchFocused ? 'transform scale-[1.02]' : ''}`}>
          <div className={`relative flex items-center bg-surface-container border rounded-full transition-all duration-200 ${isSearchFocused
              ? 'border-primary shadow-md ring-2 ring-primary/20'
              : 'border-outline-variant hover:border-outline'
            }`}>
            <div className="flex items-center pl-4 pr-2">
              <Search
                size={20}
                className={`transition-colors duration-200 ${isSearchFocused ? 'text-primary' : 'text-on-surface-variant'
                  }`}
              />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              placeholder={`Search ${activeTab === 'me' ? 'your chats' : 'chats'}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              className="flex-1 bg-transparent border-none outline-none py-3 pr-2 text-on-surface placeholder-on-surface-variant body-medium"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="flex items-center justify-center w-8 h-8 mr-2 rounded-full hover:bg-surface-variant transition-colors"
                title="Clear search"
              >
                <X size={16} className="text-on-surface-variant" />
              </button>
            )}
            {!searchQuery && (
              <div className="flex items-center pr-4">
                <kbd className="hidden sm:inline-flex items-center px-2 py-1 text-xs font-medium text-on-surface-variant bg-surface-variant border border-outline-variant rounded">
                  ⌘K
                </kbd>
              </div>
            )}
          </div>

          {/* Search Results Counter */}
          {searchQuery && (
            <div className="absolute top-full left-0 right-0 mt-1 px-3 py-1">
              <div className="text-xs text-on-surface-variant">
                {filteredChats.length === 0
                  ? `No ${activeTab === 'me' ? 'your chats' : 'chats'} found`
                  : `${filteredChats.length} ${activeTab === 'me' ? 'your ' : ''}chat${filteredChats.length !== 1 ? 's' : ''} found`
                }
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Channels List */}
      <div className="flex-1 overflow-y-auto px-3 pb-4 flex flex-col gap-6">
        {searchQuery && filteredChats.length === 0 ? (
          // No search results state
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-surface-variant/50 flex items-center justify-center mb-4">
              <Search size={24} className="text-on-surface-variant" />
            </div>
            <h3 className="title-medium text-on-surface mb-2">No chats found</h3>
            <p className="body-medium text-on-surface-variant max-w-sm">
              Try adjusting your search terms or{' '}
              <button
                onClick={clearSearch}
                className="text-primary hover:underline"
              >
                clear the search
              </button>
              {' '}to see all {activeTab === 'me' ? 'your ' : ''}chats.
            </p>
          </div>
        ) : Object.entries(chatGroups).length === 0 ? (
          // No chats at all state
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-surface-variant/50 flex items-center justify-center mb-4">
              <MessageSquare size={24} className="text-on-surface-variant" />
            </div>
            <h3 className="title-medium text-on-surface mb-2">
              {activeTab === 'me' ? 'No chats created by you yet' : 'No chats yet'}
            </h3>
            <p className="body-small text-on-surface-variant max-w-sm mb-4">
              {activeTab === 'me' 
                ? 'Start a conversation by creating your first chat.' 
                : 'Start a conversation by creating your first chat.'
              }
            </p>
            <button
              onClick={() => setShowNewChatDialog(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-full hover:bg-primary/90 transition-colors"
            >
              <Plus size={16} />
              <span className="label-medium">Create Chat</span>
            </button>
          </div>
        ) : (
          // Chat groups
          Object.entries(chatGroups).map(([creatorName, groupChats]) => (
            <div key={creatorName} className="flex flex-col gap-2">
              {/* Only show creator header in "channels" tab, not in "me" tab since all chats are from the same user */}
              {activeTab === 'channels' && (
                <div className="flex items-center justify-between px-2 pb-1 group/header cursor-pointer">
                  <div className="label-small text-on-surface-variant uppercase tracking-wider">
                    {creatorName}
                  </div>
                  <Plus className="text-on-surface-variant opacity-0 group-hover/header:opacity-100 hover:text-on-surface transition-opacity" size={16} />
                </div>
              )}
              <div className="flex flex-col gap-2">
                {groupChats.slice(0, 5).map((chat: ChatType) => (
                  <div
                    key={chat.id}
                    className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all hover:bg-surface-variant group relative ${selectedChat?.id === chat.id ? 'bg-primary/10 border border-primary/20' : 'border border-transparent'}`}
                  >
                    <div
                      className="flex-1 flex flex-col gap-2 min-w-0"
                      onClick={() => onChatSelect(chat)}
                    >
                      {/* Header Row: Chat Name + Time */}
                      <div className="flex items-center justify-between">
                        <h3 className="title-small font-medium truncate pr-2 text-on-surface">
                          {searchQuery ? highlightMatch(chat.channelName, searchQuery) : chat.channelName}
                        </h3>
                        <span className="body-small text-on-surface-variant flex-shrink-0">
                          {(() => {
                            try {
                              const date = new Date(chat.updatedAt);
                              if (isNaN(date.getTime())) {
                                return '--:--';
                              }
                              return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            } catch {
                              return '--:--';
                            }
                          })()}
                        </span>
                      </div>

                      {/* Creator Row - Only show in channels tab */}
                      {activeTab === 'channels' && (
                        <div className="flex items-center gap-2">
                          <span className="body-small text-on-surface-variant">
                            by {searchQuery ? highlightMatch(chat.createdByName, searchQuery) : chat.createdByName}
                          </span>
                          {chat.createdById === user?.id && (
                            <span className="px-2 py-0.5 bg-primary/12 text-primary rounded-full text-xs font-medium">
                              You
                            </span>
                          )}
                        </div>
                      )}

                      {/* Customer Info Row */}
                      {(getNullStringValue(chat.customers) || getNullStringValue(chat.customerId) || chat.uniqueId) && (
                        <div className="flex items-center gap-2 flex-wrap">
                          {chat.uniqueId && (
                            <span className="body-small text-primary font-semibold bg-primary/10 px-2 py-1 rounded-md border border-primary/20">
                              {searchQuery ? highlightMatch(chat.uniqueId, searchQuery) : chat.uniqueId}
                            </span>
                          )}
                          {getNullStringValue(chat.customers) && (
                            <span className="body-small text-on-surface font-medium">
                              {searchQuery ? highlightMatch(getNullStringValue(chat.customers)!, searchQuery) : getNullStringValue(chat.customers)}
                            </span>
                          )}
                          {getNullStringValue(chat.customerId) && (
                            <span className="body-small text-on-surface-variant bg-surface-variant px-2 py-1 rounded-md">
                              #{searchQuery ? highlightMatch(getNullStringValue(chat.customerId)!, searchQuery) : getNullStringValue(chat.customerId)}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Tags Row: Request Type + Channel Type */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {chat.parsedMetadata?.requestType && (
                          (() => {
                            const reqType = REQUEST_TYPES.find(rt => rt.id === chat.parsedMetadata?.requestType);
                            if (reqType) {
                              const IconComponent = reqType.icon;
                              return (
                                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${reqType.color} border`}>
                                  <IconComponent size={12} />
                                  <span>{reqType.label}</span>
                                </div>
                              );
                            }
                            return null;
                          })()
                        )}
                        {chat.channelType && (
                          <span className="body-small text-on-surface-variant bg-outline/8 px-2 py-1 rounded-md capitalize">
                            {chat.channelType}
                          </span>
                        )}
                        {chat.status && chat.status !== 'PENDING' && (
                          <span className={`body-small px-2 py-1 rounded-md font-medium ${
                            chat.status === 'COMPLETED' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                            chat.status === 'HOLD' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' :
                            chat.status === 'CANCEL' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' :
                            'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                          }`}>
                            {chat.status}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Menu Button */}
                    <div className="relative flex-shrink-0" ref={el => { chatMenuRefs.current[chat.id] = el; }}>
                      <button
                        onClick={(e) => toggleChatMenu(chat.id, e)}
                        className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-surface-container transition-all"
                        title="Chat options"
                      >
                        <MoreHorizontal size={16} className="text-on-surface-variant" />
                      </button>
                      {chatMenus[chat.id] && (
                        <div className="absolute right-0 top-full mt-1 bg-surface-container border border-outline-variant rounded-2xl shadow-lg py-2 z-50 min-w-[160px]">
                          <button onClick={() => handleEditChat(chat)} className="w-full px-4 py-2 text-left hover:bg-surface-variant flex items-center gap-3 text-on-surface"><Edit size={16} /> <span className="text-xs">Edit name</span></button>
                          <button onClick={() => handleArchiveChat(chat)} className="w-full px-4 py-2 text-left hover:bg-surface-variant flex items-center gap-3 text-on-surface"><Archive size={16} /> <span className="text-xs">Archive</span></button>
                          {canDeleteChat(chat) && (
                            <>
                              <div className="border-t border-outline-variant my-1" />
                              <button onClick={() => handleDeleteChatClick(chat)} className="w-full px-4 py-2 text-left hover:bg-error-container flex items-center gap-3 text-error"><Trash2 size={16} /> <span className="text-xs">Delete</span></button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {groupChats.length > 5 && (
                  <button
                    onClick={() => onNavigate('allChats')}
                    disabled={isLoadingAllChats}
                    className="flex items-center justify-center gap-2 p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronDown size={16} />
                    <span className="label-small">Show {groupChats.length - 5} more</span>
                  </button>
                )}
              </div>
            </div>
          )))}
      </div>

      {/* Footer User Menu */}
      <div className="p-3 border-t border-outline">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-on-surface">{user?.name}</span>
          <button onClick={onLogout} className="text-on-surface-variant hover:text-error transition-colors p-1 rounded-md" title="Logout">
            <LogOut size={16} />
          </button>
        </div>
      </div>
      {/* @ts-expect-error */}
      <NewChatDialog open={showNewChatDialog} onOpenChange={setShowNewChatDialog} onCreateChat={onCreateChat} />
      <EditChatDialog open={showEditChatDialog} onOpenChange={setShowEditChatDialog} chatName={editingChat?.channelName || ''} onSave={handleSaveEditChat} />
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete Chat"
        message={`Are you sure you want to delete "${chatToDelete?.channelName || 'this chat'}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleConfirmDeleteChat}
        onCancel={() => setChatToDelete(null)}
      />
    </aside>
  )
}