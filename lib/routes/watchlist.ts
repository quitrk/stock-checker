import { Hono } from 'hono';
import { WatchlistService } from '../services/WatchlistService.js';
import { CatalystService } from '../services/CatalystService.js';
import { yahooFinance } from '../services/providers/YahooFinanceProvider.js';
import { getCached, setCache } from '../services/CacheService.js';
import { requireAuth, getAuthUser } from '../middleware/auth.js';
import { SYSTEM_USER_ID } from '../constants/system.js';

const watchlist = new Hono();
const watchlistService = new WatchlistService();

// Get all watchlists for current user (requires auth)
watchlist.get('/', requireAuth, async (c) => {
  const user = (await getAuthUser(c))!;
  const watchlists = await watchlistService.getUserWatchlists(user.id);
  return c.json({ watchlists });
});

// Create a new watchlist (requires auth)
watchlist.post('/', requireAuth, async (c) => {
  const user = (await getAuthUser(c))!;
  const body = await c.req.json();
  const { name } = body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return c.json({ error: 'Watchlist name is required' }, 400);
  }

  try {
    const created = await watchlistService.createWatchlist(user.id, name);
    return c.json({ watchlist: created }, 201);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Failed to create watchlist' }, 400);
  }
});

// Get default (system) watchlists - public endpoint
watchlist.get('/defaults', async (c) => {
  const defaults = await watchlistService.getSystemWatchlists();
  return c.json({ watchlists: defaults });
});

// Get a single watchlist with stock data (public)
// Optional ?t=<timestamp> param to show price changes since that date
watchlist.get('/:id', async (c) => {
  const { id } = c.req.param();
  const timestampParam = c.req.query('t');
  const result = await watchlistService.getWatchlistWithStocks(id);

  if (!result) {
    return c.json({ error: 'Watchlist not found' }, 404);
  }

  // Check if current user owns this watchlist
  const user = await getAuthUser(c);
  const isOwner = user?.id === result.userId;
  const isSystem = result.userId === SYSTEM_USER_ID;

  let comparisonDate: string | null = null;

  // If timestamp provided, add historical price data
  if (timestampParam) {
    const timestamp = parseInt(timestampParam, 10);
    if (!isNaN(timestamp)) {
      const targetDate = new Date(timestamp * 1000);
      comparisonDate = targetDate.toISOString().split('T')[0];

      // Cache key for this watchlist + timestamp combo
      const cacheKey = `watchlist-historical:${id}:${timestamp}`;
      let historicalPrices = await getCached<Record<string, number>>(cacheKey);

      if (!historicalPrices) {
        // Fetch historical data for all symbols
        const daysDiff = Math.ceil((Date.now() - targetDate.getTime()) / (1000 * 60 * 60 * 24)) + 5;
        historicalPrices = {};

        for (const stock of result.stocks) {
          try {
            const bars = await yahooFinance.getHistoricalData(stock.symbol, daysDiff);
            // Find bar closest to target date (on or before)
            const targetDateStr = comparisonDate;
            const historicalBar = bars
              .filter(bar => bar.date <= targetDateStr)
              .sort((a, b) => b.date.localeCompare(a.date))[0];
            if (historicalBar) {
              historicalPrices[stock.symbol] = historicalBar.close;
            }
          } catch (error) {
            console.error(`[Watchlist] Error fetching historical data for ${stock.symbol}:`, error);
          }
        }

        // Cache with no expiration (TTL 0)
        console.log(`[Watchlist] Caching historical prices for ${Object.keys(historicalPrices).length} symbols with key: ${cacheKey}`);
        await setCache(cacheKey, historicalPrices, 0);
      }

      // Add historical data to stocks
      for (const stock of result.stocks) {
        const historicalPrice = historicalPrices[stock.symbol];
        if (historicalPrice != null) {
          stock.historicalPrice = historicalPrice;
          stock.historicalChangePercent = ((stock.price - historicalPrice) / historicalPrice) * 100;
        } else {
          stock.historicalPrice = null;
          stock.historicalChangePercent = null;
        }
      }
    }
  }

  return c.json({
    watchlist: { ...result, isSystem },
    isOwner,
    comparisonDate,
  });
});

// Get catalyst events for all symbols in a watchlist (public)
watchlist.get('/:id/catalysts', async (c) => {
  const { id } = c.req.param();
  const result = await watchlistService.getWatchlist(id);

  if (!result) {
    return c.json({ error: 'Watchlist not found' }, 404);
  }

  if (result.symbols.length === 0) {
    return c.json({ catalysts: [] });
  }

  const catalystService = new CatalystService();
  const catalysts = await catalystService.getCatalystEventsForSymbols(result.symbols);

  return c.json({ catalysts });
});

// Update watchlist name (requires auth + ownership)
watchlist.put('/:id', requireAuth, async (c) => {
  const user = (await getAuthUser(c))!;
  const { id } = c.req.param();
  const body = await c.req.json();
  const { name } = body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return c.json({ error: 'Watchlist name is required' }, 400);
  }

  const updated = await watchlistService.updateWatchlist(id, user.id, name);
  if (!updated) {
    return c.json({ error: 'Watchlist not found or access denied' }, 404);
  }

  return c.json({ watchlist: updated });
});

// Delete a watchlist (requires auth + ownership)
watchlist.delete('/:id', requireAuth, async (c) => {
  const user = (await getAuthUser(c))!;
  const { id } = c.req.param();

  const deleted = await watchlistService.deleteWatchlist(id, user.id);
  if (!deleted) {
    return c.json({ error: 'Watchlist not found or access denied' }, 404);
  }

  return c.json({ success: true });
});

// Add symbol to watchlist (requires auth + ownership)
watchlist.post('/:id/symbols', requireAuth, async (c) => {
  const user = (await getAuthUser(c))!;
  const { id } = c.req.param();
  const body = await c.req.json();
  const { symbol } = body;

  if (!symbol || typeof symbol !== 'string' || symbol.trim().length === 0) {
    return c.json({ error: 'Symbol is required' }, 400);
  }

  try {
    const updated = await watchlistService.addSymbol(id, user.id, symbol);
    if (!updated) {
      return c.json({ error: 'Watchlist not found or access denied' }, 404);
    }
    return c.json({ watchlist: updated });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Failed to add symbol' }, 400);
  }
});

// Remove symbol from watchlist (requires auth + ownership)
watchlist.delete('/:id/symbols/:symbol', requireAuth, async (c) => {
  const user = (await getAuthUser(c))!;
  const { id, symbol } = c.req.param();

  const updated = await watchlistService.removeSymbol(id, user.id, symbol);
  if (!updated) {
    return c.json({ error: 'Watchlist not found or access denied' }, 404);
  }

  return c.json({ watchlist: updated });
});

export default watchlist;
