import { useState } from 'react';
import { X, Upload, File, Folder, AlertCircle } from 'lucide-react';
import { useToast } from '../Library/hooks/useToast';
import { getApiUrl } from '../Library/utils/env';

const API_BASE_URL = getApiUrl();

interface UploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentPath?: string; // Current filestorage path
  onUploadComplete?: (uploadedFiles: Array<{ fileName: string; filePath: string }>) => void;
}

type UploadLocation = 'global' | 'filestorage';

export default function UploadDialog({ isOpen, onClose, currentPath, onUploadComplete }: UploadDialogProps) {
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [uploadLocation, setUploadLocation] = useState<UploadLocation>('filestorage');
  const [isUploading, setIsUploading] = useState(false);
  const { addToast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles(e.target.files);
    }
  };

  const handleUpload = async () => {
    if (!selectedFiles || selectedFiles.length === 0) {
      addToast({ message: 'Please select files to upload', type: 'error' });
      return;
    }

    // Determine upload path
    let uploadPath = '';
    let useUniqueId = false;
    
    if (uploadLocation === 'global') {
      uploadPath = '/volumes/filestorage/global';
    } else if (uploadLocation === 'filestorage' && currentPath) {
      // Check if currentPath is 'global' or a uniqueId
      if (currentPath === 'global') {
        uploadPath = '/volumes/filestorage/global';
      } else {
        uploadPath = currentPath;
        useUniqueId = true;
      }
    } else {
      addToast({ message: 'No upload path available', type: 'error' });
      return;
    }

    setIsUploading(true);

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const formData = new FormData();
      
      // Use uniqueId if uploading to filestorage (and not global), otherwise use path
      if (useUniqueId) {
        formData.append('uniqueId', uploadPath);
      } else {
        formData.append('path', uploadPath);
      }

      for (let i = 0; i < selectedFiles.length; i++) {
        formData.append('files', selectedFiles[i]);
      }

      const response = await fetch(`${API_BASE_URL}/api/files/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      addToast({ message: `Uploaded ${selectedFiles.length} file(s) successfully`, type: 'success' });
      
      // Get the resolved path from the response or use the upload path
      const resolvedPath = result.data?.path || uploadPath;
      
      // Prepare uploaded files info for callback
      const uploadedFilesInfo = Array.from(selectedFiles).map(file => ({
        fileName: file.name,
        filePath: `${resolvedPath}/${file.name}`,
      }));
      
      if (onUploadComplete) {
        onUploadComplete(uploadedFilesInfo);
      }
      
      onClose();
      setSelectedFiles(null);
    } catch (error) {
      console.error('Upload error:', error);
      addToast({ message: 'Failed to upload files', type: 'error' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      setSelectedFiles(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  const fileCount = selectedFiles ? selectedFiles.length : 0;
  const totalSize = selectedFiles 
    ? Array.from(selectedFiles).reduce((sum, file) => sum + file.size, 0)
    : 0;

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-surface border border-outline-variant rounded-3xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-outline-variant">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <Upload className="h-5 w-5 text-primary" />
            </div>
            <h2 className="title-large text-on-surface">Upload Files</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isUploading}
            className="p-2 hover:bg-surface-variant rounded-full transition-colors disabled:opacity-50"
          >
            <X size={20} className="text-on-surface-variant" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Upload Location Selection */}
          <div>
            <label className="block label-medium text-on-surface mb-3">
              Upload Location
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setUploadLocation('global')}
                disabled={isUploading}
                className={`p-4 rounded-xl border-2 transition-all disabled:opacity-50 ${
                  uploadLocation === 'global'
                    ? 'border-primary bg-primary/10'
                    : 'border-outline-variant hover:border-outline'
                }`}
              >
                <Folder className={`h-6 w-6 mx-auto mb-2 ${uploadLocation === 'global' ? 'text-primary' : 'text-on-surface-variant'}`} />
                <div className="label-medium text-on-surface">Global</div>
                <div className="body-small text-on-surface-variant mt-1">
                  Shared files
                </div>
              </button>

              <button
                type="button"
                onClick={() => setUploadLocation('filestorage')}
                disabled={isUploading || !currentPath}
                className={`p-4 rounded-xl border-2 transition-all disabled:opacity-50 ${
                  uploadLocation === 'filestorage'
                    ? 'border-primary bg-primary/10'
                    : 'border-outline-variant hover:border-outline'
                }`}
              >
                <File className={`h-6 w-6 mx-auto mb-2 ${uploadLocation === 'filestorage' ? 'text-primary' : 'text-on-surface-variant'}`} />
                <div className="label-medium text-on-surface">Current Folder</div>
                <div className="body-small text-on-surface-variant mt-1">
                  {currentPath ? 'This chat' : 'Not available'}
                </div>
              </button>
            </div>
          </div>

          {/* File Selection */}
          <div>
            <label className="block label-medium text-on-surface mb-2">
              Select Files
            </label>
            <div className="relative">
              <input
                type="file"
                multiple
                onChange={handleFileSelect}
                disabled={isUploading}
                className="hidden"
                id="file-upload-input"
              />
              <label
                htmlFor="file-upload-input"
                className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                  isUploading
                    ? 'opacity-50 cursor-not-allowed'
                    : 'border-outline-variant hover:border-primary hover:bg-primary/5'
                }`}
              >
                <Upload className="h-8 w-8 text-on-surface-variant mb-2" />
                <span className="label-medium text-on-surface">
                  {fileCount > 0 ? `${fileCount} file(s) selected` : 'Click to select files'}
                </span>
                <span className="body-small text-on-surface-variant mt-1">
                  {fileCount > 0 ? formatSize(totalSize) : 'or drag and drop'}
                </span>
              </label>
            </div>
          </div>

          {/* Selected Files List */}
          {selectedFiles && selectedFiles.length > 0 && (
            <div className="max-h-40 overflow-y-auto space-y-2 p-3 bg-surface-variant/30 rounded-lg">
              {Array.from(selectedFiles).map((file, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <File size={16} className="text-on-surface-variant flex-shrink-0" />
                  <span className="flex-1 truncate text-on-surface">{file.name}</span>
                  <span className="text-on-surface-variant">{formatSize(file.size)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Warning for filestorage without path */}
          {uploadLocation === 'filestorage' && !currentPath && (
            <div className="flex items-start gap-2 p-3 bg-error-container/20 border border-error/30 rounded-lg">
              <AlertCircle size={16} className="text-error flex-shrink-0 mt-0.5" />
              <div className="body-small text-on-error-container">
                No current folder available. Please select a chat with a proof or use Global upload.
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-6 border-t border-outline-variant">
          <button
            type="button"
            onClick={handleClose}
            disabled={isUploading}
            className="flex-1 px-4 py-3 bg-surface-variant text-on-surface rounded-xl hover:bg-surface-variant/80 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={isUploading || !selectedFiles || selectedFiles.length === 0 || (uploadLocation === 'filestorage' && !currentPath)}
            className="flex-1 px-4 py-3 bg-primary text-on-primary rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isUploading ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload size={16} />
                Upload
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
