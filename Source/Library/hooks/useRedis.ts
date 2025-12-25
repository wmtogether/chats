// Global Redis hook for fast connection and real-time updates
import { useEffect, useState, useCallback } from 'react';
import { connectDirectRedis, disconnectDirectRedis, pingDirectRedis } from '../redis/direct-client';
import { subscribeDirect, directChatEvents, type PubSubMessage } from '../redis/direct-pubsub';
import type { MessageData as ApiMessageData } from '../Shared/messagesApi';

interface RedisState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
}

interface RedisHook {
  state: RedisState;
  publish: typeof directChatEvents;
  subscribe: (channel: any, callback: (message: PubSubMessage) => void) => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

// Global Redis state
let globalRedisState: RedisState = {
  connected: false,
  connecting: false,
  error: null,
};

let globalStateListeners: Set<(state: RedisState) => void> = new Set();
let isGloballyConnected = false;

// Global connection function
const connectGlobally = async (): Promise<void> => {
  if (isGloballyConnected || globalRedisState.connecting) {
    return;
  }

  console.log('🚀 Initializing global Redis connection...');
  
  globalRedisState = { connected: false, connecting: true, error: null };
  notifyStateListeners();

  try {
    await connectDirectRedis();
    
    const pingResult = await pingDirectRedis();
    if (pingResult) {
      globalRedisState = { connected: true, connecting: false, error: null };
      isGloballyConnected = true;
      console.log('✅ Global Redis connected successfully');
    } else {
      throw new Error('Redis ping failed');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    globalRedisState = { connected: false, connecting: false, error: errorMessage };
    console.error('❌ Global Redis connection failed:', error);
  }

  notifyStateListeners();
};

// Global disconnect function
const disconnectGlobally = async (): Promise<void> => {
  if (!isGloballyConnected) return;

  try {
    await disconnectDirectRedis();
    globalRedisState = { connected: false, connecting: false, error: null };
    isGloballyConnected = false;
    console.log('🔌 Global Redis disconnected');
  } catch (error) {
    console.error('❌ Error disconnecting global Redis:', error);
  }

  notifyStateListeners();
};

// Notify all state listeners
const notifyStateListeners = () => {
  globalStateListeners.forEach(listener => listener({ ...globalRedisState }));
};

// Auto-connect immediately when this module loads
connectGlobally().catch(console.error);

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    disconnectGlobally().catch(console.error);
  });
}

// React hook for Redis
export const useRedis = (): RedisHook => {
  const [state, setState] = useState<RedisState>(globalRedisState);

  useEffect(() => {
    // Subscribe to global state changes
    const listener = (newState: RedisState) => {
      setState(newState);
    };

    globalStateListeners.add(listener);

    // If not connected yet, try to connect
    if (!isGloballyConnected && !globalRedisState.connecting) {
      connectGlobally().catch(console.error);
    }

    return () => {
      globalStateListeners.delete(listener);
    };
  }, []);

  const connect = useCallback(async () => {
    await connectGlobally();
  }, []);

  const disconnect = useCallback(async () => {
    await disconnectGlobally();
  }, []);

  const subscribe = useCallback(async (channel: any, callback: (message: PubSubMessage) => void) => {
    if (!globalRedisState.connected) {
      console.warn('⚠️ Redis not connected, cannot subscribe to channel:', channel);
      return;
    }
    await subscribeDirect(channel, callback);
  }, []);

  return {
    state,
    publish: directChatEvents,
    subscribe,
    connect,
    disconnect,
  };
};

// Global Redis utilities for direct access
export const globalRedis = {
  getState: () => ({ ...globalRedisState }),
  isConnected: () => isGloballyConnected,
  connect: connectGlobally,
  disconnect: disconnectGlobally,
  publish: directChatEvents,
  subscribe: subscribeDirect,
};

// Export for backward compatibility
export { directChatEvents as chatEvents };