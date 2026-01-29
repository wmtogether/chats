import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageSquarePlus, Ruler, Palette, Edit, FileCheck, Eye, Package, Briefcase, Settings } from 'lucide-react';

type RequestType = 'design' | 'dimension' | 'checkfile' | 'adjustdesign' | 'proof' | 'sample-i' | 'sample-t' | 'general' | 'consultation';

interface NewChatDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreateChat: (chatData: {
        name: string;
        requestType: RequestType;
        customerId?: string;
        customerName?: string;
        description?: string;
    }) => void;
}

const REQUEST_TYPES: {
    id: RequestType;
    label: string;
    description: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    color: string;
}[] = [
    {
        id: 'design',
        label: 'งานออกแบบใหม่',
        description: 'Create new design or artwork',
        icon: Palette,
        color: 'bg-primary/12 text-primary border-primary/20 hover:bg-primary/16',
    },
    {
        id: 'dimension',
        label: 'เช็คระยะ/ขนาด',
        description: 'Verify measurements and specifications',
        icon: Ruler,
        color: 'bg-secondary/12 text-secondary border-secondary/20 hover:bg-secondary/16',
    },
    {
        id: 'adjustdesign',
        label: 'แก้ไขแบบ',
        description: 'Modify existing design',
        icon: Edit,
        color: 'bg-tertiary/12 text-tertiary border-tertiary/20 hover:bg-tertiary/16',
    },
    {
        id: 'checkfile',
        label: 'เช็คไฟล์',
        description: 'Review and validate files',
        icon: FileCheck,
        color: 'bg-error/12 text-error border-error/20 hover:bg-error/16',
    },
    {
        id: 'proof',
        label: 'ตรวจสอบปรู๊ฟ',
        description: 'Review proof before production',
        icon: Eye,
        color: 'bg-outline/12 text-on-surface border-outline/20 hover:bg-outline/16',
    },
    {
        id: 'sample-i',
        label: 'ตัวอย่าง (Internal)',
        description: 'Inkjet sample request',
        icon: Package,
        color: 'bg-surface-variant/12 text-on-surface-variant border-surface-variant/20 hover:bg-surface-variant/16',
    },
    {
        id: 'sample-t',
        label: 'ตัวอย่าง (Toner)',
        description: 'Toner sample request',
        icon: Package,
        color: 'bg-inverse-surface/12 text-inverse-on-surface border-inverse-surface/20 hover:bg-inverse-surface/16',
    },
    {
        id: 'general',
        label: 'เรื่องทั่วไป',
        description: 'General discussion or inquiry',
        icon: Briefcase,
        color: 'bg-on-surface/12 text-on-surface border-on-surface/20 hover:bg-on-surface/16',
    },
    {
        id: 'consultation',
        label: 'ขอคำปรึกษา',
        description: 'Expert advice and consultation',
        icon: Settings,
        color: 'bg-primary-container/12 text-on-primary-container border-primary-container/20 hover:bg-primary-container/16',
    },
];

// --- Animation Variants ---
const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
};

const modalVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 10 },
    visible: { 
        opacity: 1, 
        scale: 1, 
        y: 0,
        transition: { type: 'spring', damping: 25, stiffness: 300 }
    },
    exit: { opacity: 0, scale: 0.95, y: 10 }
};

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.05
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
};

export default function NewChatDialog({ open, onOpenChange, onCreateChat }: NewChatDialogProps) {
    const [chatName, setChatName] = useState('');
    const [customerId, setCustomerId] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [description, setDescription] = useState('');
    const [requestType, setRequestType] = useState<RequestType>('general');
    const [isCreating, setIsCreating] = useState(false);

    // Reset form when dialog opens
    useEffect(() => {
        if (open) {
            setChatName('');
            setCustomerId('');
            setCustomerName('');
            setDescription('');
            setRequestType('general');
            setIsCreating(false);
        }
    }, [open]);

    const handleCreate = async () => {
        if (!chatName.trim()) return;

        setIsCreating(true);
        try {
            await onCreateChat({
                name: chatName.trim(),
                requestType,
                customerId: customerId.trim() || undefined,
                customerName: customerName.trim() || undefined,
                description: description.trim() || undefined,
            });

            // Close dialog
            onOpenChange(false);
        } catch (error) {
            console.error('Failed to create chat:', error);
        } finally {
            setIsCreating(false);
        }
    };

    const handleClose = () => {
        if (!isCreating) {
            onOpenChange(false);
        }
    };

    const content = (
        <AnimatePresence>
            {open && (
                <div className="select-none dialog-overlay fixed inset-0 flex items-center justify-center z-[1000000]">
                    {/* Backdrop */}
                    <motion.div
                        variants={backdropVariants}
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={handleClose}
                    />

                    {/* Dialog */}
                    <motion.div
                        //@ts-expect-error
                        variants={modalVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="relative w-full max-w-3xl mx-4 bg-surface rounded-2xl shadow-elevation-3 border border-outline-variant overflow-hidden"
                    >
                        {/* Header */}
                        <div className="relative px-6 pt-6 pb-4">
                            <button
                                onClick={handleClose}
                                disabled={isCreating}
                                className="absolute top-4 right-4 p-2 rounded-full hover:bg-on-surface/8 transition-colors disabled:opacity-50"
                            >
                                <X size={18} className="text-on-surface-variant" />
                            </button>

                            <div className="flex items-center gap-4 pr-12">
                                <div className="w-12 h-12 rounded-full bg-primary-container flex items-center justify-center">
                                    <MessageSquarePlus size={24} className="text-on-primary-container" />
                                </div>
                                <div>
                                    <h2 className="headline-small text-on-surface">สร้างแชทใหม่</h2>
                                    <p className="body-medium text-on-surface-variant">เริ่มการสนทนาใหม่กับทีมของคุณ</p>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="px-6 pb-6">
                            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                                {/* Left Column - Chat Details */}
                                <div className="lg:col-span-2 space-y-4">
                                    {/* Chat Name */}
                                    <div className="space-y-2">
                                        <label className="body-medium text-on-surface font-medium">
                                            ชื่อแชท *
                                        </label>
                                        <div className="relative pt-2">
                                            <input
                                                type="text"
                                                value={chatName}
                                                onChange={(e) => setChatName(e.target.value)}
                                                placeholder="ระบุชื่อแชท..."
                                                className="w-full px-3 py-3 bg-surface-variant/50 border border-outline rounded-xl text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all body-medium"
                                                disabled={isCreating}
                                                autoFocus
                                            />
                                        </div>
                                    </div>

                                    {/* Customer Information */}
                                    <div className="space-y-3">
                                        <label className="body-medium text-on-surface font-medium">
                                            ข้อมูลลูกค้า (ไม่บังคับ)
                                        </label>

                                        <div className="space-y-2 pt-2">
                                            <input
                                                type="text"
                                                value={customerId}
                                                onChange={(e) => setCustomerId(e.target.value)}
                                                placeholder="รหัสลูกค้า (Customer ID)"
                                                className="w-full px-3 py-2.5 bg-surface-variant/50 border border-outline-variant rounded-lg text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all body-small"
                                                disabled={isCreating}
                                            />
                                            <input
                                                type="text"
                                                value={customerName}
                                                onChange={(e) => setCustomerName(e.target.value)}
                                                placeholder="ชื่อลูกค้า (Customer Name)"
                                                className="w-full px-3 py-2.5 bg-surface-variant/50 border border-outline-variant rounded-lg text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all body-small"
                                                disabled={isCreating}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column - Request Types */}
                                <div className="lg:col-span-3 space-y-3">
                                    <span className="body-medium text-on-surface font-medium">
                                        ประเภทคำขอ
                                    </span>
                                    <motion.div 
                                        variants={containerVariants}
                                        initial="hidden"
                                        animate="visible"
                                        className="grid grid-cols-3 gap-3 pt-2"
                                    >
                                        {REQUEST_TYPES.map((type) => {
                                            const IconComponent = type.icon;
                                            const isSelected = requestType === type.id;

                                            return (
                                                <motion.button
                                                    key={type.id}
                                                    variants={itemVariants}
                                                    whileHover={{ scale: 1.02 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    type="button"
                                                    onClick={() => setRequestType(type.id)}
                                                    disabled={isCreating}
                                                    className={`
                                                        p-2 rounded-xl border-2 transition-colors h-24 flex flex-col gap-1.5
                                                        ${isSelected
                                                            ? `${type.color} border-current shadow-md`
                                                            : 'bg-surface-variant/30 border-outline-variant hover:bg-surface-variant/50 text-on-surface-variant hover:border-outline'
                                                        }
                                                        disabled:opacity-50 disabled:cursor-not-allowed
                                                    `}
                                                >
                                                    <div className={`
                                                        w-8 h-8 rounded-lg flex items-center justify-center transition-colors
                                                        ${isSelected ? 'bg-current/16' : 'bg-surface-variant'}
                                                    `}>
                                                        <IconComponent size={16} className={isSelected ? 'text-current' : 'text-on-surface-variant'} />
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        <div className="label-medium font-medium leading-tight text-left">
                                                            {type.label}
                                                        </div>
                                                    </div>
                                                </motion.button>
                                            );
                                        })}
                                    </motion.div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-outline-variant">
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.96 }}
                                    type="button"
                                    onClick={handleClose}
                                    disabled={isCreating}
                                    className="px-6 py-2.5 bg-surface border border-outline rounded-xl text-on-surface hover:bg-surface-variant/50 transition-colors disabled:opacity-50 label-medium font-medium min-w-[100px]"
                                >
                                    ยกเลิก
                                </motion.button>
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.96 }}
                                    type="button"
                                    onClick={handleCreate}
                                    disabled={!chatName.trim() || isCreating}
                                    className="px-6 py-2.5 bg-primary text-on-primary rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed label-medium font-medium min-w-[120px]"
                                >
                                    {isCreating ? (
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                            กำลังสร้าง...
                                        </div>
                                    ) : (
                                        'สร้างแชท'
                                    )}
                                </motion.button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );

    // Use portal to render at document body level
    return createPortal(content, document.body);
}