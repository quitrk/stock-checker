import type { CatalystEvent, ChecklistResult } from '../types/index.js';
import { YahooFinanceProvider } from './providers/YahooFinanceProvider.js';
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
    this.yahooProvider = yahooProvider || new YahooFinanceProvider();
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
    console.log(`[CatalystService] Fetching catalysts for ${upperSymbols.length} symbols...`);

    const allEvents: CatalystEvent[] = [];
    const uncachedSymbols: string[] = [];
    const cachedData = new Map<string, { companyName: string; industry: string }>();

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
        cachedData.set(symbol, {
          companyName: cached.companyName,
          industry: cached.industry,
        });
        console.log(`[CatalystService] Using ${cached.catalystEvents.length} cached events for ${symbol}`);
      } else {
        uncachedSymbols.push(symbol);
      }
    }

    // Step 2: For uncached symbols, fetch market data to get industry/companyName
    if (uncachedSymbols.length > 0) {
      console.log(`[CatalystService] Fetching data for ${uncachedSymbols.length} uncached symbols...`);

      // Get market data in batch
      const marketDataMap = await this.yahooProvider.getMultipleQuotes(uncachedSymbols);

      // Step 3: Fetch catalysts with controlled concurrency
      const CONCURRENCY = 3;
      const results: { symbol: string; events: CatalystEvent[]; companyName: string; industry: string }[] = [];

      for (let i = 0; i < uncachedSymbols.length; i += CONCURRENCY) {
        const batch = uncachedSymbols.slice(i, i + CONCURRENCY);
        const batchResults = await Promise.all(
          batch.map(async (symbol) => {
            const marketData = marketDataMap.get(symbol);
            const companyName = marketData?.companyName ?? symbol;
            const industry = marketData?.industry ?? 'Unknown';

            try {
              const events = await this.getCatalystEvents(symbol, companyName, industry);
              return { symbol, events, companyName, industry };
            } catch (error) {
              console.error(`[CatalystService] Error fetching catalysts for ${symbol}:`, error);
              return { symbol, events: [], companyName, industry };
            }
          })
        );
        results.push(...batchResults);
      }

      // Step 4: Update cache and collect events
      for (const { symbol, events, companyName, industry } of results) {
        allEvents.push(...events);

        // Update cache with catalyst events
        const existingCache = await getCached<ChecklistResult>(cacheKey('checklist', symbol));
        if (existingCache) {
          // Update existing cache entry with new catalyst events
          existingCache.catalystEvents = events;
          await setCache(cacheKey('checklist', symbol), existingCache);
          console.log(`[CatalystService] Updated cache for ${symbol} with ${events.length} events`);
        } else {
          // Create minimal cache entry for catalysts
          const minimalEntry: Partial<ChecklistResult> = {
            symbol,
            companyName,
            industry,
            catalystEvents: events,
            timestamp: new Date().toISOString(),
          };
          await setCache(cacheKey('checklist', symbol), minimalEntry);
          console.log(`[CatalystService] Created minimal cache for ${symbol} with ${events.length} events`);
        }
      }
    }

    // Step 5: Deduplicate and sort all events by date
    const deduped = this.deduplicateEvents(allEvents);
    deduped.sort((a, b) => a.date.localeCompare(b.date));

    console.log(`[CatalystService] Total catalyst events for ${upperSymbols.length} symbols: ${deduped.length}`);
    return deduped;
  }

  /**
   * Get all catalyst events for a symbol from all configured data sources
   */
  async getCatalystEvents(
    symbol: string,
    companyName: string,
    industry: string
  ): Promise<CatalystEvent[]> {
    console.log(`[CatalystService] Fetching catalyst events for ${symbol}...`);

    const allEvents: CatalystEvent[] = [];
    const errors: string[] = [];

    // Fetch from all sources in parallel
    const promises: Promise<{ source: string; events: CatalystEvent[] }>[] = [];

    // Yahoo Finance - always fetch
    promises.push(
      this.yahooProvider.getCatalystEvents(symbol)
        .then(events => ({ source: 'yahoo', events }))
        .catch(err => {
          errors.push(`Yahoo: ${err.message}`);
          return { source: 'yahoo', events: [] };
        })
    );

    // SEC - always fetch (pass industry for PDUFA parsing on biotech stocks)
    promises.push(
      this.secService.getCatalystEvents(symbol, industry)
        .then(events => ({ source: 'sec', events }))
        .catch(err => {
          errors.push(`SEC: ${err.message}`);
          return { source: 'sec', events: [] };
        })
    );

    // ClinicalTrials.gov - only for biotech/pharma stocks
    if (ClinicalTrialsProvider.isBiotechIndustry(industry)) {
      promises.push(
        this.clinicalTrialsProvider.getCatalystEvents(symbol, companyName)
          .then(events => ({ source: 'clinicaltrials', events }))
          .catch(err => {
            errors.push(`ClinicalTrials: ${err.message}`);
            return { source: 'clinicaltrials', events: [] };
          })
      );
    }

    // Finnhub - only if configured
    if (this.finnhubProvider.isConfigured()) {
      promises.push(
        this.finnhubProvider.getCatalystEvents(symbol)
          .then(events => ({ source: 'finnhub', events }))
          .catch(err => {
            errors.push(`Finnhub: ${err.message}`);
            return { source: 'finnhub', events: [] };
          })
      );
    }

    // Wait for all sources
    const results = await Promise.all(promises);

    for (const result of results) {
      allEvents.push(...result.events);
    }

    if (errors.length > 0) {
      console.warn(`[CatalystService] Some sources had errors:`, errors);
    }

    // Deduplicate events (same type on same date from different sources)
    const deduped = this.deduplicateEvents(allEvents);

    // Sort by date (ascending)
    deduped.sort((a, b) => a.date.localeCompare(b.date));

    console.log(`[CatalystService] Total catalyst events for ${symbol}: ${deduped.length}`);
    return deduped;
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
