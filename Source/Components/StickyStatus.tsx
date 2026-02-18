import { useState, useEffect, useRef } from 'react'
import {
  MessageCircle, User, Briefcase, ChevronDown, ChevronUp,
  Check, HelpCircle, ChevronLeft, ChevronRight
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { getChat, updateChatStatus, sendMessage } from '../Library/utils/api'
import { useToast } from '../Library/hooks/useToast'
import { cn } from '../Library/utils'
import { getWebSocketManager } from '../Library/utils/websocket'
import { STATUS_CONFIG, getStatusConfig } from '../Library/constants/status'

type Chat = any;

// Convert STATUS_CONFIG to STATUS_OPTIONS format for the dropdown
const STATUS_OPTIONS = Object.entries(STATUS_CONFIG).map(([value, config]) => ({
  value,
  label: config.labelTh,
  icon: config.icon,
  color: config.color,
  bgColor: config.bgColor,
  description: config.label // Use English label as description
}));

interface StickyStatusProps {
  selectedChat: Chat | null;
  onStatusUpdate?: (newStatus: string) => void;
  onNextChat?: () => void;
  onPrevChat?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

export default function StickyStatus({
  selectedChat,
  onStatusUpdate,
  onNextChat,
  onPrevChat,
  hasPrev = false,
  hasNext = false
}: StickyStatusProps) {
  const [queueData, setQueueData] = useState<any | null>(selectedChat);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { addToast } = useToast();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    
    if (diffInHours < 1) return 'Just now'
    if (diffInHours < 24) return `${Math.floor(diffInHours)}h ago`
    return `${Math.floor(diffInHours / 24)}d ago`
  }

  // Load full queue data when chat selection changes
  useEffect(() => {
    // Immediately use the passed-in chat data
    setQueueData(selectedChat);

    // Then, fetch the full, potentially more up-to-date data
    if (selectedChat?.uuid) {
      const fetchChatData = async () => {
        try {
          const result = await getChat(selectedChat.uuid);
          if (result.success && result.data) {
            setQueueData(result.data);
          }
        } catch (error) {
          console.error("Failed to fetch full chat data:", error);
          // Keep using the initially provided selectedChat data
        }
      };
      fetchChatData();
    }
  }, [selectedChat]);

  // Listen for real-time status updates via WebSocket
  useEffect(() => {
    const wsManager = getWebSocketManager();
    if (!wsManager || !selectedChat?.uuid) return;

    const handleWebSocketMessage = (data: any) => {
      console.log('📊 StickyStatus: WebSocket message received:', data);
      
      // Handle chat_status_updated messages
      if (data.type === 'chat_status_updated' && data.data?.chat) {
        const updatedChat = data.data.chat;
        
        // Only update if this is the currently selected chat
        if (updatedChat.uuid === selectedChat.uuid) {
          console.log('📊 StickyStatus: Received real-time status update for current chat:', updatedChat);
          setQueueData(updatedChat);
          
          // Also notify parent component
          if (onStatusUpdate && updatedChat.status) {
            onStatusUpdate(updatedChat.status);
          }
        }
      }
      
      // Handle queue_assigned messages (when graphic user accepts queue)
      if (data.type === 'queue_assigned' && data.data?.chatUuid === selectedChat.uuid) {
        console.log('📊 StickyStatus: Queue assigned, refreshing chat data');
        // Refresh the chat data to get updated status
        const fetchUpdatedChat = async () => {
          try {
            const result = await getChat(selectedChat.uuid);
            if (result.success && result.data) {
              console.log('📊 StickyStatus: Fetched updated chat data:', result.data);
              setQueueData(result.data);
            }
          } catch (error) {
            console.error('Failed to refresh chat data:', error);
          }
        };
        fetchUpdatedChat();
      }
      
      // Also handle general chat_updated messages
      if (data.type === 'chat_updated' && data.data?.chat) {
        const updatedChat = data.data.chat;
        
        if (updatedChat.uuid === selectedChat.uuid) {
          console.log('📊 StickyStatus: Received real-time chat update for current chat:', updatedChat);
          setQueueData(updatedChat);
        }
      }
    };

    console.log('📊 StickyStatus: Setting up WebSocket listener for chat:', selectedChat.uuid);
    wsManager.on('message', handleWebSocketMessage);

    return () => {
      console.log('📊 StickyStatus: Cleaning up WebSocket listener');
      wsManager.off('message', handleWebSocketMessage);
    };
  }, [selectedChat?.uuid, onStatusUpdate]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowStatusDropdown(false);
      }
    };
    if (showStatusDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
    return undefined; // Explicit return for when showStatusDropdown is false
  }, [showStatusDropdown]);

  const handleStatusUpdate = async (newStatus: string) => {
    if (isUpdating || !selectedChat?.uuid) return;

    const oldStatus = queueData?.status || 'UNKNOWN';
    
    // Don't update if it's the same status
    if (oldStatus === newStatus) {
      setShowStatusDropdown(false);
      return;
    }

    setIsUpdating(true);
    setUpdatingStatus(newStatus);

    try {
      const result = await updateChatStatus(selectedChat.uuid, newStatus);
      if (result.success && result.data) {
        // Update local state with the returned data from the API
        setQueueData(result.data);

        if (onStatusUpdate) onStatusUpdate(newStatus);

        const statusConfig = getStatusConfig(newStatus);
        addToast({ type: 'success', message: `Status updated to "${statusConfig.label}"` });
        setShowStatusDropdown(false);

        // Send a MetaCard message to the chat about the status update
        try {
          const customerName = queueData?.customers?.Valid ? queueData.customers.String : '';
          const queueId = queueData?.parsedMetadata?.queueId || queueData?.id;
          const queueName = queueData?.channelName || 'Queue';
          
          // Create MetaCard message format: [QUEUE_STATUS_UPDATE|queueId|oldStatus|newStatus|customerName]QueueName
          const metaCardContent = `[QUEUE_STATUS_UPDATE|${queueId}|${oldStatus}|${newStatus}|${customerName}]${queueName}`;
          
          console.log('📊 Sending MetaCard message for status update:', {
            chatUuid: selectedChat.uuid,
            content: metaCardContent,
            oldStatus,
            newStatus
          });
          
          const messageResult = await sendMessage(selectedChat.uuid, {
            content: metaCardContent
          });
          
          console.log('📊 MetaCard message send result:', messageResult);
          
        } catch (messageError) {
          console.error('❌ Failed to send MetaCard message:', messageError);
          // Don't show error to user as the main operation succeeded
        }
      } else {
        throw new Error(result.error || 'Failed to update');
      }
    } catch (error) {
      addToast({ type: 'error', message: error instanceof Error ? error.message : 'Failed to update status' });
    } finally {
      setIsUpdating(false);
      setUpdatingStatus(null);
    }
  };

  if (!queueData) return null;

  const isQueueChat = !!queueData.metadata?.queueId;
  const status = queueData?.status || 'UNKNOWN';
  const currentStatusConfig = getStatusConfig(status);
  const StatusIcon = currentStatusConfig.icon;

  const displayId = queueData?.uniqueId || (isQueueChat ? `Queue #${queueData?.id || queueData.metadata?.queueId}` : queueData.channelName);
  const subTitle = isQueueChat
    ? (queueData?.requestType || 'Request')
    : `Created by ${queueData.createdByName}`;

  const dropdownVariants = {
    hidden: { opacity: 0, scale: 0.95, y: -10 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.2, ease: "easeInOut" } },
    exit: { opacity: 0, scale: 0.95, y: -10, transition: { duration: 0.15, ease: "easeIn" } }
  };

  return (
    <div className="sticky top-0 z-1 px-4 pt-4 pb-6 bg-gradient-to-b from-background via-background to-transparent pointer-events-none select-none">
      <div className="pointer-events-auto relative rounded-xl bg-surface border border-outline shadow-lg flex items-center justify-between p-3 group">
        
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn("size-10 rounded-full flex items-center justify-center shrink-0 border", currentStatusConfig.bgColor, currentStatusConfig.color)}>
              <StatusIcon size={20} />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="title-medium text-on-surface truncate">{displayId}</h3>
                {status === 'PENDING' && (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500" />
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 body-small text-on-surface-variant truncate">
                <span>{subTitle}</span>
                <span className="text-on-surface-variant/40">•</span>
                <span>{formatDate(queueData.updatedAt)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="relative pl-4" ref={dropdownRef}>
          <button
            onClick={() => setShowStatusDropdown(!showStatusDropdown)}
            disabled={isUpdating}
            className={cn(
              "flex items-center gap-2 pl-4 pr-3 py-2 rounded-lg transition-colors border",
              showStatusDropdown 
                ? 'bg-surface-variant border-primary/50 ring-2 ring-primary/10' 
                : 'bg-surface hover:bg-surface-variant/50 border-outline'
            )}
          >
            <div className="text-right">
              <div className={cn("label-medium", currentStatusConfig.color)}>
                {currentStatusConfig.labelTh}
              </div>
            </div>
            <div className={cn("p-1 rounded-md", isUpdating ? 'bg-transparent' : currentStatusConfig.bgColor)}>
              {isUpdating ? (
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                   <div className="rounded-full h-4 w-4 border-b-2 border-primary"></div>
                </motion.div>
              ) : (
                <motion.div animate={{ rotate: showStatusDropdown ? 180 : 0 }}>
                  <ChevronDown size={16} className={currentStatusConfig.color} />
                </motion.div>
              )}
            </div>
          </button>
          
          <AnimatePresence>
            {showStatusDropdown && !isUpdating && (
              <motion.div
              //@ts-expect-error
                variants={dropdownVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="absolute top-full right-0 mt-2 w-[320px] h-96 bg-surface border border-outline rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col"
              >
                <div className="p-3 bg-surface-variant/30 border-b border-outline">
                  <h4 className="label-medium text-on-surface">Update Status</h4>
                  <p className="body-small text-on-surface-variant">Select a new status for this conversation</p>
                </div>
                
                <div className="p-2 grid grid-cols-1 gap-1 max-h-[60vh] overflow-y-auto custom-scrollbar">
                  {STATUS_OPTIONS.map((option) => {
                    const OptionIcon = option.icon;
                    const isSelected = option.value === status;
                    const isUpdatingThis = updatingStatus === option.value;
                    
                    return (
                      <button
                        key={option.value}
                        onClick={() => handleStatusUpdate(option.value)}
                        disabled={isSelected || updatingStatus !== null}
                        className={cn(
                          "relative flex items-center gap-4 p-3 rounded-lg text-left transition-all border",
                          isSelected 
                            ? `bg-primary/5 border-primary/30` 
                            : `bg-surface hover:bg-surface-variant border-transparent`,
                          updatingStatus !== null && !isUpdatingThis && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        <div className={cn("size-9 rounded-full flex items-center justify-center shrink-0", option.bgColor, option.color)}>
                          {isUpdatingThis ? (
                             <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                                <div className="rounded-full h-5 w-5 border-b-2 border-current"></div>
                            </motion.div>
                          ) : (
                            <OptionIcon size={18} />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className={cn('font-semibold text-sm', isSelected ? 'text-primary' : 'text-on-surface')}>
                              {option.label}
                            </span>
                            {isSelected && <Check size={16} className="text-primary" />}
                          </div>
                          <p className="text-xs text-on-surface-variant truncate pr-2">
                            {option.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}