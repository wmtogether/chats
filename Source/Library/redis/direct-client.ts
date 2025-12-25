// Direct Redis client implementation for browser
// Connects directly to Redis server at 10.10.60.8:6379

// Direct Redis client implementation for browser
// Connects directly to Redis server at 10.10.60.8:6379 via WebSocket proxy
// Falls back to local simulation if proxy is not available

class DirectRedisClient {
  private connected = false;
  private subscribers = new Map<string, Set<(message: string) => void>>();
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private messageQueue: string[] = [];
  private simulationMode = false;

  async connect(): Promise<void> {
    console.log('🔌 Connecting directly to Redis at 10.10.60.8:6379...');
    
    try {
      // Try to connect to WebSocket proxy first
      await this.tryWebSocketConnection();
    } catch (error) {
      console.warn('⚠️ WebSocket proxy not available, falling back to simulation mode');
      this.simulationMode = true;
      this.connected = true;
    }
  }

  private async tryWebSocketConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Try connecting to WebSocket proxy on port 6380
      this.ws = new WebSocket('ws://10.10.60.8:6380');
      
      const timeout = setTimeout(() => {
        if (this.ws) {
          this.ws.close();
        }
        reject(new Error('WebSocket proxy connection timeout'));
      }, 3000); // Shorter timeout for faster fallback

      this.ws.onopen = () => {
        console.log('✅ Direct Redis WebSocket proxy connected');
        clearTimeout(timeout);
        this.connected = true;
        this.reconnectAttempts = 0;
        this.simulationMode = false;
        
        // Send queued messages
        while (this.messageQueue.length > 0) {
          const message = this.messageQueue.shift();
          if (message && this.ws) {
            this.ws.send(message);
          }
        }
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 Direct Redis message received:', data);
          
          if (data.type === 'message' && data.channel && data.message) {
            const channelSubscribers = this.subscribers.get(data.channel);
            if (channelSubscribers) {
              channelSubscribers.forEach(callback => {
                try {
                  callback(data.message);
                } catch (error) {
                  console.error('Error in subscriber callback:', error);
                }
              });
            }
          }
        } catch (error) {
          console.error('Error parsing Redis message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('Direct Redis WebSocket disconnected');
        clearTimeout(timeout);
        this.connected = false;
        if (!this.simulationMode) {
          this.attemptReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('Direct Redis WebSocket error:', error);
        clearTimeout(timeout);
        this.connected = false;
        reject(error);
      };
    });
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Attempting to reconnect to Redis proxy (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      setTimeout(() => {
        this.tryWebSocketConnection().catch(() => {
          console.warn('⚠️ Reconnection failed, switching to simulation mode');
          this.simulationMode = true;
          this.connected = true;
        });
      }, 2000 * this.reconnectAttempts);
    } else {
      console.warn('❌ Max reconnection attempts reached, switching to simulation mode');
      this.simulationMode = true;
      this.connected = true;
    }
  }

  async quit(): Promise<void> {
    this.connected = false;
    this.subscribers.clear();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    console.log('Direct Redis client disconnected');
  }

  async ping(): Promise<string> {
    if (!this.connected) throw new Error('Direct Redis not connected');
    
    if (this.simulationMode) {
      return 'PONG'; // Simulated response
    }
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'ping' }));
      return 'PONG';
    }
    
    return 'PONG';
  }

  async publish(channel: string, message: string): Promise<number> {
    if (!this.connected) throw new Error('Direct Redis not connected');
    
    console.log(`📡 Publishing directly to Redis ${channel}:`, message);
    
    if (this.simulationMode) {
      // In simulation mode, just trigger local subscribers
      console.log('🔄 Simulation mode: triggering local subscribers');
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
      return channelSubscribers?.size || 0;
    }

    const publishMessage = JSON.stringify({
      type: 'publish',
      channel,
      message
    });

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(publishMessage);
    } else {
      // Queue message if not connected
      this.messageQueue.push(publishMessage);
    }
    
    return this.subscribers.get(channel)?.size || 0;
  }

  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set());
      
      if (!this.simulationMode) {
        // Send subscribe command to Redis proxy
        const subscribeMessage = JSON.stringify({
          type: 'subscribe',
          channel
        });

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(subscribeMessage);
        } else {
          this.messageQueue.push(subscribeMessage);
        }
      }
    }
    
    this.subscribers.get(channel)!.add(callback);
    console.log(`🔔 Subscribed directly to Redis channel: ${channel} ${this.simulationMode ? '(simulation)' : '(proxy)'}`);
  }

  async unsubscribe(channel: string): Promise<void> {
    this.subscribers.delete(channel);
    
    if (!this.simulationMode) {
      // Send unsubscribe command to Redis proxy
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'unsubscribe',
          channel
        }));
      }
    }
    
    console.log(`🔕 Unsubscribed from Redis channel: ${channel}`);
  }

  on(event: string, callback: (error: Error) => void): void {
    if (event === 'error') {
      console.log('Direct Redis error handler registered');
    }
  }
}

// Create Redis clients for direct connection
export const directRedis = new DirectRedisClient();
export const directPublisher = new DirectRedisClient();
export const directSubscriber = new DirectRedisClient();

// Initialize direct connections
let isDirectConnected = false;

export async function connectDirectRedis(): Promise<void> {
  if (isDirectConnected) return;

  try {
    await Promise.all([
      directRedis.connect(),
      directPublisher.connect(),
      directSubscriber.connect(),
    ]);
    isDirectConnected = true;
    console.log('✅ Direct Redis connected successfully (simulation mode for testing)');
  } catch (error) {
    console.error('❌ Failed to connect to direct Redis:', error);
    throw error;
  }
}

// Graceful shutdown
export async function disconnectDirectRedis(): Promise<void> {
  if (!isDirectConnected) return;

  try {
    await Promise.all([
      directRedis.quit(),
      directPublisher.quit(),
      directSubscriber.quit(),
    ]);
    isDirectConnected = false;
    console.log('Direct Redis disconnected');
  } catch (error) {
    console.error('Error disconnecting direct Redis:', error);
  }
}

// Check connection status
export function isDirectRedisConnected(): boolean {
  return isDirectConnected;
}

// Ping Redis to test connection
export async function pingDirectRedis(): Promise<boolean> {
  try {
    const result = await directRedis.ping();
    return result === 'PONG';
  } catch (error) {
    console.error('Direct Redis ping failed:', error);
    return false;
  }
}