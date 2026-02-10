import { useState, useCallback, useEffect } from 'react';

// Subprocess progress format from Rust backend
interface SubprocessProgress {
  url: string;
  filename: string;
  total_size: number;
  downloaded: number;
  progress_percent: number;
  download_speed_bps: number;
  download_speed_mbps: number;
  download_speed_human: string;
  connections: number;
  eta_seconds: number;
  eta_human: string;
  status: 'downloading' | 'completed' | 'error';
  error: string | null;
}

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

  // Listen for real-time download progress from subprocess
  useEffect(() => {
    // Set up callback for download progress updates
    window.downloadProgressCallback = (progress: SubprocessProgress) => {
      console.log('📥 Download progress received:', progress);
      
      const downloadId = `${progress.url}_${progress.filename}`;
      
      // Map subprocess status to frontend status
      const status: 'idle' | 'downloading' | 'completed' | 'error' = 
        progress.status === 'downloading' ? 'downloading' :
        progress.status === 'completed' ? 'completed' :
        progress.status === 'error' ? 'error' : 'idle';
      
      setDownloads(prev => new Map(prev.set(downloadId, {
        url: progress.url,
        filename: progress.filename,
        progress: Math.round(progress.progress_percent),
        status: status,
        error: progress.error || undefined,
        downloadSpeed: progress.download_speed_human,
        eta: progress.eta_human
      })));
    };

    // Listen for custom download-progress events
    const handleProgressEvent = (event: CustomEvent<SubprocessProgress>) => {
      if (window.downloadProgressCallback) {
        window.downloadProgressCallback(event.detail);
      }
    };

    window.addEventListener('download-progress', handleProgressEvent as EventListener);

    return () => {
      window.removeEventListener('download-progress', handleProgressEvent as EventListener);
      delete window.downloadProgressCallback;
    };
  }, []);

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
        // Use desktop download API - direct IPC, no web requests
        console.log('Starting direct download via IPC:', url, '->', finalFilename);
        
        const result = await window.downloadAPI.startDownload(url, finalFilename);
        
        if (result.success) {
          console.log('Download IPC message sent successfully:', result.message);
          console.log('📊 Real-time progress will be received via downloadProgressCallback');
          // Progress updates will come via downloadProgressCallback
        } else {
          throw new Error(result.error || 'Failed to start download');
        }
      } else {
        // Fallback: create download link without fetch (browser environment)
        console.log('Browser environment: creating download link');
        
        const link = document.createElement('a');
        link.href = url;
        link.download = finalFilename;
        link.target = '_blank';
        link.style.display = 'none';
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
      showInFolder: (filename: string) => Promise<{
        success: boolean;
        message?: string;
        error?: string;
      }>;
    };
    downloadProgressCallback?: (progress: SubprocessProgress) => void;
  }
}