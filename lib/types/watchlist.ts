export interface WatchlistItem {
  symbol: string;
  addedAt?: string; // ISO date string (e.g., "2024-01-15") for historical comparison
  historicalPrice?: number; // Price at addedAt date (cached when addedAt is set)
}

export interface Watchlist {
  id: string;
  userId: string;
  name: string;
  items: WatchlistItem[];
  createdAt: string;
  updatedAt: string;
  isSystem?: boolean;
}

export interface WatchlistSummary {
  id: string;
  name: string;
  items: WatchlistItem[];
  updatedAt: string;
  isSystem?: boolean;
}

export interface WatchlistStock {
  symbol: string;
  companyName: string;
  price: number;
  priceChange: number;
  priceChangePercent: number;
  logoUrl: string | null;
  weight?: number; // ETF holding weight (0-1), only for system watchlists
  historicalPrice?: number | null; // Price at comparison date
  historicalChangePercent?: number | null; // % change since comparison date
  addedAt?: string; // ISO date string - if set, frontend shows historical change
}

export interface WatchlistWithStocks extends Watchlist {
  stocks: WatchlistStock[];
}
