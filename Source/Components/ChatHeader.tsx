import Icon from './Icon'

export default function ChatHeader() {
  return (
    <header className="h-16 flex items-center justify-between px-6 border-b border-outline bg-surface/80 backdrop-blur-md z-30 shrink-0 sticky top-0">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 text-on-surface">
          <Icon name="subdirectory_arrow_right" className="text-on-surface-variant rotate-180" size={20} />
          <h2 className="title-large">Q4 Targets</h2>
        </div>
        <div className="h-4 w-px bg-surface-variant mx-1" />
        <p className="body-medium text-on-surface-variant truncate max-w-[300px]">
          Thread in <span className="title-small text-on-surface">#enterprise-leads</span>
        </p>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex -space-x-2">
          <div className="size-8 rounded-full border-2 border-background bg-primary text-on-primary flex items-center justify-center label-medium relative z-10" title="Lisa M.">
            L
          </div>
          <div className="size-8 rounded-full border-2 border-background bg-tertiary text-on-tertiary flex items-center justify-center label-medium relative z-0" title="Mike R.">
            M
          </div>
          <div className="size-8 rounded-full border-2 border-background bg-surface text-on-surface-variant flex items-center justify-center label-medium relative z-0">
            +2
          </div>
        </div>
        <div className="w-px h-6 bg-surface-variant" />
        <button className="text-on-surface-variant hover:text-on-surface transition-colors">
          <Icon name="search" />
        </button>
        <button className="text-on-surface-variant hover:text-on-surface transition-colors">
          <Icon name="side_navigation" />
        </button>
      </div>
    </header>
  )
}