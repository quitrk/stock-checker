import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { useToast } from '../contexts/ToastContext';
import { Button } from './Button';
import { ConfirmDialog } from './ConfirmDialog';
import { EditSymbolDialog } from './EditSymbolDialog';
import { CreateWatchlistForm } from './CreateWatchlistForm';
import { WatchlistItem } from './WatchlistItem';
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
  const [editTarget, setEditTarget] = useState<{ watchlistId: string; symbol: string; currentDate: string | null } | null>(null);

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

  const handleEditSymbol = async (addedAt: string | null): Promise<void> => {
    if (!editTarget) return;
    try {
      await watchlist.updateSymbolDate(editTarget.watchlistId, editTarget.symbol, addedAt);
      if (addedAt) {
        showSuccess(`Updated date for ${editTarget.symbol}`);
      } else {
        showSuccess(`Cleared date for ${editTarget.symbol}`);
      }
      setEditTarget(null);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to update symbol');
      throw err; // Re-throw so dialog knows it failed
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
          {/* Default watchlists */}
          {watchlist.defaultWatchlists.map((w) => (
            <WatchlistItem
              key={w.id}
              watchlist={w}
              isExpanded={expandedId === w.id}
              isLoading={watchlist.isLoading}
              stocks={expandedId === w.id ? watchlist.activeWatchlist?.stocks || [] : []}
              onToggle={() => handleToggleWatchlist(w.id)}
              onSelectSymbol={handleSelectSymbol}
            />
          ))}

          {/* User watchlists */}
          {watchlist.watchlists.map((w) => (
            <WatchlistItem
              key={w.id}
              watchlist={w}
              isExpanded={expandedId === w.id}
              isLoading={watchlist.isLoading}
              stocks={expandedId === w.id ? watchlist.activeWatchlist?.stocks || [] : []}
              onToggle={() => handleToggleWatchlist(w.id)}
              onSelectSymbol={handleSelectSymbol}
              onDelete={() => setDeleteTarget({ id: w.id, name: w.name })}
              onRemoveSymbol={(symbol) => setRemoveSymbolTarget({ watchlistId: w.id, symbol })}
              onEditSymbol={(symbol, currentDate) => setEditTarget({ watchlistId: w.id, symbol, currentDate })}
            />
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
      <EditSymbolDialog
        open={!!editTarget}
        symbol={editTarget?.symbol || ''}
        currentDate={editTarget?.currentDate || null}
        onSave={handleEditSymbol}
        onCancel={() => setEditTarget(null)}
      />
    </>
  );
}
