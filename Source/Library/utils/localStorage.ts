// Local storage utility for persisting app state
import type { ChatType } from '../types';

interface AppStateStorage {
  selectedChatUuid?: string;
  currentPage?: 'chat' | 'users' | 'allChats';
  lastActiveTimestamp?: number;
}

const STORAGE_KEY = 'chatApp_state';
const STORAGE_VERSION = '1.0';
const STORAGE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

export class LocalStorageManager {
  private static instance: LocalStorageManager;
  
  private constructor() {}
  
  static getInstance(): LocalStorageManager {
    if (!LocalStorageManager.instance) {
      LocalStorageManager.instance = new LocalStorageManager();
    }
    return LocalStorageManager.instance;
  }

  // Save app state to localStorage
  saveAppState(state: AppStateStorage): void {
    try {
      const storageData = {
        version: STORAGE_VERSION,
        timestamp: Date.now(),
        data: {
          ...state,
          lastActiveTimestamp: Date.now()
        }
      };
      
      console.log('💾 Saving to localStorage:', storageData);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storageData));
      console.log('💾 Successfully saved to localStorage');
    } catch (error) {
      console.warn('Failed to save app state to localStorage:', error);
    }
  }

  // Load app state from localStorage
  loadAppState(): AppStateStorage | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      console.log('📦 Raw localStorage data:', stored);
      if (!stored) return null;

      const storageData = JSON.parse(stored);
      console.log('📦 Parsed storage data:', storageData);
      
      // Check version compatibility
      if (storageData.version !== STORAGE_VERSION) {
        console.log('Storage version mismatch, clearing old data');
        this.clearAppState();
        return null;
      }

      // Check if data is expired
      const now = Date.now();
      if (now - storageData.timestamp > STORAGE_EXPIRY) {
        console.log('Storage data expired, clearing');
        this.clearAppState();
        return null;
      }

      console.log('📦 Returning storage data:', storageData.data);
      return storageData.data || null;
    } catch (error) {
      console.warn('Failed to load app state from localStorage:', error);
      this.clearAppState(); // Clear corrupted data
      return null;
    }
  }

  // Clear app state from localStorage
  clearAppState(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear app state from localStorage:', error);
    }
  }

  // Save selected chat
  saveSelectedChat(chat: ChatType | null): void {
    console.log('💾 Saving selected chat:', chat ? chat.channelName : 'null');
    console.log('💾 Chat UUID:', chat?.uuid);
    
    const currentState = this.loadAppState() || {};
    const newState = {
      ...currentState,
      selectedChatUuid: chat?.uuid || undefined
    };
    
    console.log('💾 New state to save:', newState);
    this.saveAppState(newState);
  }

  // Save current page
  saveCurrentPage(page: 'chat' | 'users' | 'allChats'): void {
    const currentState = this.loadAppState() || {};
    this.saveAppState({
      ...currentState,
      currentPage: page
    });
  }

  // Find chat by UUID from chats array
  findChatByUuid(chats: ChatType[], uuid: string): ChatType | null {
    console.log('🔍 Looking for chat with UUID:', uuid);
    console.log('🔍 Available chats:', chats.map(chat => ({ uuid: chat.uuid, name: chat.channelName })));
    const found = chats.find(chat => chat.uuid === uuid) || null;
    console.log('🔍 Found chat:', found ? found.channelName : 'Not found');
    return found;
  }

  // Get last selected chat UUID
  getSelectedChatUuid(): string | null {
    const state = this.loadAppState();
    return state?.selectedChatUuid || null;
  }

  // Get last current page
  getCurrentPage(): 'chat' | 'users' | 'allChats' | null {
    const state = this.loadAppState();
    return state?.currentPage || null;
  }

  // Check if we should restore state (user was recently active)
  shouldRestoreState(): boolean {
    const state = this.loadAppState();
    console.log('🔄 Checking if should restore state, loaded state:', state);
    
    if (!state) {
      console.log('🔄 No state found');
      return false;
    }

    // If we have a selectedChatUuid, we should try to restore it regardless of timestamp
    if (state.selectedChatUuid) {
      console.log('🔄 Found selectedChatUuid, should restore');
      return true;
    }

    // For other cases, check timestamp
    if (!state.lastActiveTimestamp) {
      console.log('🔄 No lastActiveTimestamp found');
      return false;
    }

    const timeSinceLastActive = Date.now() - state.lastActiveTimestamp;
    const maxRestoreTime = 24 * 60 * 60 * 1000; // 24 hours
    
    console.log('🔄 Time since last active:', timeSinceLastActive, 'ms');
    console.log('🔄 Max restore time:', maxRestoreTime, 'ms');
    
    const shouldRestore = timeSinceLastActive < maxRestoreTime;
    console.log('🔄 Should restore:', shouldRestore);
    
    return shouldRestore;
  }
}

// Export singleton instance
export const localStorageManager = LocalStorageManager.getInstance();

// Convenience functions
export const saveSelectedChat = (chat: ChatType | null) => 
  localStorageManager.saveSelectedChat(chat);

export const saveCurrentPage = (page: 'chat' | 'users' | 'allChats') => 
  localStorageManager.saveCurrentPage(page);

export const loadAppState = () => 
  localStorageManager.loadAppState();

export const clearAppState = () => 
  localStorageManager.clearAppState();

export const shouldRestoreState = () => 
  localStorageManager.shouldRestoreState();

export const findChatByUuid = (chats: ChatType[], uuid: string) => 
  localStorageManager.findChatByUuid(chats, uuid);