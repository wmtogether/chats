import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Badge } from '../ui/badge';
import { Loader2, ListTodo, Clock, CheckCircle, XCircle, AlertCircle, User } from 'lucide-react';
import { cn } from '../../Library/utils';
import { queueApiService } from '../../Library/Shared/queueApi';

interface QueuePreviewCardProps {
  queueId: string;
}

interface QueueData {
  id: number;
  jobName: string;
  requestType: string;
  status: string;
  priority: string;
  notes: string | null;
  createdByName: string | null;
  createdAt: string;
  assignedToName: string | null;
  customerId: string | null;
  customerName: string | null;
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
    icon: CheckCircle, 
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30'
  },
  WAIT_DIMENSION: { 
    label: 'รอวัดขนาด', 
    icon: Clock, 
    color: 'text-orange-700 dark:text-orange-300',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30'
  },
  WAIT_FEEDBACK: { 
    label: 'รอ Feedback', 
    icon: AlertCircle, 
    color: 'text-purple-700 dark:text-purple-300',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30'
  },
  WAIT_QA: { 
    label: 'รอตรวจสอบ', 
    icon: AlertCircle, 
    color: 'text-indigo-700 dark:text-indigo-300',
    bgColor: 'bg-indigo-100 dark:bg-indigo-900/30'
  },
  HOLD: { 
    label: 'พักงาน', 
    icon: AlertCircle, 
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

export function QueuePreviewCard({ queueId }: QueuePreviewCardProps) {
  const [queue, setQueue] = useState<QueueData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchQueue = async () => {
    try {
      const queueData = await queueApiService.getQueue(parseInt(queueId));
      setQueue(queueData);
      setError(false);
    } catch (err) {
      console.error('Failed to load queue:', err);
      setError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, [queueId]);

  if (isLoading) {
    return (
      <Card className="my-3 max-w-md shadow-sm">
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="body-small text-on-surface-variant">กำลังโหลด...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !queue) {
    return (
      <Card className="my-3 max-w-md border-error/50 bg-error-container/10 shadow-sm">
        <CardContent className="flex items-center gap-3 py-4 px-4">
          <XCircle className="h-5 w-5 text-error flex-shrink-0" />
          <span className="body-small text-on-error-container">ไม่สามารถโหลดข้อมูลคำขอได้</span>
        </CardContent>
      </Card>
    );
  }

  const statusConfig = STATUS_CONFIG[queue.status] || STATUS_CONFIG.PENDING;
  const StatusIcon = statusConfig.icon;

  return (
    <Card className="my-3 max-w-md hover:shadow-lg transition-all duration-200 cursor-pointer hover:scale-[1.02] bg-surface border-outline shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <ListTodo className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="title-medium font-medium text-on-surface">{queue.jobName}</h4>
              <p className="body-small text-on-surface-variant mt-1">คำขอ #{queue.id}</p>
            </div>
          </div>
          {queue.priority === 'urgent' && (
            <Badge variant="destructive" className="label-small">
              ด่วน
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="label-small">
            {queueApiService.getRequestTypeLabel(queue.requestType)}
          </Badge>
          <Badge className={cn('label-small flex items-center gap-1', statusConfig.color, statusConfig.bgColor)}>
            <StatusIcon className="h-3 w-3" />
            {statusConfig.label}
          </Badge>
        </div>

        {queue.customerName && (
          <div className="flex items-center gap-2 body-small text-on-surface-variant">
            <User className="h-4 w-4" />
            <span className="font-medium">ลูกค้า:</span>
            <span>{queue.customerName}</span>
          </div>
        )}

        {queue.notes && (
          <div className="p-3 rounded-lg bg-surface-variant/30 border border-outline/30">
            <p className="body-small text-on-surface-variant line-clamp-2">
              💬 {queue.notes}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between body-small text-on-surface-variant pt-2 border-t border-outline/30">
          <span>สร้างโดย: {queue.createdByName || 'ไม่ระบุ'}</span>
          {queue.assignedToName && (
            <span>มอบหมาย: {queue.assignedToName}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}