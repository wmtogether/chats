// Enhanced file upload utility with WebSocket integration
import { getWebSocketManager } from './websocket';

export interface UploadProgress {
  uploadId: string;
  filename: string;
  progress: number;
  bytesRead: number;
  totalBytes: number;
  status: 'uploading' | 'completed' | 'error';
  error?: string;
}

export interface UploadResult {
  success: boolean;
  url?: string;
  filename?: string;
  size?: number;
  type?: string;
  error?: string;
}

export interface UploadOptions {
  onProgress?: (progress: UploadProgress) => void;
  onComplete?: (result: UploadResult) => void;
  onError?: (error: string) => void;
  endpoint?: string;
  fieldName?: string;
  chunkSize?: number; // For chunked uploads
  useChunkedUpload?: boolean; // Force chunked upload
}

export class FileUploader {
  private wsManager = getWebSocketManager();

  constructor() {
    // Listen for WebSocket upload progress updates
    if (this.wsManager) {
      this.wsManager.on('message', (data: any) => {
        if (data.type === 'upload_progress') {
          this.handleProgressUpdate(data.data);
        }
      });
    }
  }

  private progressCallbacks = new Map<string, (progress: UploadProgress) => void>();
  private completeCallbacks = new Map<string, (result: UploadResult) => void>();
  private errorCallbacks = new Map<string, (error: string) => void>();

  private handleProgressUpdate(progress: UploadProgress) {
    const progressCallback = this.progressCallbacks.get(progress.uploadId);
    if (progressCallback) {
      progressCallback(progress);
    }

    if (progress.status === 'completed') {
      const completeCallback = this.completeCallbacks.get(progress.uploadId);
      if (completeCallback) {
        completeCallback({
          success: true,
          filename: progress.filename,
        });
      }
      this.cleanup(progress.uploadId);
    } else if (progress.status === 'error') {
      const errorCallback = this.errorCallbacks.get(progress.uploadId);
      if (errorCallback) {
        errorCallback(progress.error || 'Upload failed');
      }
      this.cleanup(progress.uploadId);
    }
  }

  private cleanup(uploadId: string) {
    this.progressCallbacks.delete(uploadId);
    this.completeCallbacks.delete(uploadId);
    this.errorCallbacks.delete(uploadId);
  }

  async uploadFile(file: File, options: UploadOptions = {}): Promise<UploadResult> {
    const {
      onProgress,
      onComplete,
      onError,
      endpoint = '/api/fileupload',
      fieldName = 'file',
      chunkSize = 10 * 1024 * 1024, // 10MB chunks
      useChunkedUpload = false
    } = options;

    // Use chunked upload for files over 100MB or if explicitly requested
    const shouldUseChunkedUpload = useChunkedUpload || file.size > 100 * 1024 * 1024;

    if (shouldUseChunkedUpload) {
      return this.uploadFileChunked(file, {
        onProgress,
        onComplete,
        onError,
        chunkSize
      });
    }

    // Regular upload for smaller files
    return this.uploadFileRegular(file, {
      onProgress,
      onComplete,
      onError,
      endpoint,
      fieldName
    });
  }

  private async uploadFileRegular(file: File, options: UploadOptions): Promise<UploadResult> {
    const {
      onProgress,
      onComplete,
      onError,
      endpoint = '/api/fileupload',
      fieldName = 'file'
    } = options;

    // Generate upload ID
    const uploadId = `${Date.now()}_${file.name}`;

    // Store callbacks for WebSocket updates
    if (onProgress) this.progressCallbacks.set(uploadId, onProgress);
    if (onComplete) this.completeCallbacks.set(uploadId, onComplete);
    if (onError) this.errorCallbacks.set(uploadId, onError);

    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append(fieldName, file);
      formData.append('uploadId', uploadId);

      const xhr = new XMLHttpRequest();

      // Track upload progress (fallback if WebSocket doesn't work)
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const progress: UploadProgress = {
            uploadId,
            filename: file.name,
            progress: Math.round((e.loaded / e.total) * 100 * 100) / 100, // Round to 2 decimal places
            bytesRead: e.loaded,
            totalBytes: e.total,
            status: 'uploading'
          };
          onProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const result: UploadResult = JSON.parse(xhr.responseText);
            if (onComplete) onComplete(result);
            resolve(result);
          } catch (error) {
            const errorMsg = 'Invalid response format';
            if (onError) onError(errorMsg);
            reject(new Error(errorMsg));
          }
        } else if (xhr.status === 401) {
          const errorMsg = 'Authentication required. Please log in again.';
          if (onError) onError(errorMsg);
          reject(new Error(errorMsg));
        } else {
          const errorMsg = `Upload failed with status ${xhr.status}`;
          if (onError) onError(errorMsg);
          reject(new Error(errorMsg));
        }
        this.cleanup(uploadId);
      });

      xhr.addEventListener('error', () => {
        const errorMsg = 'Network error during upload';
        if (onError) onError(errorMsg);
        reject(new Error(errorMsg));
        this.cleanup(uploadId);
      });

      xhr.addEventListener('timeout', () => {
        const errorMsg = 'Upload timeout';
        if (onError) onError(errorMsg);
        reject(new Error(errorMsg));
        this.cleanup(uploadId);
      });

      xhr.open('POST', endpoint);
      
      // Set authentication header AFTER opening the request
      const token = localStorage.getItem('authToken'); // Fixed: use 'authToken' not 'token'
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      
      xhr.timeout = file.size > 100 * 1024 * 1024 ? 600000 : 300000; // 10min for large files, 5min for others
      xhr.send(formData);
    });
  }

  private async uploadFileChunked(file: File, options: UploadOptions): Promise<UploadResult> {
    const {
      onProgress,
      onComplete,
      onError,
      chunkSize = 10 * 1024 * 1024 // 10MB chunks
    } = options;

    try {
      // Step 1: Initialize chunked upload
      const initResponse = await this.initChunkedUpload(file, chunkSize);
      if (!initResponse.success) {
        throw new Error(initResponse.error || 'Failed to initialize chunked upload');
      }

      const uploadId = initResponse.uploadId!;
      const totalChunks = initResponse.totalChunks!;

      // Step 2: Upload chunks in parallel (with concurrency limit)
      const concurrency = 3; // Upload 3 chunks at a time
      let completedChunks = 0;

      const uploadChunk = async (chunkIndex: number): Promise<void> => {
        const start = chunkIndex * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);

        const formData = new FormData();
        formData.append('uploadId', uploadId);
        formData.append('chunkIndex', chunkIndex.toString());
        formData.append('chunk', chunk);

        const response = await fetch('/api/chunked-upload/chunk', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          },
          body: formData
        });

        if (!response.ok) {
          throw new Error(`Failed to upload chunk ${chunkIndex}`);
        }

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || `Failed to upload chunk ${chunkIndex}`);
        }

        completedChunks++;
        const progress = (completedChunks / totalChunks) * 100;

        if (onProgress) {
          onProgress({
            uploadId,
            filename: file.name,
            progress: Math.round(progress * 100) / 100, // Round to 2 decimal places
            bytesRead: completedChunks * chunkSize,
            totalBytes: file.size,
            status: 'uploading'
          });
        }
      };

      // Upload chunks with concurrency control
      const chunkPromises: Promise<void>[] = [];
      for (let i = 0; i < totalChunks; i++) {
        chunkPromises.push(uploadChunk(i));
        
        // Wait for some chunks to complete before starting more
        if (chunkPromises.length >= concurrency) {
          await Promise.all(chunkPromises.splice(0, concurrency));
        }
      }

      // Wait for remaining chunks
      if (chunkPromises.length > 0) {
        await Promise.all(chunkPromises);
      }

      // Step 3: Complete the upload
      const completeResponse = await this.completeChunkedUpload(uploadId);
      if (!completeResponse.success) {
        throw new Error(completeResponse.error || 'Failed to complete chunked upload');
      }

      const result: UploadResult = {
        success: true,
        url: completeResponse.finalUrl,
        filename: file.name,
        size: file.size
      };

      if (onComplete) onComplete(result);
      return result;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Chunked upload failed';
      if (onError) onError(errorMsg);
      throw new Error(errorMsg);
    }
  }

  private async initChunkedUpload(file: File, chunkSize: number): Promise<any> {
    const response = await fetch('/api/chunked-upload/init', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      },
      body: JSON.stringify({
        filename: file.name,
        totalSize: file.size,
        chunkSize: chunkSize
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to initialize upload: ${response.status}`);
    }

    return response.json();
  }

  private async completeChunkedUpload(uploadId: string): Promise<any> {
    const response = await fetch('/api/chunked-upload/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      },
      body: JSON.stringify({
        uploadId: uploadId
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to complete upload: ${response.status}`);
    }

    return response.json();
  }

  async uploadImage(file: File, options: Omit<UploadOptions, 'endpoint' | 'fieldName'> = {}): Promise<UploadResult> {
    // Validate that it's an image
    if (!file.type.startsWith('image/')) {
      throw new Error('File must be an image');
    }

    // Validate image size (3GB max, same as regular files)
    const validation = this.validateFile(file, 3 * 1024 * 1024 * 1024);
    if (validation) {
      throw new Error(validation);
    }

    return this.uploadFile(file, {
      ...options,
      endpoint: '/api/imageupload',
      fieldName: 'image'
    });
  }

  async uploadMultipleFiles(files: File[], options: UploadOptions = {}): Promise<UploadResult[]> {
    const results: UploadResult[] = [];
    
    // Upload files sequentially to avoid overwhelming the server
    for (const file of files) {
      try {
        const result = await this.uploadFile(file, options);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Upload failed'
        });
      }
    }

    return results;
  }

  // Utility method to validate file before upload
  validateFile(file: File, maxSize: number = 3 * 1024 * 1024 * 1024): string | null {
    if (file.size > maxSize) {
      const maxSizeMB = Math.round(maxSize / (1024 * 1024));
      return `File "${file.name}" is too large. Maximum size is ${maxSizeMB}MB.`;
    }
    return null;
  }

  // Utility method to format file size
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Create singleton instance
export const fileUploader = new FileUploader();

// Convenience functions
export const uploadFile = (file: File, options?: UploadOptions) => 
  fileUploader.uploadFile(file, options);

export const uploadImage = (file: File, options?: Omit<UploadOptions, 'endpoint' | 'fieldName'>) => 
  fileUploader.uploadImage(file, options);

export const uploadMultipleFiles = (files: File[], options?: UploadOptions) => 
  fileUploader.uploadMultipleFiles(files, options);

export const validateFile = (file: File, maxSize?: number) => 
  fileUploader.validateFile(file, maxSize);

export const formatFileSize = (bytes: number) => 
  fileUploader.formatFileSize(bytes);