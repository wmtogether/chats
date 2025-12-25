// Browser-compatible Redis client implementation
// Uses Socket.IO connection to the WebSocket server on port 1670

import { io, Socket } from 'socket.io-client';

// Socket.IO based Redis client for browser environment
class BrowserRedisClient {
  private connected = false;
  private subscribers = new Map<string, Set<(message: string) => void>>();
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  
  // Getter for socket access
  get socketConnection() {
    return this.socket;
  }

  async connect(): Promise<void> {
    console.log('🔌 Connecting to Socket.IO server on 10.10.60.8:1671...');
    
    try {
      // Get auth token for Socket.IO connection
      const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
      if (!token) {
        throw new Error('No auth token available for Socket.IO connection');
      }

      // Connect to Socket.IO server
      this.socket = io('http://10.10.60.8:1671', {
        auth: { token },
        transports: ['websocket', 'polling'],
        timeout: 5000,
      });

      // Set up event handlers
      this.socket.on('connect', () => {
        console.log('✅ Socket.IO connected to Redis server');
        this.connected = true;
        this.reconnectAttempts = 0;
      });

      this.socket.on('message', (data: any) => {
        try {
          console.log('📨 Socket.IO message received:', data);
          
          // Handle Redis messages forwarded by the Socket.IO server
          if (data.channel) {
            const channelSubscribers = this.subscribers.get(data.channel);
            if (channelSubscribers) {
              const messageStr = JSON.stringify({
                channel: data.channel,
                event: data.event,
                data: data.data,
                timestamp: data.timestamp
              });
              
              channelSubscribers.forEach(callback => {
                try {
                  callback(messageStr);
                } catch (error) {
                  console.error('Error in subscriber callback:', error);
                }
              });
            }
          }
        } catch (error) {
          console.error('Error parsing Socket.IO message:', error);
        }
      });

      this.socket.on('disconnect', () => {
        console.log('Socket.IO disconnected from Redis server');
        this.connected = false;
        this.attemptReconnect();
      });

      this.socket.on('connect_error', (error: any) => {
        console.error('Socket.IO connection error:', error);
        this.connected = false;
      });

      this.socket.on('publish_error', (data: any) => {
        console.error('Redis publish error:', data.error);
      });

      // Wait for connection to be established
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Socket.IO connection timeout'));
        }, 10000);

        this.socket!.on('connect', () => {
          clearTimeout(timeout);
          this.connected = true;
          resolve(void 0);
        });

        this.socket!.on('connect_error', (error: any) => {
          clearTimeout(timeout);
          reject(new Error(`Socket.IO connection failed: ${error.message}`));
        });
      });

    } catch (error) {
      console.error('Failed to connect to Socket.IO server:', error);
      throw error;
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Attempting to reconnect to Socket.IO (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      setTimeout(() => {
        this.connect().catch(console.error);
      }, 2000 * this.reconnectAttempts);
    } else {
      console.error('❌ Max reconnection attempts reached');
    }
  }

  async quit(): Promise<void> {
    this.connected = false;
    this.subscribers.clear();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    console.log('Socket.IO client disconnected');
  }

  async ping(): Promise<string> {
    if (!this.connected) throw new Error('Socket.IO not connected');
    return 'PONG'; // Socket.IO handles ping/pong automatically
  }

  async publish(channel: string, message: string): Promise<number> {
    if (!this.connected) throw new Error('Socket.IO not connected');
    
    console.log(`📡 Publishing to ${channel}:`, message);
    
    if (this.socket) {
      // Publish through Socket.IO to the server, which will forward to Redis
      this.socket.emit('publish', { channel, message });
      console.log(`📡 Message sent to Socket.IO server for Redis publishing`);
    }
    
    // Also trigger local subscribers for immediate feedback
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
    
    return this.subscribers.get(channel)?.size || 0;
  }

  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    if (!this.connected) throw new Error('Socket.IO not connected');
    
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set());
    }
    
    this.subscribers.get(channel)!.add(callback);
    console.log(`🔔 Subscribed to ${channel}`);
    
    // The Socket.IO server automatically subscribes to all Redis channels
    // We don't need to send a subscribe message
  }

  async unsubscribe(channel: string): Promise<void> {
    this.subscribers.delete(channel);
    console.log(`🔕 Unsubscribed from ${channel}`);
  }

  on(event: string, callback: (error: Error) => void): void {
    if (event === 'error' && this.socket) {
      this.socket.on('error', callback);
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
    console.log('✅ Redis connected successfully via Socket.IO on 10.10.60.8:1671');
  } catch (error) {
    console.error('❌ Failed to connect to Redis via Socket.IO:', error);
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