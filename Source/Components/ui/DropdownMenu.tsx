//@ts-expect-error
import { useState, useRef, useEffect, ReactNode } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface DropdownMenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  divider?: boolean;
  danger?: boolean;
  onClick?: () => void;
}

interface DropdownMenuProps {
  trigger?: ReactNode;
  items: DropdownMenuItem[];
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
  align?: 'left' | 'right';
  variant?: 'filled' | 'outlined' | 'text';
}

export default function DropdownMenu({
  trigger,
  items,
  label,
  placeholder = 'Select an option',
  value,
  onChange,
  disabled = false,
  className = '',
  align = 'left',
  variant = 'outlined',
}: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleItemClick = (item: DropdownMenuItem) => {
    if (item.disabled) return;

    if (item.onClick) {
      item.onClick();
    }

    if (onChange) {
      onChange(item.id);
    }

    setIsOpen(false);
  };

  const selectedItem = items.find((item) => item.id === value);

  const getVariantClasses = () => {
    switch (variant) {
      case 'filled':
        return 'bg-surface-container text-on-surface hover:bg-surface-container-high';
      case 'text':
        return 'bg-transparent text-on-surface hover:bg-surface-variant/50';
      case 'outlined':
      default:
        return 'bg-surface border border-outline-variant text-on-surface hover:bg-surface-variant/30';
    }
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {label && (
        <label className="block label-medium text-on-surface mb-2">
          {label}
        </label>
      )}

      {/* Trigger Button */}
      {trigger ? (
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className="focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-xl"
        >
          {trigger}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`
            w-full px-4 py-3 rounded-xl
            flex items-center justify-between gap-2
            transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-primary/20
            disabled:opacity-50 disabled:cursor-not-allowed
            ${getVariantClasses()}
          `}
        >
          <motion.div
            className="flex items-center gap-2 flex-1 text-left"
            animate={{ x: selectedItem ? 0 : 2 }}
            transition={{ duration: 0.2 }}
          >
            {selectedItem?.icon && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.2, type: 'spring' }}
                className="flex-shrink-0"
              >
                {selectedItem.icon}
              </motion.span>
            )}
            <span className="body-large truncate">
              {selectedItem?.label || placeholder}
            </span>
          </motion.div>
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            <ChevronDown className="h-5 w-5 flex-shrink-0" />
          </motion.div>
        </button>
      )}

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={`
              absolute z-50 mt-2 min-w-[200px] w-full
              bg-surface-container border border-outline-variant
              rounded-2xl shadow-lg overflow-hidden
              ${align === 'right' ? 'right-0' : 'left-0'}
            `}
          >
            <div className="py-2 max-h-[300px] overflow-y-auto">
              {items.map((item, index) => (
                <div key={item.id}>
                  {item.divider && index > 0 && (
                    <motion.div
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 0.2, delay: index * 0.02 }}
                      className="my-2 border-t border-outline-variant origin-left"
                    />
                  )}
                  <motion.button
                    type="button"
                    onClick={() => handleItemClick(item)}
                    disabled={item.disabled}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.15, delay: index * 0.03 }}
                    whileHover={{ backgroundColor: 'rgba(var(--md-sys-color-surface-variant-rgb, 0, 0, 0), 0.5)' }}
                    whileTap={{ scale: 0.98 }}
                    className={`
                      w-full px-4 py-3 flex items-center gap-3
                      transition-colors duration-150
                      disabled:opacity-50 disabled:cursor-not-allowed
                      ${
                        item.danger
                          ? 'text-error hover:bg-error/10'
                          : 'text-on-surface'
                      }
                      ${
                        value === item.id
                          ? 'bg-primary/10 text-primary'
                          : ''
                      }
                    `}
                  >
                    {/* Icon */}
                    {item.icon && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.2, delay: index * 0.03 + 0.05 }}
                        className="flex-shrink-0 w-5 h-5 flex items-center justify-center"
                      >
                        {item.icon}
                      </motion.span>
                    )}

                    {/* Label */}
                    <span className="flex-1 text-left body-large">
                      {item.label}
                    </span>

                    {/* Check mark for selected item */}
                    {value === item.id && (
                      <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ duration: 0.3, type: 'spring', stiffness: 200 }}
                      >
                        <Check className="h-5 w-5 flex-shrink-0" />
                      </motion.div>
                    )}
                  </motion.button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
