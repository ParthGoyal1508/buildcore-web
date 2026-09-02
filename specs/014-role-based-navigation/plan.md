# Implementation Plan: Role-Based Navigation

**Branch**: `014-role-based-navigation` | **Date**: 2026-09-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/014-role-based-navigation/spec.md`

## Summary

Filter the nine-module sidebar by the signed-in user's effective permissions, and refuse the
corresponding routes to users who lack them. The permission data is already in the browser: the
shell resolves `GET /users/me` — which returns the union of the user's roles' permissions — through
a shared `['currentUser']` react-query key, and today the sidebar ignores it. This feature gives
that value a consumer.

The approach mirrors a pattern the codebase already runs twice. `app/dashboard/settings/layout.tsx`
and `app/dashboard/hr/layout.tsx` each gate their subtree with a section-to-permission map from
`app/lib/constants.ts`. This feature adds the missing tier above them: a `NAV_MODULES` definition
that is simultaneously the sidebar's source of items and the module guard's source of truth, so the
menu and the gate cannot disagree (FR-014).

No backend change. `buildcore-api`'s `jwt.strategy.ts` re-derives permissions from the database on
every request rather than trusting token claims, so an administrator's role edit propagates on the
affected user's next request with no re-login, no token refresh, and nothing to invalidate.

## Technical Context

**Language/Version**: TypeScript 5.x (`strict`), React 19, Next.js 16 (App Router)

**Primary Dependencies**: `@tanstack/react-query` (the existing `['currentUser']` query),
`@heroicons/react`, `clsx`, Tailwind CSS, `zod` (already validates the `/users/me` payload)

**Storage**: None. Permissions are resolved per session from the API and never persisted
client-side — deliberately, since a cached permission set is a stale permission set.

**Testing**: No framework is installed in this repo (constitution `TODO(TESTING_STANDARD)`).
Verification is `npm run lint`, `npx tsc --noEmit`, `npm run build`, plus the manual viewport and
role-matrix checks in [quickstart.md](./quickstart.md). No test suite is planned, because none can
run.

**Target Platform**: Modern evergreen browsers. The `/dashboard` shell is a desktop surface; the
sidebar itself and the `/my` shell are mobile-critical (Principle VI).

**Project Type**: Web frontend only. No `buildcore-api` change.

**Performance Goals**: Zero additional network requests. The sidebar reads the same
`['currentUser']` query the route guards already use, so the filtered menu and the guard decision
come from one fetch — which is also what makes the no-flash requirement (FR-011) achievable without
a second round-trip.

**Constraints**:
- The access token is held in memory only (`app/lib/session.ts`, feature 001), so `middleware.ts`
  and `proxy.ts` cannot read it and cannot make this decision at the edge. Guards MUST stay at the
  layout boundary, as the two existing guards already document.
- `/my` is an offline-capable PWA with a queued-punch drain. A guard there MUST NOT lock out a user
  whose `/users/me` call fails because they have no signal — see research.md §4.

**Scale/Scope**: 9 sidebar modules; 22 assignable permissions, of which 13 govern a module and 9
govern nothing in the sidebar; 7 files changed; 0 new dependencies.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design — result unchanged.*

| Principle | Status | How this feature satisfies it |
|---|---|---|
| **I. Component-Based Architecture** | PASS | `app/dashboard/layout.tsx` stays a Server Component; the guard is a small `"use client"` child (`ModuleGuard`) inserted beside the existing `SessionGuard`, keeping the client boundary as low as possible. `NavLinks` becomes a client component because it must read the query — it is already a leaf. All mapping and filtering logic lives in `app/lib/constants.ts` and a `lib` helper, not in component bodies. |
| **II. No Inline Styling** | PASS | The reflowed navigation grid is expressed in Tailwind classes; conditional classes use the existing `clsx`. No `style={}` is introduced. The item count is variable but the layout adapts through `grid-cols-*`/wrapping utilities, not a computed pixel value. |
| **III. Centralized Constants** | PASS | `NAV_MODULES` (labels, routes, governing permissions) and the two new copy strings live in `app/lib/constants.ts`, beside the `SETTINGS_PERMISSIONS` and `HR_PERMISSIONS` maps they extend. This is FR-014's single definition; the hardcoded array currently inside `nav-links.tsx` is removed, not duplicated. |
| **IV. Type Safety & Validation** | PASS | `NAV_MODULES` is `as const`; the module id and permission types are derived from it rather than hand-written. No `any`, no `@ts-ignore`, no non-null assertion. The trust boundary is unchanged — `getCurrentUser()` already validates `/users/me` with zod, and this feature only consumes the already-validated `permissions` array. |
| **V. API Access Boundary** | PASS | No new endpoint, no new fetch. The feature consumes `getCurrentUser()` in `app/lib/api/users.ts`; no component gains an ad-hoc `fetch()`. |
| **VI. Responsive Design** | PASS, with the mobile exception applying | The sidebar shell is **mobile-critical**: it is the only route to Punch, Attendance, Leave and My Workspace, all on the closed list. It is therefore built mobile-first and MUST be checked at 320px (FR-012, SC-008) for every module count from 0 to 9 — the current fixed `grid-cols-5` is sized for exactly ten targets and is what this feature replaces. 44×44px minimum touch targets are preserved. The pages *behind* the links remain desktop surfaces and are untouched. Keyboard operability (FR-015) is not scoped by viewport and applies to every remaining control. |

**No violations.** The Complexity Tracking table below is therefore empty and has been removed.

### Note on the spec, raised by this plan

Phase 0 research found that FR-010 ("if the signed-in user's details cannot be loaded, show no
modules and state the failure") is correct for the `/dashboard` shell but would break the `/my`
shell, where a failed `/users/me` is the *expected* state for a field worker with no signal and an
offline punch queue. Applying FR-010 there would lock a worker out of the punch screen precisely
when the offline queue exists to serve them. The spec has been amended with **FR-010a** recording
the exemption. See research.md §4.

## Project Structure

### Documentation (this feature)

```text
specs/014-role-based-navigation/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── navigation.md    # The module -> permission contract
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit-specify)
└── tasks.md             # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
app/
├── lib/
│   ├── constants.ts             # CHANGED: add NAV_MODULES + nav copy; MESSAGES additions
│   └── permissions.ts           # NEW: visibleModules(), hasModuleAccess(), landingRoute()
├── dashboard/
│   ├── layout.tsx               # CHANGED: mount <ModuleGuard> beside <SessionGuard>
│   └── page.tsx                 # unchanged; the guard handles the DASHBOARD case above it
├── my/
│   └── layout.tsx               # CHANGED: MY_WORKSPACE guard, with the offline exemption
└── ui/
    ├── dashboard/
    │   ├── nav-links.tsx        # CHANGED: filtered, driven by NAV_MODULES
    │   ├── sidenav.tsx          # CHANGED: reflowing grid, loading and empty states
    │   └── module-guard.tsx     # NEW: client guard for /dashboard/* module routes
    └── settings/
        └── role-modal.tsx       # CHANGED: FR-013 — label each permission with its module
```

**Structure Decision**: The existing App Router layout is kept exactly as it is. Every change is
either an edit to a file that already owns this concern (`nav-links.tsx`, `sidenav.tsx`,
`constants.ts`, `role-modal.tsx`) or a new file placed where the codebase already puts that kind of
thing (`app/ui/dashboard/module-guard.tsx` beside `session-guard.tsx`; `app/lib/permissions.ts`
beside `format.ts`). No new directory, no new route, no restructuring.

## Phase 0 — Research

See [research.md](./research.md). Six questions were resolved:

1. Where the guard can live, given the in-memory token.
2. How to avoid a second fetch and the resulting menu flash.
3. Where the mapping lives so the sidebar and the guard cannot diverge.
4. How `/my` stays reachable offline while still being permission-gated.
5. What "first module they hold" resolves to for the FR-008 landing redirect.
6. How the phone grid reflows for a variable item count.

## Phase 1 — Design

- [data-model.md](./data-model.md) — the `NavModule` shape, the derived types, and the permission
  partition (13 nav-governing, 9 not).
- [contracts/navigation.md](./contracts/navigation.md) — the normative module → permission table,
  the any-of rule, and the guard's decision table.
- [quickstart.md](./quickstart.md) — the role matrix to check, the 320px viewport pass, and the
  direct-URL refusal pass.

## Known gap, carried forward

Five of the nine sidebar modules — **Projects, Plant & Machinery, Inventory, Partners, Reports** —
have no route in `app/` at all. Their links 404 today for every user, permitted or not. This
feature filters and guards them correctly, but SC-003 ("all nine modules refuse direct URL access")
can only be verified end-to-end for the modules that exist: Dashboard, HR & Payroll, Settings and
My Workspace. The remaining five are verified as *filtered out of the sidebar*, and their guard
entries are in place for whenever features 006–009 build the routes. This is recorded here rather
than quietly narrowing SC-003.
