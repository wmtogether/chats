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

// Global download state - shared across all hook instances
const globalDownloads = new Map<string, DownloadProgress>();
const listeners = new Set<() => void>();

// Notify all listeners of state change
function notifyListeners() {
  listeners.forEach(listener => listener());
}

// Update global download state
function updateDownload(url: string, progress: DownloadProgress) {
  console.log('🔄 Updating global download state:', url, progress);
  globalDownloads.set(url, progress);
  notifyListeners();
}

// Get download by URL
function getDownloadByUrl(url: string): DownloadProgress | undefined {
  return globalDownloads.get(url);
}

// Initialize global callback once
if (typeof window !== 'undefined' && !window.downloadProgressCallback) {
  console.log('🎯 Initializing global downloadProgressCallback');
  
  window.downloadProgressCallback = (progress: SubprocessProgress) => {
    console.log('📥 Global callback received:', {
      url: progress.url,
      filename: progress.filename,
      progress: progress.progress_percent,
      status: progress.status
    });
    
    const downloadProgress: DownloadProgress = {
      url: progress.url,
      filename: progress.filename,
      progress: Math.round(progress.progress_percent),
      status: progress.status === 'downloading' ? 'downloading' :
              progress.status === 'completed' ? 'completed' :
              progress.status === 'error' ? 'error' : 'idle',
      error: progress.error || undefined,
      downloadSpeed: progress.download_speed_human,
      eta: progress.eta_human
    };
    
    updateDownload(progress.url, downloadProgress);
  };
}

export function useDownload() {
  const [, setUpdateTrigger] = useState(0);

  // Subscribe to global state changes
  useEffect(() => {
    const listener = () => {
      setUpdateTrigger(prev => prev + 1);
    };
    
    listeners.add(listener);
    console.log('👂 Subscribed to download updates, total listeners:', listeners.size);
    
    return () => {
      listeners.delete(listener);
      console.log('👋 Unsubscribed from download updates, remaining:', listeners.size);
    };
  }, []);

  const startDownload = useCallback(async (url: string, filename?: string) => {
    const finalFilename = filename || url.split('/').pop() || 'download';

    console.log('🚀 Starting download:', { url, filename: finalFilename });

    // Initialize download state
    updateDownload(url, {
      url,
      filename: finalFilename,
      progress: 0,
      status: 'downloading'
    });

    try {
      if (window.downloadAPI) {
        console.log('📤 Sending IPC download request:', url);
        
        const result = await window.downloadAPI.startDownload(url, finalFilename);
        
        if (result.success) {
          console.log('✅ Download IPC sent:', result.message);
        } else {
          throw new Error(result.error || 'Failed to start download');
        }
      } else {
        // Browser fallback
        console.log('🌐 Browser download fallback');
        const link = document.createElement('a');
        link.href = url;
        link.download = finalFilename;
        link.target = '_blank';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        updateDownload(url, {
          url,
          filename: finalFilename,
          progress: 100,
          status: 'completed'
        });
      }
    } catch (error) {
      console.error('❌ Download failed:', error);
      updateDownload(url, {
        url,
        filename: finalFilename,
        progress: 0,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return url;
  }, []);

  const getDownload = useCallback((url: string) => {
    const download = getDownloadByUrl(url);
    console.log('🔍 Getting download:', url, download ? 'FOUND' : 'NOT FOUND');
    return download;
  }, []);

  const clearDownload = useCallback((url: string) => {
    console.log('🗑️ Clearing download:', url);
    globalDownloads.delete(url);
    notifyListeners();
  }, []);

  const getAllDownloads = useCallback(() => {
    return Array.from(globalDownloads.values());
  }, []);

  return {
    startDownload,
    getDownload,
    clearDownload,
    getAllDownloads,
    downloads: Array.from(globalDownloads.values())
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
