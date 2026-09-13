# Quickstart — Session Persistence

Verification for this application is manual: no test framework is installed
(`TODO(TESTING_STANDARD)` in the constitution). These are the passes that actually prove the fix,
in the order worth doing them.

## Prerequisites

```bash
# API, in buildcore-api
REFRESH_COOKIE_PATH=/bff/auth SESSION_DAYS=90 npm run start:dev     # :3000

# Web, here
API_ORIGIN=http://localhost:3000 npm run dev                        # :3001
```

Sign in as `rajesh.kulkarni@parthrealcon.com` / `secret42`.

Static gates first: `npx tsc --noEmit`, `npm run lint`, `npm run build`.

## Pass 1 — Nothing reaches the backend directly (FR-012)

DevTools → Network, filter `localhost:3000`. Click through the dashboard, HR, inventory, plant,
recruitment, and `/my`.

**Expect**: no entries at all. Every request goes to `localhost:3001/bff/...`. A single
`localhost:3000` entry is a call that still builds an absolute URL, and its cookie is still
third-party.

## Pass 2 — The cookie is first-party and at the right path (FR-003, and the trap)

DevTools → Application → Cookies → `http://localhost:3001`.

**Expect** the refresh cookie listed under **3001**, not 3000, with **Path `/bff/auth`** and an
expiry ~90 days out.

If Path reads `/auth`, stop: `REFRESH_COOKIE_PATH` is not set on the API. Everything else will
appear to work and every renewal will fail silently — the original bug wearing a new hat. This
check takes thirty seconds and is the single highest-value line in this document.

## Pass 3 — Reload and restart (US1, SC-003, SC-004)

1. Reload the page. **Expect**: still signed in, same screen, no trip to `/login`.
2. Quit the browser completely, reopen, navigate to the app. **Expect**: still signed in.
3. **Repeat both in Safari.** This is the browser the defect reproduces in most reliably, so it is
   the one the fix has to be *seen* to work in. Testing only in Chrome proves little here.

## Pass 4 — Concurrency makes one renewal (US2, SC-005)

Open a dashboard page that loads several panels. In the console, drop the working credential to
force a simultaneous lapse:

```js
// Every in-flight query will 401 together on the next interaction.
```

Then trigger a refetch (switch tabs and back, or use react-query devtools).

**Expect** in Network: exactly **one** `POST /bff/auth/refresh-token`, every other request
succeeding on retry, and no navigation to `/login`. Several renewal calls means single-flight is
not wired in; a redirect to `/login` means the backend destroyed the family.

## Pass 5 — Downloads still stream (FR-013)

Download a salary slip from `/my`, an asset document, and the largest export available
(Activity Log or Assets).

**Expect**: each arrives intact and opens. This is the pass that would catch a proxy
implementation that buffers a whole file before returning it.

## Pass 6 — Offline field surface still works (Principle VI)

On `/my/punch`, with DevTools set to Offline:

1. The screen still opens from the service-worker cache.
2. Submit a punch — it queues.
3. Go back online; the queue drains and the punch is accepted.

**Expect** also, in Application → Cache Storage: **no** `/bff/*` entries (FR-015).

## Pass 7 — A flaky network does not sign you out (FR-008)

With the app open and signed in, stop the API process. Interact until a request fails.

**Expect**: an error state on the screen, and **you remain signed in**. Restart the API and carry
on working without re-authenticating.

Before this feature, this logged the user out and hard-navigated to `/login`, discarding anything
unsaved. That is the behaviour being removed.

## Pass 8 — Signing out still works (US4)

Sign out. Press the browser Back button.

**Expect**: `/login`, not a restored dashboard — `SessionGuard` catches the bfcache restore. Then
confirm no previous-user data is visible anywhere.

## Pass 9 — No checkbox (US3)

The sign-in page has no "remember me" control, and the session that results behaves as Pass 3
describes.

## Pass 10 — 320px spot-check

The sign-in form lost a field; confirm its layout still holds at 320px (Principle VI — sign-in is
reachable from the mobile-critical surfaces).
