# Implementation Plan: Settings Module Frontend (Companies, Users, Roles & Employee Setup)

**Branch**: `002-settings` | **Date**: 2026-08-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-settings/spec.md`

## Summary

Build four screens under the existing `DashboardLayout` shell — Companies (five-tab Add/Edit
modal), Roles (permission multi-select), Users (list/edit/delete, no create), and Employee Setup
(Departments/Designations/Document Types/Shifts/Code Series tabs, company-scoped) — all consuming
`buildcore-api`'s already-specified Settings backend
(`specs/002-settings-backend/contracts/settings-api.md` in that repo). This is the first
data-heavy, mutation-heavy feature in `buildcore-web`, so it's also the point where
`@tanstack/react-query` and a permission-aware route guard get introduced (both pre-approved gaps
in the constitution). It's also the first feature built under the constitution's newly added
Principle VI (Responsive & Mobile-First Design), so every list screen ships a card-layout mobile
variant from the start rather than as a retrofit. See [research.md](research.md) for the specific
decisions.

## Technical Context

**Language/Version**: TypeScript 5.7, Next.js 16 (App Router), React 19 — same stack as feature
001; no new language/runtime.

**Primary Dependencies**: Existing — `react-hook-form` + `@hookform/resolvers` + `zod`, `clsx`,
`@heroicons/react`. New — `@tanstack/react-query` (research.md §3), both pre-approved in the
constitution's Technology Stack as "not here yet" additions. `middleware.ts` (introduced by feature
001) is extended, not newly created, with permission-based checks (research.md §2).

**Storage**: N/A directly (Constitution Principle V) — all persistence lives in `buildcore-api`;
see [data-model.md](data-model.md) for the client-side types mirroring that contract.

**Testing**: No automated test framework installed yet (constitution's documented gap).
Verification is manual per [quickstart.md](quickstart.md), including the mobile-viewport and
keyboard-operability checks this feature's own new principle (VI) and clarification (FR-024)
require.

**Target Platform**: Web browser (desktop + mobile web / PWA), served by Next.js.

**Project Type**: Web application — this plan covers only the `buildcore-web` frontend; the
backend it depends on is already fully specified in the separate `buildcore-api` repo
(`specs/002-settings-backend`), not re-planned here.

**Performance Goals**: Company creation completable in under 5 minutes (spec SC-001, a UX-paced
target, not a latency one); user-role/status edits reflected in the list within 10 seconds of save
completing (SC-002).

**Constraints**: No inline styles (Tailwind + `clsx` only, Principle II); no literal strings/URLs/
permission names inline — routes, copy, and the `PERMISSIONS` list live in `app/lib/constants.ts`
(Principle III); TypeScript `strict`, no `any`/`@ts-ignore` (Principle IV); every API response
`zod`-validated (Principle IV); all `buildcore-api` calls through `app/lib/api/settings.ts`, never
an ad-hoc `fetch()` in a component (Principle V); every screen mobile-first and keyboard-operable
(Principle VI, spec FR-021/FR-024).

**Scale/Scope**: Four route trees (`companies`, `roles`, `users`, `employee-setup` — the latter
with five tabs), ~20 new typed API functions in `app/lib/api/settings.ts`, one extended
`middleware.ts`, one new shared `AccessDenied` component, one new `CompanyContext`. No changes to
the `/login` or `/dashboard` (home) pages from feature 001.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. Component-Based Architecture | Each screen's `page.tsx` is a Server Component doing the initial fetch; interactive lists/modals/forms are `"use client"` components under `app/ui/settings/`; all API calls and derived-flag computation live in `app/lib/api/settings.ts` / `app/lib/settings-utils.ts`, not inline in components. | PASS |
| II. No Inline Styling (NON-NEGOTIABLE) | All new UI (tabs, modals, card/table responsive pairs) uses Tailwind + `clsx`, matching existing `button.tsx`/`login-form.tsx` patterns. | PASS |
| III. Centralized Constants & Configuration (NON-NEGOTIABLE) | New routes (`/dashboard/settings/*`), user-facing copy (validation/error messages, confirmation dialogs), and the `PERMISSIONS` list all go into `app/lib/constants.ts` (research.md §4) — no inline literals in components. | PASS |
| IV. Type Safety & Validation | Every new `app/lib/api/settings.ts` function validates its response with a `zod` schema (data-model.md); `z.infer` types used downstream, not hand-written duplicates. | PASS |
| V. API Access Boundary (NON-NEGOTIABLE) | All Settings calls added as typed functions in `app/lib/api/settings.ts`, following the existing `auth.ts` pattern — no direct DB/ORM access, no ad-hoc `fetch()`. | PASS |
| VI. Responsive & Mobile-First Design (NON-NEGOTIABLE) | Every list screen ships the `hidden md:table` / `md:hidden` card pair from its first version (research.md §7); every interactive control keyboard-operable (research.md §8) — built in from the start, per this principle's own "not retrofitted afterward" wording. | PASS |

No violations require a Complexity Tracking entry — `@tanstack/react-query`'s introduction is a
pre-approved addition being exercised for the first time, not a new architectural dependency
requiring amendment.

**Post-design re-check (after Phase 1)**: data-model.md and contracts/settings-ui.md keep every API
call inside `app/lib/api/settings.ts`, every response `zod`-validated, every new literal in
`constants.ts`, and every list screen with its mobile card variant. Still PASS.

## Project Structure

### Documentation (this feature)

```text
specs/002-settings/
├── plan.md               # This file
├── research.md           # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
└── contracts/
    └── settings-ui.md    # Phase 1 output

(tasks.md — Phase 2 output, /speckit-tasks — not created by /speckit-plan)
```

### Source Code (repository root)

```text
buildcore-web/
├── middleware.ts                                  # MODIFIED (feature 001 introduces it) — adds
│                                                  #   permission-based checks for /dashboard/
│                                                  #   settings/* (research.md §2)
├── app/
│   ├── lib/
│   │   ├── constants.ts                          # MODIFIED — routes, copy, PERMISSIONS list
│   │   ├── settings-utils.ts                     # NEW — derived-flag computation (data-model.md
│   │   │                                        #   "DocumentType"), shared across UI + preview
│   │   └── api/
│   │       └── settings.ts                       # NEW — all typed API functions (contracts/
│   │                                              #   settings-ui.md), zod-validated
│   ├── ui/
│   │   ├── access-denied.tsx                      # NEW — shared, rendered by middleware
│   │   └── settings/
│   │       ├── company-list.tsx                   # NEW — react-query list, table/card pair
│   │       ├── company-modal.tsx                  # NEW — five-tab form (research.md §5)
│   │       ├── role-list.tsx                      # NEW
│   │       ├── role-modal.tsx                     # NEW — permission multi-select
│   │       ├── user-list.tsx                      # NEW — edit/delete only, "Add User" link
│   │       ├── company-context.tsx                # NEW — CompanyContext (research.md §6)
│   │       ├── department-tab.tsx                 # NEW
│   │       ├── designation-tab.tsx                # NEW
│   │       ├── document-type-tab.tsx              # NEW — live derived-flag preview
│   │       ├── shift-tab.tsx                       # NEW
│   │       └── code-series-tab.tsx                # NEW — read-only view
│   └── dashboard/
│       └── settings/
│           ├── companies/page.tsx                 # NEW
│           ├── roles/page.tsx                     # NEW
│           ├── users/page.tsx                     # NEW
│           └── employee-setup/page.tsx            # NEW — wraps tabs in CompanyContext
└── package.json                                    # MODIFIED — adds @tanstack/react-query
```

**Structure Decision**: Single Next.js App Router project (`buildcore-web`), extending the existing
`app/dashboard/`, `app/ui/`, and `app/lib/` directories in place — no new top-level route group or
project split. `buildcore-api`'s Settings module is a separate, already-specified project this
feature depends on but does not modify or re-plan.

## Complexity Tracking

*No entries — no constitution violations requiring justification (see Constitution Check above).*
