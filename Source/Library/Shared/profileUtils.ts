// Profile utilities for handling profile picture URLs
import { getApiUrl } from '../utils/env';

export function getProfileImageUrl(profilePicture?: string | null): string | undefined {
  if (!profilePicture) return undefined;
  
  // Always use the proxy server for profile images
  return `${getApiUrl()}${profilePicture}`;
}

export function getProfileInitial(name?: string, uid?: string): string {
  return (name?.charAt(0) || uid?.charAt(0) || 'U').toUpperCase();
}