// WebSocket utility for real-time communication
// This replaces Redis client for browser-based real-time features

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnected = false;
  private listeners: Map<string, Function[]> = new Map();
  private authToken: string | null = null;

  constructor(private url: string) {
    // Get auth token from localStorage
    this.authToken = localStorage.getItem('authToken');
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Add auth token to WebSocket URL as query parameter
        const wsUrl = this.authToken 
          ? `${this.url}?token=${encodeURIComponent(this.authToken)}`
          : this.url;
          
        console.log('🔌 Connecting to WebSocket:', wsUrl.replace(/token=[^&]+/, 'token=***'));
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('✅ WebSocket connected');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.emit('connect');
          
          // Send a ping to verify connection
          this.send({
            type: 'ping',
            data: Date.now()
          });
          
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('📨 WebSocket message received:', data);
            this.emit('message', data);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('🔌 WebSocket disconnected:', event.code, event.reason);
          this.isConnected = false;
          this.emit('disconnect');
          
          // Only attempt reconnection if it wasn't a clean close
          if (event.code !== 1000) {
            this.handleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          this.emit('error', error);
          reject(error);
        };
      } catch (error) {
        console.error('❌ Failed to create WebSocket:', error);
        reject(error);
      }
    });
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      // Update auth token in case it changed
      this.authToken = localStorage.getItem('authToken');
      
      setTimeout(() => {
        this.connect().catch((error) => {
          console.error(`❌ Reconnection attempt ${this.reconnectAttempts} failed:`, error);
        });
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('❌ Max reconnection attempts reached');
      this.emit('maxReconnectAttemptsReached');
    }
  }

  send(data: any) {
    if (this.ws && this.isConnected && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(data));
        console.log('📤 WebSocket message sent:', data);
      } catch (error) {
        console.error('❌ Failed to send WebSocket message:', error);
      }
    } else {
      console.warn('⚠️ WebSocket not connected, message not sent:', data);
    }
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(callback);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: any) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('❌ Error in WebSocket event listener:', error);
        }
      });
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.isConnected = false;
    this.listeners.clear();
  }

  getConnectionStatus(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  // Method to update auth token (useful when user logs in/out)
  updateAuthToken(token: string | null) {
    this.authToken = token;
    if (token) {
      localStorage.setItem('authToken', token);
    } else {
      localStorage.removeItem('authToken');
    }
  }
}

// Create a singleton instance
let wsManager: WebSocketManager | null = null;

export function createWebSocketManager(url: string): WebSocketManager {
  if (!wsManager) {
    wsManager = new WebSocketManager(url);
  }
  return wsManager;
}

export function getWebSocketManager(): WebSocketManager | null {
  return wsManager;
}