import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { ArrowRight, Clock, TrendingUp, Ruler, MessageSquare, CheckCircle, Pause, XCircle, User } from 'lucide-react';
import { cn } from '../../Library/utils';

interface QueueStatusUpdateCardProps {
  queueId: number;
  queueName: string;
  oldStatus: string;
  newStatus: string;
  timestamp: string;
  userName: string;
  customerName?: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string; bgColor: string }> = {
  PENDING: { 
    label: 'รอดำเนินการ', 
    icon: Clock, 
    color: 'text-yellow-700 dark:text-yellow-300',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30'
  },
  ACCEPTED: { 
    label: 'รับงานแล้ว', 
    icon: TrendingUp, 
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30'
  },
  WAIT_DIMENSION: { 
    label: 'รอวัดขนาด', 
    icon: Ruler, 
    color: 'text-orange-700 dark:text-orange-300',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30'
  },
  WAIT_FEEDBACK: { 
    label: 'รอ Feedback', 
    icon: MessageSquare, 
    color: 'text-purple-700 dark:text-purple-300',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30'
  },
  WAIT_QA: { 
    label: 'รอตรวจสอบ', 
    icon: CheckCircle, 
    color: 'text-indigo-700 dark:text-indigo-300',
    bgColor: 'bg-indigo-100 dark:bg-indigo-900/30'
  },
  HOLD: { 
    label: 'พักงาน', 
    icon: Pause, 
    color: 'text-gray-700 dark:text-gray-300',
    bgColor: 'bg-gray-100 dark:bg-gray-800/30'
  },
  COMPLETED: { 
    label: 'เสร็จสิ้น', 
    icon: CheckCircle, 
    color: 'text-green-700 dark:text-green-300',
    bgColor: 'bg-green-100 dark:bg-green-900/30'
  },
  CANCEL: { 
    label: 'ยกเลิก', 
    icon: XCircle, 
    color: 'text-red-700 dark:text-red-300',
    bgColor: 'bg-red-100 dark:bg-red-900/30'
  },
};

export function QueueStatusUpdateCard({ 
  queueId, 
  queueName, 
  oldStatus, 
  newStatus, 
  timestamp, 
  userName, 
  customerName 
}: QueueStatusUpdateCardProps) {
  const oldStatusConfig = STATUS_CONFIG[oldStatus] || STATUS_CONFIG.PENDING;
  const newStatusConfig = STATUS_CONFIG[newStatus] || STATUS_CONFIG.PENDING;
  const OldIcon = oldStatusConfig.icon;
  const NewIcon = newStatusConfig.icon;

  const formatTime = (timestamp: string): string => {
    if (!timestamp || typeof timestamp !== 'string') {
      return '--:--';
    }

    try {
      // Handle the format "2025-12-05 14:57:24.797 +0700"
      const parts = timestamp.trim().split(' ');
      
      if (parts.length >= 3) {
        const datePart = parts[0]; // "2025-12-05"
        const timePart = parts[1]; // "14:57:24.797"
        let tzOffsetPart = parts[2]; // "+0700"

        // Convert timezone offset from "+0700" to "+07:00" format
        if (tzOffsetPart.length === 5 && !tzOffsetPart.includes(':')) {
          tzOffsetPart = tzOffsetPart.substring(0, 3) + ':' + tzOffsetPart.substring(3, 5);
        }
        
        // Create ISO 8601 format: "2025-12-05T14:57:24.797+07:00"
        const isoTimestamp = `${datePart}T${timePart}${tzOffsetPart}`;
        const date = new Date(isoTimestamp);
        
        // Validate the parsed date
        if (!isNaN(date.getTime())) {
          return date.toLocaleTimeString('th-TH', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });
        }
      }
      
      // Fallback: try parsing the timestamp as-is
      const fallbackDate = new Date(timestamp);
      if (!isNaN(fallbackDate.getTime())) {
        return fallbackDate.toLocaleTimeString('th-TH', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
      }
      
      return '--:--';
    } catch (error) {
      console.warn('Error formatting timestamp:', timestamp, error);
      return '--:--';
    }
  };

  return (
    <Card className="my-3 max-w-md bg-gradient-to-r from-blue-50/80 to-indigo-50/80 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200/60 dark:border-blue-800/40 shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Status Change Indicator */}
          <div className="flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className={cn('p-2 rounded-full shadow-sm', oldStatusConfig.bgColor)}>
                <OldIcon className={cn('h-4 w-4', oldStatusConfig.color)} />
              </div>
              <ArrowRight className="h-4 w-4 text-on-surface-variant" />
              <div className={cn('p-2 rounded-full shadow-sm', newStatusConfig.bgColor)}>
                <NewIcon className={cn('h-4 w-4', newStatusConfig.color)} />
              </div>
            </div>
          </div>

          {/* Content Section */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <span className="label-large font-medium text-blue-700 dark:text-blue-300">
                อัปเดตสถานะ
              </span>
              <div className="flex-1 h-px bg-blue-200 dark:bg-blue-800/60"></div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-2 body-small text-on-surface-variant">
                <span>คำขอ #{queueId}:</span>
                <span className="font-medium text-on-surface truncate">{queueName}</span>
              </div>

              {customerName && (
                <div className="flex items-center gap-2 body-small text-on-surface-variant">
                  <User className="h-4 w-4" />
                  <span>ลูกค้า:</span>
                  <span className="font-medium text-on-surface truncate">{customerName}</span>
                </div>
              )}

              {/* Status Change */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-variant/30 border border-outline/30">
                <Badge className={cn('label-small', oldStatusConfig.color, oldStatusConfig.bgColor)}>
                  {oldStatusConfig.label}
                </Badge>
                <ArrowRight className="h-3 w-3 text-on-surface-variant" />
                <Badge className={cn('label-small', newStatusConfig.color, newStatusConfig.bgColor)}>
                  {newStatusConfig.label}
                </Badge>
              </div>

              {/* User and Time */}
              <div className="flex items-center justify-between body-small text-on-surface-variant">
                <span>โดย {userName}</span>
                <span>{formatTime(timestamp)}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}