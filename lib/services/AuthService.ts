import { createHash, randomUUID } from 'crypto';
import { getCached, setCache, deleteCache } from './CacheService.js';
import type { User, Session, OAuthState } from '../types/auth.js';

const SESSION_TTL = 30 * 24 * 60 * 60; // 30 days
const OAUTH_STATE_TTL = 300; // 5 minutes

export class AuthService {
  generateUserId(provider: string, providerId: string): string {
    return createHash('sha256')
      .update(`${provider}:${providerId}`)
      .digest('hex')
      .slice(0, 32);
  }

  async upsertUser(userData: Omit<User, 'id' | 'createdAt'>): Promise<User> {
    const id = this.generateUserId(userData.provider, userData.providerId);
    const existing = await getCached<User>(`user:${id}:profile`);

    const user: User = {
      id,
      ...userData,
      createdAt: existing?.createdAt || new Date().toISOString(),
    };

    await setCache(`user:${id}:profile`, user, 0);
    return user;
  }

  async getUser(userId: string): Promise<User | null> {
    return getCached<User>(`user:${userId}:profile`);
  }

  async createSession(userId: string): Promise<Session> {
    const session: Session = {
      id: randomUUID(),
      userId,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + SESSION_TTL * 1000).toISOString(),
    };

    await setCache(`session:${session.id}`, session, SESSION_TTL);
    return session;
  }

  async getSession(sessionId: string): Promise<Session | null> {
    return getCached<Session>(`session:${sessionId}`);
  }

  async deleteSession(sessionId: string): Promise<void> {
    await deleteCache(`session:${sessionId}`);
  }

  async getUserFromSession(sessionId: string): Promise<User | null> {
    const session = await this.getSession(sessionId);
    if (!session) return null;

    if (new Date(session.expiresAt) < new Date()) {
      await this.deleteSession(sessionId);
      return null;
    }

    return this.getUser(session.userId);
  }

  async createOAuthState(
    provider: 'google' | 'github',
    returnTo?: string,
    platform?: 'web' | 'ios'
  ): Promise<string> {
    const state = randomUUID();
    const data: OAuthState = { provider, timestamp: Date.now(), returnTo, platform };
    await setCache(`oauth_state:${state}`, data, OAUTH_STATE_TTL);
    return state;
  }

  async validateOAuthState(state: string, expectedProvider: string): Promise<OAuthState | null> {
    const data = await getCached<OAuthState>(`oauth_state:${state}`);
    if (!data || data.provider !== expectedProvider) return null;

    await deleteCache(`oauth_state:${state}`);
    return data;
  }
}
