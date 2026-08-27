# Data Model: My Workspace Frontend (Punch, Leave, Salary, Face Enrolment)

`buildcore-web` holds no database of its own (Constitution Principle V). Every entity below is a
`zod`-validated client-side type mirroring `buildcore-api`'s
`specs/003-my-workspace-backend/data-model.md`, plus one purely client-local type (the offline
queue). See that document for authoritative field shapes and validation rules.

## FaceEnrolmentStatus

`{ status: 'not_enrolled' | 'enrolled' | 're_enrolment_requested'; enrolledAt: string | null }`

Drives Face Enrolment's status badge and which controls (capture/enrol vs. request-re-enrolment vs.
re-enrol-now) are shown (User Story 1, 7).

## PunchResult

`{ id, type: 'in' | 'out', capturedAt, isOfflineSync, faceMatchResult: 'matched' | 'exception',
geofenceResult: 'in_range' | 'exception' }`

Returned from `POST /my/punch`; drives the post-submission notice (spec FR-005).

## AttendanceDay

`{ date, dayOfWeek, inTime: string | null, outTime: string | null, otHours: number, status:
'present' | 'absent' | 'on_leave' | 'weekly_off' | 'holiday' }`

Drives the monthly attendance history table (User Story 3).

## LeaveBalance

`{ leaveType: 'earned' | 'casual' | 'sick' | 'lwp', opening, accrued, used, balance }`

## LeaveApplication

`{ id, leaveType, fromDate, toDate, dayCount, reason, status: 'pending' | 'approved' | 'rejected' |
'cancelled', adminRemarks: string | null }`

## SalaryAvailablePeriods

`string[]` (e.g. `["2026-06", "2026-07"]`) — only Processed/Paid periods, per backend contract.

## SalarySlip

Mirrors `buildcore-api`'s `SalarySlip` projection field-for-field (data-model.md there); this
frontend never recomputes any figure, only renders what the backend returns.

## ReEnrolmentState

`{ status: 'none' | 'pending' | 'unlock_granted' | 'rejected'; reason: string | null;
adminRemarks: string | null; unlockExpiresAt: string | null }`

Drives which action (Request / awaiting approval / Re-enrol Now / rejected-with-remarks) Face
Enrolment shows (User Story 7).

## OfflineQueueEntry (client-local only — never sent as-is; not in the backend's data model)

`{ localId: string (client-generated), type: 'in' | 'out', photoBlob: Blob, latitude, longitude,
capturedAt: string, syncStatus: 'queued' | 'syncing' | 'failed' }`

Stored in IndexedDB (research.md §5) only until successfully submitted via `POST /my/punch`, then
deleted; `syncStatus: 'failed'` (e.g., backend rejects a too-old `capturedAt`) surfaces the Edge
Case notice (spec User Story 6, Acceptance Scenario 4) rather than silently retrying forever.

## Cross-reference to `buildcore-api`

Every shape above (except `OfflineQueueEntry`) corresponds 1:1 to a resource in `buildcore-api`'s
`specs/003-my-workspace-backend/contracts/my-workspace-api.md`; this document does not restate
validation rules or error responses already specified there.
