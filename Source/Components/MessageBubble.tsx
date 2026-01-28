import React, { useState } from 'react'
import { Smile, Reply, Image as ImageIcon, MoreHorizontal, Copy, Edit, Trash2, MapPin } from 'lucide-react'
import Avatar from './Avatar'
import MessageContent from './MessageContent'
import ImageAttachment from './ImageAttachment'
import CustomEmojiPicker from './EmojiPicker'
import { showConfirmDialog, showInputDialog } from '../Library/Native/dialog'

interface User {
  id: string
  name: string
  avatarUrl?: string
  initial?: string
  color?: string
}

interface MessageData {
  id: string
  user: User
  time: string
  content: string
  attachments?: string[]
  reactions?: { emoji: string; count: number; active?: boolean }[]
  isHighlighted?: boolean
  editedAt?: string
  replyTo?: {
    messageId: string
    userName: string
    content: string
  }
  meta?: {
    type: 'progress'
    label: string
    current: string
    total: string
    percentage: number
  }
}

interface MessageBubbleProps {
  data: MessageData
  searchQuery?: string
  onReply?: (messageId: string, userName: string, content: string) => void
  onReaction?: (messageId: string, emoji: string) => void
  onEdit?: (messageId: string, newContent: string, attachments?: string[]) => void
  onDelete?: (messageId: string) => void
}

export default function MessageBubble({ data, searchQuery, onReply, onReaction, onEdit, onDelete }: MessageBubbleProps) {
  const [showActions, setShowActions] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Check if this is a checkpoint message
  const isCheckpoint = data.content === '---CHECKPOINT---';

  const handleImageClick = (imageUrl: string) => {
    // Open image in a new window/tab for preview
    window.open(imageUrl, '_blank');
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

  const handleDeleteMessage = async () => {
    if (onDelete) {
      // Use native confirmation dialog instead of browser confirm
      const confirmed = await showConfirmDialog({
        title: 'Delete Message',
        message: 'Are you sure you want to delete this message? This action cannot be undone.',
        okText: 'Delete',
        cancelText: 'Cancel'
      });
      if (confirmed) {
        onDelete(data.id);
      }
    }
    setShowMoreMenu(false);
  };

  const quickReactions = ['👍', '❤️', '😂', '😮', '😢', '😡'];

  // If this is a checkpoint message, render it differently
  if (isCheckpoint) {
    return (
      <div className="flex items-center justify-center py-6 px-4">
        <div className="flex items-center gap-4 w-full max-w-md">
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
      className={`group flex gap-4 p-3 -mx-3 rounded-2xl hover:bg-surface-container/40 transition-all duration-200 ${
        data.isHighlighted ? 'bg-primary-container/20 border border-primary/20' : ''
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
      <div className="mt-1">
        <Avatar user={data.user} />
      </div>
      
      <div className="flex flex-1 flex-col items-start gap-2 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="title-small text-on-surface hover:underline cursor-pointer font-medium">
            {data.user.name}
          </span>
          <span className="body-small text-on-surface-variant">
            {data.time}
          </span>
          {data.editedAt && (
            <span className="body-small text-on-surface-variant italic">
              (edited)
            </span>
          )}
        </div>

        {/* Reply Reference */}
        {data.replyTo && (
          <div className="flex items-center gap-2 px-3 py-2 bg-surface-variant/30 border-l-4 border-primary rounded-r-xl max-w-md">
            <Reply size={14} className="text-on-surface-variant flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-medium text-primary">
                {data.replyTo.userName}
              </div>
              <div className="text-sm text-on-surface-variant truncate">
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

        {/* Image Attachments */}
        {data.attachments && data.attachments.length > 0 && (
          <div className="mt-2 space-y-2 max-w-md">
            {data.attachments.map((attachment, index) => {
              // Convert relative paths to full URLs through proxy
              const imageUrl = attachment.startsWith('/api/image/') 
                ? `http://localhost:5669${attachment}`
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
                return (
                  <div key={index} className="flex items-center gap-3 p-3 bg-surface-container border border-outline-variant rounded-2xl">
                    <ImageIcon className="h-5 w-5 text-on-surface-variant" />
                    <a 
                      href={imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="body-small text-primary hover:underline truncate flex-1"
                    >
                      {attachment.split('/').pop() || 'File attachment'}
                    </a>
                  </div>
                );
              }
            })}
          </div>
        )}

        {/* Progress Card Attachment */}
        {data.meta?.type === 'progress' && (
          <div className="mt-2 p-4 bg-surface-container border border-outline-variant rounded-2xl max-w-sm w-full select-none">
            <div className="flex items-center justify-between mb-3">
              <span className="label-medium text-on-surface-variant uppercase tracking-wider">
                {data.meta.label}
              </span>
              <span className="label-medium text-on-surface font-medium">
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
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full body-small transition-all duration-200 ${
                  reaction.active
                    ? 'bg-primary-container text-on-primary-container border border-primary'
                    : 'bg-surface-container hover:bg-surface-variant border border-outline-variant text-on-surface'
                }`}
              >
                <span className="text-base">{reaction.emoji}</span>
                <span className="font-medium">{reaction.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Message Actions */}
      <div className={`flex items-start transition-all duration-200 ${
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
                  onClick={handleDeleteMessage}
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
    </div>
  )
}