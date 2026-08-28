# Research: Inventory Frontend (Stock, Purchases, Issues, Transfers, Payments)

## 1. Route structure under `/dashboard/inventory/*`

**Decision**: Five route areas:
- `stock/page.tsx` — stock dashboard (primary landing page)
- `purchases/page.tsx` — purchase list
- `issues/page.tsx` — issue list
- `transfers/page.tsx` — transfer list
- `payments/page.tsx` — payment list

Masters (categories + items) is a two-tab modal launched from the Stock page header, not a
separate route (spec FR-011 and PRD "Masters button"). Nav entry: "Inventory" with sub-items:
Stock, Purchases, Issues, Transfers, Payments.

## 2. All five transaction forms are modals, not pages

**Decision**: New Purchase, New Issue, New Transfer, New Payment — all are modals. They are
opened from their respective list pages and also from the Stock page quick-action buttons.
Each uses `react-hook-form` + zod. Consistent with the Partners (007) vendor modal pattern.

**Rationale**: Transaction forms are small (5–8 fields); modals keep the user on the list/stock
context and avoid full navigations for frequent data entry operations.

## 3. Live Amount in Purchase modal

**Decision**: `react-hook-form` `watch(['quantity', 'rate'])` drives a computed `amount =
qty × rate` displayed as a read-only field. Server re-validates on submit (FR-002 spec).

## 4. Available-stock hint via API on item-site selection

**Decision**: When both `siteId` and `itemId` are selected in Issue or Transfer modals, the
frontend calls `GET /inventory/stock/:itemId/:siteId` and renders `{ inStock }` as a hint
below the Quantity field. This fires on `onChange` of either dropdown. A loading state prevents
stale hints. If the API returns no row (`inStock: 0`), the hint shows "No stock at this site."

**Rationale**: FR-003 requires the hint to be accurate at the time of selection, not cached
from a previous page load. A lightweight dedicated endpoint avoids re-fetching the full stock
table.

## 5. Payment modal: informational outstanding-balance label (corrected, see §9)

**Decision**: The Payment modal has no allocation table and no allocation inputs. On vendor
selection, the frontend fetches and displays the vendor's total outstanding balance as a
read-only label. Allocation of the payment amount against individual bills happens entirely
server-side via FIFO (FR-004) — the client never selects or splits bills.

## 6. Stock table query invalidation

**Decision**: On successful save from any of the four modals (Purchase, Issue, Transfer, from
Stock page), the `['inventory', 'stock', params]` react-query key is invalidated so the stock
table refreshes. From list pages (e.g. Purchases page), only the purchases query is invalidated;
users see the updated stock on next visit to the Stock page.

## 7. Item dropdown filtered for Issues

**Decision**: The Item dropdown in the Issue modal only shows items with `inStock > 0` for the
selected site. This is implemented by: (a) after a site is selected, call `GET /inventory/stock
?siteId=X` to get all item-site rows, then filter for `inStock > 0` to populate the dropdown.
When the site changes, the item selection resets (FR-005).

## 8. API client: `app/lib/api/inventory.ts`

**Decision**: All inventory API calls through `app/lib/api/inventory.ts`. Vendor dropdown in
Purchase/Payment modals reuses `getVendors()` from `app/lib/api/partners.ts` (no new function
needed). Site dropdown reuses `getSites()` from `app/lib/api/projects.ts`.

## 9. Corrections from the master-PRD alignment audit

**Manual bill-allocation UI removed (critical)**: The original plan.md Phase 8 and this file's
original §5 described a client-side allocation UI — `AllocationRow.tsx`, `useFieldArray` over
per-bill Amount inputs, a `getOutstandingBills()` fetch, and a live allocated/unallocated
counter gating Save. This directly contradicted spec.md's own FR-004 ("no manual bill
selection") and the backend's fully-automatic server-side FIFO design (buildcore-api
`009-inventory-backend`). §5 above and plan.md Phase 8 were rewritten to the corrected design:
an informational outstanding-balance label only, no allocation inputs, no `useFieldArray`. The
equivalent contradiction was independently found and fixed in two buildcore-api files for this
same feature (`quickstart.md` Scenario 5, `plan.md` Phase 7's unit-test description).

**`middleware.ts` route guard added**: The original plan omitted extending `middleware.ts` for
`/dashboard/inventory/*`, contradicting this app's own constitution (every route prefix must be
guarded). Added to plan.md Phase 1 and spec.md FR-012.

**`ResponsiveList`/keyboard-operability made explicit**: The original plan's list-component
bullets (Masters tabs, Stock, Purchases, Issues, Transfers, Payments) did not call out the
NON-NEGOTIABLE `ResponsiveList` + keyboard-operable requirement. All six were updated, and a
Phase 9 mobile/keyboard spot-check task was added, matching spec.md FR-013.
