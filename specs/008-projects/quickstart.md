# Quickstart: Validating the Projects Frontend

## Prerequisites

- `buildcore-api` running locally with the projects backend migrations applied.
- Admin session active (`/login`).
- At least one company and one employee seeded (from 001–005 setup).

---

## Scenario 1 — Clients (User Story 1)

1. Navigate to `/dashboard/projects/clients`. **Expected**: empty table with "Add Client" button.
2. Click "Add Client", fill in Name, Contact Person, Phone, Email, and GSTIN. Save.
   **Expected**: modal closes, table shows the new client row.
3. Enter the same GSTIN again in a second add. **Expected**: inline error "GSTIN already exists".
4. Click Edit on the first client; change the phone number. **Expected**: table row updates.
5. Toggle the client to Inactive. **Expected**: status badge updates; if a Status filter is
   applied for Active, the row disappears.

---

## Scenario 2 — Sites (User Story 2)

1. Navigate to `/dashboard/projects/sites`. Click "Add Site".
2. Enter Name, Latitude `19.0760`, Longitude `72.8777`, Geofence Radius `200`, Status Active.
   **Expected**: modal saves and row appears.
3. Enter Latitude `91` (invalid). **Expected**: client-side validation error before submit.
4. Edit the site and change the radius. **Expected**: updated row.

---

## Scenario 3 — Project Portfolio (User Story 3)

1. Navigate to `/dashboard/projects/portfolio`. **Expected**: empty state with "Add Project".
2. Click "Add Project". Fill required fields (Name, Client, Location, Contract Value, Start Date,
   Status: Planning, Division: Contract). Save. **Expected**: code auto-populated (e.g. `PRJ-001`),
   project appears in list.
3. Apply Status filter → "Ongoing". **Expected**: the Planning project disappears.
4. Click Edit; change Status to "Ongoing". **Expected**: status badge updates to green.
5. In the Edit form, toggle "Is Locked". **Expected**: on save, a lock icon appears on the
   portfolio list row and a locked banner shows on the project detail page.
6. With the project locked, navigate to its detail page and try "Add DWR".
   **Expected**: button is disabled with "Project Locked" tooltip.

---

## Scenario 4 — Project Detail Tabs (User Story 4)

1. Click "View" on a project. **Expected**: detail page loads with nine tabs.
2. Click each tab in turn. **Expected**: each renders without error (empty states for tabs with
   no data yet).
3. Confirm the Overview tab shows Contract Value formatted as `₹X,XX,XXX` (Indian formatting).

---

## Scenario 5 — BOQ (User Story 5)

1. From a project detail page, navigate to the BOQ section (within the detail page or a sub-route).
2. Add a Task Group (BOQ No. `G001`, Name `Earthwork`, Scope Qty `500`).
3. Add two Task Items under the group. **Expected**: BOQ tree shows the group with two indented
   items.
4. Click "Import BOQ". Upload a 5-row Excel file where row 3 is missing the Unit column.
   **Expected**: "4 valid rows. 1 error." with a "Download Error Report" link — nothing written
   to the BOQ tree yet. Click "Confirm Import". **Expected**: "4 rows imported"; the 4 valid rows
   now appear in the BOQ tree.
5. Click the BOQ Alerts card. Select the "Delayed" tab. **Expected**: items past their Finish
   Date with pending qty appear; items on track do not.

---

## Scenario 6 — DWR (User Story 6)

1. Navigate to `/dashboard/projects/dwr`. Click "Add DWR".
2. Select the project, today's date, a supervisor, Weather: Clear.
3. In the Task section, select a BOQ Task Group and Task Item. **Expected**: Scope Qty, Done Qty,
   Pending Qty populate as read-only context.
4. Enter measurement values: Nos1=2, Nos2=1, Length=10, Breadth=1, Depth=1, Density=1.
   **Expected**: Actual Qty field shows `20` instantly (live computation).
5. Submit the DWR. **Expected**: DWR appears in the list with status "Submitted".
6. Check the BOQ tree for the project. **Expected**: the selected task item's Done Qty is still
   unchanged (only Approved DWRs count — master PRD §7.5.3).
7. Click "Approve". Confirm the dialog. **Expected**: status badge changes to "Approved" (green).
8. Check the BOQ tree for the project again. **Expected**: the selected task item's Done Qty is
   **now** 20.

---

## Scenario 7 — Revenue, RA Bills, P&L (User Stories 7 & 8)

1. On the project detail page, open the Revenue tab.
2. Add a Revenue entry: `₹5,00,000`, Status: Received.
3. Add an RA Bill: Bill No. `RA-001`, Amount `₹2,00,000`.
4. Click "Submit" on the RA Bill. **Expected**: status → Submitted (yellow).
5. Click "Approve". **Expected**: status → Approved (green).
6. Open the P&L tab. **Expected**: Revenue Booked card shows `₹7,00,000`.
7. Open the Budget form; enter Labour budget `₹3,00,000`. Save.
8. On the Costing tab, **Expected**: Labour row shows Budget `₹3,00,000`, Actual `₹0`
   (labour module stub), no overrun alert.
9. Change the P&L period selector to "Monthly". **Expected**: URL updates with `?period=monthly`,
   figures refresh.

---

## Scenario 8 — Locked project end-to-end

1. Lock a project with existing DWR and revenue data.
2. **Expected**: persistent banner "This project is locked — data entry is disabled" on all tabs.
3. Attempt "Add Revenue". **Expected**: button is disabled.
4. Attempt to edit the project form. **Expected**: save triggers a backend `423`; show toast
   "Project is locked".
5. Unlock the project. **Expected**: banner disappears; all action buttons re-enable.
