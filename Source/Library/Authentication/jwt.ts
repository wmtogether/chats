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
      // Use direct IP to ERP server
      const response = await fetch('http://10.10.60.8:1669/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
        mode: 'cors', // Enable CORS
        credentials: 'omit', // Don't send credentials to avoid CORS issues
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Login failed');
      }

      const data: LoginResponse = await response.json();
      
      // Store token and user data
      this.token = data.token;
      this.user = data.user;
      this.saveToStorage();

      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  logout() {
    this.clearStorage();
    // Optionally call logout endpoint
    // fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  }

  isAuthenticated(): boolean {
    return !!this.token && !!this.user;
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

  // Method to make authenticated API calls
  async authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    // Convert relative URLs to direct IP
    const fullUrl =  `http://10.10.60.8:1669${url}`;
    
    const headers = {
      'Content-Type': 'application/json',
      ...this.getAuthHeader(),
      ...options.headers,
    };

    return fetch(fullUrl, {
      ...options,
      headers,
      mode: 'cors',
      credentials: 'omit', // Don't send credentials to avoid CORS issues
    });
  }
}

// Export singleton instance
export const authService = new AuthService();

// Export types and service
export default authService;