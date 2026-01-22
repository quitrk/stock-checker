import { useState, useCallback } from 'react';
import * as api from '../api/watchlistApi';
import type { Watchlist, WatchlistSummary, WatchlistWithStocks } from '../../lib/types/watchlist';

export interface UseWatchlistReturn {
  watchlists: WatchlistSummary[];
  defaultWatchlists: WatchlistSummary[];
  isLoading: boolean;
  error: string | null;
  activeWatchlist: WatchlistWithStocks | null;
  isOwner: boolean;
  fetchWatchlists: () => Promise<void>;
  fetchDefaultWatchlists: () => Promise<void>;
  createWatchlist: (name: string) => Promise<Watchlist>;
  deleteWatchlist: (id: string) => Promise<void>;
  renameWatchlist: (id: string, name: string) => Promise<void>;
  selectWatchlist: (id: string) => Promise<void>;
  clearActiveWatchlist: () => void;
  addSymbol: (watchlistId: string, symbol: string) => Promise<void>;
  removeSymbol: (watchlistId: string, symbol: string) => Promise<void>;
  reset: () => void;
}

export function useWatchlist(): UseWatchlistReturn {
  const [watchlists, setWatchlists] = useState<WatchlistSummary[]>([]);
  const [defaultWatchlists, setDefaultWatchlists] = useState<WatchlistSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeWatchlist, setActiveWatchlist] = useState<WatchlistWithStocks | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [cache, setCache] = useState<Map<string, WatchlistWithStocks>>(new Map());

  const fetchWatchlists = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getWatchlists();
      setWatchlists(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch watchlists');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchDefaultWatchlists = useCallback(async () => {
    try {
      const data = await api.getDefaultWatchlists();
      setDefaultWatchlists(data);
    } catch (err) {
      console.error('Failed to fetch default watchlists:', err);
    }
  }, []);

  const createWatchlist = useCallback(async (name: string): Promise<Watchlist> => {
    const created = await api.createWatchlist(name);
    setWatchlists(prev => [...prev, {
      id: created.id,
      name: created.name,
      symbols: [],
      updatedAt: created.updatedAt,
    }]);
    return created;
  }, []);

  const deleteWatchlist = useCallback(async (id: string) => {
    await api.deleteWatchlist(id);
    setWatchlists(prev => prev.filter(w => w.id !== id));
    if (activeWatchlist?.id === id) {
      setActiveWatchlist(null);
    }
  }, [activeWatchlist]);

  const renameWatchlist = useCallback(async (id: string, name: string) => {
    const updated = await api.updateWatchlist(id, name);
    setWatchlists(prev => prev.map(w =>
      w.id === id ? { ...w, name: updated.name, updatedAt: updated.updatedAt } : w
    ));
    if (activeWatchlist?.id === id) {
      setActiveWatchlist(prev => prev ? { ...prev, name: updated.name } : null);
    }
  }, [activeWatchlist]);

  const selectWatchlist = useCallback(async (id: string) => {
    // Check cache first
    const cached = cache.get(id);
    if (cached) {
      setActiveWatchlist(cached);
      setIsOwner(true);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const { watchlist, isOwner: owner } = await api.getWatchlist(id);
      setActiveWatchlist(watchlist);
      setIsOwner(owner);
      // Cache the result
      setCache(prev => new Map(prev).set(id, watchlist));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch watchlist');
    } finally {
      setIsLoading(false);
    }
  }, [cache]);

  const clearActiveWatchlist = useCallback(() => {
    setActiveWatchlist(null);
    setIsOwner(false);
  }, []);

  const addSymbol = useCallback(async (watchlistId: string, symbol: string) => {
    const updated = await api.addSymbol(watchlistId, symbol);
    setWatchlists(prev => prev.map(w =>
      w.id === watchlistId ? { ...w, symbols: updated.symbols, updatedAt: updated.updatedAt } : w
    ));
    // Invalidate cache for this watchlist
    setCache(prev => {
      const next = new Map(prev);
      next.delete(watchlistId);
      return next;
    });
    // Refresh active watchlist if it's the one being modified
    if (activeWatchlist?.id === watchlistId) {
      const { watchlist } = await api.getWatchlist(watchlistId);
      setActiveWatchlist(watchlist);
      setCache(prev => new Map(prev).set(watchlistId, watchlist));
    }
  }, [activeWatchlist]);

  const removeSymbol = useCallback(async (watchlistId: string, symbol: string) => {
    const updated = await api.removeSymbol(watchlistId, symbol);
    setWatchlists(prev => prev.map(w =>
      w.id === watchlistId ? { ...w, symbols: updated.symbols, updatedAt: updated.updatedAt } : w
    ));
    if (activeWatchlist?.id === watchlistId) {
      const updatedWatchlist = {
        ...activeWatchlist,
        symbols: updated.symbols,
        stocks: activeWatchlist.stocks.filter(s => updated.symbols.includes(s.symbol)),
      };
      setActiveWatchlist(updatedWatchlist);
      // Update cache
      setCache(prev => new Map(prev).set(watchlistId, updatedWatchlist));
    }
  }, [activeWatchlist]);

  const reset = useCallback(() => {
    setWatchlists([]);
    setActiveWatchlist(null);
    setIsOwner(false);
    setError(null);
    setCache(new Map());
  }, []);

  return {
    watchlists,
    defaultWatchlists,
    isLoading,
    error,
    activeWatchlist,
    isOwner,
    fetchWatchlists,
    fetchDefaultWatchlists,
    createWatchlist,
    deleteWatchlist,
    renameWatchlist,
    selectWatchlist,
    clearActiveWatchlist,
    addSymbol,
    removeSymbol,
    reset,
  };
}
