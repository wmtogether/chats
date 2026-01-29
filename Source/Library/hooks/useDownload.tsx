import { useState, useCallback } from 'react';

export interface DownloadProgress {
  url: string;
  filename: string;
  progress: number;
  status: 'idle' | 'downloading' | 'completed' | 'error';
  error?: string;
  downloadSpeed?: string;
  eta?: string;
}

export function useDownload() {
  const [downloads, setDownloads] = useState<Map<string, DownloadProgress>>(new Map());

  const startDownload = useCallback(async (url: string, filename?: string) => {
    // Extract filename from URL if not provided
    const finalFilename = filename || url.split('/').pop() || 'download';
    const downloadId = `${url}_${finalFilename}`;

    // Initialize download state
    setDownloads(prev => new Map(prev.set(downloadId, {
      url,
      filename: finalFilename,
      progress: 0,
      status: 'downloading'
    })));

    try {
      // Check if we're in desktop environment
      if (window.downloadAPI) {
        // Use desktop download API
        const result = await window.downloadAPI.startDownload(url, finalFilename);
        
        if (result.success) {
          console.log('Download started successfully:', result.message);
          
          // For now, simulate progress since we don't have real-time updates yet
          // In a full implementation, you'd listen to progress events from the desktop app
          simulateProgress(downloadId);
        } else {
          throw new Error(result.error || 'Failed to start download');
        }
      } else {
        // Fallback to browser download
        const link = document.createElement('a');
        link.href = url;
        link.download = finalFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Mark as completed immediately for browser downloads
        setDownloads(prev => new Map(prev.set(downloadId, {
          url,
          filename: finalFilename,
          progress: 100,
          status: 'completed'
        })));
      }
    } catch (error) {
      console.error('Download failed:', error);
      setDownloads(prev => new Map(prev.set(downloadId, {
        url,
        filename: finalFilename,
        progress: 0,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      })));
    }

    return downloadId;
  }, []);

  // Simulate progress for desktop downloads (temporary until real-time events are implemented)
  const simulateProgress = useCallback((downloadId: string) => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 10;
      
      if (progress >= 100) {
        progress = 100;
        setDownloads(prev => {
          const current = prev.get(downloadId);
          if (current) {
            return new Map(prev.set(downloadId, {
              ...current,
              progress: 100,
              status: 'completed'
            }));
          }
          return prev;
        });
        clearInterval(interval);
      } else {
        setDownloads(prev => {
          const current = prev.get(downloadId);
          if (current && current.status === 'downloading') {
            return new Map(prev.set(downloadId, {
              ...current,
              progress: Math.round(progress)
            }));
          }
          return prev;
        });
      }
    }, 500);
  }, []);

  const getDownload = useCallback((downloadId: string) => {
    return downloads.get(downloadId);
  }, [downloads]);

  const clearDownload = useCallback((downloadId: string) => {
    setDownloads(prev => {
      const newMap = new Map(prev);
      newMap.delete(downloadId);
      return newMap;
    });
  }, []);

  const getAllDownloads = useCallback(() => {
    return Array.from(downloads.values());
  }, [downloads]);

  return {
    startDownload,
    getDownload,
    clearDownload,
    getAllDownloads,
    downloads: Array.from(downloads.values())
  };
}

// Extend window interface for TypeScript
declare global {
  interface Window {
    downloadAPI?: {
      startDownload: (url: string, filename: string) => Promise<{
        success: boolean;
        message?: string;
        error?: string;
      }>;
    };
  }
}