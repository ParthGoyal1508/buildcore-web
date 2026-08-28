# Quickstart: Validating the HR & Payroll Frontend

## Prerequisites

- `buildcore-api`'s HR & Payroll module (`specs/005-hr-payroll-backend`) running locally with
  seeded company/departments/designations/document types/shifts/sites.
- `npm run dev` in `buildcore-web`, signed in as a Super Admin or HO User.
- No automated test framework exists yet in this repo — every scenario below is a manual check.

## Scenario 1 — Employee record (User Story 1)

1. Navigate to `/dashboard/hr/employees`, click Add Employee. **Expected**: eight-tab form opens.
2. Fill all tabs, switching between them. **Expected**: data persists across tab switches; save
   succeeds.
3. Attempt to navigate away mid-entry with unsaved changes. **Expected**: confirmation prompt.
4. Open the saved employee's Detail page. **Expected**: all eight/nine sub-tabs render.
5. Locate a masked Aadhaar/PAN field; click Reveal. **Expected**: unmasked value shown (and only
   that field, not all PII fields at once).

## Scenario 2 — Documents (User Story 2)

1. On the Documents tab, upload fewer than the mandatory set.
2. Attempt to mark that employee's attendance (Scenario 3). **Expected**: rejected with a message
   naming the missing document(s).
3. Upload the rest; retry. **Expected**: succeeds.
4. Upload a document expiring in 10 days. **Expected**: visible expiry warning on that row.

## Scenario 3 — Attendance admin (User Story 3)

1. Navigate to `/dashboard/hr/attendance`, select today + a site. **Expected**: table renders with
   status badges.
2. Mark/Edit an entry. **Expected**: table updates; Modifications modal shows the before/after
   diff.
3. Open Exceptions. **Expected**: out-of-geofence punches listed with distance.
4. Declare a holiday (all sites). **Expected**: today's status becomes Holiday for all employees.

## Scenario 4 — Leave admin (User Story 4)

1. Navigate to `/dashboard/hr/leave`. **Expected**: all-employee applications table.
2. Approve one, reject another (remarks required). **Expected**: badges update.

## Scenario 5 — Loans (User Story 7)

1. Navigate to `/dashboard/hr/loans`, create a loan. **Expected**: schedule renders correctly.

## Scenario 6 — Payroll and challans (User Stories 5, 6)

1. Navigate to `/dashboard/hr/payroll`, select a month, Generate. **Expected**: list populates;
   loan EMI appears as a deduction.
2. Open one employee's Salary Slip. **Expected**: full slip renders via the shared component;
   Download produces a PDF.
3. Mark as Processed. **Expected**: confirmation dialog explaining the lock; after confirming,
   editing controls disappear for that run.
4. Mark as Paid. **Expected**: status updates; confirm 003's `/my/salary` now shows this period for
   an included employee (separate tab/session).
5. Export the Bank Salary Sheet. **Expected**: file downloads.
6. Navigate to `/dashboard/hr/challans`, select the same month. **Expected**: PF/ESIC/PT tabs show
   figures matching the payroll run exactly.

## Scenario 7 — Employee transfer (User Story 8)

1. From an employee's record, choose Transfer to a second seeded company. **Expected**: Company
   column updates in the list; transfer appears in the Activity Log (Dashboard feature).

## Scenario 8 — Daily Worker Registry (User Story 9)

1. Navigate to `/dashboard/hr/daily-workers` as a supervisor assigned to a site. Enrol a worker
   with 3 photos. **Expected**: appears in registry with an auto-generated Worker ID.
2. Open the Attendance capture screen. Mark the worker present via face-match. **Expected**:
   status updates; photo/time recorded.
3. Repeat with manual marking (no camera). **Expected**: succeeds, visibly flagged as manual.
4. Select multiple workers, use "Mark Selected Present." **Expected**: all update in one action.
5. Check the wage summary for the site/period. **Expected**: correct payout figures; confirm none
   of these workers appear in Scenario 6's payroll run.

## Scenario 9 — Re-enrolment queue (User Story 10)

1. Seed a pending re-enrolment request (My Workspace employee-facing flow).
2. Navigate to the queue within Employees. **Expected**: listed with employee/site/reason.
3. Approve it. **Expected**: status updates.

## Scenario 11 — Offboarding & F&F (User Story 11)

1. From an active employee's Detail page, choose Initiate Exit with a Last Working Day and reason.
2. View the F&F summary. **Expected**: pending salary/EL encashment/loan recovery/net payable
   match the backend exactly.
3. Click Process. **Expected**: reuses the payroll-run confirmation UI; on completion (past Last
   Working Day), the employee's Status shows Inactive on both List and Detail.

## Scenario 12 — Reimbursements Admin (User Story 12)

1. Seed a Submitted claim (via My Workspace). Navigate to `/dashboard/hr/reimbursements`.
   **Expected**: claim listed with category/amount/status.
2. Approve it. **Expected**: status updates to Approved.
3. Mark it Paid (Direct). **Expected**: payment mode/date/reference recorded; status becomes Paid.
4. Reject a second claim without remarks. **Expected**: rejected (remarks required); with remarks,
   succeeds and the claim never appears in the Register's payable totals.

## Scenario 13 — Bulk Attendance Import (User Story 13)

1. From the Attendance screen, choose Import, download the template.
2. Upload a CSV mixing valid/invalid rows. **Expected**: row-level validation report; nothing
   committed yet.
3. Commit. **Expected**: only the previously-validated rows appear in the Daily Attendance view.

## Scenario 14 — Cross-cutting checks

1. Sign in as a role lacking each relevant permission; confirm access-denied for each of the eight
   `/dashboard/hr/*` areas independently.
2. Tab through every screen's controls using only the keyboard (camera capture excepted).
   **Expected**: visible focus, all reachable.
3. Resize every list screen to a mobile viewport. **Expected**: card layout, no horizontal scroll.
