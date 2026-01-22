export interface Watchlist {
  id: string;
  userId: string;
  name: string;
  symbols: string[];
  createdAt: string;
  updatedAt: string;
  isSystem?: boolean;
}

export interface WatchlistSummary {
  id: string;
  name: string;
  symbols: string[];
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
}

export interface WatchlistWithStocks extends Watchlist {
  stocks: WatchlistStock[];
}
