# Research: HR & Payroll Frontend (Employees, Attendance, Leave, Payroll, Challans, Loans, Daily Workers)

## 1. Route structure under `/dashboard/hr/*`

**Decision**: `app/dashboard/hr/employees/`, `.../attendance/`, `.../leave/`, `.../payroll/`,
`.../challans/`, `.../loans/`, `.../daily-workers/`, each with their own `page.tsx`, all under the
existing `DashboardLayout` shell. `nav-links.tsx`'s existing "HR & Payroll" entry now points at a
real landing page (`app/dashboard/hr/page.tsx`, a simple sub-nav to the seven areas) instead of a
404.

**Rationale**: Direct continuation of the precedent `nav-links.tsx` already encodes, and the same
`/dashboard/<module>` convention Settings and Dashboard both established.

**Alternatives considered**: None — this is a settled precedent, not a fresh decision.

## 2. Eight-tab Employee form: dedicated page, not a modal

**Decision**: `app/dashboard/hr/employees/[id]/edit/page.tsx` (and `/new/page.tsx` for create) — a
full page with a persistent tab strip, one `react-hook-form` instance spanning all eight tabs
(identical pattern to Settings' Company modal, research.md §5 there, just page-sized instead of
modal-sized).

**Rationale**: Settings' five-tab Company modal is small enough to stay a modal; eight tabs
including a photo upload, multiple address blocks, and a document-upload grid is materially larger
— a full page gives it room and a real URL (useful for the "warn before navigating away," FR-018,
via Next.js's route-change interception).

**Alternatives considered**: A modal like Settings' — rejected: would require internal scrolling
within an already-cramped modal for a form this size, a worse experience than a dedicated page.

## 3. Promoting `CameraCapture` and geolocation logic to a shared location

**Decision**: `app/ui/my/camera-capture.tsx` moves to `app/ui/shared/camera-capture.tsx`; the
geolocation-acquisition function inside My Workspace's `punch-clock.tsx` is extracted to
`app/lib/geolocation.ts`. Both features (`app/my/`, `app/dashboard/hr/`) import from the new shared
locations; My Workspace's own imports are updated as part of this feature's work (a small,
mechanical refactor).

**Rationale**: Per the clarification-adjacent fix — Daily Worker attendance capture needs the exact
same camera and GPS acquisition behavior My Workspace's punch flow already has; duplicating either
would risk the two implementations drifting (e.g., different accuracy thresholds).

**Alternatives considered**: Duplicate a second camera/geolocation implementation scoped to this
feature — rejected: exactly the drift risk above, for a component with no feature-specific
behavior difference to justify two copies.

## 4. Salary Slip: shared rendering component, feature-specific data fetching

**Decision**: My Workspace's `app/ui/my/salary-slip.tsx` is promoted to `app/ui/shared/salary-
slip.tsx` (same reasoning as §3), accepting a `SalarySlip` data prop regardless of caller. This
feature's `app/lib/api/hr-payroll.ts` adds its own `getEmployeeSalarySlip(runId, employeeId)`
calling the new admin endpoint (`GET /hr/payroll/runs/:id/employees/:employeeId/slip`) — never My
Workspace's `getSalarySlip(period)` (which resolves strictly to the caller's own data server-side
and has no `employeeId` parameter to target anyone else).

**Rationale**: Directly implements the clarification-adjacent fix — reuse the presentational
component, not the access-scoped data path, which are two different concerns that happened to be
combined in one file in My Workspace's original, simpler context (only ever the caller's own slip).

**Alternatives considered**: Call My Workspace's existing `getSalarySlip` and just ignore its
implicit "current user" scoping — not actually possible (the endpoint has no employeeId parameter
by design, per its own spec's FR-028 "never any other employee's data") — this alternative doesn't
exist as a real option, confirming the two-function split is required, not a stylistic choice.

## 5. PII reveal UI

**Decision**: A small `<MaskedField value maskedValue onReveal={...} />` component
(`app/ui/hr/masked-field.tsx`) shows the masked value with a "Reveal" icon-button; clicking it calls
`revealEmployeePii(employeeId, field)` and swaps in the real value client-side for that session/view
only (not persisted to any client cache beyond the current render).

**Rationale**: One small, reusable component keeps the reveal interaction (and its audit-triggering
API call) consistent everywhere Aadhaar/PAN/bank-account/UAN appear (List, Detail, Edit form),
rather than four separate implementations.

**Alternatives considered**: Reveal all PII fields at once when any one is clicked — rejected: each
reveal is its own audited action server-side (API spec, research.md §3 there); revealing four
fields from one click would misrepresent what was actually viewed in the audit trail.

## 6. Payroll status-transition confirmation

**Decision**: "Mark as Processed" and "Mark as Paid" both use a standard confirm dialog (not a
type-to-confirm pattern) whose copy explicitly states the consequence ("This will lock this
period's figures — further corrections require a new adjustment entry next cycle"), reusing this
app's existing dialog/modal primitives.

**Rationale**: Matches the weight of other already-established irreversible actions in this app
(e.g., Settings' role deletion warning) without introducing a heavier-than-precedent interaction
pattern for what is, in the end, one more confirm-and-proceed action.

**Alternatives considered**: Require re-typing the period (like a destructive-delete confirmation
in some apps) — rejected as disproportionate; this app has no existing precedent for that heavier
pattern anywhere else, and "Processed" is a normal (if consequential) workflow step, not a data-loss
action.

## 7. Data fetching and async payroll generation

**Decision**: `@tanstack/react-query` (reused, per this app's now-standard pattern) for every list/
detail fetch. Payroll generation (`POST /hr/payroll/generate`) is a synchronous request from the
frontend's point of view (the backend computes within one transaction, research.md §4 of the API
spec) — no polling needed for generation itself; only the resulting list refetches on completion.

**Rationale**: The API's own payroll engine is synchronous per its research.md §4 (not a background
job) — there's nothing for the frontend to poll for generation. The "in-progress" edge case in
spec.md refers to the ordinary case of a slow request, handled by a normal loading state, not an
async-job pattern like Dashboard's report exports.

**Alternatives considered**: Treat payroll generation like Dashboard's async export (immediate
202 + poll) — rejected: doesn't match the actual backend contract, which returns the completed run
directly; inventing async handling for a synchronous endpoint would be needless complexity.

## 8. Daily Worker bulk marking

**Decision**: The attendance capture screen's roster list supports multi-select (checkboxes) with
a single "Mark Selected Present" bulk action; face-match marking remains a one-at-a-time flow (each
match requires its own capture) but manual marking supports the bulk path.

**Rationale**: Matches the PRD's own distinction — face-match is inherently per-worker (one photo,
one match), while manual marking (used "at the start of the shift" per the PRD) is exactly where
bulk selection saves real time.

**Alternatives considered**: Bulk face-match (capture once, match against multiple) — not
supported by the underlying biometric contract (one photo matches one descriptor per the backend's
own design) and not requested by the PRD.

## 9. Accessibility and mobile-first patterns

**Decision**: Reuses the established `ResponsiveList` pattern for every table in this feature
(Employee List, Attendance, Leave, Payroll, Challans, Loans, Daily Worker Registry/Attendance) and
the semantic-HTML/keyboard-operability conventions for every form/modal/filter, built into each
component's own task from the start (per this session's now-consistent practice) rather than
verified only at Polish.

**Rationale**: Consistency with the repo-wide convention; explicitly building it in from the start
avoids the recurring gap-then-fix pattern earlier features in this session needed their own
analyze passes to catch.

**Alternatives considered**: None — settled precedent, applied proactively this time.

## 10. Offboarding/F&F, Reimbursements Admin, Attendance Import — added during the master-PRD
alignment pass

**Decision**: These three screens (User Stories 11–13) were missing from this feature's original
spec despite already being fully specced on the backend (specs/005-hr-payroll-backend User
Stories 11–13) — an oversight caught during a master-PRD alignment audit, not a deliberate scope
exclusion. All three reuse existing UI infrastructure: the F&F Process action reuses the payroll
run confirmation flow (research.md — same component as User Story 5's Process/Pay actions);
Reimbursements Admin is a new `ResponsiveList` screen at `/dashboard/hr/reimbursements`; Attendance
Import is a new upload+report flow at `/dashboard/hr/attendance/import`, surfaced as an action on
the existing Attendance screen (User Story 3) rather than a separate top-level nav entry.

**Rationale**: No new architectural pattern is needed for any of the three — they compose existing
building blocks (payroll-run confirmation UI, `ResponsiveList`, a validation-report-then-commit
upload flow analogous to BOQ/Employee-master import elsewhere in the master PRD).

**Alternatives considered**: A separate top-level nav entry for Attendance Import — rejected; it's
a backfill action on an existing screen, not a distinct daily-use destination.

## 11. Reimbursement Categories tab — found missing on a second pass

**Decision**: This feature adds a sixth tab, `reimbursement-category-tab.tsx`, to Settings'
existing `/dashboard/settings/employee-setup/page.tsx` (feature 002) — the same non-invasive
"feature adds to an earlier feature's surface" pattern already used for the backend schema
(specs/005-hr-payroll-backend research.md §15). Functions (`listReimbursementCategories`,
`createReimbursementCategory`, `updateReimbursementCategory`) go in the existing
`app/lib/api/settings.ts`, matching every other Employee Setup master's function location — not a
new file under `app/lib/api/hr-payroll.ts`, since this data isn't HR-specific.

**Rationale**: Matches the backend's own placement decision exactly; keeps every Employee Setup
master's admin surface in one screen rather than fragmenting it across two feature areas.

**Alternatives considered**: A tab within this feature's own Reimbursements screen (User Story 12)
— rejected: category management is company configuration, not claim review, and belongs with its
sibling masters (Departments, Designations, Document Types, Shifts) for the same reason those
aren't scattered across the modules that merely consume them.
