// API utility for fetching URL metadata from real websites
export interface LinkMetadata {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  url: string;
  favicon?: string;
  type?: 'website' | 'image' | 'video' | 'article';
}

// Cache for metadata to avoid repeated requests
const metadataCache = new Map<string, LinkMetadata>();

export async function fetchUrlMetadata(url: string): Promise<LinkMetadata> {
  // Check cache first
  if (metadataCache.has(url)) {
    return metadataCache.get(url)!;
  }

  try {
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    // Direct fetch since WRY bypasses CORS
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const contentType = response.headers.get('content-type') || '';
    
    // Handle different content types
    if (contentType.includes('text/html') || contentType.includes('application/xhtml')) {
      const htmlContent = await response.text();
      const metadata = extractMetadataFromHtml(htmlContent, url);
      
      // Cache the result
      metadataCache.set(url, metadata);
      return metadata;
    } else if (contentType.startsWith('image/')) {
      // Direct image URL
      const metadata: LinkMetadata = {
        url,
        title: url.split('/').pop()?.split('?')[0] || 'Image',
        description: 'Direct image link',
        image: url,
        type: 'image',
        siteName: extractDomainFromUrl(url),
        favicon: `https://www.google.com/s2/favicons?domain=${extractDomainFromUrl(url)}&sz=32`
      };
      
      metadataCache.set(url, metadata);
      return metadata;
    } else if (contentType.includes('application/pdf')) {
      // PDF file
      const metadata: LinkMetadata = {
        url,
        title: url.split('/').pop()?.split('?')[0] || 'PDF Document',
        description: 'PDF document',
        type: 'article',
        siteName: extractDomainFromUrl(url),
        favicon: `https://www.google.com/s2/favicons?domain=${extractDomainFromUrl(url)}&sz=32`
      };
      
      metadataCache.set(url, metadata);
      return metadata;
    } else {
      // Other content types
      const filename = url.split('/').pop()?.split('?')[0] || extractDomainFromUrl(url);
      const metadata: LinkMetadata = {
        url,
        title: filename,
        description: `File (${contentType.split(';')[0]})`,
        type: 'website',
        siteName: extractDomainFromUrl(url),
        favicon: `https://www.google.com/s2/favicons?domain=${extractDomainFromUrl(url)}&sz=32`
      };
      
      metadataCache.set(url, metadata);
      return metadata;
    }
  } catch (error) {
    console.error('Error fetching metadata for', url, ':', error);
    
    // Fallback metadata
    const fallbackMetadata: LinkMetadata = {
      url,
      title: extractDomainFromUrl(url),
      description: 'Unable to load preview',
      type: getUrlType(url),
      favicon: `https://www.google.com/s2/favicons?domain=${extractDomainFromUrl(url)}&sz=32`
    };
    
    // Cache the fallback too (but with shorter TTL)
    metadataCache.set(url, fallbackMetadata);
    
    return fallbackMetadata;
  }
}

function extractMetadataFromHtml(html: string, url: string): LinkMetadata {
  // Create a temporary DOM parser
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Extract Open Graph metadata
  const ogTitle = getMetaContent(doc, 'property', 'og:title');
  const ogDescription = getMetaContent(doc, 'property', 'og:description');
  const ogImage = getMetaContent(doc, 'property', 'og:image');
  const ogSiteName = getMetaContent(doc, 'property', 'og:site_name');
  const ogType = getMetaContent(doc, 'property', 'og:type');
  const ogUrl = getMetaContent(doc, 'property', 'og:url');
  
  // Extract Twitter Card metadata
  const twitterTitle = getMetaContent(doc, 'name', 'twitter:title');
  const twitterDescription = getMetaContent(doc, 'name', 'twitter:description');
  const twitterImage = getMetaContent(doc, 'name', 'twitter:image');
  const twitterSite = getMetaContent(doc, 'name', 'twitter:site');
  
  // Extract standard HTML metadata
  const htmlTitle = doc.querySelector('title')?.textContent?.trim();
  const metaDescription = getMetaContent(doc, 'name', 'description');
  const metaKeywords = getMetaContent(doc, 'name', 'keywords');
  const metaAuthor = getMetaContent(doc, 'name', 'author');
  
  // Extract JSON-LD structured data
  const jsonLd = extractJsonLd(doc);
  
  // Get favicon
  const favicon = extractFavicon(doc, url);
  
  // Determine content type
  const type = determineContentType(ogType, url, jsonLd);
  
  // Clean and prioritize title
  const title = cleanText(
    ogTitle || 
    twitterTitle || 
    jsonLd?.name || 
    jsonLd?.headline || 
    htmlTitle || 
    extractDomainFromUrl(url)
  );
  
  // Clean and prioritize description
  const description = cleanText(
    ogDescription || 
    twitterDescription || 
    jsonLd?.description || 
    metaDescription
  );
  
  // Resolve and validate image URL
  const imageUrl = resolveImageUrl(
    ogImage || 
    twitterImage || 
    jsonLd?.image, 
    url
  );
  
  // Determine site name
  const siteName = cleanText(
    ogSiteName || 
    twitterSite?.replace('@', '') || 
    jsonLd?.publisher?.name || 
    extractDomainFromUrl(url)
  );
  
  // Build metadata object
  const metadata: LinkMetadata = {
    url: ogUrl || url,
    title,
    description,
    image: imageUrl,
    siteName,
    favicon,
    type
  };
  
  return metadata;
}

function extractJsonLd(doc: Document): any {
  try {
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      const content = script.textContent?.trim();
      if (content) {
        const data = JSON.parse(content);
        // Handle both single objects and arrays
        const jsonLd = Array.isArray(data) ? data[0] : data;
        if (jsonLd && (jsonLd['@type'] === 'Article' || jsonLd['@type'] === 'WebPage' || jsonLd['@type'] === 'VideoObject')) {
          return jsonLd;
        }
      }
    }
  } catch (error) {
    console.warn('Failed to parse JSON-LD:', error);
  }
  return null;
}

function cleanText(text: string | undefined): string | undefined {
  if (!text) return undefined;
  return text.trim().replace(/\s+/g, ' ').substring(0, 300); // Limit length
}

function getMetaContent(doc: Document, attribute: string, value: string): string | undefined {
  const element = doc.querySelector(`meta[${attribute}="${value}"]`);
  return element?.getAttribute('content') || undefined;
}

function extractFavicon(doc: Document, baseUrl: string): string {
  // Try to find favicon from various sources
  const iconSelectors = [
    'link[rel="icon"]',
    'link[rel="shortcut icon"]',
    'link[rel="apple-touch-icon"]',
    'link[rel="apple-touch-icon-precomposed"]'
  ];
  
  for (const selector of iconSelectors) {
    const element = doc.querySelector(selector);
    if (element) {
      const href = element.getAttribute('href');
      if (href) {
        return resolveImageUrl(href, baseUrl) || `https://www.google.com/s2/favicons?domain=${extractDomainFromUrl(baseUrl)}&sz=32`;
      }
    }
  }
  
  // Fallback to Google's favicon service
  return `https://www.google.com/s2/favicons?domain=${extractDomainFromUrl(baseUrl)}&sz=32`;
}

function resolveImageUrl(imageUrl: string | undefined, baseUrl: string): string | undefined {
  if (!imageUrl) return undefined;
  
  try {
    // If it's already a full URL, return as is
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }
    
    // If it's a protocol-relative URL
    if (imageUrl.startsWith('//')) {
      return `https:${imageUrl}`;
    }
    
    // If it's a relative URL, resolve it against the base URL
    const base = new URL(baseUrl);
    return new URL(imageUrl, base.origin).href;
  } catch {
    return undefined;
  }
}

function determineContentType(ogType: string | undefined, url: string, jsonLd?: any): 'website' | 'image' | 'video' | 'article' {
  // Check JSON-LD structured data first
  if (jsonLd) {
    const type = jsonLd['@type'];
    if (type === 'Article' || type === 'NewsArticle' || type === 'BlogPosting') return 'article';
    if (type === 'VideoObject' || type === 'Movie') return 'video';
    if (type === 'ImageObject') return 'image';
  }
  
  // Check Open Graph type
  if (ogType) {
    if (ogType.includes('video')) return 'video';
    if (ogType.includes('article')) return 'article';
    if (ogType.includes('image')) return 'image';
  }
  
  // Check URL patterns
  return getUrlType(url);
}

function getUrlType(url: string): 'website' | 'image' | 'video' | 'article' {
  const urlLower = url.toLowerCase();
  
  // Check if it's an image URL
  if (/\.(jpg|jpeg|png|gif|webp|bmp|svg|ico|tiff)(\?.*)?$/i.test(url)) {
    return 'image';
  }
  
  // Check for video platforms and file extensions
  if (urlLower.includes('youtube.com') || 
      urlLower.includes('youtu.be') || 
      urlLower.includes('vimeo.com') ||
      urlLower.includes('dailymotion.com') ||
      urlLower.includes('twitch.tv') ||
      urlLower.includes('tiktok.com') ||
      /\.(mp4|webm|ogg|avi|mov|wmv|flv|mkv)(\?.*)?$/i.test(url)) {
    return 'video';
  }
  
  // Check for article/blog patterns
  if (urlLower.includes('/article/') || 
      urlLower.includes('/blog/') || 
      urlLower.includes('/post/') ||
      urlLower.includes('/news/') ||
      urlLower.includes('/story/') ||
      urlLower.includes('medium.com') ||
      urlLower.includes('substack.com') ||
      urlLower.includes('dev.to')) {
    return 'article';
  }
  
  return 'website';
}

function extractDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

// Clear cache periodically (optional)
export function clearMetadataCache(): void {
  metadataCache.clear();
}

// Get cache size for debugging
export function getMetadataCacheSize(): number {
  return metadataCache.size;
}