# Implementation Plan: Machinery Frontend (Asset Register, Logbook, Fuel, Maintenance, Hire Bills, Equipment Categories, Equipment Doc Types, Hire Rates, Utilization Report)

**Branch**: `006-machinery` | **Date**: 2026-08-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/006-machinery/spec.md`

## Summary

Build nine admin screens under `/dashboard/plant/*`, resolving `nav-links.tsx`'s existing "Plant &
Machinery" entry, consuming `buildcore-api`'s already-specified Machinery backend. Eight of the
nine screens use flat, single-submit modals (matching the PRD's own naming), with only Equipment
needing a dedicated per-machine detail page for its Documents. The Equipment Utilization Report
introduces this project's first chart-like visual, built with `recharts` (now pre-approved via
constitution amendment — the user's explicit choice over a dependency-free CSS bar). This feature
adds zero widget/notification-specific frontend code: the Dashboard feature's existing generic
renderers automatically pick up the new Machinery Cost/Fuel Cost/Hire Bills widgets and Document
Expiry/Fuel Variance/Maintenance Due notifications once the backend registers its providers. See
[research.md](research.md) for all eight decisions.

## Technical Context

**Language/Version**: TypeScript 5.7, Next.js 16 (App Router), React 19 — unchanged.

**Primary Dependencies**: Existing — `react-hook-form` + `@hookform/resolvers` + `zod`, `clsx`,
`@heroicons/react`, `@tanstack/react-query`; plus one new dependency, `recharts` (research.md §3,
constitution v1.1.0 → v1.2.0).

**Storage**: N/A directly (Constitution Principle V) — all data lives in `buildcore-api`.

**Testing**: No automated test framework installed yet (constitution's documented gap).
Verification is manual per [quickstart.md](quickstart.md).

**Target Platform**: Desktop web (primary, admin-facing) + mobile web, per Principle VI's blanket
mobile-first requirement applying to every screen.

**Project Type**: Web application — this plan covers only the `buildcore-web` frontend; the
backend it depends on is already fully specified separately (`buildcore-api`,
`specs/006-machinery-backend`).

**Performance Goals**: New machine registration with a first document completable in under 5
minutes (spec SC-001, a UX-paced target).

**Constraints**: No inline styles (Tailwind + `clsx`, Principle II) — the one narrow exception
already carved out in that principle (a runtime-computed numeric value for a chart) applies to the
utilization band chart's segment widths; no literal strings/URLs inline (Principle III);
TypeScript `strict`, `zod` at every API boundary (Principle IV); all `buildcore-api` calls through
`app/lib/api/machinery.ts` (Principle V); every screen mobile-first and keyboard-operable, built in
per-component from the start (Principle VI, spec FR-024).

**Scale/Scope**: Nine route areas, ~25 new typed API functions, ~20 new components, one new
dependency (`recharts`), `nav-links.tsx`'s existing "Plant & Machinery" entry finally resolving to
real content.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. Component-Based Architecture | Each area's `page.tsx` is a Server Component doing the initial fetch; interactive forms/modals/tables are `"use client"` under `app/ui/machinery/`; all API calls in `app/lib/api/machinery.ts`. | PASS |
| II. No Inline Styling (NON-NEGOTIABLE) | All new UI uses Tailwind + `clsx`; the utilization chart's runtime-computed segment widths are the principle's own named narrow exception, isolated to a single line. | PASS |
| III. Centralized Constants & Configuration (NON-NEGOTIABLE) | New routes and copy in `app/lib/constants.ts`; no inline literals. | PASS |
| IV. Type Safety & Validation | Every `app/lib/api/machinery.ts` function `zod`-validates its response (data-model.md). | PASS |
| V. API Access Boundary (NON-NEGOTIABLE) | All calls through `app/lib/api/machinery.ts`; no direct fetch calls in components. | PASS |
| VI. Responsive & Mobile-First Design (NON-NEGOTIABLE) | `ResponsiveList` reused for every table; every modal/filter keyboard-operable, built into each component's task from the start. | PASS |

**Charting dependency**: `recharts` is a new dependency, pre-approved via the constitution
amendment recorded above (v1.1.0 → v1.2.0) before this plan was written — not a pending violation.

No violations require a Complexity Tracking entry.

**Post-design re-check (after Phase 1)**: data-model.md and contracts/machinery-ui.md keep every
API call inside `app/lib/api/machinery.ts` and the chart's only non-Tailwind styling isolated to
`recharts`' own component props (not a hand-rolled inline style). Still PASS.

## Project Structure

### Documentation (this feature)

```text
specs/006-machinery/
├── plan.md                    # This file
├── research.md                # Phase 0 output
├── data-model.md              # Phase 1 output
├── quickstart.md              # Phase 1 output
└── contracts/
    └── machinery-ui.md        # Phase 1 output

(tasks.md — Phase 2 output, /speckit-tasks — not created by /speckit-plan)
```

### Source Code (repository root)

```text
buildcore-web/
├── app/
│   ├── lib/
│   │   ├── constants.ts                          # MODIFIED — /dashboard/plant/* routes, copy
│   │   └── api/
│   │       └── machinery.ts                      # NEW — all typed API functions
│   ├── ui/
│   │   └── machinery/
│   │       ├── equipment-list.tsx                # NEW
│   │       ├── equipment-form-modal.tsx          # NEW
│   │       ├── equipment-detail-tabs.tsx         # NEW
│   │       ├── equipment-documents.tsx           # NEW — research.md §4
│   │       ├── logbook-table.tsx                 # NEW
│   │       ├── logbook-entry-modal.tsx           # NEW
│   │       ├── fuel-table.tsx                    # NEW
│   │       ├── fuel-entry-modal.tsx               # NEW
│   │       ├── due-services-table.tsx             # NEW
│   │       ├── maintenance-jobs-table.tsx         # NEW
│   │       ├── service-schedule-modal.tsx         # NEW
│   │       ├── maintenance-job-modal.tsx          # NEW
│   │       ├── hire-bill-list.tsx                 # NEW
│   │       ├── hire-bill-modal.tsx                # NEW
│   │       ├── equipment-categories-table.tsx     # NEW
│   │       ├── equipment-doc-types-table.tsx      # NEW
│   │       ├── hire-rates-table.tsx               # NEW
│   │       ├── utilization-summary-cards.tsx      # NEW
│   │       ├── utilization-band-chart.tsx         # NEW — recharts, research.md §3
│   │       └── utilization-table.tsx              # NEW
│   └── dashboard/
│       └── plant/
│           ├── page.tsx                           # NEW — equipment list
│           ├── [id]/page.tsx                      # NEW — detail (Overview + Documents)
│           ├── logbook/page.tsx
│           ├── fuel/page.tsx
│           ├── maintenance/page.tsx
│           ├── hire-bills/page.tsx
│           ├── categories/page.tsx
│           ├── doc-types/page.tsx
│           ├── rates/page.tsx
│           └── utilization/page.tsx
├── middleware.ts                                    # MODIFIED — /dashboard/plant/* permission
│                                                    #   mapping (ASSET_REGISTER/LOGBOOK/FUEL/
│                                                    #   MAINTENANCE/HIRE_BILLS/MACHINERY_SETTINGS)
├── package.json                                     # MODIFIED — adds `recharts`
└── app/ui/dashboard/nav-links.tsx                    # unchanged (already points at /dashboard/plant)
```

**Structure Decision**: Single Next.js App Router project (`buildcore-web`), substantially filling
out `app/dashboard/plant/` (previously just a `nav-links.tsx` entry with no real destination). No
existing feature's routes, components, or contracts change.

## Complexity Tracking

*No entries — the one new dependency (`recharts`) was pre-approved via constitution amendment
before this plan was written, not introduced as an undocumented violation.*
