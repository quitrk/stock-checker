import type { ChecklistResult } from '../../lib/types/index.js';

const API_BASE = '/api';

export async function getStockChecklist(symbol: string): Promise<ChecklistResult> {
  const url = `${API_BASE}/checklist/${symbol}`;

  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get stock checklist');
  }

  return response.json();
}
