# Quickstart: Validating the Inventory Frontend

## Prerequisites

- `buildcore-api` running with inventory migrations applied. Admin session active.
- At least one vendor (Partners 007) and one project site (Projects 008) seeded.

---

## Scenario 1 — Item Masters (US1)

1. Navigate to `/dashboard/inventory/stock`. Click "Masters".
   **Expected**: two-tab modal opens (Categories, Items).
2. Categories tab: Add "CONCRETE". **Expected**: stored as "CONCRETE" (uppercase).
3. Items tab: Add "Concrete M20", Category CONCRETE, Unit CUM.
   **Expected**: auto-code (e.g. "ITM-001") assigned.
4. Delete CONCRETE (has linked item). **Expected**: inline "Category has linked items" error.

---

## Scenario 2 — Stock Dashboard and Quick Actions (US2)

1. Stock page initially empty (no purchases). **Expected**: empty table.
2. Click "New Purchase". **Expected**: Purchase modal opens.
3. Enter Qty=100, Rate=50. **Expected**: Amount = ₹5,000 shown live as read-only.
4. Complete and save. **Expected**: modal closes; stock table shows the new item-site row
   with `inStock: 100`, `Avg Rate: ₹50`, `Stock Value: ₹5,000` (formatCurrency).

---

## Scenario 3 — Issues with stock hint (US4)

1. From Stock page, click "New Issue". Select site + item with 100 in stock.
   **Expected**: hint shows "Available: 100 CUM" below Quantity field.
2. Enter Qty=150. Submit. **Expected**: inline error "Insufficient stock (available: 100)".
3. Enter Qty=60. Submit. **Expected**: modal closes; stock row updates to `inStock: 40`.
4. Change site in modal. **Expected**: item selection resets; hint clears.

---

## Scenario 4 — Transfers (US5)

1. Click "New Transfer". Select Site A → Site B, item with 40 in stock, Qty=15.
   **Expected**: saves; Site A inStock=25, Site B inStock=15 (refresh stock table).
2. Set From Site = To Site. **Expected**: inline "Source and destination cannot be the same"
   (client-side, before API call).

---

## Scenario 5 — Purchases list + delete (US3)

1. Navigate to `/dashboard/inventory/purchases`. **Expected**: purchase appears with
   Date, Project, Item, Vendor, Qty, Rate, Amount, Payment Status "Unpaid" (red badge).
2. Delete purchase (no allocated payments). **Expected**: row removed; stock refreshes.
3. Try to delete a purchase with an allocated payment.
   **Expected**: inline "Bill has allocated payments" error.

---

## Scenario 6 — Payments FIFO Auto-allocation (US6)

1. Navigate to `/dashboard/inventory/payments`. Click "New Payment".
2. Select vendor. **Expected**: outstanding balance label shows total unpaid amount for that
   vendor (e.g. "Outstanding: ₹8,000").
3. Enter Amount=₹7,000. Submit.
4. **Expected**: payment appears in list with `allocatedBillCount: 2` (oldest bill fully paid,
   second bill part-paid with ₹2,000 applied), `Unallocated Balance: ₹0`.
5. Go to Purchases page — oldest bill shows "Paid" (green), second shows "Part Paid" (yellow).
6. Delete the payment. **Expected**: both bills revert to prior status.
