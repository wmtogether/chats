// Environment configuration utility
// Centralized place for all environment variables

/**
 * Get the API base URL from environment variables
 * Falls back to localhost:5669 if not set
 */
export const getApiUrl = (): string => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5669';
  return apiUrl;
};

/**
 * Get the WebSocket URL from the API URL
 * Converts http:// to ws:// and https:// to wss://
 */
export const getWebSocketUrl = (): string => {
  const apiUrl = getApiUrl();
  const wsUrl = apiUrl.replace(/^https/, 'wss');
  return `${wsUrl}/ws`;
};

/**
 * Check if we're in development mode
 */
export const isDevelopment = (): boolean => {
  return import.meta.env.MODE === 'development';
};

/**
 * Check if we're in production mode
 */
export const isProduction = (): boolean => {
  return import.meta.env.MODE === 'production';
};

/**
 * Get the current environment mode
 */
export const getEnvironment = (): string => {
  return import.meta.env.MODE || 'development';
};