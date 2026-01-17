export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  provider: 'google' | 'github';
  providerId: string;
  createdAt: string;
}

export interface Session {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface OAuthState {
  provider: 'google' | 'github';
  returnTo?: string;
  timestamp: number;
}

export interface AuthResponse {
  user: User | null;
  isAuthenticated: boolean;
}
