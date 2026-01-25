import { useRef, useEffect } from 'react';
import './Dialog.css';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  disabled?: boolean; // Prevent closing when loading
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  disabled = false,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === dialogRef.current && !disabled) {
      onClose();
    }
  };

  return (
    <dialog ref={dialogRef} className="dialog" onClick={handleBackdropClick}>
      <div className="dialog-content">
        <h3 className="dialog-title">{title}</h3>
        {children}
      </div>
    </dialog>
  );
}

interface DialogActionsProps {
  children: React.ReactNode;
}

export function DialogActions({ children }: DialogActionsProps) {
  return <div className="dialog-actions">{children}</div>;
}
