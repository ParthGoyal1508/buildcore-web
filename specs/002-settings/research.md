# Research: Settings Module Frontend (Companies, Users, Roles & Employee Setup)

## 1. Route placement: `/dashboard/settings/*`, not literally `/settings/*`

**Decision**: Implement every screen this feature describes under `app/dashboard/settings/` (URLs
`/dashboard/settings/companies`, `/dashboard/settings/users`, `/dashboard/settings/roles`,
`/dashboard/settings/employee-setup`), reusing the existing `DashboardLayout`/`SideNav` shell,
rather than a top-level `app/settings/` route group outside it. The spec (and the PRD it's derived
from) writes these as `/settings/*` as shorthand for "the Settings area," but
`app/ui/dashboard/nav-links.tsx` already has a "Settings" sidebar entry pointing at
`/dashboard/settings` — this feature is what actually builds the destination that link already
assumes.

**Rationale**: `app/dashboard/layout.tsx` is this codebase's only authenticated shell (sidenav +
content area); every other module link in `nav-links.tsx` (`/dashboard/hr`, `/dashboard/projects`,
...) follows the same `/dashboard/<module>` convention. Introducing a separate top-level `/settings`
route tree would duplicate the shell and orphan the nav link that already points elsewhere.

**Alternatives considered**: A literal top-level `app/settings/` route matching the PRD's path
text exactly — rejected: would need its own layout/sidenav (duplicating `DashboardLayout`) and
leave the existing `nav-links.tsx` entry pointing at a route this feature never builds.

## 2. Route-level access control

**Decision**: Extend the same `middleware.ts` feature 001 introduces (Next.js middleware,
currently not yet implemented in either feature's codebase) with a second responsibility beyond
"authenticated or not": decoding the access token's permission claims and rejecting a request to
any `/dashboard/settings/*` path whose required permission (`COMPANY_SETTINGS` for `/companies`,
`USER_MANAGEMENT` for `/users` and `/roles`, `EMPLOYEES` for `/employee-setup`) isn't present,
rendering a shared `AccessDenied` component instead of the page. This feature's own work is additive
to middleware.ts, not a redefinition of feature 001's auth-guard responsibility.

**Rationale**: Next.js middleware is this codebase's one auth-guard chokepoint (feature 001's own
plan already puts route protection there); adding a permission check alongside the existing
authenticated-check keeps a single mechanism instead of a second, page-level guard pattern that
could drift out of sync with it.

**Alternatives considered**: A per-page server-side check (each `page.tsx` fetches the current
user and conditionally renders `AccessDenied`) — rejected: repeats the same check four times with
room for one page to forget it, exactly the drift risk middleware centralization avoids.

## 3. Data fetching and mutation pattern: adopting `@tanstack/react-query`

**Decision**: Adopt `@tanstack/react-query` (already listed in the constitution's Technology Stack
as a pre-approved "not here yet" dependency) for all seven list screens in this feature, rather than
hand-rolled `useState`/`useEffect` fetch-and-refetch logic per screen.

**Rationale**: This feature is the first genuinely data-heavy, mutation-heavy slice of the app
(7 list+CRUD screens, each needing "refetch list after create/edit/delete"); react-query's cache
invalidation (`invalidateQueries` after a mutation) replaces seven near-identical manual refetch
implementations with one consistent pattern, which is exactly the condition the constitution's
"pre-approved when the module that needs them lands" language anticipates.

**Alternatives considered**: Manual `useState` + a shared `useFetchList` hook per screen — rejected:
still requires hand-written invalidation/loading/error-state plumbing per screen with no caching,
for a genuinely worse result at similar implementation cost.

## 4. Response validation and the fixed Permission set

**Decision**: Every function in the new `app/lib/api/settings.ts` (and sibling per-resource files if
split) validates its response with a `zod` schema before returning, per constitution Principle IV —
`CompanySchema`, `RoleSchema`, `UserSummarySchema`, `DepartmentSchema`, `DesignationSchema`,
`DocumentTypeSchema`, `ShiftSchema`, `CodeSeriesSchema`. The fixed permission identifiers
(`DASHBOARD`, `EMPLOYEES`, ... — the same 20 values `buildcore-api`'s
`specs/002-settings-backend/data-model.md` defines as its `Permission` enum) are mirrored as a
`PERMISSIONS` constant array in `app/lib/constants.ts` for the Roles modal's multi-select, manually
kept in sync with the backend enum for now.

**Rationale**: `zod` at the API boundary is this constitution's own stated requirement (Principle
IV); the permission list has no runtime source in this frontend-only feature to generate from, so a
manually-synced constant is the pragmatic starting point.

**Alternatives considered**: Generating frontend types/constants from `buildcore-api`'s OpenAPI
spec (`generated OpenAPI types`, also a pre-approved-but-not-here-yet dependency per the
constitution) — deferred, not rejected: worth adopting once `buildcore-api`'s Settings module is
actually implemented and its Swagger/OpenAPI output exists to generate from; premature while both
sides are still specs.

## 5. Multi-tab Add/Edit Company modal

**Decision**: One `react-hook-form` instance spans all five tabs of the Company modal; the tabs are
a purely presentational `useState`-driven "active tab" switch that shows/hides field groups within
the same form — every tab's fields stay mounted and part of the same form state, so switching tabs
never loses data, and a single Save submits the whole form at once.

**Rationale**: Matches the clarified assumption (spec Assumptions: "one Add/Edit Company Modal...
not five separate forms") and avoids the classic multi-step-form bug of losing an earlier tab's
input when nothing is submitted until the final tab.

**Alternatives considered**: A wizard-style form (only the active tab's fields mounted, state lifted
to a parent) — rejected as unnecessary complexity for a modal that isn't a linear multi-step wizard
(the PRD describes independently orderable tabs, not a forced sequence).

## 6. Company context for Employee Setup

**Decision**: A small, feature-scoped `CompanyContext` (React Context + `useState`, not a
`buildcore-web`-wide provider) wraps just the `/dashboard/settings/employee-setup` page tree,
holding the currently selected company (defaulting to the signed-in user's own `companyId`, with a
company-selector dropdown shown only for a cross-company Super Admin). Companies/Users/Roles
screens don't need this context — they're inherently company-scoped by the signed-in user's own
token (or unscoped, for Roles/Companies-as-admin-views).

**Rationale**: Matches the spec's own Assumption that a global company-switcher is out of this
feature's scope to design; a local, narrowly-scoped context satisfies Employee Setup's per-company
tab requirement without taking on an app-wide state-management decision that belongs to whichever
feature actually needs cross-module company switching first.

**Alternatives considered**: Wait for a global company-switcher feature before building Employee
Setup — rejected: the clarification already decided Employee Setup ships now at its own route, and
a local context is a small addition, not a blocking dependency.

## 7. Mobile card layout for list screens

**Decision**: A shared `ResponsiveList` presentational pattern (or a small reusable component) used
by all seven list screens: a Tailwind `hidden md:table` / `md:hidden` pair — the standard table
renders `md:` and up, and a stacked-card list (one `<div>` per row, label/value pairs) renders below
`md:`. Both read from the same fetched data/columns definition, so there's one source of truth per
screen, not two independently maintained render paths.

**Rationale**: Satisfies FR-021/SC-005 (constitution Principle VI) with a single, reusable
implementation pattern rather than seven bespoke responsive tables, keeping the "row → card"
transformation consistent across the feature.

**Alternatives considered**: A third-party headless table library — rejected: no such library is
pre-approved in the constitution's stack, and the responsive transform needed here (row ↔ card) is
simple enough not to justify a new architectural dependency.

## 8. Accessibility baseline

**Decision**: Use native semantic elements throughout (`<table>` for the desktop list view,
`<button>` for every action, `<label htmlFor>` paired with every form field, native `<dialog>` or a
focus-trapped modal pattern for Add/Edit modals) and verify keyboard operability manually per
screen, per the clarification (basic practices, no formal WCAG target).

**Rationale**: Directly satisfies FR-024/SC-008 without introducing a new accessibility-testing
dependency (no automated a11y test framework is in this repo's approved stack), consistent with the
constitution's existing "manual verification" fallback for the broader lack of a test framework.

**Alternatives considered**: Adopting an automated accessibility linter/test tool (e.g.
`axe-core`) — rejected for this feature specifically: a new testing dependency is a bigger decision
than this feature's own scope, and the clarification explicitly settled for basic practices, not a
formally verified conformance level.
