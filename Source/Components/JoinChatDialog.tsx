import { Users, UserPlus, UserMinus } from 'lucide-react';

interface JoinChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  chatName: string;
  isJoined: boolean; // Whether user is already a member
  onConfirm: () => void;
}

export default function JoinChatDialog({
  isOpen,
  onClose,
  chatName,
  isJoined,
  onConfirm,
}: JoinChatDialogProps) {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-surface border border-outline-variant rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 p-6 border-b border-outline-variant">
          <div className={`p-3 rounded-full ${isJoined ? 'bg-error/10' : 'bg-primary/10'}`}>
            {isJoined ? (
              <UserMinus className="h-6 w-6 text-error" />
            ) : (
              <UserPlus className="h-6 w-6 text-primary" />
            )}
          </div>
          <div className="flex-1">
            <h2 className="title-large text-on-surface">
              {isJoined ? 'Leave Chat' : 'Join Chat'}
            </h2>
            <p className="body-small text-on-surface-variant">
              {chatName}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="flex items-start gap-3 p-4 bg-surface-container rounded-2xl">
            <Users className="h-5 w-5 text-on-surface-variant flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="body-medium text-on-surface mb-2">
                {isJoined ? (
                  <>
                    You are about to <span className="font-semibold text-error">leave</span> this chat.
                  </>
                ) : (
                  <>
                    You are about to <span className="font-semibold text-primary">join</span> this chat.
                  </>
                )}
              </p>
              <p className="body-small text-on-surface-variant">
                {isJoined ? (
                  <>
                    You will no longer receive notifications and won't be able to see new messages unless you rejoin.
                  </>
                ) : (
                  <>
                    You will receive notifications and be able to participate in conversations.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-6 border-t border-outline-variant">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-surface-variant text-on-surface rounded-xl hover:bg-surface-variant/80 transition-colors label-large"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={`flex-1 px-4 py-3 rounded-xl transition-colors label-large flex items-center justify-center gap-2 ${
              isJoined
                ? 'bg-error text-on-error hover:bg-error/90'
                : 'bg-primary text-on-primary hover:bg-primary/90'
            }`}
          >
            {isJoined ? (
              <>
                <UserMinus size={18} />
                Leave
              </>
            ) : (
              <>
                <UserPlus size={18} />
                Join
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
