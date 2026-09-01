# Data Model: Project Assets Frontend

**Feature**: `012-project-assets` | **Date**: 2026-09-01

All types are `z.infer` from schemas in `app/lib/api/assets.ts` (Principle IV). Applied at the API
boundary.

## zod schemas and inferred types

| Schema | Key fields | Notes |
|---|---|---|
| `assetCategorySchema` | name, trackingMode, depreciationRatePercent, usefulLifeYears, custodyRequired, inspectionRequired, inspectionIntervalDays?, assetCount, totalBookValue | `trackingMode` drives the whole form |
| `assetDocTypeSchema` | name, alertDays | |
| `conditionGradeSchema` | name, sequence, isDamaged, isScrap | The flags drive the return-status preview |
| `assetSchema` | assetCode, categoryId, name, manufacturer, modelNumber, serialNumber?, quantity?, unitOfMeasure?, purchaseDate, purchaseCost, capitalisationDate, salvageValue, vendorId?, purchaseId?, currentSiteId, currentCustodianId?, status, conditionGradeId?, nextInspectionDue?, bookValue | `bookValue` comes **from the API** — never computed client-side |
| `assetStatusSchema` | `z.enum([...]).catch('unknown')` | Satisfies spec FR-026 |
| `assetStockRowSchema` | assetId, siteId, quantityOnHand, quantityAllocated, quantityInTransit, unit, stockValue | Three separate quantity columns (spec FR-007) |
| `allocationSchema` | assetId, projectId, siteId, custodianEmployeeId?, quantity?, allocatedFrom, expectedReturnDate, actualReturnDate?, conditionOnReturnId?, status | |
| `transferSchema` | assetId, fromSiteId, toSiteId, quantity?, dispatchDate, transportMode, vehicleNumber?, dispatchConditionId, receivedDate?, receivedQuantity?, conditionOnReceiptId?, conditionDiscrepancy, transitShortage?, status | |
| `assetRequestSchema` | requestNumber, categoryId, assetId?, quantity, projectId, siteId, requiredByDate, justification, status | |
| `inspectionSchema` | inspectionDate, conditionGradeId, outcome, remarks | |
| `repairSchema` | repairDate, description, cost, vendorId?, expectedCompletionDate, actualCompletionDate?, downtimeDays, status | |
| `assetSummarySchema` | groupKey, count, originalCost, accumulatedDepreciation, bookValue | Scrapped returned as its own bucket |
| `assetReminderSchema` | type, assetId, subject, dueDate, daysRemaining, severity | Shape shared with the 004 Reminders centre |

## Client-side derived values

- `availableQuantity = quantityOnHand − quantityAllocated − quantityInTransit` — displayed as a live
  hint; **Save disabled when the request exceeds it** (spec FR-008), read from the API, never from a
  stale cache
- `resultingStatusPreview` — from the selected condition grade's `isDamaged`/`isScrap` flags, shown
  in the return confirmation before submit (spec FR-012)
- Reconciliation display: on-hand + allocated + in-transit, shown as separate columns (SC-002)

**Not computed client-side**: book value and accumulated depreciation always come from the API
(spec FR-011).

## Component inventory (`app/ui/assets/`)

| Component | Client? | Purpose |
|---|---|---|
| `masters-modal.tsx` | ✓ | Three-tab: categories, doc types, condition grades |
| `category-tab.tsx` | ✓ | Tracking mode read-only once assets exist |
| `asset-form.tsx` | ✓ | **Fields switch on tracking mode** (spec FR-006) |
| `asset-table.tsx` | – | `ResponsiveList` register with expiry marker |
| `asset-detail.tsx` | – | Tabs: documents, allocations, transfers, inspections, repairs |
| `stock-table.tsx` | – | Serialised rows + bulk aggregated with three quantity columns |
| `summary-view.tsx` | – | Grouped rollups, scrapped bucketed separately |
| `allocate-modal.tsx` | ✓ | Custody conditional, live availability hint |
| `return-modal.tsx` | ✓ | Condition grade with resulting-status preview |
| `assets-in-custody.tsx` | – | **Mounted into 005's employee screen** (spec FR-028) |
| `request-form.tsx` / `request-table.tsx` | ✓ / – | Raise, approve, fulfil, procurement-needed |
| `transfers-tabs.tsx` | ✓ | In Transit / Received / Cancelled |
| `dispatch-modal.tsx` / `receipt-modal.tsx` | ✓ | Two-step flow; shortage surfaced |
| `inspection-modal.tsx` / `repair-modal.tsx` | ✓ | Condemn hidden without permission |
| `reminders-view.tsx` | – | **Renders the 004 centre's data, pre-filtered** (spec FR-013) |

## Cross-module reads

| Need | Existing module |
|---|---|
| Sites and projects | `app/lib/api/projects.ts` |
| Vendors | `app/lib/api/partners.ts` |
| Employees (custodians) | HR module |
| Linked purchase | `app/lib/api/inventory.ts` |
| Reminders source | dashboard module (004 amendment) |

## Storage policy

No feature data in browser storage. Only the stock screen's tracking-mode filter preference may
persist per user.
