# Quickstart: Validating the Machinery Frontend

## Prerequisites

- `buildcore-api`'s Machinery module (`specs/006-machinery-backend`) running locally with a
  seeded company, at least one Site, a Fuel-type Vendor, and the seeded Equipment Categories/Doc
  Types.
- `npm run dev` in `buildcore-web`, signed in as a Super Admin or HO User.
- No automated test framework exists yet in this repo — every scenario below is a manual check.

## Scenario 1 — Asset Register (User Story 1)

1. Navigate to `/dashboard/plant`, click Add Equipment. **Expected**: modal opens with all fields;
   save succeeds with an auto-generated Code.
2. Open the new machine's detail page. **Expected**: Overview + Documents tabs render.
3. Upload a document with an expiry date 10 days out. **Expected**: Expiring Soon status shown;
   the list view's Flags badge for that machine reflects it.
4. Apply Category/Ownership/Status/Site filters on the list. **Expected**: correctly filtered.

## Scenario 2 — Logbook (User Story 2)

1. Navigate to `/dashboard/plant/logbook`, Add Entry for the machine from Scenario 1. **Expected**:
   Opening Reading pre-filled; save succeeds; the machine's Current Reading (visible back on
   `/dashboard/plant`) updates.
2. Submit a second entry with Closing Reading below Opening. **Expected**: rejected without the
   meter-reset override; succeeds with it.

## Scenario 3 — Fuel (User Story 3)

1. Navigate to `/dashboard/plant/fuel`, Add Entry. **Expected**: Amount computed live; Vendor
   dropdown lists Fuel-type vendors only.
2. Apply a date range filter. **Expected**: Summary Totals bar reflects only the filtered set.
3. Record entries that push a machine's consumption rate over its category threshold. **Expected**:
   a fuel-variance flag appears on that machine, and the same alert appears via the Dashboard
   notification dropdown (no new code needed for that — research.md §8).

## Scenario 4 — Maintenance (User Story 4)

1. Navigate to `/dashboard/plant/maintenance`, create a Service Schedule for the machine.
2. Open a Maintenance Job linked to it. **Expected**: the machine's Status shows "Under
   Maintenance" on `/dashboard/plant` immediately.
3. Close the job with a Total Cost. **Expected**: Status reverts to Active; the schedule's Last
   Done/Remaining reset in Due Services.

## Scenario 5 — Hire Bills (User Story 5)

1. Attempt Add Hire Bill against an Owned machine. **Expected**: unavailable/rejected.
2. Add a Hire Bill against the Hired machine (mark it Hired first via Edit Equipment) for a period
   overlapping Scenario 2's logbook entries. **Expected**: Rate/Amount auto-populate.
3. Click Verify. **Expected**: Logbook Hours and Variance display; Status becomes Verified only if
   within threshold.
4. Click Mark Paid (only visible/enabled once Verified). **Expected**: TDS and Net Payable display;
   Status becomes Paid.

## Scenario 6 — Reference Data masters (User Story 6)

1. Navigate to `/dashboard/plant/categories`, edit the seeded category's fuel benchmark.
   **Expected**: saved; a subsequent Fuel entry (Scenario 3) reflects it.
2. Navigate to `/dashboard/plant/rates`, add a new Current rate for that category. **Expected**:
   the prior "Current" row's Effective To updates automatically.

## Scenario 7 — Utilization Report (User Story 7)

1. Navigate to `/dashboard/plant/utilization`. **Expected**: current month selected by default;
   summary cards, band chart, and table all render.
2. Change the Month Selector. **Expected**: all three sections refresh together.
3. Confirm the table is sorted by Utilization % ascending and each row's Band matches its styling.

## Scenario 8 — Cross-cutting checks

1. Sign in as a role lacking each relevant permission; confirm access-denied for each of the six
   `/dashboard/plant/*` permission areas independently.
2. Tab through every screen's controls using only the keyboard. **Expected**: visible focus, all
   reachable.
3. Resize every list screen to a mobile viewport. **Expected**: card layout, no horizontal scroll.
