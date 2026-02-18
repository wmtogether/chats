import { useState } from 'react';
import { X, Copy, Check, Share2 } from 'lucide-react';
import { useToast } from '../Library/hooks/useToast';

interface InviteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  chatUuid: string;
  chatName: string;
}

export default function InviteDialog({ isOpen, onClose, chatUuid, chatName }: InviteDialogProps) {
  const [copied, setCopied] = useState(false);
  const { addToast } = useToast();

  if (!isOpen) return null;

  // Generate invite URL
  const inviteUrl = `${window.location.origin}${window.location.pathname}?chat=${chatUuid}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      addToast({ message: 'Invite link copied to clipboard!', type: 'success' });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      addToast({ message: 'Failed to copy link', type: 'error' });
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${chatName}`,
          text: `Join the conversation in ${chatName}`,
          url: inviteUrl,
        });
      } catch (error) {
        console.error('Failed to share:', error);
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-surface rounded-3xl shadow-xl max-w-md w-full border border-outline-variant">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-outline-variant">
          <h2 className="text-xl font-semibold text-on-surface">Invite to Chat</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-variant rounded-full transition-colors"
          >
            <X size={20} className="text-on-surface-variant" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div>
            <p className="text-sm text-on-surface-variant mb-2">
              Share this link to invite others to join <span className="font-medium text-on-surface">{chatName}</span>
            </p>
          </div>

          {/* Invite Link */}
          <div className="bg-surface-container border border-outline-variant rounded-2xl p-4">
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-on-surface-variant mb-1">Invite Link</p>
                <p className="text-sm text-on-surface font-mono truncate">{inviteUrl}</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleCopyLink}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary text-on-primary rounded-full hover:bg-primary/90 transition-colors"
            >
              {copied ? (
                <>
                  <Check size={18} />
                  <span className="font-medium">Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={18} />
                  <span className="font-medium">Copy Link</span>
                </>
              )}
            </button>

            {navigator.share && (
              <button
                onClick={handleShare}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-surface-container border border-outline-variant text-on-surface rounded-full hover:bg-surface-variant transition-colors"
              >
                <Share2 size={18} />
                <span className="font-medium">Share</span>
              </button>
            )}
          </div>

          {/* Info */}
          <div className="bg-primary-container/20 border border-primary/20 rounded-2xl p-4">
            <p className="text-xs text-on-surface-variant">
              💡 Anyone with this link can view and join this chat. The link will automatically select this chat when opened.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
