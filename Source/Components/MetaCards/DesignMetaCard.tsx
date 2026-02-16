import { Card, CardContent } from '../ui/card';
import { Palette, User, ExternalLink } from 'lucide-react';

interface DesignMetaCardProps {
  designId: string;
  jobName: string;
  customerName?: string | null;
}

export function DesignMetaCard({ designId, jobName, customerName }: DesignMetaCardProps) {
  return (
    <Card className="my-3 max-w-md bg-gradient-to-r from-purple-50/80 to-pink-50/80 dark:from-purple-950/20 dark:to-pink-950/20 border-purple-200/60 dark:border-purple-800/40 shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Icon Section */}
          <div className="flex-shrink-0">
            <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/40 shadow-sm">
              <Palette className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>

          {/* Content Section */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <span className="label-large font-medium text-purple-700 dark:text-purple-300">
                🎨 New Design Created
              </span>
              <div className="flex-1 h-px bg-purple-200 dark:bg-purple-800/60"></div>
            </div>
            
            <div className="space-y-3">
              {/* Design ID */}
              <div className="flex items-center gap-2 body-small">
                <span className="text-on-surface-variant">Design ID:</span>
                <span className="font-mono font-medium text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/40 px-2 py-0.5 rounded">
                  {designId}
                </span>
              </div>

              {/* Job Name */}
              <div className="flex items-center gap-2 body-small text-on-surface-variant">
                <span>Job:</span>
                <span className="font-medium text-on-surface truncate">{jobName}</span>
              </div>

              {/* Customer Name */}
              {customerName && (
                <div className="flex items-center gap-2 body-small text-on-surface-variant">
                  <User className="h-4 w-4" />
                  <span>Customer:</span>
                  <span className="font-medium text-on-surface truncate">{customerName}</span>
                </div>
              )}

              {/* Action Button */}
              <div className="pt-2">
                <button
                  onClick={() => {
                    // TODO: Navigate to design detail page
                    console.log('View design:', designId);
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/60 transition-colors text-sm font-medium"
                >
                  <ExternalLink className="h-4 w-4" />
                  View Design
                </button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
