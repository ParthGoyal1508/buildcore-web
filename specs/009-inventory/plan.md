# Implementation Plan: Inventory Frontend (Stock, Purchases, Issues, Transfers, Payments)

**Branch**: `009-inventory` | **Date**: 2026-08-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/009-inventory/spec.md`

## Summary

Build five route areas under `/dashboard/inventory/*` and a Masters modal on the Stock page —
Stock dashboard with quick-action buttons, Purchase/Issue/Transfer/Payment modals, and five list
pages. Key UI behaviours: live `qty × rate` Amount, available-stock hints via dedicated API,
live unallocated-balance counter in Payment modal with Save guard, and item dropdown filtered
to `inStock > 0` items for Issues. See [research.md](research.md) for all 8 decisions.

## Technical Context

**Language/Version**: TypeScript 5.7, Next.js 16 (App Router), React 19 — unchanged.

**Primary Dependencies**: Existing — `react-hook-form` + `useFieldArray` + zod,
`@tanstack/react-query`, `formatCurrency` (008), `StatusBadge` (007/008). No new dependency.

**Storage**: N/A — all data in `buildcore-api`.

**Testing**: Manual per quickstart.md.

**Performance Goals**: Stock table renders 500 rows in under 3 seconds (SC-004). Available-stock
hint appears within 500ms of item-site selection.

**Constraints**: All API calls through `app/lib/api/inventory.ts`; vendor/site dropdowns reuse
existing `partners.ts`/`projects.ts` API modules; `formatCurrency` on all monetary fields;
`StatusBadge` for payment status; unallocated-balance guard client-side before API call.

**Scale/Scope**: 5 route files, ~14 components, ~20 typed API functions.

## Constitution Check (Frontend Principles)

| Principle | Check | Status |
|---|---|---|
| No inline styles | Tailwind + clsx | PASS |
| No literal API strings | All endpoints in `app/lib/api/inventory.ts` | PASS |
| TypeScript + zod at boundaries | All schemas defined in data-model.md | PASS |
| API calls through `app/lib/api/` | `inventory.ts`; vendor/site from existing modules | PASS |
| Mobile-first responsive | Existing breakpoint conventions | PASS |

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
```

## Implementation Phases

### Phase 1: Shared Infrastructure

- [ ] Add "Inventory" nav group to `nav-links.tsx`: Stock, Purchases, Issues, Transfers, Payments
- [ ] Create `app/dashboard/inventory/layout.tsx` (breadcrumb + sub-nav)
- [ ] Create `app/lib/api/inventory.ts` with all typed API function stubs
- [ ] Ensure `formatCurrency` + `StatusBadge` (with `unpaid`=red, `part_paid`=yellow, `paid`=green
      payment status entries) exist from 007/008; add if not present

**Checkpoint**: Nav, layout, API module, and shared utilities ready.

### Phase 2: Phase 2 — TypeScript types and zod schemas

- [ ] Define all interfaces and zod schemas (`purchaseSchema`, `issueSchema`, `paymentSchema`
      with allocation refine) in `app/lib/api/inventory.ts` — data-model.md

**Checkpoint**: All types defined; components can be built with correct prop shapes.

### Phase 3: US1 — Item Masters (P1) 🎯 MVP

- [ ] `CategoryTab.tsx`: category table + inline add form; delete with 409 handling
- [ ] `ItemTab.tsx`: item table + add/edit form (Code read-only, Name, Category dropdown,
      Unit dropdown, Description); delete with 409 handling
- [ ] `MastersModal.tsx`: two-tab modal composing CategoryTab + ItemTab
- [ ] Wire from Stock page "Masters" button (Phase 4)

**Checkpoint**: Item/Category master data manageable via Masters modal.

### Phase 4: US2 — Stock Dashboard (P1)

- [ ] `StockTable.tsx`: table with all stock columns, all monetary via `formatCurrency`,
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
- [ ] `PurchaseListTable.tsx`: Date, Project, Item, Vendor, Qty, Rate, Amount, Bill link,
      PaymentStatus `StatusBadge`, Delete (with 409 guard)
- [ ] `app/dashboard/inventory/purchases/page.tsx`: list + filters (date range, project,
      vendor, payment status), "New Purchase" button opening `PurchaseModal`

**Checkpoint**: Purchase CRUD and list fully functional.

### Phase 6: US4 — Issues (P1)

- [ ] `IssueModal.tsx`: siteId (from `getSites()` in projects.ts), itemId (filtered to
      `inStock > 0` via stock query for selected site — resets on site change FR-005),
      `getStockHint()` call on item+site selection (FR-003), available qty hint below Quantity,
      date + quantity + issuedTo + remarks; `issueSchema` validation
- [ ] `IssueListTable.tsx` + `app/dashboard/inventory/issues/page.tsx`

**Checkpoint**: Issue creation with stock hint and over-issue inline error functional.

### Phase 7: US5 — Transfers (P2)

- [ ] `TransferModal.tsx`: fromSiteId, toSiteId (from-site = to-site client-side guard FR,
      `getStockHint()` on from-site item selection), itemId, date, qty, remarks
- [ ] `TransferListTable.tsx` + `app/dashboard/inventory/transfers/page.tsx`

**Checkpoint**: Transfer creation with source stock hint functional.

### Phase 8: US6 — Payments & Bill Allocation (P2)

- [ ] `AllocationRow.tsx`: bill info (Item, Date, Total, Remaining) + amount input;
      used in `useFieldArray`
- [ ] `PaymentModal.tsx`: vendorId dropdown (loads `getOutstandingBills()` on vendor change),
      amount + date + paymentMode + referenceNumber + allocation `useFieldArray`; live
      `allocated = sum(inputs)`, `unallocated = amount − allocated` counter (red + Save disabled
      if < 0 — FR-004); `paymentSchema` with allocation refine
- [ ] `PaymentListTable.tsx` + `app/dashboard/inventory/payments/page.tsx`

**Checkpoint**: Payment recording with live allocation guard fully functional.

### Phase 9: Polish

- [ ] Verify all monetary fields use `formatCurrency` across all 5 pages
- [ ] Verify all payment status displays use `StatusBadge`
- [ ] TypeScript type check (`npx tsc --noEmit`)
- [ ] Manual quickstart.md walkthrough
