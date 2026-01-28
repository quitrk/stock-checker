import type { Context, Next } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { AuthService } from '../services/AuthService.js';
import type { User } from '../types/auth.js';

const authService = new AuthService();

const SESSION_COOKIE = 'stock_session';
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export function setSessionCookie(c: Context, sessionId: string): void {
  setCookie(c, SESSION_COOKIE, sessionId, {
    httpOnly: true,
    path: '/',
    sameSite: 'Lax',
    maxAge: SESSION_MAX_AGE,
    secure: process.env.NODE_ENV === 'production',
  });
}

export function getSessionId(c: Context): string | undefined {
  // Check X-Session-Token header first (for iOS), then fall back to cookie (for web)
  return c.req.header('X-Session-Token') || getCookie(c, SESSION_COOKIE);
}

export async function clearSession(c: Context): Promise<void> {
  const sessionId = getSessionId(c);
  if (sessionId) {
    await authService.deleteSession(sessionId);
  }
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
}

export async function getAuthUser(c: Context): Promise<User | null> {
  const sessionId = getSessionId(c);
  if (!sessionId) return null;
  return authService.getUserFromSession(sessionId);
}

// Middleware that attaches user to context (optional auth)
export async function optionalAuth(c: Context, next: Next) {
  const user = await getAuthUser(c);
  c.set('user', user);
  await next();
}

// Middleware that requires authentication
export async function requireAuth(c: Context, next: Next) {
  const user = await getAuthUser(c);

  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  c.set('user', user);
  await next();
}
