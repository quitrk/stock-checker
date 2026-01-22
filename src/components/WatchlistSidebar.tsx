import { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { useToast } from '../contexts/ToastContext';
import { Button } from './Button';
import { ConfirmDialog } from './ConfirmDialog';
import { CreateWatchlistForm } from './CreateWatchlistForm';
import './WatchlistSidebar.css';

type SortBy = 'symbol' | 'price' | 'change';
type SortOrder = 'asc' | 'desc';

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
  const [sortBy, setSortBy] = useState<SortBy>('symbol');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const handleSort = (column: SortBy) => {
    if (sortBy === column) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder(column === 'symbol' ? 'asc' : 'desc');
    }
  };

  const sortedStocks = useMemo(() => {
    if (!watchlist.activeWatchlist?.stocks) return [];
    const stocks = [...watchlist.activeWatchlist.stocks];
    const multiplier = sortOrder === 'asc' ? 1 : -1;
    switch (sortBy) {
      case 'price':
        return stocks.sort((a, b) => multiplier * ((a.price ?? 0) - (b.price ?? 0)));
      case 'change':
        return stocks.sort((a, b) => multiplier * ((a.priceChangePercent ?? 0) - (b.priceChangePercent ?? 0)));
      default:
        return stocks.sort((a, b) => multiplier * a.symbol.localeCompare(b.symbol));
    }
  }, [watchlist.activeWatchlist?.stocks, sortBy, sortOrder]);

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

  const handleCreateWatchlist = async (name: string) => {
    try {
      await watchlist.createWatchlist(name);
      showSuccess(`Created "${name}"`);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to create watchlist');
    }
  };

  return (
    <>
      <aside className={`watchlist-sidebar ${isOpen ? 'open' : ''}`}>
        {!isAuthenticated ? (
        <div className="sidebar-login">
          <p>Sign in to create watchlists</p>
          <Button variant="primary" onClick={() => login('google')}>Sign in</Button>
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
                    <>
                      <div className="stock-header">
                        <button
                          type="button"
                          className={`header-col symbol ${sortBy === 'symbol' ? 'active' : ''}`}
                          onClick={() => handleSort('symbol')}
                        >
                          Symbol {sortBy === 'symbol' && (sortOrder === 'asc' ? '▲' : '▼')}
                        </button>
                        <button
                          type="button"
                          className={`header-col price ${sortBy === 'price' ? 'active' : ''}`}
                          onClick={() => handleSort('price')}
                        >
                          Price {sortBy === 'price' && (sortOrder === 'asc' ? '▲' : '▼')}
                        </button>
                        <button
                          type="button"
                          className={`header-col change ${sortBy === 'change' ? 'active' : ''}`}
                          onClick={() => handleSort('change')}
                        >
                          Change {sortBy === 'change' && (sortOrder === 'asc' ? '▲' : '▼')}
                        </button>
                      </div>
                      {sortedStocks.map((stock) => (
                      <div key={stock.symbol} className="stock-row">
                        <button
                          type="button"
                          className="stock-btn"
                          onClick={() => handleSelectSymbol(stock.symbol)}
                        >
                          {stock.logoUrl && (
                            <img
                              src={stock.logoUrl}
                              alt=""
                              className="stock-logo"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          )}
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
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {isAuthenticated && (
        <CreateWatchlistForm
          onSubmit={handleCreateWatchlist}
          className="add-btn"
        />
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
