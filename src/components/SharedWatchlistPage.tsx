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

  // Calculate average return for stocks with historical data
  const stocksWithHistory = watchlist.stocks.filter(s => s.historicalChangePercent != null);
  const totalReturn = stocksWithHistory.length > 0
    ? stocksWithHistory.reduce((acc, s) => acc + (s.historicalChangePercent ?? 0), 0) / stocksWithHistory.length
    : null;

  return (
    <div className="shared-watchlist-page">
      <div className="page-header">
        <button className="back-home-btn" onClick={() => navigate('/')}>
          ←
        </button>
        <span className="watchlist-title">{watchlist.name}</span>
      </div>
      {totalReturn != null && (
        <div className={`comparison-badge ${totalReturn >= 0 ? 'up' : 'down'}`}>
          <span className="comparison-main">
            Avg. return: {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(1)}%
          </span>
          <span className="comparison-subtext">Across {stocksWithHistory.length} stocks with date set</span>
        </div>
      )}
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
        onSelectSymbol={() => {}}
      />
    </div>
  );
}
