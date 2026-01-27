import type { CatalystEvent, ChecklistResult } from '../types/index.js';
import { yahooFinance, YahooFinanceProvider } from './providers/YahooFinanceProvider.js';
import { ClinicalTrialsProvider } from './providers/ClinicalTrialsProvider.js';
import { FinnhubProvider } from './providers/FinnhubProvider.js';
import { SECService } from './SECService.js';
import { getCached, setCache, cacheKey } from './CacheService.js';

/**
 * Unified service that aggregates catalyst events from all data sources
 */
export class CatalystService {
  private yahooProvider: YahooFinanceProvider;
  private clinicalTrialsProvider: ClinicalTrialsProvider;
  private finnhubProvider: FinnhubProvider;
  private secService: SECService;

  constructor(
    yahooProvider?: YahooFinanceProvider,
    secService?: SECService
  ) {
    // Allow injection of existing providers to share cache
    this.yahooProvider = yahooProvider || yahooFinance;
    this.secService = secService || new SECService();
    this.clinicalTrialsProvider = new ClinicalTrialsProvider();
    this.finnhubProvider = new FinnhubProvider();
  }

  /**
   * Get catalyst events for multiple symbols efficiently.
   * Uses cached ChecklistResults where available, fetches fresh data for uncached symbols.
   * Returns all events sorted by date (ascending).
   */
  async getCatalystEventsForSymbols(symbols: string[]): Promise<CatalystEvent[]> {
    if (symbols.length === 0) return [];

    const upperSymbols = symbols.map(s => s.toUpperCase());
    const allEvents: CatalystEvent[] = [];
    const uncachedSymbols: string[] = [];
    const cachedData = new Map<string, { companyName: string; industry: string }>();

    // Stats for aggregate logging
    let cachedEventsCount = 0;
    let fetchedEventsCount = 0;
    let cacheUpdates = 0;
    let cacheCreates = 0;
    let fetchErrors = 0;

    // Step 1: Check cache for each symbol
    const cacheChecks = await Promise.all(
      upperSymbols.map(async (symbol) => {
        const cached = await getCached<ChecklistResult>(cacheKey('checklist', symbol));
        return { symbol, cached };
      })
    );

    for (const { symbol, cached } of cacheChecks) {
      if (cached?.catalystEvents && cached.catalystEvents.length >= 0) {
        // Use cached catalyst events
        allEvents.push(...cached.catalystEvents);
        cachedEventsCount += cached.catalystEvents.length;
        cachedData.set(symbol, {
          companyName: cached.companyName,
          industry: cached.industry,
        });
      } else {
        uncachedSymbols.push(symbol);
      }
    }

    // Step 2: For uncached symbols, fetch market data to get industry/companyName
    if (uncachedSymbols.length > 0) {
      // Get market data in batch
      const marketDataMap = await this.yahooProvider.getMultipleQuotes(uncachedSymbols);

      // Step 3: Fetch catalysts with controlled concurrency
      const CONCURRENCY = 3;
      const results: { symbol: string; events: CatalystEvent[]; secLastFetchedDate: string | null; companyName: string; industry: string }[] = [];

      const BATCH_DELAY = 1000; // 1 second between batches

      for (let i = 0; i < uncachedSymbols.length; i += CONCURRENCY) {
        const batch = uncachedSymbols.slice(i, i + CONCURRENCY);
        const batchResults = await Promise.all(
          batch.map(async (symbol) => {
            const marketData = marketDataMap.get(symbol);
            const companyName = marketData?.companyName ?? symbol;
            const industry = marketData?.industry ?? 'Unknown';

            try {
              const result = await this.getCatalystEvents(symbol, companyName, industry);
              return { symbol, events: result.events, secLastFetchedDate: result.secLastFetchedDate, companyName, industry, error: false };
            } catch (error) {
              return { symbol, events: [], secLastFetchedDate: null, companyName, industry, error: true };
            }
          })
        );
        for (const r of batchResults) {
          results.push({ symbol: r.symbol, events: r.events, secLastFetchedDate: r.secLastFetchedDate, companyName: r.companyName, industry: r.industry });
          if (r.error) fetchErrors++;
        }

        // Delay between batches to avoid rate limits
        if (i + CONCURRENCY < uncachedSymbols.length) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
        }
      }

      // Step 4: Update cache and collect events
      for (const { symbol, events, secLastFetchedDate, companyName, industry } of results) {
        allEvents.push(...events);
        fetchedEventsCount += events.length;

        // Update cache with catalyst events and secLastFetchedDate
        const existingCache = await getCached<ChecklistResult>(cacheKey('checklist', symbol));
        if (existingCache) {
          existingCache.catalystEvents = events;
          if (secLastFetchedDate) {
            existingCache.secLastFetchedDate = secLastFetchedDate;
          }
          await setCache(cacheKey('checklist', symbol), existingCache);
          cacheUpdates++;
        } else {
          const minimalEntry: Partial<ChecklistResult> = {
            symbol,
            companyName,
            industry,
            catalystEvents: events,
            secLastFetchedDate: secLastFetchedDate || undefined,
            timestamp: new Date().toISOString(),
          };
          await setCache(cacheKey('checklist', symbol), minimalEntry);
          cacheCreates++;
        }
      }
    }

    // Step 5: Deduplicate and sort all events by date
    const deduped = this.deduplicateEvents(allEvents);
    deduped.sort((a, b) => a.date.localeCompare(b.date));

    // Aggregate log
    const cachedCount = upperSymbols.length - uncachedSymbols.length;
    const parts = [`${upperSymbols.length} symbols`, `${deduped.length} events`];
    if (cachedCount > 0) parts.push(`${cachedCount} cached (${cachedEventsCount} events)`);
    if (uncachedSymbols.length > 0) parts.push(`${uncachedSymbols.length} fetched (${fetchedEventsCount} events)`);
    if (fetchErrors > 0) parts.push(`${fetchErrors} errors`);
    console.log(`[CatalystService] ${parts.join(', ')}`);

    return deduped;
  }

  /**
   * Get all catalyst events for a symbol from all configured data sources
   */
  async getCatalystEvents(
    symbol: string,
    companyName: string,
    industry: string
  ): Promise<{ events: CatalystEvent[]; secLastFetchedDate: string | null }> {
    const allEvents: CatalystEvent[] = [];
    let secLastFetchedDate: string | null = null;

    // Fetch from all sources in parallel
    const [yahooResult, secResult, ctResult, finnhubResult] = await Promise.all([
      // Yahoo Finance
      this.yahooProvider.getCatalystEvents(symbol)
        .then(events => ({ events }))
        .catch(() => ({ events: [] })),
      // SEC
      this.secService.getCatalystEvents(symbol, industry)
        .then(result => result)
        .catch(() => ({ events: [], secLastFetchedDate: null })),
      // ClinicalTrials.gov
      this.clinicalTrialsProvider.getCatalystEvents(symbol, companyName)
        .then(events => ({ events }))
        .catch(() => ({ events: [] })),
      // Finnhub
      this.finnhubProvider.isConfigured()
        ? this.finnhubProvider.getCatalystEvents(symbol)
            .then(events => ({ events }))
            .catch(() => ({ events: [] }))
        : Promise.resolve({ events: [] }),
    ]);

    allEvents.push(...yahooResult.events);
    allEvents.push(...secResult.events);
    secLastFetchedDate = secResult.secLastFetchedDate;
    allEvents.push(...ctResult.events);
    allEvents.push(...finnhubResult.events);

    const deduped = this.deduplicateEvents(allEvents);
    deduped.sort((a, b) => a.date.localeCompare(b.date));
    return { events: deduped, secLastFetchedDate };
  }


  /**
   * Deduplicate events that are essentially the same from different sources
   * Prefers more detailed sources (Yahoo > Finnhub, SEC > Yahoo for filings)
   */
  private deduplicateEvents(events: CatalystEvent[]): CatalystEvent[] {
    const seen = new Map<string, CatalystEvent>();

    for (const event of events) {
      // Create a key based on symbol + type + date (without source)
      const key = `${event.symbol}-${event.eventType}-${event.date}`;

      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, event);
      } else {
        // Prefer certain sources over others
        const priority: Record<string, number> = {
          sec: 4,        // SEC is authoritative for filings
          clinicaltrials: 3, // CT.gov is authoritative for trials
          finnhub: 2,    // Finnhub has good split data
          yahoo: 1,      // Yahoo is general purpose
        };

        const existingPriority = priority[existing.source] || 0;
        const newPriority = priority[event.source] || 0;

        // Replace if new source is higher priority
        if (newPriority > existingPriority) {
          seen.set(key, event);
        }
        // Or if same priority but new has more description
        else if (newPriority === existingPriority && (event.description?.length || 0) > (existing.description?.length || 0)) {
          seen.set(key, event);
        }
      }
    }

    return Array.from(seen.values());
  }
}
