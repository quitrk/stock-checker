import YahooFinance from 'yahoo-finance2';
import type { QuoteSummaryResult } from 'yahoo-finance2/modules/quoteSummary';
import type { Quote } from 'yahoo-finance2/modules/quote';
import type { IFinanceProvider } from './IFinanceProvider.js';
import { ProviderRateLimitError } from './IFinanceProvider.js';
import type { FundamentalData, MarketData, StockData, HistoricalBar, NewsItem, CalendarEvents, AnalystData, AnalystRating, ShortInterestData, InsiderTransaction, EarningsHistory, CatalystEvent, CachedHistoricalData } from './types.js';
import type { SearchResult, SearchResultType } from '../../types/index.js';
import { getCached, setCache, cacheKey } from '../CacheService.js';

// News publishers to filter out (low quality/spammy)
const NEWS_PUBLISHER_BLACKLIST = [
  'zacks',
];

export class YahooFinanceProvider implements IFinanceProvider {
  readonly providerName = 'yahoo';

  private yahooFinance: InstanceType<typeof YahooFinance>;
  private cache: Map<string, { data: StockData; timestamp: number }> = new Map();
  private quoteSummaryCache: Map<string, { data: QuoteSummaryResult; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 15 * 60 * 1000;
  private lastRequestTime = 0;
  private readonly MIN_REQUEST_INTERVAL = 500;

  // All modules we need - fetched in a single call
  private readonly ALL_MODULES = [
    'price',
    'summaryDetail',
    'quoteType',
    'defaultKeyStatistics',
    'financialData',
    'majorHoldersBreakdown',
    'assetProfile',
    'calendarEvents',
    'upgradeDowngradeHistory',
    'insiderTransactions',
    'earningsHistory',
    'earningsTrend',
  ] as const;

  constructor() {
    // Initialize yahoo-finance2 v3 with suppressed notices
    this.yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
  }

  /**
   * Fetches all quoteSummary modules in a single API call and caches the result.
   * All other methods should use this to avoid duplicate external calls.
   * If fetching all modules fails due to module errors, it will test each module and retry with only working ones.
   */
  private async getQuoteSummary(symbol: string): Promise<QuoteSummaryResult> {
    const cached = this.quoteSummaryCache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    // First attempt - try all modules without retry wrapper to detect module errors quickly
    try {
      await this.throttle();
      const data = await this.yahooFinance.quoteSummary(symbol, {
        modules: [...this.ALL_MODULES],
      });
      this.quoteSummaryCache.set(symbol, { data, timestamp: Date.now() });
      return data;
    } catch (error: any) {
      const errorMsg = error?.message || '';
      const isModuleError = errorMsg.includes('internal-error') ||
                           errorMsg.includes('No fundamentals data') ||
                           errorMsg.includes('not found');

      if (!isModuleError) {
        // Not a module error - use normal retry logic
        const data = await this.retry(() => this.yahooFinance.quoteSummary(symbol, {
          modules: [...this.ALL_MODULES],
        }));
        this.quoteSummaryCache.set(symbol, { data, timestamp: Date.now() });
        return data;
      }

      // Module error - find which ones work
      console.log(`[YahooFinance] Module error for ${symbol}, testing individual modules...`);
      const workingModules: typeof this.ALL_MODULES[number][] = [];

      for (const mod of this.ALL_MODULES) {
        try {
        //   await this.throttle();
          await this.yahooFinance.quoteSummary(symbol, { modules: [mod] });
          workingModules.push(mod);
        } catch {
          console.log(`[YahooFinance] Module '${mod}' unavailable for ${symbol}`);
        }
      }

      if (workingModules.length === 0) {
        throw new Error(`No quoteSummary modules available for ${symbol}`);
      }

      console.log(`[YahooFinance] Fetching ${symbol} with ${workingModules.length} available modules`);
      const data = await this.yahooFinance.quoteSummary(symbol, {
        modules: workingModules,
      });

      this.quoteSummaryCache.set(symbol, { data, timestamp: Date.now() });
      return data;
    }
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
        const isServerError = errorMsg.includes('500') ||
                              errorMsg.includes('502') ||
                              errorMsg.includes('503') ||
                              errorMsg.includes('HTTPError');
        const isRetryable = isRateLimit || isServerError;

        // Extract a clean error message (avoid logging full HTML responses)
        let cleanErrorMsg = errorMsg;
        if (errorMsg.includes('<!doctype') || errorMsg.includes('<html')) {
          const statusMatch = errorMsg.match(/\b(4\d{2}|5\d{2})\b/);
          cleanErrorMsg = statusMatch ? `HTTP ${statusMatch[1]} error` : 'HTTP error (HTML response)';
        } else if (errorMsg.length > 200) {
          cleanErrorMsg = errorMsg.substring(0, 200) + '...';
        }

        if (i === retries - 1) {
          console.error(`[YahooFinance] All retries exhausted. Final error:`, cleanErrorMsg);
          if (isRateLimit) {
            throw new ProviderRateLimitError('yahoo', delay);
          }
          throw error;
        }
        if (!isRetryable) throw error;

        const reason = isRateLimit ? 'Rate limited' : 'Server error';
        console.log(`[YahooFinance] ${reason}, retrying in ${delay}ms... (attempt ${i + 2}/${retries})`);
        await new Promise(r => setTimeout(r, delay));
        delay *= 2;
      }
    }
    throw new Error('Retry failed');
  }

  async getStockData(symbol: string): Promise<StockData> {
    const cached = this.cache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      console.log(`[YahooFinance] Using cached StockData for ${symbol}`);
      return cached.data;
    }

    // Use shared quoteSummary cache - one external call for all data
    const data = await this.getQuoteSummary(symbol);

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
      sharesShortPriorMonth: (data.defaultKeyStatistics?.sharesShortPriorMonth as number | undefined) ?? null,
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

  async getMultipleQuotes(symbols: string[]): Promise<Map<string, MarketData>> {
    if (symbols.length === 0) return new Map();

    console.log(`[YahooFinance] Fetching batch quotes for ${symbols.length} symbols`);

    const quotes = await this.retry(() => this.yahooFinance.quote(symbols));
    const results = new Map<string, MarketData>();

    const quotesArray = Array.isArray(quotes) ? quotes : [quotes];

    for (const quote of quotesArray) {
      if (!quote.symbol) continue;
      // Type assertion needed because yahoo-finance2 Quote type doesn't expose industry,
      // but the API does return it
      const q = quote as typeof quote & { industry?: string };
      results.set(quote.symbol, {
        symbol: quote.symbol,
        price: quote.regularMarketPrice ?? 0,
        priceChange: quote.regularMarketChange ?? 0,
        priceChangePercent: quote.regularMarketChangePercent ?? 0,
        volume: quote.regularMarketVolume ?? 0,
        avgVolume10Day: quote.averageDailyVolume10Day ?? 0,
        avgVolume90Day: quote.averageDailyVolume3Month ?? 0,
        high52Week: quote.fiftyTwoWeekHigh ?? 0,
        low52Week: quote.fiftyTwoWeekLow ?? 0,
        companyName: quote.longName ?? quote.shortName ?? quote.symbol,
        industry: q.industry ?? 'Unknown',
        marketCap: quote.marketCap ?? 0,
        website: null,
      });
    }

    console.log(`[YahooFinance] Got ${results.size} quotes`);
    return results;
  }

  private getYesterday(): string {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }

  private getToday(): string {
    return new Date().toISOString().split('T')[0];
  }

  private getMissingRanges(
    requestedStartStr: string,
    cached: CachedHistoricalData | null
  ): {
    fetchBefore: { start: string; end: string } | null;
    fetchAfter: { start: string; end: string } | null;
  } {
    const yesterday = this.getYesterday();

    if (!cached || cached.bars.length === 0) {
      return {
        fetchBefore: null,
        fetchAfter: { start: requestedStartStr, end: yesterday },
      };
    }

    let fetchBefore: { start: string; end: string } | null = null;
    let fetchAfter: { start: string; end: string } | null = null;

    // Need older data? Use fetchedFromDate to avoid re-fetching non-trading days
    const cachedFromDate = cached.fetchedFromDate ?? cached.earliestDate;
    if (requestedStartStr < cachedFromDate) {
      fetchBefore = { start: requestedStartStr, end: cachedFromDate };
    }

    // Need newer data?
    if (cached.latestDate < yesterday) {
      fetchAfter = { start: cached.latestDate, end: yesterday };
    }

    return { fetchBefore, fetchAfter };
  }

  private mergeBars(existing: HistoricalBar[], newBars: HistoricalBar[]): HistoricalBar[] {
    const byDate = new Map<string, HistoricalBar>();

    for (const bar of existing) {
      byDate.set(bar.date, bar);
    }

    for (const bar of newBars) {
      byDate.set(bar.date, bar);
    }

    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  private roundBar(bar: HistoricalBar): HistoricalBar {
    return {
      date: bar.date,
      open: Math.round(bar.open * 1000) / 1000,
      high: Math.round(bar.high * 1000) / 1000,
      low: Math.round(bar.low * 1000) / 1000,
      close: Math.round(bar.close * 1000) / 1000,
      volume: bar.volume,
    };
  }

  private async fetchHistoricalRange(
    symbol: string,
    startDateStr: string,
    endDateStr: string
  ): Promise<HistoricalBar[]> {
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    // Add a day to endDate since Yahoo's period2 is exclusive
    endDate.setDate(endDate.getDate() + 1);

    const result = await this.retry(() =>
      this.yahooFinance.chart(symbol, {
        period1: startDate,
        period2: endDate,
        interval: '1d',
      })
    );

    const today = this.getToday();
    const bars: HistoricalBar[] = [];

    for (const quote of result.quotes) {
      if (quote.date && quote.close !== null) {
        const dateStr = quote.date.toISOString().split('T')[0];
        // Exclude today's incomplete bar
        if (dateStr === today) continue;
        bars.push({
          date: dateStr,
          open: quote.open ?? quote.close,
          high: quote.high ?? quote.close,
          low: quote.low ?? quote.close,
          close: quote.close,
          volume: quote.volume ?? 0,
        });
      }
    }

    return bars;
  }

  async getHistoricalData(symbol: string, days: number = 60): Promise<HistoricalBar[]> {
    const upperSymbol = symbol.toUpperCase();

    try {
      // Calculate requested start date
      const requestedStart = new Date();
      requestedStart.setDate(requestedStart.getDate() - days);
      const requestedStartStr = requestedStart.toISOString().split('T')[0];

      // Check cache
      const cacheKeyStr = cacheKey('historical', upperSymbol);
      const cached = await getCached<CachedHistoricalData>(cacheKeyStr);

      // Determine what ranges we need to fetch
      const { fetchBefore, fetchAfter } = this.getMissingRanges(requestedStartStr, cached);

      // If cache fully covers the request, return filtered bars
      if (!fetchBefore && !fetchAfter && cached) {
        const filteredBars = cached.bars.filter(b => b.date >= requestedStartStr);
        console.log(`[YahooFinance] Cache hit for ${upperSymbol}: ${filteredBars.length} bars`);
        return filteredBars;
      }

      // Fetch missing ranges
      const allNewBars: HistoricalBar[] = [];

      if (fetchBefore) {
        console.log(`[YahooFinance] Fetching older data for ${upperSymbol}: ${fetchBefore.start} to ${fetchBefore.end}`);
        const olderBars = await this.fetchHistoricalRange(upperSymbol, fetchBefore.start, fetchBefore.end);
        allNewBars.push(...olderBars);
      }

      if (fetchAfter) {
        console.log(`[YahooFinance] Fetching newer data for ${upperSymbol}: ${fetchAfter.start} to ${fetchAfter.end}`);
        const newerBars = await this.fetchHistoricalRange(upperSymbol, fetchAfter.start, fetchAfter.end);
        allNewBars.push(...newerBars);
      }

      // Merge with existing cache and round prices for storage efficiency
      const existingBars = cached?.bars ?? [];
      const mergedBars = this.mergeBars(existingBars, allNewBars).map(b => this.roundBar(b));

      // Update cache (TTL=0 means no expiration)
      if (mergedBars.length > 0) {
        // Track the earliest date we've ever requested (even if no bar exists for weekends/holidays)
        const existingFetchedFrom = cached?.fetchedFromDate ?? cached?.earliestDate;
        const fetchedFromDate = existingFetchedFrom && existingFetchedFrom < requestedStartStr
          ? existingFetchedFrom
          : requestedStartStr;

        const newCacheData: CachedHistoricalData = {
          symbol: upperSymbol,
          bars: mergedBars,
          earliestDate: mergedBars[0].date,
          latestDate: mergedBars[mergedBars.length - 1].date,
          fetchedFromDate,
        };
        await setCache(cacheKeyStr, newCacheData, 0);
        console.log(`[YahooFinance] Updated cache for ${upperSymbol}: ${mergedBars.length} total bars (${allNewBars.length} new)`);
      }

      // Return only the requested range
      const result = mergedBars.filter(b => b.date >= requestedStartStr);
      console.log(`[YahooFinance] Returning ${result.length} bars for ${upperSymbol}`);
      return result;

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
      // Also exclude blacklisted publishers
      const relevantNews = (result.news || []).filter((item: any) => {
        const relatedTickers = item.relatedTickers || [];
        const isRelevant = relatedTickers.includes(symbol) || relatedTickers.includes(symbol.toUpperCase());
        const publisher = (item.publisher || '').toLowerCase();
        const isBlacklisted = NEWS_PUBLISHER_BLACKLIST.some(b => publisher.includes(b));
        return isRelevant && !isBlacklisted;
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
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      // Extract useful info from HTML error responses
      let cleanMsg = errorMsg;
      if (errorMsg.includes('<!doctype') || errorMsg.includes('<html')) {
        const statusMatch = errorMsg.match(/\b(4\d{2}|5\d{2})\b/);
        cleanMsg = statusMatch ? `HTTP ${statusMatch[1]} error` : 'HTTP error (HTML response)';
      }
      console.error(`[YahooFinance] Error fetching news for ${symbol}:`, cleanMsg);
      return [];
    }
  }

  async getCalendarEvents(symbol: string): Promise<CalendarEvents> {
    console.log(`[YahooFinance] Getting calendar events for ${symbol}`);

    try {
      // Use shared quoteSummary cache - no extra external call
      const data = await this.getQuoteSummary(symbol);

      const calendar = data.calendarEvents;
      const earnings = calendar?.earnings;
      const earningsTrend = data.earningsTrend?.trend?.[0]; // Current quarter

      return {
        earningsDate: earnings?.earningsDate?.[0]
          ? new Date(earnings.earningsDate[0]).toISOString().split('T')[0]
          : null,
        earningsDateEnd: earnings?.earningsDate?.[1]
          ? new Date(earnings.earningsDate[1]).toISOString().split('T')[0]
          : null,
        earningsCallDate: earnings?.earningsCallDate?.[0]
          ? new Date(earnings.earningsCallDate[0]).toISOString().split('T')[0]
          : null,
        isEarningsDateEstimate: earnings?.isEarningsDateEstimate ?? true,
        earningsEstimate: earningsTrend?.earningsEstimate?.avg ?? earnings?.earningsAverage ?? null,
        revenueEstimate: earningsTrend?.revenueEstimate?.avg ?? earnings?.revenueAverage ?? null,
        exDividendDate: calendar?.exDividendDate
          ? new Date(calendar.exDividendDate).toISOString().split('T')[0]
          : null,
        dividendDate: calendar?.dividendDate
          ? new Date(calendar.dividendDate).toISOString().split('T')[0]
          : null,
      };
    } catch (error) {
      console.error(`[YahooFinance] Error getting calendar events for ${symbol}:`, error);
      return {
        earningsDate: null,
        earningsDateEnd: null,
        earningsCallDate: null,
        isEarningsDateEstimate: true,
        earningsEstimate: null,
        revenueEstimate: null,
        exDividendDate: null,
        dividendDate: null,
      };
    }
  }

  async getAnalystData(symbol: string): Promise<AnalystData> {
    console.log(`[YahooFinance] Getting analyst data for ${symbol}`);

    try {
      // Use shared quoteSummary cache - no extra external call
      const data = await this.getQuoteSummary(symbol);

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

  async getInsiderTransactions(symbol: string): Promise<InsiderTransaction[]> {
    console.log(`[YahooFinance] Getting insider transactions for ${symbol}`);

    try {
      // Use shared quoteSummary cache - no extra external call
      const data = await this.getQuoteSummary(symbol);
      const transactions = data.insiderTransactions?.transactions || [];

      return transactions.slice(0, 20).map((t: any) => ({
        name: t.filerName || 'Unknown',
        relation: t.filerRelation || 'Unknown',
        transactionDate: t.startDate ? new Date(t.startDate).toISOString().split('T')[0] : '',
        transactionType: t.transactionText || 'Unknown',
        shares: t.shares || 0,
        value: t.value ?? null,
      }));
    } catch (error) {
      console.error(`[YahooFinance] Error getting insider transactions for ${symbol}:`, error);
      return [];
    }
  }

  async getEarningsHistory(symbol: string): Promise<EarningsHistory[]> {
    console.log(`[YahooFinance] Getting earnings history for ${symbol}`);

    try {
      // Use shared quoteSummary cache - no extra external call
      const data = await this.getQuoteSummary(symbol);
      const history = data.earningsHistory?.history || [];

      return history.map((h: any) => ({
        date: h.quarter ? new Date(h.quarter).toISOString().split('T')[0] : '',
        epsActual: h.epsActual ?? null,
        epsEstimate: h.epsEstimate ?? null,
        surprisePercent: h.surprisePercent ?? null,
        priceMovement: null as number | null,
      })).filter((e: EarningsHistory) => e.date);
    } catch (error) {
      console.error(`[YahooFinance] Error getting earnings history for ${symbol}:`, error);
      return [];
    }
  }

  async getCatalystEvents(symbol: string): Promise<CatalystEvent[]> {
    const events: CatalystEvent[] = [];

    try {
      // Use shared quoteSummary cache - no extra external call
      const data = await this.getQuoteSummary(symbol);

      // Earnings events
      const calendar = data.calendarEvents;
      const earnings = calendar?.earnings;
      if (earnings?.earningsDate?.[0]) {
        const earningsDate = new Date(earnings.earningsDate[0]).toISOString().split('T')[0];
        const earningsDateEnd = earnings.earningsDate[1]
          ? new Date(earnings.earningsDate[1]).toISOString().split('T')[0]
          : undefined;

        events.push({
          id: `yahoo-earnings-${symbol}-${earningsDate}`,
          symbol,
          eventType: 'earnings',
          date: earningsDate,
          dateEnd: earningsDateEnd,
          isEstimate: earnings.isEarningsDateEstimate ?? true,
          title: 'Earnings Report',
          description: earnings.earningsAverage
            ? `EPS estimate: $${earnings.earningsAverage.toFixed(2)}`
            : undefined,
          source: 'yahoo',
          epsEstimate: earnings.earningsAverage ?? undefined,
          revenueEstimate: earnings.revenueAverage ?? undefined,
        });
      }

      // Dividend events
      if (calendar?.exDividendDate) {
        const exDivDate = new Date(calendar.exDividendDate).toISOString().split('T')[0];
        events.push({
          id: `yahoo-exdiv-${symbol}-${exDivDate}`,
          symbol,
          eventType: 'ex_dividend',
          date: exDivDate,
          isEstimate: false,
          title: 'Ex-Dividend Date',
          source: 'yahoo',
        });
      }

      if (calendar?.dividendDate) {
        const divDate = new Date(calendar.dividendDate).toISOString().split('T')[0];
        events.push({
          id: `yahoo-div-${symbol}-${divDate}`,
          symbol,
          eventType: 'dividend_payment',
          date: divDate,
          isEstimate: false,
          title: 'Dividend Payment',
          source: 'yahoo',
        });
      }

      // Insider transactions (recent significant ones)
      const transactions = data.insiderTransactions?.transactions || [];
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

      for (const t of transactions.slice(0, 5)) {
        const txDate = this.parseDate(t.startDate);
        if (txDate && txDate.getTime() > thirtyDaysAgo && t.shares && Math.abs(t.shares) > 0) {
          const dateStr = txDate.toISOString().split('T')[0];
          const action = t.shares > 0 ? 'bought' : 'sold';
          events.push({
            id: `yahoo-insider-${symbol}-${t.filerName}-${dateStr}`,
            symbol,
            eventType: 'insider_transaction',
            date: dateStr,
            isEstimate: false,
            title: `Insider ${action} shares`,
            description: `${t.filerName} (${t.filerRelation}) ${action} ${Math.abs(t.shares).toLocaleString()} shares`,
            source: 'yahoo',
            insiderName: t.filerName,
            insiderRelation: t.filerRelation,
            insiderShares: t.shares,
            insiderValue: t.value ?? undefined,
          });
        }
      }

    } catch (error) {
      console.error(`[YahooFinance] Error getting catalyst events for ${symbol}:`, error);
    }

    return events;
  }

  async getETFHoldings(etfSymbol: string): Promise<{ symbol: string; name: string; weight: number }[]> {
    console.log(`[YahooFinance] Fetching ETF holdings for ${etfSymbol}`);

    try {
      const data = await this.retry(() => this.yahooFinance.quoteSummary(etfSymbol, {
        modules: ['topHoldings'],
      }));

      const holdings = data.topHoldings?.holdings || [];

      return holdings.map((h: any) => ({
        symbol: h.symbol || '',
        name: h.holdingName || '',
        weight: h.holdingPercent || 0,
      }));
    } catch (error) {
      console.error(`[YahooFinance] Error fetching ETF holdings for ${etfSymbol}:`, error);
      return [];
    }
  }

  async searchSymbols(query: string, limit: number = 10): Promise<SearchResult[]> {
    console.log(`[YahooFinance] Searching for "${query}"`);

    try {
      const result = await this.retry(() => this.yahooFinance.search(query, {
        quotesCount: 30,
        newsCount: 0,
      }));

      const results: SearchResult[] = (result.quotes || [])
        .filter((quote: any) =>
          quote.isYahooFinance &&
          quote.symbol &&
          (quote.quoteType === 'EQUITY' || quote.quoteType === 'ETF' || quote.quoteType === 'INDEX')
        )
        .slice(0, limit)
        .map((quote: any) => ({
          symbol: quote.symbol,
          name: quote.longname || quote.shortname || quote.symbol,
          type: this.mapQuoteType(quote.quoteType),
          exchange: quote.exchDisp || quote.exchange || '',
        }));

      console.log(`[YahooFinance] Found ${results.length} results for "${query}"`);
      return results;
    } catch (error) {
      console.error(`[YahooFinance] Error searching for "${query}":`, error);
      return [];
    }
  }

  private mapQuoteType(quoteType?: string): SearchResultType {
    switch (quoteType) {
      case 'EQUITY': return 'EQUITY';
      case 'ETF': return 'ETF';
      case 'MUTUALFUND': return 'MUTUALFUND';
      case 'INDEX': return 'INDEX';
      case 'CURRENCY': return 'CURRENCY';
      case 'CRYPTOCURRENCY': return 'CRYPTOCURRENCY';
      case 'FUTURE': return 'FUTURE';
      case 'OPTION': return 'OPTION';
      default: return 'EQUITY';
    }
  }
}

// Singleton instance
export const yahooFinance = new YahooFinanceProvider();
