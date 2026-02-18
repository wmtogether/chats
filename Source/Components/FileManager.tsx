import { useState, useEffect } from 'react';
import { Folder, File, Upload, Download, Trash2, RefreshCw, FolderOpen, FileText, Image, FileArchive, Send, Globe, Briefcase } from 'lucide-react';
import { useToast } from '../Library/hooks/useToast';
import { useDownload } from '../Library/hooks/useDownload';
import UploadDialog from './UploadDialog';
import { getApiUrl } from '../Library/utils/env';

const API_BASE_URL = getApiUrl();

interface FileItem {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  modifiedAt?: string;
}

interface FileManagerProps {
  uniqueId?: string; // Chat unique ID (e.g., "CN-120226-1" or "WMT-120226-J0001")
  onPostFile?: (fileName: string, filePath: string) => void; // Callback to post file to chat
}

type TabType = 'works' | 'global';

export default function FileManager({ uniqueId, onPostFile }: FileManagerProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [resolvedPath, setResolvedPath] = useState<string>(''); // Store the resolved path
  const [activeTab, setActiveTab] = useState<TabType>('works'); // Default to works tab
  const { addToast } = useToast();
  const { startDownload } = useDownload();

  // Listen for WebSocket file events for real-time updates
  useEffect(() => {
    const handleFileEvent = (event: CustomEvent) => {
      const { action, path } = event.detail;
      
      // Check if the event is for the current path
      if (path && resolvedPath && path.startsWith(resolvedPath)) {
        console.log('File event detected, refreshing file list:', action, path);
        loadFiles();
      }
    };

    window.addEventListener('file_uploaded' as any, handleFileEvent);
    window.addEventListener('file_deleted' as any, handleFileEvent);

    return () => {
      window.removeEventListener('file_uploaded' as any, handleFileEvent);
      window.removeEventListener('file_deleted' as any, handleFileEvent);
    };
  }, [resolvedPath]);

  // Load files from current directory
  useEffect(() => {
    loadFiles();
  }, [uniqueId, activeTab]);

  const loadFiles = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('No authentication token found');
      }

      let url = '';
      
      if (activeTab === 'global') {
        // Load global files
        url = `${API_BASE_URL}/api/files/list?path=${encodeURIComponent('/volumes/filestorage/global')}`;
      } else if (activeTab === 'works' && uniqueId) {
        // Load proof path files
        url = `${API_BASE_URL}/api/files/list?uniqueId=${encodeURIComponent(uniqueId)}`;
      } else {
        // No valid path
        setFiles([]);
        setResolvedPath('');
        setIsLoading(false);
        return;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          // Directory doesn't exist yet - this is normal before proof is created
          setFiles([]);
          setResolvedPath('');
          return;
        }
        throw new Error(`Failed to list files: ${response.statusText}`);
      }

      const data = await response.json();
      setFiles(data.data?.files || []);
      
      // Store the resolved path from the response
      if (data.data?.path) {
        setResolvedPath(data.data.path);
      } else if (activeTab === 'global') {
        setResolvedPath('/volumes/filestorage/global');
      }
    } catch (error) {
      console.error('Failed to load files:', error);
      setFiles([]);
      setResolvedPath('');
      // Don't show error toast for 404 - it's expected before proof creation
      if (error instanceof Error && !error.message.includes('404')) {
        addToast({ message: 'Failed to load files', type: 'error' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    loadFiles();
  };

  const handleFileClick = (file: FileItem) => {
    if (file.type === 'file') {
      setSelectedFile(file.name);
    }
  };

  const handleUpload = () => {
    setIsUploadDialogOpen(true);
  };

  const handleDownload = async (fileName: string) => {
    if (!resolvedPath) return;
    
    try {
      // Look up the file token from the backend
      const token = localStorage.getItem('authToken');
      const filePath = `${resolvedPath}/${fileName}`;
      
      // For now, use the legacy path-based download
      // TODO: Implement token lookup endpoint for existing files
      const fullFileUrl = `${API_BASE_URL}/api/files/download?path=${encodeURIComponent(filePath)}&token=${token}`;
      
      console.log('Starting direct file download:', fullFileUrl, '->', fileName);
      
      await startDownload(fullFileUrl, fileName);
      addToast({ message: `Download started: ${fileName}`, type: 'info' });
    } catch (error) {
      console.error('Download error:', error);
      addToast({ message: `Failed to download ${fileName}`, type: 'error' });
    }
  };

  const handleDelete = async (fileName: string) => {
    if (!resolvedPath) return;
    
    if (!confirm(`Are you sure you want to delete "${fileName}"?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const filePath = `${resolvedPath}/${fileName}`;
      const response = await fetch(`${API_BASE_URL}/api/files/delete?path=${encodeURIComponent(filePath)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Delete failed: ${response.statusText}`);
      }

      addToast({ message: `Deleted ${fileName}`, type: 'success' });
      loadFiles(); // Refresh file list
    } catch (error) {
      console.error('Delete error:', error);
      addToast({ message: `Failed to delete ${fileName}`, type: 'error' });
    }
  };

  const handlePostToChat = (fileName: string) => {
    if (!resolvedPath || !onPostFile) return;
    
    const filePath = `${resolvedPath}/${fileName}`;
    onPostFile(fileName, filePath);
    addToast({ message: `Posted ${fileName} to chat`, type: 'success' });
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (fileName: string, type: string) => {
    if (type === 'directory') return FolderOpen;
    
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext || '')) return Image;
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext || '')) return FileArchive;
    if (['pdf', 'doc', 'docx', 'txt'].includes(ext || '')) return FileText;
    return File;
  };

  if (!uniqueId) {
    return (
      <aside className="w-80 bg-surface border-l border-outline flex flex-col h-full">
        <div className="flex items-center justify-center h-full text-center p-6">
          <div>
            <Folder className="h-12 w-12 text-on-surface-variant mx-auto mb-3 opacity-50" />
            <p className="body-medium text-on-surface-variant">
              No chat selected
            </p>
          </div>
        </div>
      </aside>
    );
  }

  const getCurrentPath = () => {
    if (activeTab === 'global') {
      return 'global';
    }
    return uniqueId || '';
  };

  return (
    <aside className="w-80 bg-surface border-l border-outline flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-outline flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h3 className="title-medium text-on-surface">Files</h3>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="p-2 rounded-lg hover:bg-surface-variant transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={16} className={`text-on-surface-variant ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        
        {/* Tabs */}
        <div className="flex gap-1 bg-surface-container rounded-lg p-1">
          <button
            onClick={() => setActiveTab('works')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md transition-all label-small ${
              activeTab === 'works'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-variant'
            }`}
          >
            <Briefcase size={14} />
            Works
          </button>
          <button
            onClick={() => setActiveTab('global')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md transition-all label-small ${
              activeTab === 'global'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-variant'
            }`}
          >
            <Globe size={14} />
            Global
          </button>
        </div>
        
        <div className="body-small text-on-surface-variant truncate mt-2" title={getCurrentPath()}>
          {getCurrentPath()}
        </div>
      </div>

      {/* Actions */}
      <div className="p-3 border-b border-outline flex gap-2 flex-shrink-0">
        <button
          onClick={handleUpload}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary text-on-primary rounded-lg hover:bg-primary/90 transition-colors label-small"
        >
          <Upload size={14} />
          Upload
        </button>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : files.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-center p-6">
            <div>
              <Folder className="h-10 w-10 text-on-surface-variant mx-auto mb-2 opacity-50" />
              <p className="body-small text-on-surface-variant mb-1">
                No files yet
              </p>
              <p className="body-small text-on-surface-variant/70">
                Folder will be created when proof is added
              </p>
            </div>
          </div>
        ) : (
          <div className="p-2">
            {files.map((file) => {
              const IconComponent = getFileIcon(file.name, file.type);
              const isSelected = selectedFile === file.name;

              return (
                <div
                  key={file.name}
                  onClick={() => handleFileClick(file)}
                  className={`group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all mb-1 ${
                    isSelected
                      ? 'bg-primary/10 border border-primary/20'
                      : 'hover:bg-surface-variant border border-transparent'
                  }`}
                >
                  <IconComponent
                    size={20}
                    className={`flex-shrink-0 ${
                      file.type === 'directory'
                        ? 'text-primary'
                        : 'text-on-surface-variant'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="body-small text-on-surface truncate">
                      {file.name}
                    </div>
                    {file.type === 'file' && (
                      <div className="body-small text-on-surface-variant">
                        {formatFileSize(file.size)}
                      </div>
                    )}
                  </div>
                  {file.type === 'file' && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePostToChat(file.name);
                        }}
                        className="p-1.5 rounded hover:bg-primary-container transition-colors"
                        title="Post to chat"
                      >
                        <Send size={14} className="text-primary" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(file.name);
                        }}
                        className="p-1.5 rounded hover:bg-surface-container transition-colors"
                        title="Download"
                      >
                        <Download size={14} className="text-on-surface-variant" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(file.name);
                        }}
                        className="p-1.5 rounded hover:bg-error-container transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={14} className="text-error" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-outline flex-shrink-0">
        <div className="body-small text-on-surface-variant">
          {files.length} item{files.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Upload Dialog */}
      <UploadDialog
        isOpen={isUploadDialogOpen}
        onClose={() => setIsUploadDialogOpen(false)}
        currentPath={activeTab === 'global' ? 'global' : uniqueId}
        onUploadComplete={(uploadedFiles) => {
          loadFiles(); // Refresh file list
          
          // Auto-post files to chat if callback is provided and not in global tab
          if (onPostFile && activeTab === 'works') {
            uploadedFiles.forEach(file => {
              // Use token instead of filePath for secure downloads
              onPostFile(file.fileName, file.token || file.filePath);
            });
          }
        }}
      />
    </aside>
  );
}
