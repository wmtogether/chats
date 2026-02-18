import React, { useState } from 'react'
import { Smile, Reply, MoreHorizontal, Copy, Edit, Trash2, MapPin } from 'lucide-react'
import Avatar from './Avatar'
import MessageContent from './MessageContent'
import ImageAttachment from './ImageAttachment'
import CustomEmojiPicker from './EmojiPicker'
import { showInputDialog } from '../Library/Native/dialog' // Keep showInputDialog for now
import ConfirmDialog from './ui/ConfirmDialog'
import { useToast } from '../Library/hooks/useToast.tsx'
import { useDownload } from '../Library/hooks/useDownload'
import { getApiUrl } from '../Library/utils/env'
import type { MessageBubbleData } from '../Library/types' // Import shared types
import { ProofMetaCard, FileAttachmentCard } from './MetaCards'

interface MessageBubbleProps {
  data: MessageBubbleData // Use imported MessageBubbleData
  searchQuery?: string
  isNewMessage?: boolean // Add prop for indicating new real-time messages
  onReply?: (messageId: string, userName: string, content: string) => void
  onReaction?: (messageId: string, emoji: string) => void
  onEdit?: (messageId: string, newContent: string, attachments?: string[]) => void
  onDelete?: (messageId: string) => void
}

export default function MessageBubble({ data, searchQuery, isNewMessage = false, onReply, onReaction, onEdit, onDelete }: MessageBubbleProps) {
  const [showActions, setShowActions] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false); // New state
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null); // New state
  const { addToast } = useToast(); // Initialize useToast
  const { startDownload } = useDownload();

  // Check if this is a checkpoint message
  const isCheckpoint = data.content === '---CHECKPOINT---';

  const handleImageClick = (imageUrl: string) => {
    // Open image in a new window/tab for preview
    window.open(imageUrl, '_blank');
  };

  // Handle file download - direct IPC, no web requests
  const handleFileDownload = async (fileUrl: string, filename: string) => {
    try {
      console.log('Starting direct file download (no web requests):', fileUrl, '->', filename);
      
      // Use direct download API - bypasses CORS/fetch entirely
      await startDownload(fileUrl, filename);
      addToast({ message: `Download started: ${filename}`, type: 'info' });
      
      console.log('Direct file download initiated successfully');
    } catch (error) {
      console.error('Failed to start direct download:', error);
      addToast({ message: `Failed to start download: ${filename}`, type: 'error' });
      
      // Fallback: create download link (browser environment only)
      console.log('Fallback: creating download link for browser');
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = filename;
      link.target = '_blank';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const isImageFile = (url: string) => {
    return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(url);
  };

  const handleReply = () => {
    if (onReply) {
      onReply(data.id, data.user.name, data.content);
    }
  };

  const handleQuickReaction = (emoji: string, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (onReaction) {
      onReaction(data.id, emoji);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    handleQuickReaction(emoji);
    setShowEmojiPicker(false);
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(data.content).then(() => {
      console.log('✅ Message copied to clipboard');
    }).catch((error) => {
      console.error('❌ Failed to copy message:', error);
    });
    setShowMoreMenu(false);
  };

  const handleEditMessage = async () => {
    if (onEdit) {
      // Use native input dialog instead of browser prompt
      const newContent = await showInputDialog('Edit Message', 'Edit your message:', data.content);
      if (newContent !== null && newContent.trim() !== data.content) {
        onEdit(data.id, newContent.trim(), data.attachments);
      }
    }
    setShowMoreMenu(false);
  };

  const handleDeleteMessageClick = () => { // Renamed to clearly differentiate from prop
    setMessageToDelete(data.id);
    setShowDeleteConfirm(true);
    setShowMoreMenu(false); // Close the more menu when opening the dialog
  };

  const handleConfirmDeleteMessage = () => {
    if (onDelete && messageToDelete) {
      onDelete(messageToDelete);
      // Toast notification is handled by the parent component
    }
    setMessageToDelete(null);
    setShowDeleteConfirm(false);
  };

  const quickReactions = ['👍', '❤️', '😂', '😮', '😢', '😡'];

  // If this is a checkpoint message, render it differently
  if (isCheckpoint) {
    return (
      <div className="flex items-center justify-center py-6 px-4">
        <div className="flex items-center gap-4 w-full ">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-outline-variant to-outline-variant"></div>
          <div className="flex items-center gap-3 px-4 py-2 bg-surface-container border border-outline-variant rounded-full shadow-sm">
            <MapPin size={16} className="text-primary" />
            <span className="text-sm font-medium text-on-surface-variant uppercase tracking-wider">
              Checkpoint
            </span>
            <span className="text-xs text-on-surface-variant">
              {data.time}
            </span>
          </div>
          <div className="flex-1 h-px bg-gradient-to-l from-transparent via-outline-variant to-outline-variant"></div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`group flex gap-2 sm:gap-4 p-2 sm:p-3 -mx-2 sm:-mx-3 rounded-2xl hover:bg-surface-container/40 transition-all duration-200 ${
        data.isHighlighted ? 'bg-primary-container/20 border border-primary/20' : ''
      } ${
        isNewMessage ? 'animate-pulse bg-primary-container/10' : ''
      }`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={(e) => {
        // Only hide actions if we're not moving to a child element
        const relatedTarget = e.relatedTarget as HTMLElement;
        if (!e.currentTarget.contains(relatedTarget)) {
          setShowActions(false);
          setShowMoreMenu(false);
          setShowEmojiPicker(false);
        }
      }}
    >
      <div className="mt-1 flex-shrink-0">
        <Avatar user={data.user} />
      </div>
      
      <div className="flex flex-1 flex-col items-start gap-1 sm:gap-2 min-w-0">
        <div className="flex items-baseline gap-1 sm:gap-2 flex-wrap">
          <span className="title-small text-on-surface hover:underline cursor-pointer font-medium text-sm sm:text-base">
            {data.user.name}
          </span>
          <span className="body-small text-on-surface-variant text-xs sm:text-sm">
            {data.time}
          </span>
          {data.isEdited === 1 && (
            <span className="body-small text-on-surface-variant italic text-xs sm:text-sm">
              (edited)
            </span>
          )}
        </div>

        {/* Reply Reference */}
        {data.replyTo && (
          <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-surface-variant/30 border-l-4 border-primary rounded-r-xl max-w-full sm:max-w-md w-full">
            <Reply size={14} className="text-on-surface-variant flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-primary">
                {data.replyTo.userName}
              </div>
              <div className="text-xs sm:text-sm text-on-surface-variant truncate">
                {data.replyTo.content}
              </div>
            </div>
          </div>
        )}
        
        <MessageContent 
          content={data.content}
          messageId={data.id}
          timestamp={data.time}
          userName={data.user.name}
          searchQuery={searchQuery}
        />

        {/* Image Attachments and Proof MetaCards */}
        {data.attachments && data.attachments.length > 0 && (
          <div className="mt-1 sm:mt-2 space-y-2 w-full max-w-full sm:max-w-md">
            {data.attachments.map((attachment, index) => {
              // Check if this is proof metadata (JSON string starting with {"type":"proof")
              if (attachment.startsWith('{"type":"proof"')) {
                try {
                  const proofData = JSON.parse(attachment);
                  console.log('Rendering ProofMetaCard with data:', proofData);
                  return (
                    <ProofMetaCard
                      key={index}
                      proofId={proofData.proofId}
                      runnerId={proofData.runnerId}
                      jobName={proofData.jobName}
                      customerName={proofData.customerName}
                      salesName={proofData.salesName}
                      proofStatus={proofData.proofStatus}
                      createdByName={proofData.createdByName}
                      createdAt={proofData.createdAt}
                    />
                  );
                } catch (error) {
                  console.error('Failed to parse proof metadata:', error);
                  return null;
                }
              }

              // Check if this is file attachment metadata (JSON string starting with {"type":"file_attachment")
              if (attachment.startsWith('{"type":"file_attachment"')) {
                try {
                  const fileData = JSON.parse(attachment);
                  console.log('Rendering FileAttachmentCard with data:', fileData);
                  return (
                    <FileAttachmentCard
                      key={index}
                      fileName={fileData.fileName}
                      filePath={fileData.filePath}
                    />
                  );
                } catch (error) {
                  console.error('Failed to parse file attachment metadata:', error);
                  return null;
                }
              }

              // Convert relative paths to full URLs
              const imageUrl = attachment.startsWith('/uploads/') 
                ? `${getApiUrl()}${attachment}`
                : attachment;

              if (isImageFile(attachment)) {
                return (
                  <ImageAttachment
                    key={index}
                    src={imageUrl}
                    alt={`Attachment ${index + 1}`}
                    onClick={() => handleImageClick(imageUrl)}
                  />
                );
              } else {
                // Non-image attachments
                const filename = attachment.split('/').pop() || 'File attachment';
                
                return (
                  <FileAttachmentCard
                    key={index}
                    src={imageUrl}
                    filename={filename}
                    onClick={() => handleFileDownload(imageUrl, filename)}
                  />
                );
              }
            })}
          </div>
        )}

        {/* Progress Card Attachment */}
        {data.meta?.type === 'progress' && (
          <div className="mt-1 sm:mt-2 p-3 sm:p-4 bg-surface-container border border-outline-variant rounded-2xl w-full max-w-full sm:max-w-sm select-none">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <span className="label-medium text-on-surface-variant uppercase tracking-wider text-xs sm:text-sm">
                {data.meta.label}
              </span>
              <span className="label-medium text-on-surface font-medium text-xs sm:text-sm">
                {data.meta.current} / {data.meta.total}
              </span>
            </div>
            <div className="w-full bg-surface-variant rounded-full h-2 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-primary to-tertiary h-2 rounded-full transition-all duration-300" 
                style={{ width: `${data.meta.percentage}%` }} 
              />
            </div>
          </div>
        )}

        {/* Reactions */}
        {data.reactions && data.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {data.reactions.map((reaction, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleQuickReaction(reaction.emoji);
                }}
                className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full body-small transition-all duration-200 text-xs sm:text-sm ${
                  reaction.active
                    ? 'bg-primary-container text-on-primary-container border border-primary'
                    : 'bg-surface-container hover:bg-surface-variant border border-outline-variant text-on-surface'
                }`}
              >
                <span className="text-sm sm:text-base">{reaction.emoji}</span>
                <span className="font-medium">{reaction.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Message Actions - Hidden on mobile, shown on hover on desktop */}
      <div className={`hidden sm:flex items-start transition-all duration-200 ${
        showActions ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2 pointer-events-none'
      }`}>
        <div className="flex items-center bg-surface-container border border-outline-variant rounded-2xl shadow-sm p-1">
          {/* Quick Reactions */}
          <div className="flex items-center">
            {quickReactions.slice(0, 3).map((emoji) => (
              <button
                key={emoji}
                onClick={(e) => handleQuickReaction(emoji, e)}
                className="p-2 hover:bg-surface-variant rounded-xl text-lg transition-colors"
                title={`React with ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
          
          <div className="w-px h-6 bg-outline-variant mx-1" />
          
          {/* Action Buttons */}
          <button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleReply();
            }}
            className="p-2 hover:bg-surface-variant rounded-xl text-on-surface-variant hover:text-on-surface transition-colors" 
            title="Reply"
          >
            <Reply size={18} />
          </button>
          
          <div className="relative">
            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Add reaction button clicked, current state:', showEmojiPicker);
                setShowEmojiPicker(!showEmojiPicker);
              }}
              className="p-2 hover:bg-surface-variant rounded-xl text-on-surface-variant hover:text-on-surface transition-colors" 
              title="Add reaction"
            >
              <Smile size={18} />
            </button>
            
            <CustomEmojiPicker
              isOpen={showEmojiPicker}
              onEmojiSelect={handleEmojiSelect}
              onClose={() => setShowEmojiPicker(false)}
            />
          </div>
          
          {/* More Menu */}
          <div className="relative">
            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowMoreMenu(!showMoreMenu);
              }}
              className="p-2 hover:bg-surface-variant rounded-xl text-on-surface-variant hover:text-on-surface transition-colors" 
              title="More options"
            >
              <MoreHorizontal size={18} />
            </button>
            
            {showMoreMenu && (
              <div className="absolute right-0 top-full mt-1 bg-surface-container border border-outline-variant rounded-2xl shadow-lg py-2 z-10 min-w-[160px]">
                <button 
                  onClick={handleCopyMessage}
                  className="w-full px-4 py-2 text-left hover:bg-surface-variant flex items-center gap-3 text-on-surface"
                >
                  <Copy size={16} />
                  <span className='text-xs'>Copy message</span>
                </button>
                <button 
                  onClick={handleEditMessage}
                  className="w-full px-4 py-2 text-left hover:bg-surface-variant flex items-center gap-3 text-on-surface"
                >
                  <Edit size={16} />
                  <span className='text-xs'>Edit message</span>
                </button>
                <div className="border-t border-outline-variant my-1" />
                <button 
                  onClick={handleDeleteMessageClick}
                  className="w-full px-4 py-2 text-left hover:bg-error-container flex items-center gap-3 text-error"
                >
                  <Trash2 size={16} />
                  <span className='text-xs'>Delete message</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Action Button - Only visible on mobile */}
      <div className="sm:hidden flex-shrink-0">
        <button 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowMoreMenu(!showMoreMenu);
          }}
          className="p-2 hover:bg-surface-variant rounded-xl text-on-surface-variant hover:text-on-surface transition-colors" 
          title="More options"
        >
          <MoreHorizontal size={18} />
        </button>
        
        {showMoreMenu && (
          <div className="absolute right-2 mt-1 bg-surface-container border border-outline-variant rounded-2xl shadow-lg py-2 z-10 min-w-[160px]">
            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleReply();
                setShowMoreMenu(false);
              }}
              className="w-full px-4 py-2 text-left hover:bg-surface-variant flex items-center gap-3 text-on-surface"
            >
              <Reply size={16} />
              <span className='text-xs'>Reply</span>
            </button>
            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowEmojiPicker(true);
                setShowMoreMenu(false);
              }}
              className="w-full px-4 py-2 text-left hover:bg-surface-variant flex items-center gap-3 text-on-surface"
            >
              <Smile size={16} />
              <span className='text-xs'>Add reaction</span>
            </button>
            <div className="border-t border-outline-variant my-1" />
            <button 
              onClick={handleCopyMessage}
              className="w-full px-4 py-2 text-left hover:bg-surface-variant flex items-center gap-3 text-on-surface"
            >
              <Copy size={16} />
              <span className='text-xs'>Copy message</span>
            </button>
            <button 
              onClick={handleEditMessage}
              className="w-full px-4 py-2 text-left hover:bg-surface-variant flex items-center gap-3 text-on-surface"
            >
              <Edit size={16} />
              <span className='text-xs'>Edit message</span>
            </button>
            <div className="border-t border-outline-variant my-1" />
            <button 
              onClick={handleDeleteMessageClick}
              className="w-full px-4 py-2 text-left hover:bg-error-container flex items-center gap-3 text-error"
            >
              <Trash2 size={16} />
              <span className='text-xs'>Delete message</span>
            </button>
          </div>
        )}
        
        {/* Mobile Emoji Picker */}
        <CustomEmojiPicker
          isOpen={showEmojiPicker}
          onEmojiSelect={handleEmojiSelect}
          onClose={() => setShowEmojiPicker(false)}
        />
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete Message"
        message="Are you sure you want to delete this message? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleConfirmDeleteMessage}
        onCancel={() => setMessageToDelete(null)}
      />
    </div>
  )
}