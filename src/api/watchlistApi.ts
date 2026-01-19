import type { Watchlist, WatchlistSummary, WatchlistWithStocks } from '../../lib/types/watchlist.js';

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

export async function getWatchlist(id: string): Promise<{ watchlist: WatchlistWithStocks; isOwner: boolean }> {
  const response = await fetch(`${API_BASE}/${id}`, {
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
