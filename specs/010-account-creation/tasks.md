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
