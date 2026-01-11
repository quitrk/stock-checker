import type { ChecklistResult, ManualChecklistInput } from '../types';

const API_BASE = '/api';

export async function getStockChecklist(
  symbol: string,
  manualInput?: ManualChecklistInput
): Promise<ChecklistResult> {
  if (manualInput && Object.keys(manualInput).length > 0) {
    const response = await fetch(`${API_BASE}/checklist/${symbol}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(manualInput),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get stock checklist');
    }

    return response.json();
  }

  const response = await fetch(`${API_BASE}/checklist/${symbol}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get stock checklist');
  }

  return response.json();
}
