import { useState, useEffect } from 'react';
import { X, Palette, Loader2 } from 'lucide-react';
import { useToast } from '../Library/hooks/useToast';
import { getNullStringValue } from '../Library/utils/api';
import { apiClient } from '../Library/Authentication/AuthContext';

interface NewDesignDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (designData: any) => void;
  currentChat?: any;
}

export default function NewDesignDialog({ isOpen, onClose, onSuccess, currentChat }: NewDesignDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    jobName: '',
    customerName: '',
    customerId: '',
    note: '',
  });
  const { addToast } = useToast();

  useEffect(() => {
    if (isOpen) {
      const customerName = currentChat ? getNullStringValue(currentChat.customers) : '';
      const customerId = currentChat ? getNullStringValue(currentChat.customerId) : '';
      
      setFormData({
        jobName: '',
        customerName: customerName || '',
        customerId: customerId || '',
        note: '',
      });
    }
  }, [isOpen, currentChat]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.jobName.trim()) {
      addToast({ message: 'Job name is required', type: 'error' });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiClient.post('/designs', {
        jobName: formData.jobName.trim(),
        customerName: formData.customerName.trim() || null,
        customerId: formData.customerId.trim() || null,
        designData: {
          jobName: formData.jobName.trim(),
          customerName: formData.customerName.trim() || null,
          customerId: formData.customerId.trim() || null,
          note: formData.note.trim() || null,
          editCount: 0,
          comments: [],
        },
      });
      
      console.log('Design API response:', response.data);
      
      addToast({ message: 'Design created successfully', type: 'success' });
      
      if (onSuccess && response.data?.data) {
        console.log('Calling onSuccess with:', response.data.data);
        onSuccess(response.data.data);
      }
      
      onClose();
    } catch (error) {
      console.error('Failed to create design:', error);
      addToast({ 
        message: error instanceof Error ? error.message : 'Failed to create design', 
        type: 'error' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-surface border border-outline-variant rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-outline-variant">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <Palette className="h-5 w-5 text-primary" />
            </div>
            <h2 className="title-large text-on-surface">New Design</h2>
          </div>
          <button onClick={onClose} disabled={isSubmitting} className="p-2 hover:bg-surface-variant rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block label-medium text-on-surface mb-2">
              Job Name <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={formData.jobName}
              onChange={(e) => setFormData({ ...formData, jobName: e.target.value })}
              placeholder="Enter job name"
              disabled={isSubmitting}
              className="w-full px-4 py-3 bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="block label-medium text-on-surface mb-2">Customer Name</label>
            <input
              type="text"
              value={formData.customerName}
              onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
              placeholder="Customer name"
              disabled={isSubmitting}
              className="w-full px-4 py-3 bg-surface-container border border-outline-variant rounded-xl text-on-surface"
            />
          </div>

          <div>
            <label className="block label-medium text-on-surface mb-2">Customer ID</label>
            <input
              type="text"
              value={formData.customerId}
              onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
              placeholder="Customer ID"
              disabled={isSubmitting}
              className="w-full px-4 py-3 bg-surface-container border border-outline-variant rounded-xl text-on-surface"
            />
          </div>

          <div>
            <label className="block label-medium text-on-surface mb-2">Note</label>
            <textarea
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              placeholder="Additional notes"
              disabled={isSubmitting}
              rows={3}
              className="w-full px-4 py-3 bg-surface-container border border-outline-variant rounded-xl text-on-surface resize-none"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 bg-surface-variant text-on-surface rounded-xl hover:bg-surface-variant/80"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 bg-primary text-on-primary rounded-xl hover:bg-primary/90 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Design'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
