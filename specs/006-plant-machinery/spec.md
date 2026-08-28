# Feature Specification: Plant & Machinery Frontend (Asset Register, Logbook, Fuel, Maintenance, Hire Bills)

**Feature Branch**: `006-plant-machinery`

**Created**: 2026-08-28

**Status**: Draft

**Input**: "Plant & Machinery Module frontend for BuildCore ERP, nested under /dashboard/plant/*.
Consumes buildcore-api specs/006-plant-machinery-backend/contracts/plant-api.md. Reuses:
formatCurrency (008), StatusBadge (007/008), multi-tab modal pattern."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Asset Register (Priority: P1)

An admin views the equipment list with status and document expiry alerts, registers new
equipment, uploads compliance documents, and deploys equipment to a project site.

**Independent Test**: Register an owned excavator, upload Insurance with expiry 15 days from
now (→ Expiring Soon alert badge), view list — alert visible without opening equipment detail.

**Acceptance Scenarios**:

1. **Given** the Asset Register page, **When** loaded, **Then** the table shows: Code, Name,
   Category, Ownership badge, Site, Current Reading, Status badge (Active=green,
   Under Maintenance=orange, Inactive=gray), Utilisation %, Document Alert (🟡/🔴/none).
2. **Given** the Add Equipment form, **When** all fields are filled and saved, **Then** the
   equipment appears in the list.
3. **Given** a document alert on an equipment row, **When** clicked or hovered, **Then** a
   tooltip shows which document types are expiring/expired.
4. **Given** the equipment detail page, **When** opened, **Then** it shows tabs: Overview,
   Documents, Logbook, Fuel, Maintenance, Services, Hire Bills.

---

### User Story 2 - Daily Logbook (Priority: P1)

A site operator records daily logbook entries (opening/closing meter reading, fuel consumed,
operator, project); the equipment's current reading and utilisation % update.

**Independent Test**: Record a logbook entry for an excavator (opening 100, closing 108 hrs);
confirm total hours = 8; try a second entry for the same date → inline "Entry already exists".

**Acceptance Scenarios**:

1. **Given** the Logbook list, **When** loaded, **Then** it shows Date, Equipment, Opening,
   Closing, Total Hours, Fuel Consumed, Operator, Project.
2. **Given** the Add Logbook Entry modal, **When** Opening and Closing readings are entered,
   **Then** Total Hours = Closing − Opening is shown live (read-only computed field).
3. **Given** Closing < Opening, **When** the form is submitted, **Then** an inline error
   "Closing reading must be greater than opening reading" is shown.
4. **Given** a duplicate equipment+date, **When** submitted, **Then** backend `409` is shown
   as "Entry already exists for this equipment and date".

---

### User Story 3 - Fuel Management (Priority: P2)

A store keeper records fuel issues to equipment; variance vs. benchmark is shown; alert badge
if variance > 15%.

**Independent Test**: Record fuel entry for an excavator with high consumption (variance > 15%);
confirm alert badge appears on the fuel list row.

**Acceptance Scenarios**:

1. **Given** the Fuel list, **When** loaded, **Then** it shows Date, Equipment, Quantity, Rate,
   Amount (formatCurrency), Vendor, Variance %, and a Variance Alert badge if > 15%.
2. **Given** the Add Fuel Entry modal, **When** Quantity and Rate are entered, **Then** Amount
   = Qty × Rate shown live (read-only computed field).
3. **Given** the Monthly Summary page, **When** month is selected, **Then** per-equipment
   totals show: Quantity, Cost, Avg Rate, Variance Status.

---

### User Story 4 - Maintenance (Priority: P2)

An admin opens a maintenance job for equipment (status auto-changes to Under Maintenance),
records parts and cost, and closes the job (status reverts to Active).

**Independent Test**: Open a breakdown job for an excavator; confirm the asset register row
shows "Under Maintenance" badge; close the job; confirm badge reverts to Active.

**Acceptance Scenarios**:

1. **Given** active equipment, **When** "Open Job" is clicked and form submitted, **Then**
   the maintenance job is created and the equipment status badge updates immediately.
2. **Given** an open maintenance job, **When** "Close Job" is clicked with closing reading
   and date, **Then** the job closes and the equipment status reverts to Active.
3. **Given** equipment already Under Maintenance, **When** "Open Job" is attempted, **Then**
   backend `409` is shown as "Equipment already has an open maintenance job".

---

### User Story 5 - Service Schedules (Priority: P2)

An admin configures service intervals per equipment; the list shows status (OK/Due Soon/Overdue)
based on current meter reading.

**Independent Test**: Create a service schedule (oil change, 250 hrs interval, last done 500);
advance equipment reading to 760 via logbook; confirm schedule shows "Overdue".

**Acceptance Scenarios**:

1. **Given** the Service Schedules list, **When** loaded, **Then** each row shows Service Type,
   Last Done Reading, Next Due Reading, Status badge (OK=green, Due Soon=orange, Overdue=red).
2. **Given** the Add Schedule form, **When** submitted, **Then** next due reading auto-filled
   as Last Done + Interval (read-only computed field shown in form preview).

---

### User Story 6 - Hire Bills (Priority: P3)

An admin records vendor hire bills for hired equipment, verifies them against logbook hours,
reviews TDS deduction, and marks as paid.

**Independent Test**: Create a hire bill (40 billed hours vs. 38 logbook hours, 2% TDS); verify
the variance and net payable are correct; move through verify → pay workflow.

**Acceptance Scenarios**:

1. **Given** the Hire Bills list, **When** loaded, **Then** each row shows Equipment, Vendor,
   Billed Hours, Logbook Hours, Variance, TDS, Net Payable (formatCurrency), Status badge
   (Pending=gray, Verified=blue, Paid=green).
2. **Given** a pending hire bill, **When** "Verify" is clicked, **Then** a confirmation dialog
   confirms the variance (if any) before proceeding.
3. **Given** a verified hire bill, **When** "Mark Paid" is clicked, **Then** a modal collects
   Payment Date and Reference Number.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: All routes MUST be under `/dashboard/plant/*`.
- **FR-002**: Logbook Total Hours MUST compute live client-side (`closing − opening`) as the
  operator types — no page reload required.
- **FR-003**: Fuel Amount MUST compute live client-side (`qty × rate`).
- **FR-004**: Document alert badges on the Asset Register list MUST be visible without opening
  equipment detail — rendered from the list API's `expiryAlert` and `alertDocumentTypes` fields.
- **FR-005**: Equipment status badge changes (Under Maintenance ↔ Active) MUST reflect
  immediately after maintenance job open/close via react-query invalidation.
- **FR-006**: All monetary values MUST use `formatCurrency` from `app/lib/utils.ts`.
- **FR-007**: All API calls MUST go through `app/lib/api/plant.ts`.

## Success Criteria *(mandatory)*

- **SC-001**: Asset Register renders 200 equipment rows with expiry alerts in under 3 seconds.
- **SC-002**: Logbook and fuel entries show live-computed totals/amounts with no perceptible delay.
- **SC-003**: Hire bill net payable always displays correctly (grossAmount − tdsAmount).

## Assumptions

- `formatCurrency` and `StatusBadge` already exist from 007/008; this feature extends
  `StatusBadge` with `under_maintenance`=orange, `due_soon`=orange, `overdue`=red statuses.
- Vendor dropdown in Hire Bills and Fuel modals reuses `getVendors()` from `app/lib/api/partners.ts`.
- Site dropdown reuses `getSites()` from `app/lib/api/projects.ts`.
- Employee operator dropdown reuses HR employee list endpoint.
