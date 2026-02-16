import { useState, useEffect, useRef } from 'react';
import { Search, X, ArrowUp, ArrowDown, Calendar, User, FileText, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../Library/hooks/useToast';
import { getApiUrl } from '../Library/utils/env';

const API_BASE_URL = getApiUrl();

interface Message {
  id: number;
  messageId: string;
  content: string;
  userName: string;
  userRole: string;
  createdAt: string;
  attachments?: string[];
}

interface SearchMessagesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  chatUuid: string;
  chatName: string;
  onMessageSelect?: (messageId: string) => void;
}

export default function SearchMessagesDialog({
  isOpen,
  onClose,
  chatUuid,
  chatName,
  onMessageSelect,
}: SearchMessagesDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<Message[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  const { addToast } = useToast();

  // Focus search input when dialog opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
      setSearchQuery('');
      setResults([]);
      setHasSearched(false);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && results.length > 0) {
        e.preventDefault();
        handleSelectMessage(results[selectedIndex]);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (resultsContainerRef.current && results.length > 0) {
      const selectedElement = resultsContainerRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex, results]);

  const searchMessages = async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('No authentication token found');
      }

      console.log('Searching messages:', {
        chatUuid,
        query,
        url: `${API_BASE_URL}/api/chats/${chatUuid}/messages/search?q=${encodeURIComponent(query)}`
      });

      const response = await fetch(
        `${API_BASE_URL}/api/chats/${chatUuid}/messages/search?q=${encodeURIComponent(query)}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('Search response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Search error response:', errorText);
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Search response:', data);
      
      // Backend returns data in APIResponse format: { success, data: { messages, count, query } }
      const messages = data.data?.messages || data.messages || [];
      console.log('Search results:', messages);
      
      setResults(messages);
      setSelectedIndex(0);
    } catch (error) {
      console.error('Search error:', error);
      addToast({
        message: error instanceof Error ? error.message : 'Failed to search messages',
        type: 'error',
      });
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    // Debounce search
    const timeoutId = setTimeout(() => {
      searchMessages(value);
    }, 300);

    return () => clearTimeout(timeoutId);
  };

  const handleSelectMessage = (message: Message) => {
    if (onMessageSelect) {
      onMessageSelect(message.messageId);
    }
    onClose();
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;

    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className="bg-primary/30 text-primary rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

      if (diffInHours < 24) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (diffInHours < 48) {
        return 'Yesterday';
      } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }
    } catch {
      return '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -20 }}
        transition={{ duration: 0.2 }}
        className="bg-surface border border-outline-variant rounded-3xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-outline-variant">
          <div className="p-2 rounded-full bg-primary/10">
            <Search className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="title-medium text-on-surface">Search Messages</h2>
            <p className="body-small text-on-surface-variant">{chatName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-variant rounded-full transition-colors"
          >
            <X size={20} className="text-on-surface-variant" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-outline-variant">
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2">
              {isSearching ? (
                <Loader2 size={20} className="text-primary animate-spin" />
              ) : (
                <Search size={20} className="text-on-surface-variant" />
              )}
            </div>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-surface-container border border-outline-variant rounded-full outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all body-medium text-on-surface placeholder-on-surface-variant"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setResults([]);
                  setHasSearched(false);
                  searchInputRef.current?.focus();
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-surface-variant rounded-full transition-colors"
              >
                <X size={16} className="text-on-surface-variant" />
              </button>
            )}
          </div>

          {/* Search Stats */}
          {hasSearched && (
            <div className="flex items-center justify-between mt-3 px-2">
              <div className="body-small text-on-surface-variant">
                {isSearching ? (
                  'Searching...'
                ) : results.length === 0 ? (
                  'No messages found'
                ) : (
                  `${results.length} message${results.length !== 1 ? 's' : ''} found`
                )}
              </div>
              {results.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="body-small text-on-surface-variant">
                    {selectedIndex + 1} of {results.length}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setSelectedIndex(prev => Math.max(prev - 1, 0))}
                      disabled={selectedIndex === 0}
                      className="p-1 rounded hover:bg-surface-variant disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Previous (↑)"
                    >
                      <ArrowUp size={14} className="text-on-surface-variant" />
                    </button>
                    <button
                      onClick={() => setSelectedIndex(prev => Math.min(prev + 1, results.length - 1))}
                      disabled={selectedIndex === results.length - 1}
                      className="p-1 rounded hover:bg-surface-variant disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Next (↓)"
                    >
                      <ArrowDown size={14} className="text-on-surface-variant" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Results */}
        <div
          ref={resultsContainerRef}
          className="max-h-96 overflow-y-auto custom-scrollbar"
        >
          {!hasSearched ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
              <div className="w-16 h-16 rounded-full bg-surface-variant/50 flex items-center justify-center mb-4">
                <Search size={24} className="text-on-surface-variant" />
              </div>
              <h3 className="title-medium text-on-surface mb-2">Search Messages</h3>
              <p className="body-small text-on-surface-variant max-w-sm">
                Type to search through all messages in this chat. Use ↑↓ to navigate and Enter to jump to a message.
              </p>
            </div>
          ) : results.length === 0 && !isSearching ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
              <div className="w-16 h-16 rounded-full bg-surface-variant/50 flex items-center justify-center mb-4">
                <FileText size={24} className="text-on-surface-variant" />
              </div>
              <h3 className="title-medium text-on-surface mb-2">No Results</h3>
              <p className="body-small text-on-surface-variant max-w-sm">
                No messages found matching "{searchQuery}". Try different keywords.
              </p>
            </div>
          ) : (
            <div className="p-2">
              <AnimatePresence>
                {results.map((message, index) => (
                  <motion.div
                    key={message.messageId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => handleSelectMessage(message)}
                    className={`p-4 rounded-2xl cursor-pointer transition-all mb-2 ${
                      index === selectedIndex
                        ? 'bg-primary/10 border-2 border-primary/30'
                        : 'bg-surface-container hover:bg-surface-variant border-2 border-transparent'
                    }`}
                  >
                    {/* Message Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-on-surface-variant" />
                        <span className="label-medium text-on-surface">
                          {message.userName}
                        </span>
                        <span className="px-2 py-0.5 bg-surface-variant rounded-full label-small text-on-surface-variant">
                          {message.userRole}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-on-surface-variant">
                        <Calendar size={12} />
                        <span className="body-small">{formatDate(message.createdAt)}</span>
                      </div>
                    </div>

                    {/* Message Content */}
                    <div className="body-medium text-on-surface line-clamp-3">
                      {highlightMatch(message.content, searchQuery)}
                    </div>

                    {/* Attachments */}
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="flex items-center gap-1 mt-2 text-on-surface-variant">
                        <FileText size={12} />
                        <span className="body-small">
                          {message.attachments.length} attachment{message.attachments.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-outline-variant bg-surface-variant/30">
          <div className="flex items-center justify-center gap-4 text-on-surface-variant body-small">
            <div className="flex items-center gap-1">
              <kbd className="px-2 py-1 bg-surface border border-outline-variant rounded text-xs">↑↓</kbd>
              <span>Navigate</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="px-2 py-1 bg-surface border border-outline-variant rounded text-xs">Enter</kbd>
              <span>Select</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="px-2 py-1 bg-surface border border-outline-variant rounded text-xs">Esc</kbd>
              <span>Close</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
