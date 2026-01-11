import YahooFinance from 'yahoo-finance2';
import type { QuoteSummaryResult } from 'yahoo-finance2/modules/quoteSummary';
import type { Quote } from 'yahoo-finance2/modules/quote';
import type { IFinanceProvider } from './IFinanceProvider.js';
import { ProviderRateLimitError } from './IFinanceProvider.js';
import type { FundamentalData, MarketData, StockData, HistoricalBar } from './types.js';

export class YahooFinanceProvider implements IFinanceProvider {
  readonly providerName = 'yahoo';

  private yahooFinance: InstanceType<typeof YahooFinance>;
  private cache: Map<string, { data: StockData; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 15 * 60 * 1000;
  private lastRequestTime = 0;
  private readonly MIN_REQUEST_INTERVAL = 500;

  constructor() {
    // Initialize yahoo-finance2 v3 with suppressed notices
    this.yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.MIN_REQUEST_INTERVAL) {
      await new Promise(r => setTimeout(r, this.MIN_REQUEST_INTERVAL - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  private async retry<T>(fn: () => Promise<T>, retries = 5, delay = 2000): Promise<T> {
    for (let i = 0; i < retries; i++) {
      try {
        await this.throttle();
        return await fn();
      } catch (error: any) {
        const errorMsg = error?.message || '';
        const isRateLimit = errorMsg.includes('429') ||
                           errorMsg.includes('Too Many') ||
                           errorMsg.includes('rate limit') ||
                           errorMsg.includes('blocked');

        if (i === retries - 1) {
          console.error(`[YahooFinance] All retries exhausted. Final error:`, errorMsg);
          if (isRateLimit) {
            throw new ProviderRateLimitError('yahoo', delay);
          }
          throw error;
        }
        if (!isRateLimit) throw error;

        console.log(`[YahooFinance] Rate limited, retrying in ${delay}ms... (attempt ${i + 2}/${retries})`);
        await new Promise(r => setTimeout(r, delay));
        delay *= 2;
      }
    }
    throw new Error('Retry failed');
  }

  async getStockData(symbol: string): Promise<StockData> {
    const cached = this.cache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      console.log(`[YahooFinance] Using cached data for ${symbol}`);
      return cached.data;
    }

    console.log(`[YahooFinance] Fetching all data for ${symbol} in single call...`);

    const data: QuoteSummaryResult = await this.retry(() => this.yahooFinance.quoteSummary(symbol, {
      modules: [
        'price',
        'summaryDetail',
        'quoteType',
        'defaultKeyStatistics',
        'financialData',
        'majorHoldersBreakdown',
        'assetProfile',
      ],
    }));

    const rawIndustry = data.assetProfile?.industry ?? data.summaryDetail?.industry ?? data.quoteType?.industry;
    const industry = typeof rawIndustry === 'string' ? rawIndustry : 'Unknown';

    const marketData: MarketData = {
      symbol,
      price: data.price?.regularMarketPrice ?? 0,
      priceChange: data.price?.regularMarketChange ?? 0,
      priceChangePercent: data.price?.regularMarketChangePercent ? data.price.regularMarketChangePercent * 100 : 0,
      volume: data.price?.regularMarketVolume ?? 0,
      avgVolume: data.summaryDetail?.averageDailyVolume10Day ?? data.summaryDetail?.averageVolume ?? 0,
      high52Week: data.summaryDetail?.fiftyTwoWeekHigh ?? 0,
      low52Week: data.summaryDetail?.fiftyTwoWeekLow ?? 0,
      companyName: data.price?.longName ?? data.price?.shortName ?? symbol,
      industry,
      marketCap: data.price?.marketCap ?? 0,
    };

    const insiderOwnership = data.defaultKeyStatistics?.heldPercentInsiders ??
                             data.majorHoldersBreakdown?.insidersPercentHeld ?? null;
    const institutionalOwnership = data.defaultKeyStatistics?.heldPercentInstitutions ??
                                   data.majorHoldersBreakdown?.institutionsPercentHeld ?? null;
    const totalCash = data.financialData?.totalCash ?? null;
    const totalDebt = data.financialData?.totalDebt ?? null;
    const freeCashFlow = data.financialData?.freeCashflow ?? null;

    let cashRunwayMonths: number | null = null;
    if (totalCash && freeCashFlow && freeCashFlow < 0) {
      const monthlyBurn = Math.abs(freeCashFlow) / 12;
      cashRunwayMonths = totalCash / monthlyBurn;
    }

    const fundamentalData: FundamentalData = {
      symbol,
      insiderOwnership,
      institutionalOwnership,
      totalCash,
      totalDebt,
      freeCashFlow,
      cashRunwayMonths,
    };

    console.log(`[YahooFinance] Data for ${symbol}:`, {
      price: marketData.price,
      change: `${marketData.priceChangePercent.toFixed(2)}%`,
      insiderOwnership: insiderOwnership ? `${(insiderOwnership * 100).toFixed(1)}%` : 'N/A',
      totalCash: totalCash ? `$${(totalCash / 1e6).toFixed(1)}M` : 'N/A',
    });

    const result = { marketData, fundamentalData };
    this.cache.set(symbol, { data: result, timestamp: Date.now() });

    return result;
  }

  async getFundamentalData(symbol: string): Promise<FundamentalData> {
    console.log(`[YahooFinance] Fetching fundamental data for ${symbol}`);

    try {
      const data = await this.yahooFinance.quoteSummary(symbol, {
        modules: ['defaultKeyStatistics', 'financialData', 'majorHoldersBreakdown'],
      });

      const insiderOwnership = data.defaultKeyStatistics?.heldPercentInsiders ??
                               data.majorHoldersBreakdown?.insidersPercentHeld ?? null;
      const institutionalOwnership = data.defaultKeyStatistics?.heldPercentInstitutions ??
                                     data.majorHoldersBreakdown?.institutionsPercentHeld ?? null;
      const totalCash = data.financialData?.totalCash ?? null;
      const totalDebt = data.financialData?.totalDebt ?? null;
      const freeCashFlow = data.financialData?.freeCashflow ?? null;

      let cashRunwayMonths: number | null = null;
      if (totalCash && freeCashFlow && freeCashFlow < 0) {
        const monthlyBurn = Math.abs(freeCashFlow) / 12;
        cashRunwayMonths = totalCash / monthlyBurn;
      }

      return {
        symbol,
        insiderOwnership,
        institutionalOwnership,
        totalCash,
        totalDebt,
        freeCashFlow,
        cashRunwayMonths,
      };
    } catch (error) {
      console.error(`[YahooFinance] Error fetching data for ${symbol}:`, error);
      return {
        symbol,
        insiderOwnership: null,
        institutionalOwnership: null,
        totalCash: null,
        totalDebt: null,
        freeCashFlow: null,
        cashRunwayMonths: null,
      };
    }
  }

  async getMarketData(symbol: string): Promise<MarketData> {
    console.log(`[YahooFinance] Fetching market data for ${symbol}`);

    const quote: Quote = await this.retry(() => this.yahooFinance.quote(symbol));

    return {
      symbol,
      price: quote.regularMarketPrice ?? 0,
      priceChange: quote.regularMarketChange ?? 0,
      priceChangePercent: quote.regularMarketChangePercent ?? 0,
      volume: quote.regularMarketVolume ?? 0,
      avgVolume: quote.averageDailyVolume10Day ?? quote.averageDailyVolume3Month ?? 0,
      high52Week: quote.fiftyTwoWeekHigh ?? 0,
      low52Week: quote.fiftyTwoWeekLow ?? 0,
      companyName: quote.longName ?? quote.shortName ?? symbol,
      industry: quote.industry ?? 'Unknown',
      marketCap: quote.marketCap ?? 0,
    };
  }

  async getHistoricalData(symbol: string, days: number = 60): Promise<HistoricalBar[]> {
    console.log(`[YahooFinance] Fetching ${days} days of historical data for ${symbol}`);

    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const result = await this.retry(() => this.yahooFinance.chart(symbol, {
        period1: startDate,
        period2: endDate,
        interval: '1d',
      }));

      const bars: HistoricalBar[] = [];
      const quotes = result.quotes;

      for (const quote of quotes) {
        if (quote.date && quote.close !== null) {
          bars.push({
            date: quote.date.toISOString().split('T')[0],
            open: quote.open ?? quote.close,
            high: quote.high ?? quote.close,
            low: quote.low ?? quote.close,
            close: quote.close,
            volume: quote.volume ?? 0,
          });
        }
      }

      console.log(`[YahooFinance] Got ${bars.length} historical bars for ${symbol}`);
      return bars;
    } catch (error) {
      console.error(`[YahooFinance] Error fetching historical data for ${symbol}:`, error);
      return [];
    }
  }
}
