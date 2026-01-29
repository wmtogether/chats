

import React, { useState } from 'react';
import { ImageOff, Download } from 'lucide-react';
import { getApiUrl } from '../Library/utils/env';
import { useDownload } from '../Library/hooks/useDownload';
import DownloadProgress from './DownloadProgress';

interface ImageAttachmentProps {
    src: string;
    alt: string;
    onClick: () => void;
}

const ImageAttachment: React.FC<ImageAttachmentProps> = ({ src, alt, onClick }) => {
    const [hasError, setHasError] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const { startDownload, downloads, clearDownload } = useDownload();

    // Convert relative URL to absolute URL using the API server
    const fullImageUrl = src.startsWith('http') ? src : `${getApiUrl()}${src}`;

    const handleImageLoad = () => {
        setIsLoading(false);
        setHasError(false);
    };

    const handleImageError = () => {
        console.error('Image failed to load:', fullImageUrl);
        setHasError(true);
        setIsLoading(false);
    };

    const handleDownload = async (e: React.MouseEvent) => {
        e.stopPropagation();
        
        try {
            const filename = src.split('/').pop() || 'image';
            await startDownload(fullImageUrl, filename);
        } catch (error) {
            console.error('Failed to start download:', error);
        }
    };

    // Find active download for this image
    const activeDownload = downloads.find(d => d.url === fullImageUrl);

    return (
        <div className="relative">
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-surface-container border border-outline-variant rounded-2xl min-h-[100px] z-10">
                    <div className="animate-pulse flex items-center gap-2 text-on-surface-variant">
                        <div className="w-6 h-6 bg-outline-variant rounded animate-pulse"></div>
                        <span className="body-small">Loading image...</span>
                    </div>
                </div>
            )}
            
            {hasError ? (
                <div className="flex items-center gap-3 p-4 bg-surface-container border border-outline-variant rounded-2xl text-on-surface-variant max-w-sm w-full">
                    <ImageOff className="h-6 w-6 text-error flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                        <p className="body-medium font-semibold text-on-surface">Unable to load image</p>
                        <p className="body-small text-on-surface-variant truncate">{alt}</p>
                        <p className="body-small text-error truncate">{src}</p>
                    </div>
                    <button
                        onClick={handleDownload}
                        className="p-2 hover:bg-surface-variant rounded-full text-on-surface-variant hover:text-on-surface transition-colors"
                        title="Download image"
                    >
                        <Download className="h-4 w-4" />
                    </button>
                </div>
            ) : (
                <div className="relative group">
                    <img
                        src={fullImageUrl}
                        alt={alt}
                        className="max-w-full max-h-96 rounded-2xl border border-outline-variant shadow-sm cursor-pointer hover:shadow-md transition-all duration-200"
                        onClick={onClick}
                        onError={handleImageError}
                        onLoad={handleImageLoad}
                        loading="lazy"
                    />
                    
                    {/* Download button overlay */}
                    <button
                        onClick={handleDownload}
                        className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                        title="Download image"
                    >
                        <Download className="h-4 w-4" />
                    </button>
                </div>
            )}
            
            {/* Show download progress if active */}
            {activeDownload && (
                <div className="mt-2">
                    <DownloadProgress 
                        download={activeDownload}
                        onClear={() => clearDownload(`${activeDownload.url}_${activeDownload.filename}`)}
                        compact
                    />
                </div>
            )}
        </div>
    );
};


export default ImageAttachment;
