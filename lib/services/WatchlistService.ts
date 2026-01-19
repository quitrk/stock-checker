import { randomUUID } from 'crypto';
import { getCached, setCache, deleteCache, cacheKey } from './CacheService.js';
import { YahooFinanceProvider } from './providers/YahooFinanceProvider.js';
import type { Watchlist, WatchlistSummary, WatchlistStock, WatchlistWithStocks } from '../types/watchlist.js';
import type { ChecklistResult } from '../types/index.js';

const MAX_WATCHLISTS_PER_USER = 20;
const MAX_SYMBOLS_PER_WATCHLIST = 100;

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
    const uncachedSymbols: string[] = [];

    // First, check cache for each symbol
    for (const symbol of symbols) {
      const cached = await getCached<ChecklistResult>(cacheKey('checklist', symbol));
      if (cached && cached.priceChange !== undefined) {
        stocks.push({
          symbol: cached.symbol,
          companyName: cached.companyName,
          price: cached.price ?? 0,
          priceChange: cached.priceChange ?? 0,
          priceChangePercent: cached.priceChangePercent ?? 0,
        });
      } else {
        uncachedSymbols.push(symbol);
      }
    }

    // Batch fetch any symbols not in cache
    if (uncachedSymbols.length > 0) {
      console.log(`[Watchlist] Fetching ${uncachedSymbols.length} uncached symbols`);
      try {
        const quotes = await this.financeProvider.getMultipleQuotes(uncachedSymbols);
        for (const symbol of uncachedSymbols) {
          const data = quotes.get(symbol.toUpperCase());
          if (data) {
            stocks.push({
              symbol: data.symbol,
              companyName: data.companyName,
              price: data.price,
              priceChange: data.priceChange,
              priceChangePercent: data.priceChangePercent,
            });
          } else {
            // Symbol not found, add placeholder
            stocks.push({
              symbol,
              companyName: symbol,
              price: 0,
              priceChange: 0,
              priceChangePercent: 0,
            });
          }
        }
      } catch (error) {
        console.error(`[Watchlist] Error fetching quotes:`, error);
        // Add placeholders for failed symbols
        for (const symbol of uncachedSymbols) {
          stocks.push({
            symbol,
            companyName: symbol,
            price: 0,
            priceChange: 0,
            priceChangePercent: 0,
          });
        }
      }
    }

    // Sort stocks to match original symbol order
    const symbolOrder = new Map(symbols.map((s, i) => [s.toUpperCase(), i]));
    stocks.sort((a, b) => {
      const orderA = symbolOrder.get(a.symbol.toUpperCase()) ?? 999;
      const orderB = symbolOrder.get(b.symbol.toUpperCase()) ?? 999;
      return orderA - orderB;
    });

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
}
