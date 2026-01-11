import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ToastMessage, ToastType, ToastDuration } from '../components/Toast';
import { ToastContainer } from '../components/ToastContainer';

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: ToastDuration) => void;
  showSuccess: (message: string, duration?: ToastDuration) => void;
  showError: (message: string, duration?: ToastDuration) => void;
  showWarning: (message: string, duration?: ToastDuration) => void;
  showInfo: (message: string, duration?: ToastDuration) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration?: ToastDuration) => {
    const id = crypto.randomUUID();
    const newToast: ToastMessage = {
      id,
      message,
      type,
      duration,
    };
    setToasts((prev) => [...prev, newToast]);
  }, []);

  const showSuccess = useCallback((message: string, duration?: ToastDuration) => {
    showToast(message, 'success', duration);
  }, [showToast]);

  const showError = useCallback((message: string, duration?: ToastDuration) => {
    showToast(message, 'error', duration);
  }, [showToast]);

  const showWarning = useCallback((message: string, duration?: ToastDuration) => {
    showToast(message, 'warning', duration);
  }, [showToast]);

  const showInfo = useCallback((message: string, duration?: ToastDuration) => {
    showToast(message, 'info', duration);
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError, showWarning, showInfo }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
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
