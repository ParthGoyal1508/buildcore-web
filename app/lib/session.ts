import { apiFetch, ApiError } from './api/client';

// In-memory only — never localStorage/sessionStorage (research.md §2). Lost on
// hard refresh; re-obtained via the httpOnly refresh cookie.
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function clearSession() {
  accessToken = null;
}

// The real refresh-token cookie lives on buildcore-api's own origin
// (httpOnly, path=/auth) and is never visible to this app or its
// middleware — cross-origin cookies aren't shared between the frontend and
// backend deployments. This is a separate, non-sensitive same-origin marker
// middleware.ts can actually see, so it can redirect an obviously
// signed-out visitor away from /dashboard without flashing its shell first.
// It is a UX hint only; real enforcement is the backend re-validating the
// access token on every request (spec FR-010).
const SESSION_HINT_COOKIE = 'session_hint';

export function setSessionHint(rememberMe: boolean) {
  if (typeof document === 'undefined') return;
  const maxAge = rememberMe ? `; max-age=${30 * 24 * 60 * 60}` : '';
  document.cookie = `${SESSION_HINT_COOKIE}=1; path=/${maxAge}; samesite=lax`;
}

export function clearSessionHint() {
  if (typeof document === 'undefined') return;
  document.cookie = `${SESSION_HINT_COOKIE}=; path=/; max-age=0`;
}

/**
 * One-shot marker for "this navigation is a fresh login," so the dashboard
 * can show its welcome message on arrival but not on every later visit
 * (spec FR-006). Deliberately in-memory and identity-free: it says only
 * *that* a login just happened, never *who* — the name is always resolved
 * from the live session instead. Encoding the name in the URL (the earlier
 * approach) let a stale history entry render a previous user's name after a
 * logout-and-switch.
 */
let justLoggedIn = false;

export function markJustLoggedIn() {
  justLoggedIn = true;
}

/** Reads and clears in one step — a second call returns false. */
export function consumeJustLoggedIn(): boolean {
  const value = justLoggedIn;
  justLoggedIn = false;
  return value;
}

/**
 * Authenticated fetch wrapper: attaches the access token, and on a 401
 * transparently refreshes once and retries before giving up. On refresh
 * failure, clears the session and sends the user back to /login (spec edge
 * cases: expired access token mid-session, revoked/expired refresh token).
 */
export async function authFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const withAuthHeader = (token: string | null): RequestInit => ({
    ...init,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  try {
    return await apiFetch<T>(path, withAuthHeader(accessToken));
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) {
      throw err;
    }
    try {
      const { refreshToken } = await import('./api/auth');
      const newToken = await refreshToken();
      return await apiFetch<T>(path, withAuthHeader(newToken));
    } catch (refreshErr) {
      clearSession();
      // The hint cookie must go too, not just the in-memory token: proxy.ts
      // bounces /login → /dashboard whenever the hint is present, so leaving
      // a stale one behind here would trap the user in a redirect loop
      // between the two.
      clearSessionHint();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw refreshErr;
    }
  }
}
