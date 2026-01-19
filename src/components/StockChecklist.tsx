import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { ToastDuration } from './Toast';
import { getStockChecklist } from '../api/checklistApi';
import type {
  ChecklistResult,
  ChecklistCategory,
  ChecklistItem,
  ChecklistStatus,
} from '../../lib/types/index.js';
import { AnalystSection } from './AnalystSection';
import { CalendarSection } from './CalendarSection';
import { NewsSection } from './NewsSection';
import { Expander } from './Expander';
import { AuthButton } from './AuthButton';
import { AddToWatchlistButton } from './AddToWatchlistButton';
import { WatchlistSidebar } from './WatchlistSidebar';
import './StockChecklist.css';

const STATUS_ICONS: Record<ChecklistStatus, string> = {
  safe: '\u2713',
  warning: '\u26A0',
  danger: '!',
  unavailable: '\u2014',
};

function formatMarketCap(marketCap: number): string {
  if (!marketCap || marketCap === 0) return 'N/A';
  if (marketCap >= 1e12) return `$${(marketCap / 1e12).toFixed(2)}T`;
  if (marketCap >= 1e9) return `$${(marketCap / 1e9).toFixed(2)}B`;
  if (marketCap >= 1e6) return `$${(marketCap / 1e6).toFixed(1)}M`;
  return `$${marketCap.toLocaleString()}`;
}

function getSymbolFromUrl(): string {
  const path = window.location.pathname;
  const match = path.match(/^\/([A-Za-z]+)$/);
  return match ? match[1].toUpperCase() : '';
}

function updateUrl(symbol: string) {
  const newPath = symbol ? `/${symbol.toUpperCase()}` : '/';
  if (window.location.pathname !== newPath) {
    window.history.pushState({}, '', newPath);
  }
}

export function StockChecklist() {
  const { isAuthenticated } = useAuth();
  const { showError, showWarning } = useToast();
  const [symbol, setSymbol] = useState(getSymbolFromUrl);
  const [loading, setLoading] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistResult | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input after loading completes
  useEffect(() => {
    if (!loading) {
      inputRef.current?.focus();
    }
  }, [loading]);

  const fetchChecklist = useCallback(async (sym: string, refresh = false) => {
    if (!sym.trim()) return;

    setLoading(true);
    try {
      const result = await getStockChecklist(sym.trim().toUpperCase(), refresh);
      setChecklist(result);
      updateUrl(sym);

      if (result.errors.length > 0) {
        showWarning(`Some data unavailable: ${result.errors.join(', ')}`, ToastDuration.Long);
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to get checklist', ToastDuration.Medium);
    } finally {
      setLoading(false);
    }
  }, [showError, showWarning]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol.trim()) {
      showWarning('Please enter a stock symbol', ToastDuration.Short);
      return;
    }
    fetchChecklist(symbol);
  }, [symbol, fetchChecklist, showWarning]);

  // Load symbol from URL on mount
  useEffect(() => {
    const urlSymbol = getSymbolFromUrl();
    if (urlSymbol) {
      setSymbol(urlSymbol);
      fetchChecklist(urlSymbol);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      const urlSymbol = getSymbolFromUrl();
      setSymbol(urlSymbol);
      if (urlSymbol) {
        fetchChecklist(urlSymbol);
      } else {
        setChecklist(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [fetchChecklist]);

  const refreshChecklist = useCallback(() => {
    if (checklist) {
      fetchChecklist(checklist.symbol, true); // Skip cache on refresh
    }
  }, [checklist, fetchChecklist]);

  const handleSelectSymbol = useCallback((sym: string) => {
    setSymbol(sym);
    fetchChecklist(sym);
  }, [fetchChecklist]);

  return (
    <div className="stock-checklist">
      {isAuthenticated && (
        <>
          <WatchlistSidebar
            isOpen={sidebarOpen}
            onToggle={() => setSidebarOpen(!sidebarOpen)}
            onSelectSymbol={handleSelectSymbol}
          />
          {sidebarOpen && (
            <div
              className="sidebar-overlay"
              onClick={() => setSidebarOpen(false)}
            />
          )}
        </>
      )}
      <header className="app-header">
        <div className="header-left">
          {checklist?.logoUrl && (
              <img
                key={checklist.logoUrl}
                src={checklist.logoUrl}
                alt={`${checklist.companyName} logo`}
                className="header-logo"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            )}
            <form onSubmit={handleSubmit} className="symbol-form">
              <div className="symbol-input-group">
                <input
                  ref={inputRef}
                  type="text"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  placeholder="Symbol"
                  className="symbol-input"
                  disabled={loading}
                />
                <div className="btn-split">
                  <button type="submit" className="btn-primary" disabled={loading}>
                    {loading ? '...' : 'Go'}
                  </button>
                  {checklist && (
                    <button
                      type="button"
                      className="btn-primary btn-refresh"
                      onClick={refreshChecklist}
                      disabled={loading}
                      title="Refresh data"
                    >
                      &#8635;
                    </button>
                  )}
                </div>
              </div>
            </form>
            {checklist && (
              <>
                <span className="header-company-name">{checklist.companyName}</span>
                <span className="header-industry">{checklist.industry}</span>
                <span className="header-price">${checklist.price.toFixed(2)}</span>
                <span className="header-market-cap">{formatMarketCap(checklist.marketCap)}</span>
              </>
            )}
          </div>
          <div className="header-right">
            <AuthButton />
          </div>
        </header>

      {loading && <div className="loading-overlay" />}

      {!checklist && !loading && (
        <div className="empty-state">
          <p>Enter a stock symbol to analyze risk factors, fundamentals, and SEC filings.</p>
        </div>
      )}

      {checklist && (
        <div className="checklist-results">
          {isAuthenticated && (
            <div className="results-actions">
              <AddToWatchlistButton symbol={checklist.symbol} />
            </div>
          )}

          <div className="content-layout">
            <div className="content-main">
              <div className="categories-grid">
                <div className="categories-column">
                  {checklist.categories.slice(0, Math.ceil(checklist.categories.length / 2)).map((category) => (
                    <CategoryCard key={category.id} category={category} />
                  ))}
                </div>
                <div className="categories-column">
                  {checklist.categories.slice(Math.ceil(checklist.categories.length / 2)).map((category) => (
                    <CategoryCard key={category.id} category={category} />
                  ))}
                </div>
              </div>
            </div>

            <div className="content-sidebar">
              {checklist.analystData && (
                <AnalystSection analystData={checklist.analystData} currentPrice={checklist.price} />
              )}

              {checklist.calendarEvents && (
                <CalendarSection calendarEvents={checklist.calendarEvents} />
              )}

              {checklist.news && checklist.news.length > 0 && (
                <NewsSection news={checklist.news} summary={checklist.newsSummary} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface CategoryCardProps {
  category: ChecklistCategory;
}

function CategoryCard({ category }: CategoryCardProps) {
  const allGreen = category.status === 'safe' || category.status === 'unavailable';

  const summaryItem = category.summaryItemId
    ? category.items.find(i => i.id === category.summaryItemId)
    : undefined;

  const summary = summaryItem && summaryItem.status !== 'unavailable' ? (
    <span className={`summary-item status-${summaryItem.status}`}>
      {summaryItem.label}: {summaryItem.displayValue}
    </span>
  ) : undefined;

  return (
    <Expander
      title={category.name}
      defaultExpanded={!allGreen}
      summary={summary}
      headerRight={
        <span className={`category-status status-${category.status}`}>
          {STATUS_ICONS[category.status]}
        </span>
      }
      className={`category-card status-${category.status}`}
    >
      <p className="category-description">{category.description}</p>
      <div className="checklist-items">
        {category.items.map((item) => (
          <ChecklistItemRow key={item.id} item={item} />
        ))}
      </div>
    </Expander>
  );
}

interface ChecklistItemRowProps {
  item: ChecklistItem;
}

function ChecklistItemRow({ item }: ChecklistItemRowProps) {
  return (
    <div className={`checklist-item status-${item.status}`}>
      <div className="item-status">
        <span className={`status-indicator status-${item.status}`}>
          {STATUS_ICONS[item.status]}
        </span>
      </div>
      <div className="item-content">
        <div className="item-label">{item.label}</div>
        <div className="item-description">{item.description}</div>
        {item.thresholds && (
          <div className="item-thresholds">
            <span className="threshold safe">{item.thresholds.safe}</span>
            <span className="threshold warning">{item.thresholds.warning}</span>
            <span className="threshold danger">{item.thresholds.danger}</span>
          </div>
        )}
      </div>
      <div className="item-value">
        <span className={`value status-${item.status}`}>{item.displayValue}</span>
      </div>
    </div>
  );
}

export default StockChecklist;
