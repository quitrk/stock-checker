import { randomUUID } from 'crypto';
import { getCached, setCache, deleteCache } from './CacheService.js';
import { YahooFinanceProvider } from './providers/YahooFinanceProvider.js';
import { SYSTEM_USER_ID } from '../constants/system.js';
import type { Watchlist, WatchlistSummary, WatchlistStock, WatchlistWithStocks } from '../types/watchlist.js';

const MAX_WATCHLISTS_PER_USER = 20;
const MAX_SYMBOLS_PER_WATCHLIST = 100;

function getLogoUrl(symbol: string): string | null {
  const logoKitToken = process.env.LOGOKIT_TOKEN;
  return logoKitToken
    ? `https://img.logokit.com/ticker/${symbol.toUpperCase()}?token=${logoKitToken}`
    : null;
}

export class WatchlistService {
  private financeProvider = new YahooFinanceProvider();

  async createWatchlist(userId: string, name: string): Promise<Watchlist> {
    const userWatchlistIds = await getCached<string[]>(`user:${userId}:watchlists`) || [];

    if (userWatchlistIds.length >= MAX_WATCHLISTS_PER_USER) {
      throw new Error(`Maximum ${MAX_WATCHLISTS_PER_USER} watchlists allowed`);
    }

    const id = randomUUID();
    const now = new Date().toISOString();

    const watchlist: Watchlist = {
      id,
      userId,
      name: name.trim(),
      symbols: [],
      createdAt: now,
      updatedAt: now,
    };

    await setCache(`watchlist:${id}`, watchlist, 0);
    await setCache(`user:${userId}:watchlists`, [...userWatchlistIds, id], 0);

    console.log(`[Watchlist] Created watchlist "${name}" (${id}) for user ${userId}`);
    return watchlist;
  }

  async getUserWatchlists(userId: string): Promise<WatchlistSummary[]> {
    const watchlistIds = await getCached<string[]>(`user:${userId}:watchlists`) || [];

    const summaries: WatchlistSummary[] = [];
    for (const id of watchlistIds) {
      const watchlist = await getCached<Watchlist>(`watchlist:${id}`);
      if (watchlist) {
        summaries.push({
          id: watchlist.id,
          name: watchlist.name,
          symbols: watchlist.symbols,
          updatedAt: watchlist.updatedAt,
        });
      }
    }

    return summaries;
  }

  async getWatchlist(watchlistId: string): Promise<Watchlist | null> {
    return getCached<Watchlist>(`watchlist:${watchlistId}`);
  }

  async getWatchlistWithStocks(watchlistId: string): Promise<WatchlistWithStocks | null> {
    const watchlist = await this.getWatchlist(watchlistId);
    if (!watchlist) return null;

    // For system watchlists, use pre-cached stock data (no Yahoo API call)
    if (watchlist.userId === SYSTEM_USER_ID) {
      const cachedStocks = await getCached<WatchlistStock[]>(`system-watchlist:${watchlistId}:stocks`);
      return { ...watchlist, stocks: cachedStocks || [] };
    }

    const stocks = await this.getStocksData(watchlist.symbols);
    return { ...watchlist, stocks };
  }

  private async getOwnedWatchlist(watchlistId: string, userId: string): Promise<Watchlist | null> {
    const watchlist = await this.getWatchlist(watchlistId);
    if (!watchlist || watchlist.userId !== userId) {
      return null;
    }
    return watchlist;
  }

  async getStocksData(symbols: string[]): Promise<WatchlistStock[]> {
    if (symbols.length === 0) return [];

    const stocks: WatchlistStock[] = [];

    try {
      console.log(`[Watchlist] Fetching quotes for ${symbols.length} symbols`);
      const quotes = await this.financeProvider.getMultipleQuotes(symbols);

      for (const symbol of symbols) {
        const data = quotes.get(symbol.toUpperCase());
        if (data) {
          stocks.push({
            symbol: data.symbol,
            companyName: data.companyName,
            price: data.price,
            priceChange: data.priceChange,
            priceChangePercent: data.priceChangePercent,
            logoUrl: getLogoUrl(data.symbol),
          });
        } else {
          // Symbol not found, add placeholder
          stocks.push({
            symbol,
            companyName: symbol,
            price: 0,
            priceChange: 0,
            priceChangePercent: 0,
            logoUrl: getLogoUrl(symbol),
          });
        }
      }
    } catch (error) {
      console.error(`[Watchlist] Error fetching quotes:`, error);
      // Add placeholders for all symbols on error
      for (const symbol of symbols) {
        stocks.push({
          symbol,
          companyName: symbol,
          price: 0,
          priceChange: 0,
          priceChangePercent: 0,
          logoUrl: getLogoUrl(symbol),
        });
      }
    }

    // Sort stocks alphabetically by symbol
    stocks.sort((a, b) => a.symbol.localeCompare(b.symbol));

    return stocks;
  }

  async updateWatchlist(watchlistId: string, userId: string, name: string): Promise<Watchlist | null> {
    const watchlist = await this.getOwnedWatchlist(watchlistId, userId);
    if (!watchlist) return null;

    watchlist.name = name.trim();
    watchlist.updatedAt = new Date().toISOString();

    await setCache(`watchlist:${watchlistId}`, watchlist, 0);
    console.log(`[Watchlist] Updated watchlist ${watchlistId} name to "${name}"`);
    return watchlist;
  }

  async deleteWatchlist(watchlistId: string, userId: string): Promise<boolean> {
    const watchlist = await this.getOwnedWatchlist(watchlistId, userId);
    if (!watchlist) return false;

    await deleteCache(`watchlist:${watchlistId}`);

    const userWatchlistIds = await getCached<string[]>(`user:${userId}:watchlists`) || [];
    const updatedIds = userWatchlistIds.filter(id => id !== watchlistId);
    await setCache(`user:${userId}:watchlists`, updatedIds, 0);

    console.log(`[Watchlist] Deleted watchlist ${watchlistId}`);
    return true;
  }

  async addSymbol(watchlistId: string, userId: string, symbol: string): Promise<Watchlist | null> {
    const watchlist = await this.getOwnedWatchlist(watchlistId, userId);
    if (!watchlist) return null;

    const upperSymbol = symbol.toUpperCase().trim();

    if (watchlist.symbols.includes(upperSymbol)) {
      return watchlist;
    }

    if (watchlist.symbols.length >= MAX_SYMBOLS_PER_WATCHLIST) {
      throw new Error(`Maximum ${MAX_SYMBOLS_PER_WATCHLIST} symbols per watchlist`);
    }

    watchlist.symbols.push(upperSymbol);
    watchlist.updatedAt = new Date().toISOString();

    await setCache(`watchlist:${watchlistId}`, watchlist, 0);
    console.log(`[Watchlist] Added ${upperSymbol} to watchlist ${watchlistId}`);
    return watchlist;
  }

  async removeSymbol(watchlistId: string, userId: string, symbol: string): Promise<Watchlist | null> {
    const watchlist = await this.getOwnedWatchlist(watchlistId, userId);
    if (!watchlist) return null;

    const upperSymbol = symbol.toUpperCase().trim();
    const index = watchlist.symbols.indexOf(upperSymbol);

    if (index === -1) {
      return watchlist;
    }

    watchlist.symbols.splice(index, 1);
    watchlist.updatedAt = new Date().toISOString();

    await setCache(`watchlist:${watchlistId}`, watchlist, 0);
    console.log(`[Watchlist] Removed ${upperSymbol} from watchlist ${watchlistId}`);
    return watchlist;
  }

  // System watchlist methods (for default ETF watchlists)

  async getSystemWatchlists(): Promise<WatchlistSummary[]> {
    const systemWatchlistIds = await getCached<string[]>(`user:${SYSTEM_USER_ID}:watchlists`) || [];

    const summaries: WatchlistSummary[] = [];
    for (const id of systemWatchlistIds) {
      const watchlist = await getCached<Watchlist>(`watchlist:${id}`);
      if (watchlist) {
        summaries.push({
          id: watchlist.id,
          name: watchlist.name,
          symbols: watchlist.symbols,
          updatedAt: watchlist.updatedAt,
          isSystem: true,
        });
      }
    }

    return summaries;
  }

  async upsertSystemWatchlist(id: string, name: string, symbols: string[]): Promise<Watchlist> {
    const existing = await this.getWatchlist(id);
    const now = new Date().toISOString();

    const watchlist: Watchlist = {
      id,
      userId: SYSTEM_USER_ID,
      name,
      symbols,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      isSystem: true,
    };

    await setCache(`watchlist:${id}`, watchlist, 0);

    // Ensure watchlist is in system user's list
    const systemWatchlistIds = await getCached<string[]>(`user:${SYSTEM_USER_ID}:watchlists`) || [];
    if (!systemWatchlistIds.includes(id)) {
      await setCache(`user:${SYSTEM_USER_ID}:watchlists`, [...systemWatchlistIds, id], 0);
    }

    console.log(`[Watchlist] Upserted system watchlist "${name}" (${id}) with ${symbols.length} symbols`);
    return watchlist;
  }

  async setSystemWatchlistStocks(watchlistId: string, stocks: WatchlistStock[]): Promise<void> {
    await setCache(`system-watchlist:${watchlistId}:stocks`, stocks, 0);
    console.log(`[Watchlist] Cached ${stocks.length} stocks for system watchlist ${watchlistId}`);
  }
}
