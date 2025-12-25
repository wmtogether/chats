import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface EditChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatName: string;
  onSave: (newName: string) => void;
}

export default function EditChatDialog({
  open,
  onOpenChange,
  chatName,
  onSave
}: EditChatDialogProps) {
  const [name, setName] = useState(chatName);
  const [isValid, setIsValid] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(chatName);
      setIsValid(true);
      // Focus the input after a short delay to ensure it's rendered
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 100);
    }
  }, [open, chatName]);

  const handleSave = () => {
    const trimmedName = name.trim();
    if (trimmedName && trimmedName !== chatName) {
      onSave(trimmedName);
      onOpenChange(false);
    } else if (!trimmedName) {
      setIsValid(false);
    } else {
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    if (!isValid && e.target.value.trim()) {
      setIsValid(true);
    }
  };

  if (!open) return null;

  const dialogContent = (
    <div className="select-none dialog-overlay fixed inset-0 flex items-center justify-center" style={{ zIndex: 1000000 }}>
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200"
        onClick={handleCancel}
      />

      {/* Dialog */}
      <div 
        className="relative bg-surface-container rounded-3xl shadow-lg max-w-md w-full mx-4 transform transition-all duration-200 scale-100 opacity-100 border border-outline-variant"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4">
          <h2 className="headline-small text-on-surface">Edit Chat Name</h2>
          <button
            onClick={handleCancel}
            className="p-2 rounded-full hover:bg-surface-variant transition-colors"
            aria-label="Close dialog"
          >
            <X size={20} className="text-on-surface-variant" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pb-4">
          <p className="body-medium text-on-surface-variant mb-4">
            Enter new name for the chat:
          </p>
          
          {/* Input Field */}
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              className={`w-full px-4 py-3 rounded-xl border-2 bg-surface outline-none transition-all duration-200 body-large text-on-surface placeholder:text-on-surface-variant ${
                isValid 
                  ? 'border-outline focus:border-primary' 
                  : 'border-error focus:border-error'
              }`}
              placeholder="Chat name"
              maxLength={100}
            />
            {!isValid && (
              <p className="text-error body-small mt-2">
                Chat name cannot be empty
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 p-6 pt-4">
          <button
            onClick={handleCancel}
            className="px-6 py-2 rounded-full hover:bg-surface-variant transition-colors label-large text-on-surface"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-6 py-2 rounded-full bg-primary hover:bg-primary/90 disabled:bg-surface-variant disabled:text-on-surface-variant transition-colors label-large text-on-primary"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );

  // Use portal to render at document body level
  return createPortal(dialogContent, document.body);
}