import type { SearchResult } from '../../lib/types/index.js';

export async function searchStocks(query: string, limit: number = 10): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  const url = `/api/search?q=${encodeURIComponent(query)}&limit=${limit}`;
  const response = await fetch(url);

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Too many requests. Please wait a moment.');
    }
    throw new Error('Search failed');
  }

  const data = await response.json();
  return data.results;
}
