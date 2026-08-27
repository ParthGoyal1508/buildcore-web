# Data Model: Settings Module Frontend (Companies, Users, Roles & Employee Setup)

`buildcore-web` holds no database of its own (Constitution Principle V) — every entity below is a
`zod`-validated client-side type mirroring `buildcore-api`'s
`specs/002-settings-backend/data-model.md`, used only to shape API responses and form state. Field
names match the backend's; see that document for the authoritative shape, validation rules, and
per-company scoping semantics.

## Company

`{ id, name, shortCode, logoUrl, status: 'active' | 'inactive', gstin, pan, cin, tan, address, city,
state, pinCode, pfEstablishmentCode, esicCode, professionalTaxRegNumber, bocwRegNumber,
payrollLockDay, pfEmployerRate, esicEmployerRate, gratuityRate, bonusRate }`

Drives the Company List (User Story 1) and the five-tab Add/Edit modal (research.md §5); also the
source of the "currently selected company" used by Employee Setup (research.md §6) and any
company-selector dropdown elsewhere in the app.

## Role

`{ id, name, permissions: Permission[], isProtected, assignedUserCount }`

`Permission` is the fixed 20-value string union mirrored in `app/lib/constants.ts` (research.md
§4). Drives the Roles List and Add/Edit Role modal (User Story 2); `isProtected` disables edit/
delete controls for the Super Admin row.

## UserSummary

`{ id, name, email, role: { id, name } | null, status: 'active' | 'inactive', lastLoginAt: string |
null }`

Drives the Users List (User Story 3); `role: null` is the state a user is left in after their role
is deleted elsewhere (backend FR-010), rendered as an explicit "No role assigned" state rather than
a blank cell.

## Department / Designation

`{ id, companyId, name }`

Drives the Employee Setup Departments/Designations tabs (User Story 4), scoped to the Employee
Setup screen's `CompanyContext` (research.md §6).

## DocumentType

`{ id, companyId, code, name, isMandatory, hasExpiry, needsNumber, sortOrder, isActive,
derivedFlag: 'MandatoryNumber' | 'Mandatory' | 'ExpiryNumber' | 'Expiry' | 'Number' | 'Optional' }`

`derivedFlag` is computed identically on both sides (backend computes it for the API response per
its own research.md §7; the frontend recomputes the same pure function locally for the live preview
in the Add/Edit modal before save, per spec FR-016/User Story 5 Acceptance Scenario 1).

## Shift

`{ id, companyId, name, inTime, outTime, graceMinutes }`

Drives the Employee Setup Shifts tab (User Story 6).

## CodeSeriesView

`{ companyId, shortCode, nextCode }`

Read-only projection for the Code Series tab (User Story 7) — `nextCode` is a display-only string
(`"DC-0001"`), never an editable field; there is no create/update shape for this entity on the
frontend.

## Cross-reference to `buildcore-api`

Every shape above corresponds 1:1 to a resource in `buildcore-api`'s
`specs/002-settings-backend/contracts/settings-api.md`; this document does not restate validation
rules, uniqueness constraints, or error responses already specified there — see that contract for
the wire-level authority this frontend is built against.
