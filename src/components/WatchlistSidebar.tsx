import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { useToast } from '../contexts/ToastContext';
import { Button } from './Button';
import { ConfirmDialog } from './ConfirmDialog';
import './WatchlistSidebar.css';

interface WatchlistSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onSelectSymbol: (symbol: string) => void;
}

export function WatchlistSidebar({ isOpen, onToggle, onSelectSymbol }: WatchlistSidebarProps) {
  const { isAuthenticated, login } = useAuth();
  const { watchlist } = useApp();
  const { showSuccess, showError } = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [removeSymbolTarget, setRemoveSymbolTarget] = useState<{ watchlistId: string; symbol: string } | null>(null);

  const handleToggleWatchlist = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      watchlist.clearActiveWatchlist();
    } else {
      setExpandedId(id);
      await watchlist.selectWatchlist(id);
    }
  };

  const handleRemoveSymbol = async () => {
    if (!removeSymbolTarget) return;
    try {
      await watchlist.removeSymbol(removeSymbolTarget.watchlistId, removeSymbolTarget.symbol);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to remove symbol');
    } finally {
      setRemoveSymbolTarget(null);
    }
  };

  const handleDeleteWatchlist = async () => {
    if (!deleteTarget) return;
    try {
      await watchlist.deleteWatchlist(deleteTarget.id);
      showSuccess(`Deleted "${deleteTarget.name}"`);
      if (expandedId === deleteTarget.id) {
        setExpandedId(null);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to delete watchlist');
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleSelectSymbol = (symbol: string) => {
    onSelectSymbol(symbol);
    onToggle();
  };

  return (
    <>
      <span className="sidebar-toggle" onClick={onToggle}>☰</span>
      <aside className={`watchlist-sidebar ${isOpen ? 'open' : ''}`}>
        {!isAuthenticated ? (
        <div className="sidebar-login">
          <p>Sign in to create watchlists</p>
          <Button variant="primary" onClick={() => login('google')}>Sign in</Button>
        </div>
      ) : watchlist.watchlists.length === 0 ? (
        <div className="sidebar-empty">
          <p>No watchlists yet. Add a symbol to create one.</p>
        </div>
      ) : (
        <div className="sidebar-content">
          {watchlist.watchlists.map((w) => (
            <div key={w.id} className="watchlist-group">
              <div
                className={`watchlist-header ${expandedId === w.id ? 'expanded' : ''}`}
                onClick={() => handleToggleWatchlist(w.id)}
              >
                <span className="expand-icon">{expandedId === w.id ? '\u25BC' : '\u25B6'}</span>
                <span className="name">{w.name}</span>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget({ id: w.id, name: w.name });
                  }}
                >
                  Remove Watchlist
                </Button>
              </div>

              {expandedId === w.id && (
                <div className="watchlist-stocks">
                  {watchlist.isLoading ? (
                    <div className="loading">Loading...</div>
                  ) : !watchlist.activeWatchlist || watchlist.activeWatchlist.stocks.length === 0 ? (
                    <div className="empty">No stocks</div>
                  ) : (
                    watchlist.activeWatchlist.stocks.map((stock) => (
                      <div key={stock.symbol} className="stock-row">
                        <button
                          type="button"
                          className="stock-btn"
                          onClick={() => handleSelectSymbol(stock.symbol)}
                        >
                          <span className="symbol">{stock.symbol}</span>
                          <span className="price">${(stock.price ?? 0).toFixed(2)}</span>
                          <span className={`change ${(stock.priceChangePercent ?? 0) >= 0 ? 'up' : 'down'}`}>
                            {(stock.priceChangePercent ?? 0) >= 0 ? '+' : ''}{(stock.priceChangePercent ?? 0).toFixed(1)}%
                          </span>
                        </button>
                        <button
                          type="button"
                          className="remove-btn"
                          onClick={() => setRemoveSymbolTarget({ watchlistId: w.id, symbol: stock.symbol })}
                        >
                          ×
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}

        </div>
      )}
      </aside>
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Watchlist"
        message={`Are you sure you want to delete "${deleteTarget?.name}"?`}
        onConfirm={handleDeleteWatchlist}
        onCancel={() => setDeleteTarget(null)}
      />
      <ConfirmDialog
        open={!!removeSymbolTarget}
        title="Remove Symbol"
        message={`Remove ${removeSymbolTarget?.symbol} from this watchlist?`}
        confirmLabel="Remove"
        onConfirm={handleRemoveSymbol}
        onCancel={() => setRemoveSymbolTarget(null)}
      />
    </>
  );
}
