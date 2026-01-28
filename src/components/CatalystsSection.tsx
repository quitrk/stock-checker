import { useState, useEffect } from 'react';
import type { CatalystEvent, CatalystEventType } from '../../lib/types/index.js';
import { CATALYST_INFO, CATALYST_CATEGORIES, getCatalystsByCategory, DRUG_DEVELOPMENT_TIMELINE } from '../../lib/constants/catalysts.js';
import { useApp } from '../contexts/AppContext';
import { getWatchlistCatalysts } from '../api/watchlistApi';
import { Expander } from './Expander';
import { Dialog } from './Dialog';
import './CatalystsSection.css';

interface CatalystsSectionProps {
  catalystEvents?: CatalystEvent[];
  currentSymbol?: string;
  onSelectSymbol?: (symbol: string) => void;
  defaultExpanded?: boolean;
  /** When provided, fetches catalysts for this watchlist and hides the selector */
  watchlistId?: string;
}

// Helper functions to get icon and label from CATALYST_INFO
const getEventIcon = (eventType: CatalystEventType): string => {
  return CATALYST_INFO[eventType]?.icon || '📌';
};

const getEventLabel = (eventType: CatalystEventType): string => {
  return CATALYST_INFO[eventType]?.label || eventType;
};

type CatalystFilter = 'earnings' | 'pdufa' | 'adcom' | 'fda_approval' | 'fda_rejection' | 'fda_designation' | 'nda_bla' | 'clinical' | 'readout' | 'dividends' | 'sec' | 'corporate';

const FILTER_CONFIG: { key: CatalystFilter; label: string; icon: string; category: string; match: (e: CatalystEvent) => boolean }[] = [
  // Financial
  { key: 'earnings', label: 'Earnings', icon: '📊', category: 'Financial', match: e => e.eventType === 'earnings' || e.eventType === 'earnings_call' },
  { key: 'dividends', label: 'Dividends', icon: '💰', category: 'Financial', match: e => e.eventType === 'ex_dividend' || e.eventType === 'dividend_payment' },
  // FDA/Regulatory
  { key: 'pdufa', label: 'PDUFA Date', icon: '🗓️', category: 'FDA', match: e => e.eventType === 'pdufa_date' },
  { key: 'adcom', label: 'AdCom Meeting', icon: '👥', category: 'FDA', match: e => e.eventType === 'adcom' },
  { key: 'fda_approval', label: 'FDA Approval', icon: '✅', category: 'FDA', match: e => e.eventType === 'fda_approval' },
  { key: 'fda_rejection', label: 'FDA Rejection', icon: '❌', category: 'FDA', match: e => e.eventType === 'fda_rejection' },
  { key: 'fda_designation', label: 'FDA Designation', icon: '⭐', category: 'FDA', match: e => e.eventType === 'fda_designation' },
  { key: 'nda_bla', label: 'NDA/BLA Filing', icon: '📝', category: 'FDA', match: e => e.eventType === 'nda_bla_submission' },
  // Clinical Trials
  { key: 'clinical', label: 'Clinical Trials', icon: '🧬', category: 'Clinical', match: e => e.eventType === 'clinical_trial' || e.eventType === 'clinical_milestone' },
  { key: 'readout', label: 'Data Readouts', icon: '📊', category: 'Clinical', match: e => e.eventType === 'clinical_readout' },
  // Corporate
  { key: 'sec', label: 'SEC Filings', icon: '📄', category: 'Corporate', match: e => e.eventType === 'sec_filing' },
  { key: 'corporate', label: 'Corporate Events', icon: '🏢', category: 'Corporate', match: e => ['analyst_rating', 'insider_transaction', 'executive_change', 'acquisition', 'partnership', 'stock_split', 'reverse_split'].includes(e.eventType) },
];

function isFutureDate(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(dateStr);
  return date >= today;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();

  if (sameYear) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function CatalystsSection({ catalystEvents = [], currentSymbol, onSelectSymbol, defaultExpanded = true, watchlistId }: CatalystsSectionProps) {
  const { watchlist } = useApp();
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [watchlistEvents, setWatchlistEvents] = useState<CatalystEvent[]>([]);
  const [loading, setLoading] = useState(false);
  // null means "all selected" (default state)
  const [selectedFilters, setSelectedFilters] = useState<Set<CatalystFilter> | null>(null);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  const userWatchlists = watchlist.watchlists;
  const defaultWatchlists = watchlist.defaultWatchlists;
  const firstAvailableWatchlist = defaultWatchlists[0] || userWatchlists[0];

  // When watchlistId is provided, we're in direct watchlist mode
  const isDirectWatchlistMode = !!watchlistId;

  // Initialize selected source on mount, and handle when symbol is cleared
  useEffect(() => {
    if (isDirectWatchlistMode) return;
    if (selectedSource === null) {
      // Initial mount - set default source
      if (currentSymbol) {
        setSelectedSource('symbol');
      } else {
        setSelectedSource(firstAvailableWatchlist?.id || null);
      }
    } else if (selectedSource === 'symbol' && !currentSymbol) {
      // Symbol was cleared - switch to first watchlist
      setSelectedSource(firstAvailableWatchlist?.id || null);
    }
  }, [currentSymbol, selectedSource, firstAvailableWatchlist?.id, isDirectWatchlistMode]);

  // Fetch catalysts for direct watchlist mode
  useEffect(() => {
    if (!watchlistId) return;

    setLoading(true);
    getWatchlistCatalysts(watchlistId)
      .then(setWatchlistEvents)
      .catch(err => console.error('Failed to fetch watchlist catalysts:', err))
      .finally(() => setLoading(false));
  }, [watchlistId]);

  // Fetch watchlist catalysts when a watchlist is selected (non-direct mode)
  useEffect(() => {
    if (isDirectWatchlistMode) return;
    if (!selectedSource || selectedSource === 'symbol') {
      setWatchlistEvents([]);
      return;
    }

    setLoading(true);
    getWatchlistCatalysts(selectedSource)
      .then(setWatchlistEvents)
      .catch(err => console.error('Failed to fetch watchlist catalysts:', err))
      .finally(() => setLoading(false));
  }, [selectedSource, isDirectWatchlistMode]);

  // Use watchlist events if a watchlist is selected, otherwise use prop events
  const activeEvents = isDirectWatchlistMode
    ? watchlistEvents
    : selectedSource === 'symbol'
      ? catalystEvents
      : watchlistEvents;

  // Compute available filters based on what events exist
  const availableFilters = FILTER_CONFIG.filter(filter => activeEvents.some(event => filter.match(event)));

  // Apply filter - null means all selected (show everything)
  const getFilteredEvents = () => {
    // null = all selected, show everything
    if (selectedFilters === null) return activeEvents;
    // empty set = nothing selected, also show everything (fallback)
    if (selectedFilters.size === 0) return activeEvents;
    return activeEvents.filter(event =>
      FILTER_CONFIG.some(filter => selectedFilters.has(filter.key) && filter.match(event))
    );
  };
  const filteredEvents = getFilteredEvents();

  // Check if a filter is selected (null means all are selected)
  const isFilterSelected = (filterKey: CatalystFilter) => {
    return selectedFilters === null || selectedFilters.has(filterKey);
  };

  const toggleFilter = (filterKey: CatalystFilter) => {
    setSelectedFilters(prev => {
      // If null (all selected), create set with all EXCEPT the toggled one
      if (prev === null) {
        const allExceptOne = new Set(availableFilters.map(f => f.key).filter(k => k !== filterKey));
        return allExceptOne;
      }
      const next = new Set(prev);
      if (next.has(filterKey)) {
        next.delete(filterKey);
      } else {
        next.add(filterKey);
      }
      return next;
    });
  };

  const selectAllFilters = () => setSelectedFilters(null);

  // Filter to only future events within 1 year and sort by date
  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

  const futureEvents = filteredEvents
    .filter(event => {
      const eventDate = new Date(event.date);
      return isFutureDate(event.date) && eventDate <= oneYearFromNow;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // Also show recent past events (last 60 days) for context
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const recentPastEvents = filteredEvents
    .filter(event => {
      const eventDate = new Date(event.date);
      return eventDate < new Date() && eventDate >= sixtyDaysAgo;
    })
    .sort((a, b) => b.date.localeCompare(a.date)) // Most recent first
    .slice(0, 5);

  // Show section if we have events OR if user has watchlists to select from
  const hasWatchlists = userWatchlists.length > 0 || defaultWatchlists.length > 0;

  // In direct watchlist mode, always render (we're loading or have events)
  if (isDirectWatchlistMode) {
    // Continue to render
  } else {
    // Don't render if no data and no watchlists to select
    if (futureEvents.length === 0 && recentPastEvents.length === 0 && !hasWatchlists && !loading) {
      return null;
    }

    // In empty state mode (no symbol), don't render until we have a selected watchlist
    if (!currentSymbol && !selectedSource) {
      return null;
    }
  }

  // Generate summary from next upcoming event
  const summary = futureEvents.length > 0
    ? `${getEventLabel(futureEvents[0].eventType)} ${formatDate(futureEvents[0].date)}`
    : recentPastEvents.length > 0
      ? `${recentPastEvents.length} past event${recentPastEvents.length > 1 ? 's' : ''}`
      : undefined;

  const showWatchlistInEvents = isDirectWatchlistMode || selectedSource !== 'symbol';

  // null means all selected, so allSelected = true
  const allSelected = selectedFilters === null;
  // Count how many are selected (for badge) - only show if not all selected
  const selectedCount = selectedFilters === null ? availableFilters.length : selectedFilters.size;
  const hasActiveFilters = !allSelected && selectedCount > 0 && selectedCount < availableFilters.length;

  // Header has filter button (if multiple filters) and help button
  const headerActions = (
    <div className="catalyst-header-actions" onClick={e => e.stopPropagation()}>
      {availableFilters.length > 1 && (
        <button
          className={`filter-icon-btn ${hasActiveFilters ? 'has-filters' : ''}`}
          onClick={() => setShowFilterDropdown(!showFilterDropdown)}
          title="Filter catalysts"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="2" y1="4" x2="14" y2="4" />
            <line x1="4" y1="8" x2="12" y2="8" />
            <line x1="6" y1="12" x2="10" y2="12" />
          </svg>
          {hasActiveFilters && (
            <span className="filter-badge">{selectedCount}</span>
          )}
        </button>
      )}
      <button className="help-icon-btn" onClick={() => setShowHelpModal(true)} title="Learn about catalysts">
        ?
      </button>
    </div>
  );

  return (
    <Expander title="Catalysts" summary={summary} defaultExpanded={defaultExpanded} ignoreMobileCollapse={!currentSymbol || isDirectWatchlistMode} className="calendar-section" loading={loading} headerRight={headerActions}>
      {!isDirectWatchlistMode && (hasWatchlists || currentSymbol) && (
        <div className="catalyst-source-selector">
          <select
            value={selectedSource || ''}
            onChange={(e) => setSelectedSource(e.target.value)}
            className="source-select"
          >
            {currentSymbol && (
              <optgroup label="Current Stock">
                <option value="symbol">{currentSymbol}</option>
              </optgroup>
            )}
            {defaultWatchlists.length > 0 && (
              <optgroup label="ETF Watchlists">
                {defaultWatchlists.map(wl => (
                  <option key={wl.id} value={wl.id}>{wl.name}</option>
                ))}
              </optgroup>
            )}
            {userWatchlists.length > 0 && (
              <optgroup label="My Watchlists">
                {userWatchlists.map(wl => (
                  <option key={wl.id} value={wl.id}>{wl.name}</option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
      )}

      <div className="calendar-events">
        {futureEvents.length > 0 && (
          <>
            <div className="events-header">Upcoming</div>
            {futureEvents.map(event => {
              const content = (
                <>
                  <span className="event-icon">{getEventIcon(event.eventType)}</span>
                  <div className="event-content">
                    <span className="event-label">
                      {showWatchlistInEvents && (
                        <button
                          className="event-symbol"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onSelectSymbol?.(event.symbol);
                          }}
                        >
                          {event.symbol}
                        </button>
                      )}
                      {event.title}
                    </span>
                    {event.description && (
                      <span className="event-description" title={event.description}>{event.description}</span>
                    )}
                    {(event.eventType === 'earnings' || event.eventType === 'earnings_call') && event.earningsHistory && (() => {
                      const history = event.earningsHistory;
                      const getQuarter = (dateStr: string) => {
                        const month = new Date(dateStr).getMonth();
                        return `Q${Math.floor(month / 3) + 1}`;
                      };
                      return (
                        <span className="earnings-performance">
                          {history.slice(0, 3).map((h, i) => (
                            <span key={i} className={`perf-badge ${typeof h.priceMove === 'number' ? (h.priceMove >= 0 ? 'positive' : 'negative') : ''}`}>
                              <span className="quarter-label">{getQuarter(h.date)}</span>
                              {typeof h.beat === 'boolean' && (
                                <span className={h.beat ? 'beat' : 'miss'}>{h.beat ? '✓' : '✗'}</span>
                              )}
                              {typeof h.priceMove === 'number' && (
                                <>
                                  <span className="perf-separator">|</span>
                                  <span className="price-move">
                                    {h.priceMove >= 0 ? '+' : ''}{h.priceMove.toFixed(1)}%
                                  </span>
                                </>
                              )}
                            </span>
                          ))}
                        </span>
                      );
                    })()}
                  </div>
                  <span className={`event-date ${event.isEstimate ? 'estimated' : ''}`}>
                    {formatDate(event.date)}
                    {event.dateEnd && event.dateEnd !== event.date && ` - ${formatDate(event.dateEnd)}`}
                    {event.isEstimate && <span className="estimate-badge">Est</span>}
                  </span>
                </>
              );
              const uniqueKey = `${event.symbol}-${event.id}`;
              return event.sourceUrl ? (
                <a key={uniqueKey} href={event.sourceUrl} target="_blank" rel="noopener noreferrer" className="calendar-event clickable">
                  {content}
                </a>
              ) : (
                <div key={uniqueKey} className="calendar-event">
                  {content}
                </div>
              );
            })}
          </>
        )}

        {recentPastEvents.length > 0 && (
          <>
            <div className="events-header">Past</div>
            {recentPastEvents.map(event => {
              const content = (
                <>
                  <span className="event-icon">{getEventIcon(event.eventType)}</span>
                  <div className="event-content">
                    <span className="event-label">
                      {showWatchlistInEvents && (
                        <button
                          className="event-symbol"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onSelectSymbol?.(event.symbol);
                          }}
                        >
                          {event.symbol}
                        </button>
                      )}
                      {event.title}
                    </span>
                    {event.description && (
                      <span className="event-description" title={event.description}>{event.description}</span>
                    )}
                  </div>
                  <span className="event-date past">
                    {formatDate(event.date)}
                  </span>
                </>
              );
              const uniqueKey = `${event.symbol}-${event.id}`;
              return event.sourceUrl ? (
                <a key={uniqueKey} href={event.sourceUrl} target="_blank" rel="noopener noreferrer" className="calendar-event past-event clickable">
                  {content}
                </a>
              ) : (
                <div key={uniqueKey} className="calendar-event past-event">
                  {content}
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Filter Modal */}
      <Dialog open={showFilterDropdown} onClose={() => setShowFilterDropdown(false)} title="Filter Events" size="large">
        <div className="filter-modal-actions">
          <button onClick={selectAllFilters} disabled={allSelected}>Select All</button>
          <button onClick={() => setSelectedFilters(new Set())} disabled={selectedFilters !== null && selectedFilters.size === 0}>Clear All</button>
        </div>
        <div className="filter-modal-chips">
          {availableFilters.map(filter => (
            <button
              key={filter.key}
              className={`filter-chip ${isFilterSelected(filter.key) ? 'active' : ''}`}
              onClick={() => toggleFilter(filter.key)}
            >
              <span className="filter-icon">{filter.icon}</span>
              <span className="filter-label">{filter.label}</span>
            </button>
          ))}
        </div>
      </Dialog>

      {/* Help Modal */}
      <Dialog open={showHelpModal} onClose={() => setShowHelpModal(false)} title="Understanding Catalysts" size="large">
        <HelpModalContent events={activeEvents} />
      </Dialog>
    </Expander>
  );
}

// Separate component to avoid recalculating on every render
function HelpModalContent({ events }: { events: CatalystEvent[] }) {
  const eventTypes = new Set(events.map(e => e.eventType));
  const relevantCategories = CATALYST_CATEGORIES
    .map(category => ({
      ...category,
      types: getCatalystsByCategory(category.id).filter(([type]) => eventTypes.has(type))
    }))
    .filter(category => category.types.length > 0);

  // Check if we have any FDA/clinical events to show timeline
  const hasBiotechEvents = eventTypes.has('clinical_trial') || eventTypes.has('clinical_readout') ||
    eventTypes.has('pdufa_date') || eventTypes.has('adcom') || eventTypes.has('fda_approval') ||
    eventTypes.has('fda_rejection') || eventTypes.has('nda_bla_submission') || eventTypes.has('fda_designation') ||
    eventTypes.has('clinical_milestone');

  return (
    <div className="help-modal-content">
      {/* Drug Development Timeline for biotech stocks */}
      {hasBiotechEvents && (
        <div className="help-category">
          <h4>Drug Development Timeline</h4>
          <p className="help-category-desc">The typical path from clinical trials to FDA approval. Each stage is a potential catalyst.</p>
          <div className="help-timeline">
            {DRUG_DEVELOPMENT_TIMELINE.map((step, index) => {
              const info = CATALYST_INFO[step.eventType];
              return (
                <div key={`${step.eventType}-${step.stage}`} className="timeline-step">
                  <div className="timeline-connector">
                    <div className="timeline-dot" />
                    {index < DRUG_DEVELOPMENT_TIMELINE.length - 1 && <div className="timeline-line" />}
                  </div>
                  <div className="timeline-content">
                    <div className="timeline-header">
                      <span className="timeline-icon">{info.icon}</span>
                      <span className="timeline-stage">{step.stage}</span>
                      {step.successRate && <span className="timeline-rate">{step.successRate}</span>}
                      {step.duration && <span className="timeline-duration">{step.duration}</span>}
                    </div>
                    <p className="timeline-desc">{step.description || info.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Regular categories (Financial, Corporate) */}
      {relevantCategories
        .filter(c => c.id !== 'fda' && c.id !== 'clinical')
        .map(category => (
        <div key={category.id} className="help-category">
          <h4>{category.name}</h4>
          <p className="help-category-desc">{category.description}</p>
          <div className="help-items">
            {category.types.map(([type, info]) => (
              <div key={type} className="help-item">
                <div className="help-item-header">
                  <span className="help-item-icon">{info.icon}</span>
                  <span className="help-item-label">{info.label}</span>
                </div>
                <p className="help-item-what">{info.description}</p>
                <p className="help-item-why">{info.whyItMatters}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
