# Implementation Plan: Projects Frontend (Portfolio, Clients, Sites, BOQ, DWR, Revenue, P&L)

**Branch**: `008-projects` | **Date**: 2026-08-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/008-projects/spec.md`

## Summary

Build seven route areas under `/dashboard/projects/*` — Clients, Sites, Portfolio (list + detail +
create/edit), DWR list, BOQ management (within project detail), Revenue/RA Bills/Work Orders
(within project detail), and the P&L tab with period-selector URL routing. The DWR measurement
formula computes Actual Qty live in the browser. The project detail page is a nine-tab full-page
layout with a sticky tab strip. A `ProjectLockContext` propagates lock state across all tabs so
action buttons disable without prop drilling. All API calls go through `app/lib/api/projects.ts`.
See [research.md](research.md) for all nine decisions.

## Technical Context

**Language/Version**: TypeScript 5.7, Next.js 16 (App Router), React 19 — unchanged.

**Primary Dependencies**: Existing only — `react-hook-form` + `@hookform/resolvers` + `zod`,
`clsx`, `@heroicons/react`, `@tanstack/react-query`, `useSearchParams`/`useRouter` (Next.js
built-ins). No new dependency.

**Storage**: N/A — all data lives in `buildcore-api`.

**Testing**: No automated test framework installed (constitution's documented gap). Verification
via [quickstart.md](quickstart.md).

**Target Platform**: Desktop web (primary, admin-facing) + mobile web — responsive at existing
app breakpoints.

**Project Type**: Web application — `buildcore-web` frontend only. The backend it depends on is
specified separately in `buildcore-api/specs/008-projects-backend/`.

**Performance Goals**: Project detail page (all tab data) loads in under 3 seconds (covers API
latency + render). DWR Actual Qty live computation is instantaneous as the user types (SC-005).

**Constraints**: All `buildcore-api` calls through `app/lib/api/projects.ts` (Principle V); Indian
number formatting via shared `formatCurrency` utility in `app/lib/utils.ts` (research.md §8);
project lock state propagated via React context — no scattered `isLocked` prop drilling; P&L
period in URL query param for shareability (FR-006, research.md §6); status badges via shared
`StatusBadge` component (FR-009, research.md §9).

**Scale/Scope**: ~9 new route files, ~18 new components, ~25 typed API functions, 1 new React
context (`ProjectLockContext`), 1 shared utility function addition (`formatCurrency`).

## Constitution Check (Frontend Principles)

| Principle | Check | Status |
|---|---|---|
| I. No inline styles | All layout via Tailwind + `clsx`; no `style={}` attributes | PASS |
| II. No literal strings/URLs inline | All API endpoints in `app/lib/api/projects.ts`; all label strings in component props or a constants file | PASS |
| III. TypeScript strict + zod at boundaries | All form schemas are zod objects; all API response shapes are typed interfaces in data-model.md | PASS |
| IV. All API calls through `app/lib/api/` | Single `app/lib/api/projects.ts` (research.md §7) | PASS |
| V. Mobile-first, keyboard-operable | All new components follow the app's existing responsive and a11y conventions | PASS |
| VI. PII fields masked by default | No PII in this module; no special masking required | N/A |

## Project Structure

### Documentation (this feature)

```text
specs/008-projects/
├── plan.md                    # This file
├── research.md                # Phase 0 output
├── data-model.md              # Phase 1 output
├── quickstart.md              # Phase 1 output
└── contracts/
    └── projects-web-api.md    # Phase 1 output
```

### Source Code

```text
app/
├── dashboard/
│   └── projects/
│       ├── layout.tsx                     # Projects shell (breadcrumb, sub-nav)
│       ├── clients/page.tsx
│       ├── sites/page.tsx
│       ├── portfolio/
│       │   ├── page.tsx                   # Portfolio list
│       │   ├── new/page.tsx               # Create project
│       │   └── [id]/
│       │       ├── page.tsx               # Project detail (tabbed)
│       │       ├── edit/page.tsx          # Edit project
│       │       └── tabs/                  # 9 tab components
│       └── dwr/page.tsx
├── lib/
│   ├── api/
│   │   └── projects.ts                    # All typed API functions
│   └── utils.ts                           # MODIFIED: +formatCurrency
└── ui/
    └── projects/                          # All reusable project UI components
        └── [18 components per data-model.md]
```

## Implementation Phases

### Phase 1: Shared Infrastructure

- [ ] Add "Projects" nav group to `nav-links.tsx` with sub-items: Portfolio, DWR, Clients, Sites
- [ ] Create `app/dashboard/projects/layout.tsx` (breadcrumb + sub-nav shell)
- [ ] Add `formatCurrency(amount: number)` to `app/lib/utils.ts` if not already present
- [ ] Create `app/lib/api/projects.ts` with all typed API function signatures (can be stubs)
- [ ] Create `ProjectLockContext` (React context carrying `isLocked: boolean`)
- [ ] Create shared `StatusBadge` component (or extend existing) with project/DWR/RA Bill colour maps

**Checkpoint**: Nav, layout, API module, lock context, and currency formatter ready.

### Phase 2: Clients and Sites (US1 & US2 — P1)

- [ ] `app/dashboard/projects/clients/page.tsx` + `ClientModal.tsx`
- [ ] `app/dashboard/projects/sites/page.tsx` + `SiteModal.tsx`
- [ ] Lat/Lng client-side validation (FR-012)
- [ ] GSTIN format validation on ClientModal (FR in spec)

**Checkpoint**: Clients and Sites CRUD functional.

### Phase 3: Project Portfolio — List and Create/Edit (US3 — P1)

- [ ] `app/dashboard/projects/portfolio/page.tsx` + `ProjectListTable.tsx`
  (status filter, client filter, search, lock badge)
- [ ] `ProjectForm.tsx` (shared create/edit form with zod schema)
- [ ] `app/dashboard/projects/portfolio/new/page.tsx`
- [ ] `app/dashboard/projects/portfolio/[id]/edit/page.tsx`
- [ ] Lock toggle action with confirmation dialog

**Checkpoint**: Portfolio list, create, edit, and lock toggle functional.

### Phase 4: Project Detail Page — Tabs Shell (US4 — P1)

- [ ] `app/dashboard/projects/portfolio/[id]/page.tsx` with sticky tab strip (9 tabs)
- [ ] `ProjectLockContext.Provider` wrapping the detail page
- [ ] Locked project banner (persistent when `isLocked: true`)
- [ ] `OverviewTab.tsx`, `EmployeesTab.tsx`, `MachineryTab.tsx`, `MaterialsTab.tsx` (read-only)
- [ ] `DWRTab.tsx` (link to DWR list filtered by project)
- [ ] `BillsExpensesTab.tsx` shell (sub-tabs: Bills, Expenses, Work Orders — content in Phase 6)

**Checkpoint**: Detail page shell with all tabs navigable; data tabs show empty states.

### Phase 5: BOQ (US5 — P2)

- [ ] `BOQTree.tsx` (collapsible group/item tree with derived columns)
- [ ] Add Group / Add Item inline forms
- [ ] `BOQImportButton.tsx` (file upload + result display with error report download)
- [ ] `BOQAlertTabs.tsx` (Today Task / Delayed / To Be Delayed)

**Checkpoint**: BOQ management fully functional within project detail.

### Phase 6: DWR (US6 — P2)

- [ ] `app/dashboard/projects/dwr/page.tsx` + `DWRListTable.tsx`
- [ ] `DWRModal.tsx` with Task section
- [ ] `DWRTaskRow.tsx` with live Actual Qty computation (`react-hook-form` `watch`)
- [ ] Approve action with confirmation dialog
- [ ] DWR detail view

**Checkpoint**: DWR creation, submission, and approval functional; BOQ doneQty updates visible.

### Phase 7: Revenue, RA Bills, Work Orders (US7 — P3)

- [ ] `RevenueTab.tsx` complete (revenue entries + `RevenueModal.tsx`)
- [ ] `RABillCard.tsx` with Submit/Approve/Reject state actions + confirmation dialogs
- [ ] `WorkOrderModal.tsx` (6-tab modal: Work Detail, Terms, Requirements, Hire Contract,
  Material, Labour)

**Checkpoint**: Revenue and billing workflow functional; RA Bill approval triggers P&L refresh.

### Phase 8: P&L Dashboard (US8 — P3)

- [ ] `PnlTab.tsx` with `useSearchParams` period selector (URL param)
- [ ] `PnlSummaryCards.tsx` (5 cards with `formatCurrency`)
- [ ] `PnlCostBreakdown.tsx` (table with red/green variance, `costOverrunAlert` highlight)
- [ ] `PnlStatement.tsx` (equation display)
- [ ] `BudgetForm.tsx` (five-category upsert, integrated into Costing/P&L tab)
- [ ] `unavailableModules` indicator rendering

**Checkpoint**: Full P&L tab functional with period selector, budget entry, and overrun alerts.
