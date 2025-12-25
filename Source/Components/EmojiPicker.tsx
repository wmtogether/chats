import { useRef, useEffect, useState, useMemo } from 'react';

// --- Types ---
interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

interface EmojiCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
  emojis: string[];
}

// --- Icons (SVG) ---
const Icons = {
  Search: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  Smile: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Nature: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>,
  Food: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
  Activity: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
  Objects: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>,
};

// --- Mock Data (Ideally fetch this from a JSON file) ---
const EMOJI_DATA: EmojiCategory[] = [
  { 
    id: 'smileys', name: 'Smileys', icon: <Icons.Smile />, 
    emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔'] 
  },
  { 
    id: 'nature', name: 'Nature', icon: <Icons.Nature />, 
    emojis: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋'] 
  },
  { 
    id: 'food', name: 'Food', icon: <Icons.Food />, 
    emojis: ['🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥒','🌶','🌽','🥕','🥔','🍠','🥐','🥯','🍞','🥖'] 
  },
  { 
    id: 'activity', name: 'Activity', icon: <Icons.Activity />, 
    emojis: ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🎱','🥏','🏓','🏸','🥅','🏒','🏑','🥍','🏏','⛳','🏹','🎣','🥊','🥋','🎽','🛹','🛼','🛷','⛸','🥌','🎿','⛷'] 
  },
  { 
    id: 'objects', name: 'Objects', icon: <Icons.Objects />, 
    emojis: ['⌚','📱','📲','💻','⌨','🖥','🖨','🖱','🖲','🕹','🗜','💽','💾','💿','📀','📼','📷','📸','📹','🎥','📽','🎞','📞','☎','📟','📠','📺','📻','🎙','🎚'] 
  },
];

export default function CustomEmojiPicker({ onEmojiSelect, onClose, isOpen }: EmojiPickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'>('bottom-right');
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('smileys');



  // --- Filtering Logic ---
  const filteredData = useMemo(() => {
    if (!search) return EMOJI_DATA;
    // Flattens the list for search results
    const allEmojis = EMOJI_DATA.flatMap(cat => cat.emojis);
    // Simple filter (in a real app, use emoji keywords/aliases)
    // Note: Searching raw emoji strings isn't great. 
    // For a real app, map emojis to keywords: { char: '😀', keywords: ['smile', 'happy'] }
    return [{ 
      id: 'search-results', 
      name: 'Search Results', 
      icon: <Icons.Search />, 
      emojis: allEmojis // In reality, filter this by keyword
    }];
  }, [search]);

  // --- Positioning Logic (From your code) ---
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const updatePosition = () => {
      if (pickerRef.current && isOpen) {
        const parent = pickerRef.current.parentElement;
        const parentRect = parent?.getBoundingClientRect();
        
        if (!parentRect) return;
        
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Picker dimensions
        const pickerWidth = 320;
        const pickerHeight = 400;
        
        // Check if there's enough space above
        const spaceAbove = parentRect.top;
        const spaceBelow = viewportHeight - parentRect.bottom;
        
        // Check if there's enough space to the right
        const spaceRight = viewportWidth - parentRect.left;
        
        // Prefer showing above the button (bottom-full)
        const showAbove = spaceAbove >= pickerHeight + 10;
        
        // Prefer aligning to the right edge of the button
        const alignRight = spaceRight < pickerWidth;
        
        if (showAbove && alignRight) {
          setPosition('bottom-left'); // Above button, aligned to right
        } else if (showAbove) {
          setPosition('bottom-right'); // Above button, aligned to left
        } else if (alignRight) {
          setPosition('top-left'); // Below button, aligned to right
        } else {
          setPosition('top-right'); // Below button, aligned to left
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      setTimeout(updatePosition, 10);
      window.addEventListener('resize', updatePosition);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, onClose]);

  // --- Scroll to Category ---
  const handleCategoryClick = (catId: string) => {
    setActiveCategory(catId);
    const element = document.getElementById(`emoji-cat-${catId}`);
    if (element && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: element.offsetTop - 100, // Offset for search/header
        behavior: 'smooth'
      });
    }
  };

  if (!isOpen) {

    return null;
  }



  const getPositionClasses = () => {
    switch (position) {
      case 'bottom-left': return 'bottom-full right-0 mb-1';
      case 'top-right': return 'top-full left-0 mt-1';
      case 'top-left': return 'top-full right-0 mt-1';
      case 'bottom-right': return 'bottom-full left-0 mb-1';
      default: return 'bottom-full right-0 mb-1'; // Default to bottom-left for chat input
    }
  };

  return (
    <div 
      ref={pickerRef}
      className={`absolute ${getPositionClasses()} z-[9999] flex flex-col w-[320px] h-[400px] 
      bg-surface border border-outline-variant rounded-[20px] shadow-elevation-3 overflow-hidden`}
      style={{ animation: 'fadeIn 0.2s ease-out' }}
    >
      {/* --- Header / Search --- */}
      <div className="p-4 pb-2 bg-surface sticky top-0 z-10">
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
            <Icons.Search />
          </div>
          <input
            type="text"
            placeholder="Search emojis..."
            className="w-full pl-10 pr-4 py-2.5 bg-surface-variant text-on-surface 
            rounded-full text-sm outline-none border-2 border-transparent focus:border-primary 
            transition-all placeholder-on-surface-variant"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* --- Categories (Tabs) --- */}
      <div className="px-2 pb-2 flex gap-1 overflow-x-auto no-scrollbar border-b border-outline-variant">
        {EMOJI_DATA.map((cat) => (
          <button
            key={cat.id}
            onClick={() => handleCategoryClick(cat.id)}
            className={`flex items-center justify-center p-2 rounded-full transition-all duration-300
              ${activeCategory === cat.id 
                ? 'bg-primary-container text-on-primary-container' 
                : 'text-on-surface-variant hover:bg-surface-variant hover:text-on-surface'
              }`}
            title={cat.name}
          >
            {cat.icon}
          </button>
        ))}
      </div>

      {/* --- Emoji Grid --- */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-2 custom-scrollbar"
      >
        {filteredData.map((category) => (
          <div key={category.id} id={`emoji-cat-${category.id}`} className="mb-4">
            <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2 ml-2 sticky top-0 bg-surface/90 backdrop-blur-sm p-1 z-10">
              {category.name}
            </h3>
            <div className="grid grid-cols-6 gap-1">
              {category.emojis.map((emoji, index) => (
                <button
                  key={`${category.id}-${index}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onEmojiSelect(emoji);
                    onClose();
                  }}
                  className="aspect-square text-lg flex items-center justify-center rounded-full 
                  hover:bg-surface-variant transition-colors cursor-pointer select-none"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* --- Footer (Preview) --- */}
      <div className="h-10 border-t border-outline-variant bg-surface-variant/50 backdrop-blur flex items-center px-4">
        <span className="text-xs text-on-surface-variant">Pick an emoji</span>
      </div>
    </div>
  );
}