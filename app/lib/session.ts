import {
  apiFetch,
  apiFetchBlob,
  apiFetchFile,
  ApiError,
  type StoredFile,
} from './api/client';
import { SESSION_COOKIE_MISSING, SESSION_EXPIRED, SESSION_REVOKED } from './session-codes';
import { ROUTES } from './constants';

/** The backend's code for "this account must change its password first"
 * (010 FR-017a). Matched on the code, never the message. */
export const PASSWORD_CHANGE_REQUIRED = 'PASSWORD_CHANGE_REQUIRED';

/**
 * Why the backend refused to renew a session (015 FR-011).
 *
 * Defined in `session-codes.ts` — a leaf module with no imports — and re-exported here
 * so existing callers are unaffected. The sign-in page is a Server Component and needs
 * the same constants without dragging the fetch client along with them.
 */
export {
  SESSION_EXPIRED,
  SESSION_REVOKED,
  SESSION_COOKIE_MISSING,
} from './session-codes';

/** Carried to /login so the page can say why, rather than showing a bare form. */
const SESSION_ENDED_REASON_KEY = 'reason';

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

// A readable, identity-free marker that *a* session exists. The real refresh
// credential is httpOnly and this app can never see it, so `SessionGuard` uses this
// instead to catch a dashboard page restored from the back/forward cache after a
// sign-out — a check no server round-trip can perform, because there is no round trip.
//
// It carries no identity and is not enforcement; the backend re-validates every
// request (001 FR-010).
const SESSION_HINT_COOKIE = 'session_hint';

/**
 * How long the hint lives. Must track the session, not the browser window.
 *
 * This used to be a browser-session cookie whenever "remember me" was unticked. With
 * that checkbox gone and sessions lasting 90 days, leaving it that way would mean a
 * perfectly valid session paired with a hint that evaporates overnight — and
 * `SessionGuard`, which redirects whenever the hint is missing, would bounce the user
 * to /login on their next morning's first visit. The reported bug, reappearing one
 * layer above where it was fixed, and invisible to any test that does not restart the
 * browser (015 FR-002).
 */
const SESSION_HINT_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

export function setSessionHint() {
  if (typeof document === 'undefined') return;
  document.cookie =
    `${SESSION_HINT_COOKIE}=1; path=/; ` +
    `max-age=${SESSION_HINT_MAX_AGE_SECONDS}; samesite=lax`;
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

/**
 * `authFetchBlob` for a stored document, keeping the name the server gave it.
 *
 * Use this wherever the file is one a person uploaded. `authFetchBlob` is still right for a
 * report the app names itself, where the server's name is not the interesting one.
 */
export async function authFetchFile(
  path: string,
  init?: RequestInit,
): Promise<StoredFile> {
  return withAuth(path, init, apiFetchFile);
}

/**
 * The renewal currently in flight, if any (015 FR-007).
 *
 * A screen that loads several panels discovers the lapsed access token in all of them
 * at once, and each used to call the refresh endpoint independently — six requests
 * presenting the same credential. The backend then has to decide whether that is one
 * client or a thief, and its tolerance window got it wrong often enough to destroy five
 * production sessions. Issuing exactly one renewal removes the ambiguity at source
 * rather than asking the backend to be cleverer about it.
 *
 * Every waiter shares the same promise, so all of them see the same outcome — including
 * the same rejection, which is what keeps the failure handling in `withAuth` consistent
 * across a burst.
 */
let refreshInFlight: Promise<string> | null = null;

function refreshOnce(): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const { refreshToken } = await import('./api/auth');
      return refreshToken();
    })();
    // Cleared however it settles: a failed renewal must not pin a rejected promise
    // that every later request would then inherit forever.
    refreshInFlight.finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

/** Discards any in-flight renewal, so a sign-out cannot be undone by one that was
 * already on its way (015 FR-010). */
export function abandonRefresh() {
  refreshInFlight = null;
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
      const newToken = await refreshOnce();
      return await run(path, withAuthHeader(newToken));
    } catch (refreshErr) {
      // Only a refusal ends the session (015 FR-008). Previously *any* thrown error
      // did — including a dropped connection — so a user in a lift was signed out and
      // lost whatever they were typing. A network failure means "try again", not
      // "you are no longer who you said you were".
      if (!(refreshErr instanceof ApiError) || refreshErr.status !== 401) {
        throw refreshErr;
      }
      clearSession();
      // The hint must go too, not just the in-memory token: SessionGuard treats its
      // presence as "a session exists", so a stale one left behind would keep
      // redirecting the user back into a shell they can no longer load.
      clearSessionHint();
      abandonRefresh();
      if (typeof window !== 'undefined') {
        // Deliberately a full document navigation, not router.push(): the session
        // has just been invalidated, and a client-side transition would keep the
        // React tree — and every react-query cache entry holding the previous
        // user's data — alive across the "logout". Reloading guarantees the next
        // user starts from a clean process.
        // The reason travels with the redirect so the sign-in page can explain
        // itself. A user returning after three months should be told their session
        // expired, not shown an unexplained form (015 FR-011).
        const reason =
          refreshErr.code === SESSION_REVOKED ||
          refreshErr.code === SESSION_COOKIE_MISSING
            ? refreshErr.code
            : SESSION_EXPIRED;
        if (reason === SESSION_COOKIE_MISSING) {
          // Loud on purpose, and in every environment. The browser cannot read an
          // httpOnly cookie to check its attributes, so this is the only place the
          // fault can be named at all — and its symptom (signed out on refresh) is
          // precisely the one people spend an afternoon looking for in session code.
          console.error(
            '[session] The API received no refresh cookie. This is usually a cookie ' +
              'Path that does not cover /bff/auth (set REFRESH_COOKIE_PATH=/bff/auth ' +
              'on buildcore-api), or a Secure cookie on a plain-HTTP origin. Check ' +
              'Application \u2192 Cookies in DevTools.',
          );
        }
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = `/login?${SESSION_ENDED_REASON_KEY}=${reason}`;
      }
      throw refreshErr;
    }
  }
}
