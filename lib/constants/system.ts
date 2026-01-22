// System user ID for default watchlists
export const SYSTEM_USER_ID = 'system';

// Deterministic IDs for system watchlists (prevents duplicates on repeated cron runs)
export const SYSTEM_WATCHLIST_IDS = {
  XBI: 'system-watchlist-xbi',
  IBB: 'system-watchlist-ibb',
} as const;

// Default ETF watchlist configurations
export const DEFAULT_ETF_WATCHLISTS = [
  { etfSymbol: 'XBI', name: 'XBI (S&P Biotech)', id: SYSTEM_WATCHLIST_IDS.XBI },
  { etfSymbol: 'IBB', name: 'IBB (Nasdaq Biotech)', id: SYSTEM_WATCHLIST_IDS.IBB },
] as const;
