import { useState } from 'react';
import { Button } from './Button';
import './CreateWatchlistForm.css';

interface CreateWatchlistFormProps {
  onSubmit: (name: string) => Promise<void>;
  className?: string;
}

export function CreateWatchlistForm({ onSubmit, className }: CreateWatchlistFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit(name.trim());
      setName('');
      setIsOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return (
      <Button variant="text" className={className} onClick={() => setIsOpen(true)}>
        + New watchlist
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="create-watchlist-form">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Watchlist name"
        autoFocus
      />
      <div className="create-watchlist-actions">
        <Button variant="secondary" size="sm" type="button" onClick={() => setIsOpen(false)}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" type="submit" disabled={!name.trim() || isSubmitting}>
          Create
        </Button>
      </div>
    </form>
  );
}
