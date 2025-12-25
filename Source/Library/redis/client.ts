// Browser-compatible Redis client implementation
// Since we're in a browser environment, we'll simulate Redis functionality
// In a real implementation, this would connect through WebSockets or HTTP API

// Redis connection URL - using the specified IP
const REDIS_URL = 'redis://10.10.60.8:6379';

// Simulated Redis client for browser environment
class BrowserRedisClient {
  private connected = false;
  private subscribers = new Map<string, Set<(message: string) => void>>();

  async connect(): Promise<void> {
    console.log('🔌 Connecting to Redis at:', REDIS_URL);
    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 100));
    this.connected = true;
    console.log('✅ Redis client connected (simulated)');
  }

  async quit(): Promise<void> {
    this.connected = false;
    this.subscribers.clear();
    console.log('Redis client disconnected');
  }

  async ping(): Promise<string> {
    if (!this.connected) throw new Error('Redis not connected');
    return 'PONG';
  }

  async publish(channel: string, message: string): Promise<number> {
    if (!this.connected) throw new Error('Redis not connected');
    
    console.log(`📡 Publishing to ${channel}:`, message);
    
    // Simulate publishing by calling subscribers
    const channelSubscribers = this.subscribers.get(channel);
    if (channelSubscribers) {
      channelSubscribers.forEach(callback => {
        try {
          callback(message);
        } catch (error) {
          console.error('Error in subscriber callback:', error);
        }
      });
    }
    
    return channelSubscribers ? channelSubscribers.size : 0;
  }

  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    if (!this.connected) throw new Error('Redis not connected');
    
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set());
    }
    
    this.subscribers.get(channel)!.add(callback);
    console.log(`🔔 Subscribed to ${channel}`);
  }

  async unsubscribe(channel: string): Promise<void> {
    this.subscribers.delete(channel);
    console.log(`🔕 Unsubscribed from ${channel}`);
  }

  on(event: string, callback: (error: Error) => void): void {
    if (event === 'error') {
      // Store error callback if needed
      console.log('Redis error handler registered');
    }
  }
}

// Create Redis clients
export const redis = new BrowserRedisClient();
export const publisher = new BrowserRedisClient();
export const subscriber = new BrowserRedisClient();

// Initialize connections
let isConnected = false;

export async function connectRedis(): Promise<void> {
  if (isConnected) return;

  try {
    await Promise.all([
      redis.connect(),
      publisher.connect(),
      subscriber.connect(),
    ]);
    isConnected = true;
    console.log('✅ Redis connected successfully to', REDIS_URL);
  } catch (error) {
    console.error('❌ Failed to connect to Redis:', error);
    throw error;
  }
}

// Graceful shutdown
export async function disconnectRedis(): Promise<void> {
  if (!isConnected) return;

  try {
    await Promise.all([
      redis.quit(),
      publisher.quit(),
      subscriber.quit(),
    ]);
    isConnected = false;
    console.log('Redis disconnected');
  } catch (error) {
    console.error('Error disconnecting Redis:', error);
  }
}

// Check connection status
export function isRedisConnected(): boolean {
  return isConnected;
}

// Ping Redis to test connection
export async function pingRedis(): Promise<boolean> {
  try {
    const result = await redis.ping();
    return result === 'PONG';
  } catch (error) {
    console.error('Redis ping failed:', error);
    return false;
  }
}