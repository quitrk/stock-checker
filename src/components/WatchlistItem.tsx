import { useState, useMemo } from 'react';
import { StockLogo } from './StockLogo';
import type { WatchlistSummary, WatchlistStock } from '../../lib/types/watchlist';
import './WatchlistItem.css';

type SortBy = 'symbol' | 'price' | 'change' | 'weight';
type SortOrder = 'asc' | 'desc';

interface WatchlistItemProps {
  watchlist: WatchlistSummary;
  isExpanded: boolean;
  isLoading: boolean;
  stocks: WatchlistStock[];
  onToggle: () => void;
  onSelectSymbol: (symbol: string) => void;
  onDelete?: () => void;
  onRemoveSymbol?: (symbol: string) => void;
}

export function WatchlistItem({
  watchlist,
  isExpanded,
  isLoading,
  stocks,
  onToggle,
  onSelectSymbol,
  onDelete,
  onRemoveSymbol,
}: WatchlistItemProps) {
  const isSystem = watchlist.isSystem;
  const hasWeights = stocks.some(s => s.weight != null && s.weight > 0);

  const [sortBy, setSortBy] = useState<SortBy>(hasWeights ? 'weight' : 'symbol');
  const [sortOrder, setSortOrder] = useState<SortOrder>(hasWeights ? 'desc' : 'asc');

  const handleSort = (column: SortBy) => {
    if (sortBy === column) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder(column === 'symbol' ? 'asc' : 'desc');
    }
  };

  const sortedStocks = useMemo(() => {
    if (!stocks.length) return [];
    const sorted = [...stocks];
    const multiplier = sortOrder === 'asc' ? 1 : -1;
    switch (sortBy) {
      case 'price':
        return sorted.sort((a, b) => multiplier * ((a.price ?? 0) - (b.price ?? 0)));
      case 'change':
        return sorted.sort((a, b) => multiplier * ((a.priceChangePercent ?? 0) - (b.priceChangePercent ?? 0)));
      case 'weight':
        return sorted.sort((a, b) => multiplier * ((a.weight ?? 0) - (b.weight ?? 0)));
      default:
        return sorted.sort((a, b) => multiplier * a.symbol.localeCompare(b.symbol));
    }
  }, [stocks, sortBy, sortOrder]);

  return (
    <div className="watchlist-group">
      <div
        className={`watchlist-header ${isExpanded ? 'expanded' : ''}`}
        onClick={onToggle}
      >
        <span className="expand-icon">{isExpanded ? '\u25BC' : '\u25B6'}</span>
        <span className="name">{watchlist.name}</span>
        {isSystem ? (
          <span className="badge-default">Default</span>
        ) : onDelete && (
          <button
            type="button"
            className="delete-btn"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            Remove
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="watchlist-stocks">
          {isLoading ? (
            <div className="loading">Loading...</div>
          ) : stocks.length === 0 ? (
            <div className="empty">No stocks</div>
          ) : (
            <>
              <div className={`stock-header ${hasWeights ? 'has-weights' : ''} ${!isSystem ? 'has-remove' : ''}`}>
                <div className="header-logo-spacer" />
                <button
                  type="button"
                  className={`header-col symbol ${sortBy === 'symbol' ? 'active' : ''}`}
                  onClick={() => handleSort('symbol')}
                >
                  Symbol {sortBy === 'symbol' && (sortOrder === 'asc' ? '▲' : '▼')}
                </button>
                {hasWeights && (
                  <button
                    type="button"
                    className={`header-col weight ${sortBy === 'weight' ? 'active' : ''}`}
                    onClick={() => handleSort('weight')}
                  >
                    Weight {sortBy === 'weight' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </button>
                )}
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
                <div key={stock.symbol} className={`stock-row ${hasWeights ? 'has-weights' : ''}`}>
                  <button
                    type="button"
                    className={`stock-btn ${isSystem ? 'full-width' : ''}`}
                    onClick={() => onSelectSymbol(stock.symbol)}
                  >
                    {stock.logoUrl && (
                      <StockLogo
                        url={stock.logoUrl}
                        className="stock-logo"
                      />
                    )}
                    <span className="symbol">{stock.symbol}</span>
                    {hasWeights && (
                      <span className="weight">{((stock.weight ?? 0) * 100).toFixed(2)}%</span>
                    )}
                    <span className="price">${(stock.price ?? 0).toFixed(2)}</span>
                    <span className={`change ${(stock.priceChangePercent ?? 0) >= 0 ? 'up' : 'down'}`}>
                      {(stock.priceChangePercent ?? 0) >= 0 ? '+' : ''}{(stock.priceChangePercent ?? 0).toFixed(1)}%
                    </span>
                  </button>
                  {!isSystem && onRemoveSymbol && (
                    <button
                      type="button"
                      className="remove-btn"
                      onClick={() => onRemoveSymbol(stock.symbol)}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
