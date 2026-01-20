import type { MarketData, StockData, HistoricalBar, NewsItem, CalendarEvents, AnalystData, InsiderTransaction, EarningsHistory, CatalystEvent } from './types.js';

export interface IFinanceProvider {
  readonly providerName: string;

  getStockData(symbol: string): Promise<StockData>;
  getMarketData(symbol: string): Promise<MarketData>;
  getHistoricalData(symbol: string, days?: number): Promise<HistoricalBar[]>;
  getNews(symbol: string, count?: number): Promise<NewsItem[]>;
  getCalendarEvents(symbol: string): Promise<CalendarEvents>;
  getAnalystData(symbol: string): Promise<AnalystData>;
  getInsiderTransactions(symbol: string): Promise<InsiderTransaction[]>;
  getEarningsHistory(symbol: string): Promise<EarningsHistory[]>;
  getCatalystEvents(symbol: string): Promise<CatalystEvent[]>;
}

export type FinanceProviderType = 'yahoo';

export class ProviderRateLimitError extends Error {
  constructor(
    public readonly provider: string,
    public readonly retryAfterMs?: number
  ) {
    super(`Rate limit exceeded for ${provider}`);
    this.name = 'ProviderRateLimitError';
  }
}

export class ProviderUnavailableError extends Error {
  constructor(
    public readonly provider: string,
    public readonly cause?: Error
  ) {
    super(`Provider ${provider} is unavailable`);
    this.name = 'ProviderUnavailableError';
  }
}
