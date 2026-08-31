# Quickstart: Validating the My Workspace Frontend

## Prerequisites

- `buildcore-api`'s My Workspace module (`specs/003-my-workspace-backend`) running locally with a
  seeded, enrolled test employee, a seeded Site with a known geofence, and at least one Processed
  payroll period.
- `npm run dev` in `buildcore-web`, on a device/browser with camera + GPS (or browser dev-tools
  location override) available — a real phone or a desktop browser with permission-simulation.
- Browser dev tools' offline-mode toggle for Scenario 4.
- No automated test framework exists yet in this repo; every scenario below is a manual check.

## Scenario 1 — Face enrolment (User Story 1)

1. Sign in as a not-yet-enrolled test employee, navigate to `/my/face-enrol`. **Expected**: "Not
   enrolled yet," 0/5 counter, disabled Enrol.
2. Tap Capture 3 times. **Expected**: live camera preview each time, thumbnail grid grows, counter
   updates; Enrol remains disabled until consent is also checked.
3. Check the consent acknowledgement, tap Enrol. **Expected**: "Face enrolled successfully,"
   status becomes "Enrolled on {today}." No consent-method dropdown is shown at any point
   (FR-002a) — the checkbox is the whole consent step.
4. Reload the page. **Expected**: capture/Enrol controls are now locked/hidden; a "Request
   Re-enrolment" action is shown instead, and **no "Withdraw consent" control appears** (FR-002b).
4a. Request re-enrolment, then reload. **Expected**: the pending-approval notice is shown with no
   "Withdraw consent" control beside it (FR-002b covers this state too).
5. Deny camera permission (browser setting) and retry Capture on a fresh not-enrolled test account.
   **Expected**: clear "camera required" error, no crash.

## Scenario 1b — Reimbursement claim (User Story 8)

1. Navigate to `/my/reimbursements` via the Claims tab. **Expected**: an empty history and a
   "New claim" button. If the company has no categories configured, a notice says so instead —
   run `COMPANY_SHORT_CODE=<code> npx ts-node prisma/seed-reimbursement-categories.ts` in
   `buildcore-api` to seed them.
2. Tap "New claim", pick Travel, enter an amount **above** its receipt threshold, fill the date
   and description, and attempt to submit without a receipt. **Expected**: Submit stays disabled
   and the form states the rule.
3. Attach a receipt photo and submit. **Expected**: the claim appears as "Pending review" with
   "Receipt attached".
4. File a second claim **below** the threshold with no receipt, using "Save as draft".
   **Expected**: it appears as "Draft" with Edit, Submit and Delete actions.
5. Tap Submit on the draft. **Expected**: it becomes "Pending review" and the row's actions
   collapse to Withdraw alone.
6. Tap Withdraw and confirm. **Expected**: the status becomes "Withdrawn" and no actions remain —
   it is not returned to Draft.

## Scenario 2 — Punch in/out (User Story 2)

1. As the enrolled employee, navigate to `/my/punch`. **Expected**: live clock, empty IN/OUT/
   WORKED boxes, "Punch In" button.
2. Tap Punch In, allow camera + location. **Expected**: IN TIME populates, button becomes "Punch
   Out."
3. Tap Punch Out. **Expected**: OUT TIME + WORKED populate.
4. Simulate an out-of-geofence location (dev tools override) and repeat a punch. **Expected**:
   punch still records (IN/OUT TIME updates) but shows a "pending supervisor review" notice.
5. Simulate low-accuracy location (or deny location). **Expected**: punch blocked before any
   network request, with a clear message.
6. Mark the current period payroll-locked in the backend test data; reload `/my/punch`.
   **Expected**: proactive "period locked" banner shown; attempting a punch anyway shows a clear
   rejection, no punch recorded.

### Scenario 2 additions (2026-09-01)

- After punching in, reopen `/my/punch`. **Expected**: the button reads "Punch Out" and an amber
  notice says when the shift started (FR-019d).
- After punching out, reload. **Expected**: no punch control at all — the In/Out/OT boxes plus a
  note that today's attendance is complete (FR-019c). A second punch of either kind is impossible
  from the UI, and the API refuses it with 409.
- With a punch-in left open on an *earlier* day, punching in today still works: that punch is not
  reported and does not block (backend FR-008a).
- Punch out. **Expected**: the button flips to "Punch In" immediately, without a reload, and a
  second tap is impossible rather than refused (FR-019b).
- Punch in shortly after local midnight, then check the attendance table for **today**.
  **Expected**: the punch appears on today's row, not yesterday's (backend FR-018a).
- Step the attendance month forward to the current month. **Expected**: the forward control is
  disabled; there is no way to reach a future month (FR-008).

## Scenario 3 — Attendance history (User Story 3)

1. Navigate month/year controls on `/my/punch`'s history table across a month with punches, an
   approved leave day, and a holiday. **Expected**: correct status badge per day.
2. Navigate to a month with no data. **Expected**: empty state, not an error.

## Scenario 4 — Offline punch (User Story 6)

1. Enable browser offline mode, attempt a punch (camera + location still work locally).
   **Expected**: "Queued — will sync when online" indicator, no error.
2. Disable offline mode. **Expected**: the queued punch auto-submits without any manual action;
   confirm it appears in attendance history with its original capture time, not the reconnect time.
3. Repeat step 1 with a `capturedAt` manipulated (via test override) to exceed the backend's max
   offline-queue age; reconnect. **Expected**: a clear per-punch failure notice, not a silent drop.

## Scenario 5 — Leave (User Story 4)

1. Navigate to `/my/leave`. **Expected**: balance table populated, financial-year selector present.
2. Apply for leave within balance, excluding a seeded weekend/holiday from the range.
   **Expected**: day count preview matches the exclusion; submission succeeds, appears Pending.
3. Apply for a non-LWP type exceeding balance. **Expected**: blocked inline, no submission sent.
4. Apply LWP far exceeding any balance figure. **Expected**: succeeds.
5. Cancel the Pending application from step 2. **Expected**: status becomes Cancelled, Cancel
   action disappears.
6. As backend admin, approve a different pending application; reload `/my/leave`. **Expected**:
   status shows Approved with any remarks — this is the "notification" per clarification (no
   separate notification UI).

## Scenario 6 — Salary slip (User Story 5)

1. Navigate to `/my/salary`. **Expected**: month selector shows only the seeded Processed period.
2. View that period's slip. **Expected**: all PRD-specified sections render.
3. Tap Download. **Expected**: a PDF is saved to the device with matching figures.

## Scenario 7 — Re-enrolment (User Story 7)

1. From the enrolled state (Scenario 1), tap "Request Re-enrolment," select a reason, submit.
   **Expected**: status becomes "Re-enrolment Requested (Pending Approval)."
2. As backend admin, approve the request; reload `/my/face-enrol`. **Expected**: a one-time
   "Re-enrol Now" action appears.
3. Complete fresh capture (3+ photos) + consent, submit. **Expected**: new enrolment date; "Re-enrol
   Now" no longer available on reload.

## Scenario 8 — Cross-cutting checks

1. Sign out; navigate directly to any `/my/*` URL. **Expected**: redirected to `/login`.
2. As a dual-role (admin + employee) test account, confirm a link to the admin dashboard is visible
   from within `/my/*`, and a "My Workspace" link is visible from the admin sidenav.
3. Tab through every screen's controls using only the keyboard (camera capture itself excepted).
   **Expected**: visible focus indicator throughout; all non-camera actions reachable and operable.
4. Resize every list screen (attendance history, leave applications) to a mobile viewport.
   **Expected**: no horizontal page scroll.
