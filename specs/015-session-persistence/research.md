# Phase 0 Research — Session Persistence

Six open questions, each with the alternative that was rejected and why.

---

## §1 — Proxy mechanism: `next.config` rewrite, or a route handler?

**Decision**: A `rewrites()` entry in `next.config.ts` mapping `/bff/:path*` to the API origin.
Not a catch-all route handler.

**Rationale**: A rewrite is proxying done by the platform. It streams the response body through
untouched, which is exactly what FR-013 requires of a 40 MB export — a route handler would have to
stream deliberately, and the obvious implementation (`await res.blob()`, then return it) buffers
the whole file in a serverless function's memory. It also forwards request and response headers,
including `Set-Cookie`, without anyone writing header-copying code that can subtly drop or
duplicate a header.

On Vercel a rewrite to an external origin is handled by the edge network rather than by invoking a
function per request, so it adds no cold start, no per-request function cost and no body-size
limit of its own.

The decisive property for this feature: the browser sees the response as coming from the
application's own origin, so a `Set-Cookie` carrying no `Domain` attribute is stored against that
origin. The credential becomes first-party by construction — which is the whole fix (FR-003).

**Alternatives considered**:
- *Catch-all route handler at `app/bff/[...path]/route.ts`.* Rejected: more code, a function
  invocation per API call, manual method/header/body forwarding, and a real risk of buffering
  large downloads. It buys control this feature does not need.
- *Both — rewrite for most paths, handler for auth.* Rejected as two mechanisms where one
  suffices, with the split itself becoming something to remember.

---

## §2 — Why `/bff` and not `/api`

**Decision**: The prefix is `/bff`.

**Rationale**: `app/api/**` is where Next.js expects the application's *own* route handlers to
live. Mounting a proxy at `/api` invites a future collision with a genuine local endpoint, and
makes "is this ours or the backend's?" a question a reader has to answer by inspection. `/bff`
collides with nothing and names what it is.

**Alternatives considered**: `/api` (collision risk above), `/backend` (longer, no benefit).

---

## §3 — The cookie path trap

**Decision**: The API is configured with `REFRESH_COOKIE_PATH=/bff/auth`. The proxy does **not**
rewrite `Set-Cookie`.

**Rationale**: This is the detail that decides whether the whole feature works, and it is easy to
miss. The API currently sets the credential with `Path=/auth`. Behind the proxy the browser sends
renewal requests to `/bff/auth/refresh-token`, and `/auth` is not a prefix of `/bff/auth` — so the
browser would store the cookie and then never send it back. The symptom would be *identical to
the bug being fixed*, which is how it would waste a day.

Ownership sits with the API (see the backend feature's research §4): a cookie's attributes belong
to whoever sets it, and having the proxy parse and re-serialise `Set-Cookie` attributes is a
well-known source of subtle breakage.

**Alternatives considered**:
- *Proxy rewrites `Path=`.* Rejected — string-surgery on a security header in the layer least
  equipped to reason about it.
- *`Path=/` so it always matches.* Rejected: the credential would ride on every request to the
  origin, including pages and assets, discarding the one cheap containment it has.

---

## §4 — `session_hint` must stop being a browser-session cookie

**Decision**: Keep the hint, and always write it with a 90-day `max-age`. `setSessionHint()` loses
its `rememberMe` parameter.

**Rationale**: This looked at first like dead code — its comments describe a `proxy.ts` and a
`middleware.ts`, neither of which exists. It is not dead: `app/ui/dashboard/session-guard.tsx`
reads it on mount and on `pageshow`, and redirects to `/login` when it is absent.

That makes it a trap. The hint is written today with **no** `max-age` whenever "remember me" is
unticked, which makes it a browser-session cookie that dies when the browser closes. Removing the
checkbox without changing this would leave every session with a 90-day credential and a hint that
evaporates overnight — and the guard would bounce a perfectly valid session to `/login` on the
next morning's first visit. The bug would appear fixed in testing and survive in the wild, one
layer up from where it was.

The stale comments are corrected in the same change, because they are what made it look
removable.

**Alternatives considered**:
- *Delete the hint and the guard.* Rejected: the guard defends against the back button restoring
  a rendered page from the bfcache after a sign-out, which no server-side check can cover. That is
  a real protection and FR-010 depends on it.
- *Have the guard ask the server instead.* Rejected: it runs on `pageshow` for a
  restored-from-cache page, where a round trip is exactly what it is trying to avoid needing.

---

## §5 — Single-flight renewal, and what a failure means

**Decision**: One module-level in-flight promise in `app/lib/session.ts`. Every caller that needs
a renewal awaits the same promise; it is cleared when it settles. Separately, only a renewal the
backend explicitly refuses signs the user out.

**Rationale**: The current code calls `refreshToken()` independently for every 401, so a screen
that fires six requests at the moment the working credential lapses makes six renewal calls with
the same credential. The backend then has to decide whether that is one client or a thief — and
its five-second tolerance has been getting that wrong. Making the client issue exactly one
renewal removes the ambiguity at source rather than asking the backend to be cleverer about it.
The backend's widened tolerance remains, for the cases the client cannot dedupe: two tabs, or a
retry after a dropped connection.

The failure half is a separate, quieter defect. Today *any* thrown error from the renewal —
including `TypeError: Failed to fetch` from a dropped connection — clears the session and performs
a hard navigation to `/login`. A user in a lift loses their session and whatever they were typing.
FR-008 makes the rule explicit: sign out only on a 401 from the renewal endpoint; let anything
else propagate to the caller as the error it is.

**Alternatives considered**:
- *A mutex/queue library.* Rejected: a shared promise is the whole of it, and a dependency for
  five lines would be worse than the five lines.
- *Retry the renewal on network failure.* Rejected for this feature: react-query already owns
  retry policy for the calls that want it, and putting a second retry loop underneath it would
  make failures take unboundedly long to surface.

---

## §6 — Service worker must not cache `/bff`

**Decision**: Exclude `/bff/*` from both precache and runtime caching in `app/sw.ts`.

**Rationale**: The worker precaches 248 URLs so the Punch screen opens without connectivity. A
session-bearing API response must never be among them: a cached `/bff/users/me` would serve one
user's identity to the next person on a shared phone, and a cached 401 would strand a user who is
genuinely signed in. FR-015 exists for this.

The precache manifest is built from the prerendered output and would not naturally include a
rewrite target, so this is mostly a guard against a future runtime-caching rule being written with
a pattern broad enough to catch it. Being explicit costs one entry and removes the possibility.

**Alternatives considered**:
- *Rely on it not matching by accident.* Rejected: the cost of being wrong is cross-user data
  exposure, which is not a thing to leave to a pattern that nobody has been asked to keep narrow.

---

## §7 — `API_URL` and local development

**Decision**: `API_URL` becomes the constant `'/bff'` — a same-origin path, not an absolute URL.
`NEXT_PUBLIC_API_URL` is retired from the browser bundle; the rewrite's destination comes from a
**server-side** `API_ORIGIN` (default `http://localhost:3000`).

**Rationale**: Once every call is same-origin, the browser has no use for the backend's address,
and continuing to ship it in the client bundle would leave a second way to reach the API that
bypasses the proxy — which is precisely how FR-012 gets violated by the next person adding a
call. Removing it makes the proxy the only route by construction rather than by discipline.

Local development needs nothing special: the browser talks to `localhost:3001`, the rewrite
forwards to `localhost:3000` from the server side, and the request is same-origin in development
exactly as it is in production. One code path, no environment branching.

**Alternatives considered**:
- *Keep `NEXT_PUBLIC_API_URL` and point it at `/bff`.* Rejected: a public env var that must hold
  one specific literal is a constant wearing a costume, and a misconfigured deploy would silently
  restore the third-party cookie.
