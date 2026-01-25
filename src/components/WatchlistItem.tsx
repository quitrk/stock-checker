import { useState, useMemo, useRef, useEffect } from 'react';
import { StockLogo } from './StockLogo';
import type { WatchlistSummary, WatchlistStock } from '../../lib/types/watchlist';
import './WatchlistItem.css';

// Swipe threshold in pixels to trigger action reveal
const SWIPE_THRESHOLD = 50;

type SortBy = 'symbol' | 'price' | 'change' | 'weight' | 'since';
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
  onEditSymbol?: (symbol: string, currentDate: string | null) => void;
  historicalDate?: string | null; // ISO date string for "Since {date}" column (applies to all)
  hideHeader?: boolean; // Hide the expandable header
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
  onEditSymbol,
  historicalDate,
  hideHeader,
}: WatchlistItemProps) {
  const isSystem = watchlist.isSystem;
  const hasWeights = stocks.some(s => s.weight != null && s.weight > 0);
  // Show "Since" column if there's a global historicalDate OR any stock has addedAt
  const hasHistorical = !!historicalDate || stocks.some(s => s.addedAt);

  const [sortBy, setSortBy] = useState<SortBy>(hasWeights ? 'weight' : 'symbol');
  const [sortOrder, setSortOrder] = useState<SortOrder>(hasWeights ? 'desc' : 'asc');

  // Track which row is swiped open (by symbol)
  const [swipedSymbol, setSwipedSymbol] = useState<string | null>(null);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Close swiped row when clicking outside
  useEffect(() => {
    if (!swipedSymbol) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const swipedRow = rowRefs.current.get(swipedSymbol);
      if (swipedRow && !swipedRow.contains(e.target as Node)) {
        setSwipedSymbol(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [swipedSymbol]);

  const handleTouchStart = (symbol: string, e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (symbol: string, e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchStartX.current - touchEndX;
    const deltaY = Math.abs(touchStartY.current - touchEndY);

    // Only trigger if horizontal swipe is dominant
    if (deltaY < Math.abs(deltaX)) {
      if (deltaX > SWIPE_THRESHOLD) {
        // Swiped left - reveal actions
        setSwipedSymbol(symbol);
      } else if (deltaX < -SWIPE_THRESHOLD) {
        // Swiped right - hide actions
        setSwipedSymbol(null);
      }
    }
  };

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
      case 'since':
        return sorted.sort((a, b) => {
          const aVal = a.addedAt || historicalDate ? (a.historicalChangePercent ?? 0) : (a.priceChangePercent ?? 0);
          const bVal = b.addedAt || historicalDate ? (b.historicalChangePercent ?? 0) : (b.priceChangePercent ?? 0);
          return multiplier * (aVal - bVal);
        });
      default:
        return sorted.sort((a, b) => multiplier * a.symbol.localeCompare(b.symbol));
    }
  }, [stocks, sortBy, sortOrder, historicalDate]);

  // Format date for display (includes year)
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="watchlist-group">
      {!hideHeader && (
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
      )}

      {(isExpanded || hideHeader) && (
        <div className="watchlist-stocks">
          {isLoading ? (
            <div className="loading">Loading...</div>
          ) : stocks.length === 0 ? (
            <div className="empty">No stocks</div>
          ) : (
            <>
              <div className={`stock-header ${hasWeights ? 'has-weights' : ''} ${!isSystem && (onRemoveSymbol || onEditSymbol) ? 'has-actions' : ''}`}>
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
                {hasHistorical ? (
                  <button
                    type="button"
                    className={`header-col change ${sortBy === 'since' ? 'active' : ''}`}
                    onClick={() => handleSort('since')}
                  >
                    Change {sortBy === 'since' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`header-col change ${sortBy === 'change' ? 'active' : ''}`}
                    onClick={() => handleSort('change')}
                  >
                    Change {sortBy === 'change' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </button>
                )}
              </div>
              {sortedStocks.map((stock) => {
                // Per-symbol: use historical if stock has addedAt, otherwise use daily
                // Global historicalDate: applies to stocks without addedAt
                const useHistorical = stock.addedAt || (historicalDate && !stock.addedAt);
                const changeValue = useHistorical ? stock.historicalChangePercent : stock.priceChangePercent;
                const changeDisplay = changeValue != null
                  ? `${changeValue >= 0 ? '+' : ''}${changeValue.toFixed(1)}%`
                  : 'N/A';
                const dateLabel = stock.addedAt ? formatDate(stock.addedAt) : null;
                const hasActions = !isSystem && (onRemoveSymbol || onEditSymbol);
                const isSwiped = swipedSymbol === stock.symbol;

                return (
                  <div
                    key={stock.symbol}
                    ref={(el) => {
                      if (el) rowRefs.current.set(stock.symbol, el);
                      else rowRefs.current.delete(stock.symbol);
                    }}
                    className={`stock-row-wrapper ${hasActions ? 'has-actions' : ''} ${isSwiped ? 'swiped' : ''}`}
                    onTouchStart={hasActions ? (e) => handleTouchStart(stock.symbol, e) : undefined}
                    onTouchEnd={hasActions ? (e) => handleTouchEnd(stock.symbol, e) : undefined}
                  >
                    <div
                      className={`stock-row ${hasWeights ? 'has-weights' : ''}`}
                      onClick={() => {
                        if (isSwiped) {
                          setSwipedSymbol(null);
                        } else {
                          onSelectSymbol(stock.symbol);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && onSelectSymbol(stock.symbol)}
                    >
                      <div className="logo-spacer">
                        {stock.logoUrl && (
                          <StockLogo
                            url={stock.logoUrl}
                            className="stock-logo"
                          />
                        )}
                      </div>
                      <span className="symbol">
                        {stock.symbol}
                        {dateLabel && <span className="symbol-date">{dateLabel}</span>}
                      </span>
                      {hasWeights && (
                        <span className="weight">{((stock.weight ?? 0) * 100).toFixed(2)}%</span>
                      )}
                      <span className="price">${(stock.price ?? 0).toFixed(2)}</span>
                      <span className={`change ${(changeValue ?? 0) >= 0 ? 'up' : 'down'}`}>
                        {changeDisplay}
                      </span>
                    </div>
                    {hasActions && (
                      <div className="swipe-actions">
                        {onEditSymbol && (
                          <button
                            type="button"
                            className="swipe-action-btn edit"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSwipedSymbol(null);
                              onEditSymbol(stock.symbol, stock.addedAt || null);
                            }}
                          >
                            Edit
                          </button>
                        )}
                        {onRemoveSymbol && (
                          <button
                            type="button"
                            className="swipe-action-btn remove"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSwipedSymbol(null);
                              onRemoveSymbol(stock.symbol);
                            }}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
