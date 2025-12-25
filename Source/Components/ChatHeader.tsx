import { Search, LogOut, Palette, Ruler, CheckCircle, Settings, Eye, Package, Briefcase } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import type { Chat } from './Chatlists'
import authService from '../Library/Authentication/jwt'
import { getProfileImageUrl, getProfileInitial } from '../Library/Shared/profileUtils'

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
    // Refresh user data from auth service
    const currentUser = authService.getUser();
    console.log('ChatHeader - Current user from auth service:', currentUser);
    setUser(currentUser);
    
    // Set up a listener for auth state changes
    const interval = setInterval(() => {
      const updatedUser = authService.getUser();
      if (JSON.stringify(updatedUser) !== JSON.stringify(user)) {
        console.log('ChatHeader - User data updated:', updatedUser);
        setUser(updatedUser);
      }
    }, 1000);

    // Set up native logout listener
    const handleNativeLogout = () => {
      console.log('Native logout event received');
      onLogout();
    };

    // Set up global logout function
    (window as any).appLogout = onLogout;
    
    // Listen for native logout event
    window.addEventListener('nativeLogout', handleNativeLogout);

    return () => {
      clearInterval(interval);
      window.removeEventListener('nativeLogout', handleNativeLogout);
      delete (window as any).appLogout;
    };
  }, [user, onLogout]);

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

  return (
    <header className="flex items-center gap-4 p-4 border-b border-outline shrink-0 z-30 bg-surface relative">
      <div className="flex items-center gap-3">
        {selectedChat ? (
          <>
            <div className="size-8 rounded-full bg-surface-variant border border-outline flex items-center justify-center">
              {(() => {
                const IconComponent = getRequestTypeIcon(selectedChat.metadata?.requestType || 'unknown');
                return <IconComponent size={16} className="text-on-surface-variant" />;
              })()}
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
          <Search className="text-on-surface-variant" />
        </button>
        <div className="relative" ref={menuRef}>
          <button 
            className="flex items-center justify-center size-9 rounded-full hover:bg-surface-variant transition-colors"
            onClick={() => setShowUserMenu(!showUserMenu)}
          >
            <div 
              className="size-8 rounded-full bg-surface border border-outline flex items-center justify-center text-on-surface label-medium" 
              style={user?.profilePicture ? { 
                backgroundImage: `url("${getProfileImageUrl(user.profilePicture)}")`, 
                backgroundSize: 'cover' 
              } : {}}
            >
              {!user?.profilePicture && getProfileInitial(user?.name, user?.uid)}
            </div>
          </button>
          {showUserMenu && (
            <div className="absolute top-full right-0 mt-2 w-48 bg-background border border-outline rounded-lg shadow-xl z-[9999]">
              <div className="p-2">
                <div className="px-2 py-1">
                  <p className="label-medium text-on-surface">
                    {user?.name || 'User'}
                    {!user && <span className="text-error"> (No user data)</span>}
                  </p>
                  <p className="label-small text-on-surface-variant">{user?.role || 'Member'}</p>
                </div>
                <hr className="my-2 border-outline" />
                <button
                  onClick={() => {
                    // Show native confirmation dialog - don't call onLogout here
                    try {
                      (window as any).nativeDialog?.confirmLogout();
                      // The backend will call triggerLogout if user confirms
                    } catch (error) {
                      console.error('Dialog error:', error);
                      // Fallback to browser confirm
                      if (confirm('Are you sure you want to sign out?')) {
                        onLogout();
                      }
                    }
                  }}
                  className="flex items-center gap-2 w-full p-2 rounded-md hover:bg-error/10 text-error transition-colors"
                >
                  <LogOut size={16} />
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