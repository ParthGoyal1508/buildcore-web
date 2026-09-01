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

- [ ] T001 [P] Add a **distinct "Assets" nav group** to `nav-links.tsx`, separate from Inventory and
      Plant, so a user never guesses which module holds an item
- [ ] T002 Create `app/dashboard/assets/layout.tsx` (breadcrumb + sub-nav)
- [ ] T003 Create `app/lib/api/assets.ts` with all typed API function stubs
- [ ] T004 Extend `middleware.ts` with a `/dashboard/assets/*` matcher — `ASSETS`, plus `REPORTS` on
      report sub-routes (spec FR-002)
- [ ] T005 [P] Add asset routes, status names, condition labels, and badge colour maps to constants
      (spec FR-018)
- [ ] T006 [P] Reuse the `usePermission` affordance so `ASSETS_APPROVE` actions are **not rendered**
      without the permission (spec FR-003)

---

## Phase 2: Types and zod schemas

- [ ] T007 Define every interface and zod schema in `app/lib/api/assets.ts` — data-model.md
- [ ] T008 [P] Add `.catch()` fallbacks so an unrecognised status, condition, or reminder type
      renders with a neutral badge and its raw label (spec FR-026)

---

## Phase 3: US1 & US2 — Masters and Register (P1) 🎯 MVP

- [ ] T009 [US1] `category-tab.tsx`: CRUD; **tracking mode read-only with a tooltip once assets
      exist**; inspection-interval conditional requirement enforced client-side
- [ ] T010 [P] [US1] `doc-type-tab.tsx` and `condition-grade-tab.tsx` (grades carry isDamaged /
      isScrap with helper text explaining they drive return status)
- [ ] T011 [US1] `masters-modal.tsx` composing all three tabs (established multi-tab pattern);
      category list shows asset count and total book value
- [ ] T012 [US2] `asset-form.tsx`: **fields switch on the category's tracking mode** — Serial Number
      for serialised, Quantity + Unit for bulk, never both (spec FR-006)
- [ ] T013 [US2] Capitalisation-vs-purchase date cross-field validation; duplicate serial 409 inline
      with a link to the existing asset
- [ ] T014 [US2] `asset-table.tsx` (`ResponsiveList`): code, name, category, site, custodian, status,
      condition, book value, **expiry marker visible without opening the detail**
- [ ] T015 [US2] `asset-detail.tsx` with Documents / Allocations / Transfers / Inspections / Repairs
      tabs
- [ ] T016 [US2] Document upload with typed `accept` and progress; **a failed upload does not roll
      back the asset** (spec FR-022)
- [ ] T017 [US2] Linked-purchase reference rendered as a navigable link to Inventory

---

## Phase 4: US3 — Stock and Summary (P1)

- [ ] T018 [US3] `stock-table.tsx`: serialised rows individually; bulk aggregated per site with
      **On Hand, Allocated, and In Transit as separate columns** (spec FR-007)
- [ ] T019 [US3] Tracking-mode filter; site and category filters without a full-page reload
- [ ] T020 [US3] `summary-view.tsx`: grouping by category / project / status with counts, original
      cost, accumulated depreciation, book value, and a company total
- [ ] T021 [US3] Scrapped assets in their own bucket, excluded from active counts and book value
- [ ] T022 [US3] **Book value rendered with no depreciation schedule and no accounting
      terminology** (spec FR-011); all values from the API, never computed client-side
- [ ] T023 [US3] Export reusing the established synchronous / async handling (spec FR-023)
- [ ] T024 [P] [US3] Confirm on screen that on-hand + allocated + in-transit reconciles to the
      registered total during an active transfer (SC-002)

**Checkpoint**: The matrix's "Project Assets" rollup per project works.

---

## Phase 5: US4 — Allocation and Custody (P1)

- [ ] T025 [US4] `allocate-modal.tsx`: custody field conditional on the category; custodian
      site-mismatch 400 surfaced **inline on the Custodian field**
- [ ] T026 [US4] **Live availability hint read from the stock API with Save disabled when exceeded**
      (spec FR-008) — never computed from a stale cache
- [ ] T027 [US4] Second-allocation attempt disabled with a tooltip naming the existing allocation
- [ ] T028 [US4] `return-modal.tsx`: condition grade drives the resulting status, **shown in the
      confirmation before it is applied** (spec FR-012)
- [ ] T029 [US4] Overdue markers on allocations past their expected return date
- [ ] T030 [US4] `assets-in-custody.tsx` panel plus its mount point in 005's employee screen
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
