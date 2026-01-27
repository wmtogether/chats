// IPC Service for communicating with Rust backend
export interface IpcRequest {
  action: string;
  requestId: string;
  method?: string;
  path?: string;
  body?: any;
  headers?: Record<string, any>;
}

export interface IpcResponse {
  success: boolean;
  data?: any;
  error?: string;
}

class IpcService {
  private requestCounter = 0;
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();
  private isDesktopApp = false;

  constructor() {
    // Set up global callback system for API responses
    if (typeof window !== 'undefined') {
      (window as any).apiCallbacks = (window as any).apiCallbacks || {};
      (window as any).apiResponse_ = (window as any).apiResponse_ || {};
      
      // Detect if we're in the desktop app
      this.isDesktopApp = !!(window as any).ipc || 
                         window.location.protocol === 'file:' ||
                         window.location.hostname === '' ||
                         (window as any).chrome?.webview;
      
      console.log('🔍 Environment detection:', {
        isDesktopApp: this.isDesktopApp,
        hasIpc: !!(window as any).ipc,
        protocol: window.location.protocol,
        hostname: window.location.hostname,
        hasWebview: !!(window as any).chrome?.webview
      });
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${++this.requestCounter}`;
  }

  async makeApiRequest(method: string, path: string, body?: any, headers?: Record<string, any>): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId();
      const startTime = performance.now();
      
      console.log('🔄 IPC API Request:', { method, path, requestId, isDesktopApp: this.isDesktopApp, startTime });

      // Check if IPC is available and we're in desktop app
      if (!this.isDesktopApp || !(window as any).ipc) {
        console.error('❌ IPC not available - this should only run in desktop app');
        reject(new Error('IPC not available - application must run in desktop environment'));
        return;
      }

      // Set up timeout - aggressive timeout for faster feedback
      const timeout = setTimeout(() => {
        const elapsed = performance.now() - startTime;
        this.pendingRequests.delete(requestId);
        console.warn('⏰ Request timeout:', requestId, `after ${elapsed.toFixed(2)}ms`);
        reject(new Error('Request timeout'));
      }, 5000); // Reduced to 5s for faster feedback

      // Store the request
      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      // Set up callback for this specific request
      if (typeof window !== 'undefined') {
        (window as any).apiCallbacks = (window as any).apiCallbacks || {};
        (window as any).apiCallbacks[requestId] = (response: any) => {
          const elapsed = performance.now() - startTime;
          console.log('📡 IPC API Response received:', { requestId, response, elapsed: `${elapsed.toFixed(2)}ms` });
          
          const pendingRequest = this.pendingRequests.get(requestId);
          if (pendingRequest) {
            clearTimeout(pendingRequest.timeout);
            this.pendingRequests.delete(requestId);
            
            if (response.success === false) {
              reject(new Error(response.error || 'API request failed'));
            } else {
              resolve(response);
            }
          }
        };
      }

      // Send the IPC message
      const ipcMessage: IpcRequest = {
        action: 'api_request',
        requestId,
        method,
        path,
        body,
        headers: {
          'X-Session-Id': (window as any).sessionId || 'desktop-session',
          'Content-Type': 'application/json',
          ...headers
        }
      };

      try {
        const sendTime = performance.now();
        (window as any).ipc.postMessage(JSON.stringify(ipcMessage));
        const sendElapsed = performance.now() - sendTime;
        console.log('✅ IPC message sent:', requestId, `send took ${sendElapsed.toFixed(2)}ms`);
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(requestId);
        reject(new Error(`Failed to send IPC message: ${error}`));
      }
    });
  }

  // Fallback HTTP request method for development
  // Convenience methods for different HTTP methods
  async get(path: string, headers?: Record<string, any>): Promise<any> {
    return this.makeApiRequest('GET', path, undefined, headers);
  }

  async post(path: string, body?: any, headers?: Record<string, any>): Promise<any> {
    return this.makeApiRequest('POST', path, body, headers);
  }

  async patch(path: string, body?: any, headers?: Record<string, any>): Promise<any> {
    return this.makeApiRequest('PATCH', path, body, headers);
  }

  async delete(path: string, headers?: Record<string, any>): Promise<any> {
    return this.makeApiRequest('DELETE', path, undefined, headers);
  }

  // Method to send simple IPC messages (non-API)
  async sendMessage(action: string, data?: any): Promise<void> {
    const message = {
      action,
      ...data
    };

    try {
      if (typeof window !== 'undefined' && (window as any).ipc) {
        (window as any).ipc.postMessage(JSON.stringify(message));
        console.log('✅ IPC message sent:', action);
      } else {
        throw new Error('IPC not available');
      }
    } catch (error) {
      console.error('❌ Failed to send IPC message:', error);
      throw error;
    }
  }

  // Method to show dialogs via IPC
  async showDialog(type: string, title: string, message: string, options?: {
    okText?: string;
    cancelText?: string;
  }): Promise<boolean | number> {
    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId();
      
      console.log('🔔 Showing dialog via IPC:', { type, title, requestId });

      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Dialog timeout'));
      }, 60000); // 60 second timeout for dialogs

      // Store the request
      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      // Check for dialog result periodically
      const checkResult = () => {
        if (typeof window !== 'undefined' && (window as any).dialogResult_) {
          const result = (window as any).dialogResult_[requestId];
          if (result !== undefined) {
            console.log('📡 Dialog result received:', { requestId, result });
            
            const pendingRequest = this.pendingRequests.get(requestId);
            if (pendingRequest) {
              clearTimeout(pendingRequest.timeout);
              this.pendingRequests.delete(requestId);
              
              // Clean up the result
              delete (window as any).dialogResult_[requestId];
              
              // Parse the result
              if (type === 'yes_no_cancel') {
                resolve(parseInt(result)); // 0=Yes, 1=No, 2=Cancel
              } else {
                resolve(result === 'true' || result === true);
              }
            }
            return;
          }
        }
        
        // Check again in 100ms
        setTimeout(checkResult, 100);
      };
      
      // Start checking for result
      setTimeout(checkResult, 100);

      // Send the dialog request
      const dialogMessage = {
        action: 'show_dialog',
        type,
        title,
        message,
        requestId,
        okText: options?.okText || 'OK',
        cancelText: options?.cancelText || 'Cancel'
      };

      try {
        if (typeof window !== 'undefined' && (window as any).ipc) {
          (window as any).ipc.postMessage(JSON.stringify(dialogMessage));
          console.log('✅ Dialog request sent:', requestId);
        } else {
          throw new Error('IPC not available');
        }
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(requestId);
        reject(new Error(`Failed to send dialog request: ${error}`));
      }
    });
  }

  // Cleanup method
  cleanup(): void {
    // Clear all pending requests
    for (const [requestId, request] of this.pendingRequests) {
      clearTimeout(request.timeout);
      request.reject(new Error('IPC service cleanup'));
    }
    this.pendingRequests.clear();
  }
}

// Export singleton instance
export const ipcService = new IpcService();
export default ipcService;