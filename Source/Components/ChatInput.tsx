import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { Send, Bold, Italic, Code, Smile, PlusCircle, File, Image, FileImage, X, Upload, Reply, Clipboard } from 'lucide-react'
import CustomEmojiPicker from './EmojiPicker';

interface Attachment {
  id: string;
  file: File;
  type: 'file' | 'image' | 'gif';
  preview?: string;
  size: number;
  uploadedUrl?: string;
  uploadProgress?: number;
  uploadStatus?: 'pending' | 'uploading' | 'completed' | 'error';
  uploadError?: string;
}

interface ReplyingTo {
  messageId: string;
  userName: string;
  content: string;
}

interface ChatInputProps {
  onSendMessage?: (content: string, attachments?: string[], replyTo?: ReplyingTo) => void;
  replyingTo?: ReplyingTo | null;
  onCancelReply?: () => void;
}

const MAX_FILE_SIZE = 3 * 1024 * 1024 * 1024; // 3GB in bytes

export default function ChatInput({ onSendMessage, replyingTo, onCancelReply }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showAttachmentDropdown, setShowAttachmentDropdown] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isPasting, setIsPasting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const gifInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Add clipboard paste support
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      // Only handle paste if the textarea is focused or if we're in the chat input area
      const activeElement = document.activeElement;
      const isInChatInput = containerRef.current?.contains(activeElement as Node);

      if (!isInChatInput && activeElement !== textareaRef.current) {
        return;
      }

      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      // Check for files in clipboard
      const files = Array.from(clipboardData.files);
      if (files.length > 0) {
        e.preventDefault();
        setIsPasting(true);

        // Convert FileList to FileList-like object for handleFileSelect
        const fileList = {
          length: files.length,
          item: (index: number) => files[index],
          [Symbol.iterator]: function* () {
            for (let i = 0; i < files.length; i++) {
              yield files[i];
            }
          }
        } as FileList;

        await handleFileSelect(fileList);
        setIsPasting(false);
        return;
      }

      // Check for image data in clipboard (screenshots, etc.)
      const items = Array.from(clipboardData.items);
      const imageItems = items.filter(item => item.type.startsWith('image/'));

      if (imageItems.length > 0) {
        e.preventDefault();
        setIsPasting(true);

        for (const item of imageItems) {
          const file = item.getAsFile();
          if (file) {
            // Create a unique filename for pasted images
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const extension = file.type.split('/')[1] || 'png';

            // Create a new file with a proper name using Object.assign
            const renamedFile = Object.assign(file, {
              name: `pasted-image-${timestamp}.${extension}`
            });

            const fileList = {
              length: 1,
              item: () => renamedFile,
              [Symbol.iterator]: function* () {
                yield renamedFile;
              }
            } as FileList;

            await handleFileSelect(fileList);
          }
        }
        setIsPasting(false);
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, []);

  // Enhanced drag and drop support
  useEffect(() => {
    const handleGlobalDragOver = (e: DragEvent) => {
      // Prevent default behavior for the entire document
      e.preventDefault();
    };

    const handleGlobalDrop = (e: DragEvent) => {
      e.preventDefault();
      // Only handle if not dropping on our component
      if (!containerRef.current?.contains(e.target as Node)) {
        setIsDragOver(false);
      }
    };

    document.addEventListener('dragover', handleGlobalDragOver);
    document.addEventListener('drop', handleGlobalDrop);

    return () => {
      document.removeEventListener('dragover', handleGlobalDragOver);
      document.removeEventListener('drop', handleGlobalDrop);
    };
  }, []);

  const handleSend = () => {
    if ((message.trim() || attachments.length > 0) && onSendMessage) {
      // Check if message is a checkpoint (9 or more dashes)
      const trimmedMessage = message.trim();
      const isCheckpoint = /^-{9,}$/.test(trimmedMessage);

      // If it's a checkpoint, send it with special formatting
      const messageToSend = isCheckpoint ? '---CHECKPOINT---' : trimmedMessage;

      // Extract uploaded URLs from attachments
      const uploadedUrls = attachments
        .filter(att => att.uploadedUrl)
        .map(att => att.uploadedUrl!);

      onSendMessage(messageToSend, uploadedUrls, replyingTo || undefined);
      setMessage('');
      setAttachments([]);
      if (onCancelReply) onCancelReply();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newMessage = message.slice(0, start) + emoji + message.slice(end);
      setMessage(newMessage);

      // Set cursor position after emoji
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
        textarea.focus();
      }, 0);
    } else {
      setMessage(prev => prev + emoji);
    }
    // Close the emoji picker after selection
    setShowEmojiPicker(false);
  };

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `File "${file.name}" is too large. Maximum size is 3GB.`;
    }
    return null;
  };

  const createAttachment = (file: File): Promise<Attachment> => {
    return new Promise((resolve) => {
      const attachment: Attachment = {
        id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
        file,
        type: file.type.startsWith('image/gif') ? 'gif' :
          file.type.startsWith('image/') ? 'image' : 'file',
        size: file.size,
        uploadProgress: 0,
        uploadStatus: 'pending'
      };

      // Create preview for images and GIFs
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          attachment.preview = e.target?.result as string;
          resolve(attachment);
        };
        reader.readAsDataURL(file);
      } else {
        resolve(attachment);
      }
    });
  };

  const uploadFiles = async (attachmentsToUpload: Attachment[]) => {
    try {
      for (const attachment of attachmentsToUpload) {
        const file = attachment.file;
        const isLargeFile = file.size >= 50 * 1024 * 1024; // 50MB threshold
        
        // Set uploading status
        setAttachments(prev => 
          prev.map(att => 
            att.id === attachment.id 
              ? { ...att, uploadStatus: 'uploading', uploadProgress: 0 }
              : att
          )
        );
        
        try {
          let uploadedUrl: string;
          
          if (isLargeFile) {
            // Use TUS for files >= 50MB with progress tracking
            uploadedUrl = await uploadLargeFileWithProgress(file, attachment.id);
          } else {
            // Use /api/fileupload for files < 50MB with progress tracking
            uploadedUrl = await uploadFileWithProgress(file, attachment.id);
          }
          
          // Update attachment with uploaded URL and completed status
          setAttachments(prev => 
            prev.map(att => 
              att.id === attachment.id 
                ? { 
                    ...att, 
                    uploadedUrl: uploadedUrl,
                    uploadStatus: 'completed',
                    uploadProgress: 100
                  }
                : att
            )
          );
          
        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error);
          
          // Update attachment with error status
          setAttachments(prev => 
            prev.map(att => 
              att.id === attachment.id 
                ? { 
                    ...att, 
                    uploadStatus: 'error',
                    uploadError: error instanceof Error ? error.message : 'Upload failed'
                  }
                : att
            )
          );
        }
      }
      
    } catch (error) {
      console.error('Upload error:', error);
    }
  };

  const uploadFileWithProgress = (file: File, attachmentId: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('chatAttachment', 'true');
      
      const xhr = new XMLHttpRequest();
      
      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setAttachments(prev => 
            prev.map(att => 
              att.id === attachmentId 
                ? { ...att, uploadProgress: progress }
                : att
            )
          );
        }
      });
      
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve(data.url);
          } catch (error) {
            reject(new Error('Invalid response format'));
          }
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });
      
      xhr.addEventListener('error', () => {
        reject(new Error('Network error during upload'));
      });
      
      xhr.addEventListener('timeout', () => {
        reject(new Error('Upload timeout'));
      });
      
      xhr.open('POST', '/api/fileupload');
      xhr.timeout = 300000; // 5 minutes timeout
      xhr.send(formData);
    });
  };

  const uploadLargeFileWithProgress = (file: File, attachmentId: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      // For now, use the same endpoint as regular files
      // TODO: Implement proper TUS client for resumable uploads
      const formData = new FormData();
      formData.append('file', file);
      formData.append('chatAttachment', 'true');
      
      const xhr = new XMLHttpRequest();
      
      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setAttachments(prev => 
            prev.map(att => 
              att.id === attachmentId 
                ? { ...att, uploadProgress: progress }
                : att
            )
          );
        }
      });
      
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve(data.url);
          } catch (error) {
            reject(new Error('Invalid response format'));
          }
        } else {
          reject(new Error(`Large file upload failed with status ${xhr.status}`));
        }
      });
      
      xhr.addEventListener('error', () => {
        reject(new Error('Network error during large file upload'));
      });
      
      xhr.addEventListener('timeout', () => {
        reject(new Error('Large file upload timeout'));
      });
      
      xhr.open('POST', '/api/fileupload');
      xhr.timeout = 600000; // 10 minutes timeout for large files
      xhr.send(formData);
    });
  };

  const handleFileSelect = async (files: FileList | null, type?: 'file' | 'image' | 'gif') => {
    if (!files) return;

    const newAttachments: Attachment[] = [];
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const error = validateFile(file);

      if (error) {
        errors.push(error);
        continue;
      }

      // Type-specific validation
      if (type === 'image' && !file.type.startsWith('image/')) {
        errors.push(`"${file.name}" is not an image file.`);
        continue;
      }

      if (type === 'gif' && file.type !== 'image/gif') {
        errors.push(`"${file.name}" is not a GIF file.`);
        continue;
      }

      try {
        const attachment = await createAttachment(file);
        newAttachments.push(attachment);
      } catch (error) {
        errors.push(`Failed to process "${file.name}".`);
      }
    }

    if (errors.length > 0) {
      alert(errors.join('\n'));
    }

    if (newAttachments.length > 0) {
      setAttachments(prev => [...prev, ...newAttachments]);
      
      // Upload files immediately after adding them
      await uploadFiles(newAttachments);
    }

    setShowAttachmentDropdown(false);
  };

  const handleAttachmentClick = (type: 'file' | 'image' | 'gif') => {
    const inputRef = type === 'image' ? imageInputRef :
      type === 'gif' ? gifInputRef : fileInputRef;
    inputRef.current?.click();
  };

  const retryUpload = async (attachmentId: string) => {
    const attachment = attachments.find(att => att.id === attachmentId);
    if (!attachment) return;
    
    // Reset status and retry upload
    setAttachments(prev => 
      prev.map(att => 
        att.id === attachmentId 
          ? { ...att, uploadStatus: 'uploading', uploadProgress: 0, uploadError: undefined }
          : att
      )
    );
    
    await uploadFiles([attachment]);
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(att => att.id !== id));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if we're leaving the container entirely
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files);
    }
  };

  return (
    <div ref={containerRef} className="p-4 bg-background shrink-0 relative">
      {/* Paste Indicator */}


      {/* Reply Section */}
      {replyingTo && (
        <div className="mb-3 bg-surface-container border border-outline-variant rounded-2xl p-4 flex items-start gap-3">
          <Reply size={16} className="text-primary mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-primary mb-1">
              Replying to {replyingTo.userName}
            </div>
            <div className="text-sm text-on-surface-variant line-clamp-2">
              {replyingTo.content}
            </div>
          </div>
          <button
            onClick={onCancelReply}
            className="p-2 hover:bg-surface-variant rounded-full text-on-surface-variant hover:text-on-surface transition-colors"
            title="Cancel reply"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="relative bg-surface-container border border-outline-variant rounded-2xl p-3 flex items-center gap-3 max-w-xs">
              {attachment.preview ? (
                <div className="relative">
                  <img
                    src={attachment.preview}
                    alt={attachment.file.name}
                    className={`w-10 h-10 object-cover rounded-xl ${
                      attachment.uploadStatus === 'uploading' ? 'opacity-50' : ''
                    }`}
                  />
                  {attachment.uploadStatus === 'uploading' && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
              ) : (
                <div className={`w-10 h-10 bg-surface-variant rounded-xl flex items-center justify-center relative ${
                  attachment.uploadStatus === 'uploading' ? 'opacity-50' : ''
                }`}>
                  <File size={20} className="text-on-surface-variant" />
                  {attachment.uploadStatus === 'uploading' && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-on-surface truncate">
                  {attachment.file.name}
                </div>
                <div className="text-xs text-on-surface-variant">
                  {formatFileSize(attachment.size)}
                </div>
                
                {/* Upload Status */}
                {attachment.uploadStatus === 'uploading' && (
                  <div className="mt-1">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-surface-variant rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-primary h-full transition-all duration-300 ease-out"
                          style={{ width: `${attachment.uploadProgress || 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-on-surface-variant font-medium">
                        {attachment.uploadProgress || 0}%
                      </span>
                    </div>
                  </div>
                )}
                
                {attachment.uploadStatus === 'completed' && (
                  <div className="text-xs text-green-600 font-medium mt-1">
                    ✓ Uploaded
                  </div>
                )}
                
                {attachment.uploadStatus === 'error' && (
                  <div className="mt-1">
                    <div className="text-xs text-error font-medium">
                      ✗ Upload failed
                    </div>
                    {attachment.uploadError && (
                      <div className="text-xs text-error opacity-75">
                        {attachment.uploadError}
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="flex flex-col gap-1">
                {attachment.uploadStatus === 'error' && (
                  <button
                    onClick={() => retryUpload(attachment.id)}
                    className="p-1.5 hover:bg-primary-container rounded-full text-primary transition-colors"
                    title="Retry upload"
                  >
                    <Upload size={14} />
                  </button>
                )}
                
                <button
                  onClick={() => removeAttachment(attachment.id)}
                  disabled={attachment.uploadStatus === 'uploading'}
                  className="p-1.5 hover:bg-error-container rounded-full text-on-surface-variant hover:text-error transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Remove attachment"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div
        className={`bg-surface-container border border-outline-variant rounded-3xl shadow-sm flex flex-col focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all relative ${isDragOver ? 'border-primary bg-primary-container/10 ring-2 ring-primary/20' : ''
          }`}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag and Drop Overlay - Inside the input */}
        {isDragOver && (
          <div className="absolute inset-2 bg-primary/5 border-2 border-dashed border-primary rounded-2xl flex items-center justify-center z-20 backdrop-blur-sm">
            <div className="text-center p-8 flex items-center">
              <div className="w-12 h-12 mx-auto mb-2 bg-primary/10 rounded-full flex items-center justify-center">
                <Upload size={24} className="text-primary animate-bounce" />
              </div>
              <div className='pl-2'>
                <div className="label-large text-primary text-left">Drop files or images here</div>
                <div className="label-small text-on-surface-variant max-w-xs text-left">
                  Supports photos, documents, and files up to 3GB
                </div>
              </div>
            </div>
          </div>
        )}

        {isPasting && (
          <div className="absolute inset-0 bg-primary/5 border-2 border-dashed border-primary rounded-3xl flex items-center justify-center z-30 backdrop-blur-sm">
            <div className="text-center p-8 flex items-center">
              <div className="w-12 h-12 mx-auto  bg-primary/10 rounded-full flex items-center justify-center">
                <Clipboard size={24} className="text-primary animate-pulse" />
              </div>
              <div className='pl-2'>
                <div className="label-large text-primary text-left">Processing clipboard...</div>
                <div className="label-small text-on-surface-variant text-left">Please wait</div>
              </div>
            </div>
          </div>
        )}

        <div className="flex p-4">
          <textarea
            ref={textareaRef}
            className="w-full bg-transparent border-none text-on-surface placeholder-on-surface-variant text-sm p-0 focus:ring-0 resize-none leading-relaxed outline-none min-h-[24px] max-h-32 placeholder:text-sm"
            placeholder={replyingTo ? "Reply..." : "Type a message... (Use --------- for checkpoint)"}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            style={{
              height: 'auto',
              minHeight: '24px',
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 128) + 'px';
            }}
          />
        </div>

        <div className="flex items-center justify-between px-4 pb-3">
          <div className="flex items-center gap-1">
            {/* Attachment Dropdown */}
            <div className="relative">
              <ActionButton
                icon="add_circle"
                title="Attach file"
                onClick={() => setShowAttachmentDropdown(!showAttachmentDropdown)}
                active={showAttachmentDropdown}
              />

              {showAttachmentDropdown && (
                <div className="absolute bottom-full px-2 mb-2 bg-surface-container border border-outline-variant rounded-2xl shadow-lg py-2 z-10 min-w-[240px]">
                  <button
                    onClick={() => {
                      navigator.clipboard.read().then(async (clipboardItems) => {
                        for (const item of clipboardItems) {
                          for (const type of item.types) {
                            if (type.startsWith('image/')) {
                              const blob = await item.getType(type);
                              const extension = type.split('/')[1] || 'png';
                              // Use Object.assign to rename the file
                              const file = Object.assign(blob, {
                                name: `clipboard-image.${extension}`,
                                lastModified: Date.now()
                              }) as File;
                              const fileList = {
                                length: 1,
                                item: () => file,
                                [Symbol.iterator]: function* () { yield file; }
                              } as FileList;
                              handleFileSelect(fileList);
                              break;
                            }
                          }
                        }
                      }).catch(() => {
                        alert('Unable to access clipboard. Try using Ctrl+V instead.');
                      });
                      setShowAttachmentDropdown(false);
                    }}
                    className="w-full px-2 space-x-2 py-3 text-left hover:bg-surface-variant flex items-center text-on-surface transition-colors rounded-xl"
                  >
                    <Clipboard size={18} />
                    <span className="font-medium text-xs">Paste from Clipboard</span>
                  </button>
                  <div className="border-t border-outline-variant my-1" />
                  <button
                    onClick={() => handleAttachmentClick('file')}
                    className="w-full px-2 space-x-2 py-3 text-left hover:bg-surface-variant flex items-center text-on-surface transition-colors rounded-xl "
                  >
                    <File size={18} />
                    <span className="font-medium text-xs">File</span>
                  </button>
                  <button
                    onClick={() => handleAttachmentClick('image')}
                    className="w-full px-2 space-x-2 py-3 text-left hover:bg-surface-variant flex items-center text-on-surface transition-colors rounded-xl "
                  >
                    <Image size={18} />
                    <span className="font-medium text-xs">Photo</span>
                  </button>
                  <button
                    onClick={() => handleAttachmentClick('gif')}
                    className="w-full px-2 space-x-2 py-3 text-left hover:bg-surface-variant flex items-center text-on-surface transition-colors rounded-xl "
                  >
                    <FileImage size={18} />
                    <span className="font-medium text-xs">GIF</span>
                  </button>
                  <div className="px-2 py-2 text-xs text-on-surface-variant border-t border-outline-variant mt-2">
                    Max 3GB per file • Drag & drop or Ctrl+V supported
                  </div>
                </div>
              )}
            </div>

            <div className="w-px h-6 bg-outline-variant mx-2" />

            <ActionButton icon="format_bold" title="Bold" />
            <ActionButton icon="format_italic" title="Italic" />
            <ActionButton icon="code" title="Code" />
          </div>

          <div className="flex items-center gap-2">
            {/* Emoji Picker */}
            <div className="relative">
              <ActionButton
                icon="sentiment_satisfied"
                title="Add emoji"
                onClick={() => {
                  console.log('Emoji button clicked, current state:', showEmojiPicker);
                  setShowEmojiPicker(!showEmojiPicker);
                }}
                active={showEmojiPicker}
              />
              <CustomEmojiPicker
                isOpen={showEmojiPicker}
                onEmojiSelect={handleEmojiSelect}
                onClose={() => setShowEmojiPicker(false)}
              />
            </div>

            {/* Send Button */}
            <button
              onClick={handleSend}
              disabled={
                (!message.trim() && attachments.length === 0) ||
                attachments.some(att => att.uploadStatus === 'uploading') ||
                attachments.some(att => att.uploadStatus === 'error')
              }
              className="flex items-center justify-center w-12 h-12 rounded-full bg-primary hover:bg-primary/90 text-on-primary shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface-variant disabled:text-on-surface-variant"
              title={
                attachments.some(att => att.uploadStatus === 'uploading') 
                  ? 'Uploading files...' 
                  : attachments.some(att => att.uploadStatus === 'error')
                  ? 'Fix upload errors before sending'
                  : 'Send message'
              }
            >
              {attachments.some(att => att.uploadStatus === 'uploading') ? (
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send size={20} />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
      />
      <input
        ref={imageInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files, 'image')}
      />
      <input
        ref={gifInputRef}
        type="file"
        multiple
        accept="image/gif"
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files, 'gif')}
      />

      <div className="mt-2 text-right">
        <span className="label-small text-on-surface-variant">
          <strong>Enter</strong> to send, <strong>Shift + Enter</strong> for new line, <strong>Ctrl + V</strong> to paste files
          {attachments.length > 0 && (
            <>
              <span className="ml-2">• {attachments.length} file{attachments.length > 1 ? 's' : ''} attached</span>
              {(() => {
                const uploading = attachments.filter(att => att.uploadStatus === 'uploading').length;
                const completed = attachments.filter(att => att.uploadStatus === 'completed').length;
                const errors = attachments.filter(att => att.uploadStatus === 'error').length;
                
                if (uploading > 0) {
                  return <span className="ml-2 text-primary">• Uploading {uploading} file{uploading > 1 ? 's' : ''}...</span>;
                } else if (errors > 0) {
                  return <span className="ml-2 text-error">• {errors} upload error{errors > 1 ? 's' : ''}</span>;
                } else if (completed === attachments.length && completed > 0) {
                  return <span className="ml-2 text-green-600">• All files uploaded</span>;
                }
                return null;
              })()}
            </>
          )}
        </span>
      </div>
    </div>
  )
}

function ActionButton({ icon, title, onClick, active }: { icon: string; title: string; onClick?: () => void; active?: boolean }) {
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'format_bold': return Bold;
      case 'format_italic': return Italic;
      case 'code': return Code;
      case 'sentiment_satisfied': return Smile;
      case 'add_circle': return PlusCircle;
      default: return PlusCircle;
    }
  };

  const IconComponent = getIcon(icon);

  return (
    <button
      className={`p-2 rounded-full transition-colors ${active
        ? 'bg-primary-container text-on-primary-container'
        : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant'
        }`}
      title={title}
      onClick={onClick}
    >
      <IconComponent size={20} />
    </button>
  )
}