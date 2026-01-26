import type { CatalystEvent } from '../types/index.js';

interface SECSubmissionResponse {
  cik: string;
  filings?: {
    recent?: {
      form: string[];
      filingDate: string[];
      items?: string[];
      primaryDocument?: string[];
      accessionNumber?: string[];
    };
  };
}

interface SECTickerEntry {
  cik_str: number;
  ticker: string;
  title: string;
}

export interface SECFilingInfo {
  hasRecentATM: boolean;
  atmFilingDate: string | null;
  hasPendingReverseSplit: boolean;
  reverseSplitDate: string | null;
  hasNasdaqDeficiency: boolean;
  deficiencyDate: string | null;
  recentFilings: Array<{
    form: string;
    date: string;
    items: string | null;
  }>;
}

// 8-K Item code descriptions for catalyst events (only impactful ones)
const ITEM_CODES: Record<string, { type: CatalystEvent['eventType']; title: string }> = {
  '1.01': { type: 'partnership', title: 'Material Agreement' },
  '1.02': { type: 'partnership', title: 'Agreement Termination' },
  '2.01': { type: 'acquisition', title: 'Acquisition/Disposition' },
  '2.02': { type: 'earnings', title: 'Earnings Results' },
  '3.01': { type: 'sec_filing', title: 'Nasdaq Deficiency Notice' },
  '5.02': { type: 'executive_change', title: 'Executive Change' },
  '5.03': { type: 'stock_split', title: 'Stock Split/Reverse Split' },
};

// Regex patterns for extracting PDUFA dates from 8-K filings
const PDUFA_PATTERNS = [
  // "PDUFA date of January 15, 2025" or "PDUFA target date of January 15, 2025"
  /PDUFA\s+(?:target\s+)?(?:action\s+)?date\s+(?:of\s+|is\s+)?([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/gi,
  // "target action date of January 15, 2025"
  /target\s+action\s+date\s+(?:of\s+|is\s+)?([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/gi,
  // "FDA.*action date of January 15, 2025"
  /FDA[^.]*action\s+date\s+(?:of\s+|is\s+)?([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/gi,
  // "PDUFA date of 01/15/2025" or "PDUFA date of 2025-01-15"
  /PDUFA\s+(?:target\s+)?(?:action\s+)?date\s+(?:of\s+|is\s+)?(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/gi,
];

// Month name to number mapping
const MONTHS: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04',
  may: '05', june: '06', july: '07', august: '08',
  september: '09', october: '10', november: '11', december: '12',
};

export class SECService {
  private readonly baseUrl = 'https://data.sec.gov';
  private readonly userAgent = 'StockIQ admin@example.com';
  private lastRequestTime = 0;
  private readonly MIN_REQUEST_INTERVAL = 150; // SEC rate limit: ~10 req/sec

  // Cache for ticker → CIK mapping (shared across all instances in memory)
  private static tickerToCIK: Map<string, string> | null = null;
  private static tickerCachePromise: Promise<Map<string, string>> | null = null;

  /**
   * Check if a stock's industry suggests it's biotech/pharma
   */
  static isBiotechIndustry(industry: string): boolean {
    const lowercaseIndustry = industry.toLowerCase();
    return (
      lowercaseIndustry.includes('biotech') ||
      lowercaseIndustry.includes('pharma') ||
      lowercaseIndustry.includes('drug') ||
      lowercaseIndustry.includes('therapeutics') ||
      lowercaseIndustry.includes('biolog')
    );
  }

  /**
   * Parse various date formats into YYYY-MM-DD
   */
  private parseDateString(dateStr: string): string | null {
    // Handle "January 15, 2025" format
    const monthDayYear = dateStr.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
    if (monthDayYear) {
      const month = MONTHS[monthDayYear[1].toLowerCase()];
      if (month) {
        const day = monthDayYear[2].padStart(2, '0');
        return `${monthDayYear[3]}-${month}-${day}`;
      }
    }

    // Handle "01/15/2025" format
    const slashFormat = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (slashFormat) {
      const month = slashFormat[1].padStart(2, '0');
      const day = slashFormat[2].padStart(2, '0');
      return `${slashFormat[3]}-${month}-${day}`;
    }

    // Handle "2025-01-15" format (already correct)
    const isoFormat = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoFormat) {
      return dateStr;
    }

    return null;
  }

  /**
   * Rate-limited fetch for SEC API
   */
  private async rateLimitedFetch(url: string): Promise<Response> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
      await new Promise(resolve => setTimeout(resolve, this.MIN_REQUEST_INTERVAL - timeSinceLastRequest));
    }
    this.lastRequestTime = Date.now();
    return fetch(url, { headers: { 'User-Agent': this.userAgent } });
  }

  /**
   * Fetch the content of an 8-K filing document
   */
  private async fetchFilingContent(cik: string, accessionNumber: string, primaryDocument: string): Promise<string | null> {
    try {
      // Format: https://www.sec.gov/Archives/edgar/data/{CIK}/{accession-no-dashes}/{primary-doc}
      const accessionNoDashes = accessionNumber.replace(/-/g, '');
      const url = `https://www.sec.gov/Archives/edgar/data/${cik.replace(/^0+/, '')}/${accessionNoDashes}/${primaryDocument}`;

      console.log(`[SECService] Fetching filing content: ${url}`);
      const response = await this.rateLimitedFetch(url);

      if (!response.ok) {
        console.error(`[SECService] Failed to fetch filing: ${response.status}`);
        return null;
      }

      const content = await response.text();
      // Strip HTML tags for easier parsing
      return content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    } catch (error) {
      console.error(`[SECService] Error fetching filing content:`, error);
      return null;
    }
  }

  /**
   * Extract PDUFA dates from filing content
   */
  private extractPDUFADates(content: string): { date: string; context: string }[] {
    const results: { date: string; context: string }[] = [];
    const seen = new Set<string>();

    for (const pattern of PDUFA_PATTERNS) {
      // Reset regex state
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const rawDate = match[1];
        const parsedDate = this.parseDateString(rawDate);

        if (parsedDate && !seen.has(parsedDate)) {
          // Only include future dates
          const dateObj = new Date(parsedDate);
          if (dateObj > new Date()) {
            seen.add(parsedDate);
            // Extract some context around the match
            const start = Math.max(0, match.index - 50);
            const end = Math.min(content.length, match.index + match[0].length + 50);
            const context = content.slice(start, end).trim();
            results.push({ date: parsedDate, context });
          }
        }
      }
    }

    return results;
  }

  /**
   * Load and cache the SEC ticker → CIK mapping.
   * Uses static cache so it's shared across all instances.
   */
  private async loadTickerMapping(): Promise<Map<string, string>> {
    // Return cached mapping if available
    if (SECService.tickerToCIK) {
      return SECService.tickerToCIK;
    }

    // If already loading, wait for that promise
    if (SECService.tickerCachePromise) {
      return SECService.tickerCachePromise;
    }

    // Start loading
    SECService.tickerCachePromise = (async () => {
      console.log('[SECService] Loading SEC ticker mapping...');
      const tickerResponse = await fetch(
        'https://www.sec.gov/files/company_tickers.json',
        { headers: { 'User-Agent': this.userAgent } }
      );

      if (!tickerResponse.ok) {
        throw new Error(`Failed to fetch ticker mapping: ${tickerResponse.status}`);
      }

      const tickers = (await tickerResponse.json()) as Record<string, SECTickerEntry>;
      const mapping = new Map<string, string>();

      for (const entry of Object.values(tickers)) {
        const cik = String(entry.cik_str).padStart(10, '0');
        mapping.set(entry.ticker.toUpperCase(), cik);
      }

      console.log(`[SECService] Loaded ${mapping.size} ticker → CIK mappings`);
      SECService.tickerToCIK = mapping;
      return mapping;
    })();

    return SECService.tickerCachePromise;
  }

  async getCIK(symbol: string): Promise<string | null> {
    try {
      const mapping = await this.loadTickerMapping();
      const cik = mapping.get(symbol.toUpperCase());

      if (cik) {
        console.log(`[SECService] Found CIK ${cik} for ${symbol}`);
        return cik;
      }

      console.log(`[SECService] Ticker ${symbol} not found in SEC ticker mapping`);
      return null;
    } catch (error) {
      console.error(`[SECService] Error getting CIK for ${symbol}:`, error);
      return null;
    }
  }

  async getFilingInfo(symbol: string): Promise<SECFilingInfo> {
    const result: SECFilingInfo = {
      hasRecentATM: false,
      atmFilingDate: null,
      hasPendingReverseSplit: false,
      reverseSplitDate: null,
      hasNasdaqDeficiency: false,
      deficiencyDate: null,
      recentFilings: [],
    };

    try {
      const cik = await this.getCIK(symbol);
      if (!cik) {
        console.log(`[SECService] Could not find CIK for ${symbol}`);
        return result;
      }

      const response = await fetch(
        `${this.baseUrl}/submissions/CIK${cik}.json`,
        { headers: { 'User-Agent': this.userAgent } }
      );

      if (!response.ok) {
        console.error(`[SECService] Failed to fetch filings for ${symbol}`);
        return result;
      }

      const data = (await response.json()) as SECSubmissionResponse;
      const filings = data.filings?.recent;

      if (!filings) {
        return result;
      }

      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const oneYearAgoStr = oneYearAgo.toISOString().split('T')[0];

      for (let i = 0; i < Math.min(filings.form.length, 100); i++) {
        const form = filings.form[i];
        const date = filings.filingDate[i];
        const items = filings.items?.[i] || null;

        if (date < oneYearAgoStr) continue;

        if (result.recentFilings.length < 10) {
          result.recentFilings.push({ form, date, items });
        }

        if (form.includes('S-3')) {
          result.hasRecentATM = true;
          if (!result.atmFilingDate || date > result.atmFilingDate) {
            result.atmFilingDate = date;
          }
        }

        if (form === '8-K' && items) {
          if (items.includes('3.01')) {
            result.hasNasdaqDeficiency = true;
            if (!result.deficiencyDate || date > result.deficiencyDate) {
              result.deficiencyDate = date;
            }
          }

          if (items.includes('5.03')) {
            result.hasPendingReverseSplit = true;
            if (!result.reverseSplitDate || date > result.reverseSplitDate) {
              result.reverseSplitDate = date;
            }
          }
        }
      }

      console.log(`[SECService] ${symbol} filing analysis:`, {
        hasRecentATM: result.hasRecentATM,
        hasPendingReverseSplit: result.hasPendingReverseSplit,
        hasNasdaqDeficiency: result.hasNasdaqDeficiency,
      });

      return result;
    } catch (error) {
      console.error(`[SECService] Error fetching filings for ${symbol}:`, error);
      return result;
    }
  }

  async getCatalystEvents(symbol: string, industry = 'Unknown'): Promise<CatalystEvent[]> {
    const events: CatalystEvent[] = [];
    const isBiotech = SECService.isBiotechIndustry(industry);

    try {
      const cik = await this.getCIK(symbol);
      if (!cik) {
        console.log(`[SECService] Could not find CIK for ${symbol}`);
        return events;
      }

      const response = await this.rateLimitedFetch(
        `${this.baseUrl}/submissions/CIK${cik}.json`
      );

      if (!response.ok) {
        console.error(`[SECService] Failed to fetch filings for ${symbol}`);
        return events;
      }

      const data = (await response.json()) as SECSubmissionResponse;
      const filings = data.filings?.recent;

      if (!filings) return events;

      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().split('T')[0];

      // Track PDUFA dates we've found to avoid duplicates
      const foundPDUFADates = new Set<string>();

      for (let i = 0; i < Math.min(filings.form.length, 50); i++) {
        const form = filings.form[i];
        const date = filings.filingDate[i];
        const items = filings.items?.[i] || null;
        const accessionNumber = filings.accessionNumber?.[i];
        const primaryDocument = filings.primaryDocument?.[i];

        if (date < ninetyDaysAgoStr) continue;

        const accessionNoDashes = accessionNumber?.replace(/-/g, '');
        const sourceUrl = accessionNoDashes
          ? `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=8-K&dateb=&owner=include&count=40`
          : undefined;

        // Process 8-K filings with item codes
        if (form === '8-K' && items) {
          for (const [code, info] of Object.entries(ITEM_CODES)) {
            if (items.includes(code)) {
              events.push({
                id: `sec-8k-${symbol}-${date}-${code}`,
                symbol,
                eventType: info.type,
                date,
                isEstimate: false,
                title: info.title,
                description: `8-K Item ${code}`,
                source: 'sec',
                sourceUrl,
                metadata: { form, itemCode: code },
              });
            }
          }

          // For biotech stocks, check 8-K filings (especially 8.01 "Other Events") for PDUFA dates
          if (isBiotech && accessionNumber && primaryDocument) {
            // Item 8.01 is commonly used for FDA/PDUFA announcements
            const hasFDARelevantItem = items.includes('8.01') || items.includes('7.01');
            if (hasFDARelevantItem) {
              const content = await this.fetchFilingContent(cik, accessionNumber, primaryDocument);
              if (content) {
                const pdufaDates = this.extractPDUFADates(content);
                for (const pdufa of pdufaDates) {
                  if (!foundPDUFADates.has(pdufa.date)) {
                    foundPDUFADates.add(pdufa.date);
                    events.push({
                      id: `sec-pdufa-${symbol}-${pdufa.date}`,
                      symbol,
                      eventType: 'pdufa_date',
                      date: pdufa.date,
                      isEstimate: false,
                      title: 'PDUFA Target Date',
                      description: `FDA target action date from 8-K filing (${date})`,
                      source: 'sec',
                      sourceUrl: `https://www.sec.gov/Archives/edgar/data/${cik.replace(/^0+/, '')}/${accessionNoDashes}/${primaryDocument}`,
                      metadata: { filingDate: date, context: pdufa.context.slice(0, 200) },
                    });
                    console.log(`[SECService] Found PDUFA date ${pdufa.date} for ${symbol}`);
                  }
                }
              }
            }
          }
        }

        // S-3 filings (ATM offerings)
        if (form.includes('S-3')) {
          events.push({
            id: `sec-s3-${symbol}-${date}`,
            symbol,
            eventType: 'sec_filing',
            date,
            isEstimate: false,
            title: 'S-3 Filing (ATM Offering)',
            description: 'Shelf registration for at-the-market offering',
            source: 'sec',
            metadata: { form },
          });
        }
      }

      console.log(`[SECService] Found ${events.length} catalyst events for ${symbol} (biotech: ${isBiotech})`);
      return events;
    } catch (error) {
      console.error(`[SECService] Error getting catalyst events for ${symbol}:`, error);
      return events;
    }
  }
}
