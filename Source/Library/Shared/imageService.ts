// Image Service for loading profile pictures
import { getApiUrl } from '../utils/env';

const API_BASE_URL = getApiUrl();

class ImageService {
  private imageCache = new Map<string, string>();

  /**
   * Load a profile picture via direct HTTP request
   */
  async loadProfilePicture(profilePictureUrl: string): Promise<string> {
    try {
      // Check cache first
      if (this.imageCache.has(profilePictureUrl)) {
        return this.imageCache.get(profilePictureUrl)!;
      }

      console.log('🖼️ Loading profile picture:', profilePictureUrl);

      let fullUrl = profilePictureUrl;
      // If it's a relative path, construct the full URL
      if (!profilePictureUrl.startsWith('http')) {
        fullUrl = `${API_BASE_URL}/api/fileupload/profiles/${profilePictureUrl}`;
      }

      // Make direct HTTP request for the image
      const response = await fetch(fullUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }

      // Read response as ArrayBuffer to convert to base64
      const blob = await response.blob();
      const reader = new FileReader();
      
      return new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64data = reader.result as string;
          this.imageCache.set(profilePictureUrl, base64data);
          console.log('✅ Profile picture loaded successfully');
          resolve(base64data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      
    } catch (error) {
      console.error('❌ Error loading profile picture:', error);
      return this.getDefaultAvatar();
    }
  }

  /**
   * Get a default avatar as base64 data URL
   */
  private getDefaultAvatar(): string {
    // Simple SVG avatar as base64
    const svgAvatar = `
      <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
        <circle cx="20" cy="20" r="20" fill="#e0e0e0"/>
        <circle cx="20" cy="16" r="6" fill="#9e9e9e"/>
        <path d="M8 32c0-6.627 5.373-12 12-12s12 5.373 12 12" fill="#9e9e9e"/>
      </svg>
    `;
    
    return `data:image/svg+xml;base64,${btoa(svgAvatar)}`;
  }

  /**
   * Clear the image cache
   */
  clearCache(): void {
    this.imageCache.clear();
    console.log('🖼️ Image cache cleared');
  }

  /**
   * Preload multiple profile pictures
   */
  async preloadProfilePictures(urls: string[]): Promise<void> {
    console.log('🖼️ Preloading profile pictures:', urls.length);
    
    const promises = urls.map(url => 
      this.loadProfilePicture(url).catch(error => {
        console.warn('Failed to preload profile picture:', url, error);
        return this.getDefaultAvatar();
      })
    );

    await Promise.all(promises);
    console.log('✅ Profile pictures preloaded');
  }

  /**
   * Get cached image or return default
   */
  getCachedImage(url: string): string {
    return this.imageCache.get(url) || this.getDefaultAvatar();
  }
}

// Export singleton instance
export const imageService = new ImageService();
export default imageService;