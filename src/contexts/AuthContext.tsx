import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getCurrentUser, logout as apiLogout, loginWithGoogle, loginWithGitHub } from '../api/authApi';
import type { User } from '../../lib/types/auth';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (provider: 'google' | 'github') => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const response = await getCurrentUser();
      setUser(response.user);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();

    // Check for auth errors in URL
    const params = new URLSearchParams(window.location.search);
    const authError = params.get('auth_error');
    if (authError) {
      window.history.replaceState({}, '', window.location.pathname);
      console.error('Auth error:', authError);
    }
  }, [checkAuth]);

  const login = useCallback((provider: 'google' | 'github') => {
    const returnTo = window.location.pathname;
    if (provider === 'google') {
      loginWithGoogle(returnTo);
    } else {
      loginWithGitHub(returnTo);
    }
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
