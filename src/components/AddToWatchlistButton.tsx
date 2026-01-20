import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { useToast } from '../contexts/ToastContext';
import { Button } from './Button';
import { CreateWatchlistForm } from './CreateWatchlistForm';
import './AddToWatchlistButton.css';

interface AddToWatchlistButtonProps {
  symbol: string;
}

export function AddToWatchlistButton({ symbol }: AddToWatchlistButtonProps) {
  const { isAuthenticated, login } = useAuth();
  const { watchlist } = useApp();
  const { showError } = useToast();
  const [showDropdown, setShowDropdown] = useState(false);
  const [isAdding, setIsAdding] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    if (!isAuthenticated) {
      login('google');
      return;
    }
    setShowDropdown(!showDropdown);
  };

  const handleToggleWatchlist = async (watchlistId: string, isInWatchlist: boolean) => {
    setIsAdding(watchlistId);
    try {
      if (isInWatchlist) {
        await watchlist.removeSymbol(watchlistId, symbol);
      } else {
        await watchlist.addSymbol(watchlistId, symbol);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : isInWatchlist ? 'Failed to remove' : 'Failed to add');
    } finally {
      setIsAdding(null);
    }
  };

  const handleCreate = async (name: string) => {
    try {
      const created = await watchlist.createWatchlist(name);
      await watchlist.addSymbol(created.id, symbol);
      setShowDropdown(false);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to create watchlist');
    }
  };

  return (
    <div className="add-to-watchlist" ref={dropdownRef}>
      <Button
        variant="secondary"
        onClick={handleToggle}
        size='sm'
        title={isAuthenticated ? 'Add to watchlist' : 'Sign in to save watchlists'}
      >
        Add to Watchlist
      </Button>

      {showDropdown && (
        <div className="watchlist-dropdown">
          {watchlist.watchlists.length > 0 && (
            <div className="watchlist-list">
              {watchlist.watchlists.map((w) => {
                const isLoading = isAdding === w.id;
                const isInWatchlist = w.symbols.includes(symbol.toUpperCase());
                return (
                  <button
                    key={w.id}
                    type="button"
                    className={`watchlist-item ${isInWatchlist ? 'in-watchlist' : ''}`}
                    onClick={() => handleToggleWatchlist(w.id, isInWatchlist)}
                    disabled={isLoading}
                  >
                    <span className="watchlist-name">{w.name}</span>
                    {isInWatchlist && <span className="watchlist-check">✓</span>}
                  </button>
                );
              })}
            </div>
          )}

          <CreateWatchlistForm
            onSubmit={handleCreate}
            className="watchlist-create-btn"
          />
        </div>
      )}
    </div>
  );
}
