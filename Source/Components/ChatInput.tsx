import Icon from './Icon'

export default function ChatInput() {
  return (
    <div className="p-4 bg-background shrink-0">
      <div className="bg-surface border border-outline rounded-xl shadow-lg flex flex-col focus-within:ring-1 focus-within:ring-primary/50 focus-within:border-primary/50 transition-all">
        <div className="flex p-3">
          <input 
            className="w-full bg-transparent border-none text-on-surface placeholder-on-surface-variant body-medium p-0 focus:ring-0 resize-none leading-normal outline-none" 
            placeholder="Reply to thread..." 
          />
        </div>
        <div className="flex items-center justify-between px-3 pb-2">
          <div className="flex items-center gap-1">
            <ActionButton icon="add_circle" title="Attach file" />
            <div className="w-px h-4 bg-outline mx-1" />
            <ActionButton icon="format_bold" title="Bold" />
            <ActionButton icon="format_italic" title="Italic" />
            <ActionButton icon="code" title="Code" />
          </div>
          <div className="flex items-center gap-2">
            <ActionButton icon="sentiment_satisfied" title="Emoji" />
            <button className="flex items-center justify-center size-8 rounded-lg bg-primary hover:bg-primary-container text-on-primary shadow-md transition-colors">
              <Icon name="send" size={18} />
            </button>
          </div>
        </div>
      </div>
      <div className="mt-2 text-right">
        <span className="label-small text-on-surface-variant">
          <strong>Enter</strong> to send, <strong>Shift + Enter</strong> for new line
        </span>
      </div>
    </div>
  )
}

function ActionButton({ icon, title }: { icon: string; title: string }) {
  return (
    <button className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded transition-colors" title={title}>
      <Icon name={icon} size={20} />
    </button>
  )
}