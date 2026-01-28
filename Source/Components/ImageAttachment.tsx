import React, { useState } from 'react';
import { ImageOff } from 'lucide-react';

interface ImageAttachmentProps {
    src: string;
    alt: string;
    onClick: () => void;
}

const ImageAttachment: React.FC<ImageAttachmentProps> = ({ src, alt, onClick }) => {
    const [hasError, setHasError] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const handleError = () => {
        setHasError(true);
        setIsLoading(false);
    };

    const handleLoad = () => {
        setIsLoading(false);
    };

    if (hasError) {
        return (
            <div className="flex items-center gap-3 p-4 bg-surface-container border border-outline-variant rounded-2xl text-on-surface-variant max-w-sm w-full">
                <ImageOff className="h-6 w-6 text-error flex-shrink-0" />
                <div className="min-w-0 flex-1">
                    <p className="body-medium font-semibold text-on-surface">Unable to load image</p>
                    <p className="body-small text-on-surface-variant truncate">{alt}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="relative">
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-surface-container border border-outline-variant rounded-2xl">
                    <div className="animate-pulse flex items-center gap-2 text-on-surface-variant">
                        <div className="w-6 h-6 bg-outline-variant rounded animate-pulse"></div>
                        <span className="body-small">Loading image...</span>
                    </div>
                </div>
            )}
            <img
                src={src}
                alt={alt}
                className="max-w-full max-h-96 rounded-2xl border border-outline-variant shadow-sm cursor-pointer hover:shadow-md transition-all duration-200"
                onClick={onClick}
                onError={handleError}
                onLoad={handleLoad}
                loading="lazy"
                style={{ display: isLoading ? 'none' : 'block' }}
            />
        </div>
    );
};

export default ImageAttachment;
