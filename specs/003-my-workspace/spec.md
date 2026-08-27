# Feature Specification: My Workspace Frontend (Punch, Leave, Salary, Face Enrolment)

**Feature Branch**: `003-my-workspace`

**Created**: 2026-08-27

**Status**: Draft

**Input**: User description: "My Workspace Module (self-service employee portal: My Punch, My
Leave, My Salary Summary, Face Enrolment) for the BuildCore ERP frontend (buildcore-web), per the
PRD at /Users/parthgoyal/Projects/ERP-Demo/docs/prd/01-my-workspace.prd.md. This is the frontend/UI
surface only, at literal top-level /my/* routes with its own dedicated, mobile-first shell (bottom
tab bar, no desktop sidenav) — already confirmed with the user, since the primary users are field/
site employees on phones and there's no existing admin sidebar entry for this area (unlike
Settings). This frontend consumes the backend contract already specified in the buildcore-api
repo's own spec (specs/003-my-workspace-backend/contracts/my-workspace-api.md)."

## Clarifications

### Session 2026-08-27

- Q: Should My Workspace get its own dedicated, mobile-first shell, or reuse the existing admin
  DashboardLayout/SideNav? → A: Dedicated top-level `/my/*` shell (bottom tab bar for Punch/Leave/
  Salary/Face-Enrol, no desktop sidenav) — matches the PRD's own path names and its actual primary
  users (field/site employees on phones), rather than squeezing into the 8-module admin sidebar.
- Q: How should an employee be "notified" of a leave/re-enrolment decision, given no notification
  center exists elsewhere in this app? → A: In-app status only — no notification bell/toast/center
  is built; the status update is simply visible the next time the employee opens the relevant
  screen.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Enrol face biometrics (Priority: P1)

A new employee opens Face Enrolment, captures 3–5 photos via their device camera, acknowledges
biometric consent, and submits to become enrolled.

**Why this priority**: Punch In/Out's face verification (User Story 2) has nothing to compare
against until enrolment is complete — the true prerequisite, even though the PRD lists Punch first.

**Independent Test**: Can be fully tested by opening Face Enrolment on a device with camera access,
capturing 3 photos, checking the consent acknowledgement, submitting, and confirming the status
badge changes to "Enrolled on {date}."

**Acceptance Scenarios**:

1. **Given** an employee with no prior enrolment, **When** they open Face Enrolment, **Then** they
   see "Not enrolled yet," a Capture button, a 0/5 photo counter, and a disabled Enrol action.
2. **Given** the Capture button, **When** tapped, **Then** the device camera activates and a live
   preview is shown; each capture adds a thumbnail and increments the counter, up to 5.
3. **Given** fewer than 3 captured photos, **When** the employee attempts to submit, **Then** the
   Enrol action remains disabled — no submission is possible.
4. **Given** 3–5 captured photos and a checked consent acknowledgement (with a selected consent
   method), **When** Enrol is tapped, **Then** the photos are uploaded, a "Face enrolled
   successfully" confirmation appears, and the status badge updates to "Enrolled on {date}."
5. **Given** an already-enrolled employee, **When** they view Face Enrolment, **Then** the photo
   capture and Enrol controls are locked/hidden, replaced by a "Request Re-enrolment" action
   (User Story 7).
6. **Given** camera access is denied or unavailable, **When** Capture is attempted, **Then** a clear
   error state explains the camera is required and how to grant permission, rather than a silent
   failure.

---

### User Story 2 - Punch in/out with camera and GPS (Priority: P1)

An enrolled employee opens My Punch, sees a live clock and their current in/out/worked-hours state,
captures a live photo, and submits a punch — their device's GPS location is captured automatically
alongside it.

**Why this priority**: The core value proposition of this entire feature.

**Independent Test**: Can be fully tested by opening My Punch as an enrolled employee, tapping
Punch In with camera/location permission granted, and confirming the IN TIME box populates and the
button changes to "Punch Out"; then punching out and confirming WORKED hours appear.

**Acceptance Scenarios**:

1. **Given** an enrolled employee with no open punch-in today, **When** they open My Punch,
   **Then** they see a live clock, empty IN TIME/OUT TIME/WORKED boxes, and a "Punch In" button.
2. **Given** the "Punch In" button, **When** tapped, **Then** the camera activates for a live
   capture and the device's GPS location is requested; on successful submission, IN TIME populates
   and the button becomes "Punch Out."
3. **Given** an open punch-in, **When** "Punch Out" is tapped and submitted (camera + GPS again),
   **Then** OUT TIME and WORKED hours populate and the button returns to a Punch In state (for
   whatever the next expected action is, per backend response).
4. **Given** a punch submission whose backend response indicates a face-verification or geofence
   exception, **When** it's processed, **Then** the punch still records (IN/OUT TIME still
   populates) but a visible notice explains the punch is pending supervisor review, without
   blocking the employee from continuing their day.
5. **Given** a punch attempted for a date the backend reports as payroll-locked, **When** submitted,
   **Then** a clear "This period is locked" message is shown and no punch is recorded; a proactive
   banner also appears on My Punch when the current period is already locked, before any attempt.
6. **Given** GPS accuracy is below the required threshold or location access is denied, **When** a
   punch is attempted, **Then** it's blocked client-side with a clear message, without an
   unnecessary round trip to the backend.
7. **Given** the monthly attendance history table, **When** the employee navigates to a different
   month/year, **Then** it reloads showing that period's Date/Day/In/Out/OT/Status rows with the
   correct status badge color (Present green, Absent red, Weekly Off/Holiday gray, On Leave — a
   distinct badge).

---

### User Story 3 - View attendance history (Priority: P2)

An employee reviews their attendance for any month/year via the history table on My Punch.

**Why this priority**: A read-only extension of User Story 2 — valuable but naturally follows
punches existing to view.

**Independent Test**: Can be fully tested by navigating month/year controls and confirming the
table's rows and status badges match what punches/leave/holidays exist for that period.

**Acceptance Scenarios**:

1. **Given** a month with a mix of punches, an approved leave day, and a holiday, **When** viewed,
   **Then** each row shows the correct status badge.
2. **Given** a month with no data yet, **When** viewed, **Then** the table shows an empty state, not
   an error.

---

### User Story 4 - Apply for and manage leave (Priority: P2)

An employee views their leave balance by type, applies for leave via a form (auto-calculating
working days), views their application history, and cancels a still-pending one.

**Why this priority**: A distinct self-service capability, valuable once an employee exists with a
leave balance.

**Independent Test**: Can be fully tested by viewing a seeded balance, applying within it,
confirming it appears Pending in My Applications, then cancelling it.

**Acceptance Scenarios**:

1. **Given** My Leave, **When** opened, **Then** the Leave Balance table shows Opening/Accrued/
   Used/Balance per type for the selected financial year, with a year selector for historical
   views.
2. **Given** the Apply Leave form, **When** a From/To date range and Leave Type are chosen, **Then**
   the number of days is shown, computed excluding weekends/holidays, before submission.
3. **Given** a leave type other than Leave Without Pay, **When** the computed days would exceed the
   available balance, **Then** the form shows an inline validation error and blocks submission.
4. **Given** Leave Without Pay, **When** applying for any number of days, **Then** it is never
   blocked for balance reasons.
5. **Given** a submitted application, **When** it appears in My Applications, **Then** its status
   badge is Pending (yellow); once decided elsewhere, it becomes Approved (green) or Rejected (red)
   with any remarks shown, and the employee sees a notification of the decision.
6. **Given** a Pending application's Cancel action, **When** tapped and confirmed, **Then** its
   status becomes Cancelled and the action is no longer available for it; Cancel is not shown at
   all for non-Pending applications.

---

### User Story 5 - View and download salary slip (Priority: P2)

An employee selects a processed payroll month and views their salary slip, or downloads it as a
PDF.

**Why this priority**: A read-only, self-contained capability; depends on payroll having been run
for at least one period.

**Independent Test**: Can be fully tested by opening the month selector (confirming only Processed/
Paid months appear), viewing a slip, and downloading its PDF.

**Acceptance Scenarios**:

1. **Given** My Salary Summary, **When** the month selector opens, **Then** it lists only months
   whose payroll is Processed or Paid.
2. **Given** a selected month, **When** the slip loads, **Then** it shows the employee header,
   attendance summary, earnings, deductions, informational employer contributions, net pay (with
   amount in words), and the minimum-wages compliance note.
3. **Given** the same slip, **When** Download is tapped, **Then** a PDF matching the same figures is
   saved to the device.
4. **Given** an employee with no Processed/Paid months yet, **When** My Salary Summary is opened,
   **Then** an empty state explains no slips are available yet, not an error.

---

### User Story 6 - Punch while offline (Priority: P3)

An employee at a site with no connectivity still completes a punch; it's queued on-device and
synced automatically once connectivity returns, preserving the original capture time.

**Why this priority**: Important resilience for field conditions, but additive to User Story 2's
punch flow — buildable once punching itself works.

**Independent Test**: Can be fully tested by simulating offline mode, completing a punch (camera +
GPS still captured locally), confirming it shows a "queued, will sync" indicator, then restoring
connectivity and confirming it syncs and appears correctly in attendance history using its original
capture time.

**Acceptance Scenarios**:

1. **Given** no network connectivity, **When** a punch is completed (photo + GPS captured
   on-device), **Then** it's stored locally with a visible "Queued — will sync when online"
   indicator instead of failing outright.
2. **Given** one or more queued punches, **When** connectivity returns, **Then** they're
   automatically submitted in their original capture order without requiring the employee to
   re-open the app or retry manually.
3. **Given** a synced-from-queue punch, **When** it appears in attendance history, **Then** its time
   reflects the original on-device capture moment, not when it happened to sync.
4. **Given** a queue sync attempt that the backend rejects (e.g., too old), **When** that happens,
   **Then** the employee sees a clear notice for that specific punch rather than a silent drop.

---

### User Story 7 - Request and complete biometric re-enrolment (Priority: P3)

An enrolled employee whose face is no longer recognized requests re-enrolment; once an admin
approves it, they complete fresh photo capture within the granted window.

**Why this priority**: Depends on User Story 1; needed only once an employee's first enrolment has
gone stale.

**Independent Test**: Can be fully tested by requesting re-enrolment, confirming the status badge
changes to "Re-enrolment Requested (Pending Approval)," then (after an admin approves elsewhere)
confirming a one-time "Re-enrol Now" action appears and completing fresh capture.

**Acceptance Scenarios**:

1. **Given** an enrolled employee, **When** they tap "Request Re-enrolment" and select a reason,
   **Then** the status badge changes to "Re-enrolment Requested (Pending Approval)" and no further
   request can be submitted while one is pending.
2. **Given** an approved request, **When** the employee reopens Face Enrolment, **Then** a one-time
   "Re-enrol Now" action is available, unlocking fresh photo capture (min 3, max 5) and consent
   re-acknowledgement.
3. **Given** a rejected request, **When** the employee reopens Face Enrolment, **Then** it shows
   the rejection (with any admin remarks) and reverts to the normal enrolled state — no unlock.
4. **Given** the granted unlock, **When** it's used to complete fresh capture and submit, **Then**
   the enrolment date updates and the "Re-enrol Now" action is no longer available (consumed).
5. **Given** a granted unlock that expires after 7 days unused, **When** the employee reopens Face
   Enrolment after that window, **Then** "Re-enrol Now" is no longer available and a new request is
   required.

---

### Edge Cases

- What happens if an employee navigates directly to any `/my/*` route without a valid session? They
  are redirected to `/login`, same as any other authenticated route in this app.
- What happens if the device has no camera at all (e.g., a desktop browser used for testing)? Every
  camera-dependent action (enrolment capture, punch capture) shows a clear "camera required"
  message rather than a silent failure or crash.
- What happens if a queued offline punch's photo/GPS data is very large and storage is constrained?
  This feature does not need to solve unbounded storage — a reasonable number of queued punches
  (a single day's worth) is the expected case; this is noted as a scale assumption, not solved with
  special UI.
- What happens when My Workspace is opened by a user whose role also has admin/Settings access
  (e.g., a Site Admin who also punches in themselves)? A visible way to reach the admin dashboard
  area is available from within the My Workspace shell (and vice versa) for such dual-role users,
  without merging the two shells into one.
- What happens if two punch attempts are made in quick succession (double-tap)? Only one is
  submitted — the Punch button disables itself immediately on tap until the in-flight request
  resolves.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a dedicated `/my/*` route tree with its own mobile-first
  shell (bottom tab bar linking Punch/Leave/Salary/Face-Enrol), separate from the existing admin
  `/dashboard/*` shell.
- **FR-002**: The system MUST provide a Face Enrolment screen showing current status ("Not enrolled
  yet" or "Enrolled on {date}"), a live-camera photo capture flow (max 5, thumbnail grid, running
  counter), and an Enrol action disabled until ≥3 photos are captured and consent is acknowledged.
- **FR-003**: The system MUST lock/hide the photo-capture and Enrol controls for an already-enrolled
  employee, replacing them with the re-enrolment request entry point.
- **FR-004**: The system MUST provide a My Punch screen with a live clock, IN TIME/OUT TIME/WORKED
  info boxes, and a Punch In/Out action that activates the device camera and requests GPS location
  at the moment of submission.
- **FR-005**: The system MUST record a punch's outcome (matched/exception, in-range/exception) as
  returned by the backend and show a non-blocking notice when either result is an exception,
  without preventing the employee from continuing to use the app.
- **FR-006**: The system MUST show a proactive "period locked" banner on My Punch when the current
  period is already payroll-locked, and MUST show a clear rejection message (no punch recorded) if
  a punch is attempted for a locked period regardless.
- **FR-007**: The system MUST block a punch attempt client-side (before any network request) when
  GPS accuracy is below the required threshold or location access is denied, with a clear message.
- **FR-008**: The system MUST provide a monthly attendance history table (Date, Day, In Time, Out
  Time, OT Hours, Status) with month/year navigation, showing distinct status badge styling for
  Present, Absent, Weekly Off, Holiday, and On Leave.
- **FR-009**: The system MUST queue a punch made while offline on-device (including its captured
  photo and GPS coordinates) with a visible "queued, will sync" indicator, and MUST automatically
  submit queued punches in their original capture order once connectivity returns, without
  requiring manual retry.
- **FR-010**: The system MUST provide a My Leave screen with a Leave Balance table (by type, with a
  financial-year selector) and a My Applications table (type, dates, days, reason, status, remarks,
  Cancel action shown only for Pending applications).
- **FR-011**: The system MUST provide an Apply Leave form (type, from/to date, reason) that computes
  and displays the day count (excluding weekends/holidays) before submission, and MUST block
  submission inline when that count would exceed the available balance for any type except Leave
  Without Pay.
- **FR-012**: The system MUST allow cancelling a Pending application and MUST reflect a decision
  (Approved/Rejected, with remarks) made elsewhere the next time the employee views My
  Applications — no dedicated notification bell/toast/center is required (per clarification); the
  updated status itself is the notification.
- **FR-013**: The system MUST provide a My Salary Summary screen with a month selector limited to
  Processed/Paid periods, a slip view matching the PRD's specified sections, and a PDF download
  action producing the same figures.
- **FR-014**: The system MUST provide a re-enrolment request action (reason selection) for an
  already-enrolled employee, disabled while a request is already pending, and MUST surface a
  granted unlock as a distinct, one-time "Re-enrol Now" action — visible the next time the employee
  opens Face Enrolment, per clarification — that becomes unavailable once used or after 7 days
  unused.
- **FR-015**: The system MUST show a clear, non-crashing error state for any camera- or
  location-dependent action when the corresponding device capability is unavailable or access is
  denied.
- **FR-016**: The system MUST redirect an unauthenticated request to any `/my/*` route to `/login`,
  consistent with this app's existing route-protection behavior.
- **FR-017**: The system MUST provide a way for a user whose role has both My Workspace and admin/
  Settings access to navigate between the two shells without merging them into one interface.
- **FR-018**: Every list/table in this feature MUST remain usable at mobile viewport widths without
  horizontal page scrolling, consistent with this app's mobile-first constitution principle — this
  feature is mobile-first by design (its own dedicated shell), not a retrofit.
- **FR-019**: All requests to `buildcore-api`'s My Workspace endpoints MUST go through the typed
  `app/lib/api/` fetch wrapper, per the constitution's API Access Boundary principle.
- **FR-020**: Every non-camera control in this feature (tab bar, buttons, form fields, month/year
  navigation) MUST be operable via keyboard alone and use semantic HTML elements, consistent with
  the basic-accessibility standard (no formal WCAG conformance target) already established for this
  app's Settings feature.

### Key Entities

- **Face Enrolment (view)**: Status, enrolment date, captured-photo thumbnails (session-local until
  submitted), consent method/acknowledgement — mirrors the backend's Face Enrolment entity.
- **Punch (view)**: Type (in/out), captured time, face-match/geofence result, offline-queued flag —
  mirrors the backend's Punch Record.
- **Attendance Day (view)**: One calendar day's computed status plus in/out/OT figures, for the
  history table.
- **Leave Balance / Leave Application (view)**: Mirrors the backend's entities of the same name.
- **Salary Slip (view)**: Mirrors the backend's read projection; this feature never computes payroll
  figures itself.
- **Offline Punch Queue Entry**: A locally persisted, not-yet-synced punch (photo, GPS, captured
  time) — exists only on the employee's device until synced.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An enrolled employee can complete a punch (open app → captured → confirmed) in under
  15 seconds under normal conditions.
- **SC-002**: 100% of camera- or location-unavailable scenarios show a clear in-app message, never
  a silent failure or unhandled crash, in testing.
- **SC-003**: 100% of punches made while offline are queued locally and successfully synced once
  connectivity returns, preserving original capture time, in testing.
- **SC-004**: 100% of leave applications whose computed days exceed a non-LWP balance are blocked
  client-side before submission, in testing.
- **SC-005**: 100% of salary month selectors show zero Draft/unprocessed periods, in testing.
- **SC-006**: An employee can locate and start a leave application in under 3 taps/clicks from
  opening My Leave.
- **SC-007**: Across all testing, no `/my/*` screen's content is reachable without a valid session.
- **SC-008**: Every non-camera interactive control across this feature's screens can be reached and
  operated using only a keyboard, in testing.

## Assumptions

- Per the confirmed decision, My Workspace uses its own dedicated `/my/*` shell (bottom tab bar),
  not the existing `/dashboard/*` admin shell — a cross-navigation entry point (FR-017) handles the
  dual-role case without merging the two.
- Camera capture uses the browser's `MediaDevices`/`getUserMedia` API directly (live in-page
  preview + capture button, matching the PRD's "Live device camera capture" wording) — no
  third-party camera library is needed for this.
- Offline queueing is implemented via on-device storage (e.g. IndexedDB) plus a connectivity-restore
  listener, consistent with this repo's pre-approved-but-not-yet-used `@serwist/next` PWA tooling;
  the exact sync-retry mechanism (foreground listener vs. Service Worker Background Sync, which has
  inconsistent cross-browser/iOS support) is a planning-level detail.
- The backend contract this feature consumes (buildcore-api's `specs/003-my-workspace-backend/
  contracts/my-workspace-api.md`) is the authority on exact request/response shapes, validation
  rules, and admin-side endpoints (attendance-exception resolution, leave decision) — those admin
  actions are out of this feature's own scope (no admin UI is built here; they belong to a future
  HR & Payroll admin frontend feature), even though the backend already exposes the endpoints for
  them.
- "Site Supervisor," referenced by the PRD for an on-site re-enrolment reset, is out of scope for
  this feature's own UI — it would be performed through whatever interface a future admin/
  supervisor-facing feature provides, not a special mode within this employee-facing shell.
- No automated test framework exists yet in this repo; verification of this feature (including
  camera/GPS/offline behavior, which are especially hard to unit-test) is manual, per this
  constitution's existing known gap.
