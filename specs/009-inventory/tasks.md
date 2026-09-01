---

description: "Task list for feature implementation"
---

# Tasks: Inventory Frontend (Stock, Purchases, Issues, Transfers, Payments)

**Input**: Design documents from `/specs/009-inventory/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/inventory-web-api.md,
quickstart.md

**Tests**: No automated test framework. Verification via quickstart.md.

**Organization**: Tasks grouped by user story (US1–US6).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story (US1–US6)
- Every task includes an exact file path

---

## Phase 1: Setup (Shared Infrastructure)

- [ ] T001 [P] Add "Inventory" nav group to `app/ui/dashboard/nav-links.tsx`: Stock, Purchases,
      Issues, Transfers, Payments
- [ ] T002 [P] Create `app/dashboard/inventory/layout.tsx` (breadcrumb + sub-nav)
- [ ] T003 [P] Create `app/lib/api/inventory.ts` with all typed API function stubs and all
      TypeScript interfaces + zod schemas from data-model.md (including `paymentSchema` with
      allocation `refine`)
- [ ] T004 [P] Verify `formatCurrency` in `app/lib/utils.ts` and `StatusBadge` with
      `unpaid`=red, `part_paid`=yellow, `paid`=green entries exist; add if absent
      (should exist from 007/008)

- [ ] T004a [P] Extend `middleware.ts` with a `/dashboard/inventory/*` route matcher:
      `INVENTORY` for stock/purchases/issues/transfers/payments, `SETTINGS` for the
      Masters modal's underlying routes (a Settings-owned master, backend research.md §1)
      — FR-012, missing entirely from this feature's original task list, found during a
      master-PRD alignment audit

**Checkpoint**: Nav, layout, API module, shared utilities, and route guard ready.

---

## Phase 2: Foundational — Types and shared state

- [ ] T005 Implement all typed API functions in `app/lib/api/inventory.ts` (wiring `fetch`
      calls to the correct endpoints from contracts/inventory-web-api.md)

**Checkpoint**: All API functions implemented; components can make real calls.

---

## Phase 3: User Story 1 — Item Masters (Priority: P1) 🎯 MVP

**Goal**: Category and item CRUD via two-tab Masters modal launched from Stock page.

**Independent Test**: Open Masters modal from Stock page, create category and item, edit item,
delete unlinked category (success), delete linked category (inline error).

### Implementation for User Story 1

- [ ] T006 [P] [US1] Create `app/ui/inventory/CategoryTab.tsx`: table (name, item count,
      Delete icon), inline add-row form (Name input + submit); delete with 409 inline error
      handling ("Category has linked items")
- [ ] T007 [P] [US1] Create `app/ui/inventory/ItemTab.tsx`: `ResponsiveList`-based table
      (Code read-only, Name, Category, Unit, Reorder Level, HSN Code, Description, Edit/Delete),
      keyboard-operable (FR-013), Add/Edit form with category dropdown (`getCategories()`), unit
      dropdown (all 8 values), Reorder Level and HSN Code fields (FR-014); delete with 409
      handling
- [ ] T008 [US1] Create `app/ui/inventory/MastersModal.tsx`: two-tab modal composing
      `CategoryTab` + `ItemTab`; `@tanstack/react-query` with `['inventory','categories']`
      and `['inventory','items']` keys

**Checkpoint**: Item/Category master data manageable from the Masters modal.

---

## Phase 4: User Story 2 — Stock Dashboard (Priority: P1)

**Goal**: Stock table with all columns, live data, and four quick-action buttons opening
respective modals.

**Independent Test**: Open Stock page; verify all columns render with `formatCurrency` on
monetary fields; click all four quick-action buttons (modals open); verify stock table
refreshes after any modal save.

### Implementation for User Story 2

- [ ] T009 [P] [US2] Create `app/ui/inventory/StockTable.tsx`: `ResponsiveList`-based,
      keyboard-operable (FR-013), with Item, Project/Store, Category, Unit, Received, Issued,
      Transfer In, Transfer Out, In Stock, Avg Rate (₹), Stock Value (₹) columns, a visible
      below-reorder-level flag per row (FR-014); all monetary via `formatCurrency`; search + site
      + category filters; four header buttons (New Purchase, New Issue, New Transfer, Masters)
- [ ] T010 [US2] Create `app/dashboard/inventory/stock/page.tsx`: `StockPage` — renders
      `StockTable` + hosts `PurchaseModal`, `IssueModal`, `TransferModal`, `MastersModal`
      (each opened via their button); wire `@tanstack/react-query` `['inventory','stock',params]`
      key; invalidate stock query after any modal save success (FR-006)

**Checkpoint**: Stock dashboard functional; quick-action buttons open correct modals.

---

## Phase 5: User Story 3 — Purchases (Priority: P1)

**Goal**: Purchase modal with live Amount computation and bill file upload; purchases list
with payment status badge and delete.

**Independent Test**: Open New Purchase, enter qty=100 rate=50 → Amount shows ₹5,000 live;
upload a PDF bill; save → stock row updates. Delete unallocated purchase → success. Delete
allocated → inline error.

### Implementation for User Story 3

- [ ] T011 [P] [US3] Create `app/ui/inventory/PurchaseModal.tsx`: siteId dropdown (from
      `getSites()` in `app/lib/api/projects.ts`), itemId dropdown (`getItems()`), vendorId
      dropdown (`getVendors({active:true})` from `app/lib/api/partners.ts`), date, quantity,
      rate, live Amount = qty × rate via `react-hook-form` `watch` (FR-002), bill file upload
      (`<input type="file" accept=".pdf,.jpg,.png">` — FR-009); `purchaseSchema` validation;
      `multipart/form-data` POST
- [ ] T012 [P] [US3] Create `app/ui/inventory/PurchaseListTable.tsx`: `ResponsiveList`-based,
      keyboard-operable (FR-013), with Date, Project, Item, Vendor, Qty, Rate, Amount
      (formatCurrency), GRN Number (FR-016), Bill file link, Payment Status `StatusBadge`,
      Delete (confirmation dialog, 409 inline error "Bill has allocated payments")
- [ ] T013 [US3] Create `app/dashboard/inventory/purchases/page.tsx`: `PurchasesPage` —
      list + filters (date range, project, vendor, payment status), "New Purchase" button +
      `PurchaseModal`; wire `@tanstack/react-query`; on purchase save invalidate stock query

**Checkpoint**: Purchase creation, list, and delete functional.

---

## Phase 6: User Story 4 — Issues (Priority: P1)

**Goal**: Issue modal with available-stock hint (live API call on item-site change), item
dropdown filtered to `inStock > 0`, over-issue inline error.

**Independent Test**: Select site + item → hint shows available qty; enter qty > available →
submit → inline "Insufficient stock (available: N)"; enter valid qty → saves, stock updates.

### Implementation for User Story 4

- [ ] T014 [P] [US4] Create `app/ui/inventory/IssueModal.tsx`:
      - siteId dropdown (from projects.ts)
      - itemId dropdown: populated from `getStock({ siteId })` filtered to `inStock > 0`
        (research.md §7); resets when siteId changes (FR-005)
      - On itemId + siteId both selected: call `getStockHint(itemId, siteId)` and display
        "Available: N [unit]" hint below Quantity field (FR-003, research.md §4)
      - Activity/BOQ Item selector, sourced from the selected site's project (FR-015),
        required before submission
      - quantity, issuedTo, date, remarks; `issueSchema` validation
      - On `422` response: show inline "Insufficient stock (available: N)" error on Quantity
        field without navigating away (spec US4 AC2)
- [ ] T015 [P] [US4] Create `app/ui/inventory/IssueListTable.tsx` (`ResponsiveList`-based,
      keyboard-operable, FR-013) and `app/dashboard/inventory/issues/page.tsx`: list + filters
      (date range, project, item), "New Issue" button + `IssueModal`; on save invalidate stock
      query

**Checkpoint**: Issue creation with live stock hint and validation functional.

---

## Phase 7: User Story 5 — Transfers (Priority: P2)

**Goal**: Transfer modal with source stock hint, same-site client-side guard; transfer list.

**Independent Test**: Select fromSite + item → hint shows source stock; fromSite=toSite →
inline error before API call; qty > source stock → 422 inline error.

### Implementation for User Story 5

- [ ] T016 [P] [US5] Create `app/ui/inventory/TransferModal.tsx`:
      - fromSiteId dropdown, toSiteId dropdown (same sites source); zod refine:
        `fromSiteId !== toSiteId` (FR in spec, client-side guard)
      - itemId dropdown (from source site's stock, `inStock > 0`)
      - On fromSiteId + itemId: `getStockHint(itemId, fromSiteId)` → "Available at source: N"
      - quantity, date, remarks
      - On `400` (same-site from backend): show "Source and destination cannot be the same"
- [ ] T017 [P] [US5] Create `app/ui/inventory/TransferListTable.tsx` (`ResponsiveList`-based,
      keyboard-operable, FR-013) and `app/dashboard/inventory/transfers/page.tsx`: list +
      filters (date range, from/to project, item), "New Transfer" button + `TransferModal`; on
      save invalidate stock query

**Checkpoint**: Transfer CRUD with source-stock validation functional.

---

## Phase 8: User Story 6 — Payments (FIFO auto-allocation) (Priority: P2)

**Goal**: Payment modal showing an informational outstanding-balance label (no manual
allocation UI — FR-004); payments list.

**Independent Test**: Select vendor → outstanding balance label loads; submit payment → saves;
bills update statuses automatically via server-side FIFO (verify via bill list/statuses).

### Implementation for User Story 6

- [ ] T018 [P] [US6] Create `app/ui/inventory/PaymentModal.tsx`:
      - vendorId dropdown (from partners.ts `getVendors({active:true})`)
      - On vendorId change: fetch outstanding balance summary and display as informational
        label "Outstanding: ₹X" (FR-004 — no manual allocation table needed)
      - amount, date, paymentMode dropdown, referenceNumber
      - `paymentSchema` zod validation (no allocations array — FIFO is server-side)
- [ ] T019 [P] [US6] Create `app/ui/inventory/PaymentListTable.tsx` (`ResponsiveList`-based,
      keyboard-operable, FR-013) and `app/dashboard/inventory/payments/page.tsx`: list + filters
      (date range, vendor, payment mode), "New Payment" button + `PaymentModal`; columns include
      Unallocated Balance; on save invalidate purchases query (payment status badges on
      PurchasesPage update)
- [ ] T020 [P] [US6] Update `app/lib/api/inventory.ts`: add `createPayment(data)` POST
      (no allocations field), remove `getOutstandingBills` call — FIFO allocation is automatic

**Checkpoint**: Payment recording with FIFO auto-allocation fully functional.

---

## Phase 9: Polish & Cross-Cutting

- [ ] T021 [P] Verify all monetary fields use `formatCurrency` across all 5 pages and modals
- [ ] T022 [P] Verify all payment status displays use `StatusBadge` (Purchases list + Payments
      list)
- [ ] T023 [P] Verify item dropdown in IssueModal and TransferModal resets correctly when site
      changes (manual test per quickstart.md Scenario 3 step 4)
- [ ] T024 [P] Run TypeScript type check (`npx tsc --noEmit`) and fix issues
- [ ] T024a [P] Spot-check every `ResponsiveList`-based screen (Masters tabs, Stock, Purchases,
      Issues, Transfers, Payments) at a mobile viewport (card layout, no horizontal scroll) and
      for keyboard operability across all controls — FR-013

---

## Dependencies

```
Phase 1 → Phase 2 → US1 (Masters) ──────────────────────────────────┐
                 └── US2 (Stock) ──┬── US3 (Purchases) ─── US4 (Issues)
                                    │                    ├── US5 (Transfers)
                                    │                    └── US6 (Payments)
                                    └─ (stock table hosts all modals)
```

US1 and US2 can be built in parallel after Phase 2. US3 is needed before US4/US5/US6 so that
stock data exists in the database for testing those flows. US4 and US5 are independent of each
other. US6 is independent of US4/US5.

## Parallel execution opportunities

- T006, T007 (US1 tabs) and T009 (stock table) are parallel after Phase 2
- T011, T012 (purchase modal + table) are parallel
- T014, T015 (issue modal + list) and T016, T017 (transfer modal + list) are parallel
- T018 (PaymentModal), T019 (PaymentListTable), and T020 (API) are parallel
- T021–T024 (polish) are all independent

## Implementation Strategy

**MVP (Phase 1–6, US1–US4)**: Nav, layout, Masters modal, stock dashboard, purchases, and
issues. Delivers a complete daily workflow for stock tracking.

**Increment 2 (Phase 7, US5)**: Transfers.

**Increment 3 (Phase 8–9, US6 + polish)**: Payments, allocation UI, consistency checks.

---

## Amendment 2026-09-01 — Material Indent Screens

Covers spec FR-017 to FR-025 and plan Phases A1–A4. Task IDs prefixed `TA`. Adds one permission
(`INVENTORY_APPROVE`) to the middleware mapping.

**Key invariant**: the UI must never imply that approving an indent reserves stock (spec FR-021).
The existing issue-time validation remains the only enforcement point.

- [ ] TA001 Extend `app/lib/api/inventory.ts` with indent functions plus `zod` schemas
      (spec FR-023)
- [ ] TA002 [P] Add indent status labels and colour maps to constants (spec FR-025)
- [ ] TA003 Extend the `middleware.ts` inventory mapping so approval sub-routes require
      `INVENTORY_APPROVE` (spec FR-017)
- [ ] TA004 [US7] `indent-form.tsx`: header plus a repeatable line editor **reusing the Activity/BOQ
      Item selector already built for the Issue modal** (spec FR-018) — not a second implementation
- [ ] TA005 [US7] Inactive-item field-level guard; Save disabled with zero lines
- [ ] TA006 [US7] `indent-table.tsx` (`ResponsiveList`) with status badges and an overdue marker
- [ ] TA007 [US7] `indent-detail.tsx` showing **Requested, Approved, Fulfilled, and Outstanding per
      line** (spec FR-019)
- [ ] TA008 [US7] Cancel 409 when any fulfilment exists; a reason required otherwise
- [ ] TA009 [US8] `approve-indent-modal.tsx`: per-line quantity reduction **requiring a reason**,
      with both Requested and Approved remaining visible afterwards
- [ ] TA010 [US8] Approve/Reject actions **not rendered** without `INVENTORY_APPROVE`; Reject
      requires a reason
- [ ] TA011 [US8] "Create Issue" prefilled from an indent line; **outstanding shown as a live hint
      with Save disabled when exceeded** (spec FR-020), matching FR-003's stock-hint pattern
- [ ] TA012 [US8] **Helper text stating approval does not reserve stock** (spec FR-021)
- [ ] TA013 [US8] `procurement-needed-view.tsx`: **indent demand and reorder shortfall as separate
      labelled sections, never summed into one figure** (spec FR-022)
- [ ] TA014 [US8] A purchase created from that view records the indent linkage, reflected on the
      indent detail
- [ ] TA015 [P] Confirm outstanding always equals approved minus fulfilled on screen (SC-A01);
      `ResponsiveList` and 320px spot-check (spec FR-024); `npx tsc --noEmit`
