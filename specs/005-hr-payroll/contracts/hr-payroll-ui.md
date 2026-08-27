# Contract: HR & Payroll UI routes and `app/lib/api/hr-payroll.ts`

Routes live under `app/dashboard/hr/` (research.md §1). Every function below is a typed wrapper
calling the corresponding `buildcore-api` endpoint in
`specs/005-hr-payroll-backend/contracts/hr-payroll-api.md`.

## `/dashboard/hr/employees` (User Stories 1, 2, 8)

**Pages**: `page.tsx` (list), `[id]/page.tsx` (detail), `new/page.tsx` + `[id]/edit/page.tsx`
(eight-tab form, research.md §2).

**Functions**: `listEmployees(filters)`, `getEmployee(id)`, `createEmployee(input)`,
`updateEmployee(id, input)`, `revealEmployeePii(id, field)`, `transferEmployee(id, input)`,
`uploadEmployeeDocument(id, input)`, `listEmployeeDocuments(id)`.

**Components**: `app/ui/hr/employee-form.tsx` (eight tabs), `employee-list.tsx`
(`ResponsiveList`-based), `employee-detail-tabs.tsx`, `masked-field.tsx` (research.md §5),
`documents-tab.tsx`, `transfer-modal.tsx`.

Guard: middleware requires `EMPLOYEES`.

## `/dashboard/hr/attendance` (User Story 3)

**Page**: `page.tsx` + `attendance-table.tsx`, `mark-edit-modal.tsx`, `exceptions-modal.tsx`,
`modifications-modal.tsx`, `holidays-panel.tsx`.

**Functions**: `getDailyAttendance(date, siteId)`, `markAttendance(input)`,
`updateAttendance(id, input)`, `getExceptions(date, siteId)`, `getModifications(filters)`,
`listHolidays()`, `createHoliday(input)`.

Guard: middleware requires `ATTENDANCE`.

## `/dashboard/hr/leave` (User Story 4)

**Page**: `page.tsx` + `leave-applications-table.tsx`, `leave-balance-table.tsx`.

**Functions**: `listAllLeaveApplications(status?)`, `decideLeaveApplication(id, decision)` (reuses
the same backend action My Workspace's admin decide already calls), `listLeaveBalances(employeeId?)`.

Guard: middleware requires `ATTENDANCE`.

## `/dashboard/hr/payroll` (User Story 5)

**Page**: `page.tsx` + `payroll-list.tsx`, `generate-payroll-form.tsx`,
`[runId]/employees/[employeeId]/slip/page.tsx` (renders the shared `salary-slip.tsx`, research.md
§4).

**Functions**: `generatePayroll(companyId, period)`, `listPayrollRuns(filters)`,
`processPayrollRun(id)`, `markPayrollRunPaid(id)`, `getEmployeeSalarySlip(runId, employeeId)`
(admin-scoped — never My Workspace's `getSalarySlip`), `downloadSalarySlipPdf(runId, employeeId)`,
`downloadBankSheet(runId)`.

Guard: middleware requires `PAYROLL`.

## `/dashboard/hr/challans` (User Story 6)

**Page**: `page.tsx` + `challan-tabs.tsx` (PF/ESIC/PT), each reusing `ResponsiveList`.

**Functions**: `getPfChallan(period, companyId)`, `getEsicChallan(...)`, `getPtChallan(...)`,
`exportChallan(type, period, companyId)`.

Guard: middleware requires `CHALLANS`.

## `/dashboard/hr/loans` (User Story 7)

**Page**: `page.tsx` + `loan-list.tsx`, `new-loan-modal.tsx`, `[id]/schedule/page.tsx`.

**Functions**: `listLoans(filters)`, `createLoan(input)`, `getLoanSchedule(id)`,
`closeLoan(id)`.

Guard: middleware requires `LOANS`.

## `/dashboard/hr/daily-workers` (User Story 9)

**Page**: `page.tsx` (registry list + enrolment form), `attendance/page.tsx` (mobile-optimized
capture screen).

**Functions**: `listDailyWorkers(siteId?, status?)`, `enrolDailyWorker(input)` (uses the shared
`CameraCapture`, research.md §3), `deactivateDailyWorker(id)`, `convertDailyWorker(id)`,
`markDailyWorkerAttendance(input)` (face-match or manual, uses shared `CameraCapture` +
geolocation), `getDailyWorkerAttendance(date, siteId)`, `getDailyWorkerWageSummary(siteId, period)`.

Guard: middleware requires `DAILY_WORKER_REGISTRY`.

## Biometric Re-enrolment Requests queue — within `/dashboard/hr/employees` (User Story 10)

**Component**: `app/ui/hr/reenrolment-queue.tsx` (a tab or sub-section on the Employees area).

**Functions**: `listReEnrolmentRequests(status?)`, `decideReEnrolmentRequest(id, decision)`
(reuses My Workspace's existing admin decide endpoint unchanged).

Guard: middleware requires `EMPLOYEES`.

## Shared: `app/ui/shared/camera-capture.tsx`, `app/ui/shared/salary-slip.tsx`,
`app/lib/geolocation.ts` (promoted from My Workspace — research.md §3, §4)

## Shared: `app/ui/dashboard/nav-links.tsx` (MODIFIED)

"HR & Payroll" entry's target (`/dashboard/hr`) now resolves to a real landing page instead of a
404.
