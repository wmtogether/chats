import { useState, useEffect } from 'react';
import { ExternalLink, Globe, Image as ImageIcon, Video, FileText } from 'lucide-react';
import { fetchUrlMetadata, type LinkMetadata } from '../../Library/api/metadata';

interface HyperlinkProps {
  url: string;
  displayText?: string;
}

export function Hyperlink({ url, displayText }: HyperlinkProps) {
  const [metadata, setMetadata] = useState<LinkMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchMetadata(url);
  }, [url]);

  const fetchMetadata = async (targetUrl: string) => {
    try {
      setLoading(true);
      setError(false);

      // Fetch real metadata from the URL
      const metadata = await fetchUrlMetadata(targetUrl);
      setMetadata(metadata);
    } catch (err) {
      console.error('Failed to fetch metadata:', err);
      setError(true);
      // Fallback metadata
      setMetadata({
        url: targetUrl,
        title: displayText || extractDomainFromUrl(targetUrl),
        type: 'website',
        favicon: `https://www.google.com/s2/favicons?domain=${extractDomainFromUrl(targetUrl)}&sz=32`
      });
    } finally {
      setLoading(false);
    }
  };

  const extractDomainFromUrl = (url: string): string => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  const getTypeIcon = (type?: string) => {
    switch (type) {
      case 'image': return ImageIcon;
      case 'video': return Video;
      case 'article': return FileText;
      default: return Globe;
    }
  };

  const TypeIcon = getTypeIcon(metadata?.type);

  if (loading) {
    return (
      <div className="my-2 p-3 bg-surface border border-outline rounded-lg animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-surface-variant rounded"></div>
          <div className="flex-1">
            <div className="h-4 bg-surface-variant rounded mb-2"></div>
            <div className="h-3 bg-surface-variant rounded w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !metadata) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-primary hover:underline"
      >
        <ExternalLink size={14} />
        {displayText || url}
      </a>
    );
  }

  // For image type, show larger preview
  if (metadata.type === 'image') {
    return (
      <div className="my-2 max-w-md">
        <a
          href={metadata.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block group"
        >
          <img
            src={metadata.image || metadata.url}
            alt={metadata.title || 'Image'}
            className="w-full rounded-lg border border-outline shadow-sm group-hover:shadow-md transition-shadow cursor-pointer"
            loading="lazy"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
          <div className="mt-2 flex items-center gap-2 text-sm text-on-surface-variant">
            <ExternalLink size={14} />
            <span className="truncate">{metadata.url}</span>
          </div>
        </a>
      </div>
    );
  }

  // Standard link preview card
  return (
    <div className="my-2 max-w-md">
      <a
        href={metadata.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block group"
      >
        <div className="bg-surface border border-outline rounded-lg overflow-hidden hover:shadow-md transition-shadow">
          {/* Image preview */}
          {metadata.image && (
            <div className="aspect-video bg-surface-variant relative overflow-hidden">
              <img
                src={metadata.image}
                alt={metadata.title || 'Preview'}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                loading="lazy"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.parentElement!.style.display = 'none';
                }}
              />
              {metadata.type === 'video' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <div className="w-12 h-12 bg-black/60 rounded-full flex items-center justify-center">
                    <Video className="w-6 h-6 text-white ml-1" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Content */}
          <div className="p-3">
            <div className="flex items-start gap-3">
              {/* Favicon or type icon */}
              <div className="flex-shrink-0 mt-0.5">
                {metadata.favicon ? (
                  <img
                    src={metadata.favicon}
                    alt=""
                    className="w-4 h-4"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const fallback = target.nextElementSibling as HTMLElement;
                      if (fallback) fallback.style.display = 'block';
                    }}
                  />
                ) : null}
                <TypeIcon 
                  size={16} 
                  className={`text-on-surface-variant ${metadata.favicon ? 'hidden' : 'block'}`} 
                />
              </div>

              <div className="flex-1 min-w-0">
                {/* Site name */}
                {metadata.siteName && (
                  <div className="text-xs text-on-surface-variant mb-1 truncate">
                    {metadata.siteName}
                  </div>
                )}

                {/* Title */}
                <div className="font-medium text-on-surface mb-1 line-clamp-2 group-hover:text-primary transition-colors">
                  {metadata.title || 'Untitled'}
                </div>

                {/* Description */}
                {metadata.description && (
                  <div className="text-sm text-on-surface-variant line-clamp-2">
                    {metadata.description}
                  </div>
                )}

                {/* URL */}
                <div className="flex items-center gap-1 mt-2 text-xs text-on-surface-variant">
                  <ExternalLink size={12} />
                  <span className="truncate">{extractDomainFromUrl(metadata.url)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </a>
    </div>
  );
}

export default Hyperlink;