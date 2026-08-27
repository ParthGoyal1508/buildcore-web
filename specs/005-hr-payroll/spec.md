# Feature Specification: HR & Payroll Frontend (Employees, Attendance, Leave, Payroll, Challans, Loans, Daily Workers)

**Feature Branch**: `005-hr-payroll`

**Created**: 2026-08-27

**Status**: Draft

**Input**: User description: "HR & Payroll Module (Employees, Attendance, Leave, Payroll Runs,
Challans, Loans, Daily Worker Registry) for the BuildCore ERP frontend (buildcore-web), per the
PRD at /Users/parthgoyal/Projects/ERP-Demo/docs/prd/03-hr-payroll.prd.md. Nested under the existing
admin /dashboard/* shell at /dashboard/hr/* (nav-links.tsx already has an 'HR & Payroll' entry
pointing at /dashboard/hr). Consumes the backend contract already specified in
buildcore-api specs/005-hr-payroll-backend/contracts/hr-payroll-api.md. Reuses this app's
established patterns: ResponsiveList (Settings), the generic widget/filter renderers (Dashboard),
and the CameraCapture component (My Workspace) for Daily Worker photo capture."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Maintain full employee records (Priority: P1)

An HR admin manages the Employee List (search/filter/paginate) and creates/edits employees across
an eight-tab form (Identity, Employment, Statutory, Pay & Bank, Contact, Documents, Letters,
Onboarding), then views a tabbed Employee Detail page.

**Why this priority**: Everything else in this feature depends on employee records existing;
this is the PRD's foundational screen.

**Independent Test**: Can be fully tested by creating an employee across all eight tabs, confirming
it appears correctly in the list with the right Documents progress bar, then opening its Detail
page and confirming each sub-tab renders.

**Acceptance Scenarios**:

1. **Given** the Employee List, **When** loaded, **Then** it shows Code/Name+avatar/Department/
   Designation/Mobile/Company/Project/Documents-progress/Status columns, server-side paginated,
   filterable by search/department/project-site/status/company.
2. **Given** the Add Employee form, **When** an admin moves between the eight tabs, **Then** data
   entered on any tab is retained across tab switches (one form, not five separate submissions —
   consistent with this app's established multi-tab pattern from Settings' Company modal).
3. **Given** the Employment tab, **When** Type is changed between Full Time/Contract/Daily Wage,
   **Then** only the fields relevant to that type are shown as required, others remaining optional/
   hidden as appropriate.
4. **Given** the Statutory tab, **When** PF Applicable or ESIC Applicable is toggled, **Then** the
   corresponding number fields (UAN/PF Number, ESIC Number) become required/not-required inline.
5. **Given** a saved employee, **When** the Employee Detail page is opened, **Then** its Overview,
   Personal Info, Employment, Salary Structure, Attendance Calendar (monthly heatmap), Leave
   Summary, Documents, and Loan History tabs each render that employee's data.
6. **Given** an Aadhaar/PAN/bank-account/UAN field anywhere in this feature, **When** displayed,
   **Then** it shows only the last 4 digits with an explicit "Reveal" action required to see the
   full value — never shown unmasked by default.

---

### User Story 2 - Manage employee documents (Priority: P1)

An HR admin uploads documents against the company's configured document types from the Documents
tab, sees mandatory-completion progress, and sees expiry warnings.

**Why this priority**: The PRD's own success metric ("100% employees have all mandatory docs
before attendance marking") makes this screen a hard gate other flows depend on.

**Independent Test**: Can be fully tested by uploading documents on the Documents tab and
confirming the Employee List's progress bar and an attendance-marking attempt both reflect
mandatory-completion state correctly.

**Acceptance Scenarios**:

1. **Given** the Documents tab, **When** opened, **Then** it lists every configured document type
   for the company with its derived flag (MandatoryNumber/Mandatory/ExpiryNumber/Expiry/Number/
   Optional, per Settings' existing convention) and an upload control per type.
2. **Given** a document type requiring a number or expiry date, **When** uploading, **Then** those
   fields are shown and required; otherwise they're omitted.
3. **Given** an uploaded document nearing or past its expiry, **When** viewed, **Then** a visible
   warning indicator is shown on that document row.
4. **Given** an employee missing mandatory documents, **When** an attendance-marking action is
   attempted anywhere in this app for them, **Then** the resulting rejection message clearly
   identifies which document(s) are missing.

---

### User Story 3 - Administer attendance (Priority: P1)

An HR/site admin views the Daily Attendance table for a date/site, marks/edits entries, reviews
geofence exceptions and the modification audit trail, and declares holidays.

**Why this priority**: The PRD's day-to-day operational screen for attendance oversight.

**Independent Test**: Can be fully tested by editing one employee's attendance entry, confirming
the change appears in the Modifications modal with correct before/after values, and confirming a
declared holiday shows Holiday status for the affected date.

**Acceptance Scenarios**:

1. **Given** the Daily Attendance view, **When** a date and site are selected (date picker with
   navigation arrows, site filter dropdown), **Then** the table shows Emp Code/Employee/Project/
   Department/Designation/In/Out/OT/Worked/Status/Approval/Actions, with status badges (Complete
   green, Absent red, Half Day orange, On Leave blue, Holiday gray).
2. **Given** the Mark/Edit Attendance modal, **When** Employee/Date/In/Out/Status override/OT
   Hours/Remarks are submitted, **Then** the record is created/updated and the table reflects it
   immediately.
3. **Given** the Exceptions modal, **When** opened for a date/site, **Then** it lists punches with
   Employee/Punch Time/Location/Distance from Site/Status.
4. **Given** the Modifications modal, **When** opened, **Then** it lists Employee/Date/Changed By/
   Changed From → To/Timestamp for every manual edit.
5. **Given** the Holidays screen, **When** a holiday is declared (name, date, type, applicability),
   **Then** it appears in the list and affected dates show Holiday status in the Daily Attendance
   view for applicable sites.
6. **Given** an edit attempted for a payroll-locked period, **When** submitted, **Then** a clear
   "period locked" message is shown, no record changes.

---

### User Story 4 - Administer leave (Priority: P1)

An HR admin reviews all employees' leave applications, approves/rejects pending ones, and views
leave balances.

**Why this priority**: A core, frequently-used oversight screen; depends only on employee records
existing.

**Independent Test**: Can be fully tested by approving one pending application and rejecting
another (with mandatory remarks), confirming badges update accordingly.

**Acceptance Scenarios**:

1. **Given** the Leave Applications table, **When** loaded, **Then** it shows Employee/Leave Type/
   From–To/Days/Reason/Status/Remarks/Actions for every employee, with Approve/Reject/Cancel shown
   per current status.
2. **Given** a Pending application, **When** Approve (optional remarks) or Reject (mandatory
   remarks) is submitted, **Then** its badge updates (green/red) and it disappears from any
   "pending only" filter view.
3. **Given** the Leave Balance table, **When** viewed, **Then** it shows Leave Type/Opening/
   Accrued/Used/Available per employee.

---

### User Story 5 - Generate payroll and view salary slips (Priority: P1)

An HR admin selects a month, generates payroll, reviews the resulting list, progresses each run
through Draft → Processed → Paid, and views/downloads salary slips and the bank salary sheet.

**Why this priority**: The PRD's central compliance-and-payout screen.

**Independent Test**: Can be fully tested by generating payroll for a seeded month, confirming the
list's figures, opening one employee's salary slip, downloading it as PDF, and progressing the run
to Processed then Paid.

**Acceptance Scenarios**:

1. **Given** the Payroll screen, **When** a month is selected and Generate Payroll is triggered,
   **Then** the Payroll List populates with Emp Code/Employee/Department/Payable Days/Basic/
   Allowances/Deductions/Net Pay/Status per employee.
2. **Given** a Draft run, **When** "Mark as Processed" is triggered, **Then** a confirmation
   (explaining this locks the period's figures) is required before the irreversible action
   proceeds; once Processed, editing controls for that run's figures are no longer shown.
3. **Given** a Processed run, **When** "Mark as Paid" is triggered, **Then** its status updates.
4. **Given** an employee within a Processed/Paid run, **When** their Salary Slip is opened,
   **Then** it shows the header, attendance summary (4 info boxes), earnings table, deductions
   table, informational employer contributions, net pay in words, and minimum-wages note —
   reusing this app's existing salary-slip *rendering* component from the My Workspace feature,
   fed by this feature's own admin endpoint (any employee's slip within a run) rather than My
   Workspace's caller-scoped-only `/my/salary` endpoint, which this feature must never call on
   another employee's behalf.
5. **Given** the same slip, **When** Download is chosen, **Then** a PDF is saved.
6. **Given** a Processed/Paid run, **When** the Bank Salary Sheet is exported, **Then** a file
   downloads with Employee/Bank Name/Account Number/IFSC/Net Pay rows.

---

### User Story 6 - View statutory challans (Priority: P2)

An HR admin selects a month and reviews PF/ESIC/PT challan data across three tabs, exporting each.

**Why this priority**: Depends on Story 5's processed payroll; a compliance-review screen used
periodically, not daily.

**Independent Test**: Can be fully tested by selecting a Processed month and confirming each tab's
figures and summary totals render correctly, then exporting one.

**Acceptance Scenarios**:

1. **Given** the Challans screen with a month selector, **When** a Processed/Paid month is
   selected, **Then** the PF tab shows Emp Code/Employee/UAN/PF Wages/EPS Wages/Employee PF/
   Employer PF/EPS/EDLI/Admin Charges/Total with a summary row; the ESIC and PT tabs show their
   respective PRD-specified columns.
2. **Given** a month with no processed payroll yet, **When** selected, **Then** a clear "no
   processed payroll for this period" state is shown, not an empty or zeroed table implying real
   data.
3. **Given** any tab, **When** Export is chosen, **Then** a file downloads.

---

### User Story 7 - Track employee loans (Priority: P2)

An HR admin records loans, views the auto-generated EMI schedule, and sees loan status.

**Why this priority**: Self-contained; only needs employee records to exist.

**Independent Test**: Can be fully tested by creating a loan and confirming the schedule table
renders correctly with Month/EMI/Principal/Interest/Remaining Balance/Status.

**Acceptance Scenarios**:

1. **Given** the Loan List, **When** loaded, **Then** it shows Loan ID/Employee/Loan Amount/EMI/
   Disbursed On/Total Paid/Outstanding Balance/Status/Actions.
2. **Given** the New Loan modal, **When** Employee/Amount/EMI/Disbursement Date/Reason/Remarks are
   submitted, **Then** the loan appears in the list and its schedule is immediately viewable.
3. **Given** a loan's EMI Repayment Schedule, **When** opened, **Then** it shows the month-by-month
   breakdown with status badges (Paid/Upcoming/Overdue).

---

### User Story 8 - Transfer an employee across companies (Priority: P2)

An HR admin transfers an employee to a different company via a dedicated action on their record.

**Why this priority**: A small, self-contained action on an existing employee record.

**Independent Test**: Can be fully tested by transferring a test employee and confirming their
Company column updates in the Employee List while their transfer history is logged.

**Acceptance Scenarios**:

1. **Given** an employee's record, **When** Transfer is chosen, **Then** a form for Target
   Company/Transfer Date/Reason/Retain Employee Code (toggle) is shown.
2. **Given** a submitted transfer, **When** completed, **Then** the Employee List reflects the new
   company and the transfer appears in the Activity Log (Dashboard feature).

---

### User Story 9 - Register and mark attendance for daily workers (Priority: P3)

A Site Supervisor enrols a daily worker (name, trade, wage rate, photo capture, consent
attestation) and marks daily attendance via a mobile-optimized capture screen.

**Why this priority**: A distinct, mobile-first flow for a different persona (Site Supervisor)
reusing the biometric photo-capture pattern this app already has (My Workspace).

**Independent Test**: Can be fully tested by enrolling a worker with 3 photos, then marking them
present on the attendance capture screen and confirming the Daily Worker Attendance table reflects
it.

**Acceptance Scenarios**:

1. **Given** the Daily Worker Registry, **When** a Site Supervisor completes the one-time
   enrolment form (name, phone, gender, site — defaulting to their assigned site, trade/skill,
   wage rate, 3–5 photos via the shared camera-capture component, consent attestation), **Then**
   the worker appears in the registry with an auto-generated Worker ID.
2. **Given** the Daily Worker Attendance capture screen, **When** a supervisor selects a worker (or
   uses live face-match) and captures a photo, **Then** that worker's status becomes Present for
   the day with photo/GPS/timestamp recorded — the GPS capture reuses this app's existing
   geolocation-acquisition logic from the My Workspace feature's punch flow, not a second
   implementation.
3. **Given** face-match is inconclusive or the camera is unavailable, **When** the supervisor marks
   attendance manually instead, **Then** it succeeds without blocking, with a visible note that
   this was a manual/exception marking.
4. **Given** multiple workers at a site, **When** the supervisor bulk-marks several present in one
   session, **Then** each is marked with minimal repeated interaction (e.g., a single "mark all
   selected present" action), individually correctable afterward.
5. **Given** the Daily Worker Attendance table, **When** viewed, **Then** it shows Date/Site/
   Worker/Trade/Marked By/Time/Photo/Status/Wage Payable.
6. **Given** a worker no longer on site, **When** deactivated from the registry, **Then** they no
   longer appear in the attendance capture screen's roster, while their history remains viewable
   elsewhere.

---

### User Story 10 - Review biometric re-enrolment requests (Priority: P3)

An HR/Admin views the queue of pending re-enrolment requests and approves/rejects them.

**Why this priority**: A small admin queue over data the My Workspace feature's backend already
manages end-to-end.

**Independent Test**: Can be fully tested by viewing a seeded pending request and approving it,
confirming its status updates.

**Acceptance Scenarios**:

1. **Given** the Biometric Re-enrolment Requests queue, **When** loaded, **Then** it shows
   Employee/Site/Reason/Requested On/Status/Actions.
2. **Given** a pending request, **When** Approve (optional remarks) or Reject (mandatory remarks)
   is submitted, **Then** its status updates and it moves out of the "pending" filter view.

---

### Edge Cases

- What happens when an admin navigates away from the eight-tab Add/Edit Employee form mid-entry?
  A confirmation prompt warns about unsaved changes before leaving, consistent with a form this
  large representing significant potential lost work.
- What happens when a payroll generation request is still running when the admin navigates away?
  A loading/in-progress state is shown; the Payroll List reflects the result once complete on next
  visit, without requiring the admin to keep the tab open (this app's established pattern from
  Dashboard's async-export handling).
- What happens when the Daily Worker Attendance capture screen is used with no network
  connectivity? Camera capture and worker selection still work locally, but marking requires
  connectivity to submit (unlike My Workspace's punch, this feature's PRD does not describe an
  offline queue for daily worker attendance — see Assumptions).
- What happens when an admin attempts to approve a leave application whose dates now fall in an
  already-payroll-locked period? The action is still allowed (per the API's own behavior — leave
  decisions aren't blocked by payroll lock, only attendance recalculation for that period is
  suppressed), and the UI shows an informational note rather than blocking the approval.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a paginated, filterable (search/department/project-site/
  status/company) Employee List and an eight-tab Add/Edit Employee form (one form, tab-switch-safe
  data retention) covering Identity/Employment/Statutory/Pay & Bank/Contact/Documents/Letters/
  Onboarding.
- **FR-002**: The system MUST provide a tabbed Employee Detail page (Overview/Personal Info/
  Employment/Salary Structure/Attendance Calendar/Leave Summary/Documents/Loan History).
- **FR-003**: The system MUST mask Aadhaar/PAN/bank-account/UAN to last 4 digits everywhere they
  appear, requiring an explicit Reveal action to show the full value.
- **FR-004**: The system MUST provide per-document-type upload on the Documents tab, showing each
  type's derived flag, requiring a document number/expiry date only where that type needs them, and
  visibly flagging near-expiry/expired documents.
- **FR-005**: The system MUST surface a specific "which document(s) are missing" message when an
  attendance-marking action is rejected for mandatory-document reasons.
- **FR-006**: The system MUST provide a Transfer action on an employee record (target company,
  date, reason, retain-code toggle).
- **FR-007**: The system MUST provide a date/site-scoped Daily Attendance table with status badges,
  a Mark/Edit modal, an Exceptions modal, a Modifications (audit) modal, and Holiday declaration/
  list management.
- **FR-008**: The system MUST show a clear, non-blocking "period locked" message (no silent
  failure) when an attendance edit is attempted for an already payroll-locked period.
- **FR-009**: The system MUST provide an all-employee Leave Applications table with Approve/Reject/
  Cancel actions per current status, and a Leave Balance table.
- **FR-010**: The system MUST provide payroll generation (month selection), a Payroll List, and
  explicit, confirmation-gated Draft → Processed → Paid status actions, with editing controls for a
  run's figures hidden once Processed.
- **FR-011**: The system MUST render the Salary Slip by reusing this app's existing salary-slip
  *rendering* component (from the My Workspace feature) rather than a second, duplicated
  implementation, fed by this feature's own admin data-fetching function (any employee's slip
  within a run) — never by calling My Workspace's caller-scoped `/my/salary` endpoint on another
  employee's behalf — plus a PDF download action.
- **FR-012**: The system MUST provide a Bank Salary Sheet export action for a Processed/Paid run.
- **FR-013**: The system MUST provide a three-tab Challans screen (PF/ESIC/PT) with a month
  selector, each tab's PRD-specified columns and summary row, an export action per tab, and a clear
  "not yet processed" state for a month with no processed payroll.
- **FR-014**: The system MUST provide a Loan List, a New Loan modal, and an EMI Repayment Schedule
  view per loan.
- **FR-015**: The system MUST provide a Daily Worker Registry (list + one-time enrolment form using
  the shared camera-capture component for 3–5 photos and a consent attestation control) and a
  mobile-optimized Daily Worker Attendance capture screen (face-match or manual selection, bulk
  marking support).
- **FR-016**: The system MUST visibly distinguish a manually-marked (fallback) daily worker
  attendance entry from a face-matched one.
- **FR-017**: The system MUST provide a Biometric Re-enrolment Requests queue (Employee/Site/
  Reason/Requested On/Status) with Approve/Reject actions.
- **FR-018**: The system MUST warn before navigating away from the eight-tab employee form with
  unsaved changes.
- **FR-019**: All requests to `buildcore-api`'s HR & Payroll endpoints MUST go through the typed
  `app/lib/api/` fetch wrapper, per the constitution's API Access Boundary principle.
- **FR-020**: Every screen in this feature MUST remain usable at mobile viewport widths (tables as
  cards, per this app's established `ResponsiveList` pattern) and every non-camera interactive
  control MUST be keyboard-operable with semantic HTML, consistent with this app's established
  mobile-first and basic-accessibility conventions — built in from the start on every new
  component, not verified only at the end.

### Key Entities

- **Employee (view)**: Mirrors the backend's extended Employee record across all eight tabs' fields.
- **Employee Document (view)**: Mirrors the backend's per-employee document record plus its
  derived flag and expiry-warning state.
- **Attendance Record / Attendance Modification / Holiday (views)**: Mirror the backend's
  equivalents (data-model.md in the API spec).
- **Leave Application / Leave Balance (views)**: Mirror the backend's (already-existing, from My
  Workspace) equivalents, in an all-employee admin shape.
- **Payroll Run / Payroll Line Item / Salary Slip (views)**: Mirror the backend's; the Salary Slip
  view specifically reuses the My Workspace feature's existing rendering component.
- **Challan row (view)**: Mirrors the backend's derived PF/ESIC/PT read shapes.
- **Loan / Loan Schedule Entry (views)**: Mirror the backend's equivalents.
- **Daily Worker / Daily Worker Attendance (views)**: Mirror the backend's equivalents.
- **Re-enrolment Request (view)**: Mirrors the backend's (already-existing, from My Workspace)
  entity in an admin-queue shape.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An HR admin can complete a new employee's onboarding (all eight tabs + documents) in
  under 1 hour, per the PRD's own target.
- **SC-002**: Across all testing, zero Aadhaar/PAN/bank-account/UAN values are ever visible without
  an explicit Reveal action having been taken.
- **SC-003**: Across all testing, a Processed or Paid payroll run's figures show no editable
  control anywhere in this feature.
- **SC-004**: Daily worker enrolment (form open through confirmation) completes in under 2 minutes;
  attendance marking completes in under 15 seconds per worker, per the PRD's own targets.
- **SC-005**: Across all testing, every non-camera interactive control across this feature's
  screens is reachable and operable using only a keyboard.
- **SC-006**: Across all testing, every list screen in this feature renders as cards (not a
  horizontally-scrolling table) at a mobile viewport.

## Assumptions

- Routes nest under `/dashboard/hr/*`, matching the existing `nav-links.tsx` "HR & Payroll" entry
  (already pointing at `/dashboard/hr`) and this app's established Settings/Dashboard placement
  precedent — no new shell decision needed, including for the Daily Worker Attendance capture
  screen (mobile-optimized within the same admin shell, not a separate dedicated shell like My
  Workspace's, since Site Supervisors are admin-shell users for their other HR functions too).
- The eight-tab Add/Edit Employee form is a dedicated page (not a modal), given its size —
  differing from Settings' five-tab Company modal, which is small enough to stay a modal.
- The `CameraCapture` component and the GPS-acquisition logic this feature reuses for Daily Worker
  capture are both expected to be promoted from their current My-Workspace-specific location
  (`app/ui/my/`) to a shared location both features can import from, as part of this feature's own
  work — a small organizational refactor, not new capability.
- Daily Worker attendance marking does not implement an offline queue (unlike My Workspace's
  employee self-service punch) — the PRD describes this as a supervisor-operated, typically
  connected, on-site tool, and doesn't ask for offline handling the way it explicitly does for
  employee self-service punching.
- Leave approval/rejection is not blocked by payroll lock (only attendance recalculation for a
  locked period is suppressed, per the backend's own existing behavior, feature 003) — this
  frontend surfaces that as an informational note, not a blocking error, on the Leave Applications
  screen.
- Government-prescribed challan file formats and bank-specific export formats are, per the backend
  spec's own Assumptions, best-effort structured exports — this frontend simply triggers/downloads
  whatever file the backend produces, with no format-specific UI logic of its own.
- No automated test framework exists yet in this repo; verification is manual, per this app's
  established known gap.
