# Tasks: Session Persistence

**Input**: Design documents from `/specs/015-session-persistence/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/proxy.md](./contracts/proxy.md)

**Tests**: No test framework is installed in this application — a standing constitution constraint
(`TODO(TESTING_STANDARD)`). No test-file tasks appear below. Verification is `npm run lint`,
`npx tsc --noEmit`, `npm run build`, and the manual passes in [quickstart.md](./quickstart.md).

**Cross-repo dependency**: T003 depends on `buildcore-api` being configured
`REFRESH_COOKIE_PATH=/bff/auth`. Without it every renewal fails silently and the symptom is
indistinguishable from the bug being fixed.

---

## Phase 1: Foundational — the route everything else depends on

**No user story can be verified until these three are done.**

- [X] T001 Add the `/bff/:path*` rewrite to `next.config.ts`, with its destination from a
      server-side `API_ORIGIN` (default `http://localhost:3000`); no `NEXT_PUBLIC_` prefix, so the
      backend address never enters the client bundle (spec FR-003, FR-016; research §1, §7)
- [X] T002 Replace `API_URL` in `app/lib/config.ts` with the same-origin constant `'/bff'`, remove
      the `NEXT_PUBLIC_API_URL` read, and update `.env.local.example` to document `API_ORIGIN`
      instead (spec FR-012; Principle III — the prefix is defined once here)
- [X] T003 Record in the repository's deployment notes that the API must be configured
      `REFRESH_COOKIE_PATH=/bff/auth` and `REFRESH_COOKIE_SAMESITE=lax`, and why — without it the
      browser stores the credential at a path it will never send it back from (research §3)

---

## Phase 2: US1 — Staying signed in across a reload and a restart (P1)

**Goal**: The session survives page reloads and browser restarts, in every browser.

**Independent test**: Sign in, reload, close the browser, reopen — still signed in. Repeat in
Safari, which refuses third-party cookies by default and is where this reproduces most reliably.

- [X] T004 [US1] Point `app/lib/api/my-workspace.ts` line ~348 (salary slip PDF) at the
      same-origin `API_URL` (spec FR-012)
- [X] T005 [P] [US1] Point both `app/lib/api/account-creation.ts` call sites (~178 invite, ~195
      set-password) at the same-origin `API_URL` — these are the **unauthenticated** flows and must
      keep working (spec FR-012, FR-014)
- [X] T006 [P] [US1] Point the custom fetch in `app/lib/api/hr-payroll.ts` (~line 108) at the
      same-origin `API_URL` (spec FR-012)
- [X] T007 [US1] `setSessionHint()` in `app/lib/session.ts`: drop the `rememberMe` parameter and
      always write a 90-day `max-age`. **The trap** — `SessionGuard` redirects to `/login`
      whenever the hint is absent, so a browser-session hint would evict a valid 90-day session on
      the next browser restart, reproducing the bug one layer up (spec FR-002; research §4)
- [X] T008 [P] [US1] Correct the stale comments in `app/lib/session.ts` and
      `app/ui/dashboard/session-guard.tsx` that describe `proxy.ts` and `middleware.ts` — neither
      file exists, and it is what made the hint look like dead code (research §4)
- [X] T009 [US1] Exclude `/bff` from precache and runtime caching in `app/sw.ts`; a cached
      session-bearing response would show one user's data to the next person on a shared phone
      (spec FR-015; research §6)

**Checkpoint**: quickstart Passes 1, 2, 3 and 6 should now hold. Pass 2 first — it is the
thirty-second check that catches a missing `REFRESH_COOKIE_PATH`.

---

## Phase 3: US2 — Working without interruption mid-session (P1)

**Goal**: Concurrent renewals produce exactly one call, and a flaky network never signs anyone out.

**Independent test**: Force several parallel requests to lapse together; confirm one renewal and no
redirect. Stop the API mid-session; confirm you stay signed in.

- [X] T010 [US2] Add a module-level in-flight promise to `app/lib/session.ts` so concurrent 401s
      share one `/bff/auth/refresh-token` call, cleared when it settles and shared by every waiter
      including on rejection (spec FR-007; research §5)
- [X] T011 [US2] Narrow the sign-out rule in `withAuth`: only an `ApiError` with status 401 from
      the renewal clears the session and navigates to `/login`. A network error, timeout or 5xx
      propagates to the caller unchanged — today every one of them logs the user out and discards
      whatever they were doing (spec FR-008; research §5)
- [X] T012 [US2] Use the backend's `code` on a refused renewal to choose the message —
      `SESSION_EXPIRED` reads as "your session expired", `SESSION_REVOKED` as a security event —
      branching on `code`, never on `message`, per the existing `PASSWORD_CHANGE_REQUIRED`
      precedent (spec FR-011; contracts/proxy.md)

**Checkpoint**: quickstart Passes 4 and 7 should now hold.

---

## Phase 4: US3 — Signing in without an unexplained choice (P2)

**Goal**: No "remember me" control; every session gets the full window.

**Independent test**: The sign-in page has no such checkbox, and the resulting session behaves as
US1 describes.

- [X] T013 [US3] Remove the checkbox, its `zod` field and its `defaultValues` entry from
      `app/ui/login-form.tsx` (spec FR-005)
- [X] T014 [US3] Drop `rememberMe` from the `login()` request body and its signature in
      `app/lib/api/auth.ts`, and update the `setSessionHint()` call to match T007. The API keeps
      accepting the field, so the two deployments may land in either order (spec FR-005, FR-006)

**Checkpoint**: quickstart Pass 9.

---

## Phase 5: US4 — Signing out still means signing out (P2)

**Goal**: Longer sessions must not weaken the only control the user has over ending one.

- [X] T015 [US4] Confirm `logout()` still clears the hint and the in-memory credential, and that
      `SessionGuard` still catches a bfcache restore after sign-out — the single-flight promise
      from T010 must also be discarded, or a renewal in flight during sign-out could repopulate
      the session (spec FR-010)

**Checkpoint**: quickstart Pass 8.

---

## Phase 6: Polish & verification

- [X] T016 [P] `npx tsc --noEmit` — this is also where a missed absolute-URL call surfaces, since
      `NEXT_PUBLIC_API_URL` no longer exists to compile against
- [X] T017 [P] `npm run lint` (expect the 2 pre-existing unused-var warnings in
      `account-creation.ts` and `assets.ts`; 0 errors)
- [X] T018 `npm run build` — expect 92 pages
- [ ] T019 Work quickstart Passes 1–10 in order, **including Pass 3 in Safari**. Chrome alone
      proves very little here: it is the browser in which the defect is least visible
- [ ] T020 [P] 320px spot-check of the sign-in form, which has lost a field (Principle VI)

---

## Dependencies

```
T001 ─┬─▶ T002 ─┬─▶ T004, T005, T006   (the five API_URL call sites)
      │         └─▶ T007 ─▶ T008
      └─▶ T003  (cross-repo config; blocks verification, not code)

T010 ─▶ T011 ─▶ T012
T010 ─▶ T015

T013 ─▶ T014
```

Phase 1 blocks everything. US1 and US2 are independent of each other and may be done in either
order. US3 and US4 are independent of both.

## Parallel opportunities

- T005, T006 — different files, no shared edits.
- T008 — comment-only, touches files others edit, so do it last within US1 or accept a conflict.
- T016, T017, T020 — independent checks.

T004, T007, T010, T011, T012 and T015 all touch `app/lib/session.ts` or files that import it in
sequence; they are **not** parallel despite belonging to different stories.

## MVP scope

**Phase 1 + Phase 2 (T001–T009)** is the minimum that fixes the reported defect for the 83% of
sign-ins that could never renew. Phase 3 fixes the remainder — the users whose browsers do
cooperate and who are being signed out mid-session — and is not optional in practice, only
separable.

---

## Implementation note — 2026-09-11

**T004, T005, T006 needed no code change.** Making `API_URL` the same-origin constant
`'/bff'` (T002) means every `${API_URL}/…` template in those three modules already
resolves against the page origin. Confirmed every consumer of `app/lib/api/*` is a
client component, so no relative URL is ever evaluated in Node, where it would throw.

**T019 and T020 are unchecked**: the Safari pass, the browser-restart pass and the 320px
spot-check need a real browser and are yours to run. Everything reachable from a shell
was verified, and that is a real limit — Safari is precisely where this defect is most
visible, so the fix is not *proven* until someone opens it there.

### Two things implementation turned up that the plan did not

**`API_ORIGIN` is a build-time variable, not a runtime one.** Next resolves `rewrites()`
during the build and writes the destination into `.next/routes-manifest.json`. My first
end-to-end attempt failed because the build had baked the default `localhost:3000` —
which reached a *stale* API and produced a confusing `rememberMe must be a boolean`.
Supplied only at runtime in production this would present as "login works, nothing else
does". `next.config.ts` now throws on a production build without it, so it cannot ship.

**The service worker's API-caching protection silently depended on the API being
cross-origin.** Its rule was `matcher: ({ sameOrigin }) => !sameOrigin`. Routing API
traffic through this app's own origin makes every call same-origin, so that rule stops
matching and `defaultCache`'s catch-all would have resumed caching authenticated
responses — reinstating the cross-user leakage its own comment warns about, as a side
effect of a change about cookies. The matcher now names `/bff` explicitly.

### Verified end to end, web on :3061 proxying to an API on :3060

```
POST /bff/auth/login            201
  Set-Cookie: Max-Age=7776000; Path=/bff/auth; HttpOnly; Secure; SameSite=Lax
  stored against the WEB origin — first-party, which is the whole fix
POST /bff/auth/refresh-token    201   (cookie returned automatically)
5 concurrent renewals           201 ×5, session alive afterwards
GET  /bff/users/me              200
GET  /bff/assets/export         200, 8259 bytes, valid xlsx — streamed, not buffered
production build, no API_ORIGIN → build fails with an explanatory error
```

tsc clean, lint 0 errors, build 92 pages.

---

## Post-ship defect — 2026-09-13

**The cross-repo dependency at the top of this file was never satisfied**, and the
feature reproduced the exact bug it fixed. `REFRESH_COOKIE_PATH` was unset on the API, so
the cookie was issued at `Path=/auth` while this app renews at `/bff/auth/refresh-token`.
The browser kept the credential and never sent it; every session ended on the first page
reload, landing on `/login?reason=SESSION_EXPIRED`.

The warning in this file's header was correct, specific, and insufficient — it needed
somebody to read it at the right moment, which is not a mechanism.

### T012 was marked done but was only half-built

`withAuth` put the reason in the URL and **nothing read it**. `app/login/page.tsx` took
only `activated` from `searchParams`, so a user whose session had just been refused got
the same unexplained sign-in form as anyone else. FR-011's requirement was satisfied on
the sending side and invisible on the receiving one — the only side the user sees. The
sign-in page now renders the reason, keyed on the code.

That gap also cost diagnosis time: the URL said `SESSION_EXPIRED`, which was itself a
misdiagnosis, because a missing cookie and a genuine expiry were the same bare 401.

### Changed

- `app/login/page.tsx` — reads `reason` and renders the matching message, `role="status"`
  so it is announced rather than silently present. An unrecognised value renders nothing,
  since the reason arrives in a URL anyone can type.
- `app/lib/session-codes.ts` (NEW) — the three codes as a dependency-free leaf module.
  The sign-in page is a Server Component; importing them from `session.ts` would pull the
  fetch client and the in-memory access token into a server module graph with no use for
  either. `session.ts` re-exports them, so no existing caller changed.
- `app/lib/session.ts` — handles `SESSION_COOKIE_MISSING`, and `console.error`s the likely
  cause. Loud in every environment on purpose: the browser cannot inspect an httpOnly
  cookie, so this is the only place the fault can be named at all, and its symptom is
  precisely the one people hunt for in session code that is working correctly.
- `app/lib/constants.ts` — the three messages, per Principle III.

`npx tsc --noEmit` clean; `npm run lint` 0 errors (2 pre-existing warnings);
`npm run build` passes, `/login` now correctly dynamic since it reads `searchParams`.

**T019 and T020 remain unchecked** — still no browser. Pass 2 (check the cookie's `Path`
in DevTools) would have caught this defect in about thirty seconds, which is the strongest
argument yet for working the manual passes rather than deferring them.
