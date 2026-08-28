# Implementation Plan: Account Creation Frontend (Invite Flow)

**Branch**: `010-account-creation` | **Date**: 2026-08-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/010-account-creation/spec.md`

## Summary

Build two pages: `/dashboard/account-creation/new` (admin create-user form, the destination of
`002-settings`'s "Add User" link — that feature's own spec/contracts updated to name this route
concretely) and `/set-password/[token]` (public, top-level, outside `middleware.ts`'s guard —
mirroring `/login`). No account list/edit UI here — `002-settings`'s Users screen already owns
that. Backend: `buildcore-api/specs/010-account-creation-backend/`. See
[research.md](research.md) for all five decisions.

## Technical Context

**Language/Version**: TypeScript 5.7, Next.js 16 (App Router), React 19 — unchanged.

**Primary Dependencies**: Existing only — `react-hook-form` + `zod`, `@tanstack/react-query`,
`clsx`. No new dependency.

**Storage**: N/A — all data in `buildcore-api`.

**Testing**: Manual per quickstart.md.

**Constraints**: `/set-password/:token` MUST stay outside `middleware.ts`'s auth guard
(research.md §1); create-user form guarded identically to `002-settings`'s Users screen
(`USER_MANAGEMENT` + Super Admin/HO User); no duplicate account list/edit screen (research.md §3).

**Scale/Scope**: 2 new route files, ~4 components, ~4 typed API functions, 1 cross-feature
one-line addition to `001-user-login` (the `?activated=1` banner, FR-020 there).

## Constitution Check (Frontend Principles)

| Principle | Check | Status |
|---|---|---|
| No inline styles | Tailwind + clsx | PASS |
| No literal API strings | All endpoints in `app/lib/api/account-creation.ts` | PASS |
| TypeScript + zod at boundaries | Schemas in data-model.md | PASS |
| API calls through `app/lib/api/` | `account-creation.ts` | PASS |
| Mobile-first & keyboard-operable | Both forms keyboard-operable, built in from the start — spec FR-009 | PASS |
| `middleware.ts` route guard | `/dashboard/account-creation/*` guarded (`USER_MANAGEMENT`); `/set-password/:token` deliberately excluded — spec FR-004 | PASS |

## Project Structure

```text
app/
├── dashboard/account-creation/new/page.tsx   # NEW
├── set-password/[token]/page.tsx             # NEW — public, top-level
├── lib/api/account-creation.ts               # NEW
└── ui/account-creation/
    ├── CreateUserForm.tsx
    └── SetPasswordForm.tsx

middleware.ts     # MODIFIED — /dashboard/account-creation/* guard; /set-password/* left public
app/login/page.tsx (or login-form.tsx)   # MODIFIED (001) — ?activated=1 banner, FR-020 there
```

## Implementation Phases

### Phase 1: Shared Infrastructure

- [ ] Create `app/lib/api/account-creation.ts` with all typed API functions
- [ ] Extend `middleware.ts` with `/dashboard/account-creation/*` (`USER_MANAGEMENT`)

### Phase 2: US1 — Create User (P1) 🎯 MVP

- [ ] `CreateUserForm.tsx`: email, role dropdown, conditional company dropdown (hidden for Super
  Admin), employee-or-displayName toggle, `createUserSchema` validation
- [ ] `app/dashboard/account-creation/new/page.tsx`: renders form, on success toast +
  `router.push('/dashboard/settings/users')` + invalidate `['settings','users']`
- [ ] `002-settings`'s "Add User" link updated to point here (research.md §2)

**Checkpoint**: Admin can create a user from a real form; Users list shows the new `pending` row.

### Phase 3: US2 — Set Password (P1)

- [ ] `SetPasswordForm.tsx`: validates token on mount, shows invalid-state (expired/consumed) or
  the password form with live complexity feedback
- [ ] `app/set-password/[token]/page.tsx`: hosts the form, on success redirects to
  `/login?activated=1`
- [ ] `001-user-login`'s login page: `?activated=1` banner (cross-feature, FR-020 there)

**Checkpoint**: Full create → email → set-password → login loop works end-to-end.
