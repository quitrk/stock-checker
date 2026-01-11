interface SECSubmissionResponse {
  cik: string;
  filings?: {
    recent?: {
      form: string[];
      filingDate: string[];
      items?: string[];
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

export class SECService {
  private readonly baseUrl = 'https://data.sec.gov';
  private readonly userAgent = 'Stock-Checker admin@example.com';

  async getCIK(symbol: string): Promise<string | null> {
    try {
      console.log(`[SECService] Looking up CIK for ${symbol}...`);

      const tickerResponse = await fetch(
        'https://www.sec.gov/files/company_tickers.json',
        { headers: { 'User-Agent': this.userAgent } }
      );

      if (tickerResponse.ok) {
        const tickers = (await tickerResponse.json()) as Record<string, SECTickerEntry>;
        const entry = Object.values(tickers).find(
          (t) => t.ticker === symbol.toUpperCase()
        );
        if (entry) {
          const cik = String(entry.cik_str).padStart(10, '0');
          console.log(`[SECService] Found CIK ${cik} for ${symbol}`);
          return cik;
        }
        console.log(`[SECService] Ticker ${symbol} not found in SEC ticker mapping`);
      } else {
        console.error(`[SECService] Failed to fetch ticker mapping: ${tickerResponse.status}`);
      }

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
}
