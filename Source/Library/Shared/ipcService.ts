// IPC Service for communicating with Rust backend
import authService from '../Authentication/jwt';
export interface IpcRequest {
  action: string;
  requestId?: string;
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
    if (typeof window !== 'undefined') {
      // Detect if we're in the desktop app (only for non-API IPC, like dialogs)
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
    const fullUrl = `http://10.10.60.8:1669${path}`; // Use the direct backend URL
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'X-Session-Id': (window as any).sessionId || 'webui-session', // Use a session ID for direct web UI access
      ...authService.getAuthHeader(), // Add Authorization header
      ...headers
    };

    const requestOptions: RequestInit = {
      method: method,
      headers: defaultHeaders,
    };

    if (body) {
      requestOptions.body = JSON.stringify(body);
    }

    try {
      console.log('🌐 Making WebUI API Request:', { method, fullUrl });
      const response = await fetch(fullUrl, requestOptions);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('❌ WebUI API Request failed:', error);
      throw error;
    }
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