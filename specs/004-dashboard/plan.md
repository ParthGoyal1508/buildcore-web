# Implementation Plan: Dashboard & General Frontend (Widgets, Notifications, Activity Log, Reports)

**Branch**: `004-dashboard` | **Date**: 2026-08-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-dashboard/spec.md`

## Summary

Build a generic, display-type-driven widget rendering system (`WidgetRenderer` and its four small
presentational components, plus a matching `FilterField` renderer for report filters) and wire it
into five screens under the existing `/dashboard/*` shell — the main Dashboard (replacing the
existing hardcoded `CardWrapper` placeholder), Site Dashboard, Group Dashboard, Activity Log, and
Reports — plus a header notification bell/dropdown panel. This is the frontend mirror of the
backend's confirmed extensible-registry architecture: the entire point is that a new widget/report/
notification type appearing in the backend's response later requires zero changes to this
feature's code. See [research.md](research.md) for the rendering-pattern decisions.

## Technical Context

**Language/Version**: TypeScript 5.7, Next.js 16 (App Router), React 19 — unchanged.

**Primary Dependencies**: Existing — `react-hook-form` + `@hookform/resolvers` + `zod`, `clsx`,
`@heroicons/react`, `@tanstack/react-query` (introduced by Settings, reused here). No new
dependency — export downloads reuse the blob/object-URL pattern already established by My
Workspace's salary-slip PDF; polling reuses react-query's `refetchInterval`.

**Storage**: N/A directly (Constitution Principle V) — all data lives in `buildcore-api`.

**Testing**: No automated test framework installed yet (constitution's documented gap).
Verification is manual per [quickstart.md](quickstart.md), notably including the "add a simulated
new widget, confirm zero code change needed" check (spec SC-002).

**Target Platform**: Desktop web (primary, admin-facing) + mobile web, consistent with this app's
mobile-first constitution principle applied to every screen regardless of primary usage pattern.

**Project Type**: Web application — this plan covers only the `buildcore-web` frontend; the
backend it depends on is already fully specified separately (`buildcore-api`,
`specs/004-dashboard-backend`).

**Performance Goals**: Full Dashboard widget set renders in under 3 seconds under normal load
(spec SC-001), achieved by one widget-list network call per screen (FR-004), not N per-widget
calls.

**Constraints**: No inline styles (Tailwind + `clsx`, Principle II); no literal strings/URLs
inline — routes and copy in `app/lib/constants.ts` (Principle III); TypeScript `strict`, `zod` at
every API boundary (Principle IV); all `buildcore-api` calls through `app/lib/api/dashboard.ts`
(Principle V); every screen mobile-first and keyboard-operable (Principle VI, spec FR-019); zero
per-widget-id conditionals anywhere in this feature's rendering code (spec FR-001, SC-002).

**Scale/Scope**: Five screens/route additions (one of them, `/dashboard`, a rewrite of an existing
page), one header component pair (bell + panel), two generic switch components
(`WidgetRenderer`, `FilterField`) and their ~9 presentational sub-components, ~10 new typed API
functions. Removes `app/ui/dashboard/cards.tsx` (superseded placeholder).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. Component-Based Architecture | `WidgetRenderer`/`FilterField` and their sub-components are small, single-purpose, colocated under `app/ui/dashboard/`; data fetching lives in `app/lib/api/dashboard.ts`, not inline in components. | PASS |
| II. No Inline Styling (NON-NEGOTIABLE) | All new UI (cards, tables, dropdown panel, filter inputs) uses Tailwind + `clsx`. | PASS |
| III. Centralized Constants & Configuration (NON-NEGOTIABLE) | New routes, copy, the 30s refresh interval, and the debounce delay for employee search all in `app/lib/constants.ts`. | PASS |
| IV. Type Safety & Validation | Every `app/lib/api/dashboard.ts` function `zod`-validates its response (data-model.md); export blob responses handled per the established non-JSON pattern (My Workspace research.md §8). | PASS |
| V. API Access Boundary (NON-NEGOTIABLE) | All calls through `app/lib/api/dashboard.ts`; no ad-hoc `fetch()` in components. | PASS |
| VI. Responsive & Mobile-First Design (NON-NEGOTIABLE) | Reuses the established `ResponsiveList` pattern for `WidgetTable`; every filter/selector/export control keyboard-operable (spec FR-019). | PASS |

No violations require a Complexity Tracking entry.

**Post-design re-check (after Phase 1)**: data-model.md and contracts/dashboard-ui.md keep every
API call inside `app/lib/api/dashboard.ts`, every response `zod`-validated, every literal in
`constants.ts`, and — critically — zero per-widget-id rendering logic anywhere. Still PASS.

## Project Structure

### Documentation (this feature)

```text
specs/004-dashboard/
├── plan.md                    # This file
├── research.md                # Phase 0 output
├── data-model.md              # Phase 1 output
├── quickstart.md              # Phase 1 output
└── contracts/
    └── dashboard-ui.md        # Phase 1 output

(tasks.md — Phase 2 output, /speckit-tasks — not created by /speckit-plan)
```

### Source Code (repository root)

```text
buildcore-web/
├── app/
│   ├── lib/
│   │   ├── constants.ts                            # MODIFIED — routes, copy, refresh interval,
│   │   │                                          #   search debounce delay
│   │   └── api/
│   │       └── dashboard.ts                        # NEW — all typed API functions, zod-validated
│   ├── ui/
│   │   └── dashboard/
│   │       ├── cards.tsx                           # REMOVED — superseded hardcoded placeholder
│   │       │                                      #   (research.md §2)
│   │       ├── widget-renderer.tsx                 # NEW — WidgetRenderer + KpiCard/WidgetTable/
│   │       │                                      #   WidgetList/StatCard/ComingSoonCard/
│   │       │                                      #   UnsupportedWidgetCard (research.md §1)
│   │       ├── filter-field.tsx                    # NEW — generic report-filter renderer
│   │       │                                      #   (research.md §6)
│   │       ├── notification-bell.tsx               # NEW — header bell + badge
│   │       ├── notification-panel.tsx              # NEW — dropdown panel (research.md §5)
│   │       ├── site-selector.tsx                   # NEW
│   │       ├── employee-search.tsx                 # NEW — debounced, min 2 chars
│   │       ├── activity-log-list.tsx               # NEW
│   │       ├── report-type-list.tsx                # NEW
│   │       ├── report-result-table.tsx             # NEW — reuses WidgetTable
│   │       ├── sidenav.tsx                          # MODIFIED — renders NotificationBell in header
│   │       └── nav-links.tsx                        # MODIFIED — adds Group/Site Dashboard,
│   │                                              #   Activity Log entries; Reports now real
│   └── dashboard/
│       ├── page.tsx                                 # MODIFIED — rewritten to use WidgetRenderer
│       │                                          #   (research.md §2)
│       ├── site/page.tsx                            # NEW
│       ├── group/page.tsx                           # NEW
│       ├── activity-log/page.tsx                    # NEW
│       └── reports/page.tsx                         # NEW
```

**Structure Decision**: Single Next.js App Router project (`buildcore-web`), extending the existing
`app/dashboard/` route group and `app/ui/dashboard/` directory in place — no new top-level route
group. The one removed file (`cards.tsx`) is the placeholder this feature exists to replace.

## Complexity Tracking

*No entries — no constitution violations requiring justification (see Constitution Check above).*
