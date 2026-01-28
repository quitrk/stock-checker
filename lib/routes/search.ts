import { Hono } from 'hono';
import { yahooFinance } from '../services/providers/YahooFinanceProvider.js';

const search = new Hono();

search.get('/', async (c) => {
  const query = c.req.query('q')?.trim();
  const limit = Math.min(parseInt(c.req.query('limit') || '10', 10), 20);

  if (!query || query.length < 1) {
    return c.json({ results: [] });
  }

  try {
    const results = await yahooFinance.searchSymbols(query, limit);
    return c.json({ results });
  } catch (error) {
    console.error(`[Search] Error searching for "${query}":`, error);
    return c.json({
      error: 'Search failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

export default search;
