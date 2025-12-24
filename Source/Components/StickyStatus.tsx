import Icon from './Icon'
import type { Chat } from './Chatlists'

interface StickyStatusProps {
  selectedChat?: Chat | null;
}

export default function StickyStatus({ selectedChat }: StickyStatusProps) {
  if (!selectedChat) {
    return (
      <div className="sticky top-0 z-20 px-6 pt-6 pb-8 bg-gradient-to-b from-background via-background to-transparent pointer-events-none select-none">
        <div className="pointer-events-auto relative overflow-hidden rounded-xl bg-surface border border-outline shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex items-center justify-center p-8 group">
          <div className="text-center">
            <Icon name="chat" className="text-on-surface-variant mb-2" size={32} />
            <p className="body-medium text-on-surface-variant">Select a chat to view status</p>
          </div>
        </div>
      </div>
    )
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING': return 'schedule'
      case 'IN_PROGRESS': return 'trending_up'
      case 'COMPLETED': return 'check_circle'
      case 'CANCELLED': return 'cancel'
      default: return 'help'
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

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-500/10 border-yellow-500/20'
      case 'IN_PROGRESS': return 'bg-blue-500/10 border-blue-500/20'
      case 'COMPLETED': return 'bg-green-500/10 border-green-500/20'
      case 'CANCELLED': return 'bg-red-500/10 border-red-500/20'
      default: return 'bg-surface-variant/10 border-outline'
    }
  }

  const getRequestTypeLabel = (requestType: string) => {
    switch (requestType) {
      case 'design': return 'Design Request'
      case 'dimension': return 'Dimension Check'
      case 'checkfile': return 'File Check'
      case 'adjustdesign': return 'Design Adjustment'
      case 'proof': return 'Proof Request'
      case 'sample-i': return 'Sample (Internal)'
      case 'sample-t': return 'Sample (Test)'
      default: return 'Work Request'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    
    if (diffInHours < 1) {
      return 'Just now'
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`
    } else {
      const diffInDays = Math.floor(diffInHours / 24)
      return `${diffInDays}d ago`
    }
  }

  const status = selectedChat.metadata?.queueStatus || 'UNKNOWN'
  const requestType = selectedChat.metadata?.requestType || 'unknown'
  const createdBy = selectedChat.metadata?.createdByName || selectedChat.createdByName
  const queueId = selectedChat.metadata?.queueId || 'N/A'

  return (
    <div className="sticky top-0 z-20 px-6 pt-6 pb-8 bg-gradient-to-b from-background via-background to-transparent pointer-events-none select-none">
      <div className="pointer-events-auto relative overflow-hidden rounded-xl bg-surface border border-outline shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex items-center justify-between p-4 group">
        <div className={`absolute inset-0 bg-gradient-to-r from-current/5 to-transparent pointer-events-none ${getStatusColor(status)}`} />
        <div className="flex items-center gap-4 relative z-10">
          <div className={`size-12 rounded-full flex items-center justify-center shrink-0 border ${getStatusBgColor(status)}`}>
            <Icon name={getStatusIcon(status)} className={getStatusColor(status)} size={24} />
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <h3 className="title-medium text-on-surface">Queue #{queueId} • {status}</h3>
              {status === 'PENDING' && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500" />
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 body-small text-on-surface-variant">
              <Icon name="work" size={14} />
              <span>{getRequestTypeLabel(requestType)} • Created by {createdBy} • {formatDate(selectedChat.updatedAt)}</span>
            </div>
          </div>
        </div>
        <button className="relative z-10 hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-variant hover:bg-surface-variant label-medium text-on-surface border border-outline transition-all hover:border-outline">
          <span>Update Status</span>
          <Icon name="expand_more" size={16} />
        </button>
      </div>
    </div>
  )
}