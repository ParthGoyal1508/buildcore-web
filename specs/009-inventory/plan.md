# Implementation Plan: Inventory Frontend (Stock, Purchases, Issues, Transfers, Payments)

**Branch**: `009-inventory` | **Date**: 2026-08-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/009-inventory/spec.md`

## Summary

Build five route areas under `/dashboard/inventory/*` and a Masters modal on the Stock page —
Stock dashboard with quick-action buttons, Purchase/Issue/Transfer/Payment modals, and five list
pages. Key UI behaviours: live `qty × rate` Amount, available-stock hints via dedicated API, an
informational outstanding-balance label in the Payment modal (allocation itself is fully
automatic FIFO server-side — no client-side allocation UI), and item dropdown filtered to
`inStock > 0` items for Issues.

**Corrected during a master-PRD alignment audit**: this plan's original Phase 8 described a
manual bill-allocation UI (`AllocationRow.tsx`, `useFieldArray`, `getOutstandingBills()`, a live
allocated/unallocated counter gating Save) that directly contradicted spec.md's own FR-004 and
the backend's fully-automatic FIFO design — now corrected to match. Also added: a `middleware.ts`
permission guard for `/dashboard/inventory/*` (missing entirely from the original scope) and
explicit `ResponsiveList`/keyboard-operability requirements on every list screen (this app's own
NON-NEGOTIABLE constitution principle). See [research.md](research.md) for all 10 decisions (8
original + 2 corrections).

## Technical Context

**Language/Version**: TypeScript 5.7, Next.js 16 (App Router), React 19 — unchanged.

**Primary Dependencies**: Existing — `react-hook-form` + zod, `@tanstack/react-query`,
`formatCurrency` (008), `StatusBadge` (007/008). No new dependency.

**Storage**: N/A — all data in `buildcore-api`.

**Testing**: Manual per quickstart.md.

**Performance Goals**: Stock table renders 500 rows in under 3 seconds (SC-004). Available-stock
hint appears within 500ms of item-site selection.

**Constraints**: All API calls through `app/lib/api/inventory.ts`; vendor/site dropdowns reuse
existing `partners.ts`/`projects.ts` API modules; `formatCurrency` on all monetary fields;
`StatusBadge` for payment status; bill allocation is fully server-side FIFO — no client-side
allocation logic or guard.

**Scale/Scope**: 5 route files, ~14 components, ~20 typed API functions.

## Constitution Check (Frontend Principles)

| Principle | Check | Status |
|---|---|---|
| No inline styles | Tailwind + clsx | PASS |
| No literal API strings | All endpoints in `app/lib/api/inventory.ts` | PASS |
| TypeScript + zod at boundaries | All schemas defined in data-model.md | PASS |
| API calls through `app/lib/api/` | `inventory.ts`; vendor/site from existing modules | PASS |
| VI. Responsive Design: Desktop-First, Mobile-Critical Surfaces (NON-NEGOTIABLE) | Desktop-first (constitution v2.0.0): store and procurement work is desk-operated. All six list screens (Masters tabs, Stock, Purchases, Issues, Transfers, Payments) designed at desktop width with wide tables scrolling in their own container, unbroken at 768px; `ResponsiveList` optional (see Amendment 2026-09-02); every interactive control keyboard-operable (spec FR-013). | PASS |
| `middleware.ts` route guard | `/dashboard/inventory/*` guarded with `INVENTORY`/`SETTINGS` per sub-route (corrected — spec FR-012, missing from original scope) | PASS |

## Project Structure

```text
app/dashboard/inventory/
├── layout.tsx
├── stock/page.tsx
├── purchases/page.tsx
├── issues/page.tsx
├── transfers/page.tsx
└── payments/page.tsx

app/lib/api/inventory.ts
app/ui/inventory/    [14 components per data-model.md]
middleware.ts         # MODIFIED — /dashboard/inventory/* permission mapping (INVENTORY/SETTINGS)
```

## Implementation Phases

### Phase 1: Shared Infrastructure

- [ ] Add "Inventory" nav group to `nav-links.tsx`: Stock, Purchases, Issues, Transfers, Payments
- [ ] Create `app/dashboard/inventory/layout.tsx` (breadcrumb + sub-nav)
- [ ] Create `app/lib/api/inventory.ts` with all typed API function stubs
- [ ] Ensure `formatCurrency` + `StatusBadge` (with `unpaid`=red, `part_paid`=yellow, `paid`=green
      payment status entries) exist from 007/008; add if not present
- [ ] Extend `middleware.ts` with a `/dashboard/inventory/*` route matcher (`INVENTORY`/
      `SETTINGS` per sub-route — spec FR-012)

**Checkpoint**: Nav, layout, API module, shared utilities, and route guard ready.

### Phase 2: Phase 2 — TypeScript types and zod schemas

- [ ] Define all interfaces and zod schemas (`purchaseSchema`, `issueSchema`, `paymentSchema`
      — no allocations field, FIFO is server-side) in `app/lib/api/inventory.ts` — data-model.md

**Checkpoint**: All types defined; components can be built with correct prop shapes.

### Phase 3: US1 — Item Masters (P1) 🎯 MVP

- [ ] `CategoryTab.tsx`: category table + inline add form; delete with 409 handling
- [ ] `ItemTab.tsx`: `ResponsiveList`-based, keyboard-operable (FR-013) item table + add/edit
      form (Code read-only, Name, Category dropdown, Unit dropdown [all 8 values], Reorder
      Level, HSN Code — FR-014, Description); delete with 409 handling
- [ ] `MastersModal.tsx`: two-tab modal composing CategoryTab + ItemTab
- [ ] Wire from Stock page "Masters" button (Phase 4)

**Checkpoint**: Item/Category master data manageable via Masters modal.

### Phase 4: US2 — Stock Dashboard (P1)

- [ ] `StockTable.tsx`: `ResponsiveList`-based, keyboard-operable (FR-013), all stock columns,
      a visible below-reorder-level flag per row (FR-014), all monetary via `formatCurrency`,
      four quick-action buttons (New Purchase, New Issue, New Transfer, Masters — each opens
      respective modal)
- [ ] `app/dashboard/inventory/stock/page.tsx`: `StockPage` — renders `StockTable`, hosts
      all four modals; wire `@tanstack/react-query` with `['inventory', 'stock', params]` key;
      invalidate stock query on any modal save

**Checkpoint**: Stock page renders with live data and hosts all quick-action modals.

### Phase 5: US3 — Purchases (P1)

- [ ] `PurchaseModal.tsx`: siteId + itemId + vendorId (from `getVendors()` in partners.ts)
      + date + quantity + rate + bill file upload (`<input type="file" accept=".pdf,.jpg,.png">`);
      live Amount = qty × rate via `watch` (FR-002); `purchaseSchema` validation
- [ ] `PurchaseListTable.tsx`: `ResponsiveList`-based, keyboard-operable (FR-013), Date,
      Project, Item, Vendor, Qty, Rate, Amount, GRN Number (FR-016), Bill link, PaymentStatus
      `StatusBadge`, Delete (with 409 guard)
- [ ] `app/dashboard/inventory/purchases/page.tsx`: list + filters (date range, project,
      vendor, payment status), "New Purchase" button opening `PurchaseModal`

**Checkpoint**: Purchase CRUD and list fully functional.

### Phase 6: US4 — Issues (P1)

- [ ] `IssueModal.tsx`: siteId (from `getSites()` in projects.ts), itemId (filtered to
      `inStock > 0` via stock query for selected site — resets on site change FR-005),
      `getStockHint()` call on item+site selection (FR-003), available qty hint below Quantity,
      Activity/BOQ Item selector sourced from the selected site's project, required (FR-015),
      date + quantity + issuedTo + remarks; `issueSchema` validation
- [ ] `IssueListTable.tsx` (`ResponsiveList`-based, keyboard-operable, FR-013) +
      `app/dashboard/inventory/issues/page.tsx`

**Checkpoint**: Issue creation with stock hint and over-issue inline error functional.

### Phase 7: US5 — Transfers (P2)

- [ ] `TransferModal.tsx`: fromSiteId, toSiteId (from-site = to-site client-side guard FR,
      `getStockHint()` on from-site item selection), itemId, date, qty, remarks
- [ ] `TransferListTable.tsx` (`ResponsiveList`-based, keyboard-operable, FR-013) +
      `app/dashboard/inventory/transfers/page.tsx`

**Checkpoint**: Transfer creation with source stock hint functional.

### Phase 8: US6 — Payments (FIFO auto-allocation) (P2)

**Corrected** (research.md §9): no `AllocationRow.tsx`, no `useFieldArray`, no
`getOutstandingBills()` call, no client-side allocated/unallocated counter — allocation is fully
automatic server-side FIFO (spec FR-004), matching the backend's design exactly.

- [ ] `PaymentModal.tsx`: vendorId dropdown (from partners.ts); on vendor change, fetch and
      display the vendor's total outstanding balance as an informational label only — not an
      editable allocation list; amount + date + paymentMode + referenceNumber;
      `paymentSchema` validation (no allocations field)
- [ ] `PaymentListTable.tsx` (`ResponsiveList`-based, keyboard-operable, FR-013) +
      `app/dashboard/inventory/payments/page.tsx`: columns include Unallocated Balance; on save
      invalidate purchases query (payment status badges on PurchasesPage update)

**Checkpoint**: Payment recording with automatic FIFO allocation fully functional.

### Phase 9: Polish

- [ ] Verify all monetary fields use `formatCurrency` across all 5 pages
- [ ] Verify all payment status displays use `StatusBadge`
- [ ] TypeScript type check (`npx tsc --noEmit`)
- [ ] Spot-check every `ResponsiveList`-based screen (Masters, Stock, Purchases, Issues,
      Transfers, Payments) at a mobile viewport and for keyboard operability — FR-013
- [ ] Manual quickstart.md walkthrough

---

## Amendment 2026-09-01 — Material Indent Screens

Covers spec FR-017 to FR-025. Adds two route areas under `/dashboard/inventory/*`; adds one
permission (`INVENTORY_APPROVE`) to the middleware mapping.

**Key invariant**: approving an indent must not appear to reserve stock. The UI states this in
helper text (spec FR-021), and the existing issue-time validation remains the only enforcement
point — so this amendment cannot introduce a path that implies a reservation the backend does not
make.

**Constitution re-check**: Principle III — indent statuses and colour maps from constants.
Principle IV/V — new calls on the existing typed `app/lib/api/inventory.ts` with `zod`.
Principle VI — `ResponsiveList`, 44×44px targets, no horizontal page scroll at 320px. PASS.

### Phase A1: Types and API

- [ ] Extend `app/lib/api/inventory.ts` with indent functions and `zod` schemas
- [ ] Add indent status labels and colour maps to constants
- [ ] Extend the `middleware.ts` inventory mapping so approval sub-routes require
      `INVENTORY_APPROVE` (spec FR-017)

### Phase A2: US7 — Raise and track indents (P1)

- [ ] `IndentForm.tsx`: header plus a repeatable line editor **reusing the Activity/BOQ Item
      selector already built for the Issue modal** (spec FR-018) — not a second implementation
- [ ] Inactive-item field-level guard; Save disabled with zero lines
- [ ] `IndentTable.tsx` (`ResponsiveList`) with status badges and an overdue marker
- [ ] `IndentDetail.tsx` showing **Requested, Approved, Fulfilled, and Outstanding per line**
      (spec FR-019)
- [ ] Cancel 409 on any fulfilment; reason required otherwise

### Phase A3: US8 — Approve and fulfil (P2)

- [ ] `ApproveIndentModal.tsx`: per-line quantity reduction **requiring a reason**, with both
      Requested and Approved remaining visible afterwards
- [ ] Approve/Reject actions **not rendered** without `INVENTORY_APPROVE`
- [ ] "Create Issue" prefilled from an indent line; **outstanding shown as a live hint with Save
      disabled when exceeded** (spec FR-020), matching FR-003's stock-hint pattern
- [ ] Helper text stating approval does not reserve stock (spec FR-021)
- [ ] `ProcurementNeededView.tsx`: **indent demand and reorder shortfall as separate labelled
      sections, never summed** (spec FR-022)
- [ ] Purchase created from that view records the indent linkage

### Phase A4: Polish

- [ ] Mobile spot-check; `npx tsc --noEmit`
- [ ] Confirm outstanding always equals approved minus fulfilled on screen (SC-A01)
