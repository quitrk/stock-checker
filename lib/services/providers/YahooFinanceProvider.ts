import YahooFinance from 'yahoo-finance2';
import type { QuoteSummaryResult } from 'yahoo-finance2/modules/quoteSummary';
import type { Quote } from 'yahoo-finance2/modules/quote';
import type { IFinanceProvider } from './IFinanceProvider.js';
import { ProviderRateLimitError } from './IFinanceProvider.js';
import type { FundamentalData, MarketData, StockData, HistoricalBar, NewsItem, CalendarEvents, AnalystData, AnalystRating, ShortInterestData } from './types.js';

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

  private parseDate(value: any): Date | null {
    if (!value) return null;
    const date = new Date(value);
    const year = date.getFullYear();
    // Validate it's a reasonable date (between 2000 and 2100)
    if (isNaN(year) || year < 2000 || year > 2100) return null;
    return date;
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
      avgVolume10Day: data.summaryDetail?.averageDailyVolume10Day ?? 0,
      avgVolume90Day: data.summaryDetail?.averageVolume ?? 0,
      high52Week: data.summaryDetail?.fiftyTwoWeekHigh ?? 0,
      low52Week: data.summaryDetail?.fiftyTwoWeekLow ?? 0,
      companyName: data.price?.longName ?? data.price?.shortName ?? symbol,
      industry,
      marketCap: data.price?.marketCap ?? 0,
      website: data.assetProfile?.website ?? null,
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

    // Get R&D and revenue from fundamentalsTimeSeries (incomeStatementHistory is broken since Nov 2024)
    let researchDevelopment: number | null = null;
    let totalRevenue: number | null = null;
    try {
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 2);
      const timeSeries = await this.retry(() => this.yahooFinance.fundamentalsTimeSeries(symbol, {
        period1: startDate,
        type: 'annual',
        module: 'all',
      }));
      // Get most recent annual data
      if (Array.isArray(timeSeries) && timeSeries.length > 0) {
        const latest = timeSeries[timeSeries.length - 1] as Record<string, unknown>;
        researchDevelopment = (latest.researchAndDevelopment as number) ?? null;
        totalRevenue = (latest.totalRevenue as number) ?? (latest.operatingRevenue as number) ?? null;
      }
    } catch (e) {
      console.log(`[YahooFinance] Could not fetch fundamentalsTimeSeries for ${symbol}:`, e);
    }

    const fundamentalData: FundamentalData = {
      symbol,
      insiderOwnership,
      institutionalOwnership,
      totalCash,
      totalDebt,
      freeCashFlow,
      cashRunwayMonths,
      researchDevelopment,
      totalRevenue,
    };

    // Extract short interest data from defaultKeyStatistics (already fetched)
    let dateShortInterest: string | null = null;
    if (data.defaultKeyStatistics?.dateShortInterest) {
      const date = this.parseDate(data.defaultKeyStatistics.dateShortInterest);
      dateShortInterest = date?.toISOString().split('T')[0] || null;
    }

    const shortInterestData: ShortInterestData = {
      shortPercentOfFloat: data.defaultKeyStatistics?.shortPercentOfFloat ?? null,
      sharesShort: data.defaultKeyStatistics?.sharesShort ?? null,
      shortRatio: data.defaultKeyStatistics?.shortRatio ?? null,
      sharesShortPriorMonth: data.defaultKeyStatistics?.sharesShortPriorMonth ?? null,
      dateShortInterest,
    };

    console.log(`[YahooFinance] Data for ${symbol}:`, {
      price: marketData.price,
      change: `${marketData.priceChangePercent.toFixed(2)}%`,
      insiderOwnership: insiderOwnership ? `${(insiderOwnership * 100).toFixed(1)}%` : 'N/A',
      totalCash: totalCash ? `$${(totalCash / 1e6).toFixed(1)}M` : 'N/A',
      shortPercentOfFloat: shortInterestData.shortPercentOfFloat ? `${(shortInterestData.shortPercentOfFloat * 100).toFixed(1)}%` : 'N/A',
    });

    const result = { marketData, fundamentalData, shortInterestData };
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

      // Get R&D and revenue from fundamentalsTimeSeries
      let researchDevelopment: number | null = null;
      let totalRevenue: number | null = null;
      try {
        const startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 2);
        const timeSeries = await this.yahooFinance.fundamentalsTimeSeries(symbol, {
          period1: startDate,
          type: 'annual',
          module: 'all',
        });
        if (Array.isArray(timeSeries) && timeSeries.length > 0) {
          const latest = timeSeries[timeSeries.length - 1] as Record<string, unknown>;
          researchDevelopment = (latest.researchAndDevelopment as number) ?? null;
          totalRevenue = (latest.totalRevenue as number) ?? (latest.operatingRevenue as number) ?? null;
        }
      } catch (e) {
        console.log(`[YahooFinance] Could not fetch fundamentalsTimeSeries for ${symbol}`);
      }

      return {
        symbol,
        insiderOwnership,
        institutionalOwnership,
        totalCash,
        totalDebt,
        freeCashFlow,
        cashRunwayMonths,
        researchDevelopment,
        totalRevenue,
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
        researchDevelopment: null,
        totalRevenue: null,
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
      avgVolume10Day: quote.averageDailyVolume10Day ?? 0,
      avgVolume90Day: quote.averageDailyVolume3Month ?? 0,
      high52Week: quote.fiftyTwoWeekHigh ?? 0,
      low52Week: quote.fiftyTwoWeekLow ?? 0,
      companyName: quote.longName ?? quote.shortName ?? symbol,
      industry: quote.industry ?? 'Unknown',
      marketCap: quote.marketCap ?? 0,
      website: null,
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

  async getNews(symbol: string, count: number = 5): Promise<NewsItem[]> {
    console.log(`[YahooFinance] Fetching news for ${symbol}`);

    try {
      // Request more items since we'll filter by relatedTickers
      const result = await this.retry(() => this.yahooFinance.search(symbol, {
        newsCount: count * 4,
        quotesCount: 0,
      }));

      // Filter to only news items that have this ticker in relatedTickers
      const relevantNews = (result.news || []).filter((item: any) => {
        const relatedTickers = item.relatedTickers || [];
        return relatedTickers.includes(symbol) || relatedTickers.includes(symbol.toUpperCase());
      });

      const news: NewsItem[] = relevantNews.slice(0, count).map((item: any) => {
        const date = this.parseDate(item.providerPublishTime);
        return {
          title: item.title || '',
          publisher: item.publisher || 'Unknown',
          link: item.link || '',
          publishedAt: date?.toISOString() || new Date().toISOString(),
        };
      });

      console.log(`[YahooFinance] Got ${news.length} relevant news items for ${symbol} (filtered from ${result.news?.length || 0})`);
      return news;
    } catch (error) {
      console.error(`[YahooFinance] Error fetching news for ${symbol}:`, error);
      return [];
    }
  }

  async getCalendarEvents(symbol: string): Promise<CalendarEvents> {
    console.log(`[YahooFinance] Fetching calendar events for ${symbol}`);

    try {
      const data = await this.retry(() => this.yahooFinance.quoteSummary(symbol, {
        modules: ['calendarEvents'],
      }));

      const calendar = data.calendarEvents;
      const earnings = calendar?.earnings;

      return {
        earningsDate: earnings?.earningsDate?.[0]
          ? new Date(earnings.earningsDate[0]).toISOString().split('T')[0]
          : null,
        earningsDateEnd: earnings?.earningsDate?.[1]
          ? new Date(earnings.earningsDate[1]).toISOString().split('T')[0]
          : null,
        exDividendDate: calendar?.exDividendDate
          ? new Date(calendar.exDividendDate).toISOString().split('T')[0]
          : null,
        dividendDate: calendar?.dividendDate
          ? new Date(calendar.dividendDate).toISOString().split('T')[0]
          : null,
      };
    } catch (error) {
      console.error(`[YahooFinance] Error fetching calendar events for ${symbol}:`, error);
      return {
        earningsDate: null,
        earningsDateEnd: null,
        exDividendDate: null,
        dividendDate: null,
      };
    }
  }

  async getAnalystData(symbol: string): Promise<AnalystData> {
    console.log(`[YahooFinance] Fetching analyst data for ${symbol}`);

    try {
      const data = await this.retry(() => this.yahooFinance.quoteSummary(symbol, {
        modules: ['financialData', 'upgradeDowngradeHistory'],
      }));

      const financial = data.financialData;
      const upgradeHistory = data.upgradeDowngradeHistory?.history || [];

      // Get recent ratings (last 90 days)
      const ninetyDaysAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);

      const recentRatings: AnalystRating[] = upgradeHistory
        .filter((item: any) => {
          const date = this.parseDate(item.epochGradeDate);
          return date && date.getTime() > ninetyDaysAgo;
        })
        .slice(0, 10)
        .map((item: any) => {
          const date = this.parseDate(item.epochGradeDate);
          return {
            firm: item.firm || 'Unknown',
            toGrade: item.toGrade || 'Unknown',
            fromGrade: item.fromGrade || null,
            action: item.action || 'Unknown',
            date: date?.toISOString().split('T')[0] || '',
          };
        });

      return {
        targetPrice: financial?.targetMedianPrice ?? null,
        targetPriceLow: financial?.targetLowPrice ?? null,
        targetPriceHigh: financial?.targetHighPrice ?? null,
        targetPriceMean: financial?.targetMeanPrice ?? null,
        numberOfAnalysts: financial?.numberOfAnalystOpinions ?? null,
        recommendationKey: financial?.recommendationKey ?? null,
        recommendationMean: financial?.recommendationMean ?? null,
        recentRatings,
      };
    } catch (error) {
      console.error(`[YahooFinance] Error fetching analyst data for ${symbol}:`, error);
      return {
        targetPrice: null,
        targetPriceLow: null,
        targetPriceHigh: null,
        targetPriceMean: null,
        numberOfAnalysts: null,
        recommendationKey: null,
        recommendationMean: null,
        recentRatings: [],
      };
    }
  }
}
