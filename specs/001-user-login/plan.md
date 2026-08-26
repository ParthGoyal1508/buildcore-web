# Implementation Plan: User Login

**Branch**: `001-user-login` | **Date**: 2026-08-26 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-user-login/spec.md`

## Summary

Build the `/login` screen and its supporting session lifecycle for BuildCore ERP's `buildcore-web`
frontend: an email/password form (with show/hide password, "Remember Me", inline validation, and
a generic invalid-credentials error), redirect-to-Dashboard on success, transparent access-token
renewal via an httpOnly refresh cookie, an explicit logout, and brute-force lockout handling (5
consecutive failures → 15-minute lock with a distinct lockout message, per the resolved
clarification). The existing `buildcore-api` auth module is a bare starter that does not yet meet
this spec (no enumeration resistance, no lockout, no cookie-based refresh token, no activity log —
see research.md §1), so this plan's task list spans both the `buildcore-web` UI/session work and
the required `buildcore-api` contract changes ([contracts/auth-api.md](contracts/auth-api.md)).

## Technical Context

**Language/Version**: TypeScript 5.7, Next.js 16 (App Router) / React 19 on the frontend
(`buildcore-web`); the counterpart backend (`buildcore-api`) is NestJS/TypeScript in its own
repository — this plan documents the contract it must expose but does not implement it.

**Primary Dependencies**: `react-hook-form` + `@hookform/resolvers` + `zod` (form and API-response
validation), `clsx` (conditional Tailwind classes), `@heroicons/react` (show/hide password icon),
Next.js `middleware.ts` (route protection) — all already present in `package.json` except the
route-protection middleware, which is new.

**Storage**: N/A directly in `buildcore-web` (Constitution Principle V — no direct DB/ORM access).
All account, session, lockout, and activity-log persistence lives in `buildcore-api`; see
[data-model.md](data-model.md).

**Testing**: No automated test framework is installed yet (constitution's documented gap).
Verification is manual, per [quickstart.md](quickstart.md), matching the constitution's stated
fallback of reviewer manual verification until a framework is adopted project-wide.

**Target Platform**: Web browser (desktop + mobile web), served by Next.js.

**Project Type**: Web application — this plan covers the `buildcore-web` frontend changes plus the
`buildcore-api` backend contract this feature depends on (two repositories, one feature).

**Performance Goals**: Login round trip (submit → Dashboard render) completes in under 5 seconds
under normal conditions (SC-001).

**Constraints**: No inline styles (Tailwind + `clsx` only); no ad-hoc `fetch()` outside
`app/lib/api/`; TypeScript `strict` with no `any`/`@ts-ignore`; `zod` validation at the
`buildcore-api` response boundary; all auth traffic over TLS (enforced by deployment/backend
config, not application code); no new architectural dependency introduced (no second HTTP client,
no second form library).

**Scale/Scope**: One login page, one route-protection middleware, extensions to the existing
`app/lib/api/auth.ts`, plus the four backend contract items in
[contracts/auth-api.md](contracts/auth-api.md). No new pages beyond `/login` (Dashboard and the
forgot-password/account-creation/password-change flows are separate, already-existing or
future, features).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. Component-Based Architecture | `LoginForm` stays a `"use client"` component (needs `react-hook-form` state); `app/login/page.tsx` stays a Server Component wrapper. New session logic (token storage, refresh scheduling) goes in `app/lib/api/auth.ts`/`app/lib/session.ts`, not inline in components. | PASS |
| II. No Inline Styling (NON-NEGOTIABLE) | New UI (show/hide toggle, lockout banner, Remember Me checkbox) uses Tailwind utilities + `clsx`, matching the existing `login-form.tsx` pattern. | PASS |
| III. Centralized Constants & Configuration (NON-NEGOTIABLE) | Currently `API_URL` is read inline in `client.ts` and no `constants.ts` exists. This feature introduces `app/lib/config.ts` and `app/lib/constants.ts` (research.md §5) and is the first feature to populate them — resolved as part of this plan, not deferred. | PASS (post-remediation) |
| IV. Type Safety & Validation | Login form already uses `zod` + `react-hook-form`. Gap: today's `apiFetch` does not validate response shape. This plan adds `zod` schemas for `/auth/login` and `/auth/refresh-token` responses (research.md §4). | PASS (post-remediation) |
| V. API Access Boundary (NON-NEGOTIABLE) | All new calls (login, refresh, logout) added as typed functions in `app/lib/api/auth.ts`, following the existing pattern — no direct DB/ORM access from `buildcore-web`. | PASS |

No violations require an exception; the two "post-remediation" rows are pre-existing gaps this
feature closes as part of its own work (not new violations it introduces), so no Complexity
Tracking entry is needed.

**Post-design re-check (after Phase 1)**: data-model.md and contracts/auth-api.md keep all
account/session/lockout state in `buildcore-api`; `buildcore-web`'s only new client-side state is
the in-memory access token (research.md §2) and form state — consistent with all five principles
above. Still PASS.

## Project Structure

### Documentation (this feature)

```text
specs/001-user-login/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── auth-api.md      # Phase 1 output — buildcore-api contract this feature depends on
└── tasks.md             # Phase 2 output (/speckit-tasks — not created by /speckit-plan)
```

### Source Code (repository root)

```text
buildcore-web/                          # this repository
├── middleware.ts                       # NEW — protects /dashboard/*, redirects unauth'd to /login
├── app/
│   ├── login/
│   │   └── page.tsx                    # EXISTING — server wrapper, unchanged structure
│   ├── ui/
│   │   └── login-form.tsx              # MODIFIED — show/hide toggle, Remember Me, lockout message
│   ├── dashboard/
│   │   ├── layout.tsx                  # EXISTING — unchanged
│   │   └── page.tsx                    # MODIFIED — render "Welcome back, {name}!" on arrival
│   ├── ui/dashboard/
│   │   └── sidenav.tsx                 # MODIFIED — Sign Out calls the new server-side logout()
│   └── lib/
│       ├── config.ts                   # NEW — API_URL moved here (Principle III)
│       ├── constants.ts                # NEW — routes + user-facing copy (Principle III)
│       ├── session.ts                  # NEW — in-memory access-token holder, refresh scheduling
│       └── api/
│           ├── client.ts               # MODIFIED — reads API_URL from config.ts; credentials: 'include'
│           └── auth.ts                 # MODIFIED — login()/refreshToken()/logout(), zod-validated responses

buildcore-api/                          # separate repository — contract only, see contracts/auth-api.md
└── src/auth/                           # MODIFIED (tracked as tasks, implemented separately/later)
    ├── auth.controller.ts              # 423-locked response, cookie-based refresh token
    ├── auth.service.ts                 # enumeration-safe errors, lockout tracking, activity log calls
    └── ...                             # lockout/attempt tracking + activity log, wherever buildcore-api models these
```

**Structure Decision**: Single Next.js App Router project (`buildcore-web`), extending the
existing `app/login`, `app/ui`, and `app/lib` directories in place — no new top-level app
directory or project split needed for a one-page feature. The `buildcore-api` side is a second,
already-existing project (separate repo) that this feature's tasks must also change to satisfy
the contract in `contracts/auth-api.md`; it is not a new project being created by this plan.

## Complexity Tracking

*No entries — no constitution violations requiring justification (see Constitution Check above).*
