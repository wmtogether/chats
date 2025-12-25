import { useState, useEffect } from 'react'
import { MessageCircle, User, Briefcase, ChevronDown, ChevronUp, Check, Clock, TrendingUp, Ruler, MessageSquare, CheckCircle, Pause, XCircle, HelpCircle } from 'lucide-react'
import type { Thread as Chat } from '../Library/Shared/threadsApi'
import { queueApiService, type QueueStatus, QUEUE_STATUSES } from '../Library/Shared/queueApi'

// Helper function to get Lucide icon component for status
const getStatusIcon = (status: string) => {
  switch (status) {
    case 'PENDING': return Clock;
    case 'ACCEPTED': return TrendingUp;
    case 'WAIT_DIMENSION': return Ruler;
    case 'WAIT_FEEDBACK': return MessageSquare;
    case 'WAIT_QA': return CheckCircle;
    case 'HOLD': return Pause;
    case 'COMPLETED': return CheckCircle;
    case 'CANCEL': return XCircle;
    default: return HelpCircle;
  }
}

interface StickyStatusProps {
  selectedChat: Chat | null;
  onStatusUpdate?: (newStatus: string) => void;
}

export default function StickyStatus({ selectedChat, onStatusUpdate }: StickyStatusProps) {
  const [queueData, setQueueData] = useState<QueueStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  // Helper function to format dates
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

  // Load queue data when chat changes
  useEffect(() => {
    const loadQueueData = async () => {
      if (!selectedChat?.metadata?.queueId) {
        setQueueData(null);
        return;
      }

      setIsLoading(true);
      try {
        const queue = await queueApiService.getQueue(selectedChat.metadata.queueId);
        setQueueData(queue);
        console.log('✅ Queue data loaded:', queue);
      } catch (error) {
        console.error('❌ Failed to load queue data:', error);
        setQueueData(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadQueueData();
  }, [selectedChat?.metadata?.queueId]);

  // Handle status update
  const handleStatusUpdate = async (newStatus: string) => {
    if (!queueData || isUpdating) return;

    setIsUpdating(true);
    try {
      const updatedQueue = await queueApiService.updateQueueStatus(queueData.id, {
        status: newStatus
      });
      
      setQueueData(updatedQueue);
      setShowStatusDropdown(false);
      
      // Notify parent component
      onStatusUpdate?.(newStatus);
      
      console.log('✅ Queue status updated:', updatedQueue);
    } catch (error) {
      console.error('❌ Failed to update queue status:', error);
      // You might want to show a toast notification here
    } finally {
      setIsUpdating(false);
    }
  };

  if (!selectedChat) {
    return (
      <div className="sticky top-0 z-10 px-6 pt-6 pb-8 bg-gradient-to-b from-background via-background to-transparent pointer-events-none select-none">
        <div className="pointer-events-auto relative overflow-hidden rounded-xl bg-surface border border-outline shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex items-center justify-center p-8 group">
          <div className="text-center">
            <MessageCircle className="text-on-surface-variant mb-2" size={32} />
            <p className="body-medium text-on-surface-variant">Select a chat to view status</p>
          </div>
        </div>
      </div>
    )
  }

  // If no queue data and not a queue chat, show basic chat info
  if (!selectedChat.metadata?.queueId) {
    return (
      <div className="sticky top-0 z-10 px-6 pt-6 pb-8 bg-gradient-to-b from-background via-background to-transparent pointer-events-none select-none">
        <div className="pointer-events-auto relative overflow-hidden rounded-xl bg-surface border border-outline shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex items-center justify-between p-4 group">
          <div className="flex items-center gap-4 relative z-10">
            <div className="size-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <MessageCircle className="text-primary" size={24} />
            </div>
            <div className="flex flex-col gap-0.5">
              <h3 className="title-medium text-on-surface">{selectedChat.channelName}</h3>
              <div className="flex items-center gap-1.5 body-small text-on-surface-variant">
                <User size={14} />
                <span>Created by {selectedChat.createdByName} • {formatDate(selectedChat.updatedAt)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="sticky top-0 z-10 px-6 pt-6 pb-8 bg-gradient-to-b from-background via-background to-transparent pointer-events-none select-none">
        <div className="pointer-events-auto relative overflow-hidden rounded-xl bg-surface border border-outline shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex items-center justify-center p-8 group">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="body-medium text-on-surface-variant">Loading queue status...</p>
          </div>
        </div>
      </div>
    )
  }

  // Use queue data if available, fallback to chat metadata
  const status = queueData?.status || selectedChat.metadata?.queueStatus || 'UNKNOWN';
  const requestType = queueData?.requestType || selectedChat.metadata?.requestType || 'unknown';
  const createdBy = queueData?.createdByName || selectedChat.metadata?.createdByName || selectedChat.createdByName;
  const queueId = queueData?.id || selectedChat.metadata?.queueId || 'N/A';
  const customerName = queueData?.customerName || selectedChat.customers;
  const assignedTo = queueData?.assignedToName;

  return (
    <div className="sticky top-0 z-10 px-6 pt-6 pb-8 bg-gradient-to-b from-background via-background to-transparent pointer-events-none select-none">
      <div className="pointer-events-auto relative rounded-xl bg-surface border border-outline shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex items-center justify-between p-4 group overflow-visible">
        <div className={`absolute inset-0 bg-gradient-to-r from-current/5 to-transparent pointer-events-none ${queueApiService.getStatusColor(status)}`} />
        
        <div className="flex items-center gap-4 relative z-10">
          <div className={`size-12 rounded-full flex items-center justify-center shrink-0 border ${queueApiService.getStatusBgColor(status)}`}>
            {(() => {
              const IconComponent = getStatusIcon(status);
              return <IconComponent className={queueApiService.getStatusColor(status)} size={24} />;
            })()}
          </div>
          
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <h3 className="title-medium text-on-surface">
                Queue #{queueId} • {queueApiService.getStatusLabel(status)}
              </h3>
              {status === 'PENDING' && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500" />
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-1.5 body-small text-on-surface-variant">
              <Briefcase size={14} />
              <span>
                {queueApiService.getRequestTypeLabel(requestType)}
                {customerName && ` • ${customerName}`}
                {assignedTo && ` • Assigned to ${assignedTo}`}
                • Created by {createdBy} • {formatDate(queueData?.updatedAt || selectedChat.updatedAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Status Update Button */}
        <div className="relative z-10">
          <button 
            onClick={() => setShowStatusDropdown(!showStatusDropdown)}
            disabled={isUpdating}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-variant hover:bg-surface-variant/80 label-medium text-on-surface border border-outline transition-all hover:border-outline disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUpdating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                <span>Updating...</span>
              </>
            ) : (
              <>
                <span>Update Status</span>
                {showStatusDropdown ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </>
            )}
          </button>

          {/* Status Dropdown */}
          {showStatusDropdown && !isUpdating && (
            <div className="absolute top-full right-0 mt-2 w-56 bg-surface border border-outline rounded-lg shadow-xl z-50">
              <div className="p-2">
                <div className="text-xs font-medium text-on-surface-variant uppercase tracking-wider px-2 py-1 mb-1">
                  Change Status
                </div>
                {QUEUE_STATUSES.map((statusOption) => (
                  <button
                    key={statusOption}
                    onClick={() => handleStatusUpdate(statusOption)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left hover:bg-surface-variant transition-colors ${
                      status === statusOption ? 'bg-primary/10 text-primary' : 'text-on-surface'
                    }`}
                  >
                    {(() => {
                      const IconComponent = getStatusIcon(statusOption);
                      return (
                        <IconComponent 
                          size={16} 
                          className={status === statusOption ? 'text-primary' : queueApiService.getStatusColor(statusOption)}
                        />
                      );
                    })()}
                    <span className="label-medium">{queueApiService.getStatusLabel(statusOption)}</span>
                    {status === statusOption && (
                      <Check size={14} className="ml-auto text-primary" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Click outside to close dropdown */}
        {showStatusDropdown && (
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowStatusDropdown(false)}
          />
        )}
      </div>
    </div>
  )
}