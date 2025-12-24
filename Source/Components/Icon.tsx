import * as LucideIcons from 'lucide-react'

interface IconProps {
  name: string
  className?: string
  size?: number
}

// Map material icons to lucide icons
const iconMap: Record<string, keyof typeof LucideIcons> = {
  'expand_more': 'ChevronDown',
  'add': 'Plus',
  'tag': 'Hash',
  'lock': 'Lock',
  'subdirectory_arrow_right': 'CornerDownRight',
  'settings': 'Settings',
  'search': 'Search',
  'side_navigation': 'Menu',
  'add_reaction': 'Smile',
  'reply': 'Reply',
  'add_circle': 'PlusCircle',
  'format_bold': 'Bold',
  'format_italic': 'Italic',
  'code': 'Code',
  'sentiment_satisfied': 'Smile',
  'send': 'Send',
  'trending_up': 'TrendingUp',
  'schedule': 'Clock'
}

export default function Icon({ name, className = "", size = 18 }: IconProps) {
  const IconComponent = LucideIcons[iconMap[name] || 'HelpCircle'] as React.ComponentType<{ size?: number; className?: string }>
  
  return <IconComponent size={size} className={className} />
}