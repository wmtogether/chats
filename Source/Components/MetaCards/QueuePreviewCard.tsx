import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Badge } from '../ui/badge';
import { Loader2, ListTodo, XCircle } from 'lucide-react';
import { cn } from '../../Library/utils';
import { getStatusConfig } from '../../Library/constants/status';

interface QueuePreviewCardProps {
  queueId: string;
}

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

  const statusConfig = getStatusConfig(queue.status);
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