import { useState, useMemo } from 'react'
import { ArrowLeft, Search, SearchX, Palette, Ruler, CheckCircle, Settings, Eye, Package, Briefcase } from 'lucide-react'
import { type Thread } from '../Library/Shared/threadsApi'

type Chat = Thread

interface AllChatsProps {
  chats: Chat[];
  onChatSelect: (chat: Chat) => void;
  onBack: () => void;
  selectedChatId?: number;
  isLoading?: boolean;
}

export default function AllChats({ chats: allChats, onChatSelect, onBack, selectedChatId, isLoading = false }: AllChatsProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGroup, setSelectedGroup] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'name'>('updated')

  // Filter and process chats
  const validChats = allChats.filter((chat) => chat.metadata !== null)
  
  // Group chats by creator
  const chatGroups = useMemo(() => {
    return validChats.reduce((groups: Record<string, Chat[]>, chat) => {
      const creatorName = chat.metadata?.createdByName || chat.createdByName;
      if (!groups[creatorName]) {
        groups[creatorName] = [];
      }
      groups[creatorName].push(chat);
      return groups;
    }, {});
  }, [validChats])

  // Filter chats based on search and group selection
  const filteredChats = useMemo(() => {
    let chats = selectedGroup === 'all' ? validChats : chatGroups[selectedGroup] || []
    
    if (searchQuery) {
      chats = chats.filter(chat => 
        chat.channelName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        chat.metadata?.createdByName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        chat.metadata?.requestType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        chat.metadata?.queueStatus.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Sort chats
    return chats.sort((a, b) => {
      switch (sortBy) {
        case 'updated':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        case 'created':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        case 'name':
          return a.channelName.localeCompare(b.channelName)
        default:
          return 0
      }
    })
  }, [validChats, chatGroups, selectedGroup, searchQuery, sortBy])

  const getRequestTypeIcon = (requestType: string) => {
    switch (requestType) {
      case 'design': return Palette
      case 'dimension': return Ruler
      case 'checkfile': return CheckCircle
      case 'adjustdesign': return Settings
      case 'proof': return Eye
      case 'sample-i': 
      case 'sample-t': return Package
      default: return Briefcase
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'text-yellow-600 bg-yellow-500/10'
      case 'IN_PROGRESS': return 'text-blue-600 bg-blue-500/10'
      case 'COMPLETED': return 'text-green-600 bg-green-500/10'
      case 'CANCELLED': return 'text-red-600 bg-red-500/10'
      default: return 'text-on-surface-variant bg-surface-variant/10'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleChatClick = (chat: Chat) => {
    onChatSelect(chat)
    onBack() // Go back to main view after selecting a chat
  }

  // Skeleton Loading Components
  const ChatSkeleton = () => (
    <div className="flex items-center gap-4 p-4 rounded-lg border border-outline animate-pulse">
      {/* Icon skeleton */}
      <div className="flex-shrink-0">
        <div className="size-10 rounded-full bg-surface-variant"></div>
      </div>
      
      {/* Content skeleton */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between mb-2">
          <div className="h-4 bg-surface-variant rounded w-3/4"></div>
          <div className="h-3 bg-surface-variant rounded w-16"></div>
        </div>
        
        <div className="flex items-center gap-3 mb-2">
          <div className="h-3 bg-surface-variant rounded w-20"></div>
          <div className="h-3 bg-surface-variant rounded w-12"></div>
        </div>

        <div className="flex items-center gap-2">
          <div className="h-6 bg-surface-variant rounded w-20"></div>
          <div className="h-3 bg-surface-variant rounded w-16"></div>
        </div>
      </div>
    </div>
  )

  const FiltersSkeleton = () => (
    <div className="flex flex-col gap-4 p-6 border-b border-outline animate-pulse">
      {/* Search skeleton */}
      <div className="relative">
        <div className="w-full h-10 bg-surface-variant rounded-lg"></div>
      </div>

      {/* Filters skeleton */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="h-4 bg-surface-variant rounded w-12"></div>
          <div className="h-8 bg-surface-variant rounded w-32"></div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 bg-surface-variant rounded w-8"></div>
          <div className="h-8 bg-surface-variant rounded w-28"></div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col h-full bg-surface w-screen">
      {/* Header */}
      <div className="flex items-center gap-4 p-6 border-b border-outline">
        <button
          onClick={onBack}
          className="flex items-center justify-center size-10 rounded-lg hover:bg-surface-variant transition-colors"
        >
          <ArrowLeft size={20} className="text-on-surface" />
        </button>
        <div className="flex-1">
          <h1 className="title-large text-on-surface">All Chats</h1>
          {isLoading ? (
            <div className="h-4 bg-surface-variant rounded w-24 animate-pulse"></div>
          ) : (
            <p className="body-medium text-on-surface-variant">
              {filteredChats.length} of {validChats.length} chats
            </p>
          )}
        </div>
      </div>

      {/* Filters and Search */}
      {isLoading ? (
        <FiltersSkeleton />
      ) : (
        <div className="flex flex-col gap-4 p-6 border-b border-outline">
          {/* Search */}
          <div className="relative">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface-variant rounded-lg border border-outline focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-variant"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4 flex-wrap">
            {/* Group Filter */}
            <div className="flex items-center gap-2">
              <span className="label-medium text-on-surface-variant">Group:</span>
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="px-3 py-1.5 bg-surface-variant rounded-lg border border-outline text-on-surface label-medium focus:border-primary focus:outline-none"
              >
                <option value="all">All Groups</option>
                {Object.keys(chatGroups).map(group => (
                  <option key={group} value={group}>{group} ({chatGroups[group].length})</option>
                ))}
              </select>
            </div>

            {/* Sort Filter */}
            <div className="flex items-center gap-2">
              <span className="label-medium text-on-surface-variant">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'updated' | 'created' | 'name')}
                className="px-3 py-1.5 bg-surface-variant rounded-lg border border-outline text-on-surface label-medium focus:border-primary focus:outline-none"
              >
                <option value="updated">Last Updated</option>
                <option value="created">Date Created</option>
                <option value="name">Name</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-6">
            <div className="grid gap-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <ChatSkeleton key={index} />
              ))}
            </div>
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <SearchX size={48} className="text-on-surface-variant mb-4" />
            <h3 className="title-medium text-on-surface mb-2">No chats found</h3>
            <p className="body-medium text-on-surface-variant">
              Try adjusting your search or filter criteria
            </p>
          </div>
        ) : (
          <div className="p-6">
            <div className="grid gap-3">
              {filteredChats.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => handleChatClick(chat)}
                  className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-all hover:bg-surface-variant/50 ${
                    selectedChatId === chat.id 
                      ? 'bg-primary/10 border-primary' 
                      : 'border-outline hover:border-outline'
                  }`}
                >
                  {/* Icon */}
                  <div className="flex-shrink-0">
                    <div className="size-10 rounded-full bg-surface-variant border border-outline flex items-center justify-center">
                      {(() => {
                        const IconComponent = getRequestTypeIcon(chat.metadata?.requestType || 'unknown');
                        return <IconComponent size={20} className="text-on-surface-variant" />;
                      })()}
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="title-small text-on-surface truncate pr-4">
                        {chat.channelName}
                      </h3>
                      <span className="label-small text-on-surface-variant flex-shrink-0">
                        {formatDate(chat.updatedAt)}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3 mb-2">
                      <span className="label-small text-on-surface-variant">
                        by {chat.metadata?.createdByName || chat.createdByName}
                      </span>
                      <span className="label-small text-on-surface-variant">
                        #{chat.metadata?.queueId || 'N/A'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`label-small px-2 py-1 rounded-md ${getStatusColor(chat.metadata?.queueStatus || 'UNKNOWN')}`}>
                        {chat.metadata?.queueStatus || 'UNKNOWN'}
                      </span>
                      <span className="label-small text-on-surface-variant capitalize">
                        {chat.metadata?.requestType?.replace('-', ' ') || 'Unknown'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}