import React, { useState, useCallback, useContext, createContext, useMemo } from 'react';
import { ToastContainer } from '../../Components/ui/Toast';

interface ToastOptions {
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

interface ToastContextType {
  addToast: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Array<ToastOptions & { id: string }>>([]);

  const addToast = useCallback((options: ToastOptions) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    setToasts((prevToasts) => [...prevToasts, { ...options, id }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []);

  const contextValue = useMemo(() => ({ addToast }), [addToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastContainer toasts={toasts.map(toast => ({ ...toast, onDismiss: dismissToast }))} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
