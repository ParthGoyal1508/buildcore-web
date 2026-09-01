# Feature Specification: Recruitment & Onboarding Frontend (Requisitions, Pipeline, Interviews, Offers, Joining, Onboarding, Letters)

**Feature Branch**: `011-recruitment`

**Created**: 2026-09-01

**Status**: Draft

**Input**: User description: "Recruitment & Onboarding module for the BuildCore ERP frontend
(buildcore-web), closing the gap identified by the module/submodule matrix row 22 ('Recruitment:
Open Positions, Interviews, Selected, Joining Pending, Offer Letter Generation, Employee
Onboarding, New joining report, Appointment Letter Generate, Document Verification, Resignation
report, Kit Issue etc') and the letter-generation and resignation items of row 23. None of these
screens exist in any current frontend spec — 005-hr-payroll begins at an already-hired employee.
Nested under /dashboard/recruitment/*. Consumes the backend contract in
buildcore-api/specs/011-recruitment-onboarding-backend/. Reuses: formatCurrency and StatusBadge,
the multi-tab modal pattern (Settings/002, Projects/008), ResponsiveList (006/009), and the
document-upload pattern from 005-hr-payroll."

**Scope note**: internal HR-facing screens only — no careers portal, no candidate self-service, no
automated letter delivery (ratified in the backend clarify pass, 2026-09-01). Letters are generated
and downloaded by HR.

## Clarifications

### Session 2026-09-01

- Q: Is the hiring pipeline one screen with stage filters, or separate screens per stage? → A: One
  Pipeline screen with a stage filter plus a board view. The matrix names "Interviews", "Selected",
  and "Joining Pending" as separate items, but they are the same candidate list at different
  stages — building three screens would triplicate the same table. The stage filter is deep-linkable
  (`?stage=selected`) so each matrix item still has its own URL.
- Q: How is candidate PII displayed given the backend masks it in list responses? → A: The list
  renders exactly what the API returns (masked) with no client-side unmasking attempt. A "Reveal"
  action on the candidate detail drawer re-fetches from the single-candidate endpoint, which returns
  unmasked values and audit-logs the access. The UI never caches the unmasked payload.
- Q: Where does the offer's salary breakup get entered? → A: A repeatable component-row editor
  inside the Offer modal, with a live-computed total and a live variance against `offeredCtc / 12`.
  The Save button is disabled while the variance exceeds tolerance, so the backend's FR-010
  rejection is prevented client-side rather than surfaced as an error.
- Q: Is the onboarding checklist a screen or a drawer? → A: A dedicated screen at
  `/dashboard/recruitment/onboarding/[employeeId]`, because it is worked over days by different
  people and needs its own URL to share. A compact progress indicator appears on the employee row.
- Q: How are letter templates edited given they contain substitution tokens? → A: A plain textarea
  with a token palette beside it — clicking a token inserts it at the cursor. No rich-text editor.
  Unknown tokens are highlighted before save, so the backend's FR-020 rejection is pre-empted.

### Session 2026-09-01 (ratification — frontend gap-closure clarify pass)

- Q: Is the candidate pipeline one screen with stage filters, or one screen per matrix item? → A:
  One screen with a deep-linkable `?stage=` filter plus a board view. Interviews, Selected, and
  Joining Pending are the same list at different stages; each keeps its own URL without triplicating
  the table. The board falls back to the table on mobile and for keyboard/screen-reader users.
- Q: How much backend validation should the client duplicate? → A: Only deterministic rules the
  client can evaluate with certainty from data it already holds — offer component sums and letter
  template tokens here. Race-prone checks (duplicate candidates, concurrent stage transitions) stay
  server-side and surface as specific messages.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open Positions (Requisitions) (Priority: P1)

An HR admin raises a manpower requisition, submits it for approval, and tracks how many positions
remain open against it. The Open Positions list is the module's landing screen.

**Why this priority**: Nothing else in the module can be reached without a requisition. No
dependencies beyond Settings masters already built in 002.

**Independent Test**: Open `/dashboard/recruitment/requisitions`, create a requisition for 3 Site
Engineers, submit and approve it, confirm the row shows "3 open / 0 filled" and a green Open badge —
without any candidate existing.

**Acceptance Scenarios**:

1. **Given** `/dashboard/recruitment/requisitions`, **When** loaded, **Then** a list shows
   Requisition Code, Department, Designation, Positions (filled/total), Employment Type, Target
   Joining Date, Age (days), and a status `StatusBadge` (Draft=grey, Pending=amber, Open=green,
   Rejected=red, Closed=slate).
2. **Given** the New Requisition modal, **When** opened, **Then** it shows Department, Designation,
   Position Count, Employment Type, optional Project/Site, Target Joining Date, Budgeted CTC Min/Max,
   and Justification; Department and Designation dropdowns are populated from the Settings masters.
3. **Given** Budgeted CTC Min greater than Max, **When** Save is attempted, **Then** a field-level
   validation error appears and the request is not sent.
4. **Given** a Draft requisition, **When** "Submit for Approval" is clicked, **Then** the status
   badge changes to Pending without a full-page reload.
5. **Given** a Pending requisition and a caller holding the approve permission, **When** Approve is
   clicked, **Then** the badge changes to Open; a caller without that permission does not see the
   Approve action at all.
6. **Given** the Reject action, **When** confirmed with an empty reason, **Then** the Reject button
   stays disabled until a reason is entered.
7. **Given** a requisition with linked candidates, **When** Delete is attempted, **Then** a `409`
   error is surfaced as a toast ("Requisition has candidates — cannot delete").
8. **Given** the list, **When** filters (status, department, project) are applied, **Then** the list
   narrows without a full-page reload.

---

### User Story 2 - Candidate Pipeline (Interviews / Selected / Joining Pending) (Priority: P1)

A recruiter adds candidates against an open requisition and moves them through the pipeline. One
screen serves the matrix's "Interviews", "Selected", and "Joining Pending" items via a
deep-linkable stage filter and a board view.

**Why this priority**: The core working screen of the module. Depends on US1.

**Independent Test**: Add a candidate to an open requisition, drag them from Applied to Shortlisted
on the board, confirm the stage persists after a refresh and the candidate appears under
`?stage=shortlisted` — without scheduling an interview.

**Acceptance Scenarios**:

1. **Given** `/dashboard/recruitment/pipeline`, **When** loaded, **Then** both a table view and a
   board view (one column per stage) are available, with the choice persisted per user.
2. **Given** the board view, **When** a candidate card is moved to an adjacent permitted stage,
   **Then** the change is sent optimistically and reverted with an error toast if the API rejects it.
3. **Given** a stage transition the backend's state machine forbids, **When** attempted, **Then** the
   target column does not accept the drop and a tooltip names the permitted next stages.
4. **Given** the URL `?stage=selected`, **When** opened directly, **Then** the list is pre-filtered
   to that stage — giving the matrix's "Selected" and "Joining Pending" items their own URLs.
5. **Given** the candidate list, **When** rendered, **Then** phone, email, and CTC values display
   exactly as the API returns them (masked); the UI performs no client-side unmasking.
6. **Given** the candidate detail drawer, **When** "Reveal contact details" is clicked, **Then** the
   single-candidate endpoint is called and the unmasked values are shown for that session only,
   never written to any client-side cache or local storage.
7. **Given** the New Candidate modal, **When** a duplicate phone or email is submitted, **Then** the
   `409` response is surfaced inline on the offending field with a link to the existing candidate.
8. **Given** the candidate drawer, **When** a resume is uploaded, **Then** the accepted types are
   restricted (`.pdf,.doc,.docx`) and upload progress is shown.
9. **Given** a candidate flagged `noShow` by the API, **When** the list is rendered, **Then** the row
   carries a distinct warning marker and appears in the Joining Pending overdue filter.
10. **Given** two users moving the same candidate concurrently, **When** the second request returns
    `409`, **Then** the board reverts that card and shows the current stage from the response.

---

### User Story 3 - Interviews (Priority: P1)

A recruiter schedules interview rounds for a shortlisted candidate and interviewers record their
feedback. The Interviews screen shows today's and upcoming rounds across all candidates.

**Why this priority**: The matrix names Interviews as a first-class item, and a candidate cannot
reach Selected without completed rounds. Depends on US2.

**Independent Test**: Schedule a technical round for a shortlisted candidate, submit a "recommend"
outcome with a score as the assigned interviewer, confirm the round shows Completed — without an
offer existing.

**Acceptance Scenarios**:

1. **Given** `/dashboard/recruitment/interviews`, **When** loaded, **Then** rounds are grouped into
   Today, Upcoming, and Overdue, each showing candidate, requisition, round number and type, time,
   mode, and interviewers.
2. **Given** the Schedule Interview modal, **When** a round number already exists for that candidate,
   **Then** the `409` is surfaced inline on the round-number field.
3. **Given** the Feedback modal, **When** opened by an assigned interviewer, **Then** it shows
   Outcome (recommend/hold/reject), a 1–10 score control, and a comments field; all three are
   required before Submit enables.
4. **Given** a user who is neither an assigned interviewer nor a permission holder, **When** they
   open a scheduled round, **Then** the Feedback action is not rendered.
5. **Given** a multi-interviewer round, **When** the round is viewed, **Then** each interviewer's
   individual outcome, score, and comments are listed separately.
6. **Given** the Reschedule action, **When** submitted without a reason, **Then** Save stays disabled;
   on success the prior time is shown in a collapsed history.
7. **Given** a candidate with an incomplete round, **When** advancing to Selected is attempted from
   the pipeline, **Then** the error names the pending rounds and links to them.
8. **Given** a scheduled round whose time has passed with no feedback, **When** the list renders,
   **Then** it appears under Overdue with a distinct marker.

---

### User Story 4 - Offers and Offer Letter Generation (Priority: P1)

An HR admin builds an offer for a selected candidate with a salary component breakup, generates the
offer letter, and records acceptance or decline.

**Why this priority**: The matrix names "Offer Letter Generation" explicitly. Depends on US3.

**Independent Test**: Create an offer with three salary components summing to the monthly CTC,
generate the letter, confirm a PDF downloads containing the candidate's name — without the candidate
joining.

**Acceptance Scenarios**:

1. **Given** the Offer modal, **When** opened for a Selected candidate, **Then** it shows Designation,
   Department, Offered CTC, a repeatable salary-component row editor, Proposed Joining Date,
   Probation Months, Notice Period Days, and Reporting Manager.
2. **Given** the component editor, **When** amounts are entered, **Then** a live total and a live
   variance against `offeredCtc / 12` are displayed, and Save stays disabled while the variance
   exceeds tolerance — pre-empting the backend rejection rather than surfacing it as an error.
3. **Given** an Offered CTC above the requisition's budgeted maximum, **When** entered, **Then** an
   inline "outside budget — needs approval" warning appears and the Issue action requires the
   approve permission.
4. **Given** a draft offer, **When** "Generate Letter" is clicked, **Then** a progress state is shown
   and, on success, the letter is downloadable and the offer status becomes Issued.
5. **Given** no active offer-letter template exists, **When** generation is attempted, **Then** the
   `409` is surfaced as a message naming the missing template type, with a link to the template
   screen — never a silently blank document.
6. **Given** an Issued offer, **When** Accept is clicked, **Then** a confirmed joining date can be
   entered and the candidate advances to Joining Pending.
7. **Given** an Accepted offer, **When** an edit to CTC or breakup is attempted, **Then** the fields
   are read-only and a "revise by issuing a new offer" affordance is shown instead.
8. **Given** a candidate with a prior issued offer, **When** a second offer is issued, **Then** the
   prior appears in a collapsed "superseded" history.

---

### User Story 5 - Joining and Onboarding Checklist (Priority: P1)

HR completes a candidate's joining, creating the employee, then works the onboarding checklist —
document verification and kit issue — on its own screen.

**Why this priority**: The matrix names "Employee Onboarding", "Document Verification", and "Kit
Issue". Joining is the handoff to 005. Depends on US4.

**Independent Test**: Complete joining for a candidate with an accepted offer, confirm the new
employee code is shown and the onboarding screen opens with checklist items seeded — without
verifying any document.

**Acceptance Scenarios**:

1. **Given** a candidate at Joining Pending, **When** "Complete Joining" is opened, **Then** the form
   collects Actual Joining Date, Date of Birth, Gender, Permanent Address, Emergency Contact, and
   optional Site.
2. **Given** a successful joining, **When** it completes, **Then** a success state shows the generated
   employee code and links to both the employee record (005) and the onboarding screen.
3. **Given** a joining more than the configured days after the confirmed date, **When** it completes,
   **Then** a "delayed joining" marker is shown with the day count — it does not block.
4. **Given** `/dashboard/recruitment/onboarding/[employeeId]`, **When** loaded, **Then** checklist
   items are grouped into Documents, Kit, and Induction, each with a status chip and a
   completed-count progress indicator.
5. **Given** a pending document item, **When** Verify is opened, **Then** it collects document number,
   optional expiry, and a file upload; a number failing the type's configured format is rejected
   inline before submit.
6. **Given** a pending kit item, **When** Issue is clicked, **Then** a quantity is collected and, where
   the kit item links to an inventory item, the resulting issue reference is displayed on the row.
7. **Given** a user without the approve permission, **When** viewing an item, **Then** the Waive
   action is not rendered; with it, Waive requires a non-empty reason.
8. **Given** every mandatory item completed or waived, **When** the screen refreshes, **Then** an
   "Onboarding complete" state is shown with the completion date.
9. **Given** an employee with pending mandatory documents, **When** their row is viewed, **Then** a
   marker explains that attendance is blocked by the existing Settings gate — the UI states the
   consequence rather than implementing a second check.

---

### User Story 6 - Letter Templates and Generated Letters (Priority: P2)

An admin maintains per-company letter templates with substitution tokens and browses every generated
letter with its version history.

**Why this priority**: The matrix names "Appointment Letter Generate" and "Generate relieving
letter". Depends on US5 for appointment letters.

**Independent Test**: Create an appointment-letter template using the token palette, generate it for
a joined employee, confirm the PDF downloads and a second generation shows v2 as current with v1
still downloadable.

**Acceptance Scenarios**:

1. **Given** `/dashboard/recruitment/letter-templates`, **When** loaded, **Then** templates are listed
   by type with an Active indicator; exactly one per type can be active.
2. **Given** the template editor, **When** opened, **Then** it shows a plain textarea with a token
   palette beside it; clicking a token inserts it at the cursor.
3. **Given** a template body containing an unknown token, **When** Save is attempted, **Then** the
   unknown tokens are highlighted inline and Save stays disabled — pre-empting the backend rejection.
4. **Given** a template being activated, **When** saved, **Then** the previously active template of
   that type visibly becomes inactive in the same list update.
5. **Given** `/dashboard/recruitment/letters`, **When** loaded, **Then** generated letters are listed
   with employee/candidate, type, version, issue date, and a Download action.
6. **Given** a letter with multiple versions, **When** its row is expanded, **Then** every version is
   listed with its issue date and remains downloadable.
7. **Given** a relieving letter requested before F&F is processed, **When** generation is attempted,
   **Then** the `409` is surfaced explaining that F&F must be processed first, with a link to the
   payroll screen.
8. **Given** a generated letter, **When** Download is clicked, **Then** the file downloads through the
   typed API client — never a raw `fetch` in the component.

---

### User Story 7 - Resignations and Resignation Report (Priority: P2)

HR records resignations, accepts them with an agreed last working day, and views the resignation
report with attrition figures.

**Why this priority**: The matrix names "Resignation report" under Exit/F&F. It feeds 005's exit
flow.

**Independent Test**: Record a resignation with a 30-day notice period, confirm the computed expected
last working day is displayed, and confirm the employee appears in that month's resignation report.

**Acceptance Scenarios**:

1. **Given** the New Resignation modal, **When** a resignation date and notice period are entered,
   **Then** the expected last working day is computed and displayed live before submit.
2. **Given** the reason field, **When** opened, **Then** a category dropdown and a detail textarea are
   both shown, and the category is required.
3. **Given** a submitted resignation, **When** Accept is opened with an agreed last working day earlier
   than expected, **Then** waiver days and a reason become required.
4. **Given** an employee who is already inactive or already has an open resignation, **When** a
   resignation is attempted, **Then** the `409` is surfaced with the reason.
5. **Given** `/dashboard/recruitment/reports/resignations`, **When** a period is selected, **Then** the
   report shows joining date, resignation date, last working day, tenure in months, reason category,
   and a settlement-pending marker, plus aggregate counts by category and the period attrition rate.
6. **Given** the report, **When** Export is clicked, **Then** the export follows the same
   synchronous-download / async-job handling the Dashboard feature already established.

---

### User Story 8 - New Joining Report and Funnel Analytics (Priority: P3)

HR views the new-joining report and a recruitment funnel with stage counts, conversion, time-to-hire,
and source effectiveness.

**Why this priority**: The matrix names "New joining report". Reporting is derivative of every other
screen.

**Independent Test**: With one joined and two in-pipeline candidates, open the funnel report and
confirm the stage counts and average time-to-hire match the pipeline.

**Acceptance Scenarios**:

1. **Given** `/dashboard/recruitment/reports/new-joinings`, **When** a period and optional department
   or project are selected, **Then** each joiner is listed with employee code, name, designation,
   department, project/site, joining date, source, requisition code, and offered CTC.
2. **Given** `/dashboard/recruitment/reports/funnel`, **When** loaded, **Then** stage counts are shown
   as a funnel visual with conversion percentages between consecutive stages.
3. **Given** the funnel report, **When** rendered, **Then** average time-to-hire in days and a
   per-source breakdown (candidates added, offers accepted, joined) are displayed.
4. **Given** any report with no data for the period, **When** loaded, **Then** a distinct empty state
   is shown — not an error.
5. **Given** a user without the reports permission, **When** a report route is opened, **Then**
   `middleware.ts` blocks it and the access-denied screen is shown.
6. **Given** a funnel chart, **When** rendered on a mobile viewport, **Then** it remains legible and
   scrolls horizontally within its own container rather than forcing the page to scroll sideways.

---

### Edge Cases

- A requisition closes while a candidate is mid-interview → the candidate stays readable and their
  rounds completable; the Offer action is disabled with a tooltip naming the closed requisition.
- The API returns a stage the client does not recognise (backend added a stage) → the board renders
  an "Other" column rather than dropping the candidate, and the table shows the raw stage label.
- A letter generation request is slow → a progress state is shown with the action disabled; a
  timeout surfaces a retry rather than a silent failure.
- The board is opened on a narrow phone → it falls back to the table view with the stage filter,
  since horizontal drag-and-drop columns are unusable at that width.
- A candidate's resume fails to upload → the candidate record is still created and the resume shows
  as missing with a retry action; the create is never rolled back client-side.
- Two HR users open the same onboarding checklist → item completion is per-item, so both can work
  different items; a stale item shows a conflict message on save.
- An offer's component editor is left with zero rows → Save is disabled with a message, rather than
  submitting an empty breakup.
- Session expires mid-form → the existing auth-notice pattern surfaces re-authentication without
  losing the in-progress form values.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: All routes MUST be under `/dashboard/recruitment/*` and protected by JWT auth.
- **FR-002**: `middleware.ts` MUST guard `/dashboard/recruitment/*` with the `RECRUITMENT`
  permission, and report routes additionally with `REPORTS`, matching the backend's guards.
- **FR-003**: Actions requiring `RECRUITMENT_APPROVE` (requisition approve/reject, issuing an
  outside-budget offer, waiving an onboarding item) MUST NOT be rendered at all for callers lacking
  that permission — hiding, not merely disabling.
- **FR-004**: All API calls MUST go through a typed `app/lib/api/recruitment.ts` module; no
  component may issue a raw `fetch()` (constitution Principle V).
- **FR-005**: Every API response MUST be validated with a `zod` schema at the boundary and the
  inferred type used downstream, never a hand-written duplicate interface (Principle IV).
- **FR-006**: The candidate list MUST render masked PII exactly as returned and MUST NOT attempt any
  client-side unmasking; the unmasked detail payload MUST NOT be written to any client-side cache,
  local storage, or session storage.
- **FR-007**: The pipeline MUST be a single screen serving the matrix's Interviews, Selected, and
  Joining Pending items via a deep-linkable `?stage=` filter, with both a table and a board view and
  the choice persisted per user.
- **FR-008**: The board view MUST fall back to the table view below the configured mobile breakpoint,
  since horizontal drag-and-drop columns are unusable at phone widths (Principle VI).
- **FR-009**: Stage changes on the board MUST be applied optimistically and reverted with an error
  toast on rejection, showing the current stage from the `409` response.
- **FR-010**: The offer salary-component editor MUST display a live total and a live variance against
  `offeredCtc / 12`, and MUST disable Save while the variance exceeds tolerance — pre-empting the
  backend rejection rather than surfacing it as an error.
- **FR-011**: The letter-template editor MUST validate tokens against the type's documented token set
  client-side, highlighting unknown tokens and disabling Save, pre-empting the backend rejection.
- **FR-012**: A `409` from any endpoint MUST be surfaced as a specific, actionable message — inline on
  the offending field where one exists, otherwise as a toast — never as a generic failure.
- **FR-013**: A missing active letter template MUST surface a message naming the missing type with a
  link to the template screen, never a blank document or a generic error.
- **FR-014**: All monetary values (CTC, salary components) MUST use `formatCurrency` from
  `app/lib/utils.ts`.
- **FR-015**: All status indicators MUST use the shared `StatusBadge` component with the documented
  colour mapping, never ad-hoc styling.
- **FR-016**: Every list screen MUST use the existing `ResponsiveList` component so it degrades to a
  card layout on mobile (Principle VI).
- **FR-017**: Every route, label, stage name, and status colour mapping MUST come from a constants
  module, never inline literals in components (Principle III).
- **FR-018**: Components MUST default to Server Components; `"use client"` MUST be pushed as far down
  the tree as possible — the board, the component-row editor, and the template editor are the
  expected client boundaries (Principle I).
- **FR-019**: Data shaping and API calls MUST live in `app/lib/`, not inline in component bodies
  (Principle I).
- **FR-020**: No component may use the inline `style={}` prop; conditional classes MUST use `clsx`
  (Principle II). The funnel chart's computed bar dimensions are the one permitted numeric exception
  and MUST be isolated to a single named line.
- **FR-021**: File uploads (resume, onboarding documents) MUST restrict accepted types via the
  `accept` attribute and show upload progress; a failed upload MUST NOT roll back the parent record.
- **FR-022**: Report exports MUST reuse the synchronous-download / async-job handling already
  established by the Dashboard feature, including a distinguishable failure state.
- **FR-023**: Every screen MUST remain usable at mobile viewport widths (320–428px) without horizontal
  page scrolling; wide tables and the funnel chart MUST scroll within their own container
  (Principle VI).
- **FR-024**: All interactive elements MUST meet the 44×44px minimum touch target, and no action may
  be reachable only via hover (Principle VI).
- **FR-025**: An unrecognised stage or status value returned by the API MUST degrade gracefully — an
  "Other" board column and the raw label in the table — never a dropped record or a crash.
- **FR-026**: Every list screen MUST show distinct loading (skeleton), empty, and error states, with
  the error state offering retry — reusing the existing `skeletons.tsx` patterns.

### Key Entities *(client-side view models)*

- **RequisitionListItem**: code, department, designation, filled/total positions, employment type,
  target joining date, age in days, status.
- **CandidateCard**: name, requisition, masked contact, stage, source, flags (noShow, duplicate).
- **InterviewRound**: candidate, round number and type, scheduled time, mode, interviewers, status,
  per-interviewer feedback.
- **OfferDraft**: designation, department, CTC, component rows with live total and variance, dates,
  probation, notice, reporting manager, outside-budget flag.
- **OnboardingChecklistView**: grouped items with status, completion actor and time, waiver reason,
  linked issue reference, and a progress count.
- **LetterTemplateDraft**: type, body, token palette, unknown-token highlights, active flag.
- **ResignationForm**: employee, dates, computed expected last working day, reason category and
  detail, waiver.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A recruiter can take a candidate from first entry to joined without leaving
  `/dashboard/recruitment/*` or re-entering any value already captured on the requisition or offer.
- **SC-002**: No unmasked candidate PII is present in any client-side cache or storage, verified by
  inspecting storage after a reveal action.
- **SC-003**: An offer whose components do not reconcile cannot be submitted from the UI — verified by
  a test asserting Save stays disabled.
- **SC-004**: Every screen renders without horizontal page scroll at 320px width.
- **SC-005**: Every backend `409` in this module maps to a specific, actionable message — verified by
  a test enumerating each conflict case.
- **SC-006**: The three matrix items Interviews, Selected, and Joining Pending each resolve to a
  working deep link.
- **SC-007**: A letter downloads with correct substituted values in under 10 seconds for one employee.

## Assumptions

- The backend feature `011-recruitment-onboarding-backend` is built first; this feature consumes its
  contract and adds no business logic of its own beyond the client-side pre-emption of known
  rejections (FR-010, FR-011).
- The board view uses a drag-and-drop interaction; the specific library is a planning decision, and
  the table view is the accessible fallback for keyboard and screen-reader users as well as mobile.
- Candidate-facing surfaces are out of scope (ratified 2026-09-01) — no public routes are added.
- Email or SMS delivery of letters is out of scope; HR downloads and delivers them.
- The funnel visual is a simple proportional chart, not an interactive analytics surface; a charting
  library choice is deferred to planning.
- Interview calendar integration is out of scope; interviewers are notified through the existing
  in-app notification surface built in 004.
