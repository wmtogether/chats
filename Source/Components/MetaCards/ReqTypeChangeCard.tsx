import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { ArrowRight, RefreshCw, User, Palette, Ruler, CheckCircle, Settings, Eye, Package, Briefcase } from 'lucide-react';
import { cn } from '../../Library/utils';

interface ReqTypeChangeCardProps {
  queueId: string;
  jobName: string;
  oldType: string;
  newType: string;
  customerName?: string | null;
}

// Request type configuration with Thai labels and icons
const REQUEST_TYPE_CONFIG: Record<string, { label: string; icon: any; color: string; bgColor: string }> = {
  design: { 
    label: 'งานออกแบบใหม่', 
    icon: Palette, 
    color: 'text-purple-700 dark:text-purple-300',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30'
  },
  dimension: { 
    label: 'เช็คระยะ/ขนาด', 
    icon: Ruler, 
    color: 'text-orange-700 dark:text-orange-300',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30'
  },
  adjustdesign: { 
    label: 'แก้ไขแบบ', 
    icon: Settings, 
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30'
  },
  checkfile: { 
    label: 'เช็คไฟล์', 
    icon: CheckCircle, 
    color: 'text-green-700 dark:text-green-300',
    bgColor: 'bg-green-100 dark:bg-green-900/30'
  },
  proof: { 
    label: 'ขอ Proof', 
    icon: Eye, 
    color: 'text-indigo-700 dark:text-indigo-300',
    bgColor: 'bg-indigo-100 dark:bg-indigo-900/30'
  },
  'sample-i': { 
    label: 'ตัวอย่าง (Inkjet)', 
    icon: Package, 
    color: 'text-teal-700 dark:text-teal-300',
    bgColor: 'bg-teal-100 dark:bg-teal-900/30'
  },
  'sample-t': { 
    label: 'ตัวอย่าง (Toner)', 
    icon: Package, 
    color: 'text-cyan-700 dark:text-cyan-300',
    bgColor: 'bg-cyan-100 dark:bg-cyan-900/30'
  },
  general: { 
    label: 'เรื่องทั่วไป', 
    icon: Briefcase, 
    color: 'text-gray-700 dark:text-gray-300',
    bgColor: 'bg-gray-100 dark:bg-gray-800/30'
  },
  consultation: { 
    label: 'ขอคำปรึกษา', 
    icon: Settings, 
    color: 'text-pink-700 dark:text-pink-300',
    bgColor: 'bg-pink-100 dark:bg-pink-900/30'
  },
};
// import { queueApiService } from '../../Library/Shared/queueApi';

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
  const oldTypeConfig = REQUEST_TYPE_CONFIG[oldType] || REQUEST_TYPE_CONFIG.general;
  const newTypeConfig = REQUEST_TYPE_CONFIG[newType] || REQUEST_TYPE_CONFIG.general;
  const OldIcon = oldTypeConfig.icon;
  const NewIcon = newTypeConfig.icon;

  return (
    <Card className="my-3 max-w-md bg-gradient-to-r from-purple-50/80 to-indigo-50/80 dark:from-purple-950/20 dark:to-indigo-950/20 border-purple-200/60 dark:border-purple-800/40 shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Type Change Indicator */}
          <div className="flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className={cn('p-2 rounded-full shadow-sm', oldTypeConfig.bgColor)}>
                <OldIcon className={cn('h-4 w-4', oldTypeConfig.color)} />
              </div>
              <ArrowRight className="h-4 w-4 text-on-surface-variant" />
              <div className={cn('p-2 rounded-full shadow-sm', newTypeConfig.bgColor)}>
                <NewIcon className={cn('h-4 w-4', newTypeConfig.color)} />
              </div>
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
              <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-variant/30 border border-outline/30">
                <Badge className={cn('label-small', oldTypeConfig.color, oldTypeConfig.bgColor)}>
                  {oldTypeConfig.label}
                </Badge>
                <ArrowRight className="h-3 w-3 text-on-surface-variant" />
                <Badge className={cn('label-small', newTypeConfig.color, newTypeConfig.bgColor)}>
                  {newTypeConfig.label}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}