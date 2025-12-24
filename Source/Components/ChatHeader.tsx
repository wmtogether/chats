import Icon from './Icon'
import type { Chat } from './Chatlists'

interface ChatHeaderProps {
  selectedChat?: Chat | null;
}

export default function ChatHeader({ selectedChat }: ChatHeaderProps) {
  if (!selectedChat) {
    return (
      <header className="h-16 flex items-center justify-between px-6 border-b border-outline bg-surface/80 backdrop-blur-md z-30 shrink-0 sticky top-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-on-surface">
            <Icon name="chat" className="text-on-surface-variant" size={20} />
            <h2 className="title-large">Select a chat</h2>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="text-on-surface-variant hover:text-on-surface transition-colors">
            <Icon name="search" />
          </button>
          <button className="text-on-surface-variant hover:text-on-surface transition-colors">
            <Icon name="side_navigation" />
          </button>
        </div>
      </header>
    )
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

  return (
    <header className="h-16 flex items-center justify-between px-6 border-b border-outline bg-surface/80 backdrop-blur-md z-30 shrink-0 sticky top-0">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 text-on-surface">
          <Icon name={getRequestTypeIcon(selectedChat.metadata?.requestType || 'work')} className="text-primary" size={20} />
          <h2 className="title-large truncate max-w-[400px]">{selectedChat.channelName}</h2>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center label-medium" title={selectedChat.metadata?.createdByName || selectedChat.createdByName}>
            {(selectedChat.metadata?.createdByName || selectedChat.createdByName).charAt(0)}
          </div>
          <span className="label-medium text-on-surface-variant">{selectedChat.metadata?.createdByName || selectedChat.createdByName}</span>
        </div>
        <div className="w-px h-6 bg-surface-variant" />
        <button className="text-on-surface-variant hover:text-on-surface transition-colors">
          <Icon name="search" />
        </button>
        <button className="text-on-surface-variant hover:text-on-surface transition-colors">
          <Icon name="side_navigation" />
        </button>
      </div>
    </header>
  )
}