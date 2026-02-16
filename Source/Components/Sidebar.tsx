import { Plus, ChevronDown, LogOut, MoreHorizontal, Edit, Trash2, Archive, MessageSquare, Search, X, UserPlus, UserMinus } from 'lucide-react'
import { useState, useEffect, useMemo, useRef } from 'react'
import NewChatDialog from './NewChatDialog'
import EditChatDialog from './EditChatDialog'
import JoinChatDialog from './JoinChatDialog'
import { useAuth } from '../Library/Authentication/AuthContext'
import ConfirmDialog from './ui/ConfirmDialog';
import { useToast } from '../Library/hooks/useToast.tsx';
import type { ChatType } from '../Library/types'; // Import ChatType
import { getNullStringValue } from '../Library/utils/api.ts'; // Import getNullStringValue
import { Palette, Ruler, FileCheck, Eye, Package, Briefcase, Settings } from 'lucide-react'
import { getStatusConfig } from '../Library/constants/status'; // Import status config
import { joinChat, leaveChat, getUserJoinedChats } from '../Library/Shared/chatMemberApi'; // Import API functions
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
      label: 'ขอ Proof', // Proof Review
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
  onDeleteChat: (chatId: string | number) => Promise<void>;
  joinedChats?: Set<number>; // Add joined chats state
  onJoinChat?: (chatId: number) => Promise<void>; // Add join handler
  onLeaveChat?: (chatId: number) => Promise<void>; // Add leave handler
}

export default function Sidebar({
  chats,
  selectedChat,
  onChatSelect,
  onNavigate,
  onLogout,
  isLoadingAllChats = false,
  onCreateChat,
  onDeleteChat,
  joinedChats: externalJoinedChats,
  onJoinChat: externalOnJoinChat,
  onLeaveChat: externalOnLeaveChat,
}: SidebarProps) {
  const { user } = useAuth();
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [showEditChatDialog, setShowEditChatDialog] = useState(false);
  const [editingChat, setEditingChat] = useState<ChatType | null>(null);
  const [chatMenus, setChatMenus] = useState<{ [key: number]: boolean }>({});
  const chatMenuRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false); // New state
  const [chatToDelete, setChatToDelete] = useState<ChatType | null>(null); // New state
  const [showJoinDialog, setShowJoinDialog] = useState(false); // Join dialog state
  const [chatToJoin, setChatToJoin] = useState<ChatType | null>(null); // Chat for join/leave action
  
  // Use external state if provided, otherwise use local state
  const [localJoinedChats, setLocalJoinedChats] = useState<Set<number>>(new Set());
  const joinedChats = externalJoinedChats || localJoinedChats;
  
  const [isLoadingMembership, setIsLoadingMembership] = useState(false); // Loading state for join/leave
  const { addToast } = useToast(); // Initialize useToast
  const [activeTab, setActiveTab] = useState<SidebarTab>('channels'); // New state for tab management

  // Load user's joined chats on mount (only if not using external state)
  useEffect(() => {
    if (externalJoinedChats) return; // Skip if using external state
    
    const loadJoinedChats = async () => {
      try {
        const chatIds = await getUserJoinedChats();
        setLocalJoinedChats(new Set(chatIds));
      } catch (error) {
        console.error('Failed to load joined chats:', error);
      }
    };

    if (user) {
      loadJoinedChats();
    }
  }, [user, externalJoinedChats]);

  // Search functionality
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter chats based on search query and active tab
  const filteredChats = useMemo(() => {
    let baseChats = chats;
    
    // Filter by tab first
    if (activeTab === 'me' && user) {
      // Show chats created by user OR chats user has joined
      baseChats = chats.filter(chat => 
        chat.createdById === user.id || joinedChats.has(chat.id)
      );
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
  }, [chats, searchQuery, activeTab, user, joinedChats]);

  const chatGroups = useMemo(() => {
    // First, deduplicate chats by UUID to prevent rendering duplicates
    const uniqueChats = filteredChats.reduce((acc, chat) => {
      const existingIndex = acc.findIndex(c => c.uuid === chat.uuid);
      if (existingIndex === -1) {
        acc.push(chat);
      } else {
        // If duplicate found, keep the one with the higher ID (more recent)
        if (chat.id > acc[existingIndex].id) {
          acc[existingIndex] = chat;
        }
      }
      return acc;
    }, [] as ChatType[]);
    
    return uniqueChats.reduce((acc, chat) => {
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

  const handleJoinLeaveClick = (chat: ChatType) => {
    closeChatMenu(chat.id);
    setChatToJoin(chat);
    setShowJoinDialog(true);
  };

  const handleConfirmJoinLeave = async () => {
    if (!chatToJoin || isLoadingMembership) return;

    const isJoined = joinedChats.has(chatToJoin.id);
    setIsLoadingMembership(true);
    
    try {
      if (isJoined) {
        // Leave chat
        if (externalOnLeaveChat) {
          await externalOnLeaveChat(chatToJoin.id);
        } else {
          await leaveChat(chatToJoin.id);
          setLocalJoinedChats(prev => {
            const newSet = new Set(prev);
            newSet.delete(chatToJoin.id);
            return newSet;
          });
        }
        addToast({ 
          message: `You left "${chatToJoin.channelName}"`, 
          type: 'success' 
        });
      } else {
        // Join chat
        if (externalOnJoinChat) {
          await externalOnJoinChat(chatToJoin.id);
        } else {
          await joinChat(chatToJoin.id);
          setLocalJoinedChats(prev => new Set(prev).add(chatToJoin.id));
        }
        addToast({ 
          message: `You joined "${chatToJoin.channelName}"`, 
          type: 'success' 
        });
      }
    } catch (error) {
      console.error('Failed to join/leave chat:', error);
      addToast({ 
        message: error instanceof Error ? error.message : 'Failed to update membership', 
        type: 'error' 
      });
    } finally {
      setIsLoadingMembership(false);
      setChatToJoin(null);
      setShowJoinDialog(false);
    }
  };

  // Check if user is a member of the chat
  const isChatMember = (chat: ChatType): boolean => {
    // User is always a member of chats they created
    if (chat.createdById === user?.id) return true;
    
    // Check if user has explicitly joined
    return joinedChats.has(chat.id);
  };


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
    <aside className="w-[350px] bg-surface flex flex-col border-r border-outline shrink-0 z-10 select-none relative">
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
                {groupChats.slice(0, 5).map((chat: ChatType) => {
                  const statusConfig = chat.status ? getStatusConfig(chat.status) : null;
                  const StatusIcon = statusConfig?.icon;
                  
                  return (
                    <div
                      key={chat.uuid || chat.id}
                      className={`relative rounded-2xl cursor-pointer transition-all hover:bg-surface-variant/50 group border ${
                        selectedChat?.id === chat.id 
                          ? 'bg-surface-variant border-outline' 
                          : 'bg-surface border-outline/30 hover:border-outline/50'
                      }`}
                    >
                      <div
                        className="flex flex-col gap-2 p-4 pr-12"
                        onClick={() => onChatSelect(chat)}
                      >
                        {/* Header Row: Chat Name + Time */}
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="title-large font-semibold text-on-surface truncate">
                            {searchQuery ? highlightMatch(chat.channelName, searchQuery) : chat.channelName}
                          </h3>
                          <span className="body-medium text-on-surface-variant flex-shrink-0">
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

                        {/* Creator Row with Unique ID */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="body-medium text-on-surface-variant">
                            by {searchQuery ? highlightMatch(chat.createdByName, searchQuery) : chat.createdByName}
                          </span>
                          {chat.createdById === user?.id && (
                            <span className="px-2 py-0.5 bg-primary text-on-primary rounded-full label-small font-medium">
                              You
                            </span>
                          )}
                          {chat.createdById !== user?.id && isChatMember(chat) && (
                            <span className="px-2 py-0.5 bg-tertiary text-on-tertiary rounded-full label-small font-medium flex items-center gap-1">
                              <UserPlus size={12} />
                              Joined
                            </span>
                          )}
                          {chat.uniqueId && (
                            <>
                              <span className="text-on-surface-variant/40">•</span>
                              <span className="body-small text-on-surface-variant font-mono">
                                {searchQuery ? highlightMatch(chat.uniqueId, searchQuery) : chat.uniqueId}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Info Row: Customer + Request Type + Status */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Customer Badge */}
                          {getNullStringValue(chat.customers) && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container rounded-lg border border-outline/50">
                              <Briefcase size={14} className="text-on-surface-variant" />
                              <span className="label-medium text-on-surface">
                                {searchQuery ? highlightMatch(getNullStringValue(chat.customers)!, searchQuery) : getNullStringValue(chat.customers)}
                              </span>
                            </div>
                          )}

                          {/* Request Type Badge */}
                          {chat.parsedMetadata?.requestType && (
                            (() => {
                              const reqType = REQUEST_TYPES.find(rt => rt.id === chat.parsedMetadata?.requestType);
                              if (reqType) {
                                const IconComponent = reqType.icon;
                                return (
                                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container rounded-lg border border-outline/50">
                                    <IconComponent size={14} className="text-on-surface-variant" />
                                    <span className="label-medium text-on-surface">Job</span>
                                  </div>
                                );
                              }
                              return null;
                            })()
                          )}

                          {/* Status Badge */}
                          {statusConfig && (
                            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${statusConfig.bgColor}`}>
                              {StatusIcon && <StatusIcon size={14} className={statusConfig.color} />}
                              <span className={`label-medium font-medium ${statusConfig.textColor}`}>
                                {statusConfig.labelTh}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Menu Button - Positioned absolutely with proper z-index */}
                      <div className="absolute top-3 right-3 z-10" ref={el => { chatMenuRefs.current[chat.id] = el; }}>
                        <button
                          onClick={(e) => toggleChatMenu(chat.id, e)}
                          className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-surface-container transition-all"
                          title="Chat options"
                        >
                          <MoreHorizontal size={16} className="text-on-surface-variant" />
                        </button>
                        {chatMenus[chat.id] && (
                          <div className="absolute right-0 top-full mt-1 bg-surface border border-outline-variant rounded-2xl shadow-2xl py-2 z-[100] min-w-[160px]">
                            {/* Join/Leave option - only show if not creator */}
                            {chat.createdById !== user?.id && (
                              <>
                                <button 
                                  onClick={() => handleJoinLeaveClick(chat)} 
                                  className={`w-full px-4 py-2 text-left hover:bg-surface-variant flex items-center gap-3 ${
                                    isChatMember(chat) ? 'text-error' : 'text-primary'
                                  }`}
                                >
                                  {isChatMember(chat) ? (
                                    <>
                                      <UserMinus size={16} />
                                      <span className="text-xs">Leave</span>
                                    </>
                                  ) : (
                                    <>
                                      <UserPlus size={16} />
                                      <span className="text-xs">Join</span>
                                    </>
                                  )}
                                </button>
                                <div className="border-t border-outline-variant my-1" />
                              </>
                            )}
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
                  );
                })}
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
      <JoinChatDialog
        isOpen={showJoinDialog}
        onClose={() => {
          setShowJoinDialog(false);
          setChatToJoin(null);
        }}
        chatName={chatToJoin?.channelName || ''}
        isJoined={chatToJoin ? isChatMember(chatToJoin) : false}
        onConfirm={handleConfirmJoinLeave}
      />
    </aside>
  )
}