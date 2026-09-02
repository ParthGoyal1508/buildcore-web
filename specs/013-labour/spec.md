# Feature Specification: Labour Management Frontend (Wage Rates, Supervisor Muster Capture, Payment Sheets, Advances)

**Feature Branch**: `013-labour`

**Created**: 2026-09-01

**Status**: Draft

**Input**: User description: "Labour Management module for the BuildCore ERP frontend
(buildcore-web), closing the gaps identified by the module/submodule matrix rows 11, 12, 15 and 18:
'Labour Attendance by GPS Photo and Geo Fencing captured by Supervisor' and 'Payment Sheet' under My
Workspace; 'Labour Wages Creation Per Project' under Employee Master; and 'Labour Payment Sheet Per
Project Cash' under Payroll. Consumes the backend contract in
buildcore-api/specs/013-labour-management-backend/. The supervisor muster capture is a phone-first
field flow that reuses 003-my-workspace's existing `camera-capture.tsx`, `punch-clock.tsx` geofence
handling, and the IndexedDB `offline-queue.ts` — it does not reimplement any of them. Back-office
screens (wage rates, payment sheets, advances, reports) are desktop-primary but responsive."

**Supersession note**: this feature supersedes the daily-worker surfaces implied by 005-hr-payroll.
The worker registry and labour attendance screens live here, matching the backend's supersession of
005 US9 ratified 2026-09-01.

**Mobile posture** (ratified 2026-09-01): field surfaces mobile-first, back-office responsive. The
muster capture is designed for a phone held one-handed in sunlight on a site; the payment sheet and
reports are designed for a desk and degrade to cards on mobile.

## Clarifications

### Session 2026-09-01

- Q: Is the muster capture one screen or a wizard? → A: A wizard, because the steps have different
  failure modes: (1) open session — resolve GPS and validate the geofence, (2) mark workers — one
  card per worker with a photo, (3) review and submit. A single long form would make a GPS failure
  at the end lose all the marking work.
- Q: What happens when a supervisor is outside the geofence? → A: Capture proceeds with a visible
  warning banner, matching the backend's record-don't-reject rule. The supervisor is told the muster
  will need approval. Blocking would strand a legitimate supervisor standing at a site whose fence
  was drawn slightly wrong.
- Q: How is the advisory face match shown? → A: A subtle per-worker indicator only, never a blocking
  dialog and never a red error. A low match adds a "needs review" chip on the card. Site conditions
  make it unreliable, so making it loud would train supervisors to ignore it.
- Q: Does the payment sheet show the denomination breakup on screen? → A: Yes, as a dedicated panel
  on an approved direct-engagement sheet, showing note count per denomination plus any per-worker
  residual carried forward. It is what the cashier physically counts against, so it must be readable
  and printable, not buried in an export.
- Q: How is disbursement acknowledgement captured? → A: Reusing `camera-capture.tsx` for the thumb
  impression or signature image — the same component the punch flow already uses — rather than a
  new signature-pad dependency.

### Session 2026-09-01 (ratification — frontend gap-closure clarify pass)

- Q: Should the muster wizard proceed when the supervisor is outside the site geofence? → A: Warn and
  proceed, flagging the muster for approval — matching the backend's record-don't-reject rule. A
  total absence of GPS fix still blocks. Blocking on the fence would strand a legitimate supervisor
  at a site whose geofence was drawn slightly wrong, and the backend would accept the muster anyway.
- Q: How much backend validation should the client duplicate? → A: Only deterministic rules. Stock
  and duplicate-muster conflicts are left to the server and surfaced as specific messages that
  preserve the captured work.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Wage Rate Masters (Priority: P1)

An admin maintains skill categories and, per project, the daily wage rate per skill category with an
effective-from date, seeing the full rate history.

**Why this priority**: Nothing can be costed without a rate; the matrix names "Labour Wages Creation
Per Project" as the missing master. No dependencies beyond Projects.

**Independent Test**: Create a Mason rate of ₹800/day for a project effective 1 Jan, then ₹850
effective 1 Mar, and confirm the history shows the first rate auto-closed at 28 Feb — without any
attendance existing.

**Acceptance Scenarios**:

1. **Given** `/dashboard/labour/wage-rates`, **When** loaded, **Then** rates are listed by project and
   skill category with Daily Rate, Effective From, Effective To, and a Current indicator.
2. **Given** the New Rate modal, **When** submitted, **Then** it collects Project, Skill Category,
   Daily Rate, and Effective From; on success the prior current rate visibly gains its Effective To
   in the same list update.
3. **Given** an Effective From earlier than an existing rate's, **When** submitted, **Then** the `400`
   is surfaced inline explaining that rates are appended forward.
4. **Given** a rate that has priced approved attendance, **When** Edit is attempted, **Then** the
   action is disabled with a tooltip explaining it is locked.
5. **Given** an "as of date" control, **When** a date is chosen, **Then** the list shows only rates in
   force on that date.
6. **Given** the Masters modal, **When** opened, **Then** Skill Categories can be created and edited,
   with delete blocked by a `409` toast when workers reference them.
7. **Given** all monetary values, **When** rendered, **Then** they use `formatCurrency`.

---

### User Story 2 - Worker Registry and Gangs (Priority: P1)

A site admin registers labour workers — direct or contractor-engaged — with skill category and site,
enrols their face, and groups them into gangs for faster muster capture.

**Why this priority**: Workers are what attendance and payment attach to. Depends on US1.

**Independent Test**: Register a direct Mason and a contractor-engaged Helper, create a gang
containing both, and confirm the gang is selectable during muster capture — without any attendance.

**Acceptance Scenarios**:

1. **Given** `/dashboard/labour/workers`, **When** loaded, **Then** workers are listed with Labour
   Code, Name, Skill Category, Engagement Type, Contractor (when applicable), Site, and status badge.
2. **Given** the worker list, **When** rendered, **Then** Aadhaar and bank account display exactly as
   the API returns them (masked); the UI performs no client-side unmasking, and the unmasked detail
   payload is never written to any client-side cache or storage.
3. **Given** the New Worker form, **When** Engagement Type is set to Contractor, **Then** a Contractor
   field appears and becomes required; setting it to Direct hides it.
4. **Given** a duplicate Aadhaar, **When** submitted, **Then** the `409` is surfaced inline on that
   field with a link to the existing worker.
5. **Given** a worker detail, **When** face enrolment is started, **Then** it reuses the existing
   `camera-capture.tsx` and enrolment flow from 003 — no second camera implementation.
6. **Given** the Gangs screen, **When** a gang is created, **Then** it collects Name, Gang Leader,
   Site, and Members; adding a worker already in another gang surfaces the `409` inline.
7. **Given** a worker with unsettled payment lines, **When** deactivated, **Then** the confirmation
   warns that settlement is pending and the worker is flagged in the list afterwards.

---

### User Story 3 - Supervisor Muster Capture (Priority: P1, mobile-first)

A supervisor standing at the site opens a muster on their phone, is located by GPS against the site
geofence, marks each present worker with a captured photo and an attendance type, and submits the
batch — working offline if there is no signal.

**Why this priority**: The matrix's headline missing item and the module's primary daily field
operation. Depends on US2.

**Independent Test**: On a phone viewport, open a muster inside a site geofence, mark three workers
present with photos, submit, and confirm one muster exists for that site and date with three lines —
then repeat with the network disabled and confirm it queues and drains on reconnect.

**Acceptance Scenarios**:

1. **Given** `/labour/muster` on a phone, **When** opened, **Then** a three-step wizard is shown —
   Open Session, Mark Workers, Review & Submit — with the current step always visible.
2. **Given** step 1, **When** the device resolves GPS, **Then** the site, date, accuracy in metres,
   and geofence result are shown before the supervisor can proceed.
3. **Given** a GPS reading outside the geofence, **When** step 1 completes, **Then** a persistent
   warning banner states the muster will require approval, and capture proceeds — it is never blocked.
4. **Given** GPS accuracy worse than the configured limit, **When** step 1 completes, **Then** the same
   warning treatment is applied.
5. **Given** no GPS fix at all, **When** step 1 is attempted, **Then** the supervisor is told a fix is
   required and offered a retry — the session cannot open without one.
6. **Given** step 2, **When** rendered, **Then** each worker appears as a card with a large photo
   button, an attendance-type control (Full Day / Half Day / Absent / Overtime Only), and an overtime
   hours field shown only when relevant.
7. **Given** a worker card, **When** the photo is captured, **Then** it reuses the existing
   `camera-capture.tsx` component and the card shows a captured-photo thumbnail.
8. **Given** a gang is selected, **When** "Mark whole gang" is used, **Then** a card is created for
   every active member with a default attendance type, each still requiring its own photo before
   submit.
9. **Given** a worker whose face match is below threshold, **When** the photo is captured, **Then** a
   subtle "needs review" chip appears on the card — never a blocking dialog and never a red error.
10. **Given** step 3, **When** reviewed, **Then** a summary shows counts by attendance type, the
    number of cards missing photos, and any flags; Submit is disabled while any marked worker lacks a
    photo.
11. **Given** no network at submit, **When** Submit is pressed, **Then** the muster is written to the
    existing IndexedDB offline queue, a queued indicator with a count is shown, and it drains
    automatically on reconnect through the existing `drainQueue` mechanism — no second queue is built.
12. **Given** a queued muster that fails to drain, **When** the failure is returned, **Then** it is
    surfaced in the queued list with the reason and a retry, never silently dropped.
13. **Given** an existing muster for the same site and date, **When** submit returns `409`, **Then**
    the message names the existing muster and offers to open it rather than losing the captured work.
14. **Given** a worker already marked at another site that date, **When** submit returns `409`,
    **Then** the offending worker card is highlighted with the other site named.
15. **Given** the whole flow, **When** used one-handed on a 320px-wide phone in daylight, **Then**
    every control meets the 44×44px touch target and no action is hover-gated.

---

### User Story 4 - Muster Approval (Priority: P1)

A project manager reviews submitted musters — particularly flagged ones — and approves or returns
them. Only approved musters price into a payment sheet.

**Why this priority**: The control that makes cash disbursement defensible. Depends on US3.

**Independent Test**: Submit a muster with a geofence flag, approve it as a manager, and confirm its
status becomes Approved and it becomes available to a payment sheet.

**Acceptance Scenarios**:

1. **Given** `/dashboard/labour/musters`, **When** loaded, **Then** musters are listed with site,
   date, supervisor, line count, flag count, and status badge, defaulting to Submitted and sorted
   oldest first.
2. **Given** a flagged muster, **When** listed, **Then** its flags (geofence, low GPS accuracy, low
   face match count) are visible on the row without opening it.
3. **Given** the muster detail, **When** opened, **Then** each line shows worker, attendance type,
   overtime hours, the captured photo, the face-match indicator, and the wage rate that would apply.
4. **Given** a caller without the approve permission, **When** viewing a flagged muster, **Then** the
   Approve action is not rendered.
5. **Given** the Return action, **When** attempted with an empty reason, **Then** it stays disabled;
   on success the supervisor is notified through the existing notification surface.
6. **Given** an approved muster, **When** viewed, **Then** the lines are read-only.
7. **Given** an approved muster already in an approved payment sheet, **When** un-approval is
   attempted, **Then** the `409` names the payment sheet with a link to it.
8. **Given** the captured photos, **When** displayed, **Then** they load lazily so a 200-line muster
   does not block the page.

---

### User Story 5 - Cash Payment Sheets (Priority: P1)

An admin generates a payment sheet for a project and wage period, reviews each worker's days, gross,
deductions and net, approves it, and works from the cash denomination breakup.

**Why this priority**: The matrix's "Payment Sheet" and "Labour Payment Sheet Per Project Cash" —
the module's financial output. Depends on US1 and US4.

**Independent Test**: With approved musters covering one week, generate the sheet and confirm each
worker's days and gross reconcile against the musters, then approve and confirm the denomination
panel appears.

**Acceptance Scenarios**:

1. **Given** the Generate Sheet modal, **When** submitted, **Then** it collects Project, Period From,
   Period To, and Engagement Type, with the period defaulting to the company's configured wage cycle.
2. **Given** a worked date with no applicable wage rate, **When** generation fails with `409`, **Then**
   the message names the project, skill category, and date, with a link to create that rate — never a
   generic failure.
3. **Given** a generated sheet, **When** viewed, **Then** each line shows worker, days worked,
   overtime hours, the resolved rate and its source (override or project rate), gross, deductions,
   and net payable, with column totals.
4. **Given** an overlapping period, **When** generation is attempted, **Then** the `409` names the
   existing sheet with a link.
5. **Given** a caller without the approve permission, **When** viewing a draft sheet, **Then** the
   Approve action is not rendered.
6. **Given** an approved sheet, **When** viewed, **Then** every figure is read-only and a visible
   Approved state is shown.
7. **Given** an approved direct-engagement sheet, **When** the Denominations panel is opened, **Then**
   note count per denomination and any per-worker residual carried forward are shown, in a layout
   that prints cleanly for the cashier.
8. **Given** an approved contractor-engagement sheet, **When** viewed, **Then** lines are grouped by
   contractor with per-contractor totals and no denomination panel is shown.
9. **Given** an approved sheet with any disbursed line, **When** Reopen is attempted, **Then** the
   action is disabled with a tooltip explaining a disbursement exists.
10. **Given** a sheet, **When** Export is clicked, **Then** the export follows the established
    synchronous-download / async-job handling.

---

### User Story 6 - Disbursement with Acknowledgement (Priority: P2)

A disbursing officer pays each worker on an approved sheet and captures a thumb impression or
signature for cash payments, until the sheet closes.

**Why this priority**: Acknowledgement is what makes a cash sheet auditable. Depends on US5.

**Independent Test**: Disburse two of three lines with captured acknowledgements, confirm the sheet
shows partially disbursed with the correct outstanding, then disburse the third and confirm closure.

**Acceptance Scenarios**:

1. **Given** an approved sheet line, **When** Disburse is opened, **Then** it collects Payment Mode
   (Cash / Bank), Paid On, and Paid Amount defaulted to net payable.
2. **Given** Payment Mode is Cash, **When** the form is shown, **Then** an acknowledgement capture is
   required, reusing the existing `camera-capture.tsx` component rather than a new signature-pad
   dependency; Save stays disabled until an image is captured.
3. **Given** Payment Mode is Bank for a worker with no recorded bank account, **When** selected,
   **Then** the option is disabled with an explanation.
4. **Given** a Paid Amount differing from net payable, **When** entered, **Then** a Short Payment
   Reason field becomes required and helper text explains the difference carries forward.
5. **Given** a partially disbursed sheet, **When** viewed, **Then** disbursed count, pending count,
   disbursed amount, and outstanding amount are shown as a header summary.
6. **Given** the last line disbursed, **When** saved, **Then** the sheet visibly transitions to Closed
   with its closure date.
7. **Given** a caller without the approve permission, **When** viewing a disbursed line, **Then** the
   Reverse action is not rendered; with it, reversal requires a reason.
8. **Given** the disbursement screen on a tablet at a site office, **When** used, **Then** it remains
   fully operable at tablet width with 44×44px touch targets.

---

### User Story 7 - Labour Advances (Priority: P2)

A worker's advance against future wages is requested, approved, disbursed, and tracked as it is
recovered through payment sheets.

**Why this priority**: The payment sheet's deduction lines are meaningless without advances. Depends
on US2; recovery integrates with US5.

**Independent Test**: Grant a ₹3,000 advance recoverable in three instalments, generate the next
sheet, and confirm a ₹1,000 deduction line appears with the outstanding balance shown.

**Acceptance Scenarios**:

1. **Given** the New Advance modal, **When** submitted, **Then** it collects Worker, Amount, Reason,
   Recovery Instalments, and Recovery Start Period, showing the computed per-instalment amount live
   before submit.
2. **Given** an amount above the configured limit, **When** entered, **Then** an inline "exceeds
   limit — needs approval" warning appears and Approve requires the approve permission.
3. **Given** `/dashboard/labour/advances`, **When** loaded, **Then** advances list worker, amount,
   instalments, outstanding balance, status, and a recovery-at-risk marker for deactivated workers.
4. **Given** an advance, **When** viewed, **Then** its recovery history shows which sheet lines
   reduced the balance and by how much.
5. **Given** a payment sheet where recovery was capped, **When** the line is viewed, **Then** helper
   text explains the remainder carries to the next period and the advance stays open.
6. **Given** a fully recovered advance, **When** the balance reaches zero, **Then** it shows Closed.

---

### User Story 8 - Labour Reports (Priority: P3)

Managers view labour deployment, attendance percentage, and the payment register.

**Why this priority**: Derivative of every other screen. Depends on US4 and US5.

**Independent Test**: With one week of approved musters, open the deployment report grouped by skill
and confirm the man-days match the musters.

**Acceptance Scenarios**:

1. **Given** `/dashboard/labour/reports/deployment`, **When** a project, period, and grouping (skill /
   site / contractor) are chosen, **Then** headcount and man-days are shown per group per day with
   period totals.
2. **Given** `/dashboard/labour/reports/attendance`, **When** a site and period are chosen, **Then**
   each worker's days present, half days, absent days, overtime hours, and attendance percentage are
   listed.
3. **Given** `/dashboard/labour/reports/payment-register`, **When** a project and period are chosen,
   **Then** every payment sheet line is listed with worker, days, gross, deductions, net, payment
   mode, and disbursement status.
4. **Given** any report with no data, **When** loaded, **Then** a distinct empty state is shown, not
   an error.
5. **Given** a user without the reports permission, **When** a report route is opened, **Then**
   `middleware.ts` blocks it and the access-denied screen is shown.
6. **Given** any report, **When** exported, **Then** the established synchronous / async export
   handling applies.

---

### Edge Cases

- The phone's camera permission is denied mid-capture → the worker card shows a clear permission
  message with a link to retry; already-captured cards are preserved.
- The browser is closed with a muster mid-capture → the in-progress muster is recoverable from the
  offline queue on next open, rather than lost.
- A queued offline muster becomes invalid before it drains (the rate changed, the worker was
  deactivated) → the drain failure is surfaced with the reason and the muster stays in the queue for
  manual resolution; it is never silently discarded.
- The device clock is wrong, making the captured timestamp implausible → the muster still submits and
  the backend's offline-sync handling records both timestamps; the UI shows the server-accepted date.
- A supervisor marks 200 workers → step 2 virtualises the card list and photos load lazily so the
  phone does not run out of memory.
- The API returns an attendance type the client does not recognise → the card renders the raw label
  rather than dropping the line.
- A payment sheet is opened while another user approves it → the screen refreshes to the approved
  read-only state rather than allowing an edit that will fail.
- Denominations do not cover a worker's exact net → the residual is shown explicitly per worker in
  the panel, never rounded away silently.
- A wage rate is created while a sheet is generating → generation is atomic on the backend; the UI
  simply reflects whichever result returns.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Back-office routes MUST be under `/dashboard/labour/*`; the supervisor muster capture
  MUST live under `/labour/muster`, outside `/dashboard`, matching how 003 places field surfaces
  under `/my/*` rather than in the desktop shell.
- **FR-002**: `middleware.ts` MUST guard labour routes with the `DAILY_WORKER_REGISTRY` permission,
  and report routes additionally with `REPORTS`.
- **FR-003**: Actions requiring `LABOUR_APPROVE` (muster approve/return, sheet approve/reopen,
  disbursement reversal, advance approval above limit) MUST NOT be rendered for callers lacking that
  permission — hiding, not merely disabling.
- **FR-004**: All API calls MUST go through a typed `app/lib/api/labour.ts` module; no component may
  issue a raw `fetch()` (Principle V).
- **FR-005**: Every API response MUST be validated with a `zod` schema at the boundary and the
  inferred type used downstream (Principle IV).
- **FR-006**: The muster capture MUST reuse the existing `camera-capture.tsx` component, the geofence
  and GPS handling established by `punch-clock.tsx`, and the IndexedDB queue in
  `app/lib/offline-queue.ts` (`enqueue`, `listQueued`, `getQueuedCount`, `drainQueue`) — it MUST NOT
  introduce a second camera, geofence, or queue implementation.
- **FR-007**: The muster capture MUST be a three-step wizard (Open Session, Mark Workers, Review &
  Submit) so a failure in one step does not discard work done in another.
- **FR-008**: A geofence violation or low GPS accuracy MUST show a persistent warning that the muster
  will require approval, and MUST NOT block capture — matching the backend's record-don't-reject
  rule. A complete absence of a GPS fix MUST block the session with a retry.
- **FR-009**: A below-threshold face match MUST render as a subtle per-worker "needs review" chip —
  never a blocking dialog and never an error treatment — because site conditions make labour face
  match unreliable.
- **FR-010**: Submit MUST be disabled while any marked worker lacks a captured photo, and the review
  step MUST show the count of cards missing photos.
- **FR-011**: With no network, submit MUST enqueue to the existing offline queue, show a queued
  indicator with a count, and drain automatically on reconnect; a drain failure MUST be surfaced with
  its reason and retained for manual retry, never silently dropped.
- **FR-012**: A `409` on muster submit MUST preserve the captured work and name the conflict — the
  existing muster (with an action to open it) or the offending worker card and the other site.
- **FR-013**: Worker Aadhaar and bank account MUST render exactly as the API returns them (masked);
  the UI MUST NOT attempt client-side unmasking, and the unmasked detail payload MUST NOT be written
  to any client-side cache, local storage, or session storage.
- **FR-014**: Payment sheet generation failing for a missing wage rate MUST surface the project, skill
  category, and date, with a link to create that rate — never a generic failure.
- **FR-015**: An approved direct-engagement sheet MUST show a denomination panel with note count per
  denomination and any per-worker residual carried forward, in a layout that prints cleanly; a
  contractor sheet MUST group by contractor and show no denomination panel.
- **FR-016**: A cash disbursement MUST require an acknowledgement image captured through
  `camera-capture.tsx`, with Save disabled until one is captured; a bank disbursement MUST be
  unavailable for a worker with no recorded bank account.
- **FR-017**: A paid amount differing from net payable MUST require a short-payment reason and MUST
  explain that the difference carries forward.
- **FR-018**: Wage rate, muster, and payment sheet figures that the API reports as locked or approved
  MUST render read-only with an explanatory tooltip, never as editable controls that fail on save.
- **FR-019**: All monetary values MUST use `formatCurrency` from `app/lib/utils.ts`.
- **FR-020**: All status indicators MUST use the shared `StatusBadge` component with a documented
  colour mapping.
- **FR-021**: Every back-office list screen MUST use the existing `ResponsiveList` component
  (Principle VI).
- **FR-022**: Every route, label, attendance type, and colour mapping MUST come from a constants
  module, never inline literals (Principle III).
- **FR-023**: Components MUST default to Server Components with `"use client"` pushed as far down as
  possible; the muster wizard, camera capture, and offline-queue indicator are necessarily client
  components (Principle I).
- **FR-024**: Data shaping and API calls MUST live in `app/lib/`, not inline in component bodies
  (Principle I).
- **FR-025**: No component may use the inline `style={}` prop; conditional classes MUST use `clsx`
  (Principle II).
- **FR-026**: The muster capture MUST be fully operable one-handed at 320px width with 44×44px touch
  targets and no hover-gated action (Principle VI).
- **FR-027**: Step 2 of the muster wizard MUST virtualise the worker card list and load photos lazily
  so a large muster does not exhaust phone memory.
- **FR-028**: Muster photos in the approval detail MUST load lazily so a large muster does not block
  the page.
- **FR-029**: An unrecognised attendance type, status, or flag from the API MUST render with its raw
  label rather than dropping the record.
- **FR-030**: Every screen MUST show distinct loading (skeleton), empty, and error states, with retry
  on error — reusing the existing `skeletons.tsx` patterns.
- **FR-031**: Report exports MUST reuse the established synchronous-download / async-job handling with
  a distinguishable failure state.

### Key Entities *(client-side view models)*

- **WageRateRow**: project, skill category, daily rate, effective from/to, current indicator, locked
  flag.
- **WorkerRow**: labour code, name, skill category, engagement type, contractor, site, masked PII,
  status, settlement-pending marker.
- **MusterDraft**: site, date, GPS reading and accuracy, geofence result and warnings, worker cards
  with attendance type, overtime hours, captured photo, and face-match chip.
- **QueuedMuster**: the offline-queue entry with its captured timestamp, queued state, and any drain
  failure reason.
- **PaymentSheetLine**: worker, days, overtime, resolved rate and source, gross, deductions, net,
  payment mode, disbursement status, acknowledgement thumbnail.
- **DenominationPanel**: note count per denomination, total, and per-worker residual.
- **AdvanceRow**: worker, amount, instalments, outstanding balance, status, recovery history,
  at-risk marker.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A supervisor can capture a full site's attendance for a day on a phone in one session,
  including a photo per worker, without any desk-side re-entry.
- **SC-002**: The muster capture completes with no network and drains on reconnect without losing a
  single line, verified by an offline end-to-end test.
- **SC-003**: No captured work is lost on any `409` at submit — verified by tests for both the
  duplicate-muster and worker-at-two-sites conflicts.
- **SC-004**: Every muster capture control is operable one-handed at 320px width with 44×44px targets.
- **SC-005**: No unmasked worker PII is present in any client-side cache or storage.
- **SC-006**: A cash disbursement cannot be submitted without a captured acknowledgement, verified by
  a test asserting Save stays disabled.
- **SC-007**: A payment sheet's displayed totals reconcile exactly with the sum of its lines.
- **SC-008**: A 200-worker muster remains responsive on a mid-range phone, with no memory-related
  failure.

## Assumptions

- The backend feature `013-labour-management-backend` is built first; this feature consumes its
  contract and adds no wage or costing logic of its own.
- The camera, geofence, and offline-queue building blocks already exist in this repository from 003
  and are reused rather than rebuilt — this is a hard requirement (FR-006), not a preference.
- Card-list virtualisation for step 2 is a planning decision; the requirement is the behaviour
  (FR-027), not a specific library.
- The muster wizard assumes the supervisor is authenticated on their own device; shared-device
  handover is out of scope for this pass.
- Piece-rate labour is out of scope, matching the backend — day rate and overtime only.
- Printing the denomination panel relies on a print stylesheet; no PDF generation happens client-side.

## Amendment 2026-09-02 — Desktop-First Responsiveness (constitution v2.0.0)

Constitution Principle VI was redefined from blanket mobile-first to **desktop-first with a closed
list of mobile-critical surfaces**. This feature is **split**. The supervisor's daily muster capture is on the mobile-critical list — the constitution names it explicitly, because marking labour attendance on site is attendance capture by another name. Everything else in this feature (wage-rate masters, payment sheets, advances, the back-office lists and reports) is a desktop surface.

**What changes for this feature:** the split is now explicit rather than incidental.

- **Muster capture** stays **mobile-first**: one-handed at 320px, 44×44px touch targets, no hover-gated action, verified at 320px before merge. Unchanged from what this spec already required.
- **Everything else** becomes **desktop-first**, and must remain usable and unbroken down to 768px with wide tables scrolling in their own `overflow-x: auto` container. The `ResponsiveList` card fallback is now OPTIONAL on these back-office lists rather than mandatory.
- **Keyboard operability is unchanged and still applies to every screen in both halves.**
