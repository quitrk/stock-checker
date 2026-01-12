import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ChecklistService } from '../../lib/services/ChecklistService.js';

const checklistService = new ChecklistService();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { symbol } = req.query;

  if (!symbol || typeof symbol !== 'string') {
    return res.status(400).json({ error: 'Symbol is required' });
  }

  try {
    const skipCache = req.query.refresh === 'true';
    const result = await checklistService.generateChecklist(symbol, skipCache);
    return res.status(200).json(result);
  } catch (error) {
    console.error(`[API] Error generating checklist for ${symbol}:`, error);
    return res.status(500).json({
      error: 'Failed to generate checklist',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
