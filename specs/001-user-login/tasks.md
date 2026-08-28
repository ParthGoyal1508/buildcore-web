---

description: "Task list for feature implementation"
---

# Tasks: User Login

**Input**: Design documents from `/specs/001-user-login/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/auth-api.md, quickstart.md

**Tests**: Not included — no automated test framework is installed in `buildcore-web` yet
(constitution's documented gap); verification is manual via `quickstart.md`, per Development
Workflow & Quality Gates.

**Repos**: Tasks are labeled `[buildcore-web]` (this repo, `/Users/parthgoyal/Projects/buildcore-web`)
or `[buildcore-api]` (sibling repo, `/Users/parthgoyal/Projects/buildcore-api`) — see plan.md
"Project Structure" and research.md §1 for why this feature spans both.

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Every task includes exact file path(s) and its repo

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Bring `buildcore-web`'s config/constants into constitutional compliance before any
story-specific code touches them (research.md §5).

- [ ] T001 [buildcore-web] Create `app/lib/config.ts` exporting `API_URL`, moving it out of
      `app/lib/api/client.ts` (Constitution Principle III)
- [ ] T002 [P] [buildcore-web] Create `app/lib/constants.ts` with: route paths (`/login`,
      `/dashboard`), the generic invalid-credentials message ("Invalid email or password"), the
      lockout message template, and the "Welcome back, {name}!" template — all copy referenced by
      spec.md FR-004, FR-006, FR-014
- [ ] T003 [P] [buildcore-web] Update `app/lib/api/client.ts` to import `API_URL` from
      `app/lib/config.ts` and add `credentials: 'include'` to the fetch call so the httpOnly
      refresh cookie is sent/received (research.md §2)
- [ ] T004 [buildcore-api] Add and configure a cookie-parsing/response-cookie mechanism (e.g.
      `cookie-parser` + Nest's `res.cookie()`) in `src/main.ts` / `src/auth/` — prerequisite for
      every task below that reads or sets the refresh-token cookie

**Checkpoint**: Both repos can read config from one place and exchange cookies.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core account-state, lockout-tracking, and session-plumbing that every user story
below depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T005 [buildcore-api] Add/confirm `status` (`active`/`deactivated`) and `mustChangePassword`
      fields on the User model + migration (data-model.md "User Account") — needed by US1, US2, US3
- [ ] T006 [buildcore-api] Add a Login Attempt tracking table/model: `accountId`,
      `consecutiveFailures`, `lockedUntil` + migration (data-model.md "Login Attempt Record") —
      needed by US2 and US5
- [ ] T007 [buildcore-api] Add an Activity Log table/model: `eventType`, `accountId`, `timestamp`,
      `ipAddress` + migration (data-model.md "Activity Log Entry") — needed by US1, US2, US4, US5
- [ ] T008 [P] [buildcore-api] Add IP-address-based rate limiting (e.g. Nest throttler guard) on
      the `/auth/*` routes, independent of the per-account lockout (spec FR-016)
- [ ] T009 [P] [buildcore-web] Create `app/lib/session.ts`: holds the access token in memory only
      (never `localStorage`/`sessionStorage`), with `getAccessToken()`/`setAccessToken()`/
      `clearSession()` helpers (research.md §2)
- [ ] T010 [buildcore-web] Create `middleware.ts` at the repo root: redirect any unauthenticated
      request to `/dashboard/*` to `/login` (research.md §3)
- [ ] T011 [P] [buildcore-web] Add `zod` schemas for the `/auth/login` and `/auth/refresh-token`
      response shapes in `app/lib/api/auth.ts` and parse every response through them before
      returning to callers (Constitution Principle IV, research.md §4, contracts/auth-api.md)

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Sign in with valid credentials (Priority: P1) 🎯 MVP

**Goal**: A user with correct credentials for an active account reaches the Dashboard with a
welcome message.

**Independent Test**: Log in with a known-valid email/password for an active account; confirm
redirect to `/dashboard` and the "Welcome back, {name}!" message (quickstart.md Scenario 1).

- [ ] T012 [US1] [buildcore-api] Update `src/auth/auth.service.ts` `login()` to: verify the
      password hash, require `status === 'active'` and not currently locked, and return
      `{ accessToken, name, mustChangePassword }` (contracts/auth-api.md `POST /auth/login`)
- [ ] T013 [US1] [buildcore-api] Update `src/auth/auth.controller.ts` `POST /auth/login` to accept
      `{ email, password, rememberMe }` and set the refresh token as a response cookie
- [ ] T014 [P] [US1] [buildcore-web] Add a show/hide password toggle control to
      `app/ui/login-form.tsx` (spec FR-001)
- [ ] T015 [US1] [buildcore-web] Update `login()` in `app/lib/api/auth.ts` to send `rememberMe`,
      validate the response with the T011 schema, and store the access token via
      `app/lib/session.ts` (not `localStorage`)
- [ ] T016 [US1] [buildcore-web] Update `login-form.tsx`'s submit handler to redirect to
      `/dashboard` on success and carry the returned `name` (e.g. via a short-lived query param or
      shared client state) for the welcome message
- [ ] T017 [US1] [buildcore-web] Update `app/dashboard/page.tsx` to render "Welcome back, {name}!"
      (from `app/lib/constants.ts`, T002) when arriving fresh from login (spec FR-006)
- [ ] T018 [P] [US1] [buildcore-web] Point the "Forgot Password?" link in `login-form.tsx` at
      `/forgot-password` (link only — that flow is a separate, later feature per spec.md scope)
- [ ] T018a [US1] [buildcore-web] In `login-form.tsx`'s submit handler, branch on the login
      response's `mustChangePassword` flag: when true, redirect to the password-change entry
      point instead of `/dashboard` and skip the welcome message (spec FR-007, edge case) — until
      the separate Password Change feature exists, route to a placeholder path and note the
      dependency inline as a one-line comment

**Checkpoint**: User Story 1 is fully functional and independently testable.

---

## Phase 4: User Story 2 - Rejected on invalid credentials (Priority: P1)

**Goal**: Wrong password, unregistered email, deactivated account, and empty fields are all
rejected safely, with no enumeration leak.

**Independent Test**: Submit a wrong password, an unregistered email, and empty fields; confirm
identical generic messaging and correct inline validation (quickstart.md Scenario 2).

- [ ] T019 [US2] [buildcore-api] Rewrite the error paths in `src/auth/auth.service.ts` `login()`
      so an unregistered email, a wrong password, and a deactivated account ALL throw the same
      `UnauthorizedException('Invalid email or password')` — remove the current
      `NotFoundException`/`BadRequestException` split (spec FR-004, research.md §1)
- [ ] T020 [P] [US2] [buildcore-api] Normalize the email lookup in `auth.service.ts` to be
      case-insensitive and trimmed before comparison (spec FR-003)
- [ ] T021 [US2] [buildcore-web] Confirm/adjust `login-form.tsx`'s empty-field inline errors
      (already zod-driven) and change the server-error display to render the exact constant from
      `app/lib/constants.ts` regardless of which rejection reason the backend returned
- [ ] T022 [P] [US2] [buildcore-web] In `app/lib/api/auth.ts` `login()`, map any 401 response to
      the generic constant message client-side too, so the UI never surfaces raw backend text

**Checkpoint**: User Stories 1 AND 2 both work independently.

---

## Phase 5: User Story 3 - Stay signed in with "Remember Me" (Priority: P2)

**Goal**: "Remember Me" extends session persistence to 30 days; sessions are invalidated the
moment role/status changes.

**Independent Test**: Log in with/without "Remember Me", restart the browser, and confirm the
persistence difference; deactivate the account mid-session and confirm the next action is
rejected (quickstart.md Scenario 3).

- [ ] T023 [US3] [buildcore-api] Set the refresh-token cookie's `Max-Age` to 30 days when
      `rememberMe` was true, otherwise a short session-length default (spec FR-009,
      data-model.md "Session")
- [ ] T024 [US3] [buildcore-api] Add re-validation to the auth guard used by protected routes: on
      every authenticated request, re-check the account's current `status`/role and reject with
      401 if it no longer permits the request (spec FR-010)
- [ ] T025 [US3] [buildcore-web] Add the "Remember Me" checkbox to `login-form.tsx` and pass its
      value into `login()` (spec FR-001)
- [ ] T026 [US3] [buildcore-web] Implement transparent refresh in `app/lib/session.ts`: on a 401
      from any `apiFetch` call, call `refreshToken()` once and retry; on refresh failure, clear
      the session and redirect to `/login` (spec edge cases)
- [ ] T027 [P] [US3] [buildcore-web] Verify `credentials: 'include'` (T003) covers the
      `/auth/refresh-token` call path too, including CORS credential settings for the local
      cross-origin dev setup

**Checkpoint**: User Stories 1, 2, AND 3 all work independently.

---

## Phase 6: User Story 4 - Log out (Priority: P2)

**Goal**: Logout ends the session server-side, not just locally.

**Independent Test**: Log in, log out, confirm redirect to `/login` and that the prior session can
no longer be used (quickstart.md Scenario 4).

- [ ] T028 [US4] [buildcore-api] Implement `POST /auth/logout` in `src/auth/auth.controller.ts` /
      `auth.service.ts`: revoke the session identified by the current refresh cookie and clear
      the cookie in the response (spec FR-011)
- [ ] T029 [US4] [buildcore-web] Add a `logout()` function to `app/lib/api/auth.ts` that calls
      `POST /auth/logout`
- [ ] T030 [US4] [buildcore-web] Update the Sign Out handler in `app/ui/dashboard/sidenav.tsx` to
      call the new `logout()` (server-side revocation) before clearing in-memory session state and
      redirecting to `/login`

**Checkpoint**: User Stories 1–4 all work independently.

---

## Phase 7: User Story 5 - Brute-force lockout after repeated failures (Priority: P2)

**Goal**: 5 consecutive failures lock the account for 15 minutes with a distinct message and an
email notice; the Activity Log captures every relevant event.

**Independent Test**: Trigger 5 consecutive failures, confirm the 6th (even correct-password)
attempt is rejected with the lockout message and an email is sent, then confirm recovery after the
window elapses (quickstart.md Scenario 5).

- [ ] T031 [US5] [buildcore-api] Implement consecutive-failure counting in
      `src/auth/auth.service.ts`: increment the Login Attempt record on each failure, lock for 15
      minutes upon reaching 5, and reset to 0 on the next success (spec FR-012, FR-013)
- [ ] T032 [P] [US5] [buildcore-api] Return `423 Locked` with the lockout message and approximate
      unlock time whenever a locked account is attempted against — evaluated before credential
      comparison so a correct password still gets rejected (spec FR-014, contracts/auth-api.md)
- [ ] T033 [P] [US5] [buildcore-api] Send a lockout-notification email to the account's registered
      address when a lock is triggered (spec FR-015)
- [ ] T034 [P] [US5] [buildcore-api] Write Activity Log entries for `login_success`,
      `login_failure`, `account_locked`, and `logout` events with actor, timestamp, and IP —
      never including password data (spec FR-017, FR-018)
- [ ] T035 [US5] [buildcore-web] Handle the `423` response distinctly in `app/lib/api/auth.ts` /
      `login-form.tsx`: show the lockout-specific message (from `app/lib/constants.ts`) instead of
      the generic invalid-credentials message

**Checkpoint**: All five user stories are independently functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T036 [P] Run all five `quickstart.md` scenarios end-to-end manually against both repos
      (constitution's manual-verification fallback, no automated framework yet)
- [ ] T036a [P] Confirm the login page and every `/auth/*` request are only reachable over HTTPS in
      the target deployment config, and that the refresh-token cookie's `Secure` flag is set
      (spec FR-019) — a config/deployment check, not application code
- [ ] T037 [P] [buildcore-web] `npm run lint` and `tsc --noEmit` (or `next build`) pass with no
      errors
- [ ] T038 [buildcore-api] Equivalent lint/build check passes
- [ ] T039 Walk through `specs/001-user-login/checklists/security.md` and resolve or explicitly
      document each open item (enumeration-timing, IP-limit thresholds, etc.)
- [ ] T040 [P] Confirm no plaintext password appears in any log, response body, or Activity Log
      row across both repos (spec FR-018)
- [ ] T041 [P] [buildcore-web] In `app/login/page.tsx` (or `login-form.tsx`), read an
      `?activated=1` search param and show a one-time "Account activated — log in with your new
      password" banner above the form — spec FR-020, added for `010-account-creation`'s
      set-password page to redirect into

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3–7)**: All depend on Foundational; may then proceed in parallel across
  developers or sequentially in priority order (US1 → US2 → US3 → US4 → US5)
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: No dependencies on other stories — the MVP path
- **US2 (P1)**: Independent of US1's happy path, but shares `auth.service.ts`'s `login()` — best
  sequenced right after US1 to avoid rework on the same function
- **US3 (P2)**: Builds on US1's login response (adds `rememberMe` handling) — sequence after US1
- **US4 (P2)**: Independent; only needs Foundational's session/cookie plumbing
- **US5 (P2)**: Shares `login()` and the Login Attempt table with US2 — sequence after US2

### Within Each User Story

- Backend (`buildcore-api`) changes before the `buildcore-web` code that calls them
- Story complete and checkpoint-verified before moving to the next priority

### Parallel Opportunities

- T002/T003 (Setup) can run in parallel
- T005–T011 (Foundational) marked [P] can run in parallel where they touch different files
- Once Foundational is done, US1 and US4 have no cross-dependency and could be staffed in parallel;
  US2/US3/US5 each touch `login()` and should not be parallelized against each other on the
  `buildcore-api` side

---

## Parallel Example: User Story 1

```bash
# Backend and frontend can proceed in parallel once Foundational is done:
Task: "Update src/auth/auth.service.ts login() to return {accessToken, name, mustChangePassword}"
Task: "Add show/hide password toggle control to app/ui/login-form.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: run quickstart.md Scenario 1 independently
5. Demo if ready — note that without US2, invalid credentials will not yet be handled safely, so
   this MVP slice is for internal demo only, not a security-complete release

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → validate → demo (MVP)
3. US2 → validate → now safe to expose beyond a trusted demo (enumeration resistance in place)
4. US3 → validate
5. US4 → validate
6. US5 → validate → full spec scope complete

---

## Notes

- [P] tasks touch different files with no unmet dependency
- [Story] labels map every task to spec.md's user stories for traceability
- Backend tasks are real, cross-repo work items — not simulated from `buildcore-web` (research.md §1)
- No test tasks included per the "Tests" note above; use `quickstart.md` for manual verification
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently before moving on
