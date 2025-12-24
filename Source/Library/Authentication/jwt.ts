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
      // Use the Rust backend authentication proxy - port 8640
      const response = await fetch('http://localhost:8640/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Id': (window as any).sessionId || 'desktop-session'
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Login failed' }));
        throw new Error(errorData.error || 'Login failed');
      }

      const data: LoginResponse = await response.json();
      
      if (data.success) {
        // Store token and user data locally for UI state
        this.token = data.token;
        this.user = data.user;
        this.saveToStorage();
        
        // Also set the cookie for immediate use
        if (typeof document !== 'undefined') {
          document.cookie = `auth-token=${data.token}; path=/; SameSite=Lax`;
          console.log('Auth cookie set after login');
        }
        
        console.log('Login successful via Rust backend');
        console.log('User data stored:', this.user);
        console.log('Token stored:', this.token ? `${this.token.substring(0, 20)}...` : 'None');
      }

      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  logout() {
    console.log('Logging out...');
    
    // Clear local storage and state
    this.clearStorage();
    
    // Clear the cookie
    if (typeof document !== 'undefined') {
      document.cookie = 'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      console.log('Auth cookie cleared');
    }
    
    // Notify the Rust backend about logout
    if (typeof window !== 'undefined') {
      fetch('http://localhost:8640/auth/logout', {
        method: 'POST',
        headers: {
          'X-Session-Id': (window as any).sessionId || 'desktop-session'
        }
      }).catch(error => {
        console.error('Logout notification failed:', error);
      });
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
      console.log('Loading user profile from server...');
      
      // Try to get user profile from the ERP API
      const response = await this.authenticatedFetch('/api/auth/profile');
      
      if (response.ok) {
        const profileData = await response.json();
        console.log('User profile loaded:', profileData);
        
        // Update local user data
        if (profileData.user) {
          this.user = profileData.user;
          this.saveToStorage();
          return this.user;
        }
      } else if (response.status === 404) {
        // Profile endpoint might not exist, that's okay - we already have user data from login
        console.log('Profile endpoint not available, using existing user data');
        return this.user;
      } else {
        console.warn('Failed to load user profile:', response.status);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      // Don't fail completely - we might already have user data from login
      console.log('Using existing user data from login');
    }
    
    return this.user;
  }

  // Method to check proxy session status
  async checkProxySession(): Promise<{ authenticated: boolean; sessionInfo?: any }> {
    try {
      console.log('Checking proxy session status...');
      
      const sessionId = (window as any).sessionId || 'desktop-session';
      console.log('Using session ID:', sessionId);
      
      const response = await fetch('http://localhost:8640/auth/status', {
        headers: {
          'X-Session-Id': sessionId
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Proxy session status:', data);
        
        // If proxy has a valid session but we don't have local data, sync it
        if (data.authenticated && data.sessionInfo && (!this.token || !this.user)) {
          console.log('Proxy has valid session, syncing local state...');
          if (data.sessionInfo.user) {
            this.user = data.sessionInfo.user;
            // We don't store the actual token locally for security, just mark as proxy-managed
            this.token = 'proxy-managed';
            this.saveToStorage();
            console.log('Synced user data from proxy:', this.user);
          }
        }
        
        return data;
      } else {
        console.warn('Proxy session check failed:', response.status);
      }
    } catch (error) {
      console.error('Failed to check proxy session:', error);
    }
    
    return { authenticated: false };
  }

  // Method to test authentication and API connectivity
  async testAuthentication(): Promise<{ success: boolean; error?: string; details?: any }> {
    try {
      console.log('Testing authentication via Rust backend...');
      
      // Check auth status with the Rust backend
      const statusResponse = await fetch('http://localhost:8640/auth/status', {
        headers: {
          'X-Session-Id': (window as any).sessionId || 'desktop-session'
        }
      });
      
      if (!statusResponse.ok) {
        return { 
          success: false, 
          error: `Auth status check failed: ${statusResponse.status}`,
          details: { status: statusResponse.status }
        };
      }
      
      const statusData = await statusResponse.json();
      
      if (!statusData.authenticated) {
        return { 
          success: false, 
          error: 'Not authenticated according to Rust backend',
          details: statusData
        };
      }

      // Test with a simple API call through the proxy
      const response = await this.authenticatedFetch('/api/threads?limit=1');
      
      if (response.ok) {
        const data = await response.json();
        return { 
          success: true, 
          details: { 
            status: response.status, 
            threadsCount: data.chats?.length || 0,
            authStatus: statusData
          } 
        };
      } else {
        const errorText = await response.text().catch(() => 'Unknown error');
        return { 
          success: false, 
          error: `HTTP ${response.status}: ${errorText}`,
          details: { status: response.status, authStatus: statusData }
        };
      }
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

  // Method to make authenticated API calls
  async authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    // All API calls now go through the Rust authentication proxy
    // The proxy handles authentication automatically using the session ID
    
    const sessionId = (window as any).sessionId || 'desktop-session';
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Session-Id': sessionId,
      ...(options.headers as Record<string, string> || {}),
    };

    console.log('Making authenticated request via Rust proxy:', {
      url,
      sessionId,
      method: options.method || 'GET'
    });

    const requestOptions = {
      ...options,
      headers,
      mode: 'cors' as RequestMode,
    };

    const response = await fetch(url, requestOptions);

    console.log('Response status:', response.status);
    
    if (response.status === 401) {
      console.warn('Received 401 Unauthorized - session may be invalid');
      // Clear local auth state
      this.clearStorage();
    }

    return response;
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