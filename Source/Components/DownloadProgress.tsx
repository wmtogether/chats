import React from 'react';
import { Download, CheckCircle, XCircle, Clock } from 'lucide-react';
import type { DownloadProgress as DownloadProgressType } from '../Library/hooks/useDownload';

interface DownloadProgressProps {
  download: DownloadProgressType;
  onClear?: () => void;
  compact?: boolean;
}

const DownloadProgress: React.FC<DownloadProgressProps> = ({ 
  download, 
  onClear, 
  compact = false 
}) => {
  const getStatusIcon = () => {
    switch (download.status) {
      case 'downloading':
        return <Download className="h-4 w-4 text-primary animate-pulse" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-on-surface-variant" />;
    }
  };

  const getStatusText = () => {
    switch (download.status) {
      case 'downloading':
        return `Downloading... ${download.progress}%`;
      case 'completed':
        return 'Download completed';
      case 'error':
        return `Error: ${download.error || 'Unknown error'}`;
      default:
        return 'Preparing download...';
    }
  };

  const getStatusColor = () => {
    switch (download.status) {
      case 'downloading':
        return 'text-primary';
      case 'completed':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-on-surface-variant';
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 p-2 bg-surface-container rounded-lg border border-outline-variant">
        {getStatusIcon()}
        <div className="flex-1 min-w-0">
          <p className="body-small font-medium text-on-surface truncate">
            {download.filename}
          </p>
          <p className={`body-small ${getStatusColor()}`}>
            {getStatusText()}
          </p>
        </div>
        {download.status === 'downloading' && (
          <div className="w-16 bg-surface-variant rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${download.progress}%` }}
            />
          </div>
        )}
        {onClear && download.status !== 'downloading' && (
          <button
            onClick={onClear}
            className="p-1 hover:bg-surface-variant rounded text-on-surface-variant hover:text-on-surface"
          >
            <XCircle className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 bg-surface-container border border-outline-variant rounded-2xl shadow-sm">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-full bg-primary/10 flex-shrink-0">
          {getStatusIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="title-medium font-medium text-on-surface truncate">
            {download.filename}
          </h4>
          <p className={`body-small mt-1 ${getStatusColor()}`}>
            {getStatusText()}
          </p>
          
          {download.status === 'downloading' && (
            <div className="mt-3">
              <div className="flex justify-between items-center mb-2">
                <span className="body-small text-on-surface-variant">
                  Progress
                </span>
                <span className="body-small font-medium text-on-surface">
                  {download.progress}%
                </span>
              </div>
              <div className="w-full bg-surface-variant rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${download.progress}%` }}
                />
              </div>
              {download.downloadSpeed && (
                <div className="flex justify-between items-center mt-2 text-on-surface-variant body-small">
                  <span>Speed: {download.downloadSpeed}</span>
                  {download.eta && <span>ETA: {download.eta}</span>}
                </div>
              )}
            </div>
          )}
          
          {download.status === 'completed' && (
            <div className="mt-2">
              <button
                onClick={async () => {
                  try {
                    if (window.downloadAPI?.showInFolder) {
                      console.log('Opening file in Explorer:', download.filename);
                      await window.downloadAPI.showInFolder(download.filename);
                    } else {
                      console.log('showInFolder API not available');
                    }
                  } catch (error) {
                    console.error('Failed to show file in folder:', error);
                  }
                }}
                className="body-small text-primary hover:text-primary/80 underline"
              >
                Show in folder
              </button>
            </div>
          )}
        </div>
        
        {onClear && download.status !== 'downloading' && (
          <button
            onClick={onClear}
            className="p-2 hover:bg-surface-variant rounded-full text-on-surface-variant hover:text-on-surface"
          >
            <XCircle className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default DownloadProgress;