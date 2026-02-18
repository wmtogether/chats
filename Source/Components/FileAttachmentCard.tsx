import React, { useState } from 'react';
import { 
  Download, 
  CheckCircle, 
  XCircle, 
  Clock, 
  FileText, 
  Archive, 
  Image as ImageIcon,
  Video,
  Music,
  File,
  ExternalLink
} from 'lucide-react';
import { useDownload } from '../Library/hooks/useDownload';
import { getApiUrl } from '../Library/utils/env';

interface FileAttachmentCardProps {
  src?: string; // Legacy support
  filename?: string; // Legacy support
  fileName?: string; // New prop
  filePath?: string; // New prop
  fileSize?: string;
  mimeType?: string;
  onClick?: () => void;
}

const FileAttachmentCard: React.FC<FileAttachmentCardProps> = ({ 
  src, 
  filename, 
  fileName,
  filePath,
  fileSize, 
  mimeType,
  onClick 
}) => {
  const { startDownload, downloads } = useDownload();
  const [isDownloading, setIsDownloading] = useState(false);

  // Support both old and new prop names
  const actualFileName = fileName || filename || 'unknown';
  
  // Build the download URL with token
  let actualSrc = '';
  if (filePath) {
    // filePath now contains the download token
    const authToken = localStorage.getItem('authToken');
    actualSrc = `${getApiUrl()}/api/files/d/${filePath}?token=${authToken}`;
  } else if (src) {
    actualSrc = src;
  }

  // Convert relative URL to absolute URL using the API server
  const fullFileUrl = actualSrc?.startsWith('http') ? actualSrc : `${getApiUrl()}${actualSrc}`;

  // Find active download for this file
  const activeDownload = downloads.find(d => d.url === fullFileUrl);
  
  // Debug logging
  console.log('🔍 FileAttachmentCard render:', {
    actualFileName,
    actualSrc,
    fullFileUrl,
    downloadsCount: downloads.length,
    downloadsUrls: downloads.map(d => d.url),
    activeDownload: activeDownload ? {
      progress: activeDownload.progress,
      status: activeDownload.status
    } : 'NOT FOUND'
  });

  const getFileIcon = () => {
    if (!mimeType) {
      const ext = actualFileName.split('.').pop()?.toLowerCase();
      switch (ext) {
        case 'zip':
        case 'rar':
        case '7z':
          return Archive;
        case 'jpg':
        case 'jpeg':
        case 'png':
        case 'gif':
        case 'webp':
          return ImageIcon;
        case 'mp4':
        case 'avi':
        case 'mov':
        case 'webm':
          return Video;
        case 'mp3':
        case 'wav':
        case 'flac':
          return Music;
        case 'pdf':
        case 'doc':
        case 'docx':
        case 'txt':
          return FileText;
        default:
          return File;
      }
    }

    if (mimeType.startsWith('image/')) return ImageIcon;
    if (mimeType.startsWith('video/')) return Video;
    if (mimeType.startsWith('audio/')) return Music;
    if (mimeType.includes('zip') || mimeType.includes('archive')) return Archive;
    if (mimeType.includes('pdf') || mimeType.includes('document')) return FileText;
    
    return File;
  };

  const getStatusIcon = () => {
    if (!activeDownload) return null;
    
    switch (activeDownload.status) {
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
    if (!activeDownload) return 'Click to download';
    
    switch (activeDownload.status) {
      case 'downloading':
        return `Downloading... ${activeDownload.progress}%`;
      case 'completed':
        return 'Download completed';
      case 'error':
        return `Error: ${activeDownload.error || 'Download failed'}`;
      default:
        return 'Preparing download...';
    }
  };

  const getCardStyle = () => {
    if (!activeDownload) {
      return 'bg-surface-container border-outline-variant hover:bg-surface-variant/50 hover:border-primary/50 cursor-pointer';
    }
    
    switch (activeDownload.status) {
      case 'downloading':
        return 'bg-primary/5 border-primary/30';
      case 'completed':
        return 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800';
      case 'error':
        return 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800';
      default:
        return 'bg-surface-container border-outline-variant';
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (activeDownload?.status === 'downloading') {
      return; // Don't start new download if already downloading
    }
    
    try {
      setIsDownloading(true);
      console.log('Starting file download:', fullFileUrl, '->', actualFileName);
      
      // Get auth token for header
      const authToken = localStorage.getItem('authToken');
      const headers = authToken ? { 'Authorization': `Bearer ${authToken}` } : undefined;
      
      // Try subprocess download first if available
      if (window.downloadAPI) {
        console.log('Using subprocess downloader with headers');
        await startDownload(fullFileUrl, actualFileName, headers);
      } else {
        // Fallback to browser download
        console.log('downloadAPI not available, using browser download');
        const link = document.createElement('a');
        link.href = fullFileUrl;
        link.download = actualFileName;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('Download error:', error);
      
      // Fallback to browser download on error
      console.log('Using browser fallback due to error');
      try {
        const link = document.createElement('a');
        link.href = fullFileUrl;
        link.download = actualFileName;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (fallbackError) {
        console.error('Browser fallback also failed:', fallbackError);
      }
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCardClick = () => {
    if (onClick) {
      onClick();
    } else {
      handleDownload({ stopPropagation: () => {} } as React.MouseEvent);
    }
  };

  const FileIcon = getFileIcon();

  return (
    <div 
      className={`relative p-3 sm:p-4 border rounded-2xl shadow-sm transition-all duration-200 ${getCardStyle()}`}
      onClick={handleCardClick}
    >
      <div className="flex items-start gap-2 sm:gap-4">
        {/* File Icon */}
        <div className="flex-shrink-0">
          <div className="p-2 sm:p-3 rounded-full bg-primary/10 relative">
            <FileIcon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            {/* Status overlay */}
            {activeDownload && (
              <div className="absolute -bottom-1 -right-1 p-0.5 sm:p-1 rounded-full bg-surface border-2 border-outline shadow-sm">
                {getStatusIcon()}
              </div>
            )}
          </div>
        </div>

        {/* File Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="title-medium font-medium text-on-surface truncate text-sm sm:text-base">
                {actualFileName}
              </h4>
              <p className="body-small text-on-surface-variant mt-1 text-xs sm:text-sm">
                {getStatusText()}
              </p>
              {fileSize && (
                <p className="body-small text-on-surface-variant text-xs sm:text-sm">
                  {fileSize}
                </p>
              )}
            </div>
            
            {/* Download button */}
            {!activeDownload || activeDownload.status !== 'downloading' ? (
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className="p-1.5 sm:p-2 hover:bg-surface-variant rounded-full text-on-surface-variant hover:text-primary transition-colors disabled:opacity-50"
                title="Download file"
              >
                <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
            ) : (
              <div className="p-1.5 sm:p-2">
                <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary animate-pulse" />
              </div>
            )}
          </div>

          {/* Progress bar for downloading */}
          {activeDownload?.status === 'downloading' && (
            <div className="mt-2 sm:mt-3">
              <div className="flex justify-between items-center mb-1 sm:mb-2">
                <span className="body-small text-on-surface-variant text-xs sm:text-sm">
                  Progress
                </span>
                <span className="body-small font-medium text-primary text-xs sm:text-sm">
                  {activeDownload.progress}%
                </span>
              </div>
              <div className="w-full bg-surface-variant rounded-full h-1.5 sm:h-2">
                <div 
                  className="bg-primary h-1.5 sm:h-2 rounded-full transition-all duration-300"
                  style={{ width: `${activeDownload.progress}%` }}
                />
              </div>
              {activeDownload.downloadSpeed && (
                <div className="flex justify-between items-center mt-1 sm:mt-2 text-on-surface-variant body-small text-xs">
                  <span>Speed: {activeDownload.downloadSpeed}</span>
                  {activeDownload.eta && <span>ETA: {activeDownload.eta}</span>}
                </div>
              )}
            </div>
          )}

          {/* Completed actions */}
          {activeDownload?.status === 'completed' && (
            <div className="mt-2 flex gap-2">
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    if (window.downloadAPI?.showInFolder) {
                      console.log('Opening file in Explorer:', actualFileName);
                      await window.downloadAPI.showInFolder(actualFileName);
                    } else {
                      console.log('showInFolder API not available');
                    }
                  } catch (error) {
                    console.error('Failed to show file in folder:', error);
                  }
                }}
                className="body-small text-green-600 hover:text-green-700 underline flex items-center gap-1 text-xs sm:text-sm"
              >
                <ExternalLink className="h-3 w-3" />
                Show in folder
              </button>
            </div>
          )}

          {/* Error retry */}
          {activeDownload?.status === 'error' && (
            <div className="mt-2">
              <button
                onClick={handleDownload}
                className="body-small text-red-600 hover:text-red-700 underline text-xs sm:text-sm"
              >
                Retry download
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileAttachmentCard;