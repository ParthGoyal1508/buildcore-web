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
3. Select a consent method, check acknowledgement, tap Enrol. **Expected**: "Face enrolled
   successfully," status becomes "Enrolled on {today}."
4. Reload the page. **Expected**: capture/Enrol controls are now locked/hidden; a "Request
   Re-enrolment" action is shown instead.
5. Deny camera permission (browser setting) and retry Capture on a fresh not-enrolled test account.
   **Expected**: clear "camera required" error, no crash.

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
