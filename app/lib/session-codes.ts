/**
 * Machine-readable reasons the API gives for refusing to renew a session (015 FR-008).
 *
 * A dependency-free leaf module on purpose. These are needed by both the client-side
 * session machinery and the sign-in page, which is a Server Component — importing them
 * from `session.ts` would pull the fetch client and the in-memory token into a server
 * module graph that has no use for either.
 *
 * Always matched on the code, never on the message, so the backend's wording stays free
 * to change. Same contract as `PASSWORD_CHANGE_REQUIRED`.
 */

/** The credential is unknown, past its expiry, or already revoked. */
export const SESSION_EXPIRED = 'SESSION_EXPIRED';

/** Replay protection destroyed the session; the credential was presented too late. */
export const SESSION_REVOKED = 'SESSION_REVOKED';

/**
 * No session cookie reached the API at all.
 *
 * Distinct from an expiry, which means a credential *was* presented and refused. This
 * nearly always means a deployment fault — a cookie `Path` that does not cover
 * `/bff/auth`, or a `Secure` cookie on a plain-HTTP origin — and the browser cannot
 * inspect an httpOnly cookie to confirm it, so this code is the only signal available.
 */
export const SESSION_COOKIE_MISSING = 'SESSION_COOKIE_MISSING';
