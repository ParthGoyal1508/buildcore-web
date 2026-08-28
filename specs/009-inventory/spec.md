# Feature Specification: Inventory Frontend (Stock, Purchases, Issues, Transfers, Payments)

**Feature Branch**: `009-inventory`

**Created**: 2026-08-28

**Status**: Draft

**Input**: User description: "Inventory Module (Stock, Purchases, Issues, Transfers, Payments,
Item & Category Masters) for the BuildCore ERP frontend (buildcore-web), per the PRD at
/Users/p0g02o7/Personal/ERP-Demo/docs/prd/07-inventory.prd.md. Nested under /dashboard/inventory/*.
Consumes the backend contract in buildcore-api/specs/009-inventory-backend/contracts/inventory-
api.md. Reuses: formatCurrency (Projects/008), StatusBadge (Partners/007), multi-tab modal
pattern (Settings/002, Projects/008)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manage Item Categories & Item Masters (Priority: P1)

An admin creates and manages material categories (CEMENT, STEEL, etc.) and individual items
(Cement OPC 43, TMT Bar 8mm) with auto-generated codes, from a Masters modal on the Stock page.

**Why this priority**: Items and categories are the foundational master data required before
any stock transaction. No dependencies.

**Independent Test**: Open the Masters modal from the Stock page, create a category "AGGREGATE",
create an item "20mm Aggregate" under it with Unit CUM, confirm it appears in item dropdowns in
Purchase/Issue/Transfer forms — without any actual stock transactions.

**Acceptance Scenarios**:

1. **Given** the Masters modal (accessible from Stock page header), **When** opened, **Then**
   it shows two tabs: Categories (table with name, item count, Delete) and Items (table with
   Code, Name, Category, Unit, Description, Edit/Delete).
2. **Given** the Add Category form, **When** Name is submitted, **Then** the category appears
   in the list; it is stored and displayed uppercase.
3. **Given** the Add/Edit Item form, **When** Name, Category, and Unit are submitted, **Then**
   the item appears with its auto-generated Code.
4. **Given** an item linked to purchases, **When** Delete is clicked, **Then** a `409` error
   is shown ("Item has transaction history — cannot delete").
5. **Given** item and category lists, **When** the modal is open, **Then** they are also
   available as options in the Purchase, Issue, and Transfer form dropdowns.

---

### User Story 2 - Stock Dashboard (Priority: P1)

An admin views the real-time stock table showing In Stock, Average Rate, and Stock Value for
all items across all sites, with quick-action buttons to open Purchase/Issue/Transfer/Masters
modals.

**Why this priority**: The primary daily-use screen; the entry point for all stock transactions.

**Independent Test**: With seeded purchase/issue data, open `/dashboard/inventory/stock`;
verify each row shows correct `inStock`, `avgRate` (₹), and `stockValue` (₹); filter by
site and category; confirm quick-action buttons open the correct modals.

**Acceptance Scenarios**:

1. **Given** the Stock page, **When** loaded, **Then** it shows a table with columns: Item,
   Project/Store, Category, Unit, Received, Issued, Transfer In, Transfer Out, In Stock,
   Avg Rate (₹), Stock Value (₹); all monetary values via `formatCurrency`.
2. **Given** filters (search, Project/Store, Category), **When** applied, **Then** the table
   narrows correctly without a full-page reload.
3. **Given** the page header, **When** viewed, **Then** four quick-action buttons are visible:
   "New Purchase", "New Issue", "New Transfer", "Masters" — each opens the respective modal.
4. **Given** an item-site with `inStock: 0`, **When** displayed, **Then** the row is still
   shown (zero-balance items remain visible).

---

### User Story 3 - Record Purchases (Priority: P1)

An admin records a material purchase from a vendor for a project store, uploads an optional
bill file, and sees the stock balance update immediately.

**Why this priority**: Purchases are the primary stock inflow. Depends on items (US1) existing.

**Independent Test**: Open the New Purchase modal, select site/item/vendor, enter qty 100 and
rate ₹50 (Amount auto-shows ₹5,000), upload a bill PDF, save; confirm the stock table row
for that item+site shows `received: 100`, `inStock: 100`, `avgRate: ₹50`.

**Acceptance Scenarios**:

1. **Given** the New Purchase modal, **When** Quantity and Rate are entered, **Then** Amount
   (Qty × Rate) is displayed live as a read-only computed field.
2. **Given** the Vendor dropdown, **When** opened, **Then** it shows active vendors from the
   Partners module (searchable by name).
3. **Given** the Purchase list at `/dashboard/inventory/purchases`, **When** loaded, **Then**
   it shows Date, Project, Item, Vendor, Qty, Unit, Rate, Amount, Bill (file link), Payment
   Status badge; filterable by date range, project, vendor, payment status.
4. **Given** a purchase with an uploaded bill file, **When** the bill file link is clicked,
   **Then** the file opens/downloads.
5. **Given** a purchase with no allocated payments, **When** Delete is confirmed, **Then** it
   is soft-deleted and the stock row updates; Purchase list row is removed.
6. **Given** a purchase with allocated payments, **When** Delete is attempted, **Then** a `409`
   error is shown ("Bill has allocated payments — unallocate before deleting").

---

### User Story 4 - Record Issues (Priority: P1)

An admin issues material from a project store to a person or work activity; quantity cannot
exceed available stock.

**Why this priority**: Issues are the primary stock outflow; required for pilferage tracking.

**Independent Test**: With 100 units in stock, open New Issue, enter qty 60 (→ saves, inStock
40); try qty 50 again (→ inline "insufficient stock" error); enter 40 (→ saves, inStock 0).

**Acceptance Scenarios**:

1. **Given** the New Issue modal, **When** an item with `inStock > 0` is selected for a site,
   **Then** the available quantity is shown as a hint below the Quantity field.
2. **Given** a Quantity exceeding available stock, **When** the form is submitted, **Then** a
   clear "Insufficient stock (available: X)" error is shown (from the backend `422` response)
   without navigating away.
3. **Given** the Issue list, **When** loaded, **Then** it shows Date, Project, Item, Issued To,
   Qty, Unit, Remarks; filterable by date range, project, item.
4. **Given** an issue record, **When** Delete is confirmed, **Then** it is soft-deleted and
   the stock balance reverts.

---

### User Story 5 - Record Stock Transfers (Priority: P2)

An admin records a material transfer between two project stores; source quantity is validated;
both stores' balances update.

**Why this priority**: Inter-site transfers are a common workflow; depends on stock existing.

**Independent Test**: With 100 units at Site A, transfer 30 to Site B; confirm Site A inStock
= 70, Site B inStock = 30; attempt 80 more from Site A (→ insufficient stock error).

**Acceptance Scenarios**:

1. **Given** the New Transfer modal, **When** a From Site and Item are selected, **Then** the
   available stock at the source site is shown as a hint.
2. **Given** From Site = To Site, **When** submitted, **Then** an inline "Source and destination
   cannot be the same" error is shown (client-side validation before API call).
3. **Given** the Transfer list, **When** loaded, **Then** it shows Date, From Project, To
   Project, Item, Qty, Unit, Status badge (Pending=gray, In Transit=orange, Received=green),
   Remarks; filterable by date range, from/to project, item, status.
4. **Given** a transfer, **When** the admin clicks "Mark In Transit" or "Mark Received",
   **Then** a confirmation dialog appears before the status PATCH call.

---

### User Story 6 - Record Payments (FIFO Auto-allocation) (Priority: P2)

An admin records a vendor payment; the system automatically applies it against the vendor's
unpaid/part-paid purchase bills in FIFO order (oldest bill first). Bill payment statuses update
immediately.

**Why this priority**: Completes the purchase-to-payment audit trail. Depends on purchases (US3).

**Independent Test**: With bills for a vendor (oldest ₹5,000 + newer ₹3,000), record payment
₹7,000 — oldest bill shows Paid badge, newer shows Part Paid badge; Payment list shows
`allocatedBillCount: 2` and `unallocatedBalance: ₹0`.

**Acceptance Scenarios**:

1. **Given** the New Payment modal, **When** a Vendor is selected, **Then** a summary of
   the vendor's outstanding balance (total unpaid amount) is shown as an informational label
   below the Vendor field — the admin enters a payment amount, the system handles allocation
   automatically.
2. **Given** the payment amount is submitted, **When** it is less than total outstanding,
   **Then** the oldest bills are paid first (FIFO); any remainder shows as `Unallocated`
   on the payment row.
3. **Given** a saved payment, **When** viewed in the Payment list, **Then** it shows Date,
   Vendor, Amount, Payment Mode, Reference, Allocated Bills count, Unallocated Balance.
4. **Given** a bill that reaches fully paid status, **When** displayed in the Purchase list,
   **Then** its Payment Status badge changes to "Paid" (green).

---

### Edge Cases

- What if the item dropdown in New Issue shows only items with stock > 0? → Correct per spec —
  but with filtering, if a user selects a site first, only items with stock at that site appear.
  If the user then changes the site, the item selection should reset.
- What if a vendor has no unpaid bills when the Payment modal opens? → The allocation list shows
  "No outstanding bills for this vendor"; the payment can still be recorded with `allocatedAmount: 0`.
- What if the stock table has hundreds of items? → Server-side pagination; items per page = 50
  (consistent with other list pages in this app).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: All routes MUST be under `/dashboard/inventory/*` and protected by JWT auth.
- **FR-002**: The Amount field in Purchase modal MUST compute `Qty × Rate` live client-side;
  the server re-validates on submit.
- **FR-003**: Available stock hints in Issue and Transfer modals MUST be read from the stock API
  at item-selection time (not static; refreshed when site/item changes).
- **FR-004**: The New Payment modal MUST show the vendor's total outstanding balance as an
  informational label; the admin enters only the payment amount (no manual bill selection).
- **FR-005**: The Item dropdown in Issue modal MUST show only items with `inStock > 0` for the
  selected site; when the site changes, the item selection resets.
- **FR-006**: Stock table balances MUST refresh after any Purchase/Issue/Transfer modal save
  (via `@tanstack/react-query` invalidation of the stock query).
- **FR-007**: All monetary values (Amount, Rate, Avg Rate, Stock Value) MUST use `formatCurrency`
  from `app/lib/utils.ts`.
- **FR-008**: Payment Status badges MUST use `StatusBadge` with distinct colours: Paid=green,
  Part Paid=yellow, Unpaid=red.
- **FR-009**: Purchase bill file upload MUST use `<input type="file">` with `accept=".pdf,.jpg,
  .png"`; file is sent as `multipart/form-data`.
- **FR-010**: All API calls MUST go through `app/lib/api/inventory.ts`.
- **FR-011**: The Masters modal MUST be two-tab (Categories, Items) using the established
  multi-tab modal pattern.
- **FR-012**: `middleware.ts` MUST guard `/dashboard/inventory/*` with the `INVENTORY` permission
  (`SETTINGS` for the Masters sub-route, since Categories/Items are Settings-owned masters per
  the backend's corrected placement), mirroring the backend's permission mapping — missing
  entirely from this feature's original scope, found during a master-PRD alignment audit.
- **FR-013**: Every list screen in this feature (Stock table, Purchases, Issues, Transfers,
  Payments, Masters tabs) MUST use the existing `ResponsiveList` component and be fully
  keyboard-operable, built into each screen's own implementation from the start — this app's
  constitution's NON-NEGOTIABLE mobile-first requirement, applied here the same way it already is
  on every other feature.
- **FR-014**: The Item tab of the Masters modal MUST include Reorder Level and HSN Code fields;
  the Stock table MUST visibly flag any row where `belowReorderLevel: true` (e.g. a warning
  badge/row highlight) — both fields were entirely missing from this feature's original scope.
- **FR-015**: The Issue modal MUST include an Activity/BOQ Item selector (sourced from the
  selected site's project), required before submission — missing from this feature's original
  scope; without it, the backend's now-required `activityId`/`boqItemId` field has no UI input.
- **FR-016**: The Purchase list and detail MUST display the auto-generated GRN number returned by
  the backend on save.

### Key Entities

- **ItemCategory**: Name (uppercase), Items count.
- **Item**: Code, Name, Category, Unit, Reorder Level, HSN Code, Description.
- **StockRow**: Item, Project/Store, Category, Unit, Received, Issued, Transfer In, Transfer Out,
  In Stock, Avg Rate (₹), Stock Value (₹), Below Reorder Level flag.
- **Purchase**: Date, Site, Item, Vendor, Qty, Rate, Amount, Bill file, GRN Number, Payment
  Status badge.
- **Issue**: Date, Site, Item, Issued To, Activity/BOQ Item, Qty, Remarks.
- **StockTransfer**: Date, From Site, To Site, Item, Qty, Remarks.
- **Payment**: Date, Vendor, Amount, Payment Mode, Reference, Allocated Bills count.
- **PurchaseBill**: Total Amount, Paid Amount, Payment Status badge (for allocation list).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A stock transaction (purchase/issue/transfer) is fully reflected in the Stock table
  within one page refresh after saving (no stale cache).
- **SC-002**: The bill allocation UI prevents over-allocation client-side — the Save button
  is disabled before the `400` is ever returned.
- **SC-003**: Available stock hint in Issue/Transfer modals is always accurate at the moment the
  item-site combination is selected (no stale value from a previous session).
- **SC-004**: All five list pages (Stock, Purchases, Issues, Transfers, Payments) render within
  3 seconds for a site with 200 items and 12 months of transactions.
- **SC-005**: Monetary values on all five pages use consistent Indian number formatting (₹ with
  lakhs/crores grouping).
- **SC-006**: Every list screen in this feature is fully usable (all actions reachable, no
  horizontal scroll) on a mobile viewport.

## Assumptions

- `formatCurrency` and `StatusBadge` already exist from Projects (008) / Partners (007).
- The vendor dropdown in Purchase and Payment modals calls `GET /partners/vendors?active=true`
  from `app/lib/api/partners.ts` — no new vendor API function needed in the inventory module.
- The project/site dropdown calls the Projects site list endpoint from `app/lib/api/projects.ts`.
- The Masters modal is accessible only from the Stock page, not as a separate nav item.
- No separate "Purchase Order" workflow is in scope — purchases represent direct receipt of
  materials, not pre-orders.
