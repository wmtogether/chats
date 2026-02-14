import { useState, useEffect } from 'react';
import { X, FileText, Loader2, Plus, Trash2 } from 'lucide-react';
import { createProofData, getNextRunnerID, type CreateProofParams } from '../Library/Shared/proofApi';
import { useToast } from '../Library/hooks/useToast';
import { getNullStringValue } from '../Library/utils/api';

interface NewProofDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (proofData: any) => void;
  currentChat?: any; // Current chat context for auto-filling customer data
}

export default function NewProofDialog({ isOpen, onClose, onSuccess, currentChat }: NewProofDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingRunnerID, setIsLoadingRunnerID] = useState(false);
  const [prefix, setPrefix] = useState<'WMT' | 'DR' | 'NRM'>('WMT');
  const [runnerId, setRunnerId] = useState('');
  const [jobNames, setJobNames] = useState<string[]>(['']);
  const [formData, setFormData] = useState({
    customerName: '',
    customerId: '',
    salesName: '',
    proofStatus: 'PENDING_PROOF',
  });
  const { addToast } = useToast();

  // Fetch runner ID when prefix changes or dialog opens
  useEffect(() => {
    if (isOpen) {
      fetchNextRunnerID(prefix);
    }
  }, [isOpen, prefix]);

  const fetchNextRunnerID = async (selectedPrefix: 'WMT' | 'DR' | 'NRM') => {
    setIsLoadingRunnerID(true);
    try {
      const nextRunnerID = await getNextRunnerID(selectedPrefix);
      setRunnerId(nextRunnerID);
    } catch (error) {
      console.error('Failed to fetch next runner ID:', error);
      addToast({ 
        message: 'Failed to generate runner ID', 
        type: 'error' 
      });
    } finally {
      setIsLoadingRunnerID(false);
    }
  };

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setPrefix('WMT');
      setJobNames(['']);
      
      // Get customer name and ID from current chat if available
      const customerName = currentChat ? getNullStringValue(currentChat.customers) : '';
      const customerId = currentChat ? getNullStringValue(currentChat.customerId) : '';
      
      setFormData({
        customerName: customerName || '',
        customerId: customerId || '',
        salesName: '',
        proofStatus: 'PENDING_PROOF',
      });
      
      console.log('=== NewProofDialog Reset ===');
      console.log('Setting customer name to:', customerName);
      console.log('Setting customer ID to:', customerId);
      console.log('===========================');
    }
  }, [isOpen, currentChat]);

  const handleAddJobName = () => {
    setJobNames([...jobNames, '']);
  };

  const handleRemoveJobName = (index: number) => {
    if (jobNames.length > 1) {
      setJobNames(jobNames.filter((_, i) => i !== index));
    }
  };

  const handleJobNameChange = (index: number, value: string) => {
    const newJobNames = [...jobNames];
    newJobNames[index] = value;
    setJobNames(newJobNames);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate job names
    const validJobNames = jobNames.filter(name => name.trim() !== '');
    if (validJobNames.length === 0) {
      addToast({ message: 'At least one job name is required', type: 'error' });
      return;
    }

    if (!runnerId) {
      addToast({ message: 'Runner ID is required', type: 'error' });
      return;
    }

    // Validate customer ID
    if (!formData.customerId.trim()) {
      addToast({ message: 'Customer ID is required for folder creation', type: 'error' });
      return;
    }

    setIsSubmitting(true);

    try {
      // Create proof data for each job name with the same runner ID
      const createdProofs = [];
      
      for (let i = 0; i < validJobNames.length; i++) {
        const params: CreateProofParams = {
          runnerId: runnerId,
          jobName: validJobNames[i].trim(),
          customerName: formData.customerName.trim() || undefined,
          customerId: formData.customerId.trim() || undefined,
          salesName: formData.salesName.trim() || undefined,
          proofStatus: formData.proofStatus,
          position: i, // Use index as position
          chatUuid: currentChat?.uuid, // Link to current chat
          formData: {
            createdAt: new Date().toISOString(),
            jobIndex: i + 1,
            totalJobs: validJobNames.length,
          },
        };

        const result = await createProofData(params);
        createdProofs.push(result);
      }
      
      addToast({ 
        message: `Created ${createdProofs.length} proof data entr${createdProofs.length > 1 ? 'ies' : 'y'} successfully`, 
        type: 'success' 
      });
      
      if (onSuccess) {
        // Return the first proof or all proofs
        onSuccess(createdProofs.length === 1 ? createdProofs[0] : {
          ...createdProofs[0],
          jobName: validJobNames.join(', '),
          multipleJobs: true,
          totalJobs: createdProofs.length,
        });
      }
      
      onClose();
    } catch (error) {
      console.error('Failed to create proof data:', error);
      addToast({ 
        message: error instanceof Error ? error.message : 'Failed to create proof data', 
        type: 'error' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-surface border border-outline-variant rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-outline-variant flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <h2 className="title-large text-on-surface">New Proof Data</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 hover:bg-surface-variant rounded-full transition-colors disabled:opacity-50"
          >
            <X size={20} className="text-on-surface-variant" />
          </button>
        </div>

        {/* Form - Scrollable */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-4">
            {/* Runner ID Generator */}
            <div>
              <label className="block label-medium text-on-surface mb-2">
                Runner ID <span className="text-error">*</span>
              </label>
              
              {/* Prefix Selection */}
              <div className="flex gap-2 mb-2">
                {(['WMT', 'DR', 'NRM'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPrefix(p)}
                    disabled={isSubmitting || isLoadingRunnerID}
                    className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50 ${
                      prefix === p
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container text-on-surface hover:bg-surface-variant'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              {/* Generated Runner ID Display */}
              <div className="relative">
                <input
                  type="text"
                  value={runnerId}
                  readOnly
                  className="w-full px-4 py-3 bg-surface-variant border border-outline-variant rounded-xl text-on-surface font-mono text-sm"
                  placeholder={isLoadingRunnerID ? 'Generating...' : 'Runner ID'}
                />
                {isLoadingRunnerID && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  </div>
                )}
              </div>
              <p className="text-xs text-on-surface-variant mt-1">
                Auto-generated based on today's date
              </p>
            </div>

            {/* Job Names (Multiple) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block label-medium text-on-surface">
                  Job Names <span className="text-error">*</span>
                </label>
                <button
                  type="button"
                  onClick={handleAddJobName}
                  disabled={isSubmitting}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-50"
                >
                  <Plus size={14} />
                  Add Job
                </button>
              </div>
              
              <div className="space-y-2">
                {jobNames.map((jobName, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={jobName}
                      onChange={(e) => handleJobNameChange(index, e.target.value)}
                      placeholder={`Job ${index + 1}`}
                      disabled={isSubmitting}
                      className="flex-1 px-4 py-3 bg-surface-container border border-outline-variant rounded-xl text-on-surface placeholder-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all disabled:opacity-50"
                    />
                    {jobNames.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveJobName(index)}
                        disabled={isSubmitting}
                        className="p-3 bg-error-container text-error rounded-xl hover:bg-error-container/80 transition-colors disabled:opacity-50"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-on-surface-variant mt-1">
                Multiple jobs can share the same Runner ID
              </p>
            </div>

            {/* Customer Name */}
            <div>
              <label className="block label-medium text-on-surface mb-2">
                Customer Name
              </label>
              <input
                type="text"
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                placeholder="e.g., ABC Company"
                disabled={isSubmitting}
                className="w-full px-4 py-3 bg-surface-container border border-outline-variant rounded-xl text-on-surface placeholder-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all disabled:opacity-50"
              />
            </div>

            {/* Customer ID */}
            <div>
              <label className="block label-medium text-on-surface mb-2">
                Customer ID <span className="text-error">*</span>
              </label>
              <input
                type="text"
                value={formData.customerId}
                onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                placeholder="e.g., A001, A123"
                disabled={isSubmitting}
                className="w-full px-4 py-3 bg-surface-container border border-outline-variant rounded-xl text-on-surface placeholder-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all disabled:opacity-50"
              />
              <p className="text-xs text-on-surface-variant mt-1">
                Required for folder creation
              </p>
            </div>

            {/* Sales Name */}
            <div>
              <label className="block label-medium text-on-surface mb-2">
                Sales Name
              </label>
              <input
                type="text"
                value={formData.salesName}
                onChange={(e) => setFormData({ ...formData, salesName: e.target.value })}
                placeholder="e.g., John Doe"
                disabled={isSubmitting}
                className="w-full px-4 py-3 bg-surface-container border border-outline-variant rounded-xl text-on-surface placeholder-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all disabled:opacity-50"
              />
            </div>

          </div>

          {/* Actions - Fixed at bottom */}
          <div className="flex gap-3 p-6 border-t border-outline-variant flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 bg-surface-variant text-on-surface rounded-xl hover:bg-surface-variant/80 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isLoadingRunnerID}
              className="flex-1 px-4 py-3 bg-primary text-on-primary rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Proof'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
