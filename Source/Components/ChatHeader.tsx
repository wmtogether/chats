import Icon from './Icon'
import { useState, useRef, useEffect } from 'react'
import type { Chat } from './Chatlists'
import authService from '../Library/Authentication/jwt'

interface ChatHeaderProps {
  selectedChat: Chat | null;
  onLogout: () => void;
  chatCount: number;
}

export default function ChatHeader({ selectedChat, onLogout, chatCount }: ChatHeaderProps) {
  const [user, setUser] = useState(authService.getUser());
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  return (
    <header className="flex items-center gap-4 p-4 border-b border-outline shrink-0 z-10 bg-surface">
      <div className="flex items-center gap-3">
        {selectedChat ? (
          <>
            <div className="size-8 rounded-full bg-surface-variant border border-outline flex items-center justify-center">
              <Icon 
                name={getRequestTypeIcon(selectedChat.metadata?.requestType || 'unknown')}
                size={16} 
                className="text-on-surface-variant"
              />
            </div>
            <h1 className="title-medium text-on-surface truncate">
              {selectedChat.channelName}
            </h1>
          </>
        ) : (
          <h1 className="title-large text-on-surface">Chats ({chatCount})</h1>
        )}
      </div>

      <div className="flex-grow" />

      <div className="flex items-center gap-3">
        <button className="flex items-center justify-center size-9 rounded-full hover:bg-surface-variant transition-colors">
          <Icon name="search" className="text-on-surface-variant" />
        </button>
        <div className="relative" ref={menuRef}>
          <button 
            className="flex items-center justify-center size-9 rounded-full hover:bg-surface-variant transition-colors"
            onClick={() => setShowUserMenu(!showUserMenu)}
          >
            <div 
              className="size-8 rounded-full bg-surface border border-outline flex items-center justify-center text-on-surface label-medium" 
              style={user?.profilePicture ? { 
                backgroundImage: `url("http://10.10.60.8:1669${user.profilePicture}")`, 
                backgroundSize: 'cover' 
              } : {}}
            >
              {!user?.profilePicture && (user?.name?.charAt(0) || user?.uid?.charAt(0) || 'U')}
            </div>
          </button>
          {showUserMenu && (
            <div className="absolute top-full right-0 mt-2 w-48 bg-surface-container border border-outline rounded-lg shadow-lg z-50">
              <div className="p-2">
                <div className="px-2 py-1">
                  <p className="label-medium text-on-surface">{user?.name || 'User'}</p>
                  <p className="label-small text-on-surface-variant">{user?.role || 'Member'}</p>
                </div>
                <hr className="my-2 border-outline" />
                <button
                  onClick={onLogout}
                  className="flex items-center gap-2 w-full p-2 rounded-md hover:bg-error/10 text-error transition-colors"
                >
                  <Icon name="logout" size={16} />
                  <span className="label-medium">Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}