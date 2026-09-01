---

description: "Task list for feature implementation"
---

# Tasks: Account Creation Frontend (Invite Flow)

**Input**: Design documents from `/specs/010-account-creation/`
**Tests**: Manual per quickstart.md (no automated framework in this repo yet).

## Phase 1: Setup

- [X] T001 [P] Create `app/lib/api/account-creation.ts`: `getUnlinkedEmployees()`, `createUser()`,
      `validateInvite()`, `setPassword()` — contracts/account-creation-ui.md
- [X] T002 [P] ~~Extend `middleware.ts` with a `/dashboard/account-creation/*` matcher
      (`USER_MANAGEMENT`, Super Admin/HO User)~~ — **no change needed; task premise was wrong
      on three counts.** The file is `proxy.ts`, not `middleware.ts` (already flagged by
      003's T046). Its existing `/dashboard/:path*` matcher covers
      `/dashboard/account-creation/*` already, and `/set-password/:token` is correctly
      *outside* every matcher because it must stay reachable without a session. And the
      proxy cannot check a permission at all: it is a presence-only gate over a
      same-origin marker cookie and has no access to the caller's roles or permissions.
      Permission enforcement is server-side, where `@RequirePermissions(USER_MANAGEMENT)`
      guards every `/account-creation/*` route. Verified all three — spec FR-001, FR-002

## Phase 2: User Story 1 — Create User (P1) 🎯 MVP

- [X] T003 [P] [US1] Define `createUserSchema` (zod, mutually-exclusive employee/displayName
      refine) in `app/lib/api/account-creation.ts` — data-model.md
- [X] T004 [US1] Create `app/ui/account-creation/CreateUserForm.tsx`: email, role searchable
      dropdown, company dropdown (hidden + excluded from payload when role is Super Admin —
      FR-002), employee-or-displayName toggle (employee picker calls `getUnlinkedEmployees` on
      company change), 409 messages surfaced verbatim (spec US1 AC3)
- [X] T005 [US1] Create `app/dashboard/account-creation/new/page.tsx`: renders `CreateUserForm`;
      on success — toast (aware of `emailDispatchFailed`) + `router.push('/dashboard/settings/users')`
      + invalidate `['settings','users']` react-query key (research.md §5)
- [X] T006 [US1] Update `002-settings`'s Users screen "Add User" `<Link>` to
      `/dashboard/account-creation/new` (cross-feature — see that feature's own contracts/tasks)

**Checkpoint**: Admin can create a user; Users list shows the new `pending` row.

## Phase 3: User Story 2 — Set Password (P1)

- [X] T007 [P] [US2] Define `setPasswordSchema` (zod, live complexity rule) — data-model.md
- [X] T008 [US2] Create `app/ui/account-creation/SetPasswordForm.tsx`: validates token on mount
      (`validateInvite`), renders invalid-state (expired/consumed, distinct messages — spec FR-005)
      or the password form with live complexity feedback (FR-006)
- [X] T009 [US2] Create `app/set-password/[token]/page.tsx`: hosts the form (public route, no
      dashboard shell, outside `middleware.ts`); on success redirects to `/login?activated=1`
- [X] T010 [US2] Cross-feature: `?activated=1` banner on the login page — **already built**
      by feature 001 (`app/login/page.tsx` reads the search param and renders the banner), so
      the redirect target this feature sends to on success already works

**Checkpoint**: Full create → invite email → set-password → login loop works end-to-end.

## Phase 4: Polish

- [ ] T011 [P] Verify both forms are fully keyboard-operable (native elements, visible focus) —
      spec FR-009
- [X] T012 [P] Run TypeScript type check (`npx tsc --noEmit`)
- [ ] T013 [P] Manual quickstart.md walkthrough

## Dependencies

```
Phase 1 → US1 (Create) ─┐
                          ├─ (independent of each other)
Phase 1 → US2 (Set Password) ─┘
```

US1 and US2 can be built in parallel after Phase 1 — US2 only needs a token, which can be
test-seeded without US1's form existing yet.

## Implementation Strategy

**MVP (Phase 1–3)**: Both user stories together are the minimum shippable unit — US1 alone
produces accounts nobody can activate; US2 alone has nothing to validate against.

---

## Phase 6: Amendment 2026-09-01 — password on create, and a real change-password screen

**Goal**: An admin can set a password when creating an account, and a user forced to change theirs
has a screen that actually does it.

**Independent Test**: Create an account with a password from the admin form; sign in as it; land on
the change-password screen; change the password; continue into the app on the same session.

**Depends on** the backend's Phase 8 (optional `password` on create, and the
`PASSWORD_CHANGE_REQUIRED` refusal).

- [X] T047 [US4] Add an optional password field to the create-user form in
      `app/ui/account-creation/create-user-form.tsx`, with the same complexity rule stated in the
      UI, and make clear that supplying one skips the invite email entirely
      per backend FR-015, FR-016

- [X] T048 [US4] Send `password` through `app/lib/api/account-creation.ts` only when supplied, so
      an empty field keeps today's invite behaviour rather than sending an empty string
      per backend FR-015

- [X] T049 Replace the placeholder at `app/change-password/page.tsx` with a working form posting to
      `POST /users/change-password`. Today it is an explanatory dead end, so an account forced to
      change its password has nowhere to go — which is why the backend's refusal cannot ship
      without this
      per backend FR-017c

- [X] T050 Route the user onward after a successful change rather than leaving them on the form,
      and rely on the backend clearing the flag rather than re-logging them in
      per backend FR-017b

- [X] T051 Handle a `403` carrying `PASSWORD_CHANGE_REQUIRED` anywhere in the app by routing to the
      change-password screen, branching on the code and never on the message text
      per backend FR-017a

- [ ] T052 (PARTIAL) Confirm the four exempt calls still work from that screen — profile read, change,
      refresh, logout — so the page can render the signed-in user and the user can leave without
      completing the change — `GET /users/me` and the change-password call verified
      live against a running API; refresh and logout not exercised from this screen
      per backend FR-017a
