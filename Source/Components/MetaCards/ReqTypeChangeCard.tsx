import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { ArrowRight, RefreshCw, User } from 'lucide-react';
import { cn } from '../../Library/utils';
import { queueApiService } from '../../Library/Shared/queueApi';

interface ReqTypeChangeCardProps {
  queueId: string;
  jobName: string;
  oldType: string;
  newType: string;
  customerName?: string | null;
}

export function ReqTypeChangeCard({ 
  queueId, 
  jobName, 
  oldType, 
  newType, 
  customerName 
}: ReqTypeChangeCardProps) {
  return (
    <Card className="my-3 max-w-md bg-gradient-to-r from-purple-50/80 to-indigo-50/80 dark:from-purple-950/20 dark:to-indigo-950/20 border-purple-200/60 dark:border-purple-800/40 shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Icon Section */}
          <div className="flex-shrink-0">
            <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/40 shadow-sm">
              <RefreshCw className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>

          {/* Content Section */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <span className="label-large font-medium text-purple-700 dark:text-purple-300">
                เปลี่ยนประเภทคำขอ
              </span>
              <div className="flex-1 h-px bg-purple-200 dark:bg-purple-800/60"></div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-2 body-small text-on-surface-variant">
                <span>คำขอ #{queueId}:</span>
                <span className="font-medium text-on-surface truncate">{jobName}</span>
              </div>

              {customerName && (
                <div className="flex items-center gap-2 body-small text-on-surface-variant">
                  <User className="h-4 w-4" />
                  <span>ลูกค้า:</span>
                  <span className="font-medium text-on-surface truncate">{customerName}</span>
                </div>
              )}

              {/* Type Change */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-purple-100/40 dark:bg-purple-900/20 border border-purple-200/60 dark:border-purple-800/40">
                <Badge variant="outline" className="label-small">
                  {queueApiService.getRequestTypeLabel(oldType)}
                </Badge>
                <ArrowRight className="h-3 w-3 text-on-surface-variant" />
                <Badge variant="outline" className="label-small">
                  {queueApiService.getRequestTypeLabel(newType)}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}