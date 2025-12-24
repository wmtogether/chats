// Profile utilities for handling profile picture URLs
export function getProfileImageUrl(profilePicture?: string | null): string | undefined {
  if (!profilePicture) return undefined;
  
  // Always use the proxy server for profile images
  return `http://localhost:8640${profilePicture}`;
}

export function getProfileInitial(name?: string, uid?: string): string {
  return (name?.charAt(0) || uid?.charAt(0) || 'U').toUpperCase();
}