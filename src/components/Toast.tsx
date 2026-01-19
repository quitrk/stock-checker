import { useEffect } from 'react';
import './Toast.css';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export enum ToastDuration {
  Short = 2000,
  Medium = 4000,
  Long = 6000,
}

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  duration?: ToastDuration;
}

interface ToastProps {
  toast: ToastMessage;
  onRemove: (id: string) => void;
}

export function Toast({ toast, onRemove }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(toast.id);
    }, toast.duration || ToastDuration.Medium);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemove]);

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return '\u2713';
      case 'error':
        return '\u2715';
      case 'warning':
        return '\u26A0';
      case 'info':
        return '\u2139';
      default:
        return '';
    }
  };

  return (
    <div className={`toast toast-${toast.type}`} onClick={() => onRemove(toast.id)}>
      <span className="toast-icon">{getIcon()}</span>
      <span className="toast-message">{toast.message}</span>
      <button
        className="toast-close"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(toast.id);
        }}
        aria-label="Close notification"
      >
        {'\u2715'}
      </button>
    </div>
  );
}
