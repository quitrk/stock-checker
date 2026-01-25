import { useState, useMemo } from 'react';
import { StockLogo } from './StockLogo';
import { SwipeableRow } from './SwipeableRow';
import type { WatchlistSummary, WatchlistStock } from '../../lib/types/watchlist';
import './WatchlistItem.css';

// Copy to clipboard with fallback for older browsers
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  }
}

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
  const [shareCopied, setShareCopied] = useState(false);

  // Calculate total return for stocks with date added
  const stocksWithDateAdded = stocks.filter(s => s.addedAt && s.historicalChangePercent != null);
  const totalReturn = stocksWithDateAdded.length > 0
    ? stocksWithDateAdded.reduce((acc, s) => acc + (s.historicalChangePercent ?? 0), 0) / stocksWithDateAdded.length
    : null;

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/watchlist/${watchlist.id}`;
    const success = await copyToClipboard(shareUrl);
    if (success) {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
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
        <SwipeableRow
          enabled={!isSystem && !!onDelete}
          className="watchlist-header-wrapper"
          actions={
            <button
              type="button"
              className="swipe-action-btn remove"
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.();
              }}
            >
              Remove
            </button>
          }
        >
          <div
            className={`watchlist-header ${isExpanded ? 'expanded' : ''}`}
            onClick={onToggle}
          >
            <span className="expand-icon">{isExpanded ? '\u25BC' : '\u25B6'}</span>
            <span className="name">{watchlist.name}</span>
            {!isSystem && (
              <button
                type="button"
                className={`share-btn ${shareCopied ? 'copied' : ''}`}
                onClick={handleShare}
                title="Copy share link"
              >
                {shareCopied ? 'Copied!' : 'Share'}
              </button>
            )}
            {!isSystem && onDelete && (
              <button
                type="button"
                className="header-remove-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                title="Remove watchlist"
              >
                Remove
              </button>
            )}
          </div>
        </SwipeableRow>
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
                const hasActions = !isSystem && !!(onRemoveSymbol || onEditSymbol);

                return (
                  <SwipeableRow
                    key={stock.symbol}
                    enabled={hasActions}
                    className={`stock-row-wrapper ${hasActions ? 'has-actions' : ''}`}
                    actions={
                      <>
                        {onEditSymbol && (
                          <button
                            type="button"
                            className="swipe-action-btn edit"
                            onClick={(e) => {
                              e.stopPropagation();
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
                              onRemoveSymbol(stock.symbol);
                            }}
                          >
                            Remove
                          </button>
                        )}
                      </>
                    }
                  >
                    <div
                      className={`stock-row ${hasWeights ? 'has-weights' : ''}`}
                      onClick={() => onSelectSymbol(stock.symbol)}
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
                  </SwipeableRow>
                );
              })}
              {totalReturn != null && (
                <div className={`total-return-row ${totalReturn >= 0 ? 'up' : 'down'}`}>
                  <span className="total-return-label">
                    Avg. return ({stocksWithDateAdded.length} {stocksWithDateAdded.length === 1 ? 'stock' : 'stocks'})
                  </span>
                  <span className="total-return-value">
                    {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(1)}%
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
