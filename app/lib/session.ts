import { apiFetch, apiFetchBlob, ApiError } from './api/client';
import { ROUTES } from './constants';

/** The backend's code for "this account must change its password first"
 * (010 FR-017a). Matched on the code, never the message. */
export const PASSWORD_CHANGE_REQUIRED = 'PASSWORD_CHANGE_REQUIRED';

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
  return withAuth(path, init, apiFetch<T>);
}

/**
 * `authFetch` for an endpoint that serves a file rather than JSON.
 *
 * Shares the refresh-and-retry path below rather than repeating it: an expired
 * token has to be renewed the same way whatever the response body turns out to be.
 */
export async function authFetchBlob(
  path: string,
  init?: RequestInit,
): Promise<Blob> {
  return withAuth(path, init, apiFetchBlob);
}

async function withAuth<T>(
  path: string,
  init: RequestInit | undefined,
  run: (path: string, init?: RequestInit) => Promise<T>,
): Promise<T> {
  const withAuthHeader = (token: string | null): RequestInit => ({
    ...init,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  try {
    return await run(path, withAuthHeader(accessToken));
  } catch (err) {
    // The account owes a forced password change (010 FR-017a). Routed here rather
    // than handled per-caller: every screen can hit this, and the only useful
    // response from any of them is the same one. Branching on the code, never the
    // message, so the backend's wording stays free to change.
    if (
      err instanceof ApiError &&
      err.status === 403 &&
      err.code === PASSWORD_CHANGE_REQUIRED &&
      typeof window !== 'undefined' &&
      window.location.pathname !== ROUTES.changePassword
    ) {
      window.location.href = ROUTES.changePassword;
    }
    if (!(err instanceof ApiError) || err.status !== 401) {
      throw err;
    }
    try {
      const { refreshToken } = await import('./api/auth');
      const newToken = await refreshToken();
      return await run(path, withAuthHeader(newToken));
    } catch (refreshErr) {
      clearSession();
      // The hint cookie must go too, not just the in-memory token: proxy.ts
      // bounces /login → /dashboard whenever the hint is present, so leaving
      // a stale one behind here would trap the user in a redirect loop
      // between the two.
      clearSessionHint();
      if (typeof window !== 'undefined') {
        // Deliberately a full document navigation, not router.push(): the session
        // has just been invalidated, and a client-side transition would keep the
        // React tree — and every react-query cache entry holding the previous
        // user's data — alive across the "logout". Reloading guarantees the next
        // user starts from a clean process.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = '/login';
      }
      throw refreshErr;
    }
  }
}
