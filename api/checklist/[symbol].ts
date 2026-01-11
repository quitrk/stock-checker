import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ChecklistService } from '../../lib/services/ChecklistService.js';
import type { ManualChecklistInput } from '../../lib/types/index.js';

const checklistService = new ChecklistService();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { symbol } = req.query;

  if (!symbol || typeof symbol !== 'string') {
    return res.status(400).json({ error: 'Symbol is required' });
  }

  try {
    let manualInput: ManualChecklistInput | undefined;

    if (req.method === 'POST' && req.body) {
      manualInput = req.body as ManualChecklistInput;
    }

    const result = await checklistService.generateChecklist(symbol.toUpperCase(), manualInput);
    return res.status(200).json(result);
  } catch (error) {
    console.error(`[API] Error generating checklist for ${symbol}:`, error);
    return res.status(500).json({
      error: 'Failed to generate checklist',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
