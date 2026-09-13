/**
 * Where this app sends its backend requests (015 FR-003, FR-012).
 *
 * A same-origin path, not an absolute URL. Requests go to this app's own origin and
 * `next.config.ts` rewrites `/bff/*` to buildcore-api server-side, so the browser only
 * ever talks to one host.
 *
 * That is the whole fix for the session defect. When the browser talked to the API
 * directly, the refresh cookie was set against a different registrable domain — third-
 * party data, which Safari refuses outright and Chrome is withdrawing. 83% of sign-ins
 * could never be renewed as a result: the session died the moment its 15-minute access
 * token lapsed, and on every page reload. Arriving over this app's own origin, the
 * cookie is first-party by construction.
 *
 * `NEXT_PUBLIC_API_URL` is deliberately gone rather than repointed here. With no
 * backend address in the client bundle, a call written against an absolute URL fails to
 * compile — so "everything goes through the proxy" is a property of the build rather
 * than a rule people have to remember. The rewrite's own destination is the
 * server-side `API_ORIGIN`, which never reaches the browser.
 */
export const API_URL = '/bff';
