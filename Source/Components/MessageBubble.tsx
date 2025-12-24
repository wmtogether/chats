import React from 'react'
import Avatar from './Avatar'
import Icon from './Icon'

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
}

export default function MessageBubble({ data }: MessageBubbleProps) {
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
        
        <div className="body-medium text-on-surface leading-relaxed max-w-prose">
          {data.content}
        </div>

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
        {data.reactions && (
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
          <Icon name="add_reaction" size={18} />
        </button>
        <button className="p-1 hover:bg-surface-variant rounded text-on-surface-variant hover:text-on-surface" title="Reply">
          <Icon name="reply" size={18} />
        </button>
      </div>
    </div>
  )
}