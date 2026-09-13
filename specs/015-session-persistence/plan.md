# Implementation Plan: Session Persistence

**Branch**: `015-session-persistence` | **Date**: 2026-09-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/015-session-persistence/spec.md`

## Summary

The browser is asked to keep the session's renewal credential against the backend's domain while
the user is on the application's, so most browsers refuse it and 83% of sign-ins could never be
renewed. This plan routes every backend request through the application's own origin, which makes
the credential first-party by construction; deduplicates concurrent renewals so the backend stops
mistaking one client for a thief; and removes the stay-signed-in checkbox.

No new dependency. One `next.config.ts` entry, one constant, and edits to five API modules, the
session module, the sign-in form and the service worker.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19, Next.js 16 (App Router, Turbopack)

**Primary Dependencies**: `@tanstack/react-query`, `zod`, `react-hook-form`, `@serwist/next`.
Nothing new.

**Storage**: None in this application. The session credential is a cookie the browser holds and
page scripts cannot read; that property is preserved (FR-017).

**Testing**: No framework is installed — a standing constitution constraint,
`TODO(TESTING_STANDARD)`. Verification is `npm run lint`, `npx tsc --noEmit`, `npm run build` and
the manual passes in [quickstart.md](./quickstart.md). **No test-file tasks may be generated.**

**Target Platform**: Vercel; browsers including Safari, which refuses third-party cookies by
default and is where the defect is most reliably reproduced.

**Project Type**: Web application (frontend).

**Performance Goals**: The proxy adds one network hop between Vercel's edge and the API. Accepted:
it is what makes the credential first-party, and the rewrite is handled by the edge rather than by
a function invocation.

**Constraints**: The backend is deployed independently and may lag. The proxy must work against a
backend that has not yet been reconfigured for it, except for the one setting named in §3 below,
which is a hard dependency and must be stated as such.

**Scale/Scope**: 8 files changed, 1 added. ~92 routes, none added.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Assessment |
|---|---|
| **I. Component-Based Architecture** | No component structure changes. The sign-in form loses a field. **Pass.** |
| **II. No Inline Styling** | No styling changes at all. **Pass.** |
| **III. Centralized Constants** | The `/bff` prefix is defined once in `app/lib/config.ts` and referenced everywhere, including by the rewrite. No literal is repeated. **Pass.** |
| **IV. Type Safety & Validation** | Unchanged; the login request simply carries one field fewer. **Pass.** |
| **V. API Access Boundary (NON-NEGOTIABLE)** | Strengthened, not weakened. Today five modules build their own absolute URLs from `API_URL`; afterwards every one is a same-origin path through the single prefix, and removing `NEXT_PUBLIC_API_URL` from the bundle makes bypassing the boundary impossible rather than merely discouraged. **Pass.** |
| **VI. Desktop-First, Mobile-Critical Surfaces** | `/my/*` is on the mobile-critical list and is affected: its offline behaviour must be re-checked, which the quickstart covers. No layout changes. **Pass.** |

No violations. Nothing for Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/015-session-persistence/
├── spec.md
├── plan.md              # This file
├── research.md          # Phase 0 — seven design decisions
├── data-model.md        # Phase 1 — session state, such as it is
├── quickstart.md        # Phase 1 — the manual passes, including Safari
├── contracts/
│   └── proxy.md         # Phase 1 — the /bff contract
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
next.config.ts                      # CHANGED — the /bff rewrite
app/
├── lib/
│   ├── config.ts                   # CHANGED — API_URL becomes '/bff'
│   ├── session.ts                  # CHANGED — single-flight, failure rule, hint max-age
│   └── api/
│       ├── client.ts               # unchanged in behaviour; inherits the new API_URL
│       ├── auth.ts                 # CHANGED — login drops rememberMe; hint call updated
│       ├── my-workspace.ts         # CHANGED — salary PDF URL
│       ├── account-creation.ts     # CHANGED — invite + set-password URLs
│       └── hr-payroll.ts           # CHANGED — custom fetch URL
├── ui/
│   ├── login-form.tsx              # CHANGED — remove the checkbox and its schema field
│   └── dashboard/session-guard.tsx # CHANGED — stale comments corrected
└── sw.ts                           # CHANGED — never cache /bff
```

## Approach

### 1. The proxy (FR-003, FR-012, FR-013, FR-016)

`next.config.ts` gains one rewrite: `/bff/:path*` → `${API_ORIGIN}/:path*`. Research §1 records
why a rewrite rather than a route handler — it streams large downloads natively and forwards
`Set-Cookie` without anyone writing header-copying code.

`app/lib/config.ts` replaces `API_URL` with the same-origin constant `'/bff'`, and
`NEXT_PUBLIC_API_URL` leaves the client bundle entirely (research §7). That is what turns FR-012
from a rule people must remember into a property of the build: with no backend address in the
browser, there is no second route to bypass.

All five modules that build absolute URLs are updated. Four are one-line changes; none needs new
logic, because a same-origin path is what `fetch` wanted all along.

### 2. The cookie path — a hard cross-repo dependency (FR-003)

The API must be configured `REFRESH_COOKIE_PATH=/bff/auth`. Without it the browser stores the
credential at `/auth`, never sends it to `/bff/auth/refresh-token`, and **the symptom is identical
to the bug being fixed**. Research §3 covers it; it is repeated here because it is the one thing
that will otherwise cost a day of debugging.

### 3. Single-flight renewal and the failure rule (FR-007, FR-008)

`app/lib/session.ts` holds one module-level in-flight promise. Concurrent 401s await the same
renewal; it is cleared when it settles.

Separately, the sign-out rule narrows: only an `ApiError` with status 401 *from the renewal* ends
the session. Anything else — a dropped connection, a 502, a cold backend — propagates to the
caller unchanged. Today every one of those logs the user out and hard-navigates away, losing
whatever they were doing; that is its own defect and FR-008 names it.

### 4. The hint cookie (FR-002, FR-010)

`setSessionHint()` loses its parameter and always writes a 90-day `max-age`. This is the trap
research §4 documents: the hint is read by `SessionGuard`, and leaving it a browser-session cookie
would make the guard redirect a valid 90-day session to `/login` after any browser restart —
reproducing the reported bug one layer up, where testing would not see it. Its stale comments,
which describe two files that do not exist, are corrected in the same edit.

### 5. Removing the choice (FR-005)

`login-form.tsx` drops the checkbox and its schema field; `login()` stops sending `rememberMe`.
The API keeps accepting the field (its FR-003), so the order of the two deployments does not
matter.

### 6. Service worker (FR-015)

`app/sw.ts` excludes `/bff` from caching. A cached session-bearing response would serve one user's
identity to the next person on a shared phone; a cached 401 would strand someone genuinely signed
in.

## Deployment order

1. **API first.** Every backend setting defaults to today's behaviour, so it changes nothing on
   its own.
2. **Set `REFRESH_COOKIE_PATH=/bff/auth`** and `SESSION_DAYS=90` on the API.
3. **Set `API_ORIGIN`** on Vercel **before the build**, then deploy the web change.

   Not a runtime variable. Next resolves `rewrites()` while building and writes the
   destination into `.next/routes-manifest.json`, so a value supplied only at runtime
   leaves the proxy pointed at the default and every API call goes somewhere else —
   which presents as "login works, nothing else does". Changing it later needs a
   rebuild, not a restart. `next.config.ts` throws on a production build without it, so
   this cannot ship silently.

Reversing 2 and 3 produces a window in which sign-in appears to work and every renewal fails
silently — the original symptom. Nobody is signed out by any of the three steps (FR-006).

## Risks

| Risk | Handling |
|---|---|
| `REFRESH_COOKIE_PATH` not set on the API | Called out in three places, and quickstart Pass 2 detects it in about thirty seconds by checking the stored cookie's path. |
| Rewrite misses a call that still uses an absolute URL | `NEXT_PUBLIC_API_URL` is deleted, so such a call fails to compile rather than silently bypassing the proxy. |
| Large exports buffered in memory | Avoided by choosing a rewrite over a route handler (research §1); quickstart Pass 5 downloads a real export. |
| Proxy hop adds latency | Edge-handled, no function invocation. Accepted as the cost of a first-party credential. |
| `API_ORIGIN` supplied at runtime only | Found during implementation: the destination is baked at build time. `next.config.ts` now throws on a production build without it. |
| Offline punch flow regressed | `/my/*` is mobile-critical; quickstart Pass 6 exercises it offline and on reconnect. |

## Verification

`npx tsc --noEmit`, `npm run lint`, `npm run build`, then the manual passes in
[quickstart.md](./quickstart.md) — including one in Safari, which is where the defect reproduces
most reliably and therefore where the fix must be seen to work.
