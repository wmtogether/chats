import Icon from './Icon'
import authService from '../Library/Authentication/jwt'
import { useState, useEffect, useRef } from 'react'

export default function Sidebar() {
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

  const handleLogout = () => {
    authService.logout();
    window.location.reload(); // Simple way to reset the app state
  };
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
        {/* Manager Section */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-2 pb-1 group/header cursor-pointer">
            <div className="label-small text-on-surface-variant uppercase tracking-wider">Manager</div>
            <Icon name="add" className="text-on-surface-variant opacity-0 group-hover/header:opacity-100 hover:text-on-surface transition-opacity" size={16} />
          </div>
          <div className="flex flex-col gap-1">
            <SidebarItem icon="tag" label="release-planning" />
            <SidebarItem icon="lock" label="hiring-confidential" />
          </div>
        </div>

        {/* Sale Section (Active) */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-2 pb-1 group/header cursor-pointer">
            <div className="label-small text-on-surface-variant uppercase tracking-wider">Sale</div>
            <Icon name="add" className="text-on-surface-variant opacity-0 group-hover/header:opacity-100 hover:text-on-surface transition-opacity" size={16} />
          </div>
          
          <div className="rounded-lg bg-surface border border-outline overflow-hidden">
            <a className="flex items-center gap-2.5 px-3 py-2 bg-primary/10 border-l-2 border-primary text-on-surface transition-all group" href="#">
              <Icon name="tag" className="text-primary" />
              <span className="title-small">enterprise-leads</span>
            </a>
            
            {/* Thread Sub-items */}
            <div className="px-3 pb-3 pt-2">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex -space-x-1.5">
                  <div className="size-5 rounded-full ring-2 ring-background bg-primary text-on-primary flex items-center justify-center label-small">L</div>
                  <div className="size-5 rounded-full ring-2 ring-background bg-tertiary text-on-tertiary flex items-center justify-center label-small">A</div>
                  <div className="size-5 rounded-full ring-2 ring-background bg-surface-variant flex items-center justify-center label-small text-on-surface border border-outline">+2</div>
                </div>
                <span className="label-small text-on-surface-variant">4 Members</span>
              </div>
              <div className="flex flex-col gap-1 pl-1">
                <ThreadItem label="Q4 Targets" isNew />
                <ThreadItem label="Acme Corp Deal" />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-0.5">
            <SidebarItem icon="tag" label="customer-success" />
            <div className="pl-9 text-[10px] text-on-surface-variant/50">Bob, Alice</div>
          </div>
        </div>
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