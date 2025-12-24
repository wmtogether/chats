import { useState, useEffect } from 'react'
import Icon from './Icon'
import mockupData from '../Data/mockup.json'

interface Chat {
  id: number
  uuid: string
  channelId: string
  channelName: string
  channelType: string
  chatCategory: string
  description: string | null
  jobId: number | null
  queueId: number | null
  customerId: number | null
  customers: any | null
  metadata: {
    queueId?: number
    queueStatus: string
    requestType: string
    createdByName: string
  } | null
  isArchived: number
  createdById: number
  createdByName: string
  createdAt: string
  updatedAt: string
}

interface ChatlistsProps {
  onChatSelect?: (chat: Chat) => void
  selectedChatId?: number
  onShowAllChats?: () => void
}

export default function Chatlists({ onChatSelect, selectedChatId, onShowAllChats }: ChatlistsProps) {
  // Filter out chats with null metadata
  const [chats] = useState<Chat[]>(
    (mockupData.chats as Chat[]).filter((chat) => chat.metadata !== null)
  )
  const [showAll, setShowAll] = useState(false)

  const displayedChats = showAll ? chats : chats.slice(0, 5)

  const handleChatClick = (chat: Chat) => {
    onChatSelect?.(chat)
  }

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
          <Icon name="expand_more" size={16} />
          <span className="label-medium">Show {chats.length - 5} more chats</span>
        </button>
      )}
      
      {showAll && chats.length > 5 && (
        <button
          onClick={() => setShowAll(false)}
          className="flex items-center justify-center gap-2 p-3 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-all"
        >
          <Icon name="expand_less" size={16} />
          <span className="label-medium">Show less</span>
        </button>
      )}
    </div>
  )
}

export type { Chat }