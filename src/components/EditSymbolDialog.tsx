import { useEffect, useState } from 'react';
import { Dialog, DialogActions } from './Dialog';
import { Button } from './Button';
import './EditSymbolDialog.css';

interface EditSymbolDialogProps {
  open: boolean;
  symbol: string;
  currentDate: string | null;
  onSave: (addedAt: string | null) => Promise<void>;
  onCancel: () => void;
}

export function EditSymbolDialog({
  open,
  symbol,
  currentDate,
  onSave,
  onCancel,
}: EditSymbolDialogProps) {
  const [date, setDate] = useState(currentDate || '');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setDate(currentDate || '');
    setIsLoading(false);
  }, [currentDate, open]);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await onSave(date || null);
    } catch {
      // Stay open on error
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setDate('');
  };

  const handleCancel = () => {
    if (!isLoading) {
      onCancel();
    }
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      title={`Edit ${symbol}`}
      disabled={isLoading}
    >
      <div className="edit-symbol-field">
        <label htmlFor="added-date">Date Added</label>
        <input
          id="added-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          max={today}
          disabled={isLoading}
        />
        {date && !isLoading && (
          <button type="button" className="clear-date-btn" onClick={handleClear}>
            Clear
          </button>
        )}
      </div>
      <p className="edit-symbol-hint">
        When set, the Change column will show the price change since this date instead of daily change.
      </p>
      <DialogActions>
        <Button variant="secondary" onClick={handleCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={isLoading}>
          {isLoading ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
