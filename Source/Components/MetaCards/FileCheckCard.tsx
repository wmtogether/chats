import { Card, CardContent } from '../ui/card';
import { FileCheck, CheckCircle, AlertTriangle } from 'lucide-react';

interface FileCheckCardProps {
  queueId: string;
  jobName: string;
}

export function FileCheckCard({ queueId, jobName }: FileCheckCardProps) {
  return (
    <Card className="my-3 max-w-md bg-gradient-to-r from-orange-50/80 to-amber-50/80 dark:from-orange-950/20 dark:to-amber-950/20 border-orange-200/60 dark:border-orange-800/40 shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Icon Section */}
          <div className="flex-shrink-0">
            <div className="relative">
              <div className="p-3 rounded-full bg-orange-100 dark:bg-orange-900/40 shadow-sm">
                <FileCheck className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-surface border-2 border-orange-200 dark:border-orange-800 shadow-sm">
                <AlertTriangle className="h-3 w-3 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </div>

          {/* Content Section */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <span className="label-large font-medium text-orange-700 dark:text-orange-300">
                คำขอตรวจสอบไฟล์
              </span>
              <div className="flex-1 h-px bg-orange-200 dark:bg-orange-800/60"></div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-2 body-small text-on-surface-variant">
                <span>คำขอ #{queueId}:</span>
                <span className="font-medium text-on-surface truncate">{jobName}</span>
              </div>

              {/* Action Required */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-orange-100/40 dark:bg-orange-900/20 border border-orange-200/60 dark:border-orange-800/40">
                <CheckCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="body-small text-orange-700 dark:text-orange-300">
                    ต้องการตรวจสอบไฟล์
                  </p>
                  <p className="label-small text-orange-600 dark:text-orange-400">
                    กรุณาตรวจสอบไฟล์และให้ความเห็น
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}