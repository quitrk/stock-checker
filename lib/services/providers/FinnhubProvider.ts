import type { CatalystEvent } from '../../types/index.js';

interface FinnhubSplit {
  symbol: string;
  date: string;
  fromFactor: number;
  toFactor: number;
}

interface FinnhubIPO {
  symbol: string;
  date: string;
  exchange: string;
  name: string;
  status: string;
  price?: number;
  numberOfShares?: number;
  totalSharesValue?: number;
}

/**
 * Provider for Finnhub API
 * Provides stock split and IPO calendar data
 * Requires FINNHUB_API_KEY environment variable
 */
export class FinnhubProvider {
  private readonly baseUrl = 'https://finnhub.io/api/v1';
  private readonly apiKey: string | null;

  constructor() {
    this.apiKey = process.env.FINNHUB_API_KEY || null;
    if (!this.apiKey) {
      console.log('[Finnhub] No API key configured (FINNHUB_API_KEY). Finnhub features disabled.');
    }
  }

  isConfigured(): boolean {
    return this.apiKey !== null;
  }

  async getCatalystEvents(symbol: string): Promise<CatalystEvent[]> {
    if (!this.apiKey) {
      return [];
    }

    const events: CatalystEvent[] = [];

    try {
      // Fetch stock splits for this symbol
      const splitEvents = await this.getStockSplits(symbol);
      events.push(...splitEvents);

    } catch (error) {
      console.error(`[Finnhub] Error fetching data for ${symbol}:`, error);
    }

    return events;
  }

  private async getStockSplits(symbol: string): Promise<CatalystEvent[]> {
    if (!this.apiKey) return [];

    const events: CatalystEvent[] = [];

    try {
      // Get splits for the past year and upcoming
      const fromDate = new Date();
      fromDate.setFullYear(fromDate.getFullYear() - 1);
      const toDate = new Date();
      toDate.setFullYear(toDate.getFullYear() + 1);

      const params = new URLSearchParams({
        symbol,
        from: fromDate.toISOString().split('T')[0],
        to: toDate.toISOString().split('T')[0],
        token: this.apiKey,
      });

      const response = await fetch(`${this.baseUrl}/stock/split?${params}`);

      if (!response.ok) {
        console.error(`[Finnhub] Stock split API error: ${response.status}`);
        return events;
      }

      const splits = (await response.json()) as FinnhubSplit[];

      for (const split of splits) {
        const isReverse = split.fromFactor > split.toFactor;
        const ratio = isReverse
          ? `${split.fromFactor}:${split.toFactor}`
          : `${split.toFactor}:${split.fromFactor}`;

        events.push({
          id: `finnhub-split-${symbol}-${split.date}`,
          symbol,
          eventType: isReverse ? 'reverse_split' : 'stock_split',
          date: split.date,
          isEstimate: false,
          title: isReverse ? 'Reverse Stock Split' : 'Stock Split',
          description: `${ratio} ${isReverse ? 'reverse ' : ''}split`,
          source: 'finnhub',
          metadata: {
            fromFactor: split.fromFactor,
            toFactor: split.toFactor,
            ratio,
          },
        });
      }

      console.log(`[Finnhub] Found ${events.length} split events for ${symbol}`);
    } catch (error) {
      console.error(`[Finnhub] Error fetching splits for ${symbol}:`, error);
    }

    return events;
  }

  /**
   * Get upcoming IPOs (not symbol-specific, returns all upcoming IPOs)
   * Can be used for market-wide IPO calendar
   */
  async getUpcomingIPOs(): Promise<CatalystEvent[]> {
    if (!this.apiKey) return [];

    const events: CatalystEvent[] = [];

    try {
      const fromDate = new Date();
      const toDate = new Date();
      toDate.setMonth(toDate.getMonth() + 3); // Next 3 months

      const params = new URLSearchParams({
        from: fromDate.toISOString().split('T')[0],
        to: toDate.toISOString().split('T')[0],
        token: this.apiKey,
      });

      const response = await fetch(`${this.baseUrl}/calendar/ipo?${params}`);

      if (!response.ok) {
        console.error(`[Finnhub] IPO calendar API error: ${response.status}`);
        return events;
      }

      const data = await response.json();
      const ipos = (data.ipoCalendar || []) as FinnhubIPO[];

      for (const ipo of ipos) {
        if (!ipo.symbol || !ipo.date) continue;

        events.push({
          id: `finnhub-ipo-${ipo.symbol}-${ipo.date}`,
          symbol: ipo.symbol,
          eventType: 'sec_filing', // Using sec_filing as closest match for IPO
          date: ipo.date,
          isEstimate: ipo.status !== 'priced',
          title: 'IPO',
          description: `${ipo.name} on ${ipo.exchange}${ipo.price ? ` at $${ipo.price}` : ''}`,
          source: 'finnhub',
          metadata: {
            exchange: ipo.exchange,
            status: ipo.status,
            price: ipo.price,
            shares: ipo.numberOfShares,
          },
        });
      }

      console.log(`[Finnhub] Found ${events.length} upcoming IPOs`);
    } catch (error) {
      console.error(`[Finnhub] Error fetching IPO calendar:`, error);
    }

    return events;
  }
}
