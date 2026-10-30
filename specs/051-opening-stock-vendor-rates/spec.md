# Feature Specification (web): Opening Stock and Agreed Vendor Rates Import

**Branch**: `051-opening-stock-vendor-rates`
**Created**: 2026-10-30
**Source of truth**: `buildcore-api/specs/051-opening-stock-vendor-rates/spec.md`. Every decision is in its Clarifications section.

**Input**: The client's inventory workbooks (tabs: Item Categories, Items, Opening Stock, Vendor Rates) are to be loaded into production. There was nowhere to record opening stock, agreed vendor rates could not be entered up front, and the unit KL (kilolitre, for bitumen) was missing.

## Screens

- **Inventory → Opening stock** (`app/dashboard/inventory/opening-stock/page.tsx`, a new tab, with modals in `app/ui/inventory/opening-stock-modals.tsx`).
  - The table lists every entry: store, item and code, quantity with unit, rate ("No rate" badge when none was given, valued at 0), value and as-on date. A footer shows the count, how many have no rate, and the total value. A store filter narrows the list.
  - **Add opening stock** asks for the store, item, quantity, an optional rate and the as-on date (today by default, never in the future). Trying to add an item a second time at the same store says to replace the existing entry.
  - **Replace** and **Delete** are offered while the entry is editable. Once stock of the item has moved at that store, the row shows **Locked**, and its tooltip says to correct the stock with a purchase, issue or transfer.
  - **Import from Excel**: choose the .xlsx (the whole workbook is fine) and press **Check file**. The report shows rows, rows in error, rows without a rate and the value, with stores and items not found listed once. Each row shows its errors in red, "Replaces existing" or OK. When the report is clean, **Import N rows** writes everything. If rows repeat existing entries, a "Replace the N existing entries" tick is required first.
  - **Download template** gives the client's five columns.
- **Inventory → Agreed rates** (`app/dashboard/inventory/agreed-rates/page.tsx`, a new tab).
  - The table lists the rates in force: vendor, item and code, rate per unit, from date, and who set it ("First purchase" or "Imported"). A vendor filter narrows the list.
  - **Import from Excel** shows a report with counts of New, Unchanged, Conflict, Daily-rate item and Error, plus the names not found. Each row shows its result with a hint; a conflict names the rate in force and its date, and says to raise a rate change. **Record N new rates** writes only the new ones.
  - **Download template**.
- **Units**: `KL` is added to `ITEM_UNITS`. The item master and composite unit pickers show "CODE — Name" (for example "KL — Kilolitre").

## Clarifications

- Q: Where do agreed rates show? → A: As an Inventory tab next to Daily rates, filterable by vendor, rather than on the vendor page in Partners. Nothing showed them before, and the rates are governed by INVENTORY. (decided by implementer, 2026-10-30, as the API spec records)
- Q: Should the import confirm without a separate check? → A: No. Confirm is offered only once the file has been checked and the report is clean. Choosing another file clears the report. (decided by implementer, 2026-10-30)
- Q: Phone width? → A: These are desk screens (Principle VI, desktop-first). The tables scroll inside their cards, and the page does not scroll sideways. (decided by implementer, 2026-10-30)

## Verification

- `eslint` on the changed files and `tsc --noEmit` pass.
- Visual check (headless Chromium against the 051 API on the local scratch DB `buildcore_051`, 2026-10-30):
  - the list showed a seeded entry;
  - an import with an unmatched store and item, a non-number quantity and an impossible date showed the report with those errors and no confirm;
  - the corrected file showed "Replaces existing" and the replace tick, and importing gave "1 added, 1 replaced", with the bitumen in KL marked "No rate";
  - the add form looked right;
  - the vendor rates import, with names differing in case and punctuation, showed 2 New, and recording them listed them as "Imported" beside first-purchase rates;
  - the stock ledger showed an "Opening stock" line;
  - the unit picker listed "KL — Kilolitre";
  - at 390px the page did not overflow.
