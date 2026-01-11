import type { FundamentalData, MarketData, StockData, HistoricalBar } from './types.js';

export interface IFinanceProvider {
  readonly providerName: string;

  getStockData(symbol: string): Promise<StockData>;
  getMarketData(symbol: string): Promise<MarketData>;
  getFundamentalData(symbol: string): Promise<FundamentalData>;
  getHistoricalData(symbol: string, days?: number): Promise<HistoricalBar[]>;
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
