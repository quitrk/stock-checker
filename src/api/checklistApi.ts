import type { ChecklistResult } from '../types';

const API_BASE = '/api';

export async function getStockChecklist(symbol: string, refresh = false): Promise<ChecklistResult> {
  const url = refresh
    ? `${API_BASE}/checklist/${symbol}?refresh=true`
    : `${API_BASE}/checklist/${symbol}`;

  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get stock checklist');
  }

  return response.json();
}
