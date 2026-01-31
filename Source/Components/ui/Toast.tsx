import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Info, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx'; // Assuming clsx is available for conditional classes

interface ToastProps {
  id: string;
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  onDismiss: (id: string) => void;
  duration?: number; // milliseconds
}

export default function Toast({ id, message, type = 'info', onDismiss, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(id);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, id, onDismiss]);

  const backgroundColor = {
    success: 'bg-primary',
    error: 'bg-error',
    info: 'bg-surface-container-high',
    warning: 'bg-warning-container',
  }[type];

  const borderColor = {
      success: 'border-primary',
      error: 'border-error',
      info: 'border-surface-container-high',
      warning: 'border-warning-container',
    }[type];

  const textColor = {
    success: 'text-on-primary',
    error: 'text-on-error',
    info: 'text-on-surface',
    warning: 'text-on-warning-container',
  }[type];

  const Icon = {
    success: CheckCircle,
    error: XCircle,
    info: Info,
    warning: AlertTriangle,
  }[type];

  return (
    <motion.div
      layout
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -50, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={clsx(
        "flex items-center gap-2 px-4 py-2 rounded-full shadow-lg pointer-events-auto max-w-xs",
        backgroundColor,
        borderColor,
        textColor
      )}
    >
      {Icon && <Icon size={20} />}
      <span className="body-medium">{message}</span>
    </motion.div>
  );
}

interface ToastContainerProps {
  toasts: ToastProps[];
}

export function ToastContainer({ toasts }: ToastContainerProps) {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 p-4 pointer-events-none w-full flex flex-col items-center">
      <AnimatePresence>
        {toasts.map((toast) => (
          <Toast key={toast.id} {...toast} />
        ))}
      </AnimatePresence>
    </div>
  );
}
