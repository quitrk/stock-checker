export interface Watchlist {
  id: string;
  userId: string;
  name: string;
  symbols: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WatchlistSummary {
  id: string;
  name: string;
  symbols: string[];
  updatedAt: string;
}

export interface WatchlistStock {
  symbol: string;
  companyName: string;
  price: number;
  priceChange: number;
  priceChangePercent: number;
}

export interface WatchlistWithStocks extends Watchlist {
  stocks: WatchlistStock[];
}
