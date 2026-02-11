import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Badge } from '../ui/badge';
import { Loader2, ListTodo, Clock, CheckCircle, XCircle, AlertCircle, User } from 'lucide-react';
import { cn } from '../../Library/utils';

interface QueuePreviewCardProps {
  queueId: string;
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
    label: 'รอขึ้น Dimention', 
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
    label: 'รอ QA', 
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
  const [queue, setQueue] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    
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
              <h4 className="title-medium font-medium text-on-surface">Job Name</h4>
              <p className="body-small text-on-surface-variant mt-1">คำขอ #{queueId}</p>
            </div>
          </div>
          
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="label-small">
            Request Type
          </Badge>
          <Badge className={cn('label-small flex items-center gap-1')}>
            Status
          </Badge>
        </div>

        
        <div className="flex items-center justify-between body-small text-on-surface-variant pt-2 border-t border-outline/30">
          <span>สร้างโดย: ไม่ระบุ</span>
          
        </div>
      </CardContent>
    </Card>
  );
}