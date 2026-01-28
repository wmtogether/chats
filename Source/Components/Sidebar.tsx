import { Plus, ChevronDown, Users, LogOut, MoreHorizontal, Edit, Trash2, Archive, MessageSquare } from 'lucide-react'
import { useState, useEffect, useMemo, useRef } from 'react'
import NewChatDialog from './NewChatDialog'
import EditChatDialog from './EditChatDialog'
import { useAuth } from '../Library/Authentication/AuthContext'

type Page = 'chat' | 'users' | 'allChats';
type ChatType = any;

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
}

export default function Sidebar({
  chats,
  selectedChat,
  onChatSelect,
  onNavigate,
  onLogout,
  isLoadingAllChats = false,
  onCreateChat,
}: SidebarProps) {
  const { user } = useAuth();
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [showEditChatDialog, setShowEditChatDialog] = useState(false);
  const [editingChat, setEditingChat] = useState<ChatType | null>(null);
  const [chatMenus, setChatMenus] = useState<{ [key: number]: boolean }>({});
  const chatMenuRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  const chatGroups = useMemo(() => {
    return chats.reduce((acc, chat) => {
      const creator = chat.createdByName || 'Unknown';
      if (!acc[creator]) {
        acc[creator] = [];
      }
      acc[creator].push(chat);
      return acc;
    }, {} as Record<string, ChatType[]>);
  }, [chats]);

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
  const handleDeleteChat = (chat: ChatType) => console.log('Deleting chat:', chat.id);
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
          <button className="flex-1 py-1.5 px-2 rounded-lg bg-surface-variant text-on-surface label-medium shadow-sm text-center transition-all border border-outline">
            Channels
          </button>
          <button className="flex-1 py-1.5 px-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-variant label-medium text-center transition-all">
            Direct Messages
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

      {/* Channels List */}
      <div className="flex-1 overflow-y-auto px-3 pb-4 flex flex-col gap-6">
        {Object.entries(chatGroups).map(([creatorName, groupChats]) => (
          <div key={creatorName} className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-2 pb-1 group/header cursor-pointer">
              <div className="label-small text-on-surface-variant uppercase tracking-wider">
                {creatorName}
              </div>
              <Plus className="text-on-surface-variant opacity-0 group-hover/header:opacity-100 hover:text-on-surface transition-opacity" size={16} />
            </div>
            <div className="flex flex-col gap-1">
              {groupChats.slice(0, 5).map((chat: ChatType) => (
                <div
                  key={chat.id}
                  className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all hover:bg-surface-variant group relative ${selectedChat?.id === chat.id ? 'bg-primary/10 text-primary' : 'text-on-surface'}`}
                >
                  <div 
                    className="flex-1 flex items-center gap-3 min-w-0"
                    onClick={() => onChatSelect(chat)}
                  >
                    <div className="flex-shrink-0">
                      <div className="size-8 rounded-full bg-surface-variant border border-outline flex items-center justify-center">
                        <MessageSquare size={16} className="text-on-surface-variant" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="label-medium truncate pr-2">
                          {chat.channelName}
                        </h3>
                        <span className="label-small text-on-surface-variant flex-shrink-0">
                          {new Date(chat.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="label-small text-on-surface-variant truncate">
                          {/* Placeholder for last message */}
                        </span>
                      </div>
                    </div>
                  </div>
                   <div className="relative" ref={el => { chatMenuRefs.current[chat.id] = el; }}>
                    <button
                      onClick={(e) => toggleChatMenu(chat.id, e)}
                      className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-surface-container transition-all"
                      title="Chat options"
                    >
                      <MoreHorizontal size={16} className="text-on-surface-variant" />
                    </button>
                    {chatMenus[chat.id] && (
                      <div className="absolute right-0 top-full mt-1 bg-surface-container border border-outline-variant rounded-2xl shadow-lg py-2 z-50 min-w-[160px]">
                        <button onClick={() => handleEditChat(chat)} className="w-full px-4 py-2 text-left hover:bg-surface-variant flex items-center gap-3 text-on-surface"><Edit size={16} /> <span className="text-xs">Edit name</span></button>
                        <button onClick={() => handleArchiveChat(chat)} className="w-full px-4 py-2 text-left hover:bg-surface-variant flex items-center gap-3 text-on-surface"><Archive size={16} /> <span className="text-xs">Archive</span></button>
                        <div className="border-t border-outline-variant my-1" />
                        <button onClick={() => handleDeleteChat(chat)} className="w-full px-4 py-2 text-left hover:bg-error-container flex items-center gap-3 text-error"><Trash2 size={16} /> <span className="text-xs">Delete</span></button>
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
        ))}
      </div>

      {/* Footer User Menu */}
      <div className="p-3 border-t border-outline">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-on-surface">{user?.name}</span>
          <button onClick={onLogout} className="text-on-surface-variant hover:text-error transition-colors p-1 rounded-md" title="Logout">
            <LogOut size={18} />
          </button>
        </div>
        <div className="mt-2 flex flex-col gap-1">
            <button onClick={() => onNavigate('users')} className="w-full text-left p-2 rounded-md hover:bg-surface-variant transition-colors flex items-center gap-2 text-on-surface-variant">
                <Users size={16} />
                <span className="text-sm">View Users</span>
            </button>
            <button onClick={() => onNavigate('allChats')} className="w-full text-left p-2 rounded-md hover:bg-surface-variant transition-colors flex items-center gap-2 text-on-surface-variant">
                <ChevronDown size={16} />
                <span className="text-sm">Show All Chats</span>
            </button>
        </div>
      </div>

      <NewChatDialog open={showNewChatDialog} onOpenChange={setShowNewChatDialog} onCreateChat={onCreateChat} />
      <EditChatDialog open={showEditChatDialog} onOpenChange={setShowEditChatDialog} chatName={editingChat?.channelName || ''} onSave={handleSaveEditChat} />
    </aside>
  )
}