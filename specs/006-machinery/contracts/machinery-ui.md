# Contract: Machinery UI routes and `app/lib/api/machinery.ts`

Routes live under `app/dashboard/plant/` (research.md §1). Every function below is a typed wrapper
calling the corresponding `buildcore-api` endpoint in
`specs/006-machinery-backend/contracts/machinery-api.md`.

## `/dashboard/plant` (User Story 1)

**Pages**: `page.tsx` (list), `[id]/page.tsx` (detail — Overview + Documents).

**Functions**: `listEquipment(filters)`, `getEquipment(id)`, `createEquipment(input)`,
`updateEquipment(id, input)`, `listEquipmentDocuments(id)`, `uploadEquipmentDocument(id, input)`.

**Components**: `app/ui/machinery/equipment-list.tsx` (`ResponsiveList`-based, Flags badge),
`equipment-form-modal.tsx`, `equipment-detail-tabs.tsx`, `equipment-documents.tsx`
(research.md §4).

Guard: middleware requires `ASSET_REGISTER`.

## `/dashboard/plant/logbook` (User Story 2)

**Page**: `page.tsx` + `logbook-table.tsx`, `logbook-entry-modal.tsx`.

**Functions**: `listLogbookEntries(filters)`, `createLogbookEntry(input)`,
`updateLogbookEntry(id, input)`, `deleteLogbookEntry(id)`.

Guard: middleware requires `LOGBOOK`.

## `/dashboard/plant/fuel` (User Story 3)

**Page**: `page.tsx` + `fuel-table.tsx` (with totals bar), `fuel-entry-modal.tsx`.

**Functions**: `listFuelEntries(filters)` (returns `{ entries, totals }`), `createFuelEntry(input)`,
`updateFuelEntry(id, input)`, `deleteFuelEntry(id)`.

Guard: middleware requires `FUEL`.

## `/dashboard/plant/maintenance` (User Story 4)

**Page**: `page.tsx` + `due-services-table.tsx`, `maintenance-jobs-table.tsx`,
`service-schedule-modal.tsx`, `maintenance-job-modal.tsx`.

**Functions**: `listServiceSchedules(equipmentId?)`, `createServiceSchedule(input)`,
`listMaintenanceJobs(filters)`, `createMaintenanceJob(input)`,
`closeMaintenanceJob(id, totalCost)`.

Guard: middleware requires `MAINTENANCE`.

## `/dashboard/plant/hire-bills` (User Story 5)

**Page**: `page.tsx` + `hire-bill-list.tsx`, `hire-bill-modal.tsx`.

**Functions**: `listHireBills(filters)`, `createHireBill(input)`, `verifyHireBill(id)`,
`markHireBillPaid(id)`.

Guard: middleware requires `HIRE_BILLS`.

## `/dashboard/plant/categories`, `/doc-types`, `/rates` (User Story 6)

**Pages**: `categories/page.tsx`, `doc-types/page.tsx`, `rates/page.tsx`, each with its own
`*-modal.tsx`.

**Functions**: `listEquipmentCategories()`, `createEquipmentCategory(input)`,
`updateEquipmentCategory(id, input)`, `listEquipmentDocTypes()`, `createEquipmentDocType(input)`,
`updateEquipmentDocType(id, input)`, `listHireRates(categoryId)`, `createHireRate(input)`.

Guard: middleware requires `MACHINERY_SETTINGS`.

## `/dashboard/plant/utilization` (User Story 7)

**Page**: `page.tsx` + `utilization-summary-cards.tsx`, `utilization-band-chart.tsx` (`recharts`,
research.md §3), `utilization-table.tsx`.

**Functions**: `getUtilizationReport(month)`.

Guard: middleware requires `ASSET_REGISTER` (an analytical view over the same equipment data, not
a distinct permission area).

## Shared: `app/ui/dashboard/nav-links.tsx` (unchanged)

"Plant & Machinery" entry's target (`/dashboard/plant`) now resolves to real content instead of a
404.

## Shared: Dashboard `WidgetRenderer` / notification dropdown (unchanged)

No modification — automatically renders this feature's new Machinery Cost/Fuel Cost/Hire Bills
widgets and Document Expiry/Fuel Variance/Maintenance Due notifications once the backend registers
them (research.md §8).
