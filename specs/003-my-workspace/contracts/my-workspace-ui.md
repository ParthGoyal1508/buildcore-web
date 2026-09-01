# Contract: My Workspace UI routes and `app/lib/api/my-workspace.ts`

Routes live under a new `app/my/` shell (research.md §1). Every function below is a typed wrapper
in `app/lib/api/my-workspace.ts` calling the corresponding `buildcore-api` endpoint in
`specs/003-my-workspace-backend/contracts/my-workspace-api.md` (that document is the wire-level
authority).

## `/my/face-enrol` (User Stories 1, 7)

**Page**: `app/my/face-enrol/page.tsx` + `app/ui/my/face-enrolment-status.tsx` +
`app/ui/my/camera-capture.tsx` (shared, research.md §3).

**Functions**:
- `getEnrolmentStatus(): Promise<FaceEnrolmentStatus>` → `GET /my/face-enrol`
- `enrol(input: { photos: Blob[]; consentMethod; consentAcknowledged: true }): Promise<...>` →
  `POST /my/face-enrol` — the request shape is unchanged, but the screen no longer collects a
  method and always passes `digital` (FR-002a)
- `withdrawConsent(): Promise<void>` → `DELETE /my/face-enrol/consent` — retained in the client as
  a typed wrapper, but no longer called by any screen (FR-002b). Kept deliberately so a future
  admin/support surface can re-use it without re-deriving the call.
- `getReEnrolmentState(): Promise<ReEnrolmentState>` → derived from `GET /my/face-enrol`'s status
  field plus any pending-request detail the backend contract includes
- `requestReEnrolment(reason: string): Promise<void>` →
  `POST /my/face-enrol/re-enrolment-request`
- `completeReEnrolment(input: { photos: Blob[]; consentAcknowledged: true }): Promise<...>` →
  `POST /my/face-enrol/re-enrolment-complete`

## `/my/punch` (User Stories 2, 3, 6)

**Page**: `app/my/punch/page.tsx` + `app/ui/my/punch-clock.tsx` (live clock, research.md §7) +
`app/ui/my/attendance-history.tsx`.

**Functions**:
- `getTodayPunchState(): Promise<{ punchedInAt, punchedOutAt, isComplete }>` →
  `GET /my/punch/open` — what the employee has already punched today. `isComplete` means the
  day's pair is recorded and no control is offered (FR-019b, FR-019c)
- `submitPunch(input: { type; photo: Blob; latitude; longitude; capturedAt }):
  Promise<PunchResult>` → `POST /my/punch` — on a network failure or `navigator.onLine === false`,
  the caller (not this function) routes the same input into
  `app/lib/offline-queue.ts`'s `enqueue()` instead (research.md §5)
- `getAttendanceHistory(month, year): Promise<AttendanceDay[]>` →
  `GET /my/punch/history?month=&year=`

The offline queue module (`app/lib/offline-queue.ts`) exposes `enqueue(entry)`, `drainQueue()`
(called by the `online` event listener in `app/my/layout.tsx`), and `getQueuedCount()` (for the
"queued, will sync" indicator, spec FR-009).

## `/my/leave` (User Story 4)

**Page**: `app/my/leave/page.tsx` + `app/ui/my/leave-balance.tsx` +
`app/ui/my/leave-applications.tsx` + `app/ui/my/apply-leave-form.tsx`.

**Functions**:
- `getLeaveBalance(financialYear): Promise<LeaveBalance[]>` →
  `GET /my/leave/balance?financialYear=`
- `getLeaveApplications(): Promise<LeaveApplication[]>` → `GET /my/leave/applications`
- `applyLeave(input): Promise<LeaveApplication>` → `POST /my/leave/applications` — a 400
  (over-balance) response is surfaced as the form's inline error; `apply-leave-form.tsx` also
  computes and displays the day count client-side before submission (spec FR-011) using the same
  weekend/holiday-exclusion logic the backend applies, sourced from a
  `getHolidayCalendar(siteId)` call so the preview matches what the backend will actually compute
- `cancelLeaveApplication(id): Promise<void>` → `POST /my/leave/applications/:id/cancel`

## `/my/salary` (User Story 5)

**Page**: `app/my/salary/page.tsx` + `app/ui/my/salary-slip.tsx`.

**Functions**:
- `getAvailablePeriods(): Promise<string[]>` → `GET /my/salary/available-periods`
- `getSalarySlip(period): Promise<SalarySlip>` → `GET /my/salary/:period`
- `downloadSalarySlipPdf(period): Promise<Blob>` → `GET /my/salary/:period/pdf` (research.md §8;
  triggers a browser save via an object URL, not routed through the JSON `apiFetch` wrapper since
  the response isn't JSON)

## `/my/reimbursements` (User Story 8)

**Page**: `app/my/reimbursements/page.tsx` + `app/ui/my/reimbursement-claims.tsx` (history and row
actions) + `app/ui/my/reimbursement-form.tsx` (file and edit, one component for both).

**Functions**:
- `getReimbursementCategories(): Promise<ReimbursementCategory[]>` →
  `GET /my/reimbursements/categories`
- `getReimbursementClaims(): Promise<ReimbursementClaim[]>` → `GET /my/reimbursements`
- `createReimbursementClaim(input: ClaimInput): Promise<ReimbursementClaim>` →
  `POST /my/reimbursements`
- `updateReimbursementClaim(id, input): Promise<ReimbursementClaim>` →
  `PATCH /my/reimbursements/:id` — also how a draft is submitted, via `{ status: 'submitted' }`
- `withdrawReimbursementClaim(id): Promise<ReimbursementClaim>` →
  `POST /my/reimbursements/:id/withdraw`
- `deleteReimbursementClaim(id): Promise<void>` → `DELETE /my/reimbursements/:id`

`ClaimInput.receipt` is base64 image data sent inside the create/edit request, not a separate
upload — a two-step upload would orphan the blob of every claim the employee abandons. The claim
`amount` is coerced from the string Prisma serialises `DECIMAL` as, so components format a number
rather than each deciding how to parse it.

## Shared: `app/my/layout.tsx`

Bottom tab bar (Punch/Leave/Salary/**Claims**/Face-Enrol), the cross-shell "Admin Dashboard" link
for dual-role users (research.md §2), and registration of the `online` event listener that drains
the offline punch queue (research.md §5).

The Claims tab is labelled "Claims" rather than "Reimbursements": six tabs share the width of a
phone, and the full word would either wrap or force a smaller label than its neighbours.

## Shared: `app/sw.ts`

Precaches the `/my/*` app shell. Prepends a `NetworkOnly` rule for all cross-origin requests ahead
of Serwist's `defaultCache`, whose final rule would otherwise cache every `buildcore-api` GET for
an hour (FR-019a). Rules are matched in order, so the earlier rule wins. Fonts are unaffected:
`next/font/google` self-hosts them at build time, making them same-origin requests.

## Shared: `app/ui/dashboard/nav-links.tsx` (MODIFIED)

Adds a "My Workspace" entry (`/my/punch`) alongside the existing eight module links, for a
dual-role admin user to reach this shell from the admin sidenav (research.md §2).
