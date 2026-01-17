import { Hono } from 'hono';
import { ChecklistService } from '../services/ChecklistService.js';

const checklist = new Hono();
const checklistService = new ChecklistService();

checklist.get('/:symbol', async (c) => {
  const symbol = c.req.param('symbol');
  const skipCache = c.req.query('refresh') === 'true';

  try {
    const result = await checklistService.generateChecklist(symbol.toUpperCase(), skipCache);
    return c.json(result);
  } catch (error) {
    console.error(`[API] Error generating checklist for ${symbol}:`, error);
    return c.json({
      error: 'Failed to generate checklist',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

export default checklist;
