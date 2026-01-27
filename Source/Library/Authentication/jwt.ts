// JWT Authentication Library
import ipcService from '../Shared/ipcService';

export interface User {
  id: number;
  uid: string;
  name: string;
  nickname?: string;
  profilePicture?: string;
  role: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  user: User;
}

export interface LoginRequest {
  identifier: string; // uid or username
  password?: string;
  createPassword?: boolean;
}

class AuthService {
  private token: string | null = null;
  private user: User | null = null;

  constructor() {
    // Load token from localStorage on initialization
    this.loadFromStorage();
    
    // Ensure consistent session ID
    if (typeof window !== 'undefined') {
      if (!(window as any).sessionId) {
        (window as any).sessionId = 'desktop-session';
      }
      console.log('Auth service initialized with session ID:', (window as any).sessionId);
    }
  }

  private loadFromStorage() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth-token');
      const userData = localStorage.getItem('auth-user');
      if (userData) {
        try {
          this.user = JSON.parse(userData);
        } catch (e) {
          console.error('Failed to parse user data from storage:', e);
          this.clearStorage();
        }
      }

      console.log('Loaded from storage:', {
        hasToken: !!this.token,
        hasUser: !!this.user,
        tokenPreview: this.token ? `${this.token.substring(0, 20)}...` : 'None',
        userName: this.user?.name || 'None'
      });

      // If we have a token in localStorage but no cookie, set the cookie
      if (this.token && typeof document !== 'undefined') {
        const cookies = document.cookie.split(';');
        const hasAuthCookie = cookies.some(cookie => 
          cookie.trim().startsWith('auth-token=')
        );
        
        if (!hasAuthCookie) {
          document.cookie = `auth-token=${this.token}; path=/; SameSite=Lax`;
          console.log('Set auth cookie from localStorage');
        }
      }
    }
  }

  private saveToStorage() {
    if (typeof window !== 'undefined') {
      if (this.token) {
        localStorage.setItem('auth-token', this.token);
      } else {
        localStorage.removeItem('auth-token');
      }

      if (this.user) {
        localStorage.setItem('auth-user', JSON.stringify(this.user));
      } else {
        localStorage.removeItem('auth-user');
      }
    }
  }

  private clearStorage() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth-token');
      localStorage.removeItem('auth-user');
    }
    this.token = null;
    this.user = null;
  }

  async login(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      console.log('🔐 Logging in via IPC...');
      
      // Use IPC to communicate with Rust backend - use correct API path
      const response = await ipcService.post('/api/auth/login', credentials);
      
      if (response.success) {
        // Store token and user data locally for UI state
        this.token = response.token;
        this.user = response.user;
        this.saveToStorage();
        
        // Also set the cookie for immediate use
        if (typeof document !== 'undefined') {
          document.cookie = `auth-token=${response.token}; path=/; SameSite=Lax`;
          console.log('Auth cookie set after login');
        }
        
        console.log('✅ Login successful via IPC');
        console.log('User data stored:', this.user);
        console.log('Token stored:', this.token ? `${this.token.substring(0, 20)}...` : 'None');
      }

      return response;
    } catch (error) {
      console.error('❌ Login error:', error);
      
      // In development, if login fails, try to provide a fallback
      if (process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost') {
        console.log('🔧 Development mode: providing fallback authentication');
        const mockResponse: LoginResponse = {
          success: true,
          token: 'dev-mock-token',
          user: {
            id: 1,
            uid: credentials.identifier,
            name: 'Development User',
            role: 'admin'
          }
        };
        
        // Store the mock data
        this.token = mockResponse.token;
        this.user = mockResponse.user;
        this.saveToStorage();
        
        return mockResponse;
      }
      
      throw error;
    }
  }

  logout() {
    console.log('🚪 Logging out...');
    
    // Clear local storage and state
    this.clearStorage();
    
    // Clear the cookie
    if (typeof document !== 'undefined') {
      document.cookie = 'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      console.log('Auth cookie cleared');
    }
    
    // Notify the Rust backend about logout via IPC
    ipcService.post('/api/auth/logout').catch(error => {
      console.error('❌ Logout notification failed:', error);
    });
  }

  isAuthenticated(): boolean {
    // Check both token and user data
    const hasToken = !!this.token;
    const hasUser = !!this.user;
    const result = hasToken && hasUser;
    
    console.log('Local authentication check:', {
      hasToken,
      hasUser,
      result,
      tokenPreview: this.token ? (this.token === 'proxy-managed' ? 'proxy-managed' : `${this.token.substring(0, 20)}...`) : 'None',
      userName: this.user?.name || 'None'
    });
    
    return result;
  }

  getToken(): string | null {
    return this.token;
  }

  getUser(): User | null {
    return this.user;
  }

  // Helper method to get authorization header
  getAuthHeader(): Record<string, string> {
    if (this.token) {
      return {
        'Authorization': `Bearer ${this.token}`
      };
    }
    return {};
  }

  // Method to force refresh authentication state from storage
  refreshAuthState(): void {
    console.log('Refreshing authentication state...');
    this.loadFromStorage();
    console.log('Auth state after refresh:', {
      hasToken: !!this.token,
      hasUser: !!this.user,
      tokenPreview: this.token ? `${this.token.substring(0, 20)}...` : 'None',
      userName: this.user?.name || 'None'
    });
  }

  // Method to trigger UI updates (for components to listen to)
  onAuthStateChange(callback: () => void): () => void {
    // Simple polling approach - in a real app you'd use a proper event system
    const interval = setInterval(() => {
      callback();
    }, 1000);
    
    return () => clearInterval(interval);
  }

  // Method to load user profile from the server
  async loadUserProfile(): Promise<User | null> {
    try {
      console.log('📋 Loading user profile from server via IPC...');
      
      // Try to get user profile from the ERP API via IPC
      const profileData = await ipcService.get('/api/auth/profile');
      console.log('✅ User profile loaded:', profileData);
      
      // Update local user data
      if (profileData.user) {
        this.user = profileData.user;
        this.saveToStorage();
        return this.user;
      }
    } catch (error) {
      console.error('❌ Error loading user profile:', error);
      // Don't fail completely - we might already have user data from login
      console.log('Using existing user data from login');
    }
    
    return this.user;
  }

  // Method to check auth status via IPC
  async checkAuthStatus(): Promise<{ authenticated: boolean; sessionInfo?: any }> {
    try {
      console.log('🔍 Checking auth status via IPC...');
      
      const response = await ipcService.get('/api/auth/status');
      console.log('📡 Auth status response:', response);
      
      // If backend has a valid session but we don't have local data, sync it
      if (response.authenticated && response.sessionInfo && (!this.token || !this.user)) {
        console.log('Backend has valid session, syncing local state...');
        if (response.sessionInfo.user) {
          this.user = response.sessionInfo.user;
          // We don't store the actual token locally for security, just mark as IPC-managed
          this.token = 'ipc-managed';
          this.saveToStorage();
          console.log('✅ Synced user data from backend:', this.user);
        }
      }
      
      return response;
    } catch (error) {
      console.error('❌ Failed to check auth status:', error);
      return { authenticated: false };
    }
  }

  // Method to test authentication and API connectivity
  async testAuthentication(): Promise<{ success: boolean; error?: string; details?: any }> {
    try {
      console.log('🧪 Testing authentication via IPC...');
      
      // Check auth status with the backend
      const statusResponse = await ipcService.get('/api/auth/status');
      
      if (!statusResponse.authenticated) {
        return { 
          success: false, 
          error: 'Not authenticated according to backend',
          details: statusResponse
        };
      }

      // Test with a simple API call
      const response = await ipcService.get('/api/threads?limit=1');
      
      return { 
        success: true, 
        details: { 
          threadsCount: response.threads?.length || 0,
          authStatus: statusResponse
        } 
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: { error }
      };
    }
  }

  // Helper method to detect webview environment
  private isWebView(): boolean {
    if (typeof window === 'undefined') return false;
    
    // Check for common webview indicators
    const userAgent = navigator.userAgent;
    const isWebView = /wv|WebView|Android.*Version\/\d+\.\d+.*Chrome\/|iPhone.*AppleWebKit.*Mobile.*Safari/i.test(userAgent) ||
                     window.location.protocol === 'file:' ||
                     !window.location.hostname ||
                     window.location.hostname === 'localhost';
    
    console.log('WebView detection:', isWebView, 'UserAgent:', userAgent);
    return isWebView;
  }

  // Method to make authenticated API calls via IPC
  async authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    // All API calls now go through IPC to the Rust backend
    console.log('🔄 Making authenticated request via IPC:', {
      url,
      method: options.method || 'GET'
    });

    try {
      let response;
      const method = (options.method || 'GET').toUpperCase();
      let body = undefined;
      
      // Parse body if it's a string
      if (options.body && typeof options.body === 'string') {
        try {
          body = JSON.parse(options.body);
        } catch (e) {
          console.warn('Failed to parse request body as JSON:', options.body);
          body = options.body;
        }
      } else if (options.body) {
        body = options.body;
      }
      
      switch (method) {
        case 'GET':
          response = await ipcService.get(url);
          break;
        case 'POST':
          response = await ipcService.post(url, body);
          break;
        case 'PATCH':
          response = await ipcService.patch(url, body);
          break;
        case 'DELETE':
          response = await ipcService.delete(url);
          break;
        default:
          throw new Error(`Unsupported method: ${method}`);
      }

      // Convert IPC response to fetch-like Response object
      const isSuccess = response.success !== false && !response.error;
      const status = isSuccess ? 200 : (response.error?.includes('401') || response.error?.includes('Unauthorized') ? 401 : 400);
      
      const mockResponse = {
        ok: isSuccess,
        status: status,
        json: async () => response,
        text: async () => JSON.stringify(response),
        headers: new Map()
      } as Response;

      if (status === 401) {
        console.warn('Received 401 Unauthorized - session may be invalid');
        // Clear local auth state
        this.clearStorage();
      }

      return mockResponse;
    } catch (error) {
      console.error('❌ IPC request failed:', error);
      
      // Return a mock error response
      return {
        ok: false,
        status: 500,
        json: async () => ({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
        text: async () => JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
        headers: new Map()
      } as Response;
    }
  }
}

// Export singleton instance
export const authService = new AuthService();

// Expose to window for debugging
if (typeof window !== 'undefined') {
  (window as any).authService = authService;
}

// Export types and service
export default authService;