import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, Palette, Ruler, CheckCircle, Settings, Eye, Package, Briefcase } from 'lucide-react'


type Chat = any;

interface ChatlistsProps {
  chats: Chat[];
  onChatSelect: (chat: Chat) => void;
  selectedChatId?: number;
  onShowAllChats: () => void;
}

export default function Chatlists({ chats, onChatSelect, selectedChatId, onShowAllChats }: ChatlistsProps) {
  const [showAll, setShowAll] = useState(false)

  const handleChatClick = (chat: Chat) => {
    onChatSelect(chat)
  };

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
    <div className="flex flex-col gap-1">
      {displayedChats.map((chat) => (
        <div
          key={chat.id}
          onClick={() => handleChatClick(chat)}
          className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all hover:bg-surface-variant group ${
            selectedChatId === chat.id ? 'bg-primary/10 border-l-2 border-primary' : ''
          }`}
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
                {formatRelativeDate(chat.updatedAt)}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="label-small text-on-surface-variant">
                by {chat.metadata?.createdByName || chat.createdByName}
              </span>
              <span className={`label-small ${getStatusColor(chat.metadata?.queueStatus || 'UNKNOWN')}`}>
                {chat.metadata?.queueStatus || 'UNKNOWN'}
              </span>
            </div>
          </div>
        </div>
      ))}
      
      {!showAll && chats.length > 5 && (
        <button
          onClick={onShowAllChats}
          className="flex items-center justify-center gap-2 p-3 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-all"
        >
          <ChevronDown size={16} />
          <span className="label-medium">Show {chats.length - 5} more chats</span>
        </button>
      )}
      
      {showAll && chats.length > 5 && (
        <button
          onClick={() => setShowAll(false)}
          className="flex items-center justify-center gap-2 p-3 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-all"
        >
          <ChevronUp size={16} />
          <span className="label-medium">Show less</span>
        </button>
      )}
    </div>
  )
}

export type { Thread as Chat }