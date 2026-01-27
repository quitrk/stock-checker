import type { CatalystEvent, CatalystEventType, ChecklistResult } from '../types/index.js';
import { getCached, setCache, cacheKey } from './CacheService.js';
import * as fs from 'fs/promises';
import * as path from 'path';

// Extracted catalyst from filing content
interface ExtractedCatalyst {
  type: CatalystEventType;
  title: string;
  description: string;
  date?: string;
  isEstimate: boolean;
}

// Return type for getCatalystEvents
export interface SECCatalystResult {
  events: CatalystEvent[];
  secLastFetchedDate: string | null;
}

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

// =============================================================================
// BIOTECH CATALYST EXTRACTION PATTERNS
// =============================================================================

const PDUFA_PATTERNS = [
  /PDUFA\s*\"\s*\)\s*(?:target\s+)?action\s+date\s+(?:of\s+|is\s+)?([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/gi,
  /PDUFA\s+(?:target\s+)?(?:action\s+)?date\s+(?:of\s+|is\s+)?([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/gi,
  /target\s+action\s+date\s+(?:of\s+|is\s+)?([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/gi,
  /Prescription\s+Drug\s+User\s+Fee\s+Act[^.]*(?:date|action)[^.]*?([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/gi,
  /PDUFA\s+(?:target\s+)?(?:action\s+)?date\s+(?:of\s+|is\s+)?(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/gi,
];

const ADCOM_PATTERNS = [
  /Advisory\s+Committee\s+meeting\s+(?:on\s+|scheduled\s+for\s+)?([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/gi,
  /AdCom\s+(?:meeting\s+)?(?:on\s+|scheduled\s+for\s+)?([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/gi,
  /ODAC\s+(?:meeting\s+)?(?:on\s+|scheduled\s+for\s+)?([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/gi,
];

const FDA_DESIGNATION_PATTERNS = [
  /granted\s+Breakthrough\s+Therapy\s+[Dd]esignation[^.]{0,150}/gi,
  /Breakthrough\s+Therapy\s+[Dd]esignation[^.]*(?:granted|received)[^.]{0,100}/gi,
  /granted\s+Fast\s+Track\s+[Dd]esignation[^.]{0,150}/gi,
  /Fast\s+Track\s+[Dd]esignation[^.]*(?:granted|received)[^.]{0,100}/gi,
  /granted\s+Priority\s+Review[^.]{0,150}/gi,
  /Priority\s+Review[^.]*(?:granted|received)[^.]{0,100}/gi,
  /granted\s+Orphan\s+Drug\s+[Dd]esignation[^.]{0,150}/gi,
  /Orphan\s+Drug\s+[Dd]esignation[^.]*(?:granted|received)[^.]{0,100}/gi,
  /RMAT\s+[Dd]esignation[^.]*(?:granted|received)[^.]{0,100}/gi,
];

const FDA_APPROVAL_PATTERNS = [
  /FDA\s+(?:has\s+)?approved\s+([A-Z][A-Z0-9\-]+)[^.]{0,150}/gi,
  /received\s+(?:FDA\s+)?approval\s+(?:for\s+)?([A-Z][A-Z0-9\-]+)?[^.]{0,150}/gi,
];

const FDA_REJECTION_PATTERNS = [
  /Complete\s+Response\s+Letter[^.]{0,200}/gi,
  /(?:received|issued)\s+(?:a\s+)?CRL[^.]{0,150}/gi,
];

const CLINICAL_READOUT_PATTERNS = [
  /(?:positive\s+)?topline\s+(?:data|results)[^.]{0,200}/gi,
  /Phase\s+[123][ab]?\s+[^.]*(?:data|results)\s+(?:expected|anticipated)[^.]*?([A-Z][a-z]+\s+\d{1,2},?\s+\d{4}|Q[1-4]\s+\d{4})/gi,
  /primary\s+endpoint[^.]*(?:met|achieved|reached)[^.]{0,150}/gi,
];

const CLINICAL_MILESTONE_PATTERNS = [
  /(?:completed|completes)\s+enrollment[^.]{0,150}/gi,
  /first\s+patient\s+(?:dosed|enrolled|treated)[^.]{0,150}/gi,
  /last\s+patient\s+(?:dosed|enrolled|treated)[^.]{0,150}/gi,
  /initiated\s+(?:a\s+)?(?:Phase|pivotal|registrational)[^.]{0,150}/gi,
];

const NDA_BLA_PATTERNS = [
  /(?:submitted|filed)[^.]*(?:NDA|BLA|sNDA|sBLA)[^.]{0,150}/gi,
  /(?:NDA|BLA|sNDA|sBLA)[^.]*(?:submitted|filed|accepted)[^.]{0,150}/gi,
  /(?:NDA|BLA)\s+submission[^.]*?(Q[1-4]\s+\d{4})/gi,
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

  // Directory for caching 8-K filings locally (only when SAVE_SEC_FILINGS=true)
  private static readonly FILINGS_CACHE_DIR = './data/sec-filings';

  private static shouldSaveFilings(): boolean {
    return process.env.SAVE_SEC_FILINGS === 'true';
  }

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
   * Save filing content to local disk for analysis
   */
  private async saveFilingLocally(symbol: string, date: string, accessionNumber: string, rawContent: string, strippedContent: string): Promise<void> {
    if (!SECService.shouldSaveFilings()) return;

    try {
      const symbolDir = path.join(SECService.FILINGS_CACHE_DIR, symbol.toUpperCase());
      await fs.mkdir(symbolDir, { recursive: true });

      const baseFilename = `${date}_${accessionNumber.replace(/-/g, '')}`;

      // Save raw HTML
      await fs.writeFile(
        path.join(symbolDir, `${baseFilename}.html`),
        rawContent,
        'utf-8'
      );

      // Save stripped text
      await fs.writeFile(
        path.join(symbolDir, `${baseFilename}.txt`),
        strippedContent,
        'utf-8'
      );

      console.log(`[SECService] Saved filing: ${symbol}/${baseFilename}`);
    } catch (error) {
      console.error(`[SECService] Error saving filing locally:`, error);
    }
  }

  /**
   * Fetch the content of an 8-K filing document
   */
  private async fetchFilingContent(cik: string, accessionNumber: string, primaryDocument: string, symbol?: string, date?: string): Promise<string | null> {
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

      const rawContent = await response.text();
      // Strip HTML tags for easier parsing
      const strippedContent = rawContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

      // Save locally if enabled
      if (symbol && date) {
        await this.saveFilingLocally(symbol, date, accessionNumber, rawContent, strippedContent);
      }

      return strippedContent;
    } catch (error) {
      console.error(`[SECService] Error fetching filing content:`, error);
      return null;
    }
  }

  /**
   * Parse quarter date strings like "Q1 2025" into end-of-quarter date
   */
  private parseQuarterDate(quarterStr: string): string | null {
    const qMatch = quarterStr.match(/Q([1-4])\s+(\d{4})/i);
    if (qMatch) {
      const quarter = parseInt(qMatch[1]);
      const year = qMatch[2];
      const endMonth = quarter * 3;
      const endDay = [31, 30, 30, 31][quarter - 1];
      return `${year}-${String(endMonth).padStart(2, '0')}-${endDay}`;
    }
    return null;
  }

  private isFutureDate(dateStr: string): boolean {
    return new Date(dateStr) > new Date();
  }

  /**
   * Extract all biotech catalysts from filing content
   */
  private extractBiotechCatalysts(content: string, filingDate: string): ExtractedCatalyst[] {
    const catalysts: ExtractedCatalyst[] = [];
    const seen = new Set<string>();

    const addCatalyst = (catalyst: ExtractedCatalyst, key: string) => {
      if (!seen.has(key)) {
        seen.add(key);
        catalysts.push(catalyst);
      }
    };

    // PDUFA dates
    for (const pattern of PDUFA_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const rawDate = match[1];
        const parsedDate = this.parseDateString(rawDate);
        if (parsedDate && this.isFutureDate(parsedDate)) {
          addCatalyst({
            type: 'pdufa_date',
            title: 'PDUFA Target Date',
            description: `FDA target action date from 8-K filing (${filingDate})`,
            date: parsedDate,
            isEstimate: false,
          }, `pdufa-${parsedDate}`);
        }
      }
    }

    // AdCom meetings
    for (const pattern of ADCOM_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (match[1]) {
          const parsedDate = this.parseDateString(match[1]);
          if (parsedDate && this.isFutureDate(parsedDate)) {
            addCatalyst({
              type: 'adcom',
              title: 'FDA Advisory Committee Meeting',
              description: `AdCom meeting from 8-K filing (${filingDate})`,
              date: parsedDate,
              isEstimate: false,
            }, `adcom-${parsedDate}`);
          }
        }
      }
    }

    // FDA Designations
    for (const pattern of FDA_DESIGNATION_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const matchText = match[0].toLowerCase();
        let title = 'FDA Designation';
        if (matchText.includes('breakthrough')) title = 'Breakthrough Therapy Designation';
        else if (matchText.includes('fast track')) title = 'Fast Track Designation';
        else if (matchText.includes('priority review')) title = 'Priority Review Granted';
        else if (matchText.includes('orphan')) title = 'Orphan Drug Designation';
        else if (matchText.includes('rmat')) title = 'RMAT Designation';

        addCatalyst({
          type: 'fda_designation',
          title,
          description: match[0].slice(0, 200),
          date: filingDate,
          isEstimate: false,
        }, `designation-${title}-${filingDate}`);
      }
    }

    // FDA Approvals
    for (const pattern of FDA_APPROVAL_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        addCatalyst({
          type: 'fda_approval',
          title: 'FDA Approval',
          description: match[0].slice(0, 200),
          date: filingDate,
          isEstimate: false,
        }, `approval-${filingDate}`);
      }
    }

    // FDA Rejections (CRL)
    for (const pattern of FDA_REJECTION_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        addCatalyst({
          type: 'fda_rejection',
          title: 'Complete Response Letter (CRL)',
          description: match[0].slice(0, 200),
          date: filingDate,
          isEstimate: false,
        }, `rejection-${filingDate}`);
      }
    }

    // Clinical Readouts
    for (const pattern of CLINICAL_READOUT_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        // Check for future date in match
        if (match[1]) {
          const parsedDate = this.parseDateString(match[1]) || this.parseQuarterDate(match[1]);
          if (parsedDate && this.isFutureDate(parsedDate)) {
            addCatalyst({
              type: 'clinical_readout',
              title: 'Clinical Data Readout Expected',
              description: match[0].slice(0, 200),
              date: parsedDate,
              isEstimate: match[1].includes('Q'),
            }, `readout-${parsedDate}`);
          }
        } else if (match[0].toLowerCase().includes('positive') || match[0].toLowerCase().includes('met')) {
          addCatalyst({
            type: 'clinical_readout',
            title: 'Clinical Data Readout',
            description: match[0].slice(0, 200),
            date: filingDate,
            isEstimate: false,
          }, `readout-${filingDate}`);
        }
      }
    }

    // Clinical Milestones
    for (const pattern of CLINICAL_MILESTONE_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const matchText = match[0].toLowerCase();
        let title = 'Clinical Trial Milestone';
        if (matchText.includes('first patient')) title = 'First Patient Dosed';
        else if (matchText.includes('last patient')) title = 'Last Patient Dosed';
        else if (matchText.includes('completed') && matchText.includes('enrollment')) title = 'Enrollment Completed';
        else if (matchText.includes('initiated')) title = 'Trial Initiated';

        addCatalyst({
          type: 'clinical_milestone',
          title,
          description: match[0].slice(0, 200),
          date: filingDate,
          isEstimate: false,
        }, `milestone-${title}-${filingDate}`);
      }
    }

    // NDA/BLA Submissions
    for (const pattern of NDA_BLA_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const matchText = match[0].toLowerCase();
        const isSubmitted = matchText.includes('submitted') || matchText.includes('filed') || matchText.includes('accepted');

        if (match[1]) {
          const parsedDate = this.parseQuarterDate(match[1]);
          if (parsedDate && this.isFutureDate(parsedDate)) {
            addCatalyst({
              type: 'nda_bla_submission',
              title: 'NDA/BLA Submission Expected',
              description: match[0].slice(0, 200),
              date: parsedDate,
              isEstimate: true,
            }, `nda-${parsedDate}`);
          }
        } else if (isSubmitted) {
          addCatalyst({
            type: 'nda_bla_submission',
            title: 'NDA/BLA Submitted',
            description: match[0].slice(0, 200),
            date: filingDate,
            isEstimate: false,
          }, `nda-${filingDate}`);
        }
      }
    }

    return catalysts;
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

  async getCatalystEvents(symbol: string, industry = 'Unknown'): Promise<SECCatalystResult> {
    const isBiotech = SECService.isBiotechIndustry(industry);
    const upperSymbol = symbol.toUpperCase();

    // Check cache for existing data and last fetched date
    const cached = await getCached<ChecklistResult>(cacheKey('checklist', upperSymbol));
    const secLastFetchedDate = cached?.secLastFetchedDate || null;

    // Start with previously cached SEC events (filter to only SEC source)
    const events: CatalystEvent[] = (cached?.catalystEvents || [])
      .filter(e => e.source === 'sec');
    const seenIds = new Set(events.map(e => e.id));

    // Track the latest filing date we process (preserve cached date as baseline)
    let newLatestFilingDate: string | null = secLastFetchedDate;

    try {
      // Determine lookback date: use cached date or 1 year ago
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const oneYearAgoStr = oneYearAgo.toISOString().split('T')[0];

      if (secLastFetchedDate) {
        console.log(`[SECService] ${symbol}: ${events.length} cached events, fetching filings since ${secLastFetchedDate}`);
      }

      const cik = await this.getCIK(symbol);
      if (!cik) {
        console.log(`[SECService] Could not find CIK for ${symbol}`);
        return { events, secLastFetchedDate: newLatestFilingDate };
      }

      const response = await this.rateLimitedFetch(
        `${this.baseUrl}/submissions/CIK${cik}.json`
      );

      if (!response.ok) {
        console.error(`[SECService] Failed to fetch filings for ${symbol}`);
        return { events, secLastFetchedDate: newLatestFilingDate };
      }

      const data = (await response.json()) as SECSubmissionResponse;
      const filings = data.filings?.recent;

      if (!filings) return { events, secLastFetchedDate: newLatestFilingDate };

      for (let i = 0; i < Math.min(filings.form.length, 100); i++) {
        const form = filings.form[i];
        const date = filings.filingDate[i];
        const items = filings.items?.[i] || null;
        const accessionNumber = filings.accessionNumber?.[i];
        const primaryDocument = filings.primaryDocument?.[i];

        // Skip filings we've already processed
        if (secLastFetchedDate && date <= secLastFetchedDate) continue;
        if (date < oneYearAgoStr) continue;

        // Track latest date
        if (!newLatestFilingDate || date > newLatestFilingDate) {
          newLatestFilingDate = date;
        }

        const accessionNoDashes = accessionNumber?.replace(/-/g, '');
        const sourceUrl = accessionNoDashes
          ? `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=8-K&dateb=&owner=include&count=40`
          : undefined;

        // Process 8-K filings
        if (form === '8-K' && items) {
          // Standard 8-K item codes
          for (const [code, info] of Object.entries(ITEM_CODES)) {
            if (items.includes(code)) {
              const id = `sec-8k-${symbol}-${date}-${code}`;
              if (!seenIds.has(id)) {
                seenIds.add(id);
                events.push({
                  id,
                  symbol,
                  eventType: info.type,
                  date,
                  isEstimate: false,
                  title: info.title,
                  description: `8-K Item ${code}`,
                  source: 'sec',
                  sourceUrl,
                  secForm: form,
                  secItemCode: code,
                });
              }
            }
          }

          // For biotech stocks, extract comprehensive catalysts from 8-K content
          if (isBiotech && accessionNumber && primaryDocument) {
            const content = await this.fetchFilingContent(cik, accessionNumber, primaryDocument, symbol, date);
            if (content) {
              const extracted = this.extractBiotechCatalysts(content, date);
              for (const catalyst of extracted) {
                const catalystDate = catalyst.date || date;
                const id = `sec-${catalyst.type}-${symbol}-${catalystDate}`;

                if (!seenIds.has(id)) {
                  seenIds.add(id);
                  events.push({
                    id,
                    symbol,
                    eventType: catalyst.type,
                    date: catalystDate,
                    isEstimate: catalyst.isEstimate,
                    title: catalyst.title,
                    description: catalyst.description,
                    source: 'sec',
                    sourceUrl: `https://www.sec.gov/Archives/edgar/data/${cik.replace(/^0+/, '')}/${accessionNoDashes}/${primaryDocument}`,
                  });
                  console.log(`[SECService] ${symbol}: found ${catalyst.type} - ${catalyst.title}`);
                }
              }
            }
          }
        }

        // S-3 filings (ATM offerings)
        if (form.includes('S-3')) {
          const id = `sec-s3-${symbol}-${date}`;
          if (!seenIds.has(id)) {
            seenIds.add(id);
            events.push({
              id,
              symbol,
              eventType: 'sec_filing',
              date,
              isEstimate: false,
              title: 'S-3 Filing (ATM Offering)',
              description: 'Shelf registration for at-the-market offering',
              source: 'sec',
              secForm: form,
            });
          }
        }
      }

      console.log(`[SECService] ${symbol}: found ${events.length} total catalyst events (biotech: ${isBiotech})`);
      return { events, secLastFetchedDate: newLatestFilingDate };
    } catch (error) {
      console.error(`[SECService] Error getting catalyst events for ${symbol}:`, error);
      console.log(`[SECService] ${symbol}: returning ${events.length} cached events due to error`);
      return { events, secLastFetchedDate: newLatestFilingDate };
    }
  }
}
