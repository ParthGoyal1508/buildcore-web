# Contract — the `/bff` route

## Shape

```
/bff/:path*   →   ${API_ORIGIN}/:path*
```

Declared as a `rewrites()` entry in `next.config.ts`. `API_ORIGIN` is a **server-side** variable
(no `NEXT_PUBLIC_` prefix) defaulting to `http://localhost:3000`.

Every call the application makes to the backend goes through it. `app/lib/config.ts` exports
`API_URL = '/bff'`, and the five modules that build request URLs use it. There is no other route:
`NEXT_PUBLIC_API_URL` is removed, so a call written against an absolute backend URL fails to
compile.

## What crosses it

| Direction | Carried | Note |
|---|---|---|
| → backend | method, path, query, headers, body | Untouched. No multipart exists in this application; bodies are JSON. |
| ← browser | status, headers, body | Streamed. `Set-Cookie` is forwarded verbatim. |

Because the response reaches the browser from the application's own origin, a `Set-Cookie` with no
`Domain` attribute is stored **first-party**. That is the entire point of the route.

## Required backend configuration

The API must set:

```
REFRESH_COOKIE_PATH=/bff/auth
```

Non-negotiable. The credential's path must match where the browser will present it. With the
default `/auth`, the browser stores the cookie and never sends it to `/bff/auth/refresh-token`,
and the resulting behaviour is **indistinguishable from the bug this feature fixes**.

`REFRESH_COOKIE_SAMESITE` should be `lax`; requests are same-origin through this route, so `none`
is no longer needed and is what made the cookie third-party.

## Renewal contract (client side)

- Concurrent requests discovering a lapsed working credential MUST produce **exactly one** call to
  `/bff/auth/refresh-token`; all waiters resolve from it.
- A renewal refused with **401** ends the session: clear state, clear the hint, navigate to
  `/login`.
- Any other failure — network error, 5xx, timeout — MUST NOT end the session. It propagates to the
  caller as an error.
- The backend distinguishes `SESSION_EXPIRED` from `SESSION_REVOKED` via the body `code`; both
  end the session, and the code selects the message shown.

## Caching

`/bff/*` MUST NOT be precached or runtime-cached by the service worker. A cached session-bearing
response would show one user's data to the next person using the device.
