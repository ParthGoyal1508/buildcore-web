# Feature Specification: Machinery Module Frontend

**Feature Branch**: `006-machinery`

**Created**: 2026-08-27

**Status**: Draft

**Input**: User description: "Machinery Module (Asset Register, Logbook, Fuel, Maintenance, Hire Bills, Equipment Categories, Equipment Doc Types, Hire Rates) frontend for the BuildCore ERP frontend (buildcore-web), per the PRD at /Users/parthgoyal/Projects/ERP-Demo/docs/prd/04-machinery.prd.md."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Asset Register (Priority: P1)

An admin registers and browses the company's equipment fleet, seeing at a glance which machines
need attention (expiring documents, overdue maintenance), and manages each machine's compliance
documents.

**Why this priority**: Every other screen in this module references a machine; nothing else can
be meaningfully demonstrated without it.

**Independent Test**: Can be fully tested by adding a machine via the Add Equipment modal,
opening its detail page, uploading a document with an expiry date, and confirming the list shows
the correct Flags count and document status coloring.

**Acceptance Scenarios**:

1. **Given** an admin on `/dashboard/plant`, **When** they open Add Equipment and submit the
   required fields, **Then** the new machine appears in the list with an auto-generated Code.
2. **Given** the equipment list, **When** an admin applies Search, Category, Ownership, Status, or
   Site filters, **Then** only matching machines are shown.
3. **Given** a machine's detail page, **When** an admin uploads a document with an expiry date,
   **Then** the document appears with its derived Valid/Expiring Soon/Expired status, and the list
   view's Flags count for that machine reflects it.
4. **Given** a machine with expired documents or overdue maintenance, **When** the equipment list
   renders, **Then** its Flags badge shows the combined count, distinctly styled from a
   zero-flags row.

---

### User Story 2 - Logbook (Priority: P1)

A supervisor or admin records daily logbook entries per machine, seeing the machine's reading stay
current without manual reconciliation.

**Why this priority**: The operational backbone every other screen's computed figures
(Utilization, Fuel variance, Hire Bill verification) depend on; must exist before those can be
demonstrated end-to-end.

**Independent Test**: Can be fully tested by adding a logbook entry for a machine and confirming
its Current Reading (visible on the Equipment list/detail) updates, and that the next Add Entry
form pre-fills Opening Reading from it.

**Acceptance Scenarios**:

1. **Given** the Add Entry modal for a machine, **When** it opens, **Then** Opening Reading is
   pre-filled from that machine's last recorded reading.
2. **Given** a valid Closing Reading greater than Opening Reading, **When** the entry is saved,
   **Then** it appears in the Logbook Entries table with the correct auto-calculated Total
   Hours/Km, and the machine's Current Reading updates accordingly.
3. **Given** a Closing Reading lower than Opening Reading, **When** the admin submits without
   confirming a meter-reset override, **Then** the system rejects the entry with a clear message;
   confirming the override allows it through.

---

### User Story 3 - Fuel (Priority: P2)

An admin records fuel fill-ups and sees, without manual cross-checking, which machines are
consuming more fuel than expected for their logged hours.

**Why this priority**: Builds on Logbook (US2) data; delivers a named anti-fraud goal but is not
required for the module to be minimally demonstrable.

**Independent Test**: Can be fully tested by recording fuel entries whose consumption rate exceeds
a machine's benchmark by more than its category's threshold, and confirming the machine shows a
fuel-variance flag (surfaced both in this module and via the Dashboard/Notifications screens built
by the Dashboard feature).

**Acceptance Scenarios**:

1. **Given** the Add Fuel Entry modal, **When** Quantity and Rate are entered, **Then** Amount is
   computed and shown before submission.
2. **Given** the fuel entries list with a date range/machine/site filter applied, **Then** the
   Summary Totals bar (Total Fuel, Total Cost, Average Consumption) reflects only the filtered
   set.
3. **Given** a machine whose recent consumption exceeds its benchmark beyond the configured
   threshold, **When** the list or Equipment detail is viewed, **Then** a fuel-variance flag is
   visible, and the same condition appears as a Notification/Dashboard alert (reusing the existing
   generic renderer built by the Dashboard feature — no new frontend code for this).

---

### User Story 4 - Maintenance (Priority: P2)

An admin schedules preventive services and tracks maintenance jobs, seeing which machines are due
for service and which are currently under repair.

**Why this priority**: Independently valuable once Asset Register exists; not required to unlock
any other screen — placed alongside Fuel at P2.

**Independent Test**: Can be fully tested by creating a service schedule, opening a job linked to
it, confirming the machine's Status shows "Under Maintenance" everywhere it's displayed, closing
the job, and confirming Status reverts and the schedule's Remaining resets.

**Acceptance Scenarios**:

1. **Given** the Due Services section, **When** a machine's Remaining drops below 10% of its
   service interval, **Then** that row is visibly flagged (red).
2. **Given** the New Maintenance Job modal, **When** a job is opened for a machine, **Then** that
   machine's Status shows "Under Maintenance" on the Equipment list/detail immediately.
3. **Given** an open job linked to a service schedule, **When** the admin closes it (Actions →
   Close, entering Total Cost), **Then** the machine's Status reverts to Active and the linked
   schedule's Last Done/Remaining update in the Due Services section.

---

### User Story 5 - Hire Bills (Priority: P2)

An admin records hire bills from equipment vendors and verifies each one against logbook data
before authorizing payment, preventing overpayment.

**Why this priority**: Depends on Logbook (US2) and Hire Rates (part of US6) data; delivers the
PRD's overpayment-prevention goal, sequenced after the P1 stories.

**Independent Test**: Can be fully tested by creating a hire bill with Billed Hours differing from
the machine's summed Logbook Hours for the period, running Verify, and confirming the displayed
Variance, and that Mark Paid (once Verified) shows the correct TDS and Net Payable.

**Acceptance Scenarios**:

1. **Given** the Add Hire Bill modal, **When** a Hired machine and period are selected, **Then**
   Rate auto-populates from the effective Hire Rate and Amount computes accordingly.
2. **Given** a bill with Status Pending Verification, **When** the admin clicks Verify, **Then**
   Logbook Hours and Variance display, with over-billed variance visibly highlighted (red); Status
   becomes Verified only when the variance is within the acceptable range.
3. **Given** a Verified bill, **When** the admin clicks Mark Paid, **Then** TDS and Net Payable
   display and Status becomes Paid; Mark Paid is not available before Verified.
4. **Given** an Owned (not Hired) machine, **When** the admin attempts to add a hire bill for it,
   **Then** the action is unavailable/rejected with a clear message.

---

### User Story 6 - Reference Data masters (Priority: P3)

An admin manages Equipment Categories, Equipment Doc Types, and Hire Rates — the module's own
configuration — adjusting the seeded defaults to match the company's actual fleet and market
rates.

**Why this priority**: The module ships with seeded defaults for all three masters, so User
Stories 1–5 are independently demonstrable without an admin touching these screens first. This
story is the admin-facing CRUD for adjusting those defaults.

**Independent Test**: Can be fully tested by editing a seeded category's fuel benchmark and
confirming a new Fuel entry (US3) uses it; and by adding a new effective-dated Hire Rate and
confirming a Hire Bill (US5) billed within its window picks it up.

**Acceptance Scenarios**:

1. **Given** the Equipment Categories screen, **When** an admin edits a category's fuel benchmark,
   meter type, or variance thresholds, **Then** the change is saved and reflected the next time
   that category's data is used elsewhere.
2. **Given** the Equipment Doc Types screen, **When** an admin edits a doc type's Default Remind
   Days or toggles, **Then** the change is saved.
3. **Given** the Hire Rates screen with an existing "Current" rate for a category, **When** an
   admin adds a new rate with an Effective From date, **Then** the prior rate's Effective To
   updates automatically and both rows appear in the effective-dated history.

---

### User Story 7 - Equipment Utilization Report (Priority: P3)

An admin reviews monthly utilization across the fleet to identify underutilized hired machines
worth releasing and overutilized owned machines at breakdown risk.

**Why this priority**: A read-only analytical view depending on Logbook data (US2) accumulating
over time; valuable but not blocking any other screen.

**Independent Test**: Can be fully tested by selecting a month and confirming the four summary
cards' counts match the detailed table's Band column, sorted ascending by Utilization %.

**Acceptance Scenarios**:

1. **Given** the Month Selector (defaulting to the current month), **When** a different month is
   selected, **Then** the summary cards, distribution bar, and table all refresh for that month.
2. **Given** the detailed table, **Then** rows are sorted by Utilization % ascending (worst first)
   and each row's Band styling matches its Underutilized/Well Utilized/Overutilized value.

---

### Edge Cases

- What happens when a machine has no logbook entries yet? Utilization % and Due Services'
  Remaining show as not-yet-available rather than a misleading 0%.
- What happens when no fuel or hire vendors exist yet (Partners module not yet built)? The
  relevant dropdown (Fuel Entry's Vendor, Hire Bill's Vendor) shows an empty state directing the
  admin that vendor setup is pending, rather than a silently empty, unexplained dropdown.
- What happens when an admin attempts Mark Paid on a bill that isn't Verified? The action is
  disabled/unavailable, consistent with User Story 5's acceptance scenario 3.
- What happens when a document type with "Has Expiry Date" enabled is uploaded without an expiry
  date? The upload is rejected with a field-level validation message.
- What happens on a mobile viewport? Every list in this module renders as the app's existing
  `ResponsiveList` card layout (Settings/My Workspace/Dashboard/HR & Payroll precedent) rather than
  a horizontally-scrolling table.

## Requirements *(mandatory)*

### Functional Requirements

**Asset Register**

- **FR-001**: System MUST render an Equipment list at `/dashboard/plant` with columns for Code,
  Machine, Class, Category, Ownership, Status, Site, Reading, Utilization %, and a Flags badge,
  filterable by Search, Category, Ownership, Status, and Site.
- **FR-002**: System MUST provide an Add/Edit Equipment modal covering every field the backend
  contract exposes (identity, classification, site, make/model/registration identifiers, current
  reading, fuel benchmark override, purchase/depreciation metadata).
- **FR-003**: System MUST provide a per-machine detail page showing the machine's Overview and its
  Documents (upload, list with derived Valid/Expiring Soon/Expired status and expiry date, status
  colored consistently with the rest of this module).
- **FR-004**: System MUST reject a document upload for a doc type requiring an expiry date if none
  is provided, with a field-level validation message.
- **FR-005**: System MUST display each machine's Flags badge as the combined count of
  expiring/expired documents and overdue maintenance, styled distinctly from a zero-flags row.

**Logbook**

- **FR-006**: System MUST render a Logbook Entries table at `/dashboard/plant/logbook` with an Add
  Entry modal (Machine, Date, Site, Operator, Opening Reading, Closing Reading, Fuel Consumed,
  Remarks), Opening Reading pre-filled from the machine's last recorded reading.
- **FR-007**: System MUST reject a Closing Reading lower than Opening Reading unless the admin
  explicitly confirms a meter-reset override, matching the backend's `isMeterResetOverride` field.
- **FR-008**: System MUST support Edit and Delete actions on logbook entries.

**Fuel**

- **FR-009**: System MUST render a Fuel Entries table at `/dashboard/plant/fuel` with an Add Entry
  modal (Date, Machine, Site, Quantity, Rate, Reading at Fill, Vendor), computing and displaying
  Amount before submission.
- **FR-010**: System MUST display a Summary Totals bar (Total Fuel, Total Cost, Average
  Consumption) that reflects the currently applied Date range/Machine/Site filters.
- **FR-011**: System MUST visibly flag machines whose fuel-variance condition is active, sourced
  from the backend's computed flag — no variance calculation performed in the frontend.

**Maintenance**

- **FR-012**: System MUST render a Due Services section and a Maintenance Jobs section at
  `/dashboard/plant/maintenance`, with New Service Schedule and New Maintenance Job modals.
- **FR-013**: System MUST visibly flag (red) any Due Services row whose Remaining is below 10% of
  its interval, sourced from the backend's computed value.
- **FR-014**: System MUST provide a Close action on open maintenance jobs, capturing Total Cost,
  and MUST reflect the resulting machine Status change (Under Maintenance ↔ Active) everywhere
  that machine's status is displayed.

**Hire Bills**

- **FR-015**: System MUST render a Hire Bill list at `/dashboard/plant/hire-bills` with an Add
  Hire Bill modal (Vendor, Machine — restricted to Hired equipment, Period From/To, Billed Hours,
  Party Bill Number), Rate/Amount auto-populated from the backend.
- **FR-016**: System MUST provide a Verify action displaying Logbook Hours and Variance (over-
  billed variance visibly highlighted), transitioning Status per the backend's response.
- **FR-017**: System MUST provide a Mark Paid action, available only when Status is Verified,
  displaying the resulting TDS and Net Payable.

**Reference Data masters**

- **FR-018**: System MUST render Equipment Categories, Equipment Doc Types, and Hire Rates screens
  at `/dashboard/plant/categories`, `/dashboard/plant/doc-types`, and `/dashboard/plant/rates`,
  each with its own add/edit modal per the backend contract's field set.
- **FR-019**: System MUST render the Hire Rates screen's effective-dated history per category,
  showing "Current" for any rate with no Effective To date.

**Equipment Utilization Report**

- **FR-020**: System MUST render a Utilization Report at `/dashboard/plant/utilization` with a
  Month Selector (defaulting to current month), 4 summary cards (Total Machines, Underutilized,
  Well Utilized, Overutilized), a utilization-band distribution visualization, and a detailed
  table sorted by Utilization % ascending, all sourced from backend-computed figures.

**Cross-cutting**

- **FR-021**: System MUST resolve the existing `nav-links.tsx` "Plant & Machinery" entry to real
  content under `/dashboard/plant/*` rather than adding a new nav entry.
- **FR-022**: System MUST extend `middleware.ts` to guard `/dashboard/plant/*` with the matching
  permission per area (`ASSET_REGISTER`/`LOGBOOK`/`FUEL`/`MAINTENANCE`/`HIRE_BILLS`/
  `MACHINERY_SETTINGS`), mirroring the backend's permission mapping.
- **FR-023**: System MUST surface the new Document Expiry, Fuel Variance, and Maintenance Due
  alert/notification types, and the new Machinery Cost/Fuel Cost/Hire Bills Dashboard widgets,
  entirely through the Dashboard feature's existing generic widget/notification renderers — this
  feature adds zero widget-specific or notification-specific frontend code.
- **FR-024**: Every list in this module MUST use the existing `ResponsiveList` component and be
  fully keyboard-operable, built into each screen's own implementation from the start.
- **FR-025**: Every API call in this module MUST go through a dedicated `app/lib/api/machinery.ts`
  file of typed, `zod`-validated functions — no direct fetch calls from components.

### Key Entities

- **Equipment**, **EquipmentDocument**, **EquipmentCategory**, **EquipmentDocType**: client-side
  view types mirroring `buildcore-api`'s `plant` schema entities (specs/006-machinery-backend).
- **LogbookEntry**, **FuelEntry**: daily operational records per machine.
- **ServiceSchedule**, **MaintenanceJob**: preventive/breakdown maintenance records.
- **HireBill**, **HireRate**: hire-bill verification and effective-dated rate records.
- **Vendor**: read-only reference type (name, type, for display only) — this feature does not
  build vendor management UI (see Assumptions).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can register a new machine, upload its first document, and see it appear
  correctly in the equipment list in under 5 minutes.
- **SC-002**: Every document nearing or past expiry is visibly distinguishable (color/badge) from
  a valid one on both the list and detail views, with zero manual cross-checking required.
- **SC-003**: An admin can verify a hire bill and see its variance without leaving the Hire Bills
  screen or performing any manual calculation.
- **SC-004**: The Utilization Report's summary cards' counts always match the detailed table's Band
  column for the same month, with zero discrepancy.
- **SC-005**: Every screen in this module is fully usable (all actions reachable, no horizontal
  scroll) on a mobile viewport.

## Assumptions

- Add/Edit Equipment, New Maintenance Job, New Service Schedule, and Add Hire Bill are modals (not
  dedicated pages), matching the PRD's own explicit naming for each; only Equipment's Documents
  need a dedicated per-machine detail page, since they don't fit a flat single-submit form.
- The Equipment detail page shows Overview + Documents only; Logbook/Fuel/Maintenance/Hire Bill
  history for a specific machine is accessed via each module's own list screen filtered by
  Machine, matching the PRD's own per-module (not per-machine) screen structure.
- This feature does not build a Vendor management screen. Fuel Entry's and Hire Bill's Vendor
  fields are read-only dropdowns backed by the backend's existing (interim) vendor list endpoint;
  full vendor administration is out of scope, deferred to a future Partners frontend feature — the
  PRD itself frames vendors as coming "from Partners."
- The Utilization Report's per-row "Recommendation" text is backend-computed and returned as plain
  text for display, consistent with this module's backend-driven, frontend-renders-only
  architecture (matching the Dashboard feature's established pattern).
- Document upload UI mirrors the pattern already established by HR & Payroll's Employee Documents
  tab, adapted to Equipment's own data-fetching functions — the pattern is reused, not the
  component's underlying HR-specific code.
