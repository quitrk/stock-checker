import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { useToast } from '../contexts/ToastContext';
import { Button } from './Button';
import './AddToWatchlistButton.css';

interface AddToWatchlistButtonProps {
  symbol: string;
}

export function AddToWatchlistButton({ symbol }: AddToWatchlistButtonProps) {
  const { isAuthenticated, login } = useAuth();
  const { watchlist } = useApp();
  const { showSuccess, showError } = useToast();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [isAdding, setIsAdding] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setShowCreate(false);
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
        showSuccess(`Removed ${symbol} from watchlist`);
      } else {
        await watchlist.addSymbol(watchlistId, symbol);
        showSuccess(`Added ${symbol} to watchlist`);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : isInWatchlist ? 'Failed to remove' : 'Failed to add');
    } finally {
      setIsAdding(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      const created = await watchlist.createWatchlist(newName.trim());
      await watchlist.addSymbol(created.id, symbol);
      showSuccess(`Created "${newName}" and added ${symbol}`);
      setNewName('');
      setShowCreate(false);
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
          {watchlist.watchlists.length === 0 && !showCreate ? (
            <div className="watchlist-empty">
              <p>No watchlists yet</p>
              <Button variant="primary" onClick={() => setShowCreate(true)} size='sm'>
                Create your first watchlist
              </Button>
            </div>
          ) : (
            <>
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

              {showCreate ? (
                <form onSubmit={handleCreate} className="watchlist-create-form">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Watchlist name"
                    autoFocus
                  />
                  <div className="create-actions">
                    <Button variant="secondary" size="sm" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
                    <Button variant="primary" size="sm" type="submit" disabled={!newName.trim()}>Create</Button>
                  </div>
                </form>
              ) : (
                <Button variant="text" className="watchlist-create-btn" onClick={() => setShowCreate(true)}>
                  + New watchlist
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
