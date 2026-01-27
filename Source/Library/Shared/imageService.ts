// Image Service for loading profile pictures via IPC
import ipcService from './ipcService';

class ImageService {
  private imageCache = new Map<string, string>();

  /**
   * Load a profile picture via IPC
   * This converts the image URL to use IPC instead of direct HTTP requests
   */
  async loadProfilePicture(profilePictureUrl: string): Promise<string> {
    try {
      // Check cache first
      if (this.imageCache.has(profilePictureUrl)) {
        return this.imageCache.get(profilePictureUrl)!;
      }

      console.log('🖼️ Loading profile picture via IPC:', profilePictureUrl);

      // Convert the URL to use IPC
      let ipcPath = profilePictureUrl;
      
      // Handle different URL formats
      if (profilePictureUrl.startsWith('http://localhost:8640/')) {
        // Convert localhost:8640 URLs to ERP server paths
        ipcPath = profilePictureUrl.replace('http://localhost:8640/', '/api/fileupload/profiles/');
      } else if (profilePictureUrl.startsWith('/api/fileupload/')) {
        // Already in correct format
        ipcPath = profilePictureUrl;
      } else if (profilePictureUrl.startsWith('http://10.10.60.8:1669/')) {
        // Convert direct ERP URLs to relative paths
        ipcPath = profilePictureUrl.replace('http://10.10.60.8:1669/', '/');
      } else {
        // Assume it's a relative path that needs the fileupload prefix
        ipcPath = `/api/fileupload/profiles/${profilePictureUrl}`;
      }

      console.log('🖼️ Converted URL to IPC path:', ipcPath);

      // Make IPC request for the image
      const response = await ipcService.get(ipcPath);

      if (response.success && response.imageData) {
        // Cache the base64 image data
        this.imageCache.set(profilePictureUrl, response.imageData);
        console.log('✅ Profile picture loaded successfully');
        return response.imageData;
      } else {
        console.error('❌ Failed to load profile picture:', response.error);
        // Return a default avatar or placeholder
        return this.getDefaultAvatar();
      }
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