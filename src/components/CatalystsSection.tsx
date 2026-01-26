import { useState, useEffect } from 'react';
import type { CatalystEvent, CatalystEventType } from '../../lib/types/index.js';
import { useApp } from '../contexts/AppContext';
import { getWatchlistCatalysts } from '../api/watchlistApi';
import { Expander } from './Expander';
import './CatalystsSection.css';

interface CatalystsSectionProps {
  catalystEvents?: CatalystEvent[];
  currentSymbol?: string;
  onSelectSymbol?: (symbol: string) => void;
  defaultExpanded?: boolean;
  /** When provided, fetches catalysts for this watchlist and hides the selector */
  watchlistId?: string;
}

const EVENT_ICONS: Record<CatalystEventType, string> = {
  earnings: '📊',
  earnings_call: '📞',
  ex_dividend: '💰',
  dividend_payment: '💵',
  stock_split: '➗',
  reverse_split: '⚠️',
  analyst_rating: '📈',
  clinical_trial: '🧬',
  fda_approval: '💊',
  pdufa_date: '🗓️',
  sec_filing: '📄',
  insider_transaction: '👤',
  executive_change: '👔',
  acquisition: '🤝',
  partnership: '🤝',
};

const EVENT_LABELS: Record<CatalystEventType, string> = {
  earnings: 'Earnings',
  earnings_call: 'Earnings Call',
  ex_dividend: 'Ex-Dividend',
  dividend_payment: 'Dividend Payment',
  stock_split: 'Stock Split',
  reverse_split: 'Reverse Split',
  analyst_rating: 'Analyst Rating',
  clinical_trial: 'Clinical Trial',
  fda_approval: 'FDA Approval',
  pdufa_date: 'PDUFA Date',
  sec_filing: 'SEC Filing',
  insider_transaction: 'Insider Trade',
  executive_change: 'Executive Change',
  acquisition: 'Acquisition',
  partnership: 'Partnership',
};

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

  const userWatchlists = watchlist.watchlists;
  const defaultWatchlists = watchlist.defaultWatchlists;
  const firstAvailableWatchlist = defaultWatchlists[0] || userWatchlists[0];

  // When watchlistId is provided, we're in direct watchlist mode
  const isDirectWatchlistMode = !!watchlistId;

  // Initialize or reset selected source when symbol changes
  useEffect(() => {
    if (isDirectWatchlistMode) {
      // Don't use selector in direct watchlist mode
      return;
    }
    if (currentSymbol) {
      setSelectedSource('symbol');
      setWatchlistEvents([]);
    } else {
      // No symbol - reset to first available watchlist
      setSelectedSource(firstAvailableWatchlist?.id || null);
    }
  }, [currentSymbol, firstAvailableWatchlist?.id, isDirectWatchlistMode]);

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

  // Filter to only future events within 1 year and sort by date
  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

  const futureEvents = activeEvents
    .filter(event => {
      const eventDate = new Date(event.date);
      return isFutureDate(event.date) && eventDate <= oneYearFromNow;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // Also show recent past events (last 60 days) for context
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const recentPastEvents = activeEvents
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
    ? `${EVENT_LABELS[futureEvents[0].eventType]} ${formatDate(futureEvents[0].date)}`
    : recentPastEvents.length > 0
      ? `${recentPastEvents.length} past event${recentPastEvents.length > 1 ? 's' : ''}`
      : undefined;

  const showWatchlistInEvents = isDirectWatchlistMode || selectedSource !== 'symbol';

  return (
    <Expander title="Catalysts" summary={summary} defaultExpanded={defaultExpanded} ignoreMobileCollapse={!currentSymbol || isDirectWatchlistMode} className="calendar-section">
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

      {loading && <div className="catalyst-loading">Loading catalysts...</div>}

      <div className="calendar-events">
        {futureEvents.length > 0 && (
          <>
            <div className="events-header">Upcoming</div>
            {futureEvents.map(event => {
              const content = (
                <>
                  <span className="event-icon">{EVENT_ICONS[event.eventType]}</span>
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
                  <span className="event-icon">{EVENT_ICONS[event.eventType]}</span>
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
    </Expander>
  );
}
