import { useState, useEffect, useRef } from 'react'
import {
  MessageCircle, User, Briefcase, ChevronDown, ChevronUp,
  Check, Clock, TrendingUp, Ruler, MessageSquare, CheckCircle,
  Pause, XCircle, HelpCircle, ChevronLeft, ChevronRight
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { getChat, updateChatStatus, sendMessage } from '../Library/utils/api'
import { useToast } from '../Library/hooks/useToast'
import { cn } from '../Library/utils'

type Chat = any;

// Status configuration with colors and labels
const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'รอดำเนินการ', icon: Clock, color: 'text-yellow-700 dark:text-yellow-300', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30', description: 'งานใหม่ รอแอดมินรับเรื่อง' },
  { value: 'ACCEPTED', label: 'รับงานแล้ว', icon: TrendingUp, color: 'text-blue-700 dark:text-blue-300', bgColor: 'bg-blue-100 dark:bg-blue-900/30', description: 'แอดมินรับงานแล้ว กำลังดำเนินการ' },
  { value: 'WAIT_DIMENSION', label: 'รอวัดขนาด', icon: Ruler, color: 'text-orange-700 dark:text-orange-300', bgColor: 'bg-orange-100 dark:bg-orange-900/30', description: 'รอลูกค้าหรือช่างวัดขนาดหน้างาน' },
  { value: 'WAIT_FEEDBACK', label: 'รอ Feedback', icon: MessageSquare, color: 'text-purple-700 dark:text-purple-300', bgColor: 'bg-purple-100 dark:bg-purple-900/30', description: 'รอการตอบกลับหรือตัดสินใจจากลูกค้า' },
  { value: 'WAIT_QA', label: 'รอตรวจสอบ', icon: CheckCircle, color: 'text-indigo-700 dark:text-indigo-300', bgColor: 'bg-indigo-100 dark:bg-indigo-900/30', description: 'งานเสร็จแล้ว รอตรวจสอบความเรียบร้อย' },
  { value: 'HOLD', label: 'พักงาน', icon: Pause, color: 'text-gray-700 dark:text-gray-300', bgColor: 'bg-gray-100 dark:bg-gray-800/30', description: 'ระงับการดำเนินการชั่วคราว' },
  { value: 'COMPLETED', label: 'เสร็จสิ้น', icon: CheckCircle, color: 'text-green-700 dark:text-green-300', bgColor: 'bg-green-100 dark:bg-green-900/30', description: 'ปิดงานเรียบร้อยแล้ว' },
  { value: 'CANCEL', label: 'ยกเลิก', icon: XCircle, color: 'text-red-700 dark:text-red-300', bgColor: 'bg-red-100 dark:bg-red-900/30', description: 'ยกเลิกงานนี้แล้ว' },
];

const getStatusConfig = (status: string) => {
  return STATUS_OPTIONS.find(option => option.value === status) || {
    value: status,
    label: status,
    icon: HelpCircle,
    color: 'text-gray-700 dark:text-gray-300',
    bgColor: 'bg-gray-100 dark:bg-gray-800/30',
    description: 'Unknown status'
  };
};

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

  const displayId = isQueueChat ? `Queue #${queueData?.id || queueData.metadata?.queueId}` : queueData.channelName;
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
                {currentStatusConfig.label}
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