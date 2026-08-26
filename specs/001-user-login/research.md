# Research: User Login

**Input**: `plan.md` Technical Context unknowns and cross-cutting decisions for the Login feature.

## 1. Backend contract gap (buildcore-api currently doesn't meet the spec)

**Decision**: Treat the required `buildcore-api` (`src/auth/`) changes as an explicit, separate
work item enumerated by this plan/tasks, rather than working around it from the frontend or
silently assuming it already exists.

**Rationale**: Constitution Principle V (API Access Boundary) forbids `buildcore-web` from doing
anything other than calling `buildcore-api` through the typed `app/lib/api/` wrapper — it cannot
implement lockout counting, enumeration-safe error mapping, or activity logging itself. Reading the
current `buildcore-api` auth module (`src/auth/auth.controller.ts`, `src/auth/auth.service.ts`)
shows it is a bare starter: `login()` throws `NotFoundException` for an unregistered email and a
distinct `BadRequestException('Invalid password')` for a wrong password (violates spec FR-004
enumeration resistance), has no lockout/attempt tracking (FR-012–FR-016), issues both tokens in the
JSON body with no httpOnly cookie (contradicts the PRD's NFR and this spec's session model), and
has no activity logging (FR-017) or account-status/role re-validation (FR-010).

**Alternatives considered**:
- *Fake/mock the missing behavior inside buildcore-web* (e.g., a Next.js API route that simulates
  lockout) — rejected: violates Principle V outright and would need to be thrown away once the
  real backend work lands, doubling the work.
- *Silently assume the backend already matches the spec* — rejected: would produce a plan/tasks
  set that cannot actually pass its own acceptance scenarios once implementation starts.

**Consequence for tasks.md**: task generation must include backend-contract tasks against
`buildcore-api` (tracked here since that's where this feature's spec-kit lives) alongside the
`buildcore-web` UI/session tasks, clearly labeled by repo.

## 2. Token storage strategy

**Decision**: Access token held in memory only (a small client-side auth-state module), never in
`localStorage`/`sessionStorage`. Refresh token is never touched by JavaScript — it is set by
`buildcore-api` as a `Secure`, `HttpOnly`, `SameSite=Strict` cookie, with its `Max-Age` set by the
backend to the default (session-length) or 30 days when "Remember Me" was checked.

**Rationale**: Matches the PRD's explicit NFR ("refresh tokens ... stored as secure, httpOnly,
SameSite cookies") and closes the gap already flagged in the existing code's own comment
(`app/lib/api/auth.ts`: "localStorage is a placeholder ... docs/HLD.md §9.1 specifies an in-memory
access token + an HTTP-only refresh-token cookie"). An in-memory access token is lost on a hard
refresh; that's acceptable because it's re-obtained transparently via the httpOnly refresh cookie
(spec edge case: "access token expires mid-session ... renewed transparently").

**Alternatives considered**:
- *Keep `localStorage` for the access token* — rejected: readable by any injected script (XSS
  blast radius), and already flagged as a known placeholder to replace.
- *Both tokens in httpOnly cookies* — rejected: the access token needs to be readable by
  client-side code to attach to `Authorization` headers for cross-origin calls to `buildcore-api`
  (a separate origin/port in dev); only the refresh token needs to be inaccessible to JS.

## 3. Route protection for authenticated pages

**Decision**: Add Next.js `middleware.ts` at the project root that checks for a valid session
(presence of the refresh cookie) before allowing `/dashboard/*`, redirecting unauthenticated
requests to `/login`.

**Rationale**: The existing `/dashboard` route has no protection today — required so that FR-010
(reject actions when a role/status changes) and general access control have a single enforcement
point rather than being scattered per-page.

**Alternatives considered**: Per-page auth checks in each Server Component — rejected: duplicates
logic across every current and future authenticated page; a single middleware is the standard
Next.js App Router pattern for this.

## 4. Response validation at the API boundary

**Decision**: Add a `zod` schema for the `/auth/login` response (and `/auth/refresh-token`) in
`app/lib/api/auth.ts`, parsing with `.parse()` before returning typed data to callers.

**Rationale**: Constitution Principle IV requires runtime validation of anything crossing the
`buildcore-api` boundary; the current `auth.ts` trusts the JSON shape without validation.

**Alternatives considered**: Rely on TypeScript types alone — rejected: TypeScript types are
compile-time only and provide no protection against a backend contract drift or malformed
response, which is exactly the case Principle IV calls out.

## 5. Centralized constants/config compliance

**Decision**: Introduce `app/lib/config.ts` (move `API_URL` there from `client.ts`) and
`app/lib/constants.ts` (route paths like `/login`, `/dashboard`; user-facing copy such as the
generic invalid-credentials message, the lockout message template, and the welcome-back message
template; the lockout threshold/duration/Remember-Me-duration display values).

**Rationale**: Constitution Principle III (NON-NEGOTIABLE) forbids hardcoded literals/URLs/copy in
components; today `API_URL` is read directly in `client.ts` and there is no constants module at
all — this feature is the first to need shared literals (multiple components will reference the
same route paths and copy), so it is the right point to introduce them rather than deferring.

**Alternatives considered**: Leave literals inline since "it's just a few strings" — rejected: the
constitution treats this as NON-NEGOTIABLE with no size exception, and login copy (error/lockout/
welcome messages) is exactly the kind of user-facing content the principle calls out.

## 6. Testing approach

**Decision**: No automated test framework exists yet (constitution's documented gap). Verification
for this feature is manual: run the flows locally against a running `buildcore-api` per the
scenarios in `quickstart.md`, matching the constitution's stated fallback ("reviewers substitute
manual verification ... for automated test coverage").

**Rationale**: Adopting a test framework is out of scope for a single feature's plan — the
constitution treats that as its own future amendment (MINOR bump), not something to bundle in
here.

**Alternatives considered**: Introduce Vitest/Playwright as part of this feature — rejected: scope
creep against an explicit constitutional TODO that says to do this separately when adopted
project-wide.
