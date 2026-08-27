# Data Model: HR & Payroll Frontend (Employees, Attendance, Leave, Payroll, Challans, Loans, Daily Workers)

`buildcore-web` holds no database of its own (Constitution Principle V). Every entity below is a
`zod`-validated client-side type mirroring `buildcore-api`'s
`specs/005-hr-payroll-backend/data-model.md` field-for-field; only client-specific view shapes are
noted where they differ.

## Employee

Full field set across all eight tabs (data-model.md "Employee" in the API spec), with
`aadhaar`/`pan`/`bankAccountNumber`/`uan` represented client-side as `{ masked: string; full:
string | null }` — `full` is `null` until a `MaskedField` reveal action populates it for that view
(research.md §5).

## EmployeeDocument

`{ id, documentTypeId, documentTypeName, derivedFlag, documentNumber?, expiresAt?, isExpiringSoon:
boolean, isExpired: boolean }`.

## EmployeeTransfer

`{ id, fromCompanyName, toCompanyName, transferDate, reason, codeRetained }`.

## AttendanceRecord (admin view)

`{ id, employeeId, employeeName, date, inTime?, outTime?, otHours, workedHours, status,
approvalState }`.

## AttendanceModification

`{ id, employeeName, date, changedBy, before: Record<string, unknown>, after: Record<string,
unknown>, timestamp }`.

## Holiday

`{ id, name, date, type, appliesToAllSites, siteNames?: string[] }`.

## LeaveApplication (admin view) / LeaveBalance (admin view)

Same shapes as the My Workspace feature's own types, minus the caller-scoping — includes
`employeeName`.

## PayrollRun / PayrollLineItem

`{ id, period, status, generatedAt } ` and, per employee, the same figure set as the API's
`PayrollLineItem` (data-model.md there).

## Challan row (PF / ESIC / PT)

Three distinct shapes matching contracts/hr-payroll-api.md's three tabs' column sets.

## Loan / LoanScheduleEntry

Mirrors the API's shapes; `totalPaid`/`outstandingBalance` are read directly from the API response
(computed server-side, per that spec's FR-021), never recomputed client-side.

## DailyWorker / DailyWorkerAttendance

Mirrors the API's shapes; `DailyWorkerAttendance.markingMethod: 'face_match' | 'manual'` drives the
distinct visual treatment (spec FR-016).

## ReEnrolmentRequest (admin view)

Mirrors My Workspace's entity plus `employeeName`/`siteName` (joined server-side for the admin
queue).

## Cross-reference to `buildcore-api` and prior `buildcore-web` features

| Concept | Relationship |
|---|---|
| `CameraCapture`, geolocation logic | Promoted from My Workspace's `app/ui/my/` to
`app/ui/shared/` (research.md §3) |
| Salary slip *rendering* | Promoted to `app/ui/shared/salary-slip.tsx`; *data fetching* is this
feature's own new function, never My Workspace's `getSalarySlip` (research.md §4) |
| `ResponsiveList` | Reused from Settings, unchanged |
| `Permission` enum values (`EMPLOYEES`/`ATTENDANCE`/`PAYROLL`/`CHALLANS`/`LOANS`/
`DAILY_WORKER_REGISTRY`) | Reused verbatim for route guards, matching the API's own permission
mapping |
