// Authentication Debug Utilities

export function debugAuthState() {
  if (typeof window === 'undefined') {
    console.log('Debug: Running in server environment');
    return;
  }

  console.log('=== Authentication Debug Info ===');
  
  // Environment info
  console.log('User Agent:', navigator.userAgent);
  console.log('Location:', window.location.href);
  console.log('Protocol:', window.location.protocol);
  console.log('Hostname:', window.location.hostname);
  
  // Check localStorage
  const token = localStorage.getItem('auth-token');
  const user = localStorage.getItem('auth-user');
  console.log('LocalStorage token:', token ? `${token.substring(0, 20)}...` : 'None');
  console.log('LocalStorage user:', user ? JSON.parse(user) : 'None');
  
  // Check cookies
  console.log('All cookies:', document.cookie);
  const cookies = document.cookie.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    if (key && value) acc[key] = value;
    return acc;
  }, {} as Record<string, string>);
  
  console.log('Parsed cookies:', cookies);
  console.log('Auth cookie:', cookies['auth-token'] ? `${cookies['auth-token'].substring(0, 20)}...` : 'None');
  
  // Check if they match
  const cookieToken = cookies['auth-token'];
  if (token && cookieToken) {
    console.log('Token match:', token === cookieToken ? '✅ Match' : '❌ Mismatch');
  } else if (token && !cookieToken) {
    console.log('⚠️ Token in localStorage but no cookie');
  } else if (!token && cookieToken) {
    console.log('⚠️ Cookie exists but no token in localStorage');
  }
  
  // Test auth service state
  try {
    const authService = (window as any).authService || require('../Authentication/jwt').authService;
    if (authService) {
      console.log('Auth Service State:');
      console.log('- isAuthenticated():', authService.isAuthenticated());
      console.log('- getUser():', authService.getUser());
      console.log('- getToken():', authService.getToken() ? `${authService.getToken().substring(0, 20)}...` : 'None');
    }
  } catch (e) {
    console.log('Could not access auth service:', e);
  }
  
  console.log('================================');
}

export function setAuthCookie(token: string) {
  if (typeof document !== 'undefined') {
    document.cookie = `auth-token=${token}; path=/; SameSite=Lax`;
    console.log('Auth cookie set:', `${token.substring(0, 20)}...`);
  }
}

export function clearAuthCookie() {
  if (typeof document !== 'undefined') {
    document.cookie = 'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    console.log('Auth cookie cleared');
  }
}

export function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null;
  
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [key, value] = cookie.trim().split('=');
    if (key === name) {
      return value;
    }
  }
  return null;
}