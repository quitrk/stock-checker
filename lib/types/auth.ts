export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  provider: 'google' | 'github' | 'apple';
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
  provider: 'google' | 'github' | 'apple';
  returnTo?: string;
  timestamp: number;
  platform?: 'web' | 'ios';
}

export interface AppleAuthRequest {
  identityToken: string;
  name?: string;
  email?: string;
}

export interface AuthResponse {
  user: User | null;
  isAuthenticated: boolean;
}
