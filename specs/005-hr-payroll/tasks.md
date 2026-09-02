---

description: "Task list for feature implementation"
---

# Tasks: HR & Payroll Frontend (Employees, Attendance, Leave, Payroll, Challans, Loans, Daily Workers)

**Input**: Design documents from `/specs/005-hr-payroll/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md,
contracts/hr-payroll-ui.md, quickstart.md

**Tests**: Not included — no automated test framework is installed in `buildcore-web` yet
(constitution's documented gap); verification is manual via `quickstart.md`.

**Organization**: Tasks are grouped by user story (from spec.md). Every component-building task
bakes in desktop-first responsiveness (unbroken at 768px, wide tables scrolling in their own
container; `ResponsiveList` optional per constitution v2.0.0) and keyboard-operability/semantic-HTML requirements and
route-guard permissions from the start, per this session's established practice (rather than a
Polish-phase retrofit). All paths are in this repo (`buildcore-web`) — the backend is a separate,
already-fully-specced feature in `buildcore-api` (`specs/005-hr-payroll-backend`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US10)
- Every task includes an exact file path

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 [P] Add `/dashboard/hr/*` routes and copy to `app/lib/constants.ts`
- [X] T002 [P] Create `zod` schemas for `Employee`, `EmployeeDocument`, `EmployeeTransfer`,
      `AttendanceRecord`, `AttendanceModification`, `Holiday`, `LeaveApplication`/`LeaveBalance`
      (admin views), `PayrollRun`/`PayrollLineItem`, Challan row shapes, `Loan`/
      `LoanScheduleEntry`, `DailyWorker`/`DailyWorkerAttendance`, `ReEnrolmentRequest` (admin
      view) in `app/lib/api/hr-payroll.ts`

**Checkpoint**: Constants and response schemas ready.

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [~] T003 **Not needed** — the only second consumer was US9 (omitted; superseded by 013), so
      this would move a file for one caller. Move `app/ui/my/camera-capture.tsx` → `app/ui/shared/camera-capture.tsx`; update My
      Workspace's imports — research.md §3
- [~] T004 **Not needed** — same reason as T003. Extract the geolocation-acquisition logic from My Workspace's `punch-clock.tsx` into
      `app/lib/geolocation.ts`; update My Workspace's usage — research.md §3
- [X] T005 Move `app/ui/my/salary-slip.tsx` → `app/ui/shared/salary-slip.tsx` (presentational
      component only, takes a `SalarySlip` data prop); update My Workspace's usage — research.md §4
- [X] T006 Extend `middleware.ts` so its route matcher covers `/dashboard/hr/*` with the
      permission-per-area mapping (`EMPLOYEES`/`ATTENDANCE`/`PAYROLL`/`CHALLANS`/`LOANS`/
      `DAILY_WORKER_REGISTRY`) — spec FR-020 access-control equivalent, contracts/hr-payroll-ui.md
- [X] T007 [P] Create `app/dashboard/hr/page.tsx`: a simple landing/sub-nav to the seven areas,
      finally resolving `nav-links.tsx`'s existing "HR & Payroll" entry

**Checkpoint**: Shared components/utilities promoted, route protection extended, landing page
ready — user story implementation can now begin in parallel.

---

## Phase 3: User Story 1 - Maintain full employee records (Priority: P1) 🎯 MVP

**Goal**: Employee List, eight-tab Add/Edit form, Detail page, PII masking/reveal.

**Independent Test**: Create an employee across all tabs, confirm List/Detail reflect it and PII
is masked.

### Implementation for User Story 1

- [X] T008 [P] [US1] Add `listEmployees()`, `getEmployee()`, `createEmployee()`,
      `updateEmployee()`, `revealEmployeePii()` to `app/lib/api/hr-payroll.ts`
- [X] T009 [US1] Create `app/ui/hr/masked-field.tsx`: masked-by-default display + per-field
      Reveal action (research.md §5) — native `<button>`, keyboard-operable
- [X] T010 [US1] Create `app/ui/hr/employee-list.tsx`: `ResponsiveList`-based, search/department/
      site/status/company filters, Documents-progress column (depends on T008)
- [X] T011 [US1] Create `app/ui/hr/employee-form.tsx`: one `react-hook-form` instance across eight
      presentational tabs (research.md §2), conditional required fields per Employment
      Type/Statutory toggles, `MaskedField` (T009) for PII inputs, native `<label>`/`<button>`
      elements throughout, focus-trapped where modal-like sections exist — spec FR-001, FR-018
      (unsaved-changes navigation warning), FR-003
- [X] T012 [US1] Create `app/dashboard/hr/employees/page.tsx`,
      `new/page.tsx`, `[id]/edit/page.tsx` (depends on T010, T011)
- [X] T013 [US1] Create `app/ui/hr/employee-detail-tabs.tsx`: Overview/Personal/Employment/Salary
      Structure/Attendance Calendar (via 003's month-history call)/Leave Summary/Documents/Loan
      History, keyboard-operable tab navigation
- [X] T014 [US1] Create `app/dashboard/hr/employees/[id]/page.tsx` rendering
      `EmployeeDetailTabs` (depends on T013)

**Checkpoint**: User Story 1 fully functional and independently testable.

---

## Phase 4: User Story 2 - Manage employee documents (Priority: P1)

**Goal**: Documents tab upload UI, mandatory-completion indicator, expiry warnings.

**Independent Test**: Upload documents, confirm progress bar and expiry warnings render correctly.

### Implementation for User Story 2

- [X] T015 [P] [US2] Add `uploadEmployeeDocument()`, `listEmployeeDocuments()` to
      `app/lib/api/hr-payroll.ts`
- [X] T016 [US2] Create `app/ui/hr/documents-tab.tsx`: per-document-type upload control
      (conditional number/expiry fields per type), expiry-warning indicator, native
      `<label>`/`<button>` elements — spec FR-004 (depends on T015)
- [X] T017 [US2] Register `DocumentsTab` within `employee-form.tsx` (T011) and
      `employee-detail-tabs.tsx` (T013)
- [ ] T018 [US2] Wire the "which document(s) are missing" specific message into any
      attendance-marking rejection UI this feature or My Workspace's punch flow surfaces — spec
      FR-005

**Checkpoint**: User Stories 1 AND 2 both independently functional.

---

## Phase 5: User Story 3 - Administer attendance (Priority: P1)

**Goal**: Daily Attendance table, Mark/Edit/Exceptions/Modifications modals, Holidays.

**Independent Test**: Edit an entry, confirm the Modifications modal shows the diff; declare a
holiday and confirm status reflects it.

### Implementation for User Story 3

- [X] T019 [P] [US3] Add `getDailyAttendance()`, `markAttendance()`, `updateAttendance()`,
      `getExceptions()`, `getModifications()`, `listHolidays()`, `createHoliday()` to
      `app/lib/api/hr-payroll.ts`
- [X] T020 [US3] Create `app/ui/hr/attendance-table.tsx`: `ResponsiveList`-based, date picker +
      site filter, status badges (depends on T019)
- [X] T021 [US3] Create `app/ui/hr/mark-edit-modal.tsx`: focus-trapped, native form elements,
      "period locked" message handling — spec FR-008 (depends on T019)
- [X] T022 [US3] Create `app/ui/hr/exceptions-modal.tsx` and `modifications-modal.tsx`:
      `ResponsiveList`-based, focus-trapped (depends on T019)
- [X] T023 [US3] Create `app/ui/hr/holidays-panel.tsx`: list + declare form, native elements,
      keyboard-operable (depends on T019)
- [X] T024 [US3] Create `app/dashboard/hr/attendance/page.tsx` composing all of the above
      (depends on T020–T023)

**Checkpoint**: User Stories 1–3 independently functional.

---

## Phase 6: User Story 4 - Administer leave (Priority: P1)

**Goal**: All-employee leave applications table + balance table.

**Independent Test**: Approve/reject applications, confirm balances view is correct.

### Implementation for User Story 4

- [X] T025 [P] [US4] Add `listAllLeaveApplications()`, `decideLeaveApplication()`,
      `listLeaveBalances()` to `app/lib/api/hr-payroll.ts`
- [X] T026 [US4] Create `app/ui/hr/leave-applications-table.tsx`: `ResponsiveList`-based,
      Approve/Reject (remarks)/Cancel actions per status, native `<button>` elements, informational
      note for payroll-locked-period approvals (not blocking) — spec Edge Cases (depends on T025)
- [X] T027 [US4] Create `app/ui/hr/leave-balance-table.tsx`: `ResponsiveList`-based (depends on
      T025)
- [X] T028 [US4] Create `app/dashboard/hr/leave/page.tsx` (depends on T026, T027)

**Checkpoint**: User Stories 1–4 independently functional.

---

## Phase 7: User Story 7 - Track employee loans (Priority: P2, built ahead of Payroll since
Payroll's engine consumes loan data)

**Goal**: Loan List, New Loan modal, EMI schedule view.

**Independent Test**: Create a loan, confirm the schedule renders correctly.

### Implementation for User Story 7

- [X] T029 [P] [US7] Add `listLoans()`, `createLoan()`, `getLoanSchedule()`, `closeLoan()` to
      `app/lib/api/hr-payroll.ts`
- [X] T030 [US7] Create `app/ui/hr/loan-list.tsx`: `ResponsiveList`-based (depends on T029)
- [X] T031 [US7] Create `app/ui/hr/new-loan-modal.tsx`: focus-trapped, native form elements
      (depends on T029)
- [X] T032 [US7] Create `app/dashboard/hr/loans/page.tsx`,
      `[id]/schedule/page.tsx` (`ResponsiveList`-based schedule table) (depends on T030, T031)

**Checkpoint**: User Stories 1–4 and 7 independently functional.

---

## Phase 8: User Story 5 - Generate payroll and view salary slips (Priority: P1)

**Goal**: Payroll generation, list, status workflow, salary slip (shared renderer), bank sheet
export.

**Independent Test**: Generate payroll, confirm figures, view/download a slip, progress the run
through Processed/Paid.

### Implementation for User Story 5

- [X] T033 [P] [US5] Add `generatePayroll()`, `listPayrollRuns()`, `processPayrollRun()`,
      `markPayrollRunPaid()`, `getEmployeeSalarySlip()` (admin-scoped — never My Workspace's
      `getSalarySlip`, research.md §4), `downloadSalarySlipPdf()`, `downloadBankSheet()` to
      `app/lib/api/hr-payroll.ts`
- [X] T034 [US5] Create `app/ui/hr/generate-payroll-form.tsx`: month selector, triggers
      `generatePayroll()` (depends on T033)
- [X] T035 [US5] Create `app/ui/hr/payroll-list.tsx`: `ResponsiveList`-based, status-transition
      actions (Process/Pay) each behind a confirm dialog explaining the lock consequence
      (research.md §6), editing controls hidden once Processed — spec FR-010 (depends on T033)
- [X] T036 [US5] Create `app/dashboard/hr/payroll/page.tsx` composing `GeneratePayrollForm` +
      `PayrollList` (depends on T034, T035)
- [X] T037 [US5] Create `app/dashboard/hr/payroll/[runId]/employees/[employeeId]/slip/page.tsx`:
      renders the shared `salary-slip.tsx` (T005) fed by `getEmployeeSalarySlip()`, plus a PDF
      Download action (depends on T005, T033)
- [X] T038 [US5] Wire the Bank Salary Sheet export action (`downloadBankSheet()`) on
      `payroll-list.tsx` or the run detail area — spec FR-012 (depends on T033)

**Checkpoint**: User Stories 1–5 and 7 independently functional — the feature's core MVP loop.

---

## Phase 9: User Story 6 - View statutory challans (Priority: P2)

**Goal**: PF/ESIC/PT tabs with month selector and export.

**Independent Test**: Select a Processed month, confirm figures and totals render; export one tab.

### Implementation for User Story 6

- [X] T039 [P] [US6] Add `getPfChallan()`, `getEsicChallan()`, `getPtChallan()`,
      `exportChallan()` to `app/lib/api/hr-payroll.ts`
- [X] T040 [US6] Create `app/ui/hr/challan-tabs.tsx`: three `ResponsiveList`-based tabs, month
      selector, "not yet processed" empty state, export action per tab — spec FR-013 (depends on
      T039)
- [X] T041 [US6] Create `app/dashboard/hr/challans/page.tsx` (depends on T040)

**Checkpoint**: User Stories 1–7 independently functional.

---

## Phase 10: User Story 8 - Transfer an employee across companies (Priority: P2)

**Goal**: Transfer action on an employee record.

**Independent Test**: Transfer a test employee, confirm the list reflects the new company.

### Implementation for User Story 8

- [X] T042 [US8] Add `transferEmployee()` to `app/lib/api/hr-payroll.ts`
- [X] T043 [US8] Create `app/ui/hr/transfer-modal.tsx`: Target Company/Transfer Date/Reason/
      Retain Code toggle, focus-trapped, native form elements (depends on T042)
- [ ] T044 [US8] Register `TransferModal` as an action on `employee-detail-tabs.tsx` (T013) /
      `employee-list.tsx` (T010) row actions

**Checkpoint**: User Stories 1–8 independently functional.

---

## Phase 11: User Story 9 - Register and mark attendance for daily workers (Priority: P3)

**Goal**: Registry + enrolment form (shared camera capture), mobile-optimized attendance capture
(face-match + manual + bulk).

**Independent Test**: Enrol a worker, mark them present via face-match, confirm the table reflects
it.

### Implementation for User Story 9

- [ ] T045 [P] [US9] Add `listDailyWorkers()`, `enrolDailyWorker()`, `deactivateDailyWorker()`,
      `convertDailyWorker()`, `markDailyWorkerAttendance()`, `getDailyWorkerAttendance()`,
      `getDailyWorkerWageSummary()` to `app/lib/api/hr-payroll.ts`
- [ ] T046 [US9] Create `app/ui/hr/daily-worker-registry.tsx`: `ResponsiveList`-based list +
      one-time enrolment form using the shared `CameraCapture` (T003) for 3–5 photos and a consent-
      attestation control, defaulting Site to the supervisor's assigned site — spec FR-015 (depends
      on T003, T045)
- [ ] T047 [US9] Create `app/ui/hr/daily-worker-attendance-capture.tsx`: mobile-optimized,
      face-match (via shared `CameraCapture` + `BiometricsService`-backed API call) and manual
      fallback (visibly distinguished per spec FR-016) marking, multi-select + "Mark Selected
      Present" bulk action (research.md §8), uses the shared geolocation utility (T004) (depends on
      T003, T004, T045)
- [ ] T048 [US9] Create `app/dashboard/hr/daily-workers/page.tsx` (registry) and
      `attendance/page.tsx` (capture screen) (depends on T046, T047)
- [ ] T049 [US9] Wire the wage-summary view (`getDailyWorkerWageSummary()`) and the
      deactivate/convert actions onto the registry page — spec FR-015 (depends on T045, T048)

**Checkpoint**: User Stories 1–9 independently functional.

---

## Phase 12: User Story 10 - Review biometric re-enrolment requests (Priority: P3)

**Goal**: Admin queue with approve/reject.

**Independent Test**: View a pending request, approve it, confirm status updates.

### Implementation for User Story 10

- [ ] T050 [P] [US10] Add `listReEnrolmentRequests()`, `decideReEnrolmentRequest()` (reuses My
      Workspace's existing decide endpoint) to `app/lib/api/hr-payroll.ts`
- [ ] T051 [US10] Create `app/ui/hr/reenrolment-queue.tsx`: `ResponsiveList`-based, Approve
      (optional remarks)/Reject (mandatory remarks) actions, native `<button>` elements (depends
      on T050)
- [ ] T052 [US10] Register `ReEnrolmentQueue` as a tab/section within the Employees area
      (`app/dashboard/hr/employees/page.tsx`, T012)

**Checkpoint**: All ten original user stories independently functional.

---

## Phase 13: User Story 11 - Employee offboarding and Full & Final settlement (Priority: P3)

**Goal**: Initiate exit, view F&F summary, process it, see Inactive status reflected everywhere.

**Independent Test**: Initiate exit for a seeded employee, view the F&F summary, process it,
confirm Status shows Inactive on the Employee List/Detail.

### Implementation for User Story 11

- [ ] T058 [P] [US11] Add `initiateExit()`, `getFnfSummary()`, `processFnf()` to
      `app/lib/api/hr-payroll.ts`
- [ ] T059 [US11] Create `app/ui/hr/exit-modal.tsx` and `app/ui/hr/fnf-summary.tsx`,
      keyboard-operable, reusing the existing payroll-run confirmation UI for Process (research.md
      §10) (depends on T058)
- [ ] T060 [US11] Register both on the Employee Detail page (`app/dashboard/hr/employees/[id]/
      page.tsx`, T013) (depends on T059)

**Checkpoint**: All eleven user stories independently functional.

---

## Phase 14: User Story 12 - Reimbursement claims admin review (Priority: P3)

**Goal**: Filterable claims list, Approve/Reject/Mark Paid actions, Register view.

**Independent Test**: Seed a Submitted claim, approve it, mark it paid directly, confirm a second
claim can be rejected with mandatory remarks.

### Implementation for User Story 12

- [ ] T061 [P] [US12] Add `listReimbursements()`, `approveReimbursement()`,
      `rejectReimbursement()`, `payReimbursement()`, `getReimbursementRegister()` to
      `app/lib/api/hr-payroll.ts`
- [ ] T062 [US12] Create `app/ui/hr/reimbursements-list.tsx` (`ResponsiveList`-based, status
      filter), `decide-claim-modal.tsx`, `pay-claim-modal.tsx`, all keyboard-operable (depends on
      T061)
- [ ] T063 [US12] Implement `app/dashboard/hr/reimbursements/page.tsx` (depends on T062)
- [ ] T063a [US12] Add `listReimbursementCategories()`, `createReimbursementCategory()`,
      `updateReimbursementCategory()` to `app/lib/api/settings.ts`; create
      `app/ui/settings/reimbursement-category-tab.tsx` and register it as a sixth tab on
      `app/dashboard/settings/employee-setup/page.tsx` (feature 002) — FR-029, research.md §11,
      found missing on a second alignment-audit pass (depends on Foundational only)

**Checkpoint**: All twelve user stories independently functional.

---

## Phase 15: User Story 13 - Bulk attendance import (Priority: P3)

**Goal**: CSV template download, upload + validation report, commit-only-validated-rows.

**Independent Test**: Upload a CSV mixing valid/invalid rows, confirm the report and nothing
committed, then commit only the valid rows and confirm they appear in Daily Attendance.

### Implementation for User Story 13

- [ ] T064 [P] [US13] Add `getAttendanceImportTemplate()`, `validateAttendanceImport()`,
      `commitAttendanceImport()` to `app/lib/api/hr-payroll.ts`
- [ ] T065 [US13] Create `app/ui/hr/attendance-import-modal.tsx` — template download, upload,
      row-level validation report display, Commit action, keyboard-operable (depends on T064)
- [ ] T066 [US13] Register the Import action on the existing Attendance screen
      (`app/dashboard/hr/attendance/page.tsx`, T023) (depends on T065)

**Checkpoint**: All thirteen user stories independently functional.

---

## Phase 16: Polish & Cross-Cutting Concerns

- [ ] T067 [P] Run `npm run lint` and `next build`/`tsc --noEmit` across all new/modified files
- [ ] T068 [P] Manually verify every list screen across all thirteen user stories renders as cards
      at a mobile viewport (spot-check, since `ResponsiveList` reuse was built in per-component) —
      spec FR-020/SC-006
- [ ] T069 [P] Manually verify every non-camera interactive control across all screens is
      keyboard-operable with a visible focus indicator (spot-check) — spec FR-020/SC-005
- [ ] T070 [P] Manually verify zero PII values are ever visible without an explicit Reveal action
      — spec SC-002
- [ ] T071 Run the full `quickstart.md` validation scenarios end-to-end and record results

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories (component/utility
  promotion and route protection both need to land before any story reuses them)
- **User Stories (Phase 3–15)**: All depend on Foundational
  - US1 (Employees) is the root dependency — US2 (Documents), US8 (Transfer) extend it directly
  - US2 depends on US1's form/detail existing
  - US3 (Attendance admin), US4 (Leave admin) depend only on Foundational + 003's existing data
  - US7 (Loans) is independent of US1–US4 — built ahead of US5 since Payroll's generation form
    conceptually depends on loan data existing to demo correctly, though technically only the
    backend enforces that dependency
  - US5 (Payroll) depends on US1 (employee data), US3 (attendance), and benefits from US7 (loans)
    existing to fully exercise the deduction path, and directly depends on T005 (shared
    salary-slip component)
  - US6 (Challans) depends on US5's payroll data existing
  - US9 (Daily Workers) depends only on Foundational (T003, T004) — fully independent of US1–US8
  - US10 (Re-enrolment queue) depends only on Foundational + 003's existing data
  - US11 (Offboarding/F&F) depends on US1 (Employee Detail page to attach to) and US5 (reused
    payroll-run confirmation UI)
  - US12 (Reimbursements Admin) depends only on Foundational — independent of every other story
  - US13 (Attendance Import) depends on US3 (registers onto the existing Attendance screen)
- **Polish (Phase 16)**: Depends on all desired user stories being complete

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- Within Foundational, T003–T005 (component/utility promotion) can run in parallel; T006/T007 can
  run in parallel with those
- Once Foundational completes: US1, US3, US4, US7, US9, US10 can all start in parallel; US2 and
  US8 follow shortly after US1; US5 follows US1+US3(+US7); US6 follows US5

---

## Parallel Example: User Story 3

```bash
# Launch independent pieces of User Story 3 together:
Task: "Add getDailyAttendance/markAttendance/... to app/lib/api/hr-payroll.ts"
Task: "Create app/ui/hr/attendance-table.tsx"
Task: "Create app/ui/hr/mark-edit-modal.tsx"
Task: "Create app/ui/hr/exceptions-modal.tsx and modifications-modal.tsx"
Task: "Create app/ui/hr/holidays-panel.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1, 2, 3, 4, 7, 5 — the full core loop)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — component/utility promotion + route protection)
3. Complete US1 (Employees) → US2 (Documents) → US3 (Attendance) → US4 (Leave) → US7 (Loans) →
   US5 (Payroll)
4. **STOP and VALIDATE**: Run quickstart.md Scenarios 1–6 independently
5. Deploy/demo if ready — the complete employee-to-payslip admin loop

### Incremental Delivery

1. Setup + Foundational → shared components/utilities promoted, routes protected
2. US1 → US2 → US3 → US4 → US7 → US5 → test each independently → core MVP
3. US6 (Challans) → US8 (Transfer) → each tested independently → full P1/P2 scope
4. US9 (Daily Workers) → US10 (Re-enrolment queue) → each tested independently → feature complete

---

## Amendment 2026-09-01 — TDS, Advances, Registers, Late-Coming; Recruitment and Labour Handover

Covers spec FR-030 to FR-041 and plan Phases A1–A7. Task IDs prefixed `TA`. **No new permission**
(reuses `PAYROLL`, `ATTENDANCE`, `REPORTS`).

### Handover (do first — removes scope)

- [X] TA001 **Remove any daily-worker or labour attendance screen from this feature's scope** — they
      live in 013-labour (spec FR-039, supersession ratified 2026-09-01)
- [X] TA002 Add the mount point in the employee screen for 012's "Assets in custody" panel
      (spec FR-040) — **coordinate with 012 T030**
- [X] TA003 Add exit/F&F links to 011's resignation record and letter generation (spec FR-038) —
      **blocked by 011 T029/T043/T044**

### Types and API

- [X] TA004 Extend the HR/payroll API modules with tax-slab, declaration, advance, register, and
      shift-compliance functions plus `zod` schemas
- [X] TA005 [P] Add tax sections, deduction heads, and colour maps to constants

### US14 — TDS (P1)

- [X] TA006 [US14] `tax-slab-editor.tsx`: ordered slab rows with **client-side contiguity and
      non-overlap validation highlighting the offending boundary and disabling Save** (spec FR-031)
- [X] TA007 [US14] `tax-declaration-form.tsx`: **capped deductible amount shown live beside the
      entered value** (spec FR-032); proof upload with typed `accept`
- [X] TA008 [US14] Verify action with cut-off-month helper text
- [X] TA009 [US14] Missing-PAN employees surfaced in the run exception list with a clear
      "higher no-PAN rate applied" explanation
- [X] TA010 [US14] Quarterly TDS report with missing-PAN rows flagged; Form 16 data view
- [X] TA011 [US14] Export via the established handling

### US15 — Salary Advances (P2)

- [X] TA012 [US15] `salary-advance-table.tsx` and form, **visually and navigationally distinct from
      the Loans screen** so the two are never conflated (spec FR-033)
- [X] TA013 [US15] Exceeds-limit inline warning; duplicate open advance 409 inline with a link
- [X] TA014 [US15] **Capped-recovery helper text explaining the carry-forward** (spec FR-034)
- [ ] TA015 [US15] Advance recovery line shown in the F&F settlement

### US16 — Registers (P2)

- [ ] TA016 [US16] `salary-register.tsx`: full earnings/deductions breakup with column totals;
      project filter for the manpower-cost view
- [ ] TA017 [US16] **Available only for processed or paid runs, with an explanatory state
      otherwise** (spec FR-035)
- [ ] TA018 [US16] **Explicit reconciliation warning when totals diverge from the run** — never a
      silently different number (spec FR-035)
- [ ] TA019 [US16] `deduction-report.tsx`: heads split statutory / non-statutory, presented for
      comparison against the challan screens (spec FR-036)
- [ ] TA020 [US16] Wide register tables scroll **within their own container** at mobile widths
      (spec FR-041)
- [ ] TA021 [US16] Export via the established handling

### US17 — Late-Coming (P3)

- [ ] TA022 [US17] `late-coming-report.tsx`: late days, late minutes, early departures, short hours,
      sorted by late days descending; repeat-late-comer marker
- [ ] TA023 [US17] **Explicit "no shift assigned" and "no punch times" markers rather than zero** —
      unconfigured data must never display as punctuality (spec FR-037)
- [ ] TA024 [US17] Copy stating lateness does not deduct pay (spec FR-037)

### Polish

- [ ] TA025 [P] Confirm the salary register, deduction report, and challan screens reconcile on
      screen for the same processed run (SC-A01)
- [ ] TA026 [P] 320px spot-check; `npx tsc --noEmit`
