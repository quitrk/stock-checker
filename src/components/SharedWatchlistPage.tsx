import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getWatchlist } from '../api/watchlistApi';
import { WatchlistItem } from './WatchlistItem';
import type { WatchlistWithStocks } from '../../lib/types/watchlist';
import './SharedWatchlistPage.css';

interface SharedWatchlistPageProps {
  watchlistId: string;
  timestamp?: number; // Unix timestamp in seconds
}

export function SharedWatchlistPage({ watchlistId, timestamp }: SharedWatchlistPageProps) {
  const navigate = useNavigate();
  const [watchlist, setWatchlist] = useState<WatchlistWithStocks | null>(null);
  const [comparisonDate, setComparisonDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const result = await getWatchlist(watchlistId, timestamp);
        setWatchlist(result.watchlist);
        setComparisonDate(result.comparisonDate);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load watchlist');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [watchlistId, timestamp]);

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

  // Format comparison date for display
  const formattedDate = comparisonDate
    ? new Date(comparisonDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  // Calculate total return (average of all stocks with historical data)
  const totalReturn = comparisonDate && watchlist?.stocks
    ? (() => {
        const stocksWithHistory = watchlist.stocks.filter(s => s.historicalChangePercent != null);
        if (stocksWithHistory.length === 0) return null;
        const sum = stocksWithHistory.reduce((acc, s) => acc + (s.historicalChangePercent ?? 0), 0);
        return sum / stocksWithHistory.length;
      })()
    : null;

  return (
    <div className="shared-watchlist-page">
      <div className="page-header">
        <button className="back-home-btn" onClick={() => navigate('/')}>
          ←
        </button>
        <span className="watchlist-title">{watchlist.name}</span>
      </div>
      {formattedDate && (
        <div className={`comparison-badge ${totalReturn != null ? (totalReturn >= 0 ? 'up' : 'down') : ''}`}>
          <span className="comparison-main">
            Since {formattedDate}{totalReturn != null && `: ${totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(1)}%`}
          </span>
          {totalReturn != null && (
            <span className="comparison-subtext">Avg. return across {watchlist.stocks.filter(s => s.historicalChangePercent != null).length} stocks</span>
          )}
        </div>
      )}
      <WatchlistItem
        hideHeader
        watchlist={{
          id: watchlist.id,
          name: watchlist.name,
          symbols: watchlist.symbols,
          updatedAt: watchlist.updatedAt,
          isSystem: watchlist.isSystem,
        }}
        isExpanded={true}
        isLoading={false}
        stocks={watchlist.stocks}
        onToggle={() => {}} // No-op, always expanded
        onSelectSymbol={() => {}} // No-op for shared view
        historicalDate={comparisonDate}
      />
    </div>
  );
}
