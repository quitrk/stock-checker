import type { AuthResponse } from '../../lib/types/auth.js';

const API_BASE = '/api/auth';

export async function getCurrentUser(): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/me`, {
    credentials: 'include',
  });

  if (!response.ok) {
    return { user: null, isAuthenticated: false };
  }

  return response.json();
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE}/logout`, {
    method: 'POST',
    credentials: 'include',
  });
}

export function loginWithGoogle(returnTo?: string): void {
  const params = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : '';
  window.location.href = `${API_BASE}/google${params}`;
}

export function loginWithGitHub(returnTo?: string): void {
  const params = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : '';
  window.location.href = `${API_BASE}/github${params}`;
}
