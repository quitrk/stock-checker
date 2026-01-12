import { useState, useCallback, useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';
import { ToastDuration } from './Toast';
import { getStockChecklist } from '../api/checklistApi';
import type {
  ChecklistResult,
  ChecklistCategory,
  ChecklistItem,
  ChecklistStatus,
} from '../types';
import './StockChecklist.css';

const STATUS_ICONS: Record<ChecklistStatus, string> = {
  safe: '\u2713',
  warning: '\u26A0',
  danger: '\u2717',
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
  const { showError, showWarning } = useToast();
  const [symbol, setSymbol] = useState(getSymbolFromUrl);
  const [loading, setLoading] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistResult | null>(null);

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

  return (
    <div className="stock-checklist">
      <div className="checklist-header">
        <h1>Stock Checker</h1>
        <p className="checklist-subtitle">
          Evaluate stocks for risk factors based on volume, fundamentals, price, and SEC filings
        </p>
      </div>

      <form onSubmit={handleSubmit} className="symbol-form">
        <div className="symbol-input-group">
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="Enter symbol (e.g., AAPL)"
            className="symbol-input"
            disabled={loading}
          />
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>
      </form>

      {checklist && (
        <div className="checklist-results">
          <div className="company-header">
            <div className="company-title">
              <h2>{checklist.symbol}</h2>
              <span className="company-name">{checklist.companyName}</span>
            </div>
            <div className="company-details">
              <span className="price">${checklist.price.toFixed(2)}</span>
              <span className="detail-separator">•</span>
              <span className="market-cap">{formatMarketCap(checklist.marketCap)}</span>
              <span className="detail-separator">•</span>
              <span className="industry">{checklist.industry}</span>
            </div>
          </div>

          <div className="categories-grid">
            {checklist.categories.map((category) => (
              <CategoryCard key={category.id} category={category} />
            ))}
          </div>

          <div className="checklist-actions">
            <button onClick={refreshChecklist} className="btn-secondary" disabled={loading}>
              Refresh Analysis
            </button>
            <span className="last-updated">
              Last updated: {new Date(checklist.timestamp).toLocaleTimeString()}
            </span>
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
  return (
    <div className={`category-card status-${category.status}`}>
      <div className="category-header">
        <h3>{category.name}</h3>
        <span className={`category-status status-${category.status}`}>
          {STATUS_ICONS[category.status]}
        </span>
      </div>
      <p className="category-description">{category.description}</p>

      <div className="checklist-items">
        {category.items.map((item) => (
          <ChecklistItemRow key={item.id} item={item} />
        ))}
      </div>
    </div>
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
