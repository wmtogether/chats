import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { FileText, Clock, CheckCircle, XCircle, AlertCircle, Package, User, Building2 } from 'lucide-react';
import { cn } from '../../Library/utils';

interface ProofMetaCardProps {
  proofId: number;
  runnerId: string;
  jobName: string;
  customerName?: string;
  salesName?: string;
  proofStatus: string;
  createdByName: string;
  createdAt: string;
}

const PROOF_STATUS_CONFIG: Record<string, { label: string; icon: any; color: string; bgColor: string; gradientFrom: string; gradientTo: string }> = {
  PENDING_PROOF: { 
    label: 'ขอ Proof / รอทำ', 
    icon: Clock, 
    color: 'text-yellow-700 dark:text-yellow-300',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    gradientFrom: 'from-yellow-50/80',
    gradientTo: 'to-amber-50/80'
  },
  GRAPHICS_SENT: { 
    label: 'รอ QA', 
    icon: Package, 
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    gradientFrom: 'from-blue-50/80',
    gradientTo: 'to-cyan-50/80'
  },
  SALES_SENT: { 
    label: 'ส่งเซลล์', 
    icon: Package, 
    color: 'text-indigo-700 dark:text-indigo-300',
    bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
    gradientFrom: 'from-indigo-50/80',
    gradientTo: 'to-purple-50/80'
  },
  PROOF_CONFIRMED: { 
    label: 'ยืนยัน Proof', 
    icon: CheckCircle, 
    color: 'text-green-700 dark:text-green-300',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    gradientFrom: 'from-green-50/80',
    gradientTo: 'to-emerald-50/80'
  },
  PRINTING_COMPLETED: { 
    label: 'พิมพ์แล้ว', 
    icon: CheckCircle, 
    color: 'text-teal-700 dark:text-teal-300',
    bgColor: 'bg-teal-100 dark:bg-teal-900/30',
    gradientFrom: 'from-teal-50/80',
    gradientTo: 'to-cyan-50/80'
  },
  COMPLETED: { 
    label: 'เสร็จสิ้น', 
    icon: CheckCircle, 
    color: 'text-green-700 dark:text-green-300',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    gradientFrom: 'from-green-50/80',
    gradientTo: 'to-emerald-50/80'
  },
  CANCELLED: { 
    label: 'ยกเลิก', 
    icon: XCircle, 
    color: 'text-red-700 dark:text-red-300',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    gradientFrom: 'from-red-50/80',
    gradientTo: 'to-rose-50/80'
  },
  HOLD: { 
    label: 'พักงาน', 
    icon: AlertCircle, 
    color: 'text-gray-700 dark:text-gray-300',
    bgColor: 'bg-gray-100 dark:bg-gray-800/30',
    gradientFrom: 'from-gray-50/80',
    gradientTo: 'to-slate-50/80'
  },
  USE_OLD_PROOF: { 
    label: 'ใช้ Proof เดิม', 
    icon: FileText, 
    color: 'text-purple-700 dark:text-purple-300',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    gradientFrom: 'from-purple-50/80',
    gradientTo: 'to-fuchsia-50/80'
  },
};

export function ProofMetaCard({
  proofId,
  runnerId,
  jobName,
  customerName,
  salesName,
  proofStatus,
  createdByName,
  createdAt,
}: ProofMetaCardProps) {
  const statusConfig = PROOF_STATUS_CONFIG[proofStatus] || PROOF_STATUS_CONFIG.PENDING_PROOF;
  const StatusIcon = statusConfig.icon;

  // Format date
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  return (
    <Card className={cn(
      'my-3 max-w-md shadow-md',
      'bg-gradient-to-r',
      statusConfig.gradientFrom,
      statusConfig.gradientTo,
      'dark:from-purple-950/20 dark:to-indigo-950/20',
      'border-purple-200/60 dark:border-purple-800/40'
    )}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Icon Section */}
          <div className="flex-shrink-0">
            <div className="relative">
              <div className={cn('p-3 rounded-full shadow-sm', statusConfig.bgColor)}>
                <FileText className={cn('h-6 w-6', statusConfig.color)} />
              </div>
              <div className={cn(
                'absolute -bottom-1 -right-1 p-1 rounded-full bg-surface shadow-sm',
                'border-2',
                statusConfig.bgColor.includes('yellow') ? 'border-yellow-200 dark:border-yellow-800' :
                statusConfig.bgColor.includes('blue') ? 'border-blue-200 dark:border-blue-800' :
                statusConfig.bgColor.includes('indigo') ? 'border-indigo-200 dark:border-indigo-800' :
                statusConfig.bgColor.includes('green') ? 'border-green-200 dark:border-green-800' :
                statusConfig.bgColor.includes('teal') ? 'border-teal-200 dark:border-teal-800' :
                statusConfig.bgColor.includes('red') ? 'border-red-200 dark:border-red-800' :
                statusConfig.bgColor.includes('gray') ? 'border-gray-200 dark:border-gray-800' :
                'border-purple-200 dark:border-purple-800'
              )}>
                <StatusIcon className={cn('h-3 w-3', statusConfig.color)} />
              </div>
            </div>
          </div>

          {/* Content Section */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <span className={cn('label-large font-medium', statusConfig.color)}>
                ข้อมูลปรู๊ฟ
              </span>
              <div className={cn(
                'flex-1 h-px',
                statusConfig.bgColor.includes('yellow') ? 'bg-yellow-200 dark:bg-yellow-800/60' :
                statusConfig.bgColor.includes('blue') ? 'bg-blue-200 dark:bg-blue-800/60' :
                statusConfig.bgColor.includes('indigo') ? 'bg-indigo-200 dark:bg-indigo-800/60' :
                statusConfig.bgColor.includes('green') ? 'bg-green-200 dark:bg-green-800/60' :
                statusConfig.bgColor.includes('teal') ? 'bg-teal-200 dark:bg-teal-800/60' :
                statusConfig.bgColor.includes('red') ? 'bg-red-200 dark:bg-red-800/60' :
                statusConfig.bgColor.includes('gray') ? 'bg-gray-200 dark:bg-gray-800/60' :
                'bg-purple-200 dark:bg-purple-800/60'
              )}></div>
            </div>
            
            <div className="space-y-3">
              {/* Job Name and Runner ID */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 body-small text-on-surface-variant">
                  <span className="font-medium text-on-surface truncate">{jobName}</span>
                </div>
                <div className="flex items-center gap-2 body-small text-on-surface-variant">
                  <span>Runner:</span>
                  <code className="font-mono text-xs bg-surface-variant/50 px-2 py-0.5 rounded">{runnerId}</code>
                  <span>• ID: #{proofId}</span>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <Badge className={cn('label-small flex items-center gap-1.5', statusConfig.color, statusConfig.bgColor)}>
                  <StatusIcon className="h-3.5 w-3.5" />
                  {statusConfig.label}
                </Badge>
              </div>

              {/* Customer and Sales Info */}
              {(customerName || salesName) && (
                <div className="space-y-2 p-3 rounded-lg bg-surface-variant/30 border border-outline/30">
                  {customerName && (
                    <div className="flex items-center gap-2 body-small text-on-surface-variant">
                      <Building2 className="h-4 w-4" />
                      <span>ลูกค้า:</span>
                      <span className="font-medium text-on-surface truncate">{customerName}</span>
                    </div>
                  )}
                  {salesName && (
                    <div className="flex items-center gap-2 body-small text-on-surface-variant">
                      <User className="h-4 w-4" />
                      <span>เซลส์:</span>
                      <span className="font-medium text-on-surface truncate">{salesName}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between body-small text-on-surface-variant pt-2 border-t border-outline/30">
                <span>สร้างโดย: {createdByName}</span>
                <span className="text-xs">{formatDate(createdAt)}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
