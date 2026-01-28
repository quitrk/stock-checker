import { Hono } from 'hono';
import * as jose from 'jose';
import { AuthService } from '../services/AuthService.js';
import { WatchlistService } from '../services/WatchlistService.js';
import { setSessionCookie, clearSession, getAuthUser } from '../middleware/auth.js';
import type { AppleAuthRequest } from '../types/auth.js';

const auth = new Hono();
const authService = new AuthService();
const watchlistService = new WatchlistService();

// Get current user
auth.get('/me', async (c) => {
  const user = await getAuthUser(c);
  return c.json({ user, isAuthenticated: !!user });
});

// Logout
auth.post('/logout', async (c) => {
  await clearSession(c);
  return c.json({ success: true });
});

// Delete account
auth.delete('/account', async (c) => {
  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    // Delete all user's watchlists
    await watchlistService.deleteAllUserWatchlists(user.id);

    // Delete user profile
    await authService.deleteUser(user.id);

    // Clear session
    await clearSession(c);

    console.log(`[Auth] Deleted account for user ${user.id} (${user.email})`);
    return c.json({ success: true });
  } catch (err) {
    console.error('[Auth] Delete account error:', err);
    return c.json({ error: 'Failed to delete account' }, 500);
  }
});

// Initiate Google OAuth
auth.get('/google', async (c) => {
  const returnTo = c.req.query('returnTo') || '/';
  const platform = c.req.query('platform') as 'web' | 'ios' | undefined;
  const state = await authService.createOAuthState('google', returnTo, platform);

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || '',
    redirect_uri: `${process.env.APP_URL}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
  });

  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

// Google OAuth callback
auth.get('/google/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');

  if (error) {
    return c.redirect('/?auth_error=access_denied');
  }

  if (!code || !state) {
    return c.redirect('/?auth_error=invalid_request');
  }

  const stateData = await authService.validateOAuthState(state, 'google');
  if (!stateData) {
    return c.redirect('/?auth_error=invalid_state');
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirect_uri: `${process.env.APP_URL}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenRes.json();
    if (!tokens.access_token) {
      throw new Error('Failed to get access token');
    }

    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const googleUser = await userRes.json();

    const user = await authService.upsertUser({
      email: googleUser.email,
      name: googleUser.name,
      avatar: googleUser.picture || null,
      provider: 'google',
      providerId: googleUser.id,
    });

    const session = await authService.createSession(user.id);

    // iOS: redirect to custom URL scheme with session ID
    if (stateData.platform === 'ios') {
      return c.redirect(`stockiqme://auth/callback?session=${session.id}&status=success`);
    }

    // Web: set cookie and redirect
    setSessionCookie(c, session.id);
    return c.redirect(stateData.returnTo || '/');
  } catch (err) {
    console.error('[Auth] Google callback error:', err);
    // iOS: redirect with error
    if (stateData?.platform === 'ios') {
      return c.redirect('stockiqme://auth/callback?status=error&error=server_error');
    }
    return c.redirect('/?auth_error=server_error');
  }
});

// Initiate GitHub OAuth
auth.get('/github', async (c) => {
  const returnTo = c.req.query('returnTo') || '/';
  const state = await authService.createOAuthState('github', returnTo);

  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID || '',
    redirect_uri: `${process.env.APP_URL}/api/auth/github/callback`,
    scope: 'user:email',
    state,
  });

  return c.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

// GitHub OAuth callback
auth.get('/github/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');

  if (error) {
    return c.redirect('/?auth_error=access_denied');
  }

  if (!code || !state) {
    return c.redirect('/?auth_error=invalid_request');
  }

  const stateData = await authService.validateOAuthState(state, 'github');
  if (!stateData) {
    return c.redirect('/?auth_error=invalid_state');
  }

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const tokens = await tokenRes.json();
    if (!tokens.access_token) {
      throw new Error('Failed to get access token');
    }

    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        'User-Agent': 'StockIQ',
      },
    });
    const githubUser = await userRes.json();

    let email = githubUser.email;
    if (!email) {
      const emailRes = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          'User-Agent': 'StockIQ',
        },
      });
      const emails = await emailRes.json();
      const primary = emails.find((e: { primary: boolean }) => e.primary);
      email = primary?.email || emails[0]?.email;
    }

    const user = await authService.upsertUser({
      email: email || `${githubUser.id}@github.local`,
      name: githubUser.name || githubUser.login,
      avatar: githubUser.avatar_url || null,
      provider: 'github',
      providerId: String(githubUser.id),
    });

    const session = await authService.createSession(user.id);
    setSessionCookie(c, session.id);

    return c.redirect(stateData.returnTo || '/');
  } catch (err) {
    console.error('[Auth] GitHub callback error:', err);
    return c.redirect('/?auth_error=server_error');
  }
});

// Apple Sign-In (iOS native)
auth.post('/apple', async (c) => {
  const { identityToken, name, email } = await c.req.json<AppleAuthRequest>();

  if (!identityToken) {
    return c.json({ error: 'Missing identity token' }, 400);
  }

  try {
    // Fetch Apple's public keys
    const JWKS = jose.createRemoteJWKSet(
      new URL('https://appleid.apple.com/auth/keys')
    );

    // Verify the JWT
    const { payload } = await jose.jwtVerify(identityToken, JWKS, {
      issuer: 'https://appleid.apple.com',
      audience: process.env.APPLE_BUNDLE_ID || 'stockiq.me.StockIQ',
    });

    // payload.sub is Apple's unique user ID (stable across sign-ins)
    const appleUserId = payload.sub;
    if (!appleUserId) {
      return c.json({ error: 'Invalid token: missing subject' }, 401);
    }

    // Email from token or from request (first sign-in only provides email in request)
    const userEmail = (payload.email as string) || email;
    if (!userEmail) {
      return c.json({ error: 'Email is required' }, 400);
    }

    // Create or update user
    const user = await authService.upsertUser({
      email: userEmail,
      name: name || userEmail.split('@')[0] || 'Apple User',
      avatar: null, // Apple doesn't provide avatar
      provider: 'apple',
      providerId: appleUserId,
    });

    // Create session
    const session = await authService.createSession(user.id);

    return c.json({ sessionId: session.id });
  } catch (err) {
    console.error('[Auth] Apple sign-in error:', err);

    if (err instanceof jose.errors.JWTExpired) {
      return c.json({ error: 'Token expired' }, 401);
    }
    if (err instanceof jose.errors.JWTClaimValidationFailed) {
      return c.json({ error: 'Invalid token claims' }, 401);
    }
    if (err instanceof jose.errors.JWSSignatureVerificationFailed) {
      return c.json({ error: 'Invalid token signature' }, 401);
    }

    return c.json({ error: 'Authentication failed' }, 500);
  }
});

export default auth;
