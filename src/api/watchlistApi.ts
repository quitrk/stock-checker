import type { Watchlist, WatchlistSummary, WatchlistWithStocks } from '../../lib/types/watchlist.js';
import type { CatalystEvent } from '../../lib/types/index.js';

const API_BASE = '/api/watchlist';

export async function getWatchlists(): Promise<WatchlistSummary[]> {
  const response = await fetch(API_BASE, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch watchlists');
  }

  const data = await response.json();
  return data.watchlists;
}

export async function getDefaultWatchlists(): Promise<WatchlistSummary[]> {
  const response = await fetch(`${API_BASE}/defaults`);

  if (!response.ok) {
    throw new Error('Failed to fetch default watchlists');
  }

  const data = await response.json();
  return data.watchlists;
}

export async function createWatchlist(name: string): Promise<Watchlist> {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to create watchlist');
  }

  const data = await response.json();
  return data.watchlist;
}

export async function getWatchlist(id: string, timestamp?: number): Promise<{ watchlist: WatchlistWithStocks; isOwner: boolean; comparisonDate: string | null }> {
  const url = timestamp ? `${API_BASE}/${id}?t=${timestamp}` : `${API_BASE}/${id}`;
  const response = await fetch(url, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch watchlist');
  }

  return response.json();
}

export async function updateWatchlist(id: string, name: string): Promise<Watchlist> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to update watchlist');
  }

  const data = await response.json();
  return data.watchlist;
}

export async function deleteWatchlist(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to delete watchlist');
  }
}

export async function addSymbol(watchlistId: string, symbol: string): Promise<Watchlist> {
  const response = await fetch(`${API_BASE}/${watchlistId}/symbols`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ symbol }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to add symbol');
  }

  const data = await response.json();
  return data.watchlist;
}

export async function removeSymbol(watchlistId: string, symbol: string): Promise<Watchlist> {
  const response = await fetch(`${API_BASE}/${watchlistId}/symbols/${encodeURIComponent(symbol)}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to remove symbol');
  }

  const data = await response.json();
  return data.watchlist;
}

export async function getWatchlistCatalysts(watchlistId: string): Promise<CatalystEvent[]> {
  const response = await fetch(`${API_BASE}/${watchlistId}/catalysts`);

  if (!response.ok) {
    throw new Error('Failed to fetch watchlist catalysts');
  }

  const data = await response.json();
  return data.catalysts;
}
