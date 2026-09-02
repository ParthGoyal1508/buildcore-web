# Implementation Plan: Project Assets Frontend

**Branch**: `012-project-assets` | **Date**: 2026-09-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/012-project-assets/spec.md`

## Summary

Build six route areas under `/dashboard/assets/*` — Register, Stock, Summary, Requests, Transfers,
and Reminders — plus a three-tab Masters modal and an "Assets in custody" panel mounted into 005's
employee screen. Key UI behaviours: a single Stock screen serving both serialised and bulk assets
with On Hand / Allocated / In Transit as separate columns so quantities visibly reconcile mid-transfer,
a form that switches fields on the category's tracking mode, live availability hints read from the
stock API, and a Transfers screen whose In Transit tab makes the two-step gap visible.

**Created by the 2026-09-01 gap-closure pass** against the module/submodule matrix, which found
row 36 uncovered. **Schema and navigation boundary ratified 2026-09-01**: Assets is a distinct
navigation entry from Inventory and Plant so a user never guesses which module holds an item.

## Technical Context

**Language/Version**: TypeScript 5.7, Next.js 16 (App Router), React 19 — unchanged.

**Primary Dependencies**: Existing only — `react-hook-form` + `zod`, `@tanstack/react-query`,
`formatCurrency` (008), `StatusBadge` (007/008), `ResponsiveList` (006/009), `skeletons.tsx`. No new
dependency.

**Storage**: N/A — all data in `buildcore-api` feature 012.

**Testing**: Manual per quickstart.md, plus a targeted check that quantities reconcile on screen
during a transfer (SC-002).

**Performance Goals**: Stock table renders 500 rows within 3 seconds, matching 009's established
target.

**Constraints**: All API calls through `app/lib/api/assets.ts`; site/project and vendor dropdowns
reuse the existing `projects.ts` and `partners.ts` modules; reminders render from the global
Reminders centre built by the 004 amendment, never evaluated here (spec FR-013); book value is shown
without any depreciation-schedule or accounting language (spec FR-011).

**Scale/Scope**: ~7 route files, ~20 components, ~26 typed API functions.

## Constitution Check (Frontend Principles)

| Principle | Check | Status |
|---|---|---|
| I. Component-based, server-first | Server Components by default; `"use client"` confined to modals, filters, and tab controls. Data shaping in `app/lib/`. | PASS |
| II. No inline styles | Tailwind + `clsx` throughout; no numeric exception needed in this feature. | PASS |
| III. Centralized constants | Routes, status names, condition labels, and badge colour maps in a constants module (spec FR-018). | PASS |
| IV. Type safety + zod | Every response validated at the boundary (spec FR-005). | PASS |
| V. API access boundary | All calls via `app/lib/api/assets.ts` (spec FR-004). | PASS |
| VI. Responsive Design: Desktop-First, Mobile-Critical Surfaces (NON-NEGOTIABLE) | Desktop-first (constitution v2.0.0): the asset register, allocations and transfer approvals are administrative. Lists designed at desktop width, wide tables scroll in their own container, unbroken at 768px; `ResponsiveList` optional (see Amendment 2026-09-02); every control keyboard-operable (spec FR-024, FR-025). | PASS |
| `middleware.ts` route guard | `/dashboard/assets/*` guarded with `ASSETS`; report routes additionally `REPORTS` (spec FR-002). | PASS |

## Project Structure

```text
app/dashboard/assets/
├── layout.tsx
├── register/page.tsx
├── stock/page.tsx
├── summary/page.tsx
├── requests/page.tsx
├── transfers/page.tsx
└── reminders/page.tsx

app/lib/api/assets.ts
app/ui/assets/                # ~20 components per data-model.md
  └── assets-in-custody.tsx   # mounted into 005's employee screen (spec FR-028)
middleware.ts                  # MODIFIED — /dashboard/assets/* mapping
nav-links.tsx                  # MODIFIED — distinct "Assets" entry
```

## Implementation Phases

### Phase 1: Shared Infrastructure

- [ ] Add a distinct "Assets" nav group to `nav-links.tsx` — separate from Inventory and Plant
- [ ] Create `app/dashboard/assets/layout.tsx` (breadcrumb + sub-nav)
- [ ] Create `app/lib/api/assets.ts` with all typed API function stubs
- [ ] Extend `middleware.ts` with a `/dashboard/assets/*` matcher — `ASSETS`, plus `REPORTS` on
      report sub-routes (spec FR-002)
- [ ] Add asset routes, status names, condition labels, and badge colour maps to constants
- [ ] Reuse the `usePermission` affordance so `ASSETS_APPROVE` actions are **not rendered** without
      the permission (spec FR-003)

**Checkpoint**: Nav, layout, API module, route guard, and constants ready.

### Phase 2: Types and zod schemas

- [ ] Define every interface and zod schema in `app/lib/api/assets.ts` — data-model.md
- [ ] Include a permissive fallback so an unrecognised status, condition, or reminder type renders
      with a neutral badge and its raw label (spec FR-026)

**Checkpoint**: All types defined.

### Phase 3: US1 & US2 — Masters and Register (P1) 🎯 MVP

- [ ] `CategoryTab.tsx`, `DocTypeTab.tsx`, `ConditionGradeTab.tsx`; `MastersModal.tsx` composing all
      three (established multi-tab pattern)
- [ ] Tracking mode rendered read-only with a tooltip once assets exist; inspection-interval
      conditional requirement enforced client-side
- [ ] `AssetForm.tsx`: **fields switch on the category's tracking mode** — Serial Number for
      serialised, Quantity + Unit for bulk, never both (spec FR-006); capitalisation-vs-purchase date
      cross-field validation; duplicate serial 409 inline with a link
- [ ] `AssetTable.tsx` (`ResponsiveList`): code, name, category, site, custodian, status, condition,
      book value, expiry marker visible without opening the detail
- [ ] `AssetDetail.tsx` with Documents / Allocations / Transfers / Inspections / Repairs tabs
- [ ] Document upload with typed `accept` and progress; failure does not roll back the asset
      (spec FR-022)

**Checkpoint**: Assets registerable and browsable.

### Phase 4: US3 — Stock and Summary (P1)

- [ ] `StockTable.tsx`: serialised rows individually; bulk aggregated per site with **On Hand,
      Allocated, and In Transit as separate columns** so quantities visibly reconcile during a
      transfer (spec FR-007); tracking-mode filter
- [ ] `SummaryView.tsx`: grouping by category / project / status; counts, original cost, accumulated
      depreciation, book value, company total; scrapped in its own bucket
- [ ] Book value rendered with **no depreciation schedule and no accounting terminology**
      (spec FR-011)
- [ ] Export reusing the established synchronous / async handling (spec FR-023)

**Checkpoint**: The "Project Assets" view (assets rolled up per project) works.

### Phase 5: US4 — Allocation and Custody (P1)

- [ ] `AllocateModal.tsx`: custody required conditionally; custodian site-mismatch 400 surfaced
      inline on the Custodian field; **live availability hint read from the stock API with Save
      disabled when exceeded** (spec FR-008)
- [ ] `ReturnModal.tsx`: condition grade drives the resulting status, **shown in the confirmation
      before it is applied** (spec FR-012)
- [ ] Overdue markers on allocations past their expected return
- [ ] `assets-in-custody.tsx` panel + the mount point in 005's employee screen (spec FR-028) —
      coordinate with 005's amendment (its FR-040)

**Checkpoint**: Allocation, custody, and the exit-flow custody view all work.

### Phase 6: US5 & US6 — Requests and Transfers (P2)

- [ ] `RequestForm.tsx` + `RequestTable.tsx`; approve/reject hidden without the permission; reject
      requires a reason; overdue marker
- [ ] Fulfil picker restricted to Idle assets; "Mark procurement needed" links to the Inventory
      purchase flow — this module never creates a purchase (spec US5 scenario 6)
- [ ] `TransfersTabs.tsx`: In Transit / Received / Cancelled, In Transit first with a count badge
      (spec FR-009)
- [ ] Acknowledge Receipt rendered only for the destination site; read-only awaiting state for the
      source
- [ ] Partial bulk receipt shows the shortfall in the confirmation and marks the closed transfer
      with a visible shortage indicator (spec FR-010)
- [ ] Concurrent-receipt 409 refreshes the tab to the already-received state

**Checkpoint**: The in-transit gap is visible and acknowledgement is enforced.

### Phase 7: US7 & US8 — Inspection/Repair and Reminders (P2)

- [ ] `InspectionModal.tsx`: Condemn outcome not offered without the approve permission;
      condemn-while-allocated 409 surfaced with the remedy
- [ ] `RepairModal.tsx`: open/close with computed downtime; cumulative-cost threshold marker
- [ ] `RemindersView.tsx`: **renders from the global Reminders centre's source** (004 amendment),
      pre-filtered to assets — never a second evaluation (spec FR-013)
- [ ] Snooze with until-date and reason; scrapped assets excluded; distinct empty state

**Blocked by**: the 004 amendment's Reminders centre must land first.

### Phase 8: Polish

- [ ] Verify `formatCurrency` on every monetary field and `StatusBadge` on every status/condition
- [ ] Verify skeleton / empty / error-with-retry on every list (spec FR-027)
- [ ] TypeScript type check (`npx tsc --noEmit`)
- [ ] Spot-check every screen at 320px and for keyboard operability
- [ ] Confirm on screen that On Hand + Allocated + In Transit reconciles to the registered total
      during an active transfer (SC-002)
