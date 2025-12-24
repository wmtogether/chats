import Icon from './Icon'

export default function StickyStatus() {
  return (
    <div className="sticky top-0 z-20 px-6 pt-6 pb-8 bg-gradient-to-b from-background via-background to-transparent pointer-events-none select-none">
      <div className="pointer-events-auto relative overflow-hidden rounded-xl bg-surface border border-outline shadow-[0_8px_30px_rgb(0,0,0,0.12)]  flex items-center justify-between p-4 group">
        <div className="absolute inset-0 bg-gradient-to-r from-tertiary/5 to-transparent pointer-events-none" />
        <div className="flex items-center gap-4 relative z-10">
          <div className="size-12 rounded-full bg-tertiary/10 flex items-center justify-center shrink-0 border border-tertiary/20">
            <Icon name="trending_up" className="text-tertiary" size={24} />
          </div>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <h3 className="title-medium text-on-surface">Target Reached: 85%</h3>
                          <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-tertiary" />
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 body-small text-on-surface-variant">
                          <Icon name="schedule" size={14} />              <span>Updated by Lisa M. • 1h ago</span>
            </div>
          </div>
        </div>
        <button className="relative z-10 hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-variant hover:bg-surface-variant label-medium text-on-surface border border-outline transition-all hover:border-outline">
          <span>Update Status</span>
          <Icon name="expand_more" size={16} />
        </button>
      </div>
    </div>
  )
}