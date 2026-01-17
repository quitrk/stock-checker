import { Hono } from 'hono';
import { AuthService } from '../services/AuthService.js';
import { setSessionCookie, clearSession, getAuthUser } from '../middleware/auth.js';

const auth = new Hono();
const authService = new AuthService();

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

// Initiate Google OAuth
auth.get('/google', async (c) => {
  const returnTo = c.req.query('returnTo') || '/';
  const state = await authService.createOAuthState('google', returnTo);

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
    setSessionCookie(c, session.id);

    return c.redirect(stateData.returnTo || '/');
  } catch (err) {
    console.error('[Auth] Google callback error:', err);
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

export default auth;
