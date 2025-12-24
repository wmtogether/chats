interface User {
  id: string
  name: string
  avatarUrl?: string
  initial?: string
  color?: string
}

interface AvatarProps {
  user: User
  size?: string
  className?: string
}

export default function Avatar({ user, size = "size-10", className = "" }: AvatarProps) {
  if (user.avatarUrl) {
    return (
      <div 
        className={`bg-center bg-no-repeat bg-cover rounded-lg ${size} shrink-0 shadow-sm ${className}`}
        style={{ backgroundImage: `url("${user.avatarUrl}")` }}
      />
    )
  }
  
  return (
    <div className={`${user.color || 'bg-surface-variant'} rounded-lg ${size} shrink-0 shadow-sm flex items-center justify-center text-on-surface title-medium ${className}`}>
      {user.initial || user.name[0]}
    </div>
  )
}