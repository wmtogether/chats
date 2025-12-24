import { Card, CardContent } from '../ui/card';
import { CheckCircle, UserCheck, User } from 'lucide-react';
import { getProfileImageUrl, getProfileInitial } from '../../Library/Shared/profileUtils';

interface QueueAcceptedCardProps {
  queueId: string;
  jobName: string;
  userName: string;
  userProfilePicture?: string | null;
  customerName?: string | null;
}

export function QueueAcceptedCard({ 
  queueId, 
  jobName, 
  userName, 
  userProfilePicture, 
  customerName 
}: QueueAcceptedCardProps) {
  return (
    <Card className="my-3 max-w-md bg-gradient-to-r from-green-50/80 to-emerald-50/80 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200/60 dark:border-green-800/40 shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Icon Section */}
          <div className="flex-shrink-0">
            <div className="relative">
              <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/40 shadow-sm">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-surface border-2 border-green-200 dark:border-green-800 shadow-sm">
                <UserCheck className="h-3 w-3 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>

          {/* Content Section */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <span className="label-large font-medium text-green-700 dark:text-green-300">
                รับงานแล้ว
              </span>
              <div className="flex-1 h-px bg-green-200 dark:bg-green-800/60"></div>
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

              {/* User Info */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-100/40 dark:bg-green-900/20 border border-green-200/60 dark:border-green-800/40">
                <div className="h-8 w-8 rounded-full bg-green-200 dark:bg-green-800 border-2 border-green-300 dark:border-green-700 flex items-center justify-center overflow-hidden">
                  {userProfilePicture ? (
                    <img 
                      src={getProfileImageUrl(userProfilePicture)} 
                      alt={userName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="label-small font-medium text-green-700 dark:text-green-300">
                      {getProfileInitial(userName)}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="body-small text-green-700 dark:text-green-300">
                    รับงานโดย
                  </p>
                  <p className="label-medium font-medium text-green-800 dark:text-green-200 truncate">
                    {userName}
                  </p>
                </div>
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}