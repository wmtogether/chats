import React from 'react'
import { Smile, Reply, Image as ImageIcon } from 'lucide-react'
import Avatar from './Avatar'
import MessageContent from './MessageContent'

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
}

export default function MessageBubble({ data, searchQuery }: MessageBubbleProps) {
  const handleImageClick = (imageUrl: string) => {
    // Open image in a new window/tab for preview
    window.open(imageUrl, '_blank');
  };

  const isImageFile = (url: string) => {
    return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(url);
  };

  return (
    <div className={`group flex gap-4 p-2 -ml-2 rounded-lg hover:bg-surface/40 transition-colors ${data.isHighlighted ? 'bg-primary/5 border border-primary/10' : ''}`}>
      <div className="mt-1">
        <Avatar user={data.user} />
      </div>
      <div className="flex flex-1 flex-col items-start gap-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="title-small text-on-surface hover:underline cursor-pointer">{data.user.name}</span>
          <span className="body-small text-on-surface-variant">{data.time}</span>
        </div>
        
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
                ? `http://localhost:8640${attachment}`
                : attachment;

              if (isImageFile(attachment)) {
                return (
                  <div key={index} className="relative group/image">
                    <img
                      src={imageUrl}
                      alt={`Attachment ${index + 1}`}
                      className="max-w-full max-h-96 rounded-lg border border-outline shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => handleImageClick(imageUrl)}
                      loading="lazy"
                      onError={(e) => {
                        // Fallback if image fails to load
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const fallback = target.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                    {/* Fallback for failed images */}
                    <div 
                      className="hidden items-center gap-2 p-3 bg-surface-variant/50 border border-outline rounded-lg text-on-surface-variant"
                      style={{ display: 'none' }}
                    >
                      <ImageIcon className="h-4 w-4" />
                      <span className="body-small">ไม่สามารถโหลดรูปภาพได้</span>
                    </div>
                  </div>
                );
              } else {
                // Non-image attachments
                return (
                  <div key={index} className="flex items-center gap-2 p-2 bg-surface-variant/30 border border-outline rounded-lg">
                    <ImageIcon className="h-4 w-4 text-on-surface-variant" />
                    <a 
                      href={imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="body-small text-primary hover:underline truncate"
                    >
                      {attachment.split('/').pop() || 'ไฟล์แนบ'}
                    </a>
                  </div>
                );
              }
            })}
          </div>
        )}

        {/* Progress Card Attachment */}
        {data.meta?.type === 'progress' && (
          <div className="mt-2 p-3 bg-surface border border-outline rounded-lg max-w-sm w-full select-none">
            <div className="flex items-center justify-between mb-2">
              <span className="label-medium text-on-surface-variant uppercase tracking-wider">{data.meta.label}</span>
              <span className="label-medium text-on-surface">{data.meta.current} / {data.meta.total}</span>
            </div>
            <div className="w-full bg-surface-variant rounded-full h-2 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-primary to-tertiary h-2 rounded-full" 
                style={{ width: `${data.meta.percentage}%` }} 
              />
            </div>
          </div>
        )}

        {/* Reactions */}
        {data.reactions && data.reactions.length > 0 && (
          <div className="mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface border border-outline body-small text-on-surface cursor-pointer hover:bg-surface-variant">
            {data.reactions.map((r, i) => (
              <React.Fragment key={i}>
                <span>{r.emoji}</span>
                <span className="text-on-surface-variant">{r.count}</span>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Message Actions */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-surface border border-outline rounded-lg shadow-sm flex items-center -mt-4 p-1 h-8">
        <button className="p-1 hover:bg-surface-variant rounded text-on-surface-variant hover:text-on-surface" title="Add reaction">
          <Smile size={18} />
        </button>
        <button className="p-1 hover:bg-surface-variant rounded text-on-surface-variant hover:text-on-surface" title="Reply">
          <Reply size={18} />
        </button>
      </div>
    </div>
  )
}