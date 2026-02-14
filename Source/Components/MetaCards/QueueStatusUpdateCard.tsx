import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { ArrowRight, User } from 'lucide-react';
import { cn } from '../../Library/utils';
import { getStatusConfig } from '../../Library/constants/status';

interface QueueStatusUpdateCardProps {
  queueId: number;
  queueName: string;
  oldStatus: string;
  newStatus: string;
  timestamp: string;
  userName: string;
  customerName?: string | null;
}

export function QueueStatusUpdateCard({ 
  queueId, 
  queueName, 
  oldStatus, 
  newStatus, 
  timestamp, 
  userName, 
  customerName 
}: QueueStatusUpdateCardProps) {
  const oldStatusConfig = getStatusConfig(oldStatus);
  const newStatusConfig = getStatusConfig(newStatus);
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
                  {oldStatusConfig.labelTh}
                </Badge>
                <ArrowRight className="h-3 w-3 text-on-surface-variant" />
                <Badge className={cn('label-small', newStatusConfig.color, newStatusConfig.bgColor)}>
                  {newStatusConfig.labelTh}
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