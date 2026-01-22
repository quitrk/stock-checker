import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useWatchlist, UseWatchlistReturn } from '../hooks/useWatchlist';

interface AppContextType {
  watchlist: UseWatchlistReturn;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const watchlist = useWatchlist();

  // Fetch watchlists when user logs in, reset when they log out
  useEffect(() => {
    if (isAuthenticated) {
      watchlist.fetchWatchlists();
      watchlist.fetchDefaultWatchlists();
    } else {
      watchlist.reset();
    }
  }, [isAuthenticated]);

  return (
    <AppContext.Provider value={{ watchlist }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
