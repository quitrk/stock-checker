import { Hono } from 'hono';
import { WatchlistService } from '../services/WatchlistService.js';
import { CatalystService } from '../services/CatalystService.js';
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
watchlist.get('/:id', async (c) => {
  const { id } = c.req.param();
  const result = await watchlistService.getWatchlistWithStocks(id);

  if (!result) {
    return c.json({ error: 'Watchlist not found' }, 404);
  }

  // Check if current user owns this watchlist
  const user = await getAuthUser(c);
  const isOwner = user?.id === result.userId;
  const isSystem = result.userId === SYSTEM_USER_ID;

  return c.json({
    watchlist: { ...result, isSystem },
    isOwner,
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
