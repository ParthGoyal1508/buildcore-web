---

description: "Task list for feature implementation"
---

# Tasks: Project Assets Frontend

**Input**: Design documents from `/specs/012-project-assets/`
**Tests**: Manual per quickstart, plus a targeted check that quantities reconcile on screen during an
active transfer (SC-002) and that Save is disabled when a quantity exceeds availability (SC-003).

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Shared Infrastructure

- [X] T001 [P] Add a **distinct "Assets" nav group** to `nav-links.tsx`, separate from Inventory and
      Plant, so a user never guesses which module holds an item
- [X] T002 Create `app/dashboard/assets/layout.tsx` (breadcrumb + sub-nav)
- [X] T003 Create `app/lib/api/assets.ts` with all typed API function stubs
- [X] T004 Extend `middleware.ts` with a `/dashboard/assets/*` matcher — `ASSETS`, plus `REPORTS` on
      report sub-routes (spec FR-002)
- [X] T005 [P] Add asset routes, status names, condition labels, and badge colour maps to constants
      (spec FR-018)
- [X] T006 [P] Reuse the `usePermission` affordance so `ASSETS_APPROVE` actions are **not rendered**
      without the permission (spec FR-003)

---

## Phase 2: Types and zod schemas

- [X] T007 Define every interface and zod schema in `app/lib/api/assets.ts` — data-model.md
- [X] T008 [P] Add `.catch()` fallbacks so an unrecognised status, condition, or reminder type
      renders with a neutral badge and its raw label (spec FR-026)

---

## Phase 3: US1 & US2 — Masters and Register (P1) 🎯 MVP

- [X] T009 [US1] `category-tab.tsx`: CRUD; **tracking mode read-only with a tooltip once assets
      exist**; inspection-interval conditional requirement enforced client-side
- [X] T010 [P] [US1] `doc-type-tab.tsx` and `condition-grade-tab.tsx` (grades carry isDamaged /
      isScrap with helper text explaining they drive return status)
- [X] T011 [US1] `masters-modal.tsx` composing all three tabs (established multi-tab pattern);
      category list shows asset count and total book value
- [X] T012 [US2] `asset-form.tsx`: **fields switch on the category's tracking mode** — Serial Number
      for serialised, Quantity + Unit for bulk, never both (spec FR-006)
- [X] T013 [US2] Capitalisation-vs-purchase date cross-field validation; duplicate serial 409 inline
      with a link to the existing asset
- [X] T014 [US2] `asset-table.tsx` (`ResponsiveList`): code, name, category, site, custodian, status,
      condition, book value, **expiry marker visible without opening the detail**
- [X] T015 [US2] `asset-detail.tsx` with Documents / Allocations / Transfers / Inspections / Repairs
      tabs
- [X] T016 [US2] Document upload with typed `accept` and progress; **a failed upload does not roll
      back the asset** (spec FR-022)
- [X] T017 [US2] Linked-purchase reference rendered as a navigable link to Inventory

---

## Phase 4: US3 — Stock and Summary (P1)

- [X] T018 [US3] `stock-table.tsx`: serialised rows individually; bulk aggregated per site with
      **On Hand, Allocated, and In Transit as separate columns** (spec FR-007)
- [X] T019 [US3] Tracking-mode filter; site and category filters without a full-page reload
- [X] T020 [US3] `summary-view.tsx`: grouping by category / project / status with counts, original
      cost, accumulated depreciation, book value, and a company total
- [X] T021 [US3] Scrapped assets in their own bucket, excluded from active counts and book value
- [X] T022 [US3] **Book value rendered with no depreciation schedule and no accounting
      terminology** (spec FR-011); all values from the API, never computed client-side
- [X] T023 [US3] Export reusing the established synchronous / async handling (spec FR-023)
- [ ] T024 [P] [US3] Confirm on screen that on-hand + allocated + in-transit reconciles to the
      registered total during an active transfer (SC-002)

**Checkpoint**: The matrix's "Project Assets" rollup per project works.

---

## Phase 5: US4 — Allocation and Custody (P1)

- [X] T025 [US4] `allocate-modal.tsx`: custody field conditional on the category; custodian
      site-mismatch 400 surfaced **inline on the Custodian field**
- [X] T026 [US4] **Live availability hint read from the stock API with Save disabled when exceeded**
      (spec FR-008) — never computed from a stale cache
- [X] T027 [US4] Second-allocation attempt disabled with a tooltip naming the existing allocation
- [X] T028 [US4] `return-modal.tsx`: condition grade drives the resulting status, **shown in the
      confirmation before it is applied** (spec FR-012)
- [X] T029 [US4] Overdue markers on allocations past their expected return date
- [X] T030 [US4] `assets-in-custody.tsx` panel plus its mount point in 005's employee screen
      (spec FR-028) — **coordinate with 005's amendment (its FR-040)**

---

## Phase 6: US5 & US6 — Requests and Transfers (P2)

- [ ] T031 [US5] `request-form.tsx` and `request-table.tsx` with status badges and an overdue marker
- [ ] T032 [US5] Approve/reject **not rendered** without the permission; reject requires a reason
- [ ] T033 [US5] Fulfil picker restricted to Idle assets only
- [ ] T034 [US5] "Mark procurement needed" linking to the Inventory purchase flow — **this module
      never creates a purchase itself**
- [ ] T035 [US6] `transfers-tabs.tsx`: In Transit / Received / Cancelled, In Transit first with a
      count badge (spec FR-009)
- [ ] T036 [US6] `dispatch-modal.tsx`; dispatch disabled for an allocated asset with an explanatory
      tooltip
- [ ] T037 [US6] `receipt-modal.tsx`: **Acknowledge Receipt rendered only for the destination site**;
      read-only awaiting state for the source
- [ ] T038 [US6] Partial bulk receipt: **shortfall shown in the confirmation and a visible shortage
      indicator on the closed transfer** (spec FR-010)
- [ ] T039 [US6] Condition-discrepancy marker; transit-overdue marker; Cancel hidden without the
      approve permission
- [ ] T040 [P] [US6] Concurrent-receipt 409 refreshes the tab to the already-received state

---

## Phase 7: US7 & US8 — Inspection/Repair and Reminders (P2)

- [ ] T041 [US7] `inspection-modal.tsx`: **Condemn outcome not offered** without the approve
      permission; condemn-while-allocated 409 surfaced with the remedy
- [ ] T042 [US7] Next-inspection-due shown on the detail after a completed inspection
- [ ] T043 [US7] `repair-modal.tsx`: open/close with computed downtime; cumulative-cost threshold
      warning marker
- [ ] T044 [US8] `reminders-view.tsx` rendering **from the global Reminders centre's source**,
      pre-filtered to assets — never a second evaluation (spec FR-013)
- [ ] T045 [US8] Type / site / severity filters; overdue first then soonest due; snooze with
      until-date and reason; scrapped assets excluded; distinct empty state

**Blocked by**: the 004 amendment's Reminders centre (its TA006–TA011) must land first.

---

## Phase 8: Polish

- [ ] T046 [P] Verify `formatCurrency` on every monetary field and `StatusBadge` on every
      status/condition
- [ ] T047 [P] Verify skeleton / empty / error-with-retry on every list (spec FR-027)
- [ ] T048 TypeScript type check (`npx tsc --noEmit`)
- [ ] T049 Spot-check every screen at 320px and for keyboard operability; wide tables scroll in their
      own container (SC-004)
- [ ] T050 Enumerate every backend conflict case and confirm each maps to a specific, actionable
      message (SC-006)

## Dependencies

```
Phase 1-2 → US1 → US2 → US3 (Stock/Summary)
                       → US4 (Allocation) → US5 (Requests)
                                          → US6 (Transfers)
                       → US7 (Inspection/Repair)
                       → US8 (Reminders — BLOCKED BY 004 amendment)

External: backend 012 must exist. 005's employee screen must expose the mount point for T030.
```

## Implementation Strategy

**MVP (Phases 1–4)**: masters, register, stock and summary — answers "where is my stuff".
**Increment 2 (Phases 5–6)**: allocation, custody, requests, transfers.
**Increment 3 (Phase 7)**: condition lifecycle and reminders (after 004).

---

## Implementation note — 2026-09-05 (Phases 1–5, T001–T030)

The MVP slice (US1, US2, US3, US4) is implemented and marked `[X]`. Phases 6–8
(T031–T050: requests, transfers, inspection/repair, reminders and polish) are
untouched and remain unchecked.

Verified: `npx tsc --noEmit` clean, `npm run lint` 0 errors, `npm run build` emits
`/dashboard/assets`, `/register`, `/register/[id]`, `/allocations`, `/stock`,
`/summary` and `/masters`. **Every zod schema in `app/lib/api/assets.ts` was parsed
against a response a booted API actually returned** — masters, register, detail,
stock, summary and allocation — not against `data-model.md`.

Deviations, and why:

- **T004 — there is no `middleware.ts` to extend.** Feature 001 keeps the access
  token in memory only, so middleware never sees it; feature 014 replaced the edge
  guard with `NAV_MODULES` + `ModuleGuard` + route-group layouts. The module tier is
  the `assets` entry in `NAV_MODULES` (`ASSETS`), and the one section needing more —
  Masters, which the backend gates on `SETTINGS` — is guarded in
  `app/dashboard/assets/layout.tsx`, exactly as Plant, Inventory, Partners, HR and
  Settings do. The spec's `REPORTS` clause has nothing to gate yet: the report
  sub-routes belong to Phase 7.
- **T002 — sub-nav, no breadcrumb.** Nothing else in this app renders breadcrumbs;
  every module uses `SectionTabs`. A breadcrumb here would be one screen's
  convention.
- **T011 — the masters are a page with local tabs, not a modal.** Three tables with
  behaviour attached to their rows is a screen, the same call Plant's masters made.
  `masters-modal.tsx` exists and holds the three *forms*, which is the part a dialog
  is right for.
- **T013 — the duplicate-serial 409 links to the register, not to the clashing
  asset.** The API's message names the existing asset's *code*, not its id, and a
  link needs an id. The code is parsed out of the message and shown, so the user can
  search for it in one step. Giving this a direct link means adding the id to that
  409, which is a backend change this slice did not need.
- **T014 — the expiry marker required a backend addition.** The register list had no
  expiry field to render. `AssetRow.expiryAlert` / `alertDocumentTypes` were added to
  `AssetService.decorate()` (each document against its own doc type's `alertDays`,
  never a module-wide constant) with an e2e covering it, so the list answers "is any
  paperwork about to lapse?" without opening an asset.
- **T015 — three tabs, not six.** Documents, Allocations and Stock. Transfers,
  Inspections and Repairs belong to Phases 6 and 7; empty tabs would promise screens
  that do not exist.
- **T023 — the export is synchronous only.** The API builds and streams the workbook
  in the request; there is no job to poll, because 004's US7 queue never shipped. See
  the backend's `AssetSummaryService` for the full reasoning.
- **T024 is deliberately left UNCHECKED.** It asks for an on-screen check that
  on-hand + allocated + in-transit reconciles *during an active transfer*. The Total
  column exists and is that sum, but transfers are Phase 6 — `inTransit` is
  structurally 0 today, so the check cannot actually be performed yet.
- **T030's mount point is the employee Overview tab** in
  `app/ui/hr/employee-detail-tabs.tsx`, gated on `ASSETS` rather than on an HR
  permission: it is the assets module's data, and it renders nothing when the person
  holds nothing.
- **`ASSETS` and `ASSETS_APPROVE` were added to `PERMISSIONS`.** The roles screen
  derives both of its groups from `NAV_MODULES`, so `ASSETS` appears under "Sidebar
  modules" labelled "Assets" and `ASSETS_APPROVE` under the rest, with no edit to
  `role-modal.tsx` beyond a stale count in its comment.
