import { useState } from 'react';
import { Bug, X, RefreshCw, Trash2 } from 'lucide-react';
import { localStorageManager } from '../Library/utils/localStorage';

interface DebugPanelProps {
  currentState: {
    selectedChat: any;
    currentPage: string;
    chatsCount: number;
  };
}

export default function DebugPanel({ currentState }: DebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [storageState, setStorageState] = useState(localStorageManager.loadAppState());

  const refreshStorageState = () => {
    setStorageState(localStorageManager.loadAppState());
  };

  const clearStorage = () => {
    localStorageManager.clearAppState();
    setStorageState(null);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 p-3 bg-surface-container border border-outline-variant rounded-full shadow-lg hover:bg-surface-variant transition-colors z-50"
        title="Open Debug Panel"
      >
        <Bug size={20} className="text-on-surface-variant" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-80 bg-surface-container border border-outline-variant rounded-2xl shadow-xl z-50 max-h-96 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-outline-variant">
        <h3 className="font-semibold text-on-surface">Debug Panel</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1 hover:bg-surface-variant rounded-full transition-colors"
        >
          <X size={16} className="text-on-surface-variant" />
        </button>
      </div>
      
      <div className="p-4 space-y-4 overflow-y-auto max-h-80">
        {/* Current State */}
        <div>
          <h4 className="font-medium text-on-surface mb-2">Current State</h4>
          <div className="text-xs text-on-surface-variant space-y-1 bg-surface-variant/50 p-2 rounded">
            <div>Page: <span className="font-mono">{currentState.currentPage}</span></div>
            <div>Selected Chat: <span className="font-mono">{currentState.selectedChat?.channelName || 'None'}</span></div>
            <div>Chat UUID: <span className="font-mono">{currentState.selectedChat?.uuid || 'None'}</span></div>
            <div>Chats Loaded: <span className="font-mono">{currentState.chatsCount}</span></div>
          </div>
        </div>

        {/* Storage State */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-on-surface">Storage State</h4>
            <div className="flex gap-1">
              <button
                onClick={refreshStorageState}
                className="p-1 hover:bg-surface-variant rounded transition-colors"
                title="Refresh"
              >
                <RefreshCw size={14} className="text-on-surface-variant" />
              </button>
              <button
                onClick={clearStorage}
                className="p-1 hover:bg-error-container rounded transition-colors"
                title="Clear Storage"
              >
                <Trash2 size={14} className="text-error" />
              </button>
            </div>
          </div>
          
          {storageState ? (
            <div className="text-xs text-on-surface-variant space-y-1 bg-surface-variant/50 p-2 rounded">
              <div>Saved Chat UUID: <span className="font-mono">{storageState.selectedChatUuid || 'None'}</span></div>
              <div>Saved Page: <span className="font-mono">{storageState.currentPage || 'None'}</span></div>
              <div>Last Active: <span className="font-mono">
                {storageState.lastActiveTimestamp 
                  ? new Date(storageState.lastActiveTimestamp).toLocaleString()
                  : 'None'
                }
              </span></div>
              <div>Should Restore: <span className="font-mono">{localStorageManager.shouldRestoreState() ? 'Yes' : 'No'}</span></div>
            </div>
          ) : (
            <div className="text-xs text-on-surface-variant bg-surface-variant/50 p-2 rounded">
              No storage data found
            </div>
          )}
        </div>

        {/* Actions */}
        <div>
          <h4 className="font-medium text-on-surface mb-2">Actions</h4>
          <div className="space-y-2">
            <button
              onClick={() => {
                const testState = {
                  selectedChatUuid: 'test-uuid-123',
                  currentPage: 'chat' as const,
                  lastActiveTimestamp: Date.now()
                };
                localStorageManager.saveAppState(testState);
                refreshStorageState();
                alert('Test state saved! Check console for logs.');
              }}
              className="w-full text-xs bg-secondary text-on-secondary px-3 py-2 rounded hover:bg-secondary/90 transition-colors"
            >
              Save Test State
            </button>
            <button
              onClick={() => {
                const state = localStorageManager.loadAppState();
                const shouldRestore = localStorageManager.shouldRestoreState();
                alert(`Loaded state: ${JSON.stringify(state, null, 2)}\n\nShould restore: ${shouldRestore}`);
              }}
              className="w-full text-xs bg-tertiary text-on-tertiary px-3 py-2 rounded hover:bg-tertiary/90 transition-colors"
            >
              Test Load State
            </button>
            <button
              onClick={() => {
                // Force state restoration
                const savedChatUuid = localStorageManager.getSelectedChatUuid();
                if (savedChatUuid && currentState.chatsCount > 0) {
                  // Trigger a manual restoration
                  window.location.reload();
                } else {
                  alert('No saved chat UUID found or no chats loaded');
                }
              }}
              className="w-full text-xs bg-surface-variant text-on-surface-variant px-3 py-2 rounded hover:bg-surface-variant/80 transition-colors"
            >
              Force Restore State
            </button>
            <button
              onClick={() => {
                localStorageManager.saveAppState({
                  selectedChatUuid: currentState.selectedChat?.uuid,
                  currentPage: currentState.currentPage as any,
                  lastActiveTimestamp: Date.now()
                });
                refreshStorageState();
              }}
              className="w-full text-xs bg-primary text-on-primary px-3 py-2 rounded hover:bg-primary/90 transition-colors"
            >
              Save Current State
            </button>
            <button
              onClick={() => {
                clearStorage();
                window.location.reload();
              }}
              className="w-full text-xs bg-error text-on-error px-3 py-2 rounded hover:bg-error/90 transition-colors"
            >
              Clear & Reload
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}