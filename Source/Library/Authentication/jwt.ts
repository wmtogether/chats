// JWT Authentication Library


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
      console.log('🔐 Logging in via WebUI API...');
      
      const response = await fetch('http://10.10.60.8:1669/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        // Store token and user data locally for UI state
        this.token = data.token;
        this.user = data.user;
        this.saveToStorage();
        
        // Also set the cookie for immediate use
        if (typeof document !== 'undefined') {
          document.cookie = `auth-token=${data.token}; path=/; SameSite=Lax`;
          console.log('Auth cookie set after login');
        }
        
        console.log('✅ Login successful');
        console.log('User data stored:', this.user);
        console.log('Token stored:', this.token ? `${this.token.substring(0, 20)}...` : 'None');
      } else {
        throw new Error(data.error || 'Login failed. Please check your credentials.');
      }

      return data;
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

    async logout() {
    console.log('🚪 Logging out...');
    
    // Clear local storage and state
    this.clearStorage();
    
    // Clear the cookie
    if (typeof document !== 'undefined') {
      document.cookie = 'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      console.log('Auth cookie cleared');
    }
    
    // Notify the backend about logout
    try {
      await fetch('http://10.10.60.8:1669/api/auth/logout', { method: 'POST' });
      console.log('✅ Logout notification sent to backend');
    } catch (error) {
      console.error('❌ Logout notification failed:', error);
    }
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
      console.log('📋 Loading user profile from server...');
      
      const response = await fetch('http://10.10.60.8:1669/api/auth/profile', {
        method: 'GET',
        headers: this.getAuthHeader(),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch profile: ${response.statusText}`);
      }

      const profileData = await response.json();
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
      console.log('🔍 Checking auth status...');
      
      const response = await fetch('http://10.10.60.8:1669/api/auth/status', {
        method: 'GET',
        headers: this.getAuthHeader(),
      });

      if (!response.ok) {
        throw new Error(`Failed to check auth status: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('📡 Auth status response:', data);
      
      // If backend has a valid session but we don't have local data, sync it
      if (data.authenticated && data.sessionInfo && (!this.token || !this.user)) {
        console.log('Backend has valid session, syncing local state...');
        if (data.sessionInfo.user) {
          this.user = data.sessionInfo.user;
          this.saveToStorage();
          console.log('✅ Synced user data from backend:', this.user);
        }
      }
      
      return data;
    } catch (error) {
      console.error('❌ Failed to check auth status:', error);
      return { authenticated: false };
    }
  }

  // Method to test authentication and API connectivity
  async testAuthentication(): Promise<{ success: boolean; error?: string; details?: any }> {
    try {
      console.log('🧪 Testing authentication...');
      
      // Check auth status with the backend
      const statusResponse = await this.checkAuthStatus(); // Use the refactored checkAuthStatus
      
      if (!statusResponse.authenticated) {
        return { 
          success: false, 
          error: 'Not authenticated according to backend',
          details: statusResponse
        };
      }

      // Test with a simple API call to a protected endpoint
      const threadsResponse = await fetch('http://10.10.60.8:1669/api/threads?limit=1', {
        method: 'GET',
        headers: this.getAuthHeader(),
      });

      if (!threadsResponse.ok) {
        throw new Error(`Failed to fetch threads: ${threadsResponse.statusText}`);
      }
      const threadsData = await threadsResponse.json();
      
      return { 
        success: true, 
        details: { 
          threadsCount: threadsData.threads?.length || 0,
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


}

// Export singleton instance
export const authService = new AuthService();

// Expose to window for debugging
if (typeof window !== 'undefined') {
  (window as any).authService = authService;
}

// Export types and service
export default authService;