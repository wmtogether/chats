import { Search, Palette, Ruler, CheckCircle, Settings, Eye, Package, Briefcase, Wifi, WifiOff } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { updateChatRequestType } from '../Library/utils/api'
import { useToast } from '../Library/hooks/useToast'
import type { ChatType } from '../Library/types'

interface ChatHeaderProps {
  selectedChat: ChatType | null;
  chatCount: number;
  wsConnected?: boolean;
  onChatUpdate?: (updatedChat: ChatType) => void;
}

export default function ChatHeader({ selectedChat, chatCount, wsConnected = false, onChatUpdate }: ChatHeaderProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showRequestTypeMenu, setShowRequestTypeMenu] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const requestTypeMenuRef = useRef<HTMLDivElement>(null);
  const { addToast } = useToast();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
      if (requestTypeMenuRef.current && !requestTypeMenuRef.current.contains(event.target as Node)) {
        setShowRequestTypeMenu(false);
      }
    };
    if (showUserMenu || showRequestTypeMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserMenu, showRequestTypeMenu]);
  
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

  const REQUEST_TYPES = [
    { id: 'design', label: 'งานออกแบบใหม่', icon: Palette },
    { id: 'dimension', label: 'เช็คระยะ/ขนาด', icon: Ruler },
    { id: 'adjustdesign', label: 'แก้ไขแบบ', icon: Settings },
    { id: 'checkfile', label: 'เช็คไฟล์', icon: CheckCircle },
    { id: 'proof', label: 'ตรวจสอบปรู๊ฟ', icon: Eye },
    { id: 'sample-i', label: 'ตัวอย่าง (Inkjet)', icon: Package },
    { id: 'sample-t', label: 'ตัวอย่าง (Toner)', icon: Package },
    { id: 'general', label: 'เรื่องทั่วไป', icon: Briefcase },
    { id: 'consultation', label: 'ขอคำปรึกษา', icon: Settings },
  ];

  const handleRequestTypeChange = async (newRequestType: string) => {
    if (!selectedChat || isUpdating) return;

    // Don't update if it's the same request type
    if (selectedChat.parsedMetadata?.requestType === newRequestType) {
      setShowRequestTypeMenu(false);
      return;
    }

    setIsUpdating(true);
    
    try {
      const result = await updateChatRequestType(selectedChat.uuid, newRequestType);
      
      if (result.success && result.data) {
        // Update the chat in the parent component
        if (onChatUpdate) {
          onChatUpdate(result.data);
        }
        
        addToast({
          message: `Request type updated to "${REQUEST_TYPES.find(t => t.id === newRequestType)?.label || newRequestType}"`,
          type: 'success'
        });
      } else {
        throw new Error(result.error || 'Failed to update request type');
      }
    } catch (error) {
      console.error('Error updating request type:', error);
      addToast({
        message: `Failed to update request type: ${error instanceof Error ? error.message : 'Unknown error'}`,
        type: 'error'
      });
    } finally {
      setIsUpdating(false);
      setShowRequestTypeMenu(false);
    }
  };

  return (
    <header className="flex items-center gap-4 p-4 border-b border-outline shrink-0 z-[2] bg-surface relative">
      <div className="flex items-center gap-3">
        {selectedChat ? (
          <>
            <div className="relative" ref={requestTypeMenuRef}>
              <button
                onClick={() => !isUpdating && setShowRequestTypeMenu(!showRequestTypeMenu)}
                disabled={isUpdating}
                className={`size-8 rounded-full bg-surface-variant border border-outline flex items-center justify-center hover:bg-surface-variant/80 transition-all duration-200 group hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${
                  showRequestTypeMenu ? 'ring-2 ring-primary/20 bg-primary-container/10' : ''
                }`}
                title={`Current: ${REQUEST_TYPES.find(t => t.id === selectedChat.parsedMetadata?.requestType)?.label || 'Unknown'} - Click to change`}
              >
                {(() => {
                  const IconComponent = getRequestTypeIcon(selectedChat.parsedMetadata?.requestType || 'unknown');
                  return <IconComponent size={16} className="text-on-surface-variant group-hover:text-on-surface transition-colors" />;
                })()}
              </button>
              
              {showRequestTypeMenu && !isUpdating && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-surface-container border border-outline-variant rounded-2xl shadow-lg z-50">
                  <div className="px-3 py-2 border-b border-outline-variant">
                    <span className="text-sm font-medium text-on-surface">Change Request Type</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {REQUEST_TYPES.map((type) => {
                      const IconComponent = type.icon;
                      const isSelected = selectedChat.parsedMetadata?.requestType === type.id;
                      
                      return (
                        <button
                          key={type.id}
                          onClick={() => handleRequestTypeChange(type.id)}
                          className={`w-full px-3 py-2.5 text-left hover:bg-surface-variant flex items-center gap-3 transition-colors ${
                            isSelected ? 'bg-primary-container/20 text-primary' : 'text-on-surface'
                          }`}
                        >
                          <IconComponent size={16} className={isSelected ? 'text-primary' : 'text-on-surface-variant'} />
                          <span className="text-sm">{type.label}</span>
                          {isSelected && (
                            <CheckCircle size={14} className="ml-auto text-primary" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
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
        {/* Redis Connection Status */}
        <div 
          className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
            wsConnected 
              ? 'bg-success/10 text-success' 
              : 'bg-error/10 text-error'
          }`}
          title={wsConnected ? 'Real-time connected' : 'Real-time disconnected'}
        >
          {wsConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
          <span className="label-small">
            {wsConnected ? 'Live' : 'Offline'}
          </span>
        </div>
        
        <button className="flex items-center justify-center size-9 rounded-full hover:bg-surface-variant transition-colors">
          <Search className="text-on-surface-variant" />
        </button>
      </div>
    </header>
  )
}