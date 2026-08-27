# Data Model: Machinery Module Frontend

`buildcore-web` holds no database of its own (Constitution Principle V). Every entity below is a
`zod`-validated client-side type mirroring `buildcore-api`'s
`specs/006-machinery-backend/data-model.md` field-for-field; only client-specific view shapes are
noted where they differ.

## Equipment

Full field set from the API spec's Equipment entity, plus a client-computed `flagsSeverity: 'none'
| 'warning'` derived from `flagsCount > 0` for badge styling.

## EquipmentDocument

`{ id, docTypeId, docTypeName, documentNumber?, expiresAt?, status: 'valid' | 'expiring_soon' |
'expired', uploadedAt }`.

## EquipmentCategory / EquipmentDocType

Mirror the API's shapes exactly, including `fuelVarianceThresholdPercent` and
`hireBillVarianceThresholdPercent` on Category.

## LogbookEntry

Mirrors the API's shape; `operatorName`/`siteName`/`machineName` joined server-side for display.

## FuelEntry

Mirrors the API's shape, including computed `amount`; list responses include a `totals` block
(Total Fuel, Total Cost, Average Consumption) per the applied filters.

## ServiceSchedule / MaintenanceJob

Mirror the API's shapes; ServiceSchedule includes a computed `remainingUnits` and
`isBelowTenPercent: boolean` for the red-flag styling.

## HireBill

Mirrors the API's shape (`billedHours`, `logbookHours?`, `varianceHours?`, `rate`, `amount`,
`tdsAmount?`, `netPayable?`, `status`).

## HireRate

Mirrors the API's shape (`ratePerUnit`, `effectiveFrom`, `effectiveTo`), with `effectiveTo: null`
rendered as "Current."

## Vendor (read-only reference type)

`{ id, name, type: 'fuel' | 'hire' | 'other' }` — display-only; no client-side mutation type, since
this feature has no vendor management UI (research.md §5).

## Cross-reference to `buildcore-api` and prior `buildcore-web` features

| Concept | Relationship |
|---|---|
| `Permission` values (`ASSET_REGISTER`/`LOGBOOK`/`FUEL`/`MAINTENANCE`/`HIRE_BILLS`/ `MACHINERY_SETTINGS`) | Reused verbatim from `buildcore-api`'s new enum values for route guards (research.md §6) |
| `ResponsiveList` | Reused from Settings, unchanged |
| Documents UI pattern | Visually mirrors HR & Payroll's `documents-tab.tsx`; own data-fetching functions (research.md §4) |
| Dashboard `WidgetRenderer` / notification dropdown | Unchanged — automatically renders this feature's new providers once the backend registers them (research.md §8) |
