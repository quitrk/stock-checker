import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getWatchlist } from '../api/watchlistApi';
import { WatchlistItem } from './WatchlistItem';
import type { WatchlistWithStocks } from '../../lib/types/watchlist';
import './SharedWatchlistPage.css';

interface SharedWatchlistPageProps {
  watchlistId: string;
}

export function SharedWatchlistPage({ watchlistId }: SharedWatchlistPageProps) {
  const navigate = useNavigate();
  const [watchlist, setWatchlist] = useState<WatchlistWithStocks | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const result = await getWatchlist(watchlistId);
        setWatchlist(result.watchlist);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load watchlist');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [watchlistId]);

  if (loading) {
    return (
      <div className="shared-watchlist-page">
        <div className="loading-state">Loading watchlist...</div>
      </div>
    );
  }

  if (error || !watchlist) {
    return (
      <div className="shared-watchlist-page">
        <div className="error-state">{error || 'Watchlist not found'}</div>
      </div>
    );
  }

  return (
    <div className="shared-watchlist-page">
      <div className="page-header">
        <button className="back-home-btn" onClick={() => navigate('/')}>
          ←
        </button>
        <span className="watchlist-title">{watchlist.name}</span>
      </div>
      <WatchlistItem
        hideHeader
        watchlist={{
          id: watchlist.id,
          name: watchlist.name,
          items: watchlist.items,
          updatedAt: watchlist.updatedAt,
          isSystem: watchlist.isSystem,
        }}
        isExpanded={true}
        isLoading={false}
        stocks={watchlist.stocks}
        onToggle={() => {}}
        onSelectSymbol={(symbol) => navigate(`/${symbol}`)}
      />
    </div>
  );
}
