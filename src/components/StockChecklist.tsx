import { useState, useCallback } from 'react';
import { useToast } from '../contexts/ToastContext';
import { ToastDuration } from './Toast';
import { getStockChecklist } from '../api/checklistApi';
import type {
  ChecklistResult,
  ChecklistCategory,
  ChecklistItem,
  ChecklistStatus,
  ManualChecklistInput,
} from '../types';
import './StockChecklist.css';

const STATUS_ICONS: Record<ChecklistStatus, string> = {
  safe: '\u2713',
  warning: '\u26A0',
  danger: '\u2717',
  manual: '?',
  unavailable: '\u2014',
};

function formatMarketCap(marketCap: number): string {
  if (!marketCap || marketCap === 0) return 'N/A';
  if (marketCap >= 1e12) return `$${(marketCap / 1e12).toFixed(2)}T`;
  if (marketCap >= 1e9) return `$${(marketCap / 1e9).toFixed(2)}B`;
  if (marketCap >= 1e6) return `$${(marketCap / 1e6).toFixed(1)}M`;
  return `$${marketCap.toLocaleString()}`;
}

export function StockChecklist() {
  const { showError, showWarning } = useToast();
  const [symbol, setSymbol] = useState('');
  const [loading, setLoading] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistResult | null>(null);
  const [manualInput, setManualInput] = useState<ManualChecklistInput>({});

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol.trim()) {
      showWarning('Please enter a stock symbol', ToastDuration.Short);
      return;
    }

    setLoading(true);
    try {
      const result = await getStockChecklist(symbol.trim().toUpperCase(), manualInput);
      setChecklist(result);

      if (result.errors.length > 0) {
        showWarning(`Some data unavailable: ${result.errors.join(', ')}`, ToastDuration.Long);
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to get checklist', ToastDuration.Medium);
    } finally {
      setLoading(false);
    }
  }, [symbol, manualInput, showError, showWarning]);

  const handleManualInputChange = useCallback((field: keyof ManualChecklistInput, value: any) => {
    setManualInput(prev => ({ ...prev, [field]: value }));
  }, []);

  const refreshChecklist = useCallback(async () => {
    if (!checklist) return;
    setLoading(true);
    try {
      const result = await getStockChecklist(checklist.symbol, manualInput);
      setChecklist(result);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to refresh checklist', ToastDuration.Medium);
    } finally {
      setLoading(false);
    }
  }, [checklist, manualInput, showError]);

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
            <div className="company-info">
              <h2>{checklist.symbol}</h2>
              <span className="company-name">{checklist.companyName}</span>
              {checklist.isBiotech && <span className="biotech-badge">Biotech</span>}
            </div>
            <div className="company-meta">
              <span className="industry">{checklist.industry}</span>
              <span className="price">${checklist.price.toFixed(2)}</span>
              <span className="market-cap">{formatMarketCap(checklist.marketCap)}</span>
            </div>
          </div>

          <div className="categories-grid">
            {checklist.categories.map((category) => (
              <CategoryCard
                key={category.id}
                category={category}
                manualInput={manualInput}
                onManualInputChange={handleManualInputChange}
              />
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
  manualInput: ManualChecklistInput;
  onManualInputChange: (field: keyof ManualChecklistInput, value: any) => void;
}

function CategoryCard({ category, manualInput, onManualInputChange }: CategoryCardProps) {
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
          <ChecklistItemRow
            key={item.id}
            item={item}
            manualInput={manualInput}
            onManualInputChange={onManualInputChange}
          />
        ))}
      </div>
    </div>
  );
}

interface ChecklistItemRowProps {
  item: ChecklistItem;
  manualInput: ManualChecklistInput;
  onManualInputChange: (field: keyof ManualChecklistInput, value: any) => void;
}

function ChecklistItemRow({ item, manualInput, onManualInputChange }: ChecklistItemRowProps) {
  const renderManualInput = () => {
    if (!item.isManual || item.status !== 'manual') return null;

    switch (item.id) {
      case 'insider_ownership':
        return (
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            placeholder="%"
            className="manual-input"
            value={manualInput.insiderOwnership ?? ''}
            onChange={(e) => onManualInputChange('insiderOwnership', e.target.value ? parseFloat(e.target.value) : undefined)}
          />
        );
      case 'institutional_ownership':
        return (
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            placeholder="%"
            className="manual-input"
            value={manualInput.institutionalOwnership ?? ''}
            onChange={(e) => onManualInputChange('institutionalOwnership', e.target.value ? parseFloat(e.target.value) : undefined)}
          />
        );
      case 'clinical_stage':
        return (
          <select
            className="manual-select"
            value={manualInput.clinicalStage ?? ''}
            onChange={(e) => onManualInputChange('clinicalStage', e.target.value || undefined)}
          >
            <option value="">Select...</option>
            <option value="preclinical">Pre-clinical</option>
            <option value="phase1">Phase 1</option>
            <option value="phase2">Phase 2</option>
            <option value="phase3">Phase 3</option>
            <option value="bla_filed">BLA Filed</option>
            <option value="approved">Approved</option>
          </select>
        );
      case 'days_below_1':
        return (
          <input
            type="number"
            min="0"
            placeholder="Days"
            className="manual-input"
            value={manualInput.daysBelow1Dollar ?? ''}
            onChange={(e) => onManualInputChange('daysBelow1Dollar', e.target.value ? parseInt(e.target.value, 10) : undefined)}
          />
        );
      case 'recent_atm':
        return (
          <select
            className="manual-select"
            value={manualInput.hasRecentATM === undefined ? '' : String(manualInput.hasRecentATM)}
            onChange={(e) => onManualInputChange('hasRecentATM', e.target.value === '' ? undefined : e.target.value === 'true')}
          >
            <option value="">Select...</option>
            <option value="false">No</option>
            <option value="true">Yes</option>
          </select>
        );
      case 'pending_reverse_split':
        return (
          <select
            className="manual-select"
            value={manualInput.hasPendingReverseSplit === undefined ? '' : String(manualInput.hasPendingReverseSplit)}
            onChange={(e) => onManualInputChange('hasPendingReverseSplit', e.target.value === '' ? undefined : e.target.value === 'true')}
          >
            <option value="">Select...</option>
            <option value="false">No</option>
            <option value="true">Yes</option>
          </select>
        );
      case 'nasdaq_deficiency':
        return (
          <select
            className="manual-select"
            value={manualInput.hasNasdaqDeficiency === undefined ? '' : String(manualInput.hasNasdaqDeficiency)}
            onChange={(e) => onManualInputChange('hasNasdaqDeficiency', e.target.value === '' ? undefined : e.target.value === 'true')}
          >
            <option value="">Select...</option>
            <option value="false">No</option>
            <option value="true">Yes</option>
          </select>
        );
      default:
        return null;
    }
  };

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
        {item.status === 'manual' ? (
          renderManualInput()
        ) : (
          <span className={`value status-${item.status}`}>{item.displayValue}</span>
        )}
      </div>
    </div>
  );
}

export default StockChecklist;
